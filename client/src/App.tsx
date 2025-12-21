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
import Layout from "@/components/layout";
import { storage } from "@/lib/storage";

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
        </>
      ) : null}

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Initialize users
    storage.initializeUsers();
    setIsAuthenticated(storage.isAuthenticated());
    setIsInitialized(true);
  }, []);

  if (!isInitialized) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
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
