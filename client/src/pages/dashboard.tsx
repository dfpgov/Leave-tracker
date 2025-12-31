import { useState, useEffect } from "react";
import { firebaseService } from "@/lib/firebaseStorage";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableHead as TableHeadCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { isAfter, isBefore, addDays } from "date-fns";
import { Users, UserCheck, Clock, Calendar, CalendarDays } from "lucide-react";
import { useLocation } from "wouter";
import { parseDate, safeFormat } from "@/lib/dateUtils";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const currentUser = firebaseService.getCurrentUser();

  const [stats, setStats] = useState({
    totalEmployees: 0,
    employeesOnLeave: 0,
    pendingLeaves: 0,
  });
  const [employees, setEmployees] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      const [allEmployees, allRequests, allHolidays] = await Promise.all([
        firebaseService.getEmployees(),
        firebaseService.getLeaveRequests(),
        firebaseService.getHolidays(),
      ]);

      setEmployees(allEmployees);
      setRequests(allRequests);
      setHolidays(allHolidays);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const activeLeaves = allRequests.filter((r) => {
        const start = parseDate(r.startDate);
        const end = parseDate(r.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        return today >= start && today <= end && r.status === "Approved";
      });

      const pendingCount = allRequests.filter((r) => r.status === "Pending").length;

      setStats({
        totalEmployees: allEmployees.length,
        employeesOnLeave: activeLeaves.length,
        pendingLeaves: pendingCount,
      });
    }

    loadData();
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // --- Employees on leave today ---
  const getEmployeesOnLeave = () => {
    const approvedLeavesToday = requests.filter((r) => {
      if (r.status !== "Approved") return false;
      const start = new Date(r.startDate);
      const end = new Date(r.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return today >= start && today <= end;
    });

    const result = approvedLeavesToday.map((leave) => {
      const emp = employees.find((e) => e.id === leave.employeeId);
      if (!emp) return null;
      return { employee: emp, leaveRequest: leave };
    });

    return result.filter(Boolean) as { employee: any; leaveRequest: any }[];
  };

  const peopleOnLeave = getEmployeesOnLeave();

  // --- Upcoming holidays ---
  const getUpcomingHolidays = () => {
    if (!holidays || holidays.length === 0) return [];

    const filtered = holidays.filter((holiday) => {
      const date = new Date(holiday.startDate || holiday.date);
      date.setHours(0, 0, 0, 0);
      return date >= today;
    });

    const sorted = filtered.sort(
      (a, b) =>
        new Date(a.startDate || a.date).getTime() -
        new Date(b.startDate || b.date).getTime()
    );

    return sorted.slice(0, 5);
  };

  const upcomingHolidays = getUpcomingHolidays();

  // --- Upcoming leaves next 7 days ---
  const getUpcomingLeaves = () => {
    const nextWeek = addDays(today, 7);
    return requests
      .filter((r) => {
        if (r.status !== "Approved") return false;
        const startDate = new Date(r.startDate);
        startDate.setHours(0, 0, 0, 0);
        return isAfter(startDate, today) && isBefore(startDate, nextWeek);
      })
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 5);
  };

  const upcomingLeaves = getUpcomingLeaves();

  return (
    <div className="space-y-6">
      {/* Cover Image */}
      <div className="w-full overflow-hidden h-[85px] rounded-[5px] md:h-[250px] md:rounded-[10px]">
        <img
          src="https://raw.githubusercontent.com/dfpgov/Leave-tracker/main/client/public/dfp-cover.png"
          alt="Dashboard Cover"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Dashboard Heading */}
      <div>
        <h1 className="text-3xl font-bold font-heading">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of leave records and employee status
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className="border-none overflow-hidden relative"
          style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/90">
              {currentUser?.role === "Admin" ? "Pending Approved Leave" : "Under Pending"}
            </CardTitle>
            <Clock className="h-4 w-4 text-white/90" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-5xl font-bold text-white">{stats.pendingLeaves}</div>
            {currentUser?.role === "Admin" && (
              <Button
                onClick={() => setLocation("/leave-requests")}
                className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
                variant="ghost"
              >
                Clear All Pending
              </Button>
            )}
          </CardContent>
        </Card>

        <Card
          className="border-none overflow-hidden"
          style={{ background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)" }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/90">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-white/90" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-white">{stats.totalEmployees}</div>
          </CardContent>
        </Card>

        <Card
          className="border-none overflow-hidden"
          style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/90">Employees on Leave</CardTitle>
            <UserCheck className="h-4 w-4 text-white/90" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-white">{stats.employeesOnLeave}</div>
          </CardContent>
        </Card>
      </div>

      {/* People on Leave Table */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 sm:p-6 border-b">
          <h3 className="text-lg font-semibold">People on Leave Today</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHeadCell>Employee Name</TableHeadCell>
                <TableHeadCell>Designation</TableHeadCell>
                <TableHeadCell>Section</TableHeadCell>
                <TableHeadCell>Leave Type</TableHeadCell>
                <TableHeadCell className="text-center">Leave Period</TableHeadCell>
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
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{employee.designation}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{employee.department}</TableCell>
                    <TableCell className="rounded text-xs font-medium bg-blue-100 text-blue-800">{leaveRequest?.leaveTypeName}</TableCell>
                    <TableCell className="text-center text-sm">
                      {leaveRequest
                        ? `${safeFormat(leaveRequest.startDate, "MMM d")} – ${safeFormat(leaveRequest.endDate, "MMM d, yyyy")}`
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Upcoming Holidays & Leaves */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Upcoming Holidays</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Next scheduled holidays</p>
            </div>
            <Calendar className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            {upcomingHolidays.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground text-sm">No upcoming holidays</p>
            ) : (
              <div className="space-y-3">
                {upcomingHolidays.map((holiday, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{holiday.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {safeFormat(holiday.startDate || holiday.date, "EEEE")}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-primary">
                      {safeFormat(holiday.startDate || holiday.date, "MMM d, yyyy")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Upcoming Leaves</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Employees on leave next 7 days</p>
            </div>
            <CalendarDays className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            {upcomingLeaves.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground text-sm">No upcoming leaves</p>
            ) : (
              <div className="space-y-3">
                {upcomingLeaves.map((leave, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <p className="font-medium">{leave.employeeName}</p>
                      <p className="text-sm text-muted-foreground">
                        {leave.leaveTypeName} - {leave.approvedDays} days
                      </p>
                    </div>
                    <span className="text-sm font-medium text-orange-600">{safeFormat(leave.startDate, "MMM d")}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
