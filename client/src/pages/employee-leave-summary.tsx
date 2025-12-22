import { useState, useEffect } from "react";
import { firebaseService, Employee, LeaveType, LeaveRequest } from "@/lib/firebaseStorage";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Eye, Download, X } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import { useToast } from "@/hooks/use-toast";

export default function EmployeeLeaveSummary() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [nameFilter, setNameFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("all-types");
  const { toast } = useToast();

  useEffect(() => {
    async function loadData() {
      const [allEmployees, allLeaveTypes, allRequests] = await Promise.all([
        firebaseService.getEmployees(),
        firebaseService.getLeaveTypes(),
        firebaseService.getLeaveRequests()
      ]);
      const sortedEmployees = allEmployees.sort((a, b) => a.name.localeCompare(b.name));
      setEmployees(sortedEmployees);
      setFilteredEmployees(sortedEmployees);
      setLeaveTypes(allLeaveTypes);
      setLeaveRequests(allRequests);
    }
    loadData();
  }, []);

  const applyFilters = (
    emps: Employee[],
    name: string,
    dateFrom: string,
    dateTo: string
  ) => {
    let filtered = emps;

    if (name) {
      filtered = filtered.filter((e) =>
        e.name.toLowerCase().includes(name.toLowerCase())
      );
    }

    if (dateFrom || dateTo) {
      filtered = filtered.filter((emp) => {
        const leaves = leaveRequests.filter(
          (r) => r.employeeId === emp.id && r.status === "Approved"
        );
        if (leaves.length === 0) return false;

        const fromDate = dateFrom ? new Date(dateFrom) : null;
        const toDate = dateTo ? new Date(dateTo) : null;

        return leaves.some((leave) => {
          const leaveStart = new Date(leave.startDate);
          const leaveEnd = new Date(leave.endDate);
          
          if (fromDate && leaveEnd < fromDate) return false;
          if (toDate && leaveStart > toDate) return false;
          return true;
        });
      });
    }

    setFilteredEmployees(filtered.sort((a, b) => a.name.localeCompare(b.name)));
  };

  const handleNameFilterChange = (value: string) => {
    setNameFilter(value);
    applyFilters(employees, value, dateFromFilter, dateToFilter);
  };

  const handleDateFromChange = (value: string) => {
    setDateFromFilter(value);
    applyFilters(employees, nameFilter, value, dateToFilter);
  };

  const handleDateToChange = (value: string) => {
    setDateToFilter(value);
    applyFilters(employees, nameFilter, dateFromFilter, value);
  };

  const handleClearFilters = () => {
    setNameFilter("");
    setDateFromFilter("");
    setDateToFilter("");
    setLeaveTypeFilter("all-types");
    setFilteredEmployees(employees);
  };

  const getEmployeeLeaveData = (employee: Employee) => {
    let filteredLeaves = leaveRequests.filter(r => r.employeeId === employee.id && r.status === "Approved");
    
    if (leaveTypeFilter !== "all-types") {
      filteredLeaves = filteredLeaves.filter(leave => leave.leaveTypeId === leaveTypeFilter);
    }
    
    if (dateFromFilter || dateToFilter) {
      filteredLeaves = filteredLeaves.filter(leave => {
        const fromDate = dateFromFilter ? new Date(dateFromFilter) : null;
        const toDate = dateToFilter ? new Date(dateToFilter) : null;
        const leaveStart = new Date(leave.startDate);
        const leaveEnd = new Date(leave.endDate);
        
        if (fromDate && leaveEnd < fromDate) return false;
        if (toDate && leaveStart > toDate) return false;
        return true;
      });
    }
    
    const filteredTotalDays = filteredLeaves.reduce((acc, leave) => acc + leave.approvedDays, 0);
    
    const currentYear = new Date().getFullYear();
    const casualLeaveUsed = leaveRequests
      .filter(r => 
        r.employeeId === employee.id && 
        r.status === "Approved" && 
        r.leaveTypeName === "Casual Leave" &&
        new Date(r.startDate).getFullYear() === currentYear
      )
      .reduce((acc, leave) => acc + leave.approvedDays, 0);
    const casualLeaveLeft = Math.max(0, 20 - casualLeaveUsed);

    return { filteredLeaves, filteredTotalDays, casualLeaveUsed, casualLeaveLeft };
  };

  const downloadEmployeeLeavePDF = (employee: Employee) => {
    const { filteredLeaves } = getEmployeeLeaveData(employee);
    
    if (filteredLeaves.length === 0) {
      toast({
        title: "No Data",
        description: `${employee.name} has no approved leaves in the selected date range.`,
        variant: "destructive"
      });
      return;
    }

    const totalDays = filteredLeaves.reduce((acc, leave) => acc + leave.approvedDays, 0);
    
    const selectedLeaveType = leaveTypeFilter !== "all-types" 
      ? leaveTypes.find(t => t.id === leaveTypeFilter)?.name || "All Leave Types"
      : "All Leave Types";
    
    const dateRange = filteredLeaves.length > 0 
      ? `${format(new Date(Math.min(...filteredLeaves.map(l => new Date(l.startDate).getTime()))), "MMM d, yyyy")} to ${format(new Date(Math.max(...filteredLeaves.map(l => new Date(l.endDate).getTime()))), "MMM d, yyyy")}`
      : "";
    
    const pdfTitle = `Leave summary for ${employee.name} - ${totalDays} days (${dateRange})`;

    toast({
      title: "Generating PDF",
      description: pdfTitle,
    });

    try {
      const doc = new jsPDF();
      const pageHeight = doc.internal.pageSize.getHeight();
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
      doc.text("Employee Leave Summary", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 5;

      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.line(15, yPosition, pageWidth - 15, yPosition);
      yPosition += 8;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      
      const fromText = dateFromFilter ? format(new Date(dateFromFilter), "MMM d, yyyy") : "All Dates";
      const toText = dateToFilter ? format(new Date(dateToFilter), "MMM d, yyyy") : "All Dates";
      const periodText = (dateFromFilter || dateToFilter) 
        ? `${fromText} to ${toText}` 
        : "All Dates";
      
      const leftX = 15;
      const rightX = pageWidth / 2 + 10;
      const infoStartY = yPosition;
      
      doc.text(`Name: ${employee.name}`, leftX, infoStartY);
      doc.text(`Designation: ${employee.designation}`, leftX, infoStartY + 6);
      doc.text(`Section: ${employee.department}`, leftX, infoStartY + 12);
      
      doc.text(`Generated: ${format(new Date(), "PPP p")}`, rightX, infoStartY);
      doc.text(`Report Period: ${periodText}`, rightX, infoStartY + 6);
      doc.text(`Report Type: ${selectedLeaveType}`, rightX, infoStartY + 12);
      
      yPosition = infoStartY + 18;

      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.line(15, yPosition, pageWidth - 15, yPosition);
      yPosition += 8;

      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.text(`Total Leave Days: ${totalDays}`, 15, yPosition);
      yPosition += 8;

      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.line(15, yPosition, pageWidth - 15, yPosition);
      yPosition += 8;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text("Leave Breakdown by Type:", 15, yPosition);
      yPosition += 7;

      doc.setFontSize(10);
      const leaveTypeMap = new Map<string, typeof filteredLeaves>();
      filteredLeaves.forEach(leave => {
        if (!leaveTypeMap.has(leave.leaveTypeName)) {
          leaveTypeMap.set(leave.leaveTypeName, []);
        }
        leaveTypeMap.get(leave.leaveTypeName)!.push(leave);
      });

      leaveTypeMap.forEach((leaves, leaveType) => {
        const typeDays = leaves.reduce((acc, leave) => acc + leave.approvedDays, 0);
        const sortedLeaves = [...leaves].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        doc.setFont("helvetica", "bold");
        doc.text(`${leaveType}: ${typeDays} days`, 15, yPosition);
        yPosition += 6;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        sortedLeaves.forEach((leave) => {
          if (yPosition > pageHeight - 20) {
            doc.addPage();
            yPosition = 15;
          }

          const dateRangeText = `${format(new Date(leave.startDate), "MMM d")} - ${format(new Date(leave.endDate), "MMM d, yyyy")}`;
          doc.text(`  • ${dateRangeText} (${leave.approvedDays} days)`, 20, yPosition);
          yPosition += 4;
        });

        doc.setFontSize(10);
        yPosition += 2;
      });

      yPosition = pageHeight - 10;
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.text(`This is an auto-generated report. For official records, contact HR.`, pageWidth / 2, yPosition, { align: "center" });

      doc.save(`${employee.name}-leave-summary.pdf`);
      toast({
        title: "PDF Downloaded",
        description: `Leave summary for ${employee.name} downloaded successfully.`,
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
      <div>
        <h1 className="text-3xl font-bold font-heading">Employee Leave Summary</h1>
        <p className="text-muted-foreground mt-1">View and download leave records for all employees</p>
      </div>

      <div className="bg-card rounded-xl border shadow-sm p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Filters</h3>
          {(nameFilter || dateFromFilter || dateToFilter || leaveTypeFilter !== "all-types") && (
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              <X className="h-4 w-4 mr-2" /> Clear Filters
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Employee Name</label>
            <Input
              placeholder="Search by name..."
              value={nameFilter}
              onChange={(e) => handleNameFilterChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Leave Type</label>
            <Select value={leaveTypeFilter} onValueChange={setLeaveTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Leave Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-types">All Leave Types</SelectItem>
                {leaveTypes.map(type => (
                  <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Date From</label>
            <Input
              type="date"
              value={dateFromFilter}
              onChange={(e) => handleDateFromChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Date To</label>
            <Input
              type="date"
              value={dateToFilter}
              onChange={(e) => handleDateToChange(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Employee Name</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Department</TableHead>
              <TableHead className="text-center">Total Leave Days</TableHead>
              <TableHead className="text-center">Casual Used</TableHead>
              <TableHead className="text-center">Casual Left</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.map((employee) => {
              const { filteredLeaves, filteredTotalDays, casualLeaveUsed, casualLeaveLeft } = getEmployeeLeaveData(employee);
              
              return (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.name}</TableCell>
                  <TableCell>{employee.designation}</TableCell>
                  <TableCell>{employee.department}</TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-primary/10 text-primary">
                      {filteredTotalDays}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                      {casualLeaveUsed}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      {casualLeaveLeft}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Eye className="mr-2 h-4 w-4" /> View
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>{employee.name} - Leave Details</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                              <div className="p-3 bg-muted/30 rounded-lg">
                                <p className="text-xs text-muted-foreground uppercase">Designation</p>
                                <p className="font-medium text-foreground">{employee.designation}</p>
                              </div>
                              <div className="p-3 bg-muted/30 rounded-lg">
                                <p className="text-xs text-muted-foreground uppercase">Department</p>
                                <p className="font-medium text-foreground">{employee.department}</p>
                              </div>
                              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                                <p className="text-xs text-muted-foreground uppercase">Total Days</p>
                                <p className="font-bold text-primary text-lg">{filteredTotalDays}</p>
                              </div>
                            </div>

                            <div>
                              <h4 className="font-semibold mb-3">Leave Breakdown {dateFromFilter || dateToFilter ? `(Filtered)` : ""}</h4>
                              <div className="space-y-3">
                                {filteredLeaves.length > 0 ? (
                                  (() => {
                                    const leaveTypeMap = new Map<string, typeof filteredLeaves>();
                                    filteredLeaves.forEach(leave => {
                                      if (!leaveTypeMap.has(leave.leaveTypeName)) {
                                        leaveTypeMap.set(leave.leaveTypeName, []);
                                      }
                                      leaveTypeMap.get(leave.leaveTypeName)!.push(leave);
                                    });
                                    
                                    return Array.from(leaveTypeMap).map(([leaveType, leaves]) => {
                                      const sortedLeaves = [...leaves].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
                                      return (
                                        <div key={leaveType} className="border rounded-lg p-3">
                                          <div className="flex justify-between items-center mb-2">
                                            <h5 className="font-medium">{leaveType}</h5>
                                            <span className="text-sm font-bold text-primary">{leaves.reduce((acc, l) => acc + l.approvedDays, 0)} days</span>
                                          </div>
                                          <div className="space-y-1">
                                            {sortedLeaves.map((leave) => (
                                              <div key={leave.id} className="text-sm text-muted-foreground flex justify-between">
                                                <span>{format(new Date(leave.startDate), "MMM d")} - {format(new Date(leave.endDate), "MMM d, yyyy")}</span>
                                                <span className="font-medium text-foreground">{leave.approvedDays}d</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    });
                                  })()
                                ) : (
                                  <p className="text-sm text-muted-foreground">No leaves found in the selected date range.</p>
                                )}
                              </div>
                            </div>

                            <Button 
                              className="w-full mt-4"
                              onClick={() => {
                                downloadEmployeeLeavePDF(employee);
                              }}
                            >
                              <Download className="mr-2 h-4 w-4" /> Download as PDF
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => downloadEmployeeLeavePDF(employee)}
                      >
                        <Download className="mr-2 h-4 w-4" /> PDF
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
