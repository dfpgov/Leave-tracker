import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { Readable } from 'stream';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

async function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({
    refresh_token: REFRESH_TOKEN,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

// CORS & JSON Helpers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  try {
    const { base64Data, fileName, mimeType } = req.body;

    if (!base64Data || !fileName || !mimeType) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const drive = await getDriveClient();

    // Convert base64 to stream
    const buffer = Buffer.from(base64Data.split(',')[1] || base64Data, 'base64');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const file = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [FOLDER_ID!],
      },
      media: {
        mimeType: mimeType,
        body: stream,
      },
      fields: 'id, webViewLink',
    });

    return res.status(201).json({
      success: true,
      fileId: file.data.id,
      link: file.data.webViewLink
    });

  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
