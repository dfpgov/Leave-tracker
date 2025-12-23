import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { Readable } from 'stream';

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
  console.log('📤 [UPLOAD] Request received:', { method: req.method, hasBody: !!req.body });
  
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    console.log('✅ [UPLOAD] OPTIONS request handled');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    console.log('❌ [UPLOAD] Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔍 [UPLOAD] Parsing request body...');
    const { base64Data, fileName, mimeType } = req.body;
    console.log('📋 [UPLOAD] Body parsed:', { hasBase64: !!base64Data, fileName, mimeType });

    if (!base64Data || !fileName || !mimeType) {
      console.log('⚠️  [UPLOAD] Missing fields:', { base64Data: !!base64Data, fileName: !!fileName, mimeType: !!mimeType });
      return res.status(400).json({ 
        error: 'Missing required fields: base64Data, fileName, mimeType' 
      });
    }

    if (!TARGET_FOLDER_ID) {
      console.log('❌ [UPLOAD] GOOGLE_DRIVE_FOLDER_ID not configured');
      return res.status(400).json({ 
        error: 'GOOGLE_DRIVE_FOLDER_ID environment variable not set' 
      });
    }

    console.log('🔐 [UPLOAD] Initializing Google Drive client...');
    const drive = await getGoogleDriveClient();
    console.log('✅ [UPLOAD] Google Drive client initialized');

    const base64Content = base64Data.includes(',') 
      ? base64Data.split(',')[1] 
      : base64Data;
    console.log('📊 [UPLOAD] Base64 content extracted, length:', base64Content.length);

    const buffer = Buffer.from(base64Content, 'base64');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    console.log('📦 [UPLOAD] Buffer and stream created');

    console.log('🚀 [UPLOAD] Creating file in Google Drive:', { fileName, mimeType, folder: TARGET_FOLDER_ID });
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
    });

    const fileId = createResponse.data.id;
    console.log('✅ [UPLOAD] File created with ID:', fileId);
    
    if (!fileId) {
      throw new Error('Failed to get file ID from Google Drive');
    }

    console.log('🔓 [UPLOAD] Setting file permissions to public...');
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });
    console.log('✅ [UPLOAD] File is now public');

    console.log('📋 [UPLOAD] Fetching file details...');
    const fileResponse = await drive.files.get({
      fileId: fileId,
      fields: 'id, webViewLink, webContentLink',
    });
    console.log('✅ [UPLOAD] File details retrieved');

    console.log('✨ [UPLOAD] SUCCESS - File uploaded and public');
    res.json({
      success: true,
      fileId: fileResponse.data.id || fileId,
      webViewLink: fileResponse.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
      webContentLink: fileResponse.data.webContentLink || `https://drive.google.com/uc?export=view&id=${fileId}`,
    });
  } catch (error: any) {
    console.error('❌ [UPLOAD] ERROR:', {
      message: error.message,
      code: error.code,
      status: error.status,
      stack: error.stack
    });
    res.status(500).json({ 
      error: error.message || 'Failed to upload image',
      debug: process.env.NODE_ENV === 'development' ? error.toString() : undefined
    });
  }
}
