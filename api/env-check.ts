import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

const MAX_EXECUTION_TIME_MS = 45000; // safety margin for Vercel

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Basic environment check
  const serviceAccountStatus = getServiceAccountStatus();
  const folderStatus = getFolderIdStatus();

  // Early exit if critical config is missing
  if (!serviceAccountStatus.exists || !folderStatus.exists) {
    return res.status(200).json({
      hasAccount: serviceAccountStatus.exists,
      hasFolder: folderStatus.exists,
      status: {
        serviceAccount: serviceAccountStatus,
        driveFolder: folderStatus,
      },
      summary: getSummaryMessage(serviceAccountStatus, folderStatus),
      totalSizeBytes: null,
      totalSizeHuman: null,
      fileCount: null,
      error: "Missing required environment variables",
      environment: process.env.NODE_ENV || 'development',
      checkedAt: new Date().toISOString(),
    });
  }

  // 2. Initialize Google Drive client using separate env vars
  let auth;
  let drive;
  try {
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!privateKey?.includes('-----BEGIN PRIVATE KEY-----')) {
      throw new Error('GOOGLE_PRIVATE_KEY does not contain valid PEM header');
    }

    auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: privateKey.replace(/\\n/g, '\n'), // safety in case of escaped newlines
      },
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    drive = google.drive({ version: 'v3', auth });
  } catch (err) {
    return res.status(200).json({
      ...createBaseResponse(serviceAccountStatus, folderStatus),
      summary: "Failed to initialize Google Auth / Drive client",
      error: err instanceof Error ? err.message : "Unknown auth initialization error",
      totalSizeBytes: null,
      totalSizeHuman: null,
      fileCount: null,
    });
  }

  // 3. Calculate total size
  try {
    const startTime = Date.now();

    const { totalSize, fileCount, error } = await calculateFolderTotalSize(
      drive,
      process.env.GOOGLE_DRIVE_FOLDER_ID!
    );

    const durationMs = Date.now() - startTime;
    const humanSize = formatBytes(totalSize);

    return res.status(200).json({
      ...createBaseResponse(serviceAccountStatus, folderStatus),
      summary: error
        ? `Could not fully calculate folder size: ${error}`
        : "Folder size calculated successfully ✓",
      totalSizeBytes: totalSize,
      totalSizeHuman: humanSize,
      fileCount,
      durationMs,
      truncated: !!error?.includes('timeout') || false,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(200).json({
      ...createBaseResponse(serviceAccountStatus, folderStatus),
      summary: "Error while calculating folder size",
      error: err instanceof Error ? err.message : "Unknown error during size calculation",
      totalSizeBytes: null,
      totalSizeHuman: null,
      fileCount: null,
    });
  }
}

// ────────────────────────────────────────────────
//              Helper Functions
// ────────────────────────────────────────────────

function createBaseResponse(
  account: ReturnType<typeof getServiceAccountStatus>,
  folder: ReturnType<typeof getFolderIdStatus>
) {
  return {
    hasAccount: account.exists,
    hasFolder: folder.exists,
    status: {
      serviceAccount: account,
      driveFolder: folder,
    },
    environment: process.env.NODE_ENV || 'development',
  };
}

async function calculateFolderTotalSize(
  drive: any,
  folderId: string
): Promise<{ totalSize: number; fileCount: number; error?: string }> {
  let totalSize = 0;
  let fileCount = 0;
  let nextPageToken: string | undefined = undefined;

  const startTime = Date.now();

  do {
    if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
      return {
        totalSize,
        fileCount,
        error: "Execution time limit reached - result is partial/truncated",
      };
    }

    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size)',
      pageToken: nextPageToken,
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const files = res.data.files || [];

    for (const file of files) {
      if (file.size) {
        totalSize += Number(file.size);
      }
      fileCount++;
    }

    nextPageToken = res.data.nextPageToken ?? undefined;
  } while (nextPageToken);

  return { totalSize, fileCount };
}

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

// ────────────────────────────────────────────────
//              Status Check Functions
// ────────────────────────────────────────────────

function getServiceAccountStatus() {
  const hasEmail = !!process.env.GOOGLE_CLIENT_EMAIL;
  const hasPrivateKey = !!process.env.GOOGLE_PRIVATE_KEY;

  if (!hasEmail || !hasPrivateKey) {
    return {
      exists: false,
      message: `Missing ${!hasEmail ? 'GOOGLE_CLIENT_EMAIL' : ''}${
        !hasPrivateKey ? ' GOOGLE_PRIVATE_KEY' : ''
      }`,
      likelyValid: false,
    };
  }

  const looksValid =
    process.env.GOOGLE_CLIENT_EMAIL?.endsWith('.iam.gserviceaccount.com') &&
    process.env.GOOGLE_PRIVATE_KEY?.includes('-----BEGIN PRIVATE KEY-----') &&
    process.env.GOOGLE_PRIVATE_KEY?.includes('-----END PRIVATE KEY-----');

  return {
    exists: true,
    likelyValid: looksValid,
    message: looksValid
      ? "Service account credentials appear present and correctly formatted"
      : "Credentials present but format looks suspicious",
    clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
    privateKeyLength: process.env.GOOGLE_PRIVATE_KEY?.length || 0,
  };
}

function getFolderIdStatus() {
  const value = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!value) {
    return { exists: false, message: "GOOGLE_DRIVE_FOLDER_ID is not set" };
  }
  const clean = value.trim();
  const looksLikeId = /^[a-zA-Z0-9_-]{18,}$/.test(clean);

  return {
    exists: true,
    value: clean,
    likelyValid: looksLikeId,
    length: clean.length,
    message: looksLikeId
      ? "Looks like valid Drive ID"
      : "Doesn't look like typical Drive ID (usually ≥20 chars)",
  };
}

function getSummaryMessage(
  account: ReturnType<typeof getServiceAccountStatus>,
  folder: ReturnType<typeof getFolderIdStatus>
) {
  if (!account.exists) return "Missing service account credentials";
  if (!folder.exists) return "Missing Drive folder ID";
  if (!account.likelyValid) return "Service account credentials format looks invalid";
  if (!folder.likelyValid) return "Folder ID looks suspicious";
  return "Configuration looks good ✓";
}
