import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

const TARGET_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

async function getGoogleDriveClient() {
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '';
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  
  if (!privateKey || !clientEmail) {
    const missing = [];
    if (!privateKey) missing.push('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
    if (!clientEmail) missing.push('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  // Clean up the private key - handle all possible newline formats
  privateKey = privateKey
    .trim()
    .replace(/\\n/g, '\n')           // Replace escaped \n with actual newlines
    .replace(/\\\\n/g, '\n')         // Replace double-escaped \\n
    .replace(/'/g, '"');              // Replace smart quotes with regular quotes if any

  // Ensure it ends with a newline before the END marker
  if (!privateKey.endsWith('\n') && privateKey.includes('-----END PRIVATE KEY-----')) {
    privateKey = privateKey.replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
  }

  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') || !privateKey.includes('-----END PRIVATE KEY-----')) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY is not in valid PEM format');
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: 'service_account',
        client_email: clientEmail.trim(),
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    return google.drive({ version: 'v3', auth });
  } catch (error: any) {
    console.error('Auth error details:', {
      hasBeginMarker: privateKey.includes('-----BEGIN PRIVATE KEY-----'),
      hasEndMarker: privateKey.includes('-----END PRIVATE KEY-----'),
      keyLength: privateKey.length,
      emailSet: !!clientEmail,
      errorMessage: error.message,
    });
    throw new Error(`Google authentication failed: ${error.message}`);
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
    console.error('Error getting drive storage:', {
      message: error.message,
      code: error.code,
      status: error.status,
    });
    res.status(500).json({ 
      error: error.message || 'Failed to get storage info',
      details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
    });
  }
}
