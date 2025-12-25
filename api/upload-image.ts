// api/upload-image.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { Readable } from 'stream';

// ────────────────────────────────────────────────
// Environment variables (separate credentials - recommended)
// ────────────────────────────────────────────────
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SERVICE_ACCOUNT_PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

// Cache the drive client for better performance
let cachedDrive: ReturnType<typeof google.drive> | null = null;

async function getDriveClient() {
  if (cachedDrive) return cachedDrive;

  if (!SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY) {
    throw new Error(
      'Missing Google Service Account credentials. ' +
      'Please set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'
    );
  }

  // Fix common Vercel/Netlify escaping issues
  let privateKey = SERVICE_ACCOUNT_PRIVATE_KEY
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .trim();

  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') || 
      !privateKey.includes('-----END PRIVATE KEY-----')) {
    throw new Error('Private key format appears invalid - missing PEM headers');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive'
    ],
  });

  cachedDrive = google.drive({ version: 'v3', auth });
  return cachedDrive;
}

// ────────────────────────────────────────────────
// CORS & Response Helpers
// ────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const;

function sendJson(res: VercelResponse, status: number, body: unknown) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader('Content-Type', 'application/json');
  return res.status(status).json(body);
}

// ────────────────────────────────────────────────
// Main handler
// ────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, {});
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed - use POST' });
  }

  try {
    // Early env validation
    if (!FOLDER_ID || !SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY) {
      return sendJson(res, 503, {
        error: 'Server configuration error - missing environment variables',
        missing: [
          !FOLDER_ID ? 'GOOGLE_DRIVE_FOLDER_ID' : null,
          !SERVICE_ACCOUNT_EMAIL ? 'GOOGLE_SERVICE_ACCOUNT_EMAIL' : null,
          !SERVICE_ACCOUNT_PRIVATE_KEY ? 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY' : null,
        ].filter(Boolean),
      });
    }

    const { base64, filename, mimetype } = req.body as {
      base64?: string;
      filename?: string;
      mimetype?: string;
    };

    if (!base64 || !filename || !mimetype) {
      return sendJson(res, 400, {
        error: 'Missing required fields',
        required: ['base64', 'filename', 'mimetype'],
      });
    }

    // Handle data URI prefix if present
    const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;

    let buffer: Buffer;
    try {
      buffer = Buffer.from(cleanBase64, 'base64');
    } catch {
      return sendJson(res, 400, { error: 'Invalid base64 data' });
    }

    if (buffer.length === 0) {
      return sendJson(res, 400, { error: 'Empty file content' });
    }

    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const drive = await getDriveClient();

    // Upload
    const uploadResult = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [FOLDER_ID],
      },
      media: {
        mimeType: mimetype,
        body: stream,
      },
      fields: 'id, name, webViewLink, webContentLink',
      supportsAllDrives: true,
    });

    const fileId = uploadResult.data.id;
    if (!fileId) throw new Error('Upload succeeded but no file ID returned');

    // Make public
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      supportsAllDrives: true,
    });

    // Get final info
    const file = await drive.files.get({
      fileId,
      fields: 'id, name, webViewLink, webContentLink',
      supportsAllDrives: true,
    });

    return sendJson(res, 201, {
      success: true,
      fileId,
      filename: file.data.name,
      webViewLink: file.data.webViewLink,
      webContentLink: file.data.webContentLink,
      directUrl: `https://drive.google.com/uc?id=${fileId}`,
      previewUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`,
    });
  } catch (error: any) {
    console.error('Upload error:', error);

    const status = error.code === 403 ? 403 :
                   error.code === 401 ? 401 :
                   error.code === 400 ? 400 : 500;

    let message = error.message || 'Upload failed';

    if (error.message?.includes('invalid_grant') || error.message?.includes('JWT')) {
      message = 'Authentication failed - check service account key format';
    } else if (error.code === 403) {
      message = 'Permission denied - service account needs Editor access to folder';
    } else if (error.message?.includes('not found')) {
      message = 'Target folder not found';
    }

    return sendJson(res, status, { error: message });
  }
}
