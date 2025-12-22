import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
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
  User,
  HardDrive,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { firebaseService } from "@/lib/firebaseStorage";
import logoImg from "@/assets/logo.png";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const currentUser = firebaseService.getCurrentUser();
  const [pendingCount, setPendingCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const updatePendingCount = async () => {
      const requests = await firebaseService.getLeaveRequests();
      const pending = requests.filter(r => r.status === 'Pending').length;
      setPendingCount(pending);
    };
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 2000);
    return () => clearInterval(interval);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const handleLogout = () => {
    firebaseService.logout();
    window.location.href = "/login";
  };

  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/" },
    { label: "Employees", icon: Users, href: "/employees" },
    { label: "Holidays", icon: CalendarDays, href: "/holidays" },
    { label: "Leave Types", icon: Settings2, href: "/leave-types" },
    { label: "Approved Leave", icon: FileText, href: "/leave-requests" },
    { label: "Leave Summary", icon: UserCheck, href: "/employee-leave-summary" },
    { label: "Analytics", icon: BarChart3, href: "/analytics" },
    { label: "Storage", icon: HardDrive, href: "/storage" },
    ...(currentUser?.role === 'Admin' ? [{ label: "Users", icon: Shield, href: "/users" }] : []),
  ];

  const sidebarContent = (
    <>
      <div className="py-4 flex items-center px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src={logoImg} alt="Logo" className="h-10 w-10 object-contain rounded-full" />
          <div className="flex flex-col">
            <span className="text-sidebar-foreground font-heading font-semibold text-lg tracking-tight leading-tight">Leave Tracker</span>
            <span className="text-sidebar-foreground/60 text-[10px] leading-tight">Department of Films & Publications</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const showBadge = item.href === '/leave-requests' && pendingCount > 0 && currentUser?.role === 'Admin';
          return (
            <Link key={item.href} href={item.href}>
              <span className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer relative",
                isActive 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}>
                <item.icon className="h-4 w-4" />
                {item.label}
                {showBadge && (
                  <span className="ml-auto bg-red-500 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
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
    </>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 z-50 md:hidden">
        <div className="flex items-center gap-2">
          <img src={logoImg} alt="Logo" className="h-8 w-8 object-contain rounded-full" />
          <span className="text-sidebar-foreground font-heading font-semibold text-base">Leave Tracker</span>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          className="text-sidebar-foreground"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-50 transform transition-transform duration-200 ease-in-out md:hidden",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )} style={{ top: '56px' }}>
        {sidebarContent}
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-sidebar border-r border-sidebar-border flex-col fixed inset-y-0 z-50">
        {sidebarContent}
      </aside>

      <main className="flex-1 md:ml-64 overflow-auto pt-14 md:pt-0">
        <div className="p-4 md:p-8 max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}
