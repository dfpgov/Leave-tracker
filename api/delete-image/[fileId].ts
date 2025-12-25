import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

// ────────────────────────────────────────────────
// Environment variables (Same as your Upload API)
// ────────────────────────────────────────────────
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

async function getDriveClient() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error('Missing OAuth2 credentials for deletion');
  }

  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({
    refresh_token: REFRESH_TOKEN,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Handlers
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // We enforce DELETE method for this endpoint
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed. Use DELETE.' });
  }

  try {
    // You can send fileId via Query (?fileId=...) or Body ({ "fileId": "..." })
    const fileId = (req.query.fileId as string) || (req.body?.fileId as string);

    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required to delete' });
    }

    const drive = await getDriveClient();

    // 1. Execute the deletion
    // Note: delete() removes it permanently. 
    // Use update({ fileId, requestBody: { trashed: true } }) if you want to send it to Trash instead.
    await drive.files.delete({
      fileId: fileId,
    });

    return res.status(200).json({
      success: true,
      message: `File ${fileId} deleted successfully`,
    });

  } catch (error: any) {
    console.error('Delete error:', error);

    // Specific error handling
    if (error.code === 404) {
      return res.status(404).json({ error: 'File not found or already deleted' });
    }

    return res.status(error.code || 500).json({
      error: error.message || 'Failed to delete file',
    });
  }
}
