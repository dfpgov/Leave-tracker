import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { firebaseService } from "@/lib/firebaseStorage";
import { useToast } from "@/hooks/use-toast";
import { Shield, UserCheck, Loader2 } from "lucide-react";

export default function Login() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginAsAdmin = async () => {
    setIsLoading(true);
    try {
      const users = await firebaseService.getUsers();
      const adminUser = users.find(u => u.role === 'Admin');
      if (adminUser) {
        firebaseService.setCurrentUser(adminUser);
        toast({
          title: "Login Successful",
          description: `Welcome, ${adminUser.name}! (Admin)`,
        });
        setTimeout(() => {
          window.location.replace("/");
        }, 100);
      } else {
        toast({
          title: "Error",
          description: "Admin user not found. Please refresh the page.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Error",
        description: "Failed to login. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginAsCoAdmin = async () => {
    setIsLoading(true);
    try {
      const users = await firebaseService.getUsers();
      const coAdminUser = users.find(u => u.role === 'CoAdmin');
      if (coAdminUser) {
        firebaseService.setCurrentUser(coAdminUser);
        toast({
          title: "Login Successful",
          description: `Welcome, ${coAdminUser.name}! (CoAdmin)`,
        });
        setTimeout(() => {
          window.location.replace("/");
        }, 100);
      } else {
        toast({
          title: "Error",
          description: "CoAdmin user not found. Please refresh the page.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Error",
        description: "Failed to login. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="absolute inset-0 -z-10 h-full w-full bg-white [background:radial-gradient(125%_125%_at_50%_10%,#fff_40%,#63e_100%)] dark:bg-black dark:[background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#63e_100%)] opacity-30"></div>
      
      <Card className="w-full max-w-md shadow-2xl border-primary/10">
        <CardHeader className="space-y-1 text-center">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mx-auto mb-4">
             <Shield className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-heading font-bold">Leave Management System</CardTitle>
          <CardDescription>
            Select a role to login
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleLoginAsAdmin} 
            className="w-full h-14 text-lg"
            variant="default"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Shield className="mr-3 h-5 w-5" />}
            Login as Admin
          </Button>
          
          <Button 
            onClick={handleLoginAsCoAdmin} 
            className="w-full h-14 text-lg"
            variant="outline"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <UserCheck className="mr-3 h-5 w-5" />}
            Login as CoAdmin
          </Button>

          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              <strong>Admin:</strong> Can approve/reject approved leave<br/>
              <strong>CoAdmin:</strong> Can create, edit, and delete approved leave
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
