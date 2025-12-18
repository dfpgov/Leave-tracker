import { useState, useEffect } from "react";
import { storage, Employee } from "@/lib/storage";
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
import { Eye, Download } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import { useToast } from "@/hooks/use-toast";

export default function EmployeeLeaveSummary() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    setEmployees(storage.getEmployees());
  }, []);

  const downloadEmployeeLeavePDF = (employee: Employee) => {
    const summary = storage.getEmployeeLeaveSummary(employee.id);
    
    if (summary.totalDays === 0) {
      toast({
        title: "No Data",
        description: `${employee.name} has no approved leaves.`,
        variant: "destructive"
      });
      return;
    }

    try {
      const doc = new jsPDF();
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPosition = 15;

      // Header
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Employee Leave Summary", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 8;

      // Employee Info
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`Name: ${employee.name}`, 15, yPosition);
      yPosition += 5;
      doc.text(`Designation: ${employee.designation}`, 15, yPosition);
      yPosition += 5;
      doc.text(`Department: ${employee.department}`, 15, yPosition);
      yPosition += 5;
      doc.text(`Generated: ${format(new Date(), "PPP p")}`, 15, yPosition);
      yPosition += 10;

      // Summary Box
      doc.setFillColor(220, 220, 220);
      doc.rect(15, yPosition - 2, pageWidth - 30, 12, "F");
      doc.setFont("helvetica", "bold");
      doc.text(`Total Leave Days Taken: ${summary.totalDays}`, pageWidth / 2, yPosition + 3, { align: "center" });
      yPosition += 15;

      // Leave Breakdown
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Leave Breakdown by Type:", 15, yPosition);
      yPosition += 7;

      doc.setFontSize(10);
      summary.leaveBreakdown.forEach((item) => {
        doc.setFont("helvetica", "bold");
        doc.text(`${item.leaveType}: ${item.days} days`, 15, yPosition);
        yPosition += 6;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        item.records.forEach((record) => {
          if (yPosition > pageHeight - 20) {
            doc.addPage();
            yPosition = 15;
          }

          const dateRange = `${format(new Date(record.startDate), "MMM d")} - ${format(new Date(record.endDate), "MMM d, yyyy")}`;
          doc.text(`  • ${dateRange} (${record.approvedDays} days)`, 20, yPosition);
          yPosition += 4;
        });

        doc.setFontSize(10);
        yPosition += 2;
      });

      // Footer
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

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Employee Name</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Department</TableHead>
              <TableHead className="text-center">Total Leave Days</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((employee) => {
              const summary = storage.getEmployeeLeaveSummary(employee.id);
              return (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.name}</TableCell>
                  <TableCell>{employee.designation}</TableCell>
                  <TableCell>{employee.department}</TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-primary/10 text-primary">
                      {summary.totalDays}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Eye className="mr-2 h-4 w-4" /> View Details
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
                                <p className="font-bold text-primary text-lg">{summary.totalDays}</p>
                              </div>
                            </div>

                            <div>
                              <h4 className="font-semibold mb-3">Leave Breakdown</h4>
                              <div className="space-y-3">
                                {summary.leaveBreakdown.map((item) => (
                                  <div key={item.leaveType} className="border rounded-lg p-3">
                                    <div className="flex justify-between items-center mb-2">
                                      <h5 className="font-medium">{item.leaveType}</h5>
                                      <span className="text-sm font-bold text-primary">{item.days} days</span>
                                    </div>
                                    <div className="space-y-1">
                                      {item.records.map((record) => (
                                        <div key={record.id} className="text-sm text-muted-foreground flex justify-between">
                                          <span>{format(new Date(record.startDate), "MMM d")} - {format(new Date(record.endDate), "MMM d, yyyy")}</span>
                                          <span className="font-medium text-foreground">{record.approvedDays}d</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
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
