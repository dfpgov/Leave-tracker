import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

const TARGET_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

async function getGoogleDriveClient() {
  const hasGoogleServiceAccount = !!process.env.GOOGLE_SERVICE_ACCOUNT;
  const hasEmail = !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const hasPrivateKey = !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  console.log('Auth check:', { hasGoogleServiceAccount, hasEmail, hasPrivateKey });

  let credentials: any = null;

  // Option 1: Try JSON service account
  if (hasGoogleServiceAccount) {
    try {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT!);
      console.log('Using GOOGLE_SERVICE_ACCOUNT');
    } catch (e: any) {
      console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT:', e.message);
    }
  }

  // Option 2: Try individual env vars
  if (!credentials && hasEmail && hasPrivateKey) {
    let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!;
    privateKey = privateKey.replace(/\\n/g, '\n');
    
    credentials = {
      type: 'service_account',
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
      private_key: privateKey,
    };
    console.log('Using individual env vars');
  }

  // If still no credentials, throw detailed error
  if (!credentials) {
    throw new Error(
      'No Google credentials found. Set either:\n' +
      '1. GOOGLE_SERVICE_ACCOUNT (entire JSON service account)\n' +
      '2. GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY\n' +
      `Current state: hasServiceAccount=${hasGoogleServiceAccount}, hasEmail=${hasEmail}, hasPrivateKey=${hasPrivateKey}`
    );
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    return google.drive({ version: 'v3', auth });
  } catch (error: any) {
    console.error('Failed to create Google Drive client:', error.message);
    throw error;
  }
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
    console.error('Storage API error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to get storage info',
      // Remove in production - just for debugging
      debug: process.env.NODE_ENV === 'development' ? error.toString() : undefined
    });
  }
}
