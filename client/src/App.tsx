import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Employees from "@/pages/employees";
import Holidays from "@/pages/holidays";
import LeaveTypes from "@/pages/leave-types";
import LeaveRequests from "@/pages/leave-requests";
import Analytics from "@/pages/analytics";
import Layout from "@/components/layout";
import { storage } from "@/lib/storage";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const isAuthenticated = storage.isAuthenticated();
  
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
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

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
