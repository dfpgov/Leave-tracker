import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { uploadImageToGoogleDrive, deleteImageFromGoogleDrive } from "./googleDrive";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Firebase config endpoint for client
  app.get("/api/firebase-config", (_req, res) => {
    res.json({
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
    });
  });

  // Google Drive image upload endpoint
  app.post("/api/upload-image", async (req, res) => {
    try {
      const { base64Data, fileName, mimeType } = req.body;

      if (!base64Data || !fileName || !mimeType) {
        return res.status(400).json({ error: "Missing required fields: base64Data, fileName, mimeType" });
      }

      const result = await uploadImageToGoogleDrive(base64Data, fileName, mimeType);
      
      res.json({
        success: true,
        fileId: result.fileId,
        webViewLink: result.webViewLink,
        webContentLink: result.webContentLink,
      });
    } catch (error: any) {
      console.error("Error uploading to Google Drive:", error);
      res.status(500).json({ error: error.message || "Failed to upload image" });
    }
  });

  // Delete image from Google Drive
  app.delete("/api/delete-image/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      await deleteImageFromGoogleDrive(fileId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting from Google Drive:", error);
      res.status(500).json({ error: error.message || "Failed to delete image" });
    }
  });

  return httpServer;
}
