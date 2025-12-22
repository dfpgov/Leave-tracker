import { useState, useEffect } from "react";
import { firebaseService, LeaveType } from "@/lib/firebaseStorage";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const leaveTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  maxDays: z.string().optional(),
});

export default function LeaveTypes() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof leaveTypeSchema>>({
    resolver: zodResolver(leaveTypeSchema),
    defaultValues: {
      name: "",
      maxDays: "",
    },
  });

  useEffect(() => {
    async function loadData() {
      const data = await firebaseService.getLeaveTypes();
      setLeaveTypes(data);
    }
    loadData();
  }, []);

  const onSubmit = async (values: z.infer<typeof leaveTypeSchema>) => {
    const newLeaveType: LeaveType = {
      id: firebaseService.generateLeaveTypeId(),
      name: values.name,
      maxDays: values.maxDays ? parseInt(values.maxDays) : null,
      doneBy: firebaseService.getCurrentUserId(),
    };

    await firebaseService.saveLeaveType(newLeaveType);
    const data = await firebaseService.getLeaveTypes();
    setLeaveTypes(data);
    setIsDialogOpen(false);
    form.reset();
    toast({
      title: "Leave Type Added",
      description: `${values.name} added successfully.`,
    });
  };

  const handleDelete = async (id: string, name: string) => {
    if (name === "Casual Leave") {
      toast({
        title: "Cannot Delete",
        description: "Casual Leave is a permanent leave type and cannot be deleted.",
        variant: "destructive",
      });
      return;
    }
    if (confirm("Delete this leave type?")) {
      await firebaseService.deleteLeaveType(id);
      const data = await firebaseService.getLeaveTypes();
      setLeaveTypes(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-heading">Leave Types</h1>
            <p className="text-muted-foreground mt-1">Configure leave categories and limits</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" /> Add Leave Type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Leave Type</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Leave Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Casual Leave" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Days (Optional)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Leave blank for no limit" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">Save Leave Type</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
        <Table>
            <TableHeader>
            <TableRow className="bg-muted/30">
                <TableHead>Leave ID</TableHead>
                <TableHead>Leave Name</TableHead>
                <TableHead>Max Days Allowed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {leaveTypes.map((type) => (
                <TableRow key={type.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{type.id}</TableCell>
                <TableCell className="font-medium">{type.name}</TableCell>
                <TableCell>
                    {type.maxDays ? (
                        <span className="font-medium text-foreground">{type.maxDays} days</span>
                    ) : (
                        <span className="text-muted-foreground italic">Unlimited</span>
                    )}
                </TableCell>
                <TableCell className="text-right">
                    {type.name !== "Casual Leave" && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(type.id, type.name)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                </TableCell>
                </TableRow>
            ))}
            </TableBody>
        </Table>
      </div>
    </div>
  );
}
