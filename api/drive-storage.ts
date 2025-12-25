// api/drive-size.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

const TARGET_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

async function getGoogleDriveClient() {
  // Preferred method: separate variables (recommended)
  let clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  // Fallback: full JSON string (less reliable due to line break issues)
  if (!clientEmail || !privateKey) {
    const fullJson = process.env.GOOGLE_SERVICE_ACCOUNT;
    if (fullJson) {
      try {
        const credentials = JSON.parse(fullJson);
        clientEmail = credentials.client_email;
        privateKey = credentials.private_key?.replace(/\\n/g, '\n') || '';
      } catch (err) {
        throw new Error('Failed to parse GOOGLE_SERVICE_ACCOUNT JSON');
      }
    }
  }

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Missing Google Drive credentials. Please set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'
    );
  }

  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    throw new Error('Private key format invalid (missing PEM header)');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: [
      'https://www.googleapis.com/auth/drive.metadata.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });

  return google.drive({ version: 'v3', auth });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const response: any = {
    success: false,
    status: {
      credentials: 'unknown',
      folderId: !!TARGET_FOLDER_ID ? 'present' : 'missing',
      timestamp: new Date().toISOString(),
    },
    totalBytes: null,
    totalSize: null,
    fileCount: null,
    files: [],
    error: null,
    debug: process.env.NODE_ENV === 'development' ? {} : undefined,
  };

  try {
    if (!TARGET_FOLDER_ID) {
      throw new Error('GOOGLE_DRIVE_FOLDER_ID environment variable is not set');
    }

    response.status.folderId = 'present';

    const drive = await getGoogleDriveClient();
    response.status.credentials = 'valid';

    let pageToken: string | undefined = undefined;
    let totalBytes = 0;
    const filesList: Array<{ id: string; name: string; size: number }> = [];

    do {
      const result = await drive.files.list({
        q: `'${TARGET_FOLDER_ID}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, size, mimeType)',
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const files = result.data.files || [];

      for (const file of files) {
        const size = Number(file.size || 0);
        totalBytes += size;

        filesList.push({
          id: file.id || '',
          name: file.name || 'Unnamed file',
          size,
        });
      }

      pageToken = result.data.nextPageToken;
    } while (pageToken);

    response.success = true;
    response.totalBytes = totalBytes;
    response.totalSize = formatBytes(totalBytes);
    response.fileCount = filesList.length;
    response.files = filesList;

    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Error:', error);

    response.success = false;
    response.error = error.message || 'Unknown error';

    if (error.message.includes('invalid_grant') || error.message.includes('JWT')) {
      response.status.credentials = 'invalid';
      response.error = 'Authentication failed - invalid or expired service account key';
    } else if (error.message.includes('not found') || error.message.includes('404')) {
      response.error = 'Folder not found or no access';
    } else if (error.message.includes('permission')) {
      response.error = 'Insufficient permissions - service account needs access to folder';
    }

    if (process.env.NODE_ENV === 'development') {
      response.debug = {
        message: error.message,
        stack: error.stack,
        code: error.code,
        response: error.response?.data,
      };
    }

    const statusCode = error.message.includes('credentials') ? 503 : 500;
    return res.status(statusCode).json(response);
  }
}
