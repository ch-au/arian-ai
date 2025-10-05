import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Negotiations from "@/pages/negotiations";
import Configure from "@/pages/configure";
import Monitor from "@/pages/monitor";
import SimulationMonitor from "@/pages/simulation-monitor";
import AnalysisDashboard from "@/pages/analysis-new";
import NegotiationAnalysis from "@/pages/negotiation-analysis";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Negotiations} />
      <Route path="/negotiations" component={Negotiations} />
      <Route path="/configure" component={Configure} />
      <Route path="/configure/:id" component={Configure} />
      <Route path="/monitor" component={Monitor} />
      <Route path="/monitor/:id" component={Monitor} />
      <Route path="/simulation-monitor/:negotiationId" component={SimulationMonitor} />
      <Route path="/analysis/:negotiationId" component={AnalysisDashboard} />
      <Route path="/negotiations/:id/analysis" component={NegotiationAnalysis} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="flex h-screen bg-gray-50">
          <Sidebar />
          <main className="flex-1 flex flex-col overflow-hidden">
            <Header />
            <div className="flex-1 overflow-y-auto p-6">
              <Router />
            </div>
          </main>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
