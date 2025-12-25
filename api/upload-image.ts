import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { Readable } from 'stream';

// ------------------
// Load env variables
// ------------------
const TARGET_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const GOOGLE_SERVICE_ACCOUNT = process.env.GOOGLE_SERVICE_ACCOUNT;

if (!GOOGLE_SERVICE_ACCOUNT) console.warn("⚠️ GOOGLE_SERVICE_ACCOUNT env var not set");
if (!TARGET_FOLDER_ID) console.warn("⚠️ GOOGLE_DRIVE_FOLDER_ID env var not set");

// ------------------
// Create Google Drive client
// ------------------
async function getDriveClient() {
  if (!GOOGLE_SERVICE_ACCOUNT) throw new Error("No Google credentials found");

  let credentials;
  try {
    credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT);
  } catch (err) {
    throw new Error("Failed to parse GOOGLE_SERVICE_ACCOUNT JSON: " + (err as any).message);
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.metadata.readonly', 'https://www.googleapis.com/auth/drive.file'],
  });

  return google.drive({ version: 'v3', auth });
}

// ------------------
// API handler
// ------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ------------------
  // CORS headers
  // ------------------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { base64Data, fileName, mimeType } = req.body;

    if (!base64Data || !fileName || !mimeType) {
      return res.status(400).json({ error: 'Missing required fields: base64Data, fileName, mimeType' });
    }
    if (!TARGET_FOLDER_ID) {
      return res.status(400).json({ error: 'TARGET_FOLDER_ID not set' });
    }

    const drive = await getDriveClient();
    console.log("✅ Google Drive client initialized");

    // ------------------
    // Prepare file
    // ------------------
    const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const buffer = Buffer.from(base64Content, 'base64');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    // ------------------
    // Upload file
    // ------------------
    const createResponse = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [TARGET_FOLDER_ID],
      },
      media: {
        mimeType,
        body: stream,
      },
      fields: 'id, webViewLink, webContentLink',
    });

    const fileId = createResponse.data.id;
    if (!fileId) throw new Error('Failed to get file ID');

    // ------------------
    // Make file public
    // ------------------
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    const fileInfo = await drive.files.get({
      fileId,
      fields: 'id, webViewLink, webContentLink',
    });

    console.log("✅ File uploaded:", fileInfo.data);

    res.json({
      success: true,
      fileId: fileInfo.data.id || fileId,
      webViewLink: fileInfo.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
      webContentLink: fileInfo.data.webContentLink || `https://drive.google.com/uc?export=view&id=${fileId}`,
    });
  } catch (err: any) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: err.message });
  }
}
