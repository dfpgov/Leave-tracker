import { google } from 'googleapis';

// Load your environment variables
const GOOGLE_SERVICE_ACCOUNT = process.env.GOOGLE_SERVICE_ACCOUNT;

async function getDriveClient() {
  if (!GOOGLE_SERVICE_ACCOUNT) throw new Error("No Google credentials found");

  const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  return google.drive({ version: 'v3', auth });
}

async function testDriveAccess() {
  try {
    const drive = await getDriveClient();

    // List first 10 files accessible to this service account
    const res = await drive.files.list({
      pageSize: 10,
      fields: 'files(id, name)',
    });

    console.log("✅ Files accessible by service account:");
    console.log(res.data.files);
  } catch (err: any) {
    console.error("❌ Google Drive access test failed:", err.message);
  }
}

testDriveAccess();
