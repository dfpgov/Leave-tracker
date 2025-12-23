import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

const TARGET_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

async function getGoogleDriveClient() {
  console.log('🔐 [AUTH] Starting credential initialization...');
  const hasGoogleServiceAccount = !!process.env.GOOGLE_SERVICE_ACCOUNT;
  const hasEmail = !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const hasPrivateKey = !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  console.log('🔍 [AUTH] Checking env vars:', { hasGoogleServiceAccount, hasEmail, hasPrivateKey });

  let credentials: any = null;

  // Option 1: Try JSON service account
  if (hasGoogleServiceAccount) {
    try {
      console.log('📄 [AUTH] Parsing GOOGLE_SERVICE_ACCOUNT JSON...');
      const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT!);
      console.log('✅ [AUTH] Successfully parsed JSON. Extracting fields:');
      console.log('  - type:', parsed.type);
      console.log('  - project_id:', parsed.project_id);
      console.log('  - private_key_id:', parsed.private_key_id);
      console.log('  - client_email:', parsed.client_email);
      console.log('  - client_id:', parsed.client_id);
      console.log('  - auth_uri:', parsed.auth_uri);
      console.log('  - token_uri:', parsed.token_uri);
      console.log('  - auth_provider_x509_cert_url:', parsed.auth_provider_x509_cert_url);
      console.log('  - client_x509_cert_url:', parsed.client_x509_cert_url);
      console.log('  - private_key (first 50 chars):', parsed.private_key?.substring(0, 50) + '...');
      
      credentials = parsed;
      console.log('✅ [AUTH] Using GOOGLE_SERVICE_ACCOUNT (full JSON with all fields)');
    } catch (e: any) {
      console.error('❌ [AUTH] Failed to parse GOOGLE_SERVICE_ACCOUNT:', e.message);
    }
  }

  // Option 2: Try individual env vars
  if (!credentials && hasEmail && hasPrivateKey) {
    console.log('📋 [AUTH] Falling back to individual env vars...');
    let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!;
    privateKey = privateKey.replace(/\\n/g, '\n');
    
    credentials = {
      type: 'service_account',
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
      private_key: privateKey,
    };
    console.log('✅ [AUTH] Using individual env vars');
  }

  // If still no credentials, throw detailed error
  if (!credentials) {
    console.error('❌ [AUTH] No credentials available');
    throw new Error(
      'No Google credentials found. Set either:\n' +
      '1. GOOGLE_SERVICE_ACCOUNT (entire JSON service account)\n' +
      '2. GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY\n' +
      `Current state: hasServiceAccount=${hasGoogleServiceAccount}, hasEmail=${hasEmail}, hasPrivateKey=${hasPrivateKey}`
    );
  }

  try {
    console.log('🔐 [AUTH] Creating GoogleAuth with credentials...');
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    console.log('✅ [AUTH] GoogleAuth created successfully');
    console.log('✅ [AUTH] Creating Google Drive client...');
    const drive = google.drive({ version: 'v3', auth });
    console.log('✅ [AUTH] Google Drive client ready to use');
    return drive;
  } catch (error: any) {
    console.error('❌ [AUTH] Failed to create Google Drive client:', error.message);
    console.error('❌ [AUTH] Error details:', error);
    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('📂 [STORAGE] Request received:', { method: req.method });
  
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    console.log('✅ [STORAGE] OPTIONS request handled');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    console.log('❌ [STORAGE] Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!TARGET_FOLDER_ID) {
      console.log('❌ [STORAGE] GOOGLE_DRIVE_FOLDER_ID not configured');
      return res.status(400).json({ 
        error: 'GOOGLE_DRIVE_FOLDER_ID environment variable not set' 
      });
    }

    console.log('🔐 [STORAGE] Initializing Google Drive client...');
    const drive = await getGoogleDriveClient();
    console.log('✅ [STORAGE] Google Drive client initialized');

    let allFiles: Array<{ id: string; name: string; size: number }> = [];
    let pageToken: string | undefined = undefined;
    let totalBytes = 0;
    let pageCount = 0;

    do {
      pageCount++;
      console.log(`📄 [STORAGE] Fetching files page ${pageCount} from folder ${TARGET_FOLDER_ID}...`);
      
      const response: any = await drive.files.list({
        q: `'${TARGET_FOLDER_ID}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, size)',
        pageSize: 1000,
        pageToken: pageToken,
      });

      const files = response.data.files || [];
      console.log(`✅ [STORAGE] Page ${pageCount} returned ${files.length} files`);
      
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

    console.log(`✨ [STORAGE] SUCCESS - Found ${allFiles.length} files, total ${totalBytes} bytes`);
    res.json({
      totalBytes,
      fileCount: allFiles.length,
      files: allFiles,
    });
  } catch (error: any) {
    console.error('❌ [STORAGE] ERROR:', {
      message: error.message,
      code: error.code,
      status: error.status,
      stack: error.stack
    });
    res.status(500).json({ 
      error: error.message || 'Failed to get storage info',
      debug: process.env.NODE_ENV === 'development' ? error.toString() : undefined
    });
  }
}
