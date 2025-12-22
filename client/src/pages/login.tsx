import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { firebaseService } from "@/lib/firebaseStorage";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      toast({
        title: "Error",
        description: "Please enter both username and password.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const user = await firebaseService.login(username.trim(), password);
      if (user) {
        toast({
          title: "Login Successful",
          description: `Welcome, ${user.name}! (${user.role})`,
        });
        setTimeout(() => {
          window.location.replace("/");
        }, 100);
      } else {
        toast({
          title: "Login Failed",
          description: "Invalid username or password. Please try again.",
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
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 overflow-hidden">
        {/* Header matching the image */}
        <div className="bg-[#1e3a5f] text-white p-6">
          <div className="flex items-center gap-4">
            {/* Logo - circular with government seal style */}
            <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0 border-2 border-red-400">
              <svg viewBox="0 0 100 100" className="w-10 h-10">
                <circle cx="50" cy="50" r="45" fill="#c41e3a" stroke="#ffd700" strokeWidth="2"/>
                <path d="M50 20 L55 35 L70 35 L58 45 L63 60 L50 50 L37 60 L42 45 L30 35 L45 35 Z" fill="#ffd700"/>
                <circle cx="50" cy="50" r="20" fill="none" stroke="#ffd700" strokeWidth="1"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-wide">Leave Tracker</h1>
              <p className="text-sm text-slate-300">Department of Films & Publications</p>
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                className="h-12"
                data-testid="input-username"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="h-12 pr-10"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button 
              type="submit"
              className="w-full h-12 text-lg bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </Button>
          </form>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground text-center mb-3">
              Default Credentials
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="font-semibold text-foreground">Admin</p>
                <p className="text-muted-foreground text-xs">admin123</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="font-semibold text-foreground">CoAdmin</p>
                <p className="text-muted-foreground text-xs">coadmin123</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
