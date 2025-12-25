import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Check existence + whether the values appear to be valid-ish
  const serviceAccountStatus = getServiceAccountStatus();
  const folderStatus = getFolderIdStatus();

  res.status(200).json({
    // Basic boolean flags (for backward compatibility)
    hasAccount: !!process.env.GOOGLE_SERVICE_ACCOUNT,
    hasFolder: !!process.env.GOOGLE_DRIVE_FOLDER_ID,

    // More detailed & useful information
    status: {
      serviceAccount: serviceAccountStatus,
      driveFolder: folderStatus
    },

    // Quick summary message
    summary: getSummaryMessage(serviceAccountStatus, folderStatus),

    // Environment context (useful for debugging)
    environment: process.env.NODE_ENV || 'development',
    checkedAt: new Date().toISOString()
  });
}

function getServiceAccountStatus() {
  const value = process.env.GOOGLE_SERVICE_ACCOUNT;

  if (!value) {
    return {
      exists: false,
      message: "GOOGLE_SERVICE_ACCOUNT is not set",
      likelyValid: false
    };
  }

  if (value.length < 30) {
    return {
      exists: true,
      message: "GOOGLE_SERVICE_ACCOUNT is set but looks too short",
      likelyValid: false,
      length: value.length
    };
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
        ? "Looks like a valid service account JSON" 
        : "JSON parsed but missing some required service account fields",
      hasRequiredFields: hasRequiredKeys,
      length: value.length
    };
  } catch (e) {
    return {
      exists: true,
      parsed: false,
      likelyValid: false,
      message: "GOOGLE_SERVICE_ACCOUNT is set but is not valid JSON",
      error: e instanceof Error ? e.message : "Unknown parsing error",
      length: value.length
    };
  }
}

function getFolderIdStatus() {
  const value = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!value) {
    return {
      exists: false,
      message: "GOOGLE_DRIVE_FOLDER_ID is not set"
    };
  }

  const cleanValue = value.trim();
  const looksLikeId = /^[a-zA-Z0-9_-]{20,}$/.test(cleanValue);

  return {
    exists: true,
    value: cleanValue,
    likelyValid: looksLikeId,
    length: cleanValue.length,
    message: looksLikeId 
      ? "Looks like a valid Google Drive folder ID" 
      : "Value is set but doesn't look like a typical Drive ID (usually 20-50 chars alphanumeric)"
  };
}

function getSummaryMessage(
  account: ReturnType<typeof getServiceAccountStatus>,
  folder: ReturnType<typeof getFolderIdStatus>
) {
  if (!account.exists && !folder.exists) {
    return "Missing both credentials and folder ID → Drive integration won't work";
  }
  if (!account.exists) {
    return "Missing service account credentials → authentication will fail";
  }
  if (!folder.exists) {
    return "Missing Drive folder ID → can authenticate but can't target any folder";
  }
  if (!account.likelyValid) {
    return "Service account looks invalid → authentication will most likely fail";
  }
  if (!folder.likelyValid) {
    return "Folder ID looks suspicious → might cause 'folder not found' errors";
  }

  return "All required variables are present and appear valid ✓";
}
