import { useState, useEffect } from "react";
import { storage, User } from "@/lib/storage";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { User as UserIcon, Shield, Lock, Save } from "lucide-react";

export default function Profile() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const user = storage.getCurrentUser();
    if (!user) {
      setLocation("/login");
      return;
    }
    setCurrentUser(user);
    setEditName(user.name);
  }, []);

  const handleUpdateProfile = () => {
    if (!currentUser || !editName.trim()) return;

    const updatedUser = { ...currentUser, name: editName.trim() };
    storage.saveUser(updatedUser);
    setCurrentUser(updatedUser);
    setIsEditing(false);
    toast({
      title: "Profile Updated",
      description: "Your name has been updated successfully.",
    });
  };

  const handleUpdatePassword = () => {
    if (!currentUser) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all password fields.",
        variant: "destructive",
      });
      return;
    }

    if (currentUser.password !== currentPassword) {
      toast({
        title: "Error",
        description: "Current password is incorrect.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match.",
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
    storage.saveUser(updatedUser);
    setCurrentUser(updatedUser);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
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
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Current Password</label>
                <Input
                  type="password"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  data-testid="input-current-password"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">New Password</label>
                <Input
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  data-testid="input-new-password"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Confirm New Password</label>
                <Input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  data-testid="input-confirm-password"
                />
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
