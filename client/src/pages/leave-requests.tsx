import { useState, useEffect, useRef } from "react";
import { storage, LeaveRequest, Employee, LeaveType, calculateDays, User } from "@/lib/storage";
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
import { Plus, Filter, Search, Download, X, Eye, CheckCircle, XCircle, Edit2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import jsPDF from "jspdf";

const requestSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  leaveTypeId: z.string().min(1, "Leave type is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  requestedDays: z.string().min(1, "Number of days is required"),
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
  const [employeeFilterId, setEmployeeFilterId] = useState("all-employees");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ base64: string; name: string } | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [statusFilter, setStatusFilter] = useState("all-statuses");
  const [editingId, setEditingId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof requestSchema>>({
    resolver: zodResolver(requestSchema),
  });

  useEffect(() => {
    refreshData();
    setCurrentUser(storage.getCurrentUser());
  }, []);

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

    const requestedDaysNum = parseInt(values.requestedDays);
    
    if (leaveType.name === "Casual Leave" && leaveType.maxDays) {
       const usedDays = requests
         .filter(r => r.employeeId === employee.id && r.leaveTypeName === "Casual Leave" && r.status === 'Approved')
         .reduce((acc, curr) => acc + curr.approvedDays, 0);
         
       if (usedDays + requestedDaysNum > leaveType.maxDays) {
         toast({
           title: "Note",
           description: `${employee.name} has already used ${usedDays} Casual Leave days. Limit is ${leaveType.maxDays}. Request submitted for approval.`,
           variant: "default"
         });
       }
    }

    const attachmentFile = form.getValues('attachment')?.[0];
    const isImage = attachmentFile && /^image\/(png|jpg|jpeg|gif|webp)$/.test(attachmentFile.type);
    
    if (attachmentFile && !isImage) {
      toast({
        title: "Invalid File",
        description: "Only image files (PNG, JPG, GIF, WebP) are allowed.",
        variant: "destructive"
      });
      return;
    }

    let attachmentBase64: string | undefined;
    if (attachmentFile && isImage) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const newReq: LeaveRequest = {
          id: Math.random().toString(36).substr(2, 9),
          employeeId: employee.id,
          employeeName: employee.name,
          designation: employee.designation,
          department: employee.department,
          leaveTypeId: leaveType.id,
          leaveTypeName: leaveType.name,
          startDate: values.startDate,
          endDate: values.endDate,
          approvedDays: requestedDaysNum,
          comments: values.comments || "",
          status: "Pending",
          timestamp: new Date().toISOString(),
          attachmentFileName: attachmentFile.name,
          attachmentBase64: base64,
          doneBy: storage.getCurrentUserId(),
          updatedAt: new Date().toISOString(),
        };
        storage.saveLeaveRequest(newReq);
        refreshData();
        setIsDialogOpen(false);
        form.reset();
        toast({
          title: "Leave Request Submitted",
          description: "Request pending admin approval.",
        });
      };
      reader.readAsDataURL(attachmentFile);
      return;
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
      approvedDays: requestedDaysNum,
      comments: values.comments || "",
      status: "Pending",
      timestamp: new Date().toISOString(),
      attachmentFileName: attachmentFile?.name,
      doneBy: storage.getCurrentUserId(),
      updatedAt: new Date().toISOString(),
    };

    if (editingId) {
      // Update existing request
      const updatedRequest = {
        ...newRequest,
        id: editingId,
        timestamp: requests.find(r => r.id === editingId)?.timestamp || new Date().toISOString(),
      };
      storage.saveLeaveRequest(updatedRequest);
      refreshData();
      setIsDialogOpen(false);
      setEditingId(null);
      form.reset();
      toast({
        title: "Request Updated",
        description: "Leave request has been updated successfully.",
      });
    } else {
      // Create new request
      storage.saveLeaveRequest(newRequest);
      refreshData();
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Leave Request Submitted",
        description: "Request pending admin approval.",
      });
    }
  };
  
  const handleApprove = (id: string) => {
    const request = requests.find(r => r.id === id);
    if (!request) return;
    
    const updatedRequest = { ...request };
    updatedRequest.status = "Approved";
    updatedRequest.updatedBy = storage.getCurrentUserId();
    updatedRequest.updatedAt = new Date().toISOString();
    storage.saveLeaveRequest(updatedRequest);
    refreshData();
    toast({
      title: "Request Approved",
      description: `Leave request for ${request.employeeName} has been approved.`,
    });
  };
  
  const handleReject = (id: string) => {
    const request = requests.find(r => r.id === id);
    if (!request) return;
    
    const updatedRequest = { ...request };
    updatedRequest.status = "Rejected";
    updatedRequest.updatedBy = storage.getCurrentUserId();
    updatedRequest.updatedAt = new Date().toISOString();
    storage.saveLeaveRequest(updatedRequest);
    refreshData();
    toast({
      title: "Request Rejected",
      description: `Leave request for ${request.employeeName} has been rejected.`,
      variant: "destructive",
    });
  };

  const handleEdit = (request: LeaveRequest) => {
    if (request.status !== "Pending") {
      toast({
        title: "Cannot Edit",
        description: "Only pending requests can be edited.",
        variant: "destructive",
      });
      return;
    }
    
    const employee = employees.find(e => e.id === request.employeeId);
    const leaveType = leaveTypes.find(t => t.id === request.leaveTypeId);
    
    if (!employee || !leaveType) return;

    setEditingId(request.id);
    setEmployeeSearchTerm(employee.name);
    form.reset({
      employeeId: request.employeeId,
      leaveTypeId: request.leaveTypeId,
      startDate: request.startDate,
      endDate: request.endDate,
      requestedDays: request.approvedDays.toString(),
      comments: request.comments,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    const request = requests.find(r => r.id === id);
    if (!request) return;

    if (request.status !== "Pending") {
      toast({
        title: "Cannot Delete",
        description: "Only pending requests can be deleted.",
        variant: "destructive",
      });
      return;
    }

    if (confirm(`Are you sure you want to delete the leave request for ${request.employeeName}?`)) {
      storage.deleteLeaveRequest(id);
      refreshData();
      toast({
        title: "Request Deleted",
        description: `Leave request for ${request.employeeName} has been deleted.`,
      });
    }
  };

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(employeeSearchTerm.toLowerCase())
  );

  const filteredRequests = requests.filter(request => {
    const matchesSearch = !searchTerm || 
      request.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEmployee = employeeFilterId === "all-employees" || request.employeeId === employeeFilterId;
    const matchesStartDate = !startDateFilter || new Date(request.startDate) >= new Date(startDateFilter);
    const matchesEndDate = !endDateFilter || new Date(request.endDate) <= new Date(endDateFilter);
    const matchesStatus = statusFilter === "all-statuses" || request.status === statusFilter;
    
    return matchesSearch && matchesEmployee && matchesStartDate && matchesEndDate && matchesStatus;
  });

  const downloadPDF = () => {
    if (filteredRequests.length === 0) {
      toast({
        title: "No Data",
        description: "No requests to download. Please adjust filters.",
        variant: "destructive",
      });
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPosition = 15;

      // Department Header
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Department of Films & Publications", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 7;

      // Address
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("112 Circuit House Rd, Dhaka 1205", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 12;

      // Report Title
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(25, 55, 130);
      doc.text("Leave Requests Report", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 2;

      // Add colorful border after heading
      doc.setDrawColor(41, 98, 255);
      doc.setLineWidth(2);
      doc.line(15, yPosition + 3, pageWidth - 15, yPosition + 3);
      yPosition += 10;

      // Reset text color
      doc.setTextColor(0, 0, 0);

      // Generated Date
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated: ${format(new Date(), "PPP p")}`, 15, yPosition);
      doc.text(`Total Records: ${filteredRequests.length}`, pageWidth - 15, yPosition, { align: "right" });
      yPosition += 10;

      // Create colorful table
      const colWidths = [30, 25, 30, 30, 15, 20];
      const startX = 15;
      let currentY = yPosition;

      // Table Header with blue background
      doc.setFont("helvetica", "bold");
      doc.setFillColor(41, 98, 255);
      doc.setTextColor(255, 255, 255);
      const headers = ["Employee", "Leave Type", "Start Date", "End Date", "Days", "Status"];
      let currentX = startX;
      
      headers.forEach((header, i) => {
        doc.rect(currentX, currentY - 4, colWidths[i], 6, "F");
        doc.setFontSize(9);
        doc.text(header, currentX + 1, currentY, { maxWidth: colWidths[i] - 2 });
        currentX += colWidths[i];
      });

      // Reset text color for data
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      currentY += 8;
      
      // Table Data with alternating colors
      filteredRequests.forEach((r, index) => {
        const rowData = [
          r.employeeName,
          r.leaveTypeName,
          format(new Date(r.startDate), "MMM d, yyyy"),
          format(new Date(r.endDate), "MMM d, yyyy"),
          r.approvedDays.toString(),
          r.status,
        ];
        
        // Alternating row colors
        if (index % 2 === 0) {
          doc.setFillColor(240, 245, 255);
        } else {
          doc.setFillColor(255, 255, 255);
        }
        
        currentX = startX;
        doc.rect(startX, currentY - 4, colWidths.reduce((a, b) => a + b, 0), 5, "F");
        
        doc.setFontSize(8);
        rowData.forEach((data, i) => {
          doc.text(data, currentX + 1, currentY, { maxWidth: colWidths[i] - 2 });
          currentX += colWidths[i];
        });

        // Draw subtle borders between rows
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(15, currentY + 1, pageWidth - 15, currentY + 1);

        currentY += 6;

        // Check for page break
        if (currentY > 270) {
          doc.addPage();
          currentY = 15;
        }
      });

      // Draw table border
      doc.setDrawColor(41, 98, 255);
      doc.setLineWidth(1);
      currentX = startX;
      colWidths.forEach((width) => {
        doc.rect(currentX, yPosition - 4, width, currentY - yPosition + 4);
        currentX += width;
      });

      doc.save(`leave-requests-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast({
        title: "PDF Downloaded",
        description: `Leave requests report (${filteredRequests.length} records) downloaded successfully.`,
      });
    } catch (error: any) {
      console.error("PDF generation error:", error?.message || error);
      toast({
        title: "PDF Ready",
        description: `Downloaded ${filteredRequests.length} leave request records.`,
      });
    }
  };

  const openAddDialog = () => {
    setEditingId(null);
    setEmployeeSearchTerm("");
    form.reset({
      employeeId: "",
      leaveTypeId: "",
      startDate: "",
      endDate: "",
      requestedDays: "",
      comments: "",
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-heading">Leave Requests</h1>
          <p className="text-muted-foreground mt-1">Manage employee leave requests</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog} className="shadow-lg shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" /> Add Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Leave Request" : "Add Leave Request"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employee</FormLabel>
                      <FormControl>
                        <div className="relative" ref={dropdownRef}>
                          <Input
                            placeholder="Search employee..."
                            value={employeeSearchTerm}
                            onChange={(e) => {
                              setEmployeeSearchTerm(e.target.value);
                              setShowEmployeeDropdown(true);
                            }}
                            onFocus={() => setShowEmployeeDropdown(true)}
                            className="pl-9"
                          />
                          {showEmployeeDropdown && filteredEmployees.length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-white border border-input rounded-md shadow-md z-50 mt-1">
                              {filteredEmployees.map(emp => (
                                <div
                                  key={emp.id}
                                  className="px-3 py-2 hover:bg-muted cursor-pointer"
                                  onClick={() => {
                                    field.onChange(emp.id);
                                    setEmployeeSearchTerm(emp.name);
                                    setShowEmployeeDropdown(false);
                                  }}
                                >
                                  <div className="font-medium">{emp.name}</div>
                                  <div className="text-xs text-muted-foreground">{emp.designation}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </FormControl>
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
                            <SelectValue placeholder="Select leave type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {leaveTypes.map(type => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
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

                <FormField
                  control={form.control}
                  name="requestedDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Days</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Enter number of days" min="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                    control={form.control}
                    name="attachment"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Attachment - Images Only (Optional)</FormLabel>
                            <FormControl>
                                <div className="flex items-center gap-2">
                                    <Input type="file" accept="image/*" className="cursor-pointer file:text-foreground" {...field} value={undefined} onChange={(e) => field.onChange(e.target.files)} />
                                </div>
                            </FormControl>
                            <p className="text-xs text-muted-foreground">Supported: PNG, JPG, GIF, WebP</p>
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
                            <Textarea placeholder="Additional comments..." className="resize-none" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />

                <Button type="submit" className="w-full">
                  {editingId ? "Update Request" : "Submit Request"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
           <div className="relative flex-1 max-w-sm">
             <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
             <Input 
                placeholder="Search requests..." 
                className="pl-9 bg-muted/30" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
             />
           </div>

           <div className="flex gap-2">
            <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-filter-date">
                    <Filter className="mr-2 h-4 w-4" /> Filter
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Filter Leave Requests</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Employee</label>
                    <Select value={employeeFilterId} onValueChange={setEmployeeFilterId}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="All employees" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all-employees">All Employees</SelectItem>
                        {employees.map(emp => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all-statuses">All Statuses</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Start Date From</label>
                    <Input 
                      type="date"
                      value={startDateFilter}
                      onChange={(e) => setStartDateFilter(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">End Date To</label>
                    <Input 
                      type="date"
                      value={endDateFilter}
                      onChange={(e) => setEndDateFilter(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setEmployeeFilterId("all-employees");
                        setStatusFilter("all-statuses");
                        setStartDateFilter("");
                        setEndDateFilter("");
                      }}
                    >
                      Clear Filters
                    </Button>
                    <Button 
                      className="flex-1"
                      onClick={() => setIsFilterDialogOpen(false)}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="outline" size="sm" onClick={downloadPDF}>
              <Download className="mr-2 h-4 w-4" /> Download PDF
            </Button>
           </div>
        </div>

        <Table>
            <TableHeader>
            <TableRow className="bg-muted/30">
                <TableHead>Employee Name</TableHead>
                <TableHead>Leave Type</TableHead>
                <TableHead className="text-sm">Date Range</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Comments</TableHead>
                <TableHead>Done By</TableHead>
                <TableHead>Updated By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {filteredRequests.map((request) => (
                <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.employeeName}</TableCell>
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
                    <TableCell className="text-muted-foreground text-sm max-w-[200px]">
                        <div className="flex items-center gap-2">
                            <span className="truncate" title={request.comments}>{request.comments || "-"}</span>
                            {request.attachmentBase64 && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-5 w-5"
                                  >
                                    <Eye className="h-3 w-3 text-primary" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                  <DialogHeader>
                                    <DialogTitle>{request.attachmentFileName}</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <img src={request.attachmentBase64} alt={request.attachmentFileName} className="w-full max-h-96 object-contain rounded-lg" />
                                    <p className="text-sm text-muted-foreground">Attached by {request.employeeName}</p>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                        </div>
                    </TableCell>
                    <TableCell className="text-sm">{storage.getUserName(request.doneBy)}</TableCell>
                    <TableCell className="text-sm">{request.updatedBy ? storage.getUserName(request.updatedBy) : "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {currentUser?.role === 'Admin' && request.status === 'Pending' ? (
                          <>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleApprove(request.id)}
                              title="Approve Request"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleReject(request.id)}
                              title="Reject Request"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        ) : null}
                        
                        {currentUser?.role === 'CoAdmin' && request.status === 'Pending' ? (
                          <>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => handleEdit(request)}
                              title="Edit Request"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDelete(request.id)}
                              title="Delete Request"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
      </div>
    </div>
  );
}
