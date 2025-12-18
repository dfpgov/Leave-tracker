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
  UserCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { storage } from "@/lib/storage";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

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
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
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
                <a className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}>
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 min-h-screen bg-background/50">
        <header className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 px-8 flex items-center justify-between">
          <h2 className="text-lg font-semibold font-heading text-foreground capitalize">
             {navItems.find(item => item.href === location)?.label || 'Dashboard'}
          </h2>
          <div className="flex items-center gap-4">
             <div className="text-sm text-muted-foreground">
                Logged in as <span className="font-medium text-foreground">Akash</span>
             </div>
          </div>
        </header>
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
