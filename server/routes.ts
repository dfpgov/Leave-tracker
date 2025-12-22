import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { uploadImageToGoogleDrive, deleteImageFromGoogleDrive, getFileSizes } from "./googleDrive";
import bcrypt from "bcryptjs";
import admin from "firebase-admin";

// Initialize Firebase Admin SDK (only if credentials are available)
let firebaseAdminInitialized = false;
if (!admin.apps.length && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    firebaseAdminInitialized = true;
    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
  }
} else if (!process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
  console.warn('Firebase Admin SDK not initialized: Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY secrets');
}

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

  // Get file sizes from Google Drive folder
  app.get("/api/drive-storage", async (_req, res) => {
    try {
      const result = await getFileSizes();
      res.json(result);
    } catch (error: any) {
      console.error("Error getting drive storage:", error);
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
      console.error("Error hashing password:", error);
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
      console.error("Error verifying password:", error);
      res.status(500).json({ error: error.message || "Failed to verify password" });
    }
  });

  // Create Firebase Auth user
  app.post("/api/create-auth-user", async (req, res) => {
    if (!firebaseAdminInitialized) {
      return res.status(503).json({ 
        error: "Firebase Admin not configured. Please add FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY secrets." 
      });
    }
    
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }
      
      // Create synthetic email from username
      const email = `${username.toLowerCase().replace(/\s+/g, '_')}@dfp.local`;
      
      // Create user in Firebase Authentication
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: username,
      });
      
      res.json({ 
        success: true, 
        uid: userRecord.uid,
        email: userRecord.email
      });
    } catch (error: any) {
      console.error("Error creating Firebase Auth user:", error);
      if (error.code === 'auth/email-already-exists') {
        return res.status(400).json({ error: "User already exists" });
      }
      res.status(500).json({ error: error.message || "Failed to create user" });
    }
  });

  // Delete Firebase Auth user
  app.delete("/api/delete-auth-user/:uid", async (req, res) => {
    if (!firebaseAdminInitialized) {
      return res.status(503).json({ error: "Firebase Admin not configured" });
    }
    
    try {
      const { uid } = req.params;
      await admin.auth().deleteUser(uid);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting Firebase Auth user:", error);
      res.status(500).json({ error: error.message || "Failed to delete user" });
    }
  });

  return httpServer;
}
