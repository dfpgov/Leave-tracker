import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as bcrypt from "bcryptjs";
import * as cors from "cors";
import { google } from "googleapis";
import { Readable } from "stream";

admin.initializeApp();

const corsHandler = cors({ origin: true });

// Environment variables (set via firebase functions:config:set)
const GOOGLE_DRIVE_FOLDER_ID = functions.config().drive?.folder_id || "";
const GOOGLE_SERVICE_ACCOUNT = functions.config().drive?.service_account
  ? JSON.parse(functions.config().drive.service_account)
  : null;

// Google Drive client
async function getGoogleDriveClient() {
  if (!GOOGLE_SERVICE_ACCOUNT) {
    throw new Error("Google Drive service account not configured");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: GOOGLE_SERVICE_ACCOUNT,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth });
}

// Hash password endpoint
export const hashPassword = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const { password } = req.body;
      if (!password) {
        res.status(400).json({ error: "Password required" });
        return;
      }
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      res.json({ hashedPassword });
    } catch (error: any) {
      console.error("Error hashing password:", error);
      res.status(500).json({ error: error.message || "Failed to hash password" });
    }
  });
});

// Verify password endpoint
export const verifyPassword = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const { password, hashedPassword } = req.body;
      if (!password || !hashedPassword) {
        res.status(400).json({ error: "Password and hashedPassword required" });
        return;
      }
      const isValid = await bcrypt.compare(password, hashedPassword);
      res.json({ isValid });
    } catch (error: any) {
      console.error("Error verifying password:", error);
      res.status(500).json({ error: error.message || "Failed to verify password" });
    }
  });
});

// Upload image to Google Drive
export const uploadImage = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const { base64Data, fileName, mimeType } = req.body;

      if (!base64Data || !fileName || !mimeType) {
        res.status(400).json({
          error: "Missing required fields: base64Data, fileName, mimeType",
        });
        return;
      }

      if (!GOOGLE_DRIVE_FOLDER_ID) {
        res.status(500).json({ error: "Google Drive folder not configured" });
        return;
      }

      const drive = await getGoogleDriveClient();

      // Remove base64 prefix if present
      const base64Content = base64Data.includes(",")
        ? base64Data.split(",")[1]
        : base64Data;

      // Convert base64 to buffer
      const buffer = Buffer.from(base64Content, "base64");

      // Create a readable stream
      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);

      // Upload file
      const createResponse = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [GOOGLE_DRIVE_FOLDER_ID],
        },
        media: {
          mimeType: mimeType,
          body: stream,
        },
        fields: "id, webViewLink, webContentLink",
      });

      const fileId = createResponse.data.id;
      if (!fileId) {
        throw new Error("Failed to get file ID from Google Drive response");
      }

      // Make file publicly readable
      await drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });

      // Get updated file info
      const fileResponse = await drive.files.get({
        fileId: fileId,
        fields: "id, webViewLink, webContentLink",
      });

      res.json({
        success: true,
        fileId: fileResponse.data.id || fileId,
        webViewLink:
          fileResponse.data.webViewLink ||
          `https://drive.google.com/file/d/${fileId}/view`,
        webContentLink:
          fileResponse.data.webContentLink ||
          `https://drive.google.com/uc?export=view&id=${fileId}`,
      });
    } catch (error: any) {
      console.error("Error uploading to Google Drive:", error);
      res.status(500).json({ error: error.message || "Failed to upload image" });
    }
  });
});

// Delete image from Google Drive
export const deleteImage = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "DELETE") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const fileId = req.query.fileId as string;
      if (!fileId) {
        res.status(400).json({ error: "fileId required" });
        return;
      }

      const drive = await getGoogleDriveClient();
      await drive.files.delete({ fileId });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting from Google Drive:", error);
      res.status(500).json({ error: error.message || "Failed to delete image" });
    }
  });
});

// Get drive storage info
export const driveStorage = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      if (!GOOGLE_DRIVE_FOLDER_ID) {
        res.status(500).json({ error: "Google Drive folder not configured" });
        return;
      }

      const drive = await getGoogleDriveClient();

      let allFiles: Array<{ id: string; name: string; size: number }> = [];
      let pageToken: string | undefined = undefined;
      let totalBytes = 0;

      do {
        const response: any = await drive.files.list({
          q: `'${GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed = false`,
          fields: "nextPageToken, files(id, name, size)",
          pageSize: 1000,
          pageToken: pageToken,
        });

        const files = response.data.files || [];
        for (const file of files) {
          const fileSize = parseInt(file.size || "0", 10);
          totalBytes += fileSize;
          allFiles.push({
            id: file.id || "",
            name: file.name || "",
            size: fileSize,
          });
        }

        pageToken = response.data.nextPageToken;
      } while (pageToken);

      res.json({
        totalBytes,
        fileCount: allFiles.length,
        files: allFiles,
      });
    } catch (error: any) {
      console.error("Error getting drive storage:", error);
      res.status(500).json({ error: error.message || "Failed to get storage info" });
    }
  });
});
