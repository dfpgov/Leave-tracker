import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { storage, User } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { User as UserIcon, Lock, Shield, Mail } from "lucide-react";

export default function Profile() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const user = storage.getCurrentUser();
    if (!user) {
      setLocation("/login");
      return;
    }
    setCurrentUser(user);
  }, []);

  const handlePasswordChange = () => {
    if (!password) {
      toast({
        title: "Error",
        description: "Password cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Password Updated",
      description: "Your password has been changed successfully.",
    });
    setPassword("");
  };

  const handleForgotPassword = () => {
    toast({
      title: "Password Reset Link Sent",
      description: "Check your email for password reset instructions.",
    });
  };

  if (!currentUser) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-heading">Profile & Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <UserIcon className="w-8 h-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">{currentUser.name}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Shield className="w-4 h-4" />
                {currentUser.role} User
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account Information</CardTitle>
          <CardDescription>View your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Name</label>
              <div className="p-3 bg-muted/50 rounded-lg text-foreground font-medium">
                {currentUser.name}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Role</label>
              <div className="p-3 bg-muted/50 rounded-lg text-foreground font-medium">
                {currentUser.role}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <div className="p-3 bg-muted/50 rounded-lg text-foreground font-medium flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {currentUser.name.toLowerCase()}@company.com
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Member Since</label>
              <div className="p-3 bg-muted/50 rounded-lg text-foreground font-medium">
                {new Date(currentUser.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Security Settings</CardTitle>
          <CardDescription>Manage your password and security</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <Lock className="mr-2 h-4 w-4" />
                  Change Password
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Change Password</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">New Password</label>
                    <Input
                      type="password"
                      placeholder="Enter new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button onClick={handlePasswordChange} className="w-full">
                    Update Password
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleForgotPassword}
            >
              <Mail className="mr-2 h-4 w-4" />
              Forgot Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {currentUser.role === 'Admin' && (
        <Card className="border-2 border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Admin Controls</CardTitle>
            <CardDescription>Manage users and system settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Only administrators can add and delete users from the system.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {currentUser.role === 'Admin' ? (
              <>
                <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded text-green-700">
                  <span>✓</span> Full system access
                </div>
                <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded text-green-700">
                  <span>✓</span> Add and delete users
                </div>
                <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded text-green-700">
                  <span>✓</span> Manage all operations
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 p-2 bg-blue-500/10 rounded text-blue-700">
                  <span>✓</span> Full system access to all features
                </div>
                <div className="flex items-center gap-2 p-2 bg-gray-500/10 rounded text-gray-700">
                  <span>✗</span> Cannot add or delete users
                </div>
                <div className="flex items-center gap-2 p-2 bg-blue-500/10 rounded text-blue-700">
                  <span>✓</span> Can manage all operational data
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
