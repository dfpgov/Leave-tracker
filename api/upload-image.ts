import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { Readable } from 'stream';

const TARGET_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

async function getGoogleDriveClient() {
  const hasGoogleServiceAccount = !!process.env.GOOGLE_SERVICE_ACCOUNT;
  const hasEmail = !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const hasPrivateKey = !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  console.log('Auth check:', { hasGoogleServiceAccount, hasEmail, hasPrivateKey });

  let credentials: any = null;

  // Option 1: Try JSON service account
  if (hasGoogleServiceAccount) {
    try {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT!);
      console.log('Using GOOGLE_SERVICE_ACCOUNT');
    } catch (e: any) {
      console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT:', e.message);
    }
  }

  // Option 2: Try individual env vars
  if (!credentials && hasEmail && hasPrivateKey) {
    let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!;
    privateKey = privateKey.replace(/\\n/g, '\n');
    
    credentials = {
      type: 'service_account',
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
      private_key: privateKey,
    };
    console.log('Using individual env vars');
  }

  // If still no credentials, throw detailed error
  if (!credentials) {
    throw new Error(
      'No Google credentials found. Set either:\n' +
      '1. GOOGLE_SERVICE_ACCOUNT (entire JSON service account)\n' +
      '2. GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY\n' +
      `Current state: hasServiceAccount=${hasGoogleServiceAccount}, hasEmail=${hasEmail}, hasPrivateKey=${hasPrivateKey}`
    );
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    return google.drive({ version: 'v3', auth });
  } catch (error: any) {
    console.error('Failed to create Google Drive client:', error.message);
    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { base64Data, fileName, mimeType } = req.body;

    if (!base64Data || !fileName || !mimeType) {
      return res.status(400).json({ 
        error: 'Missing required fields: base64Data, fileName, mimeType' 
      });
    }

    if (!TARGET_FOLDER_ID) {
      return res.status(400).json({ 
        error: 'GOOGLE_DRIVE_FOLDER_ID environment variable not set' 
      });
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
    console.error('Upload API error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to upload image',
      // Remove in production - just for debugging
      debug: process.env.NODE_ENV === 'development' ? error.toString() : undefined
    });
  }
}
