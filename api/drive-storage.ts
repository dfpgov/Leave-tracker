import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

const TARGET_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

async function getGoogleDriveClient() {
  const credentials = {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('Google service account credentials not configured');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  return google.drive({ version: 'v3', auth });
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
    console.error('Error getting drive storage:', error);
    res.status(500).json({ error: error.message || 'Failed to get storage info' });
  }
}
