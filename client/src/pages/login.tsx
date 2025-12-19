import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { storage, User } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { Lock, User as UserIcon } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [users, setUsers] = useState<User[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    setUsers(storage.getUsers());
  }, []);

  const handleLogin = (userId: string) => {
    storage.login(userId);
    const user = users.find(u => u.id === userId);
    toast({
      title: "Login Successful",
      description: `Welcome, ${user?.name}! (${user?.role})`,
    });
    setLocation("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="absolute inset-0 -z-10 h-full w-full bg-white [background:radial-gradient(125%_125%_at_50%_10%,#fff_40%,#63e_100%)] dark:bg-black dark:[background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#63e_100%)] opacity-30"></div>
      
      <Card className="w-full max-w-md shadow-2xl border-primary/10">
        <CardHeader className="space-y-1 text-center">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mx-auto mb-4">
             <Lock className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-heading font-bold">Welcome Back</CardTitle>
          <CardDescription>
            Select your account to access the leave portal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {users.map((user) => (
            <Button
              key={user.id}
              onClick={() => handleLogin(user.id)}
              variant="outline"
              className="w-full h-16 justify-start px-4 hover:bg-primary/5 hover:border-primary/50 transition-all"
            >
              <div className="flex items-center gap-3 w-full">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.role}</p>
                </div>
              </div>
            </Button>
          ))}
        </CardContent>
        <CardFooter className="flex justify-center text-sm text-muted-foreground bg-muted/30 py-4 rounded-b-lg">
          <p>Select your role to continue</p>
        </CardFooter>
      </Card>
    </div>
  );
}
