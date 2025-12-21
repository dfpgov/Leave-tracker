import { format } from "date-fns";

// Types
export type UserRole = 'Admin' | 'CoAdmin';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt: string;
}

export interface Employee {
  id: string;
  name: string;
  designation: string;
  department: string;
  gender: 'Male' | 'Female' | 'Other';
  lastEdited: string;
  doneBy: string; // User ID
}

export interface Holiday {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  doneBy: string; // User ID
}

export interface LeaveType {
  id: string;
  name: string;
  maxDays: number | null;
  doneBy: string; // User ID
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
  attachmentBase64?: string;
  doneBy: string; // User ID
  updatedBy?: string; // User ID who last updated
  updatedAt?: string; // When it was last updated
}

// Initial Data Seeds
const INITIAL_LEAVE_TYPES: LeaveType[] = [
  { id: 'LT001', name: 'Casual Leave', maxDays: 20, doneBy: 'ADMIN001' },
  { id: 'LT002', name: 'Sick Leave', maxDays: 10, doneBy: 'ADMIN001' },
  { id: 'LT003', name: 'Earned Leave', maxDays: null, doneBy: 'ADMIN001' },
];

// Generate sample employees for demo
const generateSampleEmployees = (): Employee[] => {
  const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Jessica', 'James', 'Amanda', 'William', 'Ashley', 'Richard', 'Michelle', 'Charles', 'Jennifer', 'Joseph', 'Maria', 'Thomas', 'Lisa', 'Christopher', 'Nancy', 'Daniel', 'Karen', 'Matthew', 'Lisa', 'Mark', 'Betty', 'Donald', 'Sandra', 'Steven', 'Deborah', 'Paul', 'Stephanie', 'Andrew', 'Susan', 'Joshua', 'Jacqueline', 'Kenneth', 'Mary', 'Kevin', 'Elizabeth'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'];
  const designations = ['Software Engineer', 'Senior Developer', 'Manager', 'Senior Manager', 'Director', 'Analyst', 'Coordinator', 'Specialist', 'Officer', 'Associate', 'Consultant', 'Executive', 'Administrator', 'Supervisor', 'Intern'];
  const departments = ['IT', 'HR', 'Finance', 'Sales', 'Marketing', 'Operations', 'Administration', 'Legal', 'Production', 'Quality', 'Research', 'Development'];
  const genders: Array<'Male' | 'Female' | 'Other'> = ['Male', 'Female'];

  const employees: Employee[] = [];
  
  for (let i = 1; i <= 100; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const name = `${firstName} ${lastName}`;
    const designation = designations[Math.floor(Math.random() * designations.length)];
    const department = departments[Math.floor(Math.random() * departments.length)];
    const gender = genders[Math.floor(Math.random() * genders.length)];
    
    const id = `EMP${String(i).padStart(4, '0')}`;
    
    employees.push({
      id,
      name,
      designation,
      department,
      gender,
      lastEdited: new Date().toISOString(),
      doneBy: 'ADMIN001'
    });
  }
  
  return employees;
};

const INITIAL_EMPLOYEES: Employee[] = generateSampleEmployees();

const INITIAL_HOLIDAYS: Holiday[] = [
  { id: 'H001', name: 'New Year', startDate: '2025-01-01', endDate: '2025-01-01', totalDays: 1, doneBy: 'ADMIN001' },
];

const INITIAL_USERS: User[] = [
  { id: 'ADMIN001', name: 'Admin', email: 'admin@lms.com', password: 'admin123', role: 'Admin', createdAt: new Date().toISOString() },
  { id: 'COADMIN001', name: 'CoAdmin', email: 'coadmin@lms.com', password: 'coadmin123', role: 'CoAdmin', createdAt: new Date().toISOString() },
];

// Storage Keys
const KEYS = {
  EMPLOYEES: 'lms_employees',
  HOLIDAYS: 'lms_holidays',
  LEAVE_TYPES: 'lms_leave_types',
  LEAVE_REQUESTS: 'lms_leave_requests',
  AUTH: 'lms_auth',
  USERS: 'lms_users',
  CURRENT_USER: 'lms_current_user',
};

export const calculateDays = (start: string, end: string): number => {
  const s = new Date(start);
  const e = new Date(end);
  const diffTime = Math.abs(e.getTime() - s.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  return diffDays + 1;
};

export const storage = {
  // Auth
  login: (userId: string) => {
    localStorage.setItem(KEYS.AUTH, 'true');
    localStorage.setItem(KEYS.CURRENT_USER, userId);
  },
  logout: () => {
    localStorage.removeItem(KEYS.AUTH);
    localStorage.removeItem(KEYS.CURRENT_USER);
  },
  isAuthenticated: () => {
    return localStorage.getItem(KEYS.AUTH) === 'true';
  },
  getCurrentUser: (): User | null => {
    const userId = localStorage.getItem(KEYS.CURRENT_USER);
    if (!userId) return null;
    const users = storage.getUsers();
    return users.find(u => u.id === userId) || null;
  },
  getCurrentUserId: (): string => {
    return localStorage.getItem(KEYS.CURRENT_USER) || '';
  },

  // Users
  getUsers: (): User[] => {
    const data = localStorage.getItem(KEYS.USERS);
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e) {
        localStorage.removeItem(KEYS.USERS);
        return INITIAL_USERS;
      }
    }
    return INITIAL_USERS;
  },
  initializeUsers: () => {
    const data = localStorage.getItem(KEYS.USERS);
    if (!data) {
      localStorage.setItem(KEYS.USERS, JSON.stringify(INITIAL_USERS));
    }
  },
  saveUser: (user: User) => {
    const users = storage.getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  },
  deleteUser: (id: string) => {
    const users = storage.getUsers().filter(u => u.id !== id);
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    
    const adminUser = users.find(u => u.role === 'Admin');
    const adminId = adminUser?.id || 'ADMIN001';
    
    const employees = storage.getEmployees();
    employees.forEach(emp => {
      if (emp.doneBy === id) {
        emp.doneBy = adminId;
      }
    });
    localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(employees));
    
    const leaveRequests = storage.getLeaveRequests();
    leaveRequests.forEach(req => {
      if (req.doneBy === id) {
        req.doneBy = adminId;
      }
      if (req.updatedBy === id) {
        req.updatedBy = adminId;
      }
    });
    localStorage.setItem(KEYS.LEAVE_REQUESTS, JSON.stringify(leaveRequests));
    
    const leaveTypes = storage.getLeaveTypes();
    leaveTypes.forEach(lt => {
      if (lt.doneBy === id) {
        lt.doneBy = adminId;
      }
    });
    localStorage.setItem(KEYS.LEAVE_TYPES, JSON.stringify(leaveTypes));
    
    const holidays = storage.getHolidays();
    holidays.forEach(h => {
      if (h.doneBy === id) {
        h.doneBy = adminId;
      }
    });
    localStorage.setItem(KEYS.HOLIDAYS, JSON.stringify(holidays));
  },
  generateUserId: (): string => {
    const users = storage.getUsers();
    const count = users.filter(u => u.role === 'CoAdmin').length + 1;
    return `COADMIN${String(count).padStart(3, '0')}`;
  },

  // Employees
  getEmployees: (): Employee[] => {
    const data = localStorage.getItem(KEYS.EMPLOYEES);
    return data ? JSON.parse(data) : INITIAL_EMPLOYEES;
  },
  saveEmployee: (employee: Employee) => {
    const employees = storage.getEmployees();
    const index = employees.findIndex(e => e.id === employee.id);
    if (index >= 0) {
      employees[index] = { ...employee, lastEdited: new Date().toISOString() };
    } else {
      employees.push({ ...employee, lastEdited: new Date().toISOString() });
    }
    localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(employees));
  },
  deleteEmployee: (id: string) => {
    const employees = storage.getEmployees().filter(e => e.id !== id);
    localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(employees));
  },
  generateEmployeeId: (): string => {
    const employees = storage.getEmployees();
    const count = employees.length + 1;
    return `EMP${String(count).padStart(3, '0')}`;
  },

  // Holidays
  getHolidays: (): Holiday[] => {
    const data = localStorage.getItem(KEYS.HOLIDAYS);
    return data ? JSON.parse(data) : INITIAL_HOLIDAYS;
  },
  saveHoliday: (holiday: Holiday) => {
    const holidays = storage.getHolidays();
    const index = holidays.findIndex(h => h.id === holiday.id);
    if (index >= 0) {
      holidays[index] = holiday;
    } else {
      holidays.push(holiday);
    }
    localStorage.setItem(KEYS.HOLIDAYS, JSON.stringify(holidays));
  },
  deleteHoliday: (id: string) => {
    const holidays = storage.getHolidays().filter(h => h.id !== id);
    localStorage.setItem(KEYS.HOLIDAYS, JSON.stringify(holidays));
  },

  // Leave Types
  getLeaveTypes: (): LeaveType[] => {
    const data = localStorage.getItem(KEYS.LEAVE_TYPES);
    return data ? JSON.parse(data) : INITIAL_LEAVE_TYPES;
  },
  saveLeaveType: (leaveType: LeaveType) => {
    const types = storage.getLeaveTypes();
    const index = types.findIndex(t => t.id === leaveType.id);
    if (index >= 0) {
      types[index] = leaveType;
    } else {
      types.push(leaveType);
    }
    localStorage.setItem(KEYS.LEAVE_TYPES, JSON.stringify(types));
  },
  deleteLeaveType: (id: string) => {
    const types = storage.getLeaveTypes().filter(t => t.id !== id);
    localStorage.setItem(KEYS.LEAVE_TYPES, JSON.stringify(types));
  },

  // Leave Requests
  getLeaveRequests: (): LeaveRequest[] => {
    const data = localStorage.getItem(KEYS.LEAVE_REQUESTS);
    return data ? JSON.parse(data) : [];
  },
  saveLeaveRequest: (request: LeaveRequest) => {
    const requests = storage.getLeaveRequests();
    const index = requests.findIndex(r => r.id === request.id);
    if (index >= 0) {
      requests[index] = request;
    } else {
      requests.push(request);
    }
    localStorage.setItem(KEYS.LEAVE_REQUESTS, JSON.stringify(requests));
  },
  deleteLeaveRequest: (id: string) => {
    const requests = storage.getLeaveRequests().filter(r => r.id !== id);
    localStorage.setItem(KEYS.LEAVE_REQUESTS, JSON.stringify(requests));
  },

  // User name helper
  getUserName: (userId: string): string => {
    const user = storage.getUsers().find(u => u.id === userId);
    return user ? user.name : 'Unknown';
  },
  
  // Analytics Helpers
  getStats: () => {
    const employees = storage.getEmployees();
    const requests = storage.getLeaveRequests();
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const activeLeaves = requests.filter(r => {
      const start = new Date(r.startDate);
      const end = new Date(r.endDate);
      return today >= start && today <= end && r.status === 'Approved';
    });

    return {
      totalEmployees: employees.length,
      employeesOnLeave: activeLeaves.length,
      leaveTypeDistribution: requests.reduce((acc, curr) => {
        acc[curr.leaveTypeName] = (acc[curr.leaveTypeName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  },

  getEmployeeLeaveSummary: (employeeId: string) => {
    const requests = storage.getLeaveRequests().filter(r => r.employeeId === employeeId && r.status === 'Approved');
    const totalDays = requests.reduce((acc, curr) => acc + curr.approvedDays, 0);
    const leaveBreakdown = requests.reduce((acc, curr) => {
      const existing = acc.find(item => item.leaveType === curr.leaveTypeName);
      if (existing) {
        existing.days += curr.approvedDays;
        existing.records.push(curr);
      } else {
        acc.push({ leaveType: curr.leaveTypeName, days: curr.approvedDays, records: [curr] });
      }
      return acc;
    }, [] as Array<{ leaveType: string; days: number; records: LeaveRequest[] }>);

    return { totalDays, leaveBreakdown };
  }
};
