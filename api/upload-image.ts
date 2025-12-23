import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { Readable } from 'stream';

const TARGET_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

async function getGoogleDriveClient() {
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '';
  
  if (!privateKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY not set');
  }

  // Handle multiple formats of newlines in the private key
  // The key might come in as: \\n (escaped), \n (literal), or with actual newlines
  privateKey = privateKey
    .replace(/\\n/g, '\n')           // Replace escaped newlines with actual newlines
    .replace(/\\\\n/g, '\n')         // Replace double-escaped newlines
    .trim();
  
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  
  if (!clientEmail) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL not set');
  }

  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY is not a valid private key format');
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
        type: 'service_account',
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    return google.drive({ version: 'v3', auth });
  } catch (error: any) {
    console.error('Failed to create Google auth client:', error.message);
    throw new Error(`Google authentication failed: ${error.message}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { base64Data, fileName, mimeType } = req.body;

    if (!base64Data || !fileName || !mimeType) {
      return res.status(400).json({ error: 'Missing required fields: base64Data, fileName, mimeType' });
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
      throw new Error('Failed to get file ID from Google Drive response');
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
    console.error('Error uploading to Google Drive:', {
      message: error.message,
      code: error.code,
      status: error.status,
    });
    res.status(500).json({ 
      error: error.message || 'Failed to upload image',
      details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
    });
  }
}
