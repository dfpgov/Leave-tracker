import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { Readable } from 'stream';

// ────────────────────────────────────────────────
// Environment Variables
// ────────────────────────────────────────────────
const TARGET_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT;

// Warning logs (helpful during debugging)
if (!GOOGLE_SERVICE_ACCOUNT_JSON) {
  console.warn('⚠️ GOOGLE_SERVICE_ACCOUNT environment variable is not set');
}
if (!TARGET_FOLDER_ID) {
  console.warn('⚠️ GOOGLE_DRIVE_FOLDER_ID environment variable is not set');
}

// ────────────────────────────────────────────────
// Google Drive Client Factory
// ────────────────────────────────────────────────
async function getDriveClient() {
  if (!GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error(
      'Missing GOOGLE_SERVICE_ACCOUNT environment variable. ' +
      'Please provide the full service account JSON.'
    );
  }

  let credentials;
  try {
    credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);

    // Most important: Fix double-escaped newlines that Vercel sometimes creates
    if (typeof credentials.private_key === 'string') {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
  } catch (parseError) {
    console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT JSON:', parseError);
    throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT JSON format');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.metadata.readonly',
    ],
  });

  return google.drive({ version: 'v3', auth });
}

// ────────────────────────────────────────────────
// Main API Handler
// ────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate input
    const { base64Data, fileName, mimeType } = req.body as {
      base64Data?: string;
      fileName?: string;
      mimeType?: string;
    };

    if (!base64Data || !fileName || !mimeType) {
      return res.status(400).json({
        error: 'Missing required fields: base64Data, fileName, mimeType',
      });
    }

    if (!TARGET_FOLDER_ID) {
      return res.status(500).json({ error: 'Server configuration error: TARGET_FOLDER_ID not set' });
    }

    // Initialize Drive client
    const drive = await getDriveClient();
    console.log('Google Drive client initialized successfully');

    // Prepare file content
    const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const buffer = Buffer.from(base64Content, 'base64');

    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    // ── Upload file ───────────────────────────────────────
    const uploadResponse = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [TARGET_FOLDER_ID],
      },
      media: {
        mimeType: mimeType,
        body: stream,
      },
      fields: 'id, name, webViewLink, webContentLink',
    });

    const fileId = uploadResponse.data.id;
    if (!fileId) {
      throw new Error('File uploaded but no ID returned');
    }

    // ── Make file publicly readable ───────────────────────
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // Get final file metadata
    const fileInfo = await drive.files.get({
      fileId,
      fields: 'id, name, webViewLink, webContentLink',
    });

    console.log(`File uploaded successfully: ${fileInfo.data.name} (${fileId})`);

    // Response
    return res.status(200).json({
      success: true,
      fileId,
      fileName: fileInfo.data.name,
      webViewLink: fileInfo.data.webViewLink,
      webContentLink: fileInfo.data.webContentLink,
      directViewUrl: `https://drive.google.com/uc?export=view&id=${fileId}`,
    });
  } catch (error: any) {
    console.error('Upload handler error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      details: error.errors || error.response?.data,
    });

    const status = error.code === 403 ? 403 : 500;
    const message =
      error.message?.includes('invalid_grant') || error.message?.includes('JWT')
        ? 'Authentication failed - check service account key format and permissions'
        : error.message || 'Internal server error during file upload';

    return res.status(status).json({ error: message });
  }
}
