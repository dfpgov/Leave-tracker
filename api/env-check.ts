// api/check-google-credentials.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const result = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    checks: {} as Record<string, any>,
  };

  // ─── 1. Basic environment variables presence check ───
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  result.checks.envVars = {
    GOOGLE_CLIENT_EMAIL: {
      exists: !!clientEmail,
      value: clientEmail ? maskEmail(clientEmail) : null,
    },
    GOOGLE_PRIVATE_KEY: {
      exists: !!privateKey,
      length: privateKey?.length || 0,
      startsWithHeader: privateKey?.startsWith('-----BEGIN PRIVATE KEY-----') ?? false,
      endsWithFooter: privateKey?.includes('-----END PRIVATE KEY-----') ?? false,
    },
  };

  // ─── 2. Try to actually authenticate ───
  try {
    if (!clientEmail || !privateKey) {
      throw new Error('Missing required environment variables');
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'), // safety for any escaped newlines
      },
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    // Try to get authorized client → this will validate the key
    const client = await auth.getClient();

    result.checks.authentication = {
      success: true,
      message: 'Successfully created authorized client',
      clientType: client.constructor.name,
    };

    // Optional: try a very lightweight API call to really confirm
    const drive = google.drive({ version: 'v3', auth: client });

    await drive.files.get({
      fileId: 'root', // just metadata, very cheap
      fields: 'id, name',
      supportsAllDrives: true,
    });

    result.checks.realApiCall = {
      success: true,
      message: 'Successfully called Drive API (accessed root folder metadata)',
    };
  } catch (error: any) {
    result.checks.authentication = {
      success: false,
      error: error.message || 'Unknown authentication error',
      code: error.code,
      details: error.errors?.[0]?.message || null,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    };
  }

  // ─── Final response ───
  const statusCode = result.checks.authentication?.success ? 200 : 500;

  res.status(statusCode).json(result);
}

// Small helper to avoid leaking full email in logs
function maskEmail(email: string): string {
  if (!email) return '';
  const [name, domain] = email.split('@');
  return `${name.slice(0, 3)}...@${domain}`;
}
