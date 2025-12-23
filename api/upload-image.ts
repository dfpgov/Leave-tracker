import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { Readable } from 'stream';

const TARGET_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

async function getGoogleDriveClient() {
  let credentials: any;

  // Try to get credentials from a single JSON env var (preferred for Vercel)
  if (process.env.GOOGLE_SERVICE_ACCOUNT) {
    try {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    } catch (e) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT is not valid JSON');
    }
  } else {
    // Fallback: build credentials from individual env vars
    let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '';
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';

    if (!privateKey || !clientEmail) {
      throw new Error('Either GOOGLE_SERVICE_ACCOUNT or (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) must be set');
    }

    // Simple newline replacement
    privateKey = privateKey.replace(/\\n/g, '\n');

    credentials = {
      type: 'service_account',
      client_email: clientEmail,
      private_key: privateKey,
    };
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    return google.drive({ version: 'v3', auth });
  } catch (error: any) {
    throw new Error(`Google auth failed: ${error.message}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { base64Data, fileName, mimeType } = req.body;

    if (!base64Data || !fileName || !mimeType) {
      return res.status(400).json({ error: 'Missing: base64Data, fileName, mimeType' });
    }

    if (!TARGET_FOLDER_ID) {
      return res.status(500).json({ error: 'GOOGLE_DRIVE_FOLDER_ID not configured' });
    }

    const drive = await getGoogleDriveClient();

    const base64Content = base64Data.includes(',') 
      ? base64Data.split(',')[1] 
      : base64Data;

    const buffer = Buffer.from(base64Content, 'base64');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const createResponse = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [TARGET_FOLDER_ID],
      },
      media: {
        mimeType: mimeType,
        body: stream,
      },
      fields: 'id, webViewLink, webContentLink',
    });

    const fileId = createResponse.data.id;
    if (!fileId) {
      throw new Error('Failed to get file ID from Google Drive');
    }

    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    const fileResponse = await drive.files.get({
      fileId: fileId,
      fields: 'id, webViewLink, webContentLink',
    });

    res.json({
      success: true,
      fileId: fileResponse.data.id || fileId,
      webViewLink: fileResponse.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
      webContentLink: fileResponse.data.webContentLink || `https://drive.google.com/uc?export=view&id=${fileId}`,
    });
  } catch (error: any) {
    console.error('Upload error:', error.message);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
}
