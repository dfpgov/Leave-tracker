import { useState, useEffect } from "react";
import { firebaseService, User } from "@/lib/firebaseStorage";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User as UserIcon, Shield, Lock, Save, Eye, EyeOff, AlertTriangle } from "lucide-react";

export default function Profile() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const user = firebaseService.getCurrentUser();
    if (!user) {
      setLocation("/login");
      return;
    }
    setCurrentUser(user);
    setEditName(user.name);
  }, []);

  const handleUpdateProfile = async () => {
    if (!currentUser || !editName.trim()) return;

    const updatedUser = { ...currentUser, name: editName.trim() };
    await firebaseService.saveUser(updatedUser);
    firebaseService.setCurrentUser(updatedUser);
    setCurrentUser(updatedUser);
    setIsEditing(false);
    toast({
      title: "Profile Updated",
      description: "Your name has been updated successfully.",
    });
  };

  const handleUpdatePassword = async () => {
    if (!currentUser) return;

    if (!newPassword.trim()) {
      toast({
        title: "Error",
        description: "Please enter a new password.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 4) {
      toast({
        title: "Error",
        description: "Password must be at least 4 characters.",
        variant: "destructive",
      });
      return;
    }

    const updatedUser = { ...currentUser, password: newPassword };
    await firebaseService.saveUser(updatedUser);
    firebaseService.setCurrentUser(updatedUser);
    setCurrentUser(updatedUser);
    setNewPassword("");
    toast({
      title: "Password Updated",
      description: "Your password has been changed successfully.",
    });
  };

  if (!currentUser) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold font-heading">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account settings</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <UserIcon className="w-8 h-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">{currentUser.name}</CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Shield className="w-4 h-4" />
                  {currentUser.role}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <UserIcon className="h-4 w-4" /> User Information
            </h3>
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Username</label>
                {isEditing ? (
                  <div className="flex gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Enter your name"
                      data-testid="input-edit-name"
                    />
                    <Button onClick={handleUpdateProfile} data-testid="button-save-name">
                      <Save className="h-4 w-4 mr-2" /> Save
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setIsEditing(false);
                      setEditName(currentUser.name);
                    }} data-testid="button-cancel-edit">
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="font-medium" data-testid="text-username">{currentUser.name}</span>
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} data-testid="button-edit-name">
                      Edit
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <span className="font-medium" data-testid="text-role">{currentUser.role}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Lock className="h-4 w-4" /> Change Password
            </h3>
            
            <Alert variant="default" className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Make sure to remember your new password. You will need it to log in next time.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">New Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                    data-testid="input-new-password"
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
              <Button onClick={handleUpdatePassword} className="w-full" data-testid="button-update-password">
                Update Password
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
