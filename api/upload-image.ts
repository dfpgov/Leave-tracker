import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { Readable } from 'stream';

// ------------------
// TEST CREDENTIALS
// ------------------
const TEST_SERVICE_ACCOUNT = {
  "type": "service_account",
  "project_id": "YOUR_PROJECT_ID",
  "private_key_id": "YOUR_PRIVATE_KEY_ID",
  "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n",
  "client_email": "YOUR_CLIENT_EMAIL@YOUR_PROJECT.iam.gserviceaccount.com",
  "client_id": "YOUR_CLIENT_ID",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "YOUR_CLIENT_CERT_URL"
};

// ------------------
// Target folder ID
// ------------------
const TARGET_FOLDER_ID = "YOUR_FOLDER_ID"; // Drive folder ID

async function getGoogleDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: TEST_SERVICE_ACCOUNT,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  return google.drive({ version: 'v3', auth });
}

// ------------------
// API handler
// ------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
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

    const drive = await getGoogleDriveClient();

    // Prepare file
    const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const buffer = Buffer.from(base64Content, 'base64');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    // Upload file
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

    // Make file public
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    const fileResponse = await drive.files.get({
      fileId,
      fields: 'id, webViewLink, webContentLink',
    });

    res.json({
      success: true,
      fileId: fileResponse.data.id || fileId,
      webViewLink: fileResponse.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
      webContentLink: fileResponse.data.webContentLink || `https://drive.google.com/uc?export=view&id=${fileId}`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
