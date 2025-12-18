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
                <h3 className="text-lg font-semibold">Employee Leave Summary</h3>
            </div>
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/30">
                        <TableHead>Employee Name</TableHead>
                        <TableHead>Designation</TableHead>
                        <TableHead className="text-center border-l">Casual Leave (20 Max)</TableHead>
                        <TableHead className="text-center border-l">Total Leaves Taken</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {employees.map(emp => {
                        const cl = getCasualLeaveSummary(emp.id);
                        const total = getTotalLeaves(emp.id);
                        return (
                            <TableRow key={emp.id}>
                                <TableCell className="font-medium">{emp.name}</TableCell>
                                <TableCell className="text-muted-foreground text-sm">{emp.designation}</TableCell>
                                <TableCell className="p-0 border-l">
                                    <div className="flex h-full w-full">
                                        <div className="flex-1 p-2 text-center border-r bg-red-50/50 text-red-700">
                                            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Used</div>
                                            <div className="font-bold">{cl.used}</div>
                                        </div>
                                        <div className="flex-1 p-2 text-center bg-green-50/50 text-green-700">
                                            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Remaining</div>
                                            <div className="font-bold">{cl.remaining}</div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-center font-bold border-l">{total}</TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    </div>
  );
}
