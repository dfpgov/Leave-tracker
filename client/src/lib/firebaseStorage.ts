import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  query, 
  where,
  writeBatch,
  deleteField,
  updateDoc
} from "firebase/firestore";
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from "firebase/storage";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import { getFirebaseDb, getFirebaseStorage, getFirebaseAuth } from "./firebase";
import { format } from "date-fns";

// Types
export type UserRole = 'Admin' | 'CoAdmin';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  createdAt: string;
  firebaseUid?: string;
}

export interface Employee {
  id: string;
  name: string;
  designation: string;
  department: string;
  gender: 'Male' | 'Female' | 'Other';
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
  status: 'Pending' | 'Approved' | 'Rejected';
  timestamp: string;
  attachmentFileName?: string;
  attachmentUrl?: string;
  doneBy: string;
  updatedBy?: string;
  updatedAt?: string;
}

// Collection names
const COLLECTIONS = {
  USERS: 'users',
  EMPLOYEES: 'employees',
  HOLIDAYS: 'holidays',
  LEAVE_TYPES: 'leaveTypes',
  LEAVE_REQUESTS: 'leaveRequests',
};

// Helper function to calculate days
export const calculateDays = (start: string, end: string): number => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
};

// Generate IDs
const generateId = (prefix: string): string => {
  return `${prefix}${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
};

// Current user session (stored in memory + localStorage for persistence)
let currentUser: User | null = null;

// Firebase Storage class
export const firebaseService = {
  // ============ USERS ============
  async getUsers(): Promise<User[]> {
    const db = getFirebaseDb();
    const snapshot = await getDocs(collection(db, COLLECTIONS.USERS));
    return snapshot.docs.map(doc => doc.data() as User);
  },

  async getUserById(id: string): Promise<User | null> {
    const db = getFirebaseDb();
    const docRef = doc(db, COLLECTIONS.USERS, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as User) : null;
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
    return generateId('USER');
  },

  async login(name: string, password: string): Promise<User | null> {
    try {
      const auth = getFirebaseAuth();
      // Use synthetic email pattern for Firebase Auth
      const email = `${name.toLowerCase().replace(/\s+/g, '_')}@dfp.local`;
      
      // Sign in with Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUid = userCredential.user.uid;
      
      // Fetch user profile from Firestore
      const users = await this.getUsers();
      const user = users.find(u => u.firebaseUid === firebaseUid || u.name === name);
      
      if (user) {
        // Update firebaseUid if not set
        if (!user.firebaseUid) {
          user.firebaseUid = firebaseUid;
          await this.saveUser(user);
        }
        currentUser = user;
        localStorage.setItem('lms_current_user', JSON.stringify(user));
        return user;
      }
      
      // User not found in Firestore - sign out from Firebase
      await signOut(auth);
      return null;
    } catch (error: any) {
      console.error('Firebase Auth login error:', error.code, error.message);
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
    currentUser = null;
    localStorage.removeItem('lms_current_user');
  },

  getCurrentUser(): User | null {
    if (currentUser) return currentUser;
    const stored = localStorage.getItem('lms_current_user');
    if (stored) {
      try {
        currentUser = JSON.parse(stored);
        return currentUser;
      } catch (e) {
        localStorage.removeItem('lms_current_user');
        return null;
      }
    }
    return null;
  },

  setCurrentUser(user: User): void {
    currentUser = user;
    localStorage.setItem('lms_current_user', JSON.stringify(user));
  },

  onAuthStateChange(callback: (user: User | null) => void): () => void {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const users = await this.getUsers();
        const user = users.find(u => u.firebaseUid === firebaseUser.uid);
        if (user) {
          currentUser = user;
          localStorage.setItem('lms_current_user', JSON.stringify(user));
          callback(user);
        } else {
          callback(null);
        }
      } else {
        currentUser = null;
        localStorage.removeItem('lms_current_user');
        callback(null);
      }
    });
  },

  getCurrentUserId(): string {
    const user = this.getCurrentUser();
    return user?.id || '';
  },

  async getUserName(userId: string): Promise<string> {
    const user = await this.getUserById(userId);
    return user ? user.name : 'Unknown';
  },

  // ============ EMPLOYEES ============
  async getEmployees(): Promise<Employee[]> {
    const db = getFirebaseDb();
    const snapshot = await getDocs(collection(db, COLLECTIONS.EMPLOYEES));
    return snapshot.docs.map(doc => doc.data() as Employee);
  },

  async getEmployeeById(id: string): Promise<Employee | null> {
    const db = getFirebaseDb();
    const docRef = doc(db, COLLECTIONS.EMPLOYEES, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as Employee) : null;
  },

  async saveEmployee(employee: Employee): Promise<void> {
    const db = getFirebaseDb();
    await setDoc(doc(db, COLLECTIONS.EMPLOYEES, employee.id), employee);
  },

  async deleteEmployee(id: string): Promise<void> {
    const db = getFirebaseDb();
    await deleteDoc(doc(db, COLLECTIONS.EMPLOYEES, id));
  },

  async deleteEmployees(ids: string[]): Promise<void> {
    const db = getFirebaseDb();
    const batch = writeBatch(db);
    ids.forEach(id => {
      batch.delete(doc(db, COLLECTIONS.EMPLOYEES, id));
    });
    await batch.commit();
  },

  generateEmployeeId(): string {
    return generateId('EMP');
  },

  // ============ HOLIDAYS ============
  async getHolidays(): Promise<Holiday[]> {
    const db = getFirebaseDb();
    const snapshot = await getDocs(collection(db, COLLECTIONS.HOLIDAYS));
    return snapshot.docs.map(doc => doc.data() as Holiday);
  },

  async saveHoliday(holiday: Holiday): Promise<void> {
    const db = getFirebaseDb();
    await setDoc(doc(db, COLLECTIONS.HOLIDAYS, holiday.id), holiday);
  },

  async deleteHoliday(id: string): Promise<void> {
    const db = getFirebaseDb();
    await deleteDoc(doc(db, COLLECTIONS.HOLIDAYS, id));
  },

  generateHolidayId(): string {
    return generateId('H');
  },

  // ============ LEAVE TYPES ============
  async getLeaveTypes(): Promise<LeaveType[]> {
    const db = getFirebaseDb();
    const snapshot = await getDocs(collection(db, COLLECTIONS.LEAVE_TYPES));
    return snapshot.docs.map(doc => doc.data() as LeaveType);
  },

  async saveLeaveType(leaveType: LeaveType): Promise<void> {
    const db = getFirebaseDb();
    await setDoc(doc(db, COLLECTIONS.LEAVE_TYPES, leaveType.id), leaveType);
  },

  async deleteLeaveType(id: string): Promise<void> {
    const db = getFirebaseDb();
    await deleteDoc(doc(db, COLLECTIONS.LEAVE_TYPES, id));
  },

  generateLeaveTypeId(): string {
    return generateId('LT');
  },

  // ============ LEAVE REQUESTS ============
  async getLeaveRequests(): Promise<LeaveRequest[]> {
    const db = getFirebaseDb();
    const snapshot = await getDocs(collection(db, COLLECTIONS.LEAVE_REQUESTS));
    return snapshot.docs.map(doc => doc.data() as LeaveRequest);
  },

  async getLeaveRequestById(id: string): Promise<LeaveRequest | null> {
    const db = getFirebaseDb();
    const docRef = doc(db, COLLECTIONS.LEAVE_REQUESTS, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as LeaveRequest) : null;
  },

  async saveLeaveRequest(request: LeaveRequest): Promise<void> {
    const db = getFirebaseDb();
    await setDoc(doc(db, COLLECTIONS.LEAVE_REQUESTS, request.id), request);
  },

  async deleteLeaveRequest(id: string): Promise<void> {
    const db = getFirebaseDb();
    const request = await this.getLeaveRequestById(id);
    
    // Delete attachment from Google Drive if exists
    if (request?.attachmentUrl) {
      try {
        // Extract file ID from Google Drive URL
        const url = request.attachmentUrl;
        let fileId = null;
        const idQueryMatch = url.match(/id=([^&]+)/);
        if (idQueryMatch) fileId = idQueryMatch[1];
        const filePathMatch = url.match(/\/file\/d\/([^/]+)/);
        if (filePathMatch) fileId = filePathMatch[1];
        
        if (fileId) {
          await fetch(`/api/delete-image/${fileId}`, { method: 'DELETE' });
        }
      } catch (error) {
        console.error("Error deleting attachment from Drive:", error);
      }
    }
    
    await deleteDoc(doc(db, COLLECTIONS.LEAVE_REQUESTS, id));
  },

  async deleteLeaveRequests(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.deleteLeaveRequest(id);
    }
  },

  generateLeaveRequestId(): string {
    return generateId('LR');
  },

  // ============ FILE UPLOAD ============
  async uploadAttachment(requestId: string, file: File): Promise<string> {
    const storage = getFirebaseStorage();
    const fileRef = ref(storage, `attachments/${requestId}/${file.name}`);
    await uploadBytes(fileRef, file);
    const downloadUrl = await getDownloadURL(fileRef);
    return downloadUrl;
  },

  async uploadAttachmentFromBase64(requestId: string, base64: string, fileName: string): Promise<string> {
    const storage = getFirebaseStorage();
    const fileRef = ref(storage, `attachments/${requestId}/${fileName}`);
    
    // Convert base64 to blob
    const response = await fetch(base64);
    const blob = await response.blob();
    
    await uploadBytes(fileRef, blob);
    const downloadUrl = await getDownloadURL(fileRef);
    return downloadUrl;
  },

  // ============ SEED DATA ============
  async seedInitialData(): Promise<void> {
    const db = getFirebaseDb();
    
    // Check if data already exists
    const usersSnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
    if (usersSnapshot.docs.length > 0) {
      console.log("Data already seeded");
      return;
    }

    console.log("Seeding initial data...");

    // Seed Users
    const initialUsers: User[] = [
      { id: 'ADMIN001', name: 'Admin', password: 'admin123', role: 'Admin', createdAt: new Date().toISOString() },
      { id: 'COADMIN001', name: 'CoAdmin', password: 'coadmin123', role: 'CoAdmin', createdAt: new Date().toISOString() },
    ];
    for (const user of initialUsers) {
      await setDoc(doc(db, COLLECTIONS.USERS, user.id), user);
    }

    // Seed Leave Types
    const initialLeaveTypes: LeaveType[] = [
      { id: 'LT001', name: 'Casual Leave', maxDays: 20, doneBy: 'ADMIN001' },
      { id: 'LT002', name: 'Sick Leave', maxDays: 10, doneBy: 'ADMIN001' },
      { id: 'LT003', name: 'Earned Leave', maxDays: null, doneBy: 'ADMIN001' },
    ];
    for (const lt of initialLeaveTypes) {
      await setDoc(doc(db, COLLECTIONS.LEAVE_TYPES, lt.id), lt);
    }

    // Seed Holidays
    const initialHolidays: Holiday[] = [
      { id: 'H001', name: 'New Year', startDate: '2025-01-01', endDate: '2025-01-01', totalDays: 1, doneBy: 'ADMIN001' },
    ];
    for (const h of initialHolidays) {
      await setDoc(doc(db, COLLECTIONS.HOLIDAYS, h.id), h);
    }

    // Seed sample employees
    const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Jessica', 'James', 'Amanda'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
    const designations = ['Software Engineer', 'Senior Developer', 'Manager', 'Analyst', 'Coordinator'];
    const departments = ['IT', 'HR', 'Finance', 'Sales', 'Marketing', 'Operations'];
    const genders: Array<'Male' | 'Female'> = ['Male', 'Female'];

    for (let i = 1; i <= 20; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const employee: Employee = {
        id: `EMP${String(i).padStart(4, '0')}`,
        name: `${firstName} ${lastName}`,
        designation: designations[Math.floor(Math.random() * designations.length)],
        department: departments[Math.floor(Math.random() * departments.length)],
        gender: genders[Math.floor(Math.random() * genders.length)],
        lastEdited: new Date().toISOString(),
        doneBy: 'ADMIN001'
      };
      await setDoc(doc(db, COLLECTIONS.EMPLOYEES, employee.id), employee);
    }

    console.log("Initial data seeded successfully");
  }
};

export default firebaseService;
