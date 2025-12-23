# Vercel Deployment Guide

## Prerequisites

1. A Vercel account (https://vercel.com)
2. Your Firebase project credentials
3. A Google Cloud Service Account for Google Drive integration

## Step 1: Prepare Your Repository

Push your code to GitHub, GitLab, or Bitbucket.

## Step 2: Import Project in Vercel

1. Go to https://vercel.com/new
2. Import your Git repository
3. The build settings are already configured in `vercel.json`:
   - **Framework Preset**: Vite
   - **Build Command**: `vite build --outDir dist/public`
   - **Output Directory**: `dist/public`
   - **Routes**: Static files served first, then API routes, then SPA fallback

## Step 3: Add Environment Variables

In Vercel Project Settings → Environment Variables, add:

### Firebase Configuration
```
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
```

### Google Drive Integration
```
GOOGLE_DRIVE_FOLDER_ID=1qqtJcL0Hxy0xHtbrFFZdnyNdfy3ehneI
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Step 4: Create Google Service Account (for Google Drive)

1. Go to Google Cloud Console → IAM & Admin → Service Accounts
2. Create a new service account
3. Generate a JSON key file
4. Copy `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
5. Copy `private_key` → `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
6. Share your Google Drive folder with the service account email (give Editor access)

## Step 5: Deploy

Click "Deploy" in Vercel. Your app will be live at `your-project.vercel.app`.

## API Routes

The following serverless functions are configured:
- `/api/firebase-config` - Firebase configuration
- `/api/hash-password` - Password hashing
- `/api/verify-password` - Password verification
- `/api/upload-image` - Upload to Google Drive
- `/api/delete-image/[fileId]` - Delete from Google Drive
- `/api/drive-storage` - Get storage usage

## Notes

- The Google Drive integration requires a Google Cloud Service Account (different from Replit's connector)
- All data is stored in Firebase Firestore (same as on Replit)
- Make sure to share the Google Drive folder with the service account email
