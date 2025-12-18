import { useState, useEffect } from "react";
import { storage } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, UserCheck, Calendar, Clock } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

export default function Analytics() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    employeesOnLeave: 0,
    leaveTypeDistribution: {} as Record<string, number>
  });

  useEffect(() => {
    setStats(storage.getStats());
  }, []);

  const pieData = Object.entries(stats.leaveTypeDistribution).map(([name, value]) => ({
    name,
    value
  }));

  return (
    <div className="space-y-6">
        <div>
            <h1 className="text-3xl font-bold font-heading">Analytics Dashboard</h1>
            <p className="text-muted-foreground mt-1">Visual insights into workforce leave trends</p>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.totalEmployees}</div>
            <p className="text-xs text-muted-foreground">Active workforce</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Currently on Leave</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.employeesOnLeave}</div>
            <p className="text-xs text-muted-foreground">Absent today</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Holidays</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{storage.getHolidays().length}</div>
            <p className="text-xs text-muted-foreground">Scheduled this year</p>
          </CardContent>
        </Card>
         <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Requiring approval</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Leave Type Distribution</CardTitle>
            <CardDescription>Breakdown of leaves taken by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle>Department Leave Trends</CardTitle>
                <CardDescription>Leaves taken across departments</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Placeholder for Department Chart
                    {/* Requires aggregating data by department which is complex in this simple mock storage */}
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
