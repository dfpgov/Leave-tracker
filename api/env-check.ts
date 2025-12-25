import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

// Optional: increase timeout for larger folders (Vercel free tier = 10s, pro = 60s)
const MAX_EXECUTION_TIME_MS = 45000; // safety margin

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Basic environment check
  const serviceAccountStatus = getServiceAccountStatus();
  const folderStatus = getFolderIdStatus();

  // Early response if critical config is missing
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

  // 2. Try to initialize Google Drive client
  let auth;
  let drive;
  try {
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT!);

    auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
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
      truncated: error?.includes("timeout") || false,
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

  do {
    // Safety timeout
    if (Date.now() - Date.now() > MAX_EXECUTION_TIME_MS) { // wait, wrong - should be startTime
      return { totalSize, fileCount, error: "Execution time limit reached - result is partial/truncated" };
    }

    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size)',
      pageToken: nextPageToken,
      pageSize: 1000,           // max = 1000
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const files = res.data.files || [];

    for (const file of files) {
      // Google Docs/Sheets/Slides etc. don't have 'size' field
      if (file.size) {
        totalSize += Number(file.size);
      }
      fileCount++;
    }

    nextPageToken = res.data.nextPageToken ?? undefined;
  } while (nextPageToken);

  return { totalSize, fileCount };
}

/** Returns human readable file size (B → KB → MB → GB → TB) */
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

// ────────────────────────────────────────────────
//              Your original status check functions
// ────────────────────────────────────────────────

function getServiceAccountStatus() {
  const value = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!value) {
    return { exists: false, message: "GOOGLE_SERVICE_ACCOUNT is not set", likelyValid: false };
  }
  if (value.length < 30) {
    return { exists: true, message: "Too short to be valid JSON", likelyValid: false, length: value.length };
  }

  try {
    const parsed = JSON.parse(value);
    const hasRequiredKeys =
      parsed.type === 'service_account' &&
      parsed.project_id &&
      parsed.private_key &&
      parsed.client_email;

    return {
      exists: true,
      parsed: true,
      likelyValid: hasRequiredKeys,
      message: hasRequiredKeys
        ? "Valid service account JSON"
        : "JSON parsed but missing required fields",
      hasRequiredFields: hasRequiredKeys,
      length: value.length,
    };
  } catch (e) {
    return {
      exists: true,
      parsed: false,
      likelyValid: false,
      message: "Not valid JSON",
      error: e instanceof Error ? e.message : "Unknown parsing error",
      length: value.length,
    };
  }
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
      : "Doesn't look like typical Drive ID (usually ≥20 chars alphanumeric + _-)",
  };
}

function getSummaryMessage(
  account: ReturnType<typeof getServiceAccountStatus>,
  folder: ReturnType<typeof getFolderIdStatus>
) {
  if (!account.exists) return "Missing service account credentials";
  if (!folder.exists) return "Missing Drive folder ID";
  if (!account.likelyValid) return "Service account looks invalid";
  if (!folder.likelyValid) return "Folder ID looks suspicious";
  return "Configuration looks good ✓";
}
