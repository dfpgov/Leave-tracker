import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`--- [START] Request Received: ${req.method} ---`);

  // Fix CORS so the browser doesn't block you
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log("--- [INFO] Handling CORS Preflight (OPTIONS) ---");
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    console.log(`--- [ERROR] Rejected Method: ${req.method} ---`);
    return res.status(405).json({ error: 'Use POST' });
  }

  try {
    const { fileName } = req.body;
    console.log(`--- [DATA] Target FileName: "${fileName}" ---`);

    if (!fileName) {
      console.log("--- [ERROR] Missing fileName in request body ---");
      return res.status(400).json({ error: 'No fileName' });
    }

    // Checking environment variables (Logs only existence, not the values for security)
    console.log("--- [AUTH] Checking Environment Variables ---");
    console.log("GOOGLE_CLIENT_ID exists:", !!process.env.GOOGLE_CLIENT_ID);
    console.log("GOOGLE_DRIVE_FOLDER_ID exists:", !!process.env.GOOGLE_DRIVE_FOLDER_ID);

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Search for the file
    const query = `name = '${fileName}' and '${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed = false`;
    console.log(`--- [DRIVE] Searching with query: ${query} ---`);

    const list = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
    });

    const filesFound = list.data.files || [];
    console.log(`--- [DRIVE] Files found: ${filesFound.length} ---`);

    if (filesFound.length > 0) {
      const fileId = filesFound[0].id!;
      console.log(`--- [DRIVE] Attempting to delete file ID: ${fileId} ---`);
      
      await drive.files.delete({ fileId: fileId });
      
      console.log("--- [SUCCESS] File deleted from Google Drive ---");
    } else {
      console.log("--- [WARN] No matching file found in Drive to delete ---");
    }

    return res.status(200).json({ success: true, message: "Process complete" });

  } catch (err: any) {
    console.error("--- [CRITICAL ERROR] ---");
    console.error("Message:", err.message);
    if (err.response) {
      console.error("Google API Data:", err.response.data);
    }
    return res.status(500).json({ error: err.message });
  } finally {
    console.log("--- [END] Function Execution Finished ---");
  }
}
