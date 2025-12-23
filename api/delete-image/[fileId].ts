import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

async function getGoogleDriveClient() {
  const credentials = {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('Google service account credentials not configured');
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
