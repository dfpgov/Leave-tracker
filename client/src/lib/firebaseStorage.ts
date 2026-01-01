import { 
  collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, where,
  writeBatch, updateDoc
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirebaseDb, getFirebaseStorage } from "./firebase";
import { format } from "date-fns";

// -------------------- TYPES --------------------
export type UserRole = "Admin" | "CoAdmin";

export interface User {
  id: string;
  name: string;
  password: string;
  role: UserRole;
  createdAt: string;
}

export interface Employee {
  id: string;
  name: string;
  designation: string;
  department: string;
  gender: "Male" | "Female" | "Other";
  lastEdited: string;
  doneBy: string;
}

export interface Holiday {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  doneBy: string;
}

export interface LeaveType {
  id: string;
  name: string;
  maxDays: number | null;
  doneBy: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  designation: string;
  department: string;
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  approvedDays: number;
  comments: string;
  status: "Pending" | "Approved" | "Rejected";
  timestamp: string;
  attachmentFileName?: string;
  attachmentUrl?: string;
  doneBy: string;
  updatedBy?: string;
  updatedAt?: string;
}

// -------------------- COLLECTION NAMES --------------------
const COLLECTIONS = {
  USERS: "users",
  EMPLOYEES: "employees",
  HOLIDAYS: "holidays",
  LEAVE_TYPES: "leaveTypes",
  LEAVE_REQUESTS: "leaveRequests",
};

// -------------------- HELPER FUNCTIONS --------------------
export const calculateDays = (start: string, end: string): number => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

const generateId = (prefix: string): string =>
  `${prefix}${Date.now()}${Math.random().toString(36).substr(2, 9)}`;

let currentUser: User | null = null;

// -------------------- FIREBASE SERVICE --------------------
export const firebaseService = {
  // -------------------- USERS --------------------
  async getUsers(): Promise<User[]> {
    const db = getFirebaseDb();
    const snapshot = await getDocs(collection(db, COLLECTIONS.USERS));
    return snapshot.docs.map(doc => doc.data() as User);
  },

  async getUserById(id: string): Promise<User | null> {
    const db = getFirebaseDb();
    const docRef = doc(db, COLLECTIONS.USERS, id);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as User) : null;
  },

  async getUserByUsername(name: string): Promise<User | null> {
    const db = getFirebaseDb();
    const q = query(collection(db, COLLECTIONS.USERS), where("name", "==", name));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as User;
  },

  async saveUser(user: User): Promise<void> {
    const db = getFirebaseDb();
    await setDoc(doc(db, COLLECTIONS.USERS, user.id), user);
  },

  async deleteUser(id: string): Promise<void> {
    const db = getFirebaseDb();
    await deleteDoc(doc(db, COLLECTIONS.USERS, id));
  },

  generateUserId(): string {
    return generateId("USER");
  },

  async login(name: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(name);
    if (!user) return null;

    if (user.password === password) {
      currentUser = user;
      localStorage.setItem("lms_current_user", JSON.stringify(user));
      return user;
    }
    return null;
  },

  logout(): void {
    currentUser = null;
    localStorage.removeItem("lms_current_user");
  },

  getCurrentUser(): User | null {
    if (currentUser) return currentUser;
    const stored = localStorage.getItem("lms_current_user");
    if (!stored) return null;
    try {
      currentUser = JSON.parse(stored);
      return currentUser;
    } catch {
      localStorage.removeItem("lms_current_user");
      return null;
    }
  },

  getCurrentUserId(): string {
    return this.getCurrentUser()?.id || "";
  },

  setCurrentUser(user: User): void {
    currentUser = user;
    localStorage.setItem("lms_current_user", JSON.stringify(user));
  },

  // -------------------- EMPLOYEES --------------------
  async getEmployees(): Promise<Employee[]> {
    const db = getFirebaseDb();
    const snapshot = await getDocs(collection(db, COLLECTIONS.EMPLOYEES));
    return snapshot.docs.map(doc => doc.data() as Employee);
  },

  async getEmployeeById(id: string): Promise<Employee | null> {
    const db = getFirebaseDb();
    const snap = await getDoc(doc(db, COLLECTIONS.EMPLOYEES, id));
    return snap.exists() ? (snap.data() as Employee) : null;
  },

  async saveEmployee(emp: Employee): Promise<void> {
    const db = getFirebaseDb();
    await setDoc(doc(db, COLLECTIONS.EMPLOYEES, emp.id), emp);
  },

  async deleteEmployee(id: string): Promise<void> {
    const db = getFirebaseDb();
    await deleteDoc(doc(db, COLLECTIONS.EMPLOYEES, id));
  },

  async deleteEmployees(ids: string[]): Promise<void> {
    const db = getFirebaseDb();
    const batch = writeBatch(db);
    ids.forEach(id => batch.delete(doc(db, COLLECTIONS.EMPLOYEES, id)));
    await batch.commit();
  },

  generateEmployeeId(): string {
    return generateId("EMP");
  },

  // -------------------- HOLIDAYS --------------------
  async getHolidays(): Promise<Holiday[]> {
    const db = getFirebaseDb();
    const snapshot = await getDocs(collection(db, COLLECTIONS.HOLIDAYS));
    return snapshot.docs.map(doc => doc.data() as Holiday);
  },

  async saveHoliday(h: Holiday): Promise<void> {
    const db = getFirebaseDb();
    await setDoc(doc(db, COLLECTIONS.HOLIDAYS, h.id), h);
  },

  async deleteHoliday(id: string): Promise<void> {
    const db = getFirebaseDb();
    await deleteDoc(doc(db, COLLECTIONS.HOLIDAYS, id));
  },

  generateHolidayId(): string {
    return generateId("H");
  },

  // -------------------- LEAVE TYPES --------------------
  async getLeaveTypes(): Promise<LeaveType[]> {
    const db = getFirebaseDb();
    const snapshot = await getDocs(collection(db, COLLECTIONS.LEAVE_TYPES));
    return snapshot.docs.map(doc => doc.data() as LeaveType);
  },

  async saveLeaveType(lt: LeaveType): Promise<void> {
    const db = getFirebaseDb();
    await setDoc(doc(db, COLLECTIONS.LEAVE_TYPES, lt.id), lt);
  },

  async deleteLeaveType(id: string): Promise<void> {
    const db = getFirebaseDb();
    await deleteDoc(doc(db, COLLECTIONS.LEAVE_TYPES, id));
  },

  generateLeaveTypeId(): string {
    return generateId("LT");
  },

  // -------------------- LEAVE REQUESTS --------------------
  async getLeaveRequests(): Promise<LeaveRequest[]> {
    const db = getFirebaseDb();
    const snapshot = await getDocs(collection(db, COLLECTIONS.LEAVE_REQUESTS));
    return snapshot.docs.map(doc => doc.data() as LeaveRequest);
  },

  async getLeaveRequestById(id: string): Promise<LeaveRequest | null> {
    const db = getFirebaseDb();
    const snap = await getDoc(doc(db, COLLECTIONS.LEAVE_REQUESTS, id));
    return snap.exists() ? (snap.data() as LeaveRequest) : null;
  },

  async saveLeaveRequest(req: LeaveRequest): Promise<void> {
    const db = getFirebaseDb();
    await setDoc(doc(db, COLLECTIONS.LEAVE_REQUESTS, req.id), req);
  },

  async deleteLeaveRequest(id: string): Promise<void> {
    const db = getFirebaseDb();
    await deleteDoc(doc(db, COLLECTIONS.LEAVE_REQUESTS, id));
  },

  generateLeaveRequestId(): string {
    return generateId("LR");
  },

  // -------------------- FILE UPLOAD --------------------
  async uploadAttachment(requestId: string, file: File): Promise<string> {
    const storage = getFirebaseStorage();
    const fileRef = ref(storage, `attachments/${requestId}/${file.name}`);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
  },

  // -------------------- INITIAL DATA --------------------
  async seedInitialData(): Promise<void> {
    const db = getFirebaseDb();
    const usersSnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
    if (usersSnapshot.docs.length > 0) return;

    // Seed users
    const initialUsers: User[] = [
      { id: "ADMIN001", name: "Admin", password: "admin123", role: "Admin", createdAt: new Date().toISOString() },
      { id: "COADMIN001", name: "CoAdmin", password: "coadmin123", role: "CoAdmin", createdAt: new Date().toISOString() },
    ];
    for (const u of initialUsers) await setDoc(doc(db, COLLECTIONS.USERS, u.id), u);
  },
};

export default firebaseService;
