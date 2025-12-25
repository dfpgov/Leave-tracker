import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. CORS Headers (Crucial for frontend-to-backend communication)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fileName } = req.body;
    if (!fileName) return res.status(400).json({ error: 'fileName is required' });

    // 2. Setup Google Auth
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // 3. Find the file in Drive
    const response = await drive.files.list({
      q: `name = '${fileName}' and '${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(id)',
    });

    const files = response.data.files || [];

    // 4. Delete if found
    if (files.length > 0) {
      await drive.files.delete({ fileId: files[0].id! });
      return res.status(200).json({ success: true, deleted: fileName });
    }

    return res.status(200).json({ success: true, message: 'File not found on drive, skipped.' });
  } catch (error: any) {
    console.error("Backend Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
