import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { Readable } from 'stream';

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

let cachedDrive: any = null;

async function getDriveClient() {
  if (cachedDrive) return cachedDrive;
  if (!SERVICE_EMAIL || !PRIVATE_KEY) {
    throw new Error('Missing Service Account Credentials');
  }

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const drive = await getDriveClient();
    
    // Support both naming conventions (your frontend uses camelCase)
    const base64 = req.body.base64Data || req.body.base64;
    const filename = req.body.fileName || req.body.filename;
    const mimetype = req.body.mimeType || req.body.mimetype;

    if (!base64 || !filename || !mimetype) {
      return sendJson(res, 400, { 
        error: 'Missing required fields',
        received: { 
          hasBase64: !!base64, 
          hasFilename: !!filename, 
          hasMimetype: !!mimetype 
        }
      });
    }

    // Process the base64 string
    const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
    const buffer = Buffer.from(cleanBase64, 'base64');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

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

    // Optional: Make viewable by anyone with link
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    return sendJson(res, 201, {
      success: true,
      fileId,
      filename: uploadResult.data.name,
      directUrl: `https://drive.google.com/uc?export=view&id=${fileId}`,
    });

  } catch (error: any) {
    console.error('Upload Error:', error);
    return sendJson(res, 500, { error: error.message || 'Upload failed' });
  }
}
