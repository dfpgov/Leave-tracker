import { auth, db } from "./firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, collection, addDoc, updateDoc, deleteDoc, getDocs } from "firebase/firestore";

export interface User {
  uid: string;
  name: string;
  role: "admin" | "coadmin";
  email: string;
}

// LOGIN FUNCTION
export async function login(email: string, password: string): Promise<User | null> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;
  const userSnap = await getDoc(doc(db, "users", uid));
  if (!userSnap.exists()) return null;
  return { uid, ...(userSnap.data() as User) };
}

// GENERIC CRUD FUNCTIONS

export async function getCollection<T>(collectionName: string): Promise<T[]> {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as T));
}

export async function addDocument(collectionName: string, data: any) {
  return await addDoc(collection(db, collectionName), data);
}

export async function updateDocument(collectionName: string, docId: string, data: any) {
  return await updateDoc(doc(db, collectionName, docId), data);
}

export async function deleteDocument(collectionName: string, docId: string) {
  return await deleteDoc(doc(db, collectionName, docId));
}
