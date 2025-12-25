import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

const TARGET_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

async function getGoogleDriveClient() {
  const GOOGLE_SERVICE_ACCOUNT = process.env.GOOGLE_SERVICE_ACCOUNT;
  const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  let credentials;

  if (GOOGLE_SERVICE_ACCOUNT) {
    try {
      credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT);
    } catch (err) {
      console.warn('Failed to parse GOOGLE_SERVICE_ACCOUNT JSON, falling back to individual variables');
    }
  }

  if (!credentials && GOOGLE_SERVICE_ACCOUNT_EMAIL && GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    credentials = {
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  if (!credentials) {
    throw new Error('Google Drive credentials not set. Please set GOOGLE_SERVICE_ACCOUNT or individual EMAIL and PRIVATE_KEY variables.');
  }

  // Handle newline characters in private key
  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/drive.metadata.readonly',
      'https://www.googleapis.com/auth/drive.file'
    ],
  });

  return google.drive({ version: 'v3', auth });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!TARGET_FOLDER_ID) {
      return res.status(400).json({ 
        error: 'GOOGLE_DRIVE_FOLDER_ID environment variable not set' 
      });
    }

    const drive = await getGoogleDriveClient();

    let allFiles: Array<{ id: string; name: string; size: number }> = [];
    let pageToken: string | undefined = undefined;
    let totalBytes = 0;

    try {
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

      return res.status(200).json({
        totalBytes,
        fileCount: allFiles.length,
        files: allFiles,
      });
    } catch (listError: any) {
      console.error('Drive files.list error:', listError.message);
      return res.status(500).json({ 
        error: 'Google Drive access error: ' + listError.message,
        details: listError.response?.data || listError.toString()
      });
    }
  } catch (error: any) {
    console.error('Handler error:', error.message);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      debug: process.env.NODE_ENV === 'development' ? error.toString() : undefined
    });
  }
}
