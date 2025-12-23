import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

const TARGET_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

async function getGoogleDriveClient() {
  let credentials: any;

  // Try to get credentials from a single JSON env var (preferred for Vercel)
  if (process.env.GOOGLE_SERVICE_ACCOUNT) {
    try {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    } catch (e) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT is not valid JSON');
    }
  } else {
    // Fallback: build credentials from individual env vars
    let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '';
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';

    if (!privateKey || !clientEmail) {
      throw new Error('Either GOOGLE_SERVICE_ACCOUNT or (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) must be set');
    }

    // Simple newline replacement
    privateKey = privateKey.replace(/\\n/g, '\n');

    credentials = {
      type: 'service_account',
      client_email: clientEmail,
      private_key: privateKey,
    };
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    return google.drive({ version: 'v3', auth });
  } catch (error: any) {
    throw new Error(`Google auth failed: ${error.message}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!TARGET_FOLDER_ID) {
      return res.status(500).json({ error: 'GOOGLE_DRIVE_FOLDER_ID not configured' });
    }

    const drive = await getGoogleDriveClient();

    let allFiles: Array<{ id: string; name: string; size: number }> = [];
    let pageToken: string | undefined = undefined;
    let totalBytes = 0;

    do {
      const response: any = await drive.files.list({
        q: `'${TARGET_FOLDER_ID}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, size)',
        pageSize: 1000,
        pageToken: pageToken,
      });

      const files = response.data.files || [];
      for (const file of files) {
        const fileSize = parseInt(file.size || '0', 10);
        totalBytes += fileSize;
        allFiles.push({
          id: file.id || '',
          name: file.name || '',
          size: fileSize,
        });
      }

      pageToken = response.data.nextPageToken;
    } while (pageToken);

    res.json({
      totalBytes,
      fileCount: allFiles.length,
      files: allFiles,
    });
  } catch (error: any) {
    console.error('Storage error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to get storage info' });
  }
}
