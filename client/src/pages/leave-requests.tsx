import { useState, useEffect, useRef } from "react";
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
import { Plus, Filter, Search, Bold, Italic, List, Download, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import jsPDF from "jspdf";

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
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [employeeFilterId, setEmployeeFilterId] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof requestSchema>>({
    resolver: zodResolver(requestSchema),
  });

  useEffect(() => {
    refreshData();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowEmployeeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  // Filter employees by search term
  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(employeeSearchTerm.toLowerCase())
  );

  // Apply all filters to requests
  const filteredRequests = requests.filter(r => {
    const matchesSearch = r.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEmployee = !employeeFilterId || r.employeeId === employeeFilterId;
    
    let matchesDateRange = true;
    if (startDateFilter || endDateFilter) {
      const reqStart = new Date(r.startDate);
      const reqEnd = new Date(r.endDate);
      const filterStart = startDateFilter ? new Date(startDateFilter) : null;
      const filterEnd = endDateFilter ? new Date(endDateFilter) : null;
      
      if (filterStart && reqEnd < filterStart) matchesDateRange = false;
      if (filterEnd && reqStart > filterEnd) matchesDateRange = false;
    }
    
    return matchesSearch && matchesEmployee && matchesDateRange;
  });

  // PDF Download Handler
  const downloadPDF = () => {
    if (filteredRequests.length === 0) {
      toast({
        title: "No Data",
        description: "No leave requests to download.",
        variant: "destructive"
      });
      return;
    }

    try {
      const doc = new jsPDF();
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPosition = 10;

      // Title
      doc.setFontSize(16);
      doc.text("Leave Request Report", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 10;

      // Date range info
      doc.setFontSize(10);
      const filterInfo = [];
      if (startDateFilter) filterInfo.push(`From: ${startDateFilter}`);
      if (endDateFilter) filterInfo.push(`To: ${endDateFilter}`);
      if (employeeFilterId) {
        const emp = employees.find(e => e.id === employeeFilterId);
        if (emp) filterInfo.push(`Employee: ${emp.name}`);
      }
      if (filterInfo.length > 0) {
        doc.text(filterInfo.join(" | "), pageWidth / 2, yPosition, { align: "center" });
        yPosition += 5;
      }
      doc.text(`Generated: ${format(new Date(), "PPP p")}`, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 8;

      // Table headers
      const headers = ["Employee", "Leave Type", "Start Date", "End Date", "Days", "Status"];
      const columnWidths = [35, 25, 25, 25, 15, 20];
      const startX = 10;

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      let xPosition = startX;
      headers.forEach((header, index) => {
        doc.text(header, xPosition, yPosition, { maxWidth: columnWidths[index] - 1 });
        xPosition += columnWidths[index];
      });

      yPosition += 6;
      doc.setDrawColor(0);
      doc.line(startX, yPosition, pageWidth - 10, yPosition);
      yPosition += 4;

      // Table rows
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);

      filteredRequests.forEach((request) => {
        // Check if we need a new page
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = 10;
        }

        const rowData = [
          request.employeeName,
          request.leaveTypeName,
          format(new Date(request.startDate), "MMM d, yyyy"),
          format(new Date(request.endDate), "MMM d, yyyy"),
          request.approvedDays.toString(),
          request.status
        ];

        xPosition = startX;
        rowData.forEach((cell, index) => {
          doc.text(cell.toString(), xPosition, yPosition, { maxWidth: columnWidths[index] - 1 });
          xPosition += columnWidths[index];
        });
        yPosition += 5;
      });

      // Footer
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.text(`Total Records: ${filteredRequests.length}`, startX, pageHeight - 10);

      doc.save("leave-report.pdf");
      toast({
        title: "Download Started",
        description: "Leave report downloaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate PDF.",
        variant: "destructive"
      });
    }
  };

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
        <div className="p-4 border-b flex flex-col sm:flex-row items-start sm:items-center gap-3">
           <div className="relative flex-1 max-w-sm">
             <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
             <Input 
                placeholder="Search by employee name..." 
                className="pl-9 bg-muted/30" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-name"
             />
           </div>

           {/* Employee Filter Dropdown */}
           <div className="relative w-full sm:w-64" ref={dropdownRef}>
             <div 
               className="relative border rounded-md bg-muted/30 cursor-pointer"
               onClick={() => setShowEmployeeDropdown(!showEmployeeDropdown)}
             >
               <Input
                 type="text"
                 placeholder="Filter by employee..."
                 value={employeeSearchTerm}
                 onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                 onClick={() => setShowEmployeeDropdown(true)}
                 className="bg-transparent border-0 pr-8"
                 data-testid="input-filter-employee"
               />
               <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                 {employeeFilterId ? (
                   <button
                     onClick={(e) => {
                       e.stopPropagation();
                       setEmployeeFilterId("");
                       setEmployeeSearchTerm("");
                     }}
                     className="hover:text-foreground"
                   >
                     <X className="h-4 w-4" />
                   </button>
                 ) : (
                   <Search className="h-4 w-4" />
                 )}
               </div>
             </div>

             {showEmployeeDropdown && (
               <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                 {filteredEmployees.length === 0 ? (
                   <div className="p-3 text-sm text-muted-foreground text-center">No employees found</div>
                 ) : (
                   filteredEmployees.map((emp) => (
                     <div
                       key={emp.id}
                       className="px-3 py-2 cursor-pointer hover:bg-muted/50 text-sm border-b last:border-b-0 transition-colors"
                       onClick={() => {
                         setEmployeeFilterId(emp.id);
                         setEmployeeSearchTerm("");
                         setShowEmployeeDropdown(false);
                       }}
                       data-testid={`option-employee-${emp.id}`}
                     >
                       <div className="font-medium">{emp.name}</div>
                       <div className="text-xs text-muted-foreground">{emp.designation} • {emp.department}</div>
                     </div>
                   ))
                 )}
               </div>
             )}
           </div>

           {/* Date Filter Dialog */}
           <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
             <DialogTrigger asChild>
               <Button variant="outline" size="sm" data-testid="button-filter-date">
                   <Filter className="mr-2 h-4 w-4" /> Filter Date
               </Button>
             </DialogTrigger>
             <DialogContent>
               <DialogHeader>
                 <DialogTitle>Filter by Date Range</DialogTitle>
               </DialogHeader>
               <div className="space-y-4">
                 <div>
                   <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Start Date</label>
                   <Input 
                     type="date"
                     value={startDateFilter}
                     onChange={(e) => setStartDateFilter(e.target.value)}
                     data-testid="input-filter-start-date"
                     className="mt-1.5"
                   />
                 </div>
                 <div>
                   <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">End Date</label>
                   <Input 
                     type="date"
                     value={endDateFilter}
                     onChange={(e) => setEndDateFilter(e.target.value)}
                     data-testid="input-filter-end-date"
                     className="mt-1.5"
                   />
                 </div>
                 <div className="flex gap-2">
                   <Button 
                     variant="outline"
                     className="flex-1"
                     onClick={() => {
                       setStartDateFilter("");
                       setEndDateFilter("");
                     }}
                     data-testid="button-clear-filters"
                   >
                     Clear Filters
                   </Button>
                   <Button 
                     className="flex-1"
                     onClick={() => setIsFilterDialogOpen(false)}
                     data-testid="button-apply-filters"
                   >
                     Apply
                   </Button>
                 </div>
               </div>
             </DialogContent>
           </Dialog>

           {/* PDF Download Button */}
           <Button 
             variant="outline" 
             size="sm"
             onClick={downloadPDF}
             data-testid="button-download-pdf"
           >
             <Download className="mr-2 h-4 w-4" /> Download Report
           </Button>
        </div>

        {/* Active Filters Display */}
        {(employeeFilterId || startDateFilter || endDateFilter) && (
          <div className="px-4 py-2 bg-muted/20 border-b flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Filters:</span>
            {employeeFilterId && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs">
                {employees.find(e => e.id === employeeFilterId)?.name}
                <button onClick={() => setEmployeeFilterId("")} className="hover:text-primary/70">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {startDateFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs">
                From {startDateFilter}
                <button onClick={() => setStartDateFilter("")} className="hover:text-primary/70">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {endDateFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs">
                To {endDateFilter}
                <button onClick={() => setEndDateFilter("")} className="hover:text-primary/70">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        )}

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
                            <span className="font-medium text-foreground" data-testid={`text-employee-${request.id}`}>{request.employeeName}</span>
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
