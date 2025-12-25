// api/upload-image.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { Readable } from 'stream';

// ────────────────────────────────────────────────
// Environment variables
// ────────────────────────────────────────────────
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

// Cache the drive client
let cachedDrive: ReturnType<typeof google.drive> | null = null;

async function getDriveClient() {
  if (cachedDrive) return cachedDrive;

  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error('Missing OAuth2 credentials (Client ID, Secret, or Refresh Token)');
  }

  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    'https://developers.google.com/oauthplayground' // Ensure this matches your Google Cloud Console Redirect URI
  );

  oauth2Client.setCredentials({
    refresh_token: REFRESH_TOKEN,
  });

  cachedDrive = google.drive({ version: 'v3', auth: oauth2Client });
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
  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, {});
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
  }

  try {
    // Environment check
    if (!FOLDER_ID || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
      return sendJson(res, 503, {
        error: 'Server configuration error - missing OAuth environment variables',
      });
    }

    const body = req.body as Record<string, any>;
    if (!body || Object.keys(body).length === 0) {
      return sendJson(res, 400, { error: 'Empty request body' });
    }

    const base64 = body.base64 || body.base64Data || body.data || body.image;
    const filename = body.filename || body.fileName || body.name;
    const mimetype = body.mimetype || body.mimeType || body.type;

    if (!base64 || !filename || !mimetype) {
      return sendJson(res, 400, { error: 'Missing required fields (base64, filename, or mimetype)' });
    }

    // Clean base64
    const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
    const buffer = Buffer.from(cleanBase64, 'base64');

    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const drive = await getDriveClient();

    // 1. Upload the file (it will now use YOUR storage quota)
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
    });

    const fileId = uploadResult.data.id!;

    // 2. Make the file public (optional)
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    return sendJson(res, 201, {
      success: true,
      fileId,
      filename: uploadResult.data.name,
      webViewLink: uploadResult.data.webViewLink,
      webContentLink: uploadResult.data.webContentLink,
      directUrl: `https://drive.google.com/uc?id=${fileId}`,
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    
    // Check if the refresh token expired or was revoked
    if (error.message?.includes('invalid_grant')) {
      return sendJson(res, 401, { error: 'OAuth Refresh Token is invalid or expired. Re-generate it in OAuth Playground.' });
    }

    return sendJson(res, error.code || 500, {
      error: error.message || 'Upload failed',
    });
  }
}
