import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { Readable } from 'stream';

const TARGET_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const GOOGLE_SERVICE_ACCOUNT = process.env.GOOGLE_SERVICE_ACCOUNT;

async function getDriveClient() {
  if (!GOOGLE_SERVICE_ACCOUNT) throw new Error("GOOGLE_SERVICE_ACCOUNT not set");
  const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  return google.drive({ version: 'v3', auth });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  try {
    const drive = await getDriveClient();

    // Test: create a small text file
    const content = 'Hello from Vercel test!';
    const buffer = Buffer.from(content, 'utf-8');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const fileMetadata = { name: 'vercel-test.txt', parents: [TARGET_FOLDER_ID] };

    const createRes = await drive.files.create({
      requestBody: fileMetadata,
      media: { mimeType: 'text/plain', body: stream },
      fields: 'id, webViewLink, webContentLink',
    });

    const fileId = createRes.data.id;

    // Make file public
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    const fileInfo = await drive.files.get({
      fileId,
      fields: 'id, webViewLink, webContentLink',
    });

    res.json({
      success: true,
      fileId: fileInfo.data.id,
      webViewLink: fileInfo.data.webViewLink,
      webContentLink: fileInfo.data.webContentLink,
    });

  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
