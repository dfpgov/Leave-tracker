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

// Cache auth client
let cachedDrive: ReturnType<typeof google.drive> | null = null;

async function getDriveClient() {
  if (cachedDrive) return cachedDrive;

  if (!SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY) {
    throw new Error('Missing Google Service Account credentials in environment variables');
  }

  // Fix Vercel/Netlify double-escaping issues
  const privateKey = SERVICE_ACCOUNT_PRIVATE_KEY
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .trim();

  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') || 
      !privateKey.includes('-----END PRIVATE KEY-----')) {
    throw new Error('Service account private key appears to be malformed');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
    ],
  });

  cachedDrive = google.drive({ version: 'v3', auth });
  return cachedDrive;
}

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const;

function sendJson(res: VercelResponse, status: number, body: unknown) {
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
  res.setHeader('Content-Type', 'application/json');
  res.status(status).json(body);
}

// ────────────────────────────────────────────────
// Main handler
// ────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Log incoming request for debugging (visible in Vercel logs)
  console.log(`[${new Date().toISOString()}] ${req.method} /api/upload-image`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body type:', typeof req.body);
  console.log('Body preview:', 
    typeof req.body === 'object' && req.body !== null
      ? JSON.stringify(req.body).slice(0, 300) + '...'
      : req.body
  );

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, {});
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
  }

  try {
    // Environment check
    if (!FOLDER_ID || !SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY) {
      return sendJson(res, 503, {
        error: 'Server configuration error - missing environment variables',
        missing: [
          !FOLDER_ID && 'GOOGLE_DRIVE_FOLDER_ID',
          !SERVICE_ACCOUNT_EMAIL && 'GOOGLE_SERVICE_ACCOUNT_EMAIL',
          !SERVICE_ACCOUNT_PRIVATE_KEY && 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
        ].filter(Boolean),
      });
    }

    // Get and validate body
    const body = req.body as Partial<{ base64: string; filename: string; mimetype: string }>;

    if (!body || Object.keys(body).length === 0) {
      return sendJson(res, 400, {
        error: 'Empty request body. Please send JSON with base64, filename and mimetype fields.',
        received: 'empty or undefined',
      });
    }

    const { base64, filename, mimetype } = body;

    if (!base64) {
      return sendJson(res, 400, {
        error: 'Missing required field: base64',
        received_fields: Object.keys(body),
      });
    }

    if (!filename) {
      return sendJson(res, 400, {
        error: 'Missing required field: filename',
        received_fields: Object.keys(body),
      });
    }

    if (!mimetype) {
      return sendJson(res, 400, {
        error: 'Missing required field: mimetype',
        received_fields: Object.keys(body),
      });
    }

    // Clean base64 (remove data URI prefix if present)
    const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;

    let buffer: Buffer;
    try {
      buffer = Buffer.from(cleanBase64, 'base64');
    } catch (e) {
      return sendJson(res, 400, { error: 'Invalid base64 string' });
    }

    if (buffer.length === 0) {
      return sendJson(res, 400, { error: 'Empty file content' });
    }

    // Create readable stream from buffer
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
      throw new Error('Upload succeeded but no file ID was returned');
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

    // Get final file metadata
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

    const status = error.code === 403 ? 403
                 : error.code === 401 ? 401
                 : error.code === 400 ? 400
                 : 500;

    let message = error.message || 'Upload failed';

    if (error.message?.includes('invalid_grant') || error.message?.includes('JWT')) {
      message = 'Authentication failed - invalid or malformed service account key';
    } else if (error.code === 403) {
      message = 'Permission denied - service account needs Editor access to target folder';
    } else if (error.message?.includes('not found') && error.message?.includes('folder')) {
      message = 'Target folder not found - check GOOGLE_DRIVE_FOLDER_ID';
    }

    return sendJson(res, status, {
      error: message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}
