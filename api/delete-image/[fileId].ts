import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

async function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );
  oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
  return google.drive({ version: 'v3', auth: oauth2Client });
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // In a dynamic route [fileId].ts, the ID is found in req.query.fileId
    const { fileId } = req.query;

    if (!fileId || typeof fileId !== 'string') {
      return res.status(400).json({ error: 'Invalid File ID' });
    }

    const drive = await getDriveClient();

    // Delete the file
    await drive.files.delete({ fileId });

    return res.status(200).json({ success: true, message: 'Deleted ' + fileId });
  } catch (error: any) {
    console.error('Delete error:', error);
    
    // If Google Drive can't find the file, it returns 404
    const status = error.code === 404 ? 404 : 500;
    return res.status(status).json({ 
      error: error.code === 404 ? 'File not found on Drive' : error.message 
    });
  }
}
