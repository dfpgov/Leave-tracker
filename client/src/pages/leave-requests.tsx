import { useState, useEffect, useRef } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase"; 
import { firebaseService, LeaveRequest, Employee, LeaveType, calculateDays, User } from "@/lib/firebaseStorage";
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
import { Plus, Filter, Search, Download, X, Eye, CheckCircle, XCircle, Edit2, Trash2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { parseDate, safeFormat } from "@/lib/dateUtils";
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
  const [users, setUsers] = useState<User[]>([]);
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
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("all-leave-types");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const itemsPerPage = 50;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof requestSchema>>({
    resolver: zodResolver(requestSchema),
  });

  useEffect(() => {
    refreshData();
    setCurrentUser(firebaseService.getCurrentUser());
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

  const refreshData = async () => {
    const [allRequests, allEmployees, allLeaveTypes, allUsers] = await Promise.all([
      firebaseService.getLeaveRequests(),
      firebaseService.getEmployees(),
      firebaseService.getLeaveTypes(),
      firebaseService.getUsers()
    ]);
    setRequests(allRequests);
    setEmployees(allEmployees);
    setLeaveTypes(allLeaveTypes);
    setUsers(allUsers);
  };

  const getUserName = (userId: string): string => {
    const user = users.find(u => u.id === userId);
    return user ? user.name : 'Unknown';
  };

  const onSubmit = async (values: z.infer<typeof requestSchema>) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      const employee = employees.find(e => e.id === values.employeeId);
      const leaveType = leaveTypes.find(t => t.id === values.leaveTypeId);

      if (!employee || !leaveType) {
        return;
      }

      const requestedDaysNum = parseInt(values.requestedDays);
      
      if (leaveType.name === "Casual Leave") {
         const currentYear = new Date().getFullYear();
         const usedDays = requests
           .filter(r => r.employeeId === employee.id && r.leaveTypeName === "Casual Leave" && r.status === 'Approved' && parseDate(r.startDate).getFullYear() === currentYear)
           .reduce((acc, curr) => acc + curr.approvedDays, 0);
         
         const maxDays = 20;
         if (usedDays >= maxDays) {
           toast({
             title: "Cannot Add Leave",
             description: `${employee.name} has already used all ${maxDays} Casual Leave days for this year.`,
             variant: "destructive"
           });
           return;
         }
         
         if (usedDays + requestedDaysNum > maxDays) {
           toast({
             title: "Cannot Add Leave",
             description: `${employee.name} has ${maxDays - usedDays} Casual Leave days remaining. Requested ${requestedDaysNum} days exceeds the limit.`,
             variant: "destructive"
           });
           return;
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

      const isAdmin = currentUser?.role === 'Admin';
      const initialStatus = isAdmin ? "Approved" : "Pending";

      if (attachmentFile && isImage) {
        await new Promise<void>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const base64 = e.target?.result as string;
              const requestId = editingId || firebaseService.generateLeaveRequestId();
              
              let attachmentUrl = "";
              let fileId = "";
              try {
                const response = await fetch('/api/upload-image', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    base64Data: base64,
                    fileName: `${requestId}_${attachmentFile.name}`,
                    mimeType: attachmentFile.type,
                  }),
                });
                
                if (response.ok) {
                  const result = await response.json();
                  fileId = result.fileId || "";
                  attachmentUrl = fileId ? `https://drive.google.com/uc?export=view&id=${fileId}` : (result.webContentLink || result.webViewLink);
                } else {
                  console.error("Error uploading to Google Drive:", await response.text());
                  toast({
                    title: "Upload Warning",
                    description: "Image could not be uploaded to Drive. Leave saved without attachment.",
                    variant: "destructive"
                  });
                }
              } catch (error) {
                console.error("Error uploading attachment:", error);
              }

              const newReq: LeaveRequest = {
                id: requestId,
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
                status: initialStatus,
                timestamp: editingId ? (requests.find(r => r.id === editingId)?.timestamp || new Date().toISOString()) : new Date().toISOString(),
                attachmentFileName: attachmentFile.name,
                attachmentUrl: attachmentUrl,
                doneBy: firebaseService.getCurrentUserId(),
                updatedAt: new Date().toISOString(),
                updatedBy: isAdmin ? firebaseService.getCurrentUserId() : "",
              };
              await firebaseService.saveLeaveRequest(newReq);
              await refreshData();
              setIsDialogOpen(false);
              setEditingId(null);
              form.reset();
              toast({
                title: isAdmin ? "Leave Approved" : "Approved Leave Submitted",
                description: isAdmin ? "Leave has been automatically approved." : "Request pending admin approval.",
              });
              resolve();
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(attachmentFile);
        });
        return;
      }

      const newRequest: LeaveRequest = {
        id: editingId || firebaseService.generateLeaveRequestId(),
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
        status: initialStatus,
        timestamp: editingId ? (requests.find(r => r.id === editingId)?.timestamp || new Date().toISOString()) : new Date().toISOString(),
        attachmentFileName: "",
        attachmentUrl: "",
        doneBy: firebaseService.getCurrentUserId(),
        updatedAt: new Date().toISOString(),
        updatedBy: isAdmin ? firebaseService.getCurrentUserId() : "",
      };

      await firebaseService.saveLeaveRequest(newRequest);
      await refreshData();
      setIsDialogOpen(false);
      setEditingId(null);
      form.reset();
      toast({
        title: editingId ? "Request Updated" : (isAdmin ? "Leave Approved" : "Approved Leave Submitted"),
        description: editingId ? "Approved leave has been updated successfully." : (isAdmin ? "Leave has been automatically approved." : "Request pending admin approval."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleApprove = async (id: string) => {
    if (loadingActionId) return;
    setLoadingActionId(id);
    try {
      const request = requests.find(r => r.id === id);
      if (!request) return;
      
      const updatedRequest = { ...request };
      updatedRequest.status = "Approved";
      updatedRequest.updatedBy = firebaseService.getCurrentUserId();
      updatedRequest.updatedAt = new Date().toISOString();
      updatedRequest.attachmentUrl = "";
      updatedRequest.attachmentFileName = "";
      await firebaseService.saveLeaveRequest(updatedRequest);
      await refreshData();
      toast({
        title: "Request Approved",
        description: `Approved leave for ${request.employeeName} has been approved.`,
      });
    } finally {
      setLoadingActionId(null);
    }
  };
  
  const handleReject = async (id: string) => {
    if (loadingActionId) return;
    setLoadingActionId(id);
    try {
      const request = requests.find(r => r.id === id);
      if (!request) return;
      
      const updatedRequest = { ...request };
      updatedRequest.status = "Rejected";
      updatedRequest.updatedBy = firebaseService.getCurrentUserId();
      updatedRequest.updatedAt = new Date().toISOString();
      await firebaseService.saveLeaveRequest(updatedRequest);
      await refreshData();
      toast({
        title: "Request Rejected",
        description: `Approved leave for ${request.employeeName} has been rejected.`,
        variant: "destructive",
      });
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleEdit = (request: LeaveRequest) => {
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

const handleDelete = async (id) => {
  // 1. Locate the specific request in your local state
  const request = requests.find(r => r.id === id);
  if (!request) return;

  // 2. User Confirmation
  if (window.confirm(`Are you sure you want to delete the leave request for ${request.employeeName}?`)) {
    setLoadingActionId(id);
    
    try {
      // --- STEP A: FETCH THE RECORD FROM FIREBASE ---
      // We need to get the specific attachmentUrl stored in the database
      const docRef = doc(db, "leaveRequests", id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const fullData = docSnap.data();
        const urlToDelete = fullData.attachmentUrl; // Format: https://drive.google.com/uc?id=...

        // --- STEP B: DELETE FROM GOOGLE DRIVE (Via Vercel API) ---
        if (urlToDelete) {
          console.log("Found Drive URL. Initiating cleanup:", urlToDelete);
          
          try {
            // We use a relative path. Vercel automatically routes this to /api/delete-image.ts
            const response = await fetch('/api/delete-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ attachmentUrl: urlToDelete }),
            });

            const result = await response.json();

            if (!response.ok) {
              console.error('Drive API Error:', result.error);
              // We do NOT throw an error here so that the Firebase record can still be deleted
            } else {
              console.log("Google Drive file deleted successfully:", result);
            }
          } catch (driveErr) {
            console.error('Connection to Delete API failed:', driveErr);
          }
        }
      } else {
        console.warn("Document not found in Firebase. It may have already been deleted.");
      }

      // --- STEP C: DELETE THE RECORD FROM FIREBASE ---
      // This ensures the row disappears from your table
      await firebaseService.deleteLeaveRequest(id);
      
      // --- STEP D: REFRESH THE UI ---
      await refreshData();
      
      // Clear selection state if applicable
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });

      toast({
        title: "Deletion Successful",
        description: `The record for ${request.employeeName} has been removed.`,
      });

    } catch (error) {
      console.error("Critical error in delete process:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Check the console.",
        variant: "destructive",
      });
    } finally {
      // Stop the loading spinner
      setLoadingActionId(null);
    }
  }
};
  
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.size} leave request(s)?`)) {
      await firebaseService.deleteLeaveRequests(Array.from(selectedIds));
      await refreshData();
      setSelectedIds(new Set());
      toast({
        title: "Requests Deleted",
        description: `${selectedIds.size} leave request(s) have been deleted.`,
        variant: "destructive",
      });
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedRequests.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(employeeSearchTerm.toLowerCase())
  );

  const filteredRequests = requests.filter(request => {
    const matchesSearch = !searchTerm || 
      request.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEmployee = employeeFilterId === "all-employees" || request.employeeId === employeeFilterId;
    const matchesStartDate = !startDateFilter || parseDate(request.startDate) >= new Date(startDateFilter);
    const matchesEndDate = !endDateFilter || parseDate(request.endDate) <= new Date(endDateFilter);
    const matchesStatus = statusFilter === "all-statuses" || request.status === statusFilter;
    const matchesLeaveType = leaveTypeFilter === "all-leave-types" || request.leaveTypeId === leaveTypeFilter;
    
    return matchesSearch && matchesEmployee && matchesStartDate && matchesEndDate && matchesStatus && matchesLeaveType;
  }).sort((a, b) => {
    if (a.status === "Pending" && b.status !== "Pending") return -1;
    if (a.status !== "Pending" && b.status === "Pending") return 1;
    if (a.status === "Approved" && b.status === "Rejected") return -1;
    if (a.status === "Rejected" && b.status === "Approved") return 1;
    return parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime();
  });

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRequests = filteredRequests.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const downloadPDF = () => {
    if (filteredRequests.length === 0) {
      toast({
        title: "No Data",
        description: "No requests to download. Please adjust filters.",
        variant: "destructive",
      });
      return;
    }

    const uniqueEmployees = Array.from(new Set(filteredRequests.map(r => r.employeeName)));
    const dateRange = filteredRequests.length > 0 
      ? `${safeFormat(new Date(Math.min(...filteredRequests.map(r => parseDate(r.startDate).getTime()))), "MMM d, yyyy")} to ${safeFormat(new Date(Math.max(...filteredRequests.map(r => parseDate(r.endDate).getTime()))), "MMM d, yyyy")}`
      : "";
    
    const pdfTitle = uniqueEmployees.length === 1 
      ? `Approved leave for ${uniqueEmployees[0]} (${dateRange})`
      : `Approved leave for ${uniqueEmployees.length} employees (${dateRange})`;

    toast({
      title: "Generating PDF",
      description: pdfTitle,
    });

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPosition = 15;

      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Department of Films & Publications", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 7;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("112 Circuit House Rd, Dhaka 1205", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 12;

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("Approved Leave Report", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated: ${safeFormat(new Date(), "PPP p")}`, 15, yPosition);
      doc.text(`Total Records: ${filteredRequests.length}`, pageWidth - 15, yPosition, { align: "right" });
      yPosition += 6;

      doc.setFontSize(9);
      if (startDateFilter || endDateFilter) {
        const dateRangeText = startDateFilter && endDateFilter 
          ? `${safeFormat(startDateFilter, "MMM d, yyyy")} - ${safeFormat(endDateFilter, "MMM d, yyyy")}`
          : startDateFilter 
            ? `From ${safeFormat(startDateFilter, "MMM d, yyyy")}`
            : `Until ${safeFormat(endDateFilter, "MMM d, yyyy")}`;
        doc.text(`Date Range: ${dateRangeText}`, 15, yPosition);
        yPosition += 5;
      }
      if (leaveTypeFilter !== "all-leave-types") {
        const leaveTypeName = leaveTypes.find(lt => lt.id === leaveTypeFilter)?.name || leaveTypeFilter;
        doc.text(`Leave Type: ${leaveTypeName}`, 15, yPosition);
        yPosition += 5;
      }
      yPosition += 3;

      doc.setDrawColor(128, 128, 128);
      doc.setLineWidth(0.3);
      doc.line(15, yPosition, pageWidth - 15, yPosition);
      yPosition += 8;

      const colWidths = [30, 25, 30, 30, 15, 20];
      const startX = 15;
      let currentY = yPosition;

      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      const headers = ["Employee", "Leave Type", "Start Date", "End Date", "Days", "Status"];
      let currentX = startX;
      
      headers.forEach((header, i) => {
        doc.setFontSize(9);
        doc.text(header, currentX + 1, currentY, { maxWidth: colWidths[i] - 2 });
        currentX += colWidths[i];
      });

      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      currentY += 8;
      
      doc.setTextColor(0, 0, 0);
      filteredRequests.forEach((r) => {
        const rowData = [
          r.employeeName,
          r.leaveTypeName,
          safeFormat(r.startDate, "MMM d, yyyy"),
          safeFormat(r.endDate, "MMM d, yyyy"),
          r.approvedDays.toString(),
          r.status,
        ];
        
        currentX = startX;
        doc.setFontSize(8);
        rowData.forEach((data, i) => {
          doc.text(data, currentX + 1, currentY, { maxWidth: colWidths[i] - 2 });
          currentX += colWidths[i];
        });

        currentY += 6;

        if (currentY > 270) {
          doc.addPage();
          currentY = 15;
        }
      });

      doc.save(`leave-requests-${safeFormat(new Date(), "yyyy-MM-dd")}.pdf`);
      toast({
        title: "PDF Downloaded",
        description: `Approved leave report (${filteredRequests.length} records) downloaded successfully.`,
      });
    } catch (error: any) {
      console.error("PDF generation error:", error?.message || error);
      toast({
        title: "PDF Ready",
        description: `Downloaded ${filteredRequests.length} approved leave records.`,
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading">Approved Leave</h1>
          <p className="text-muted-foreground mt-1">Manage employee approved leave</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog} className="shadow-lg shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" /> Add New
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Approved Leave" : "Add Approved Leave"}</DialogTitle>
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
                            <div className="absolute top-full left-0 right-0 bg-white border border-input rounded-md shadow-md z-50 mt-1 max-h-48 overflow-y-auto">
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
                            <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
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
                  <FormField
                    control={form.control}
                    name="requestedDays"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Days</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="Number of days" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="comments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comments (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Add any notes..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="attachment"
                  render={({ field: { onChange, value, ...rest } }) => (
                    <FormItem>
                      <FormLabel>Attachment (Optional - Images only)</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                          onChange={(e) => onChange(e.target.files)}
                          {...rest}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingId ? "Updating..." : "Submitting..."}
                    </>
                  ) : (
                    editingId ? "Update Request" : "Submit Request"
                  )}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex flex-wrap items-center gap-3">
           <div className="relative flex-1 min-w-[200px] max-w-sm">
             <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
             <Input 
                placeholder="Search by name..." 
                className="pl-9 bg-muted/30" 
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
             />
           </div>
           
           <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
             <SelectTrigger className="w-[140px]">
               <SelectValue placeholder="Status" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="all-statuses">All Status</SelectItem>
               <SelectItem value="Pending">Pending</SelectItem>
               <SelectItem value="Approved">Approved</SelectItem>
               <SelectItem value="Rejected">Rejected</SelectItem>
             </SelectContent>
           </Select>

           <Select value={leaveTypeFilter} onValueChange={(v) => { setLeaveTypeFilter(v); setCurrentPage(1); }}>
             <SelectTrigger className="w-[160px]">
               <SelectValue placeholder="Leave Type" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="all-leave-types">All Leave Types</SelectItem>
               {leaveTypes.map(type => (
                 <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
               ))}
             </SelectContent>
           </Select>
          <label className="text-sm font-medium hidden sm:inline">Start date </label>
           <Input 
             type="date" 
             className="w-[150px]" 
             value={startDateFilter}
             onChange={(e) => { setStartDateFilter(e.target.value); setCurrentPage(1); }}
             placeholder="From"
           />
           <label className="text-sm font-medium hidden sm:inline">End date </label>
           <Input 
             type="date" 
             className="w-[150px]" 
             value={endDateFilter}
             onChange={(e) => { setEndDateFilter(e.target.value); setCurrentPage(1); }}
             placeholder="To"
           />

           {(searchTerm || statusFilter !== "all-statuses" || leaveTypeFilter !== "all-leave-types" || startDateFilter || endDateFilter) && (
             <Button variant="ghost" size="sm" onClick={() => {
               setSearchTerm("");
               setStatusFilter("all-statuses");
               setLeaveTypeFilter("all-leave-types");
               setStartDateFilter("");
               setEndDateFilter("");
               setCurrentPage(1);
             }}>
               <X className="h-4 w-4 mr-1" /> Clear
             </Button>
           )}

           <div className="flex items-center gap-2 ml-auto">
             {selectedIds.size > 0 && (
               <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                 <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedIds.size})
               </Button>
             )}
             <Button variant="outline" size="sm" onClick={downloadPDF}>
               <Download className="mr-2 h-4 w-4" /> Export PDF
             </Button>
           </div>
        </div>

        <div className="overflow-x-auto">
        <Table>
            <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-12">
                  <Checkbox
                    checked={paginatedRequests.length > 0 && selectedIds.size === paginatedRequests.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Leave Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-center">Days</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {paginatedRequests.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        No leave requests found
                    </TableCell>
                </TableRow>
            ) : (
                paginatedRequests.map((request) => (
                    <TableRow key={request.id} className="group">
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(request.id)}
                        onCheckedChange={() => toggleSelect(request.id)}
                      />
                    </TableCell>
                    <TableCell>
                        <div>
                            <div className="font-medium">{request.employeeName}</div>
                            <div className="text-xs text-muted-foreground">{request.designation}</div>
                        </div>
                    </TableCell>
                    <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {request.leaveTypeName}
                        </span>
                    </TableCell>
                    <TableCell className="text-sm">
                        {safeFormat(request.startDate, "MMM d")} - {safeFormat(request.endDate, "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-center font-medium">{request.approvedDays}</TableCell>
                    <TableCell className="text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            request.status === 'Approved' ? 'bg-green-100 text-green-800' :
                            request.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                        }`}>
                            {request.status}
                        </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {request.status === 'Pending' && currentUser?.role === 'Admin' && (
                          <>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleApprove(request.id)}
                              disabled={loadingActionId === request.id}
                              title="Approve"
                            >
                              {loadingActionId === request.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleReject(request.id)}
                              disabled={loadingActionId === request.id}
                              title="Reject"
                            >
                              {loadingActionId === request.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="h-4 w-4" />
                              )}
                            </Button>
                          </>
                        )}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost" title="View Details">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
                            <DialogHeader className="shrink-0">
                              <DialogTitle>Leave Request Details</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 overflow-y-auto flex-1 pr-2">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-muted/30 rounded-lg">
                                  <p className="text-xs text-muted-foreground uppercase">Employee</p>
                                  <p className="font-medium text-foreground">{request.employeeName}</p>
                                </div>
                                <div className="p-3 bg-muted/30 rounded-lg">
                                  <p className="text-xs text-muted-foreground uppercase">Department</p>
                                  <p className="font-medium text-foreground">{request.department}</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-muted/30 rounded-lg">
                                  <p className="text-xs text-muted-foreground uppercase">Leave Type</p>
                                  <p className="font-medium text-foreground">{request.leaveTypeName}</p>
                                </div>
                                <div className="p-3 bg-muted/30 rounded-lg">
                                  <p className="text-xs text-muted-foreground uppercase">Status</p>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                      request.status === 'Approved' ? 'bg-green-100 text-green-800' :
                                      request.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                      'bg-yellow-100 text-yellow-800'
                                  }`}>
                                      {request.status}
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-4">
                                <div className="p-3 bg-muted/30 rounded-lg">
                                  <p className="text-xs text-muted-foreground uppercase">Start Date</p>
                                  <p className="font-medium text-foreground">{safeFormat(request.startDate, "PPP")}</p>
                                </div>
                                <div className="p-3 bg-muted/30 rounded-lg">
                                  <p className="text-xs text-muted-foreground uppercase">End Date</p>
                                  <p className="font-medium text-foreground">{safeFormat(request.endDate, "PPP")}</p>
                                </div>
                                <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                                  <p className="text-xs text-muted-foreground uppercase">Days</p>
                                  <p className="font-bold text-primary text-lg">{request.approvedDays}</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-muted/30 rounded-lg">
                                  <p className="text-xs text-muted-foreground uppercase">Submitted By</p>
                                  <p className="font-medium text-foreground">{getUserName(request.doneBy)}</p>
                                </div>
                                <div className="p-3 bg-muted/30 rounded-lg">
                                  <p className="text-xs text-muted-foreground uppercase">Submitted At</p>
                                  <p className="font-medium text-foreground">{request.timestamp ? safeFormat(request.timestamp, "PPP p") : "-"}</p>
                                </div>
                                <div className="p-3 bg-muted/30 rounded-lg">
                                  <p className="text-xs text-muted-foreground uppercase">Approved/Rejected By</p>
                                  <p className="font-medium text-foreground">{request.updatedBy ? getUserName(request.updatedBy) : "-"}</p>
                                </div>
                                <div className="p-3 bg-muted/30 rounded-lg">
                                  <p className="text-xs text-muted-foreground uppercase">Approved/Rejected At</p>
                                  <p className="font-medium text-foreground">{request.updatedAt ? safeFormat(request.updatedAt, "PPP p") : "-"}</p>
                                </div>
                              </div>

                              <div className="p-3 bg-muted/30 rounded-lg">
                                <p className="text-xs text-muted-foreground uppercase mb-1">Comments</p>
                                <p className="text-foreground">{request.comments || "No comments"}</p>
                              </div>

                              {request.attachmentUrl && (() => {
                                const url = request.attachmentUrl;
                                const getFileId = (driveUrl: string) => {
                                  const idQueryMatch = driveUrl.match(/id=([^&]+)/);
                                  if (idQueryMatch) return idQueryMatch[1];
                                  const filePathMatch = driveUrl.match(/\/file\/d\/([^/]+)/);
                                  if (filePathMatch) return filePathMatch[1];
                                  return null;
                                };
                                const fileId = getFileId(url);
                                const directImageUrl = fileId 
                                  ? `https://drive.google.com/uc?export=view&id=${fileId}`
                                  : url;
                                
                                return (
                                <div className="p-3 bg-muted/30 rounded-lg">
                                  <p className="text-xs text-muted-foreground uppercase mb-2">Attachment</p>
                                  <img 
                                    src={directImageUrl} 
                                    alt={request.attachmentFileName || "Attachment"} 
                                    className="w-full max-h-64 object-contain rounded-lg border"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      if (fileId && !target.src.includes('lh3.googleusercontent.com')) {
                                        target.src = `https://lh3.googleusercontent.com/d/${fileId}`;
                                      }
                                    }}
                                  />
                                  <p className="text-xs text-muted-foreground mt-2">{request.attachmentFileName}</p>
                                  <a 
                                    href={url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline"
                                  >
                                    Open in new tab
                                  </a>
                                </div>
                                );
                              })()}
                            </div>
                          </DialogContent>
                        </Dialog>
                        {currentUser?.role === 'Admin' && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            title="Edit Request"
                            onClick={() => handleEdit(request)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                        {currentUser?.role === 'Admin' && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(request.id)}
                            disabled={loadingActionId === request.id}
                            title="Delete Request"
                          >
                            {loadingActionId === request.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    </TableRow>
                ))
            )}
            </TableBody>
        </Table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages || 1}
          </div>
          {totalPages > 1 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
