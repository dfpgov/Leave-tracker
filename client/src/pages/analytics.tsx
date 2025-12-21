import { useState, useEffect } from "react";
import { storage } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from "date-fns";

export default function Analytics() {
  const [topLeaveTakers, setTopLeaveTakers] = useState<any[]>([]);
  const [monthlyLeaveData, setMonthlyLeaveData] = useState<any[]>([]);

  useEffect(() => {
    const requests = storage.getLeaveRequests().filter(r => r.status === 'Approved');
    const employees = storage.getEmployees();

    // Calculate top leave takers
    const leaveTotals: Record<string, { name: string; days: number }> = {};
    requests.forEach(r => {
      if (!leaveTotals[r.employeeId]) {
        const emp = employees.find(e => e.id === r.employeeId);
        leaveTotals[r.employeeId] = { name: emp?.name || 'Unknown', days: 0 };
      }
      leaveTotals[r.employeeId].days += r.approvedDays;
    });

    const sortedLeaveTakers = Object.values(leaveTotals)
      .sort((a, b) => b.days - a.days)
      .slice(0, 10);
    setTopLeaveTakers(sortedLeaveTakers);

    // Calculate monthly leave trends (last 12 months)
    const today = new Date();
    const twelveMonthsAgo = subMonths(today, 11);
    const months = eachMonthOfInterval({ start: twelveMonthsAgo, end: today });

    const monthlyData = months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const leavesInMonth = requests.filter(r => {
        const startDate = new Date(r.startDate);
        return startDate >= monthStart && startDate <= monthEnd;
      });

      const totalDays = leavesInMonth.reduce((acc, r) => acc + r.approvedDays, 0);
      const uniqueEmployees = new Set(leavesInMonth.map(r => r.employeeId)).size;

      return {
        month: format(month, "MMM yyyy"),
        shortMonth: format(month, "MMM"),
        totalDays,
        employees: uniqueEmployees,
        requests: leavesInMonth.length
      };
    });

    setMonthlyLeaveData(monthlyData);
  }, []);

  // Find peak month
  const peakMonth = monthlyLeaveData.reduce((max, curr) => 
    curr.totalDays > (max?.totalDays || 0) ? curr : max, 
    monthlyLeaveData[0]
  );

  return (
    <div className="space-y-6">
        <div>
            <h1 className="text-3xl font-bold font-heading">Analytics</h1>
            <p className="text-muted-foreground mt-1">Leave trends and insights</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Top Leave Takers</CardTitle>
                    <CardDescription>Employees with highest leave days taken</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[350px]">
                        {topLeaveTakers.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                No leave data available
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={topLeaveTakers}
                                    layout="vertical"
                                    margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                    <XAxis type="number" />
                                    <YAxis 
                                        type="category" 
                                        dataKey="name" 
                                        tick={{ fontSize: 12 }}
                                        width={80}
                                    />
                                    <Tooltip 
                                        formatter={(value: number) => [`${value} days`, 'Total Leave']}
                                        contentStyle={{ 
                                            backgroundColor: 'hsl(var(--card))', 
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: '8px'
                                        }}
                                    />
                                    <Bar 
                                        dataKey="days" 
                                        fill="hsl(var(--primary))" 
                                        radius={[0, 4, 4, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Monthly Leave Trends</CardTitle>
                    <CardDescription>
                        Leave days taken per month (Last 12 months)
                        {peakMonth && peakMonth.totalDays > 0 && (
                            <span className="block mt-1 text-primary font-medium">
                                Peak: {peakMonth.month} ({peakMonth.totalDays} days)
                            </span>
                        )}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[350px]">
                        {monthlyLeaveData.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                No leave data available
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={monthlyLeaveData}
                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis 
                                        dataKey="shortMonth" 
                                        tick={{ fontSize: 11 }}
                                    />
                                    <YAxis />
                                    <Tooltip 
                                        formatter={(value: number, name: string) => [
                                            `${value} ${name === 'totalDays' ? 'days' : name === 'employees' ? 'employees' : 'requests'}`,
                                            name === 'totalDays' ? 'Leave Days' : name === 'employees' ? 'Employees' : 'Requests'
                                        ]}
                                        labelFormatter={(label) => {
                                            const item = monthlyLeaveData.find(d => d.shortMonth === label);
                                            return item?.month || label;
                                        }}
                                        contentStyle={{ 
                                            backgroundColor: 'hsl(var(--card))', 
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: '8px'
                                        }}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="totalDays" 
                                        stroke="hsl(var(--primary))" 
                                        strokeWidth={2}
                                        dot={{ fill: 'hsl(var(--primary))' }}
                                        name="Leave Days"
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="employees" 
                                        stroke="hsl(var(--chart-2))" 
                                        strokeWidth={2}
                                        dot={{ fill: 'hsl(var(--chart-2))' }}
                                        name="Employees"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>

        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle>Leave Requests by Month</CardTitle>
                <CardDescription>Number of leave requests submitted each month</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px]">
                    {monthlyLeaveData.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            No leave data available
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={monthlyLeaveData}
                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis 
                                    dataKey="shortMonth" 
                                    tick={{ fontSize: 11 }}
                                />
                                <YAxis />
                                <Tooltip 
                                    formatter={(value: number) => [`${value} requests`, 'Leave Requests']}
                                    labelFormatter={(label) => {
                                        const item = monthlyLeaveData.find(d => d.shortMonth === label);
                                        return item?.month || label;
                                    }}
                                    contentStyle={{ 
                                        backgroundColor: 'hsl(var(--card))', 
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Bar 
                                    dataKey="requests" 
                                    fill="hsl(var(--chart-3))" 
                                    radius={[4, 4, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
