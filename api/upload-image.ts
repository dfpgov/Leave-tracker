// api/upload-image.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { Readable } from 'stream';

// ────────────────────────────────────────────────
// Environment variables
// ────────────────────────────────────────────────
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SERVICE_ACCOUNT_PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

// Cache the auth client (better cold-start performance)
let cachedDriveClient: ReturnType<typeof google.drive> | null = null;

async function getDriveClient() {
  if (cachedDriveClient) return cachedDriveClient;

  if (!SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY) {
    throw new Error('Missing Google Service Account credentials in environment variables');
  }

  // Fix common Vercel/Netlify escaping issues
  let privateKey = SERVICE_ACCOUNT_PRIVATE_KEY
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .trim();

  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    throw new Error('Invalid private key format - missing PEM header');
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

  cachedDriveClient = google.drive({ version: 'v3', auth });
  return cachedDriveClient;
}

// ────────────────────────────────────────────────
// CORS & Response Helpers
// ────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const;

function json(res: VercelResponse, status: number, data: unknown) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader('Content-Type', 'application/json');
  return res.status(status).json(data);
}

// ────────────────────────────────────────────────
// Main Handler
// ────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return json(res, 200, {});
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed - use POST' });
  }

  try {
    // Check required env vars
    if (!FOLDER_ID || !SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY) {
      return json(res, 503, {
        error: 'Server configuration error - missing environment variables',
        missing: [
          !FOLDER_ID ? 'GOOGLE_DRIVE_FOLDER_ID' : null,
          !SERVICE_ACCOUNT_EMAIL ? 'GOOGLE_SERVICE_ACCOUNT_EMAIL' : null,
          !SERVICE_ACCOUNT_PRIVATE_KEY ? 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY' : null,
        ].filter(Boolean),
      });
    }

    // Validate request body
    const { base64, filename, mimetype } = req.body as {
      base64?: string;
      filename?: string;
      mimetype?: string;
    };

    if (!base64 || !filename || !mimetype) {
      return json(res, 400, {
        error: 'Missing required fields',
        required: ['base64', 'filename', 'mimetype'],
      });
    }

    // Clean base64 (support both with/without data-uri prefix)
    const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;

    let buffer: Buffer;
    try {
      buffer = Buffer.from(cleanBase64, 'base64');
    } catch {
      return json(res, 400, { error: 'Invalid base64 string' });
    }

    if (buffer.length === 0) {
      return json(res, 400, { error: 'Empty file content' });
    }

    // Create stream for upload
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const drive = await getDriveClient();

    // Upload file
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
    if (!fileId) {
      throw new Error('Upload succeeded but no file ID returned');
    }

    // Make file publicly readable
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      supportsAllDrives: true,
    });

    // Final file info
    const file = await drive.files.get({
      fileId,
      fields: 'id, name, webViewLink, webContentLink',
      supportsAllDrives: true,
    });

    return json(res, 201, {
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

    let message = error.message || 'Internal server error';

    if (error.message?.includes('invalid_grant') || error.message?.includes('JWT')) {
      message = 'Authentication failed - invalid or malformed service account credentials';
    } else if (error.code === 403) {
      message = 'Permission denied - service account needs Editor access to the target folder';
    } else if (error.message?.includes('not found')) {
      message = 'Target folder not found';
    }

    return json(res, status, { error: message });
  }
}
