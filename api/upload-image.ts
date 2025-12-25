import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { Readable } from 'stream';

// ────────────────────────────────────────────────
// Environment variables
// ────────────────────────────────────────────────
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

// Cache the drive client per execution instance
let cachedDrive: any = null;

async function getDriveClient() {
  if (cachedDrive) return cachedDrive;

  if (!SERVICE_EMAIL || !PRIVATE_KEY) {
    throw new Error('Missing Service Account Credentials (Email or Private Key)');
  }

  // Handle Vercel's tendency to escape newline characters in env vars
  const formattedKey = PRIVATE_KEY.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT(
    SERVICE_EMAIL,
    null,
    formattedKey,
    ['https://www.googleapis.com/auth/drive.file']
  );

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
  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, {});
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
  }

  try {
    if (!FOLDER_ID) {
      return sendJson(res, 503, { error: 'Server configuration error - missing FOLDER_ID' });
    }

    const { base64, filename, mimetype } = req.body;

    if (!base64 || !filename || !mimetype) {
      return sendJson(res, 400, { error: 'Missing required fields (base64, filename, or mimetype)' });
    }

    // Convert Base64 to Stream
    const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
    const buffer = Buffer.from(cleanBase64, 'base64');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const drive = await getDriveClient();

    // 1. Upload the file
    const uploadResult = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [FOLDER_ID],
      },
      media: {
        mimeType: mimetype,
        body: stream,
      },
      fields: 'id, name, webViewLink',
    });

    const fileId = uploadResult.data.id;

    // 2. Set permissions so "anyone with the link" can view (Optional)
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
      directUrl: `https://drive.google.com/uc?export=view&id=${fileId}`,
    });

  } catch (error: any) {
    console.error('Service Account Upload Error:', error);
    
    const statusCode = error.code && typeof error.code === 'number' ? error.code : 500;
    return sendJson(res, statusCode, {
      error: error.message || 'Upload failed',
    });
  }
}
