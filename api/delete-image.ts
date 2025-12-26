import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  try {
    const { attachmentUrl } = req.body;
    console.log("--- [START] Deletion Request ---");
    console.log("URL received:", attachmentUrl);

    if (!attachmentUrl) return res.status(400).json({ error: 'No URL provided' });

    // 1. EXTRACT ID: Works for both /d/ID and uc?id=ID
    const urlParams = new URLSearchParams(attachmentUrl.split('?')[1]);
    let fileId = urlParams.get('id');

    // Fallback for standard /d/ format if id param isn't found
    if (!fileId) {
      const matches = attachmentUrl.match(/\/d\/(.+?)\//);
      fileId = matches ? matches[1] : null;
    }

    if (!fileId) {
      console.error("Failed to parse File ID from:", attachmentUrl);
      return res.status(400).json({ error: 'Invalid Google Drive URL' });
    }

    console.log("Extracted File ID:", fileId);

    // 2. AUTH
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // 3. DELETE
    await drive.files.delete({ fileId: fileId });
    console.log("--- [SUCCESS] File deleted from Drive ---");

    return res.status(200).json({ success: true, deletedId: fileId });
    
  } catch (err: any) {
    console.error("--- [ERROR] ---", err.message);
    
    // If the file is already gone, we don't want the whole process to fail
    if (err.code === 404) {
      return res.status(200).json({ success: true, message: 'File already deleted or not found' });
    }
    
    return res.status(500).json({ error: err.message });
  }
}
