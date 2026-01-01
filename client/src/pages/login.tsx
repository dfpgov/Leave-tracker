import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useUserRole } from "@/context/UserRoleContext";

export default function LoginPage() {
  const { toast } = useToast();
  const { login } = useUserRole();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast({ title: "Error", description: "Enter email and password", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      await login(email.trim(), password);
      toast({ title: "Login Successful" });
      window.location.replace("/"); // redirect
    } catch (err: any) {
      console.error(err);
      toast({ title: "Login Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 overflow-hidden">
        <div className="bg-[#161F31] text-white p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full overflow-hidden">
            <img src="/images/logo.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wide">Leave Tracker</h1>
            <p className="text-sm text-slate-300">Department of Films & Publications</p>
          </div>
        </div>
        <CardContent className="p-6 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full h-12" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin mr-2" /> : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
