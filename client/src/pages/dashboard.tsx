import { useQuery } from "@tanstack/react-query";
import MetricsCards from "@/components/dashboard/metrics-cards";
import LiveNegotiations from "@/components/dashboard/live-negotiations";
import SimulationRunHistory from "@/components/dashboard/simulation-run-history";
import SuccessChart from "@/components/dashboard/success-chart";
import AgentPerformance from "@/components/dashboard/agent-performance";
import QuickActions from "@/components/dashboard/quick-actions";
import EvaluationBackfillCard from "@/components/dashboard/evaluation-backfill-card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Dashboard() {
  const { data: metrics } = useQuery<any>({
    queryKey: ["/api/dashboard/metrics"],
  });

  const { data: successTrends } = useQuery<any[]>({
    queryKey: ["/api/dashboard/success-trends"],
  });

  const { data: topAgents } = useQuery<any[]>({
    queryKey: ["/api/dashboard/top-agents"],
  });

  const { data: negotiations = [], isLoading: isLoadingNegotiations } = useQuery<any[]>({
    queryKey: ["/api/negotiations"],
    refetchInterval: 5000,
  });

  const handleNewNegotiation = () => {
    // Navigate to negotiation creation
    window.location.href = "/negotiations";
  };

  return (
    <div className="p-6 space-y-6">
      {/* Key Metrics Cards */}
      {metrics && <MetricsCards metrics={metrics} />}

      {/* Real-time Monitoring Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Negotiations */}
        <LiveNegotiations negotiations={negotiations.filter(n => n.status === 'running' || n.status === 'active')} />

        {/* Simulation Run History */}
        <SimulationRunHistory negotiations={negotiations} isLoading={isLoadingNegotiations} />

        {/* AI Evaluation Status */}
        <EvaluationBackfillCard />
      </div>

      {/* Performance Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Success Rate Trends */}
        <div className="lg:col-span-2">
          {successTrends && <SuccessChart data={successTrends} />}
        </div>

        {/* Agent Performance */}
        {topAgents && <AgentPerformance agents={topAgents} />}
      </div>

      {/* Quick Actions Panel */}
      <QuickActions />

      {/* Floating Action Button */}
      <Button
        onClick={handleNewNegotiation}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-shadow"
        size="icon"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
}
