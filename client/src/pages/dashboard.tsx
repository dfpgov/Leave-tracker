import { useState, useEffect } from "react";
import { storage } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Users, UserCheck, Clock } from "lucide-react";
import { useLocation } from "wouter";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const currentUser = storage.getCurrentUser();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    employeesOnLeave: 0,
    pendingLeaves: 0
  });
  const [employees, setEmployees] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    const s = storage.getStats();
    const allRequests = storage.getLeaveRequests();
    const pendingCount = allRequests.filter(r => r.status === 'Pending').length;
    setStats({
      totalEmployees: s.totalEmployees,
      employeesOnLeave: s.employeesOnLeave,
      pendingLeaves: pendingCount
    });
    setEmployees(storage.getEmployees());
    setRequests(allRequests);
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-none overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-white/90">
                      {currentUser?.role === 'Admin' ? 'Pending Leave Requests' : 'Under Pending'}
                    </CardTitle>
                    <Clock className="h-4 w-4 text-white/90" />
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="text-5xl font-bold text-white">{stats.pendingLeaves}</div>
                    {currentUser?.role === 'Admin' && (
                      <Button 
                        onClick={() => setLocation('/leave-requests')}
                        className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
                        variant="ghost"
                      >
                        Clear All Pending
                      </Button>
                    )}
                </CardContent>
            </Card>
            <Card className="border-none overflow-hidden" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-white/90">Total Employees</CardTitle>
                    <Users className="h-4 w-4 text-white/90" />
                </CardHeader>
                <CardContent>
                    <div className="text-5xl font-bold text-white">{stats.totalEmployees}</div>
                </CardContent>
            </Card>
            <Card className="border-none overflow-hidden" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-white/90">Employees on Leave</CardTitle>
                    <UserCheck className="h-4 w-4 text-white/90" />
                </CardHeader>
                <CardContent>
                    <div className="text-5xl font-bold text-white">{stats.employeesOnLeave}</div>
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
