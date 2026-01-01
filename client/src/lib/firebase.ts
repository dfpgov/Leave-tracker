import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

/**
 * Initialize Firebase (call once in your app)
 */
export async function initializeFirebase(): Promise<void> {
  if (app) return; // Already initialized

  try {
    const response = await fetch("/api/firebase-config");
    const config = await response.json();

    app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);

    console.log("Firebase initialized ✅");
  } catch (error) {
    console.error("Failed to initialize Firebase:", error);
    throw error;
  }
}

/** Get Firebase Auth instance */
export function getFirebaseAuth(): Auth {
  if (!auth) throw new Error("Firebase not initialized. Call initializeFirebase() first.");
  return auth;
}

/** Get Firestore instance */
export function getFirebaseDb(): Firestore {
  if (!db) throw new Error("Firebase not initialized. Call initializeFirebase() first.");
  return db;
}

/** Get Firebase Storage instance */
export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) throw new Error("Firebase not initialized. Call initializeFirebase() first.");
  return storage;
}

/** Check if Firebase is initialized */
export function isFirebaseInitialized(): boolean {
  return !!app;
}
