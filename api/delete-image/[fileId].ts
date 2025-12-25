import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

async function getGoogleDriveClient() {
  const GOOGLE_SERVICE_ACCOUNT = process.env.GOOGLE_SERVICE_ACCOUNT;
  const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  let credentials;

  if (GOOGLE_SERVICE_ACCOUNT) {
    try {
      credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT);
    } catch (err) {
      console.warn('Failed to parse GOOGLE_SERVICE_ACCOUNT JSON, falling back to individual variables');
    }
  }

  if (!credentials && GOOGLE_SERVICE_ACCOUNT_EMAIL && GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    credentials = {
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  if (!credentials) {
    throw new Error('Google Drive credentials not set. Please set GOOGLE_SERVICE_ACCOUNT or individual EMAIL and PRIVATE_KEY variables.');
  }

  // Handle newline characters in private key
  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  return google.drive({ version: 'v3', auth });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileId } = req.query;
    
    if (!fileId || typeof fileId !== 'string') {
      return res.status(400).json({ error: 'File ID required' });
    }

    const drive = await getGoogleDriveClient();
    await drive.files.delete({ fileId });
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting from Google Drive:', error);
    res.status(500).json({ error: error.message || 'Failed to delete image' });
  }
}
