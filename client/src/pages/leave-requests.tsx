import { useState, useEffect } from "react";
import { storage, LeaveRequest, Employee, LeaveType, calculateDays } from "@/lib/storage";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Filter, Search, Bold, Italic, List, Paperclip } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const requestSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  leaveTypeId: z.string().min(1, "Leave type is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  comments: z.string().optional(),
  attachment: z.any().optional(),
});

export default function LeaveRequests() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const form = useForm<z.infer<typeof requestSchema>>({
    resolver: zodResolver(requestSchema),
  });

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setRequests(storage.getLeaveRequests());
    setEmployees(storage.getEmployees());
    setLeaveTypes(storage.getLeaveTypes());
  };

  const onSubmit = (values: z.infer<typeof requestSchema>) => {
    const employee = employees.find(e => e.id === values.employeeId);
    const leaveType = leaveTypes.find(t => t.id === values.leaveTypeId);

    if (!employee || !leaveType) return;

    // Validation: Casual Leave max 20 days check
    const requestedDays = calculateDays(values.startDate, values.endDate);
    
    if (leaveType.name === "Casual Leave" && leaveType.maxDays) {
       const usedDays = requests
         .filter(r => r.employeeId === employee.id && r.leaveTypeName === "Casual Leave" && r.status === 'Approved')
         .reduce((acc, curr) => acc + curr.approvedDays, 0);
         
       if (usedDays + requestedDays > leaveType.maxDays) {
         toast({
           title: "Limit Exceeded",
           description: `Cannot approve request. ${employee.name} has already used ${usedDays} Casual Leave days. Limit is ${leaveType.maxDays}.`,
           variant: "destructive"
         });
         return;
       }
    }

    const newRequest: LeaveRequest = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: employee.id,
      employeeName: employee.name,
      designation: employee.designation,
      department: employee.department,
      leaveTypeId: leaveType.id,
      leaveTypeName: leaveType.name,
      startDate: values.startDate,
      endDate: values.endDate,
      approvedDays: requestedDays,
      comments: values.comments || "",
      status: "Approved", 
      timestamp: new Date().toISOString(),
    };

    storage.saveLeaveRequest(newRequest);
    refreshData();
    setIsDialogOpen(false);
    form.reset();
    toast({
      title: "Leave Request Logged",
      description: "Request added successfully.",
    });
  };

  const filteredRequests = requests.filter(r => 
    r.employeeName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold font-heading">Leave Request Log</h1>
            <p className="text-muted-foreground mt-1">Track and manage employee time off</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" /> New Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Log Leave Request</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employee</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Employee" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employees.map(e => (
                            <SelectItem key={e.id} value={e.id}>{e.name} ({e.department})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="leaveTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Leave Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {leaveTypes.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                            <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                            <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                
                {/* File Attachment */}
                <FormField
                    control={form.control}
                    name="attachment"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Attachment</FormLabel>
                            <FormControl>
                                <div className="flex items-center gap-2">
                                    <Input type="file" className="cursor-pointer file:text-foreground" {...field} value={undefined} onChange={(e) => field.onChange(e.target.files)} />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="comments"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Comments</FormLabel>
                        <FormControl>
                            <div className="border rounded-md focus-within:ring-1 focus-within:ring-ring">
                                <div className="flex items-center gap-1 p-1 border-b bg-muted/20">
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7"><Bold className="h-3 w-3" /></Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7"><Italic className="h-3 w-3" /></Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7"><List className="h-3 w-3" /></Button>
                                </div>
                                <Textarea 
                                    placeholder="Reason for leave..." 
                                    className="border-0 focus-visible:ring-0 resize-none min-h-[80px]" 
                                    {...field} 
                                />
                            </div>
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                <Button type="submit" className="w-full">Submit Request</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-4">
           <div className="relative flex-1 max-w-sm">
             <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
             <Input 
                placeholder="Search by employee name..." 
                className="pl-9 bg-muted/30" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
             />
           </div>
           <Button variant="outline" size="sm">
               <Filter className="mr-2 h-4 w-4" /> Filter Date
           </Button>
        </div>
        <Table>
            <TableHeader>
            <TableRow className="bg-muted/30">
                <TableHead>Employee Details</TableHead>
                <TableHead>Leave Type</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Comments</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {filteredRequests.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        No leave requests found.
                    </TableCell>
                </TableRow>
            ) : (
                filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                    <TableCell>
                        <div className="flex flex-col">
                            <span className="font-medium text-foreground">{request.employeeName}</span>
                            <span className="text-xs text-muted-foreground">{request.designation} • {request.department}</span>
                        </div>
                    </TableCell>
                    <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                            {request.leaveTypeName}
                        </span>
                    </TableCell>
                    <TableCell className="text-sm">
                        {format(new Date(request.startDate), "MMM d")} - {format(new Date(request.endDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="font-medium">{request.approvedDays}</TableCell>
                    <TableCell>
                         <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600">
                            {request.status}
                        </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate" title={request.comments}>
                        {request.comments || "-"}
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
