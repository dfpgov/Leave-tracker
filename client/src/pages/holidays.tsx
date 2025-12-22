import { useState, useEffect } from "react";
import { firebaseService, Holiday, calculateDays } from "@/lib/firebaseStorage";
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
import { format } from "date-fns";

const holidaySchema = z.object({
  name: z.string().min(1, "Name is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

export default function Holidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof holidaySchema>>({
    resolver: zodResolver(holidaySchema),
    defaultValues: {
      name: "",
      startDate: "",
      endDate: "",
    },
  });

  useEffect(() => {
    async function loadData() {
      const data = await firebaseService.getHolidays();
      setHolidays(data);
    }
    loadData();
  }, []);

  const onSubmit = async (values: z.infer<typeof holidaySchema>) => {
    const totalDays = calculateDays(values.startDate, values.endDate);
    
    const newHoliday: Holiday = {
      id: firebaseService.generateHolidayId(),
      ...values,
      totalDays,
      doneBy: firebaseService.getCurrentUserId(),
    };

    await firebaseService.saveHoliday(newHoliday);
    const data = await firebaseService.getHolidays();
    setHolidays(data);
    setIsDialogOpen(false);
    form.reset();
    toast({
      title: "Holiday Added",
      description: `${values.name} added successfully.`,
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this holiday?")) {
      await firebaseService.deleteHoliday(id);
      const data = await firebaseService.getHolidays();
      setHolidays(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-heading">Holiday Management</h1>
            <p className="text-muted-foreground mt-1">Configure official holidays</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" /> Add Holiday
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Holiday</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Holiday Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Independence Day" {...field} />
                      </FormControl>
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
                <Button type="submit" className="w-full">Save Holiday</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
        <Table>
            <TableHeader>
            <TableRow className="bg-muted/30">
                <TableHead>Holiday Name</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Total Days</TableHead>
                <TableHead className="text-right">Actions</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {holidays.map((holiday) => (
                <TableRow key={holiday.id}>
                <TableCell className="font-medium">{holiday.name}</TableCell>
                <TableCell>{format(new Date(holiday.startDate), "PP")}</TableCell>
                <TableCell>{format(new Date(holiday.endDate), "PP")}</TableCell>
                <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {holiday.totalDays} days
                    </span>
                </TableCell>
                <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(holiday.id)}>
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
