// Google Drive Integration for Leave Tracker
// Uploads images to a specific Google Drive folder and returns shareable URLs

import { google } from 'googleapis';
import { Readable } from 'stream';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-drive',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Drive not connected');
  }
  return accessToken;
}

async function getUncachableGoogleDriveClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

// The target folder ID from the user's Google Drive URL
// Must be set via environment variable GOOGLE_DRIVE_FOLDER_ID
const TARGET_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

if (!TARGET_FOLDER_ID) {
  console.warn('GOOGLE_DRIVE_FOLDER_ID environment variable is not set');
}

export async function uploadImageToGoogleDrive(
  base64Data: string,
  fileName: string,
  mimeType: string
): Promise<{ fileId: string; webViewLink: string; webContentLink: string }> {
  const drive = await getUncachableGoogleDriveClient();

  if (!TARGET_FOLDER_ID) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID environment variable is not set');
  }

  // Remove base64 prefix if present (e.g., "data:image/png;base64,")
  const base64Content = base64Data.includes(',') 
    ? base64Data.split(',')[1] 
    : base64Data;

  // Convert base64 to buffer
  const buffer = Buffer.from(base64Content, 'base64');

  // Create a readable stream from the buffer
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  // Upload file to Google Drive
  const createResponse = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [TARGET_FOLDER_ID],
    },
    media: {
      mimeType: mimeType,
      body: stream,
    },
    fields: 'id, webViewLink, webContentLink',
  }) as { data: { id?: string; webViewLink?: string; webContentLink?: string } };

  const fileId = createResponse.data.id;
  if (!fileId) {
    throw new Error('Failed to get file ID from Google Drive response');
  }

  // Make the file publicly accessible
  await drive.permissions.create({
    fileId: fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  // Get the updated file with links
  const fileResponse = await drive.files.get({
    fileId: fileId,
    fields: 'id, webViewLink, webContentLink',
  }) as { data: { id?: string; webViewLink?: string; webContentLink?: string } };

  return {
    fileId: fileResponse.data.id || fileId,
    webViewLink: fileResponse.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    webContentLink: fileResponse.data.webContentLink || `https://drive.google.com/uc?export=view&id=${fileId}`,
  };
}

export async function deleteImageFromGoogleDrive(fileId: string): Promise<void> {
  try {
    const drive = await getUncachableGoogleDriveClient();
    await drive.files.delete({ fileId });
  } catch (error) {
    console.error('Error deleting file from Google Drive:', error);
  }
}

export async function getFileSizes(): Promise<{ totalBytes: number; fileCount: number; files: Array<{ id: string; name: string; size: number }> }> {
  const drive = await getUncachableGoogleDriveClient();
  
  if (!TARGET_FOLDER_ID) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID environment variable is not set');
  }

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

  return {
    totalBytes,
    fileCount: allFiles.length,
    files: allFiles,
  };
}
