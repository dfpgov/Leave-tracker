import { FirebaseError } from "firebase/app";

export async function safeFirestore<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error: any) {
    if (error.code === "permission-denied") {
      throw new Error("PERMISSION_DENIED");
    }
    throw error;
  }
}
