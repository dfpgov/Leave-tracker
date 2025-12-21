import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Users, 
  CalendarDays, 
  Settings2, 
  FileText, 
  BarChart3, 
  LogOut,
  UserCheck,
  Shield,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { storage } from "@/lib/storage";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const currentUser = storage.getCurrentUser();

  const handleLogout = () => {
    storage.logout();
    window.location.href = "/login";
  };

  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/" },
    { label: "Employees", icon: Users, href: "/employees" },
    { label: "Holidays", icon: CalendarDays, href: "/holidays" },
    { label: "Leave Types", icon: Settings2, href: "/leave-types" },
    { label: "Leave Requests", icon: FileText, href: "/leave-requests" },
    { label: "Leave Summary", icon: UserCheck, href: "/employee-leave-summary" },
    { label: "Analytics", icon: BarChart3, href: "/analytics" },
    ...(currentUser?.role === 'Admin' ? [{ label: "Users", icon: Shield, href: "/users" }] : []),
  ];

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col fixed inset-y-0 z-50">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">L</span>
            </div>
            <span className="text-sidebar-foreground font-heading font-semibold text-lg tracking-tight">LeaveManager</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <span className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}>
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-2">
          <Link href="/profile">
            <span className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
              location === "/profile" 
                ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}>
              <User className="h-4 w-4" />
              Profile
            </span>
          </Link>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-3" />
            Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 ml-64 overflow-auto">
        <div className="p-8 max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}
