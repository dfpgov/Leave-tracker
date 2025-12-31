import { useState, useEffect } from "react";
import { firebaseService } from "@/lib/firebaseStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    pendingLeaves: 0
  });
  const [employees, setEmployees] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      const [allEmployees, allRequests, allHolidays] = await Promise.all([
        firebaseService.getEmployees(),
        firebaseService.getLeaveRequests(),
        firebaseService.getHolidays()
      ]);

      setEmployees(allEmployees);
      setRequests(allRequests);
      setHolidays(allHolidays);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const activeLeaves = allRequests.filter(r => {
        const start = parseDate(r.startDate);
        const end = parseDate(r.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        return today >= start && today <= end && r.status === 'Approved';
      });

      const pendingCount = allRequests.filter(r => r.status === 'Pending').length;

      setStats({
        totalEmployees: allEmployees.length,
        employeesOnLeave: activeLeaves.length,
        pendingLeaves: pendingCount
      });
    }
    loadData();
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Employees on leave today
  const getEmployeesOnLeave = () => {
    const onLeave = new Set<string>();
    requests.forEach(request => {
      if (request.status === 'Approved') {
        const startDate = parseDate(request.startDate);
        const endDate = parseDate(request.endDate);
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
        const leaveRequest = requests.find(
          r => r.employeeId === empId &&
               r.status === 'Approved' &&
               parseDate(r.startDate) <= today &&
               parseDate(r.endDate) >= today
        );
        return { employee: emp, leaveRequest };
      })
      .filter(item => item.employee);
  };

  // Upcoming holidays (next 5)
  const getUpcomingHolidays = () => {
    console.log("RAW holidays from DB:", holidays);

    if (!holidays || holidays.length === 0) {
      console.log("❌ No holidays found");
      return [];
    }

    const filtered = holidays.filter(h => {
      const holidayDate = parseDate(h.startDate || h.date); // handle both field names
      holidayDate.setHours(0, 0, 0, 0);
      console.log("Checking holiday:", h.name, holidayDate);
      return holidayDate >= today;
    });

    const sorted = filtered.sort(
      (a, b) => parseDate(a.startDate || a.date).getTime() - parseDate(b.startDate || b.date).getTime()
    );

    const sliced = sorted.slice(0, 5);
    console.log("Final upcomingHolidays (max 5):", sliced);
    return sliced;
  };

  // Upcoming leaves (next 7 days)
  const getUpcomingLeaves = () => {
    const nextWeek = addDays(today, 7);

    return requests
      .filter(r => {
        if (r.status !== 'Approved') return false;
        const startDate = parseDate(r.startDate);
        startDate.setHours(0, 0, 0, 0);
        return startDate > today && startDate <= nextWeek;
      })
      .sort((a, b) => parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime())
      .slice(0, 5);
  };

  const peopleOnLeave = getEmployeesOnLeave();
  const upcomingHolidays = getUpcomingHolidays();
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

      {/* Dashboard Title */}
      <div>
        <h1 className="text-3xl font-bold font-heading">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of leave records and employee status</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-none overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/90">
              {currentUser?.role === 'Admin' ? 'Pending Approved Leave' : 'Under Pending'}
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

      {/* People on Leave Table */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 sm:p-6 border-b">
          <h3 className="text-lg font-semibold">People on Leave Today</h3>
        </div>
        <div className="overflow-x-auto">
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
