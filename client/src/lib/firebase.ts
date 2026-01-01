import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

// Firebase instances
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let firebaseStorage: FirebaseStorage;
let initialized = false;

/**
 * Initialize Firebase
 */
export async function initializeFirebase(): Promise<void> {
  if (initialized) return;

  try {
    const response = await fetch("/api/firebase-config");
    const config = await response.json();

    app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
    firebaseStorage = getStorage(app);

    initialized = true;
    console.log("Firebase initialized ✅");
  } catch (error) {
    console.error("Failed to initialize Firebase:", error);
    throw error;
  }
}

// Direct exports (for your old imports)
export { app, auth, db, firebaseStorage };

// Optional getters for new code
export function getFirebaseDb(): Firestore {
  if (!initialized) throw new Error("Firebase not initialized. Call initializeFirebase() first.");
  return db;
}
export function getFirebaseAuth(): Auth {
  if (!initialized) throw new Error("Firebase not initialized. Call initializeFirebase() first.");
  return auth;
}
export function getFirebaseStorage(): FirebaseStorage {
  if (!initialized) throw new Error("Firebase not initialized. Call initializeFirebase() first.");
  return firebaseStorage;
}

export function isFirebaseInitialized(): boolean {
  return initialized;
}
