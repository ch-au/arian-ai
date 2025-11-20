import React from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StackHandler, StackProvider, StackTheme, useUser } from '@stackframe/react';
import { stackClientApp } from './stack';
import { NegotiationProvider } from './contexts/negotiation-context';
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import NegotiationMonitor from "@/pages/monitor";
import NegotiationAnalysis from "@/pages/negotiation-analysis";
import PlaybookPage from "@/pages/playbook";
import CreateNegotiation from "@/pages/create-negotiation";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import SplashScreen from "@/pages/splash-screen";

function HandlerRoutes() {
  const [location] = useLocation();
  return <StackHandler app={stackClientApp} location={location} fullPage />;
}


function Router() {
  return (
    <Switch>
      {/* Auth Handler */}
      <Route path="/handler/:rest*" component={HandlerRoutes} />

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

function ProtectedPage({ children }: { children: React.ReactNode }) {
  useUser({ or: "redirect" });
  return (
    <AppLayout>
      {children}
    </AppLayout>
  );
}

function LandingPage() {
  const user = useUser();
  if (user) {
    return (
      <AppLayout>
        <Dashboard />
      </AppLayout>
    );
  }
  return <SplashScreen />;
}

function App() {
  return (
    <StackProvider app={stackClientApp}>
      <StackTheme>
        <QueryClientProvider client={queryClient}>
          <NegotiationProvider>
            <TooltipProvider>
              <Router />
              <Toaster />
            </TooltipProvider>
          </NegotiationProvider>
        </QueryClientProvider>
      </StackTheme>
    </StackProvider>
  );
}

export default App;
