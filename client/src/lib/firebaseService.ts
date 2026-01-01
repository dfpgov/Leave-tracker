import { doc, getDoc, deleteDoc, setDoc, addDoc, collection } from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import { safeFirestore } from "./safeFirestore"; // we will create this

// Get current user role
export async function getCurrentUserRole(): Promise<"admin" | "coadmin"> {
  const auth = getFirebaseAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("NOT_AUTHENTICATED");

  const snap = await getDoc(doc(getFirebaseDb(), "users", uid));
  return snap.data()?.role;
}

// Generic delete function
export const deleteDocument = (collectionName: string, id: string) => {
  return safeFirestore(() =>
    deleteDoc(doc(getFirebaseDb(), collectionName, id))
  );
};

// Add document
export const addDocument = (collectionName: string, data: any) => {
  return safeFirestore(() =>
    addDoc(collection(getFirebaseDb(), collectionName), data)
  );
};

// Update document
export const updateDocument = (collectionName: string, id: string, data: any) => {
  return safeFirestore(() =>
    setDoc(doc(getFirebaseDb(), collectionName, id), data, { merge: true })
  );
};
