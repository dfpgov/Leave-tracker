import { format } from "date-fns";

// Types
export interface Employee {
  id: string;
  name: string;
  designation: string;
  department: string;
  gender: 'Male' | 'Female' | 'Other';
  lastEdited: string;
}

export interface Holiday {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  totalDays: number;
}

export interface LeaveType {
  id: string;
  name: string;
  maxDays: number | null; // null means no limit
}

export interface LeaveRequest {
  id: string;
  employeeId: string; // Linking to Employee ID
  employeeName: string; // Storing snapshot for simplicity as per req (name + des + dept)
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
  attachmentFileName?: string; // Name of the attached file
}

// Initial Data Seeds
const INITIAL_LEAVE_TYPES: LeaveType[] = [
  { id: 'LT001', name: 'Casual Leave', maxDays: 20 },
  { id: 'LT002', name: 'Sick Leave', maxDays: 10 },
  { id: 'LT003', name: 'Earned Leave', maxDays: null },
];

const INITIAL_EMPLOYEES: Employee[] = [
  { id: 'EMP001', name: 'John Doe', designation: 'Software Engineer', department: 'IT', gender: 'Male', lastEdited: new Date().toISOString() },
  { id: 'EMP002', name: 'Jane Smith', designation: 'HR Manager', department: 'HR', gender: 'Female', lastEdited: new Date().toISOString() },
];

const INITIAL_HOLIDAYS: Holiday[] = [
  { id: 'H001', name: 'New Year', startDate: '2025-01-01', endDate: '2025-01-01', totalDays: 1 },
];

// Storage Keys
const KEYS = {
  EMPLOYEES: 'lms_employees',
  HOLIDAYS: 'lms_holidays',
  LEAVE_TYPES: 'lms_leave_types',
  LEAVE_REQUESTS: 'lms_leave_requests',
  AUTH: 'lms_auth',
};

// Helper to calculate days between dates (inclusive)
export const calculateDays = (start: string, end: string): number => {
  const s = new Date(start);
  const e = new Date(end);
  const diffTime = Math.abs(e.getTime() - s.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  return diffDays + 1; // Inclusive
};

// Storage Service
export const storage = {
  // Auth
  login: () => {
    localStorage.setItem(KEYS.AUTH, 'true');
  },
  logout: () => {
    localStorage.removeItem(KEYS.AUTH);
  },
  isAuthenticated: () => {
    return localStorage.getItem(KEYS.AUTH) === 'true';
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
  
  // Analytics Helpers
  getStats: () => {
    const employees = storage.getEmployees();
    const requests = storage.getLeaveRequests();
    
    // Employees currently on leave (today is between start and end)
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

  // Employee Leave Summary
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
