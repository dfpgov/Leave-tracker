import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Employees from "@/pages/employees";
import Holidays from "@/pages/holidays";
import LeaveTypes from "@/pages/leave-types";
import LeaveRequests from "@/pages/leave-requests";
import Analytics from "@/pages/analytics";
import EmployeeLeaveSummary from "@/pages/employee-leave-summary";
import UserManagement from "@/pages/user-management";
import Profile from "@/pages/profile";
import StoragePage from "@/pages/storage";
import Layout from "@/components/layout";
import { initializeFirebase } from "@/lib/firebase";
import { firebaseService } from "@/lib/firebaseStorage";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <Switch>
      <Route path="/login">
        <Login />
      </Route>

      {isAuthenticated ? (
        <>
          <Route path="/">
            <ProtectedRoute component={Dashboard} />
          </Route>
          <Route path="/employees">
            <ProtectedRoute component={Employees} />
          </Route>
          <Route path="/holidays">
            <ProtectedRoute component={Holidays} />
          </Route>
          <Route path="/leave-types">
            <ProtectedRoute component={LeaveTypes} />
          </Route>
          <Route path="/leave-requests">
            <ProtectedRoute component={LeaveRequests} />
          </Route>
          <Route path="/analytics">
            <ProtectedRoute component={Analytics} />
          </Route>
          <Route path="/employee-leave-summary">
            <ProtectedRoute component={EmployeeLeaveSummary} />
          </Route>
          <Route path="/users">
            <ProtectedRoute component={UserManagement} />
          </Route>
          <Route path="/profile">
            <ProtectedRoute component={Profile} />
          </Route>
          <Route path="/storage">
            <ProtectedRoute component={StoragePage} />
          </Route>
        </>
      ) : null}

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
   const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        // Initialize Firebase
        await initializeFirebase();
        
        // Seed initial data if needed
        try {
          await firebaseService.seedInitialData();
        } catch (seedError) {
          // Seeding error is non-fatal - data may already exist
          console.log("Seed data check completed");
        }
        
        // Check if user is authenticated
        const currentUser = firebaseService.getCurrentUser();
        setIsAuthenticated(!!currentUser);
        setIsInitialized(true);
      } catch (error: any) {
        console.error("Initialization error:", error?.message || error);
        setInitError("Failed to connect to database. Please try again.");
        setIsInitialized(true);
      }
    }
    init();
  }, []);

  if (!isInitialized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Connecting to database...</p>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive">{initError}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router isAuthenticated={isAuthenticated} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}


export default App;
