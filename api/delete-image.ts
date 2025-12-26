import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Setup CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // 2. Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const { fileName } = req.body;
    console.log(`[BACKEND] Request to delete file: ${fileName}`);

    if (!fileName) {
      return res.status(400).json({ error: 'No fileName provided in request body' });
    }

    // 3. Initialize Google Auth
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // 4. Search for the specific file
    // We look for the name AND ensure it is in the correct folder
    const list = await drive.files.list({
      q: `name = '${fileName}' and '${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(id, name)',
    });

    const files = list.data.files || [];
    console.log(`[BACKEND] Found ${files.length} matching files.`);

    if (files.length > 0) {
      // 5. Delete the file
      const fileId = files[0].id!;
      await drive.files.delete({ fileId: fileId });
      console.log(`[BACKEND] Successfully deleted fileId: ${fileId}`);
      
      return res.status(200).json({ 
        success: true, 
        message: `Deleted ${fileName}`,
        fileId: fileId 
      });
    } else {
      console.log(`[BACKEND] No file found named: ${fileName}`);
      return res.status(404).json({ error: 'File not found in Google Drive' });
    }

  } catch (err: any) {
    console.error('[BACKEND ERROR]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
