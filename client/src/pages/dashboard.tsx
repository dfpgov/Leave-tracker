import { useState, useEffect } from "react";
import { storage } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Users, UserCheck } from "lucide-react";

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    employeesOnLeave: 0
  });
  const [employees, setEmployees] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    const s = storage.getStats();
    setStats({
      totalEmployees: s.totalEmployees,
      employeesOnLeave: s.employeesOnLeave
    });
    setEmployees(storage.getEmployees());
    setRequests(storage.getLeaveRequests());
  }, []);

  // Compute casual leave summary
  const getCasualLeaveSummary = (employeeId: string) => {
    const used = requests
      .filter(r => r.employeeId === employeeId && r.leaveTypeName === 'Casual Leave')
      .reduce((acc, curr) => acc + curr.approvedDays, 0);
    const limit = 20; // Hardcoded requirement
    return { used, remaining: Math.max(0, limit - used) };
  };

  const getTotalLeaves = (employeeId: string) => {
      return requests
      .filter(r => r.employeeId === employeeId)
      .reduce((acc, curr) => acc + curr.approvedDays, 0);
  }

  // Get employees currently on leave
  const getEmployeesOnLeave = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const onLeave = new Set<string>();
    requests.forEach(request => {
      if (request.status === 'Approved') {
        const startDate = new Date(request.startDate);
        const endDate = new Date(request.endDate);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        
        if (today >= startDate && today <= endDate) {
          onLeave.add(request.employeeId);
        }
      }
    });
    
    return Array.from(onLeave)
      .map(empId => {
        const emp = employees.find(e => e.id === empId);
        const leaveRequest = requests.find(r => r.employeeId === empId && r.status === 'Approved' && new Date(r.startDate) <= today && new Date(r.endDate) >= today);
        return { employee: emp, leaveRequest };
      })
      .filter(item => item.employee);
  };

  const peopleOnLeave = getEmployeesOnLeave();

  return (
    <div className="space-y-6">
        <div>
            <h1 className="text-3xl font-bold font-heading">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Overview of leave records and employee status</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <Card className="bg-primary text-primary-foreground border-none">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-primary-foreground/90">Total Employees</CardTitle>
                    <Users className="h-4 w-4 text-primary-foreground/90" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold">{stats.totalEmployees}</div>
                </CardContent>
            </Card>
             <Card className="bg-accent text-accent-foreground border-none">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-accent-foreground/90">Employees on Leave</CardTitle>
                    <UserCheck className="h-4 w-4 text-accent-foreground/90" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold">{stats.employeesOnLeave}</div>
                </CardContent>
            </Card>
        </div>

        <div className="bg-card rounded-xl border shadow-sm">
            <div className="p-6 border-b">
                <h3 className="text-lg font-semibold">People on Leave Today</h3>
            </div>
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/30">
                        <TableHead>Employee Name</TableHead>
                        <TableHead>Designation</TableHead>
                        <TableHead>Section</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead className="text-center">Leave Period</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {peopleOnLeave.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                No one is on leave today
                            </TableCell>
                        </TableRow>
                    ) : (
                        peopleOnLeave.map(({ employee, leaveRequest }) => (
                            <TableRow key={employee?.id}>
                                <TableCell className="font-medium">{employee?.name}</TableCell>
                                <TableCell className="text-muted-foreground text-sm">{employee?.designation}</TableCell>
                                <TableCell className="text-muted-foreground text-sm">{employee?.department}</TableCell>
                                <TableCell>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                        {leaveRequest?.leaveTypeName}
                                    </span>
                                </TableCell>
                                <TableCell className="text-center text-sm">
                                    {format(new Date(leaveRequest?.startDate), "MMM d")} - {format(new Date(leaveRequest?.endDate), "MMM d, yyyy")}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    </div>
  );
}
