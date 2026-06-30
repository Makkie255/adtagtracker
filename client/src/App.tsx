import { Switch, Route, Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useInactivityTimeout } from "@/hooks/use-inactivity-timeout";
import { useTabPresence } from "@/hooks/use-tab-presence";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Sites from "@/pages/sites";
import SiteDetail from "@/pages/site-detail";
import CreateSite from "@/pages/create-site";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import AdminPanel from "@/pages/admin-panel";
import Archived from "@/pages/archived";
import Profile from "@/pages/profile";
import Login from "@/pages/login";
import AcceptInvite from "@/pages/accept-invite";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";

function Router() {
  const { isLoggedIn, user, logout } = useAuth();

  useTabPresence(isLoggedIn);

  useInactivityTimeout(() => {
    if (isLoggedIn) {
      logout().finally(() => {
        window.location.href = "/login";
      });
    }
  }, 15);

  return (
    <Switch>
      <Route path="/login">
        {() => (isLoggedIn ? <Redirect to="/" /> : <Login />)}
      </Route>
      <Route path="/accept-invite" component={AcceptInvite} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/">
        {() => (isLoggedIn ? <Dashboard /> : <Redirect to="/login" />)}
      </Route>
      <Route path="/sites">
        {() => (isLoggedIn ? <Sites /> : <Redirect to="/login" />)}
      </Route>
      <Route path="/sites/new">
        {() => (isLoggedIn ? <CreateSite /> : <Redirect to="/login" />)}
      </Route>
      <Route path="/sites/:id">
        {() => (isLoggedIn ? <SiteDetail /> : <Redirect to="/login" />)}
      </Route>
      <Route path="/reports">
        {() => (isLoggedIn ? <Reports /> : <Redirect to="/login" />)}
      </Route>
      <Route path="/archived">
        {() => (isLoggedIn ? <Archived /> : <Redirect to="/login" />)}
      </Route>
      <Route path="/profile">
        {() =>
          isLoggedIn && user ? (
            <Profile userName={user.name} userEmail={user.email} userRole={user.role} />
          ) : (
            <Redirect to="/login" />
          )
        }
      </Route>
      <Route path="/settings">
        {() => (isLoggedIn ? <Settings /> : <Redirect to="/login" />)}
      </Route>
      <Route path="/admin">
        {() => (isLoggedIn && user?.role === "admin" ? <AdminPanel /> : <Redirect to="/" />)}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function useSidebarCounts(enabled: boolean) {
  const { data } = useQuery<{
    activeSiteCount: number;
    archivedSiteCount: number;
  }>({
    queryKey: ["/api/dashboard/summary"],
    staleTime: 30_000,
    enabled,
  });
  return {
    siteCount: data?.activeSiteCount ?? 0,
    archivedCount: data?.archivedSiteCount ?? 0,
  };
}

function AppContent() {
  const style = {
    "--sidebar-width": "16rem",
  };
  const { isLoggedIn, isLoading, user } = useAuth();
  const counts = useSidebarCounts(isLoggedIn);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <TooltipProvider>
      {isLoggedIn ? (
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar
              siteCount={counts.siteCount}
              archivedCount={counts.archivedCount}
              userRole={user?.role ?? "user"}
              userName={user?.name ?? "User"}
              userEmail={user?.email}
            />
            <div className="flex flex-col flex-1 overflow-hidden">
              <header className="flex items-center justify-between px-6 py-3 border-b">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <ThemeToggle />
              </header>
              <main className="flex-1 overflow-auto px-8 py-6">
                <div className="max-w-7xl mx-auto">
                  <Router />
                </div>
              </main>
            </div>
          </div>
        </SidebarProvider>
      ) : (
        <Router />
      )}
      <Toaster />
    </TooltipProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
