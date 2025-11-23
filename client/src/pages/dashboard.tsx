import React, { useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import MetricsCards from "@/components/dashboard/metrics-cards";
import NegotiationsList from "@/components/dashboard/negotiations-list";
import { Button } from "@/components/ui/button";
import { Plus, StopCircle } from "lucide-react";
import { useNegotiations } from "@/hooks/use-negotiations";
import { deriveDashboardMetrics, type DashboardMetricSummary } from "@/lib/dashboard-helpers";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: metricsData } = useQuery<DashboardMetricSummary>({
    queryKey: ["/api/dashboard/metrics"],
    staleTime: 60 * 1000,
  });

  const { data: negotiations = [] } = useNegotiations();

  const stopAllMutation = useMutation({
    mutationFn: async () => {
      const running = negotiations?.filter((n) => n.status === "running") ?? [];
      await Promise.all(
        running.map(async (negotiation) => {
          try {
            const queuesResponse = await apiRequest("GET", `/api/simulations/queues?negotiationId=${negotiation.id}`);
            const queues = await queuesResponse.json();
            const activeQueues = queues.filter((q: any) => q.status === "running" || q.status === "pending");
            if (activeQueues.length > 0) {
              await Promise.all(
                activeQueues.map((queue: any) => apiRequest("POST", `/api/simulations/queue/${queue.id}/stop`)),
              );
            }
          } catch (error) {
            console.error(`Failed to stop negotiation ${negotiation.id}:`, error);
          }
        }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/negotiations"] });
      toast({
        title: "Alle Queues gestoppt",
        description: "Alle laufenden Simulationen wurden angehalten.",
      });
    },
    onError: (error) => {
      toast({
        title: "Aktion fehlgeschlagen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  const metrics = useMemo(
    () => metricsData ?? deriveDashboardMetrics(negotiations),
    [metricsData, negotiations],
  );

  const handleNewNegotiation = () => {
    setLocation("/create-negotiation");
  };

  return (
    <div className="space-y-8">
      {/* Page Actions */}
      <div className="flex justify-end items-center gap-3">
        <Button
          variant="outline"
          className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
          onClick={() => stopAllMutation.mutate()}
        >
          <StopCircle className="mr-2 h-4 w-4" />
          Alle stoppen
        </Button>
        <Button
          onClick={handleNewNegotiation}
        >
          <Plus className="mr-2 h-4 w-4" />
          Neue Verhandlung
        </Button>
      </div>

      <div className="space-y-6">
        {/* Key Metrics Cards */}
        <MetricsCards metrics={metrics} />

        {/* Negotiations List */}
        <NegotiationsList />
      </div>
    </div>
  );
}
