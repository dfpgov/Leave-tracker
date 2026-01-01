import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { firebaseService, User } from "@/lib/firebaseStorage";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({
        title: "Error",
        description: "Please enter both username and password",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Fetch user from your users collection
      const user: User | null = await firebaseService.getUserByUsername(username.trim());

      if (!user) {
        toast({ title: "Login Failed", description: "User not found", variant: "destructive" });
      } else if (user.password !== password) {
        toast({ title: "Login Failed", description: "Invalid password", variant: "destructive" });
      } else {
        toast({ title: "Login Successful", description: `Welcome, ${user.name} (${user.role})!` });
        localStorage.setItem("currentUser", JSON.stringify(user));
        window.location.replace("/"); // redirect to dashboard
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 overflow-hidden">
        <div className="bg-[#161F31] text-white p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full overflow-hidden">
            <img
              src="https://raw.githubusercontent.com/dfpgov/Leave-tracker/main/client/public/images_(13)_1766356753117.png"
              alt="Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wide">Leave Tracker</h1>
            <p className="text-sm text-slate-300">Department of Films & Publications</p>
          </div>
        </div>

        <CardContent className="p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
