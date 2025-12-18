import { useState, useEffect } from "react";
import { storage, LeaveType } from "@/lib/storage";
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
  maxDays: z.string().optional(), // String because input type=number returns string usually
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
    setLeaveTypes(storage.getLeaveTypes());
  }, []);

  const onSubmit = (values: z.infer<typeof leaveTypeSchema>) => {
    const newLeaveType: LeaveType = {
      id: Math.random().toString(36).substr(2, 9),
      name: values.name,
      maxDays: values.maxDays ? parseInt(values.maxDays) : null,
    };

    storage.saveLeaveType(newLeaveType);
    setLeaveTypes(storage.getLeaveTypes());
    setIsDialogOpen(false);
    form.reset();
    toast({
      title: "Leave Type Added",
      description: `${values.name} added successfully.`,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this leave type?")) {
      storage.deleteLeaveType(id);
      setLeaveTypes(storage.getLeaveTypes());
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold font-heading">Leave Types</h1>
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

      <div className="bg-card rounded-xl border shadow-sm">
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
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(type.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </TableCell>
                </TableRow>
            ))}
            </TableBody>
        </Table>
      </div>
    </div>
  );
}
