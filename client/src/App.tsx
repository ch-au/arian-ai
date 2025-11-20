import React from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from './contexts/auth-context';
import { NegotiationProvider } from './contexts/negotiation-context';
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import NegotiationMonitor from "@/pages/monitor";
import NegotiationAnalysis from "@/pages/negotiation-analysis";
import PlaybookPage from "@/pages/playbook";
import CreateNegotiation from "@/pages/create-negotiation";
import LoginPage from "@/pages/login";
import SplashScreen from "@/pages/splash-screen";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-50/50">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

function LandingPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <SplashScreen />;
  }

  return (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  );
}

function ProtectedPage({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  React.useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AppLayout>
      {children}
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      {/* Login Page */}
      <Route path="/login" component={LoginPage} />

      {/* Landing Page (Splash or Dashboard) */}
      <Route path="/" component={LandingPage} />

      {/* Protected Routes */}
      <Route path="/create-negotiation">
        <ProtectedPage>
          <CreateNegotiation />
        </ProtectedPage>
      </Route>

      <Route path="/monitor">
        <ProtectedPage>
          <NegotiationMonitor />
        </ProtectedPage>
      </Route>

      <Route path="/monitor/:id">
        <ProtectedPage>
          <NegotiationMonitor />
        </ProtectedPage>
      </Route>

      <Route path="/analysis">
        <ProtectedPage>
          <NegotiationAnalysis />
        </ProtectedPage>
      </Route>

      <Route path="/analysis/:id">
        <ProtectedPage>
          <NegotiationAnalysis />
        </ProtectedPage>
      </Route>

      <Route path="/playbook/:id">
        <ProtectedPage>
          <PlaybookPage />
        </ProtectedPage>
      </Route>

      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <NegotiationProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </NegotiationProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
