import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Use DELETE' });

  try {
    // 2. Get the ID from the URL (Vercel maps [fileId] to req.query.fileId)
    const { fileId } = req.query;

    if (!fileId || typeof fileId !== 'string') {
      return res.status(400).json({ error: 'File ID missing in URL' });
    }

    // 3. Setup Auth (Using your OAuth credentials)
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // 4. Delete from Google
    await drive.files.delete({ fileId: fileId });

    return res.status(200).json({ success: true, message: `Deleted ${fileId}` });
  } catch (error: any) {
    console.error('Delete error:', error);
    return res.status(error.code === 404 ? 404 : 500).json({ 
      error: error.code === 404 ? 'File not found on Drive' : error.message 
    });
  }
}
