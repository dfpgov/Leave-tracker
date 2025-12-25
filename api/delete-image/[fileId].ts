import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

async function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
  return google.drive({ version: 'v3', auth: oauth2Client });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fileName } = req.body;

    if (!fileName) return res.status(400).json({ error: 'fileName is required' });

    const drive = await getDriveClient();

    // Find the file in the specific folder
    const listResponse = await drive.files.list({
      q: `name = '${fileName}' and '${FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(id, name)',
    });

    const files = listResponse.data.files || [];

    // If file exists, delete it
    if (files.length > 0) {
      for (const file of files) {
        await drive.files.delete({ fileId: file.id! });
      }
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Drive Delete Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
