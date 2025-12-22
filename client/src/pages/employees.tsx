import { useState, useEffect } from "react";
import { firebaseService, Employee } from "@/lib/firebaseStorage";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const employeeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  designation: z.string().min(1, "Designation is required"),
  department: z.string().min(1, "Section is required"),
  gender: z.enum(["Male", "Female", "Other"]),
});

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const itemsPerPage = 50;
  const { toast } = useToast();

  const form = useForm<z.infer<typeof employeeSchema>>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: "",
      designation: "",
      department: "",
      gender: "Male",
    },
  });

  useEffect(() => {
    async function loadData() {
      const data = await firebaseService.getEmployees();
      setEmployees(data.sort((a, b) => a.name.localeCompare(b.name)));
    }
    loadData();
  }, []);

  const filteredEmployees = employees.filter((e) =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.designation.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name));

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEmployees = filteredEmployees.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const onSubmit = async (values: z.infer<typeof employeeSchema>) => {
    const newEmployee: Employee = {
      id: editingEmployee ? editingEmployee.id : firebaseService.generateEmployeeId(),
      ...values,
      lastEdited: new Date().toISOString(),
      doneBy: firebaseService.getCurrentUserId(),
    };

    await firebaseService.saveEmployee(newEmployee);
    const data = await firebaseService.getEmployees();
    setEmployees(data.sort((a, b) => a.name.localeCompare(b.name)));
    setIsDialogOpen(false);
    setEditingEmployee(null);
    form.reset();
    setCurrentPage(1);
    toast({
      title: editingEmployee ? "Employee Updated" : "Employee Added",
      description: `${values.name} has been ${editingEmployee ? "updated" : "added"} successfully.`,
    });
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    form.reset({
      name: employee.name,
      designation: employee.designation,
      department: employee.department,
      gender: employee.gender,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this employee?")) {
      await firebaseService.deleteEmployee(id);
      const data = await firebaseService.getEmployees();
      setEmployees(data.sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      setCurrentPage(1);
      toast({
        title: "Employee Deleted",
        variant: "destructive",
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.size} employee(s)?`)) {
      await firebaseService.deleteEmployees(Array.from(selectedIds));
      const data = await firebaseService.getEmployees();
      setEmployees(data.sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedIds(new Set());
      setCurrentPage(1);
      toast({
        title: "Employees Deleted",
        description: `${selectedIds.size} employee(s) have been deleted.`,
        variant: "destructive",
      });
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedEmployees.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedEmployees.map(e => e.id)));
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

  const openAddDialog = () => {
    setEditingEmployee(null);
    form.reset({
        name: "",
        designation: "",
        department: "",
        gender: "Male",
    });
    setIsDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold font-heading">Employee Management</h1>
            <p className="text-muted-foreground mt-1">Manage your workforce details</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog} className="shadow-lg shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" /> Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingEmployee ? "Edit Employee" : "Add New Employee"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="designation"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Designation</FormLabel>
                        <FormControl>
                            <Input placeholder="Software Engineer" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Section</FormLabel>
                        <FormControl>
                            <Input placeholder="IT" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">
                  {editingEmployee ? "Update Employee" : "Save Employee"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
           <div className="relative flex-1 w-full sm:max-w-sm">
             <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
             <Input 
                placeholder="Search employees..." 
                className="pl-9 bg-muted/30" 
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
             />
           </div>
           <div className="flex items-center gap-4">
             {selectedIds.size > 0 && (
               <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                 <Trash2 className="mr-2 h-4 w-4" /> Delete Selected ({selectedIds.size})
               </Button>
             )}
             <div className="text-sm text-muted-foreground whitespace-nowrap">
               Total: {employees.length}
             </div>
           </div>
        </div>
        <div className="overflow-x-auto">
        <Table>
            <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-12">
                  <Checkbox
                    checked={paginatedEmployees.length > 0 && selectedIds.size === paginatedEmployees.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Last Edited</TableHead>
                <TableHead className="text-right">Actions</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {paginatedEmployees.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        {filteredEmployees.length === 0 ? "No employees found." : "No data on this page."}
                    </TableCell>
                </TableRow>
            ) : (
                paginatedEmployees.map((employee) => (
                    <TableRow key={employee.id} className="group">
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(employee.id)}
                        onCheckedChange={() => toggleSelect(employee.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{employee.name}</TableCell>
                    <TableCell>{employee.designation}</TableCell>
                    <TableCell>{employee.department}</TableCell>
                    <TableCell>{employee.gender}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                        {format(new Date(employee.lastEdited), "PP p")}
                    </TableCell>
                    <TableCell className="text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(employee)}>
                            <Pencil className="h-4 w-4 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(employee.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
