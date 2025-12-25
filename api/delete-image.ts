import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Fix CORS so the browser doesn't block you
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  try {
    const { fileName } = req.body; // Getting the name from the hidden body
    if (!fileName) return res.status(400).json({ error: 'No fileName' });

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Search for the file
    const list = await drive.files.list({
      q: `name = '${fileName}' and '${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents`,
      fields: 'files(id)',
    });

    if (list.data.files && list.data.files.length > 0) {
      await drive.files.delete({ fileId: list.data.files[0].id! });
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
