import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { uploadImageToGoogleDrive, deleteImageFromGoogleDrive, getFileSizes } from "./googleDrive";
import bcrypt from "bcryptjs";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Firebase config endpoint for client
  app.get("/api/firebase-config", (_req, res) => {
    res.json({
      apiKey: process.env.FIREBASE_API_KEY || process.env.AI_INTEGRATIONS_FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.AI_INTEGRATIONS_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.AI_INTEGRATIONS_FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.AI_INTEGRATIONS_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.AI_INTEGRATIONS_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID || process.env.AI_INTEGRATIONS_FIREBASE_APP_ID,
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
      res.status(500).json({ error: error.message || "Failed to delete image" });
    }
  });

  // Get file sizes from Google Drive folder
  app.get("/api/drive-storage", async (_req, res) => {
    try {
      const result = await getFileSizes();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to get storage info" });
    }
  });

  // Hash password endpoint
  app.post("/api/hash-password", async (req, res) => {
    try {
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ error: "Password required" });
      }
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      res.json({ hashedPassword });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to hash password" });
    }
  });

  // Verify password endpoint
  app.post("/api/verify-password", async (req, res) => {
    try {
      const { password, hashedPassword } = req.body;
      if (!password || !hashedPassword) {
        return res.status(400).json({ error: "Password and hashedPassword required" });
      }
      const isValid = await bcrypt.compare(password, hashedPassword);
      res.json({ isValid });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to verify password" });
    }
  });

  return httpServer;
}
