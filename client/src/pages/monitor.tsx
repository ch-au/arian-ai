/**
 * Monitor Page - Real-time Simulation Monitoring
 * Shows live progress of simulation queue with WebSocket updates
 */

import { useState, useEffect, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, AlertCircle, StopCircle } from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";

// Monitor Components
import {
  SimulationQueueOverview,
  SimulationQueueOverviewSkeleton,
} from "@/components/monitor/SimulationQueueOverview";
import {
  ActiveRunsTable,
  ActiveRunsTableSkeleton,
} from "@/components/monitor/ActiveRunsTable";
import {
  LiveActivityFeed,
  LiveActivityFeedSkeleton,
  type ActivityEvent,
} from "@/components/monitor/LiveActivityFeed";

interface SimulationRun {
  id: string;
  negotiationId: string;
  queueId: string;
  techniqueId: string;
  tacticId: string;
  status: "pending" | "running" | "completed" | "failed";
  currentRound: number;
  maxRounds: number;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

export default function MonitorPage() {
  const [match, params] = useRoute("/monitor/:negotiationId");
  const [, setLocation] = useLocation();
  const negotiationId = params?.negotiationId;

  // Local state for real-time updates
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [liveRuns, setLiveRuns] = useState<SimulationRun[]>([]);

  // Fetch negotiation details
  const {
    data: negotiation,
    isLoading: loadingNegotiation,
  } = useQuery<any>({
    queryKey: [`/api/negotiations/${negotiationId}`],
    enabled: !!negotiationId,
  });

  // Fetch simulation queue
  const {
    data: queueData,
    isLoading: loadingQueue,
  } = useQuery<any>({
    queryKey: [`/api/simulations/queue/by-negotiation/${negotiationId}`],
    enabled: !!negotiationId,
  });

  // Fetch simulation runs
  const {
    data: runsData,
    isLoading: loadingRuns,
    refetch: refetchRuns,
  } = useQuery<any>({
    queryKey: [`/api/simulations/queue/${queueData?.queueId}/runs`],
    enabled: !!queueData?.queueId,
  });

  // Fetch techniques and tactics for display
  const { data: techniques = [] } = useQuery<any[]>({
    queryKey: ["/api/influencing-techniques"],
  });

  const { data: tactics = [] } = useQuery<any[]>({
    queryKey: ["/api/negotiation-tactics"],
  });

  // Initialize runs from API data
  useEffect(() => {
    if (runsData?.data) {
      setLiveRuns(runsData.data);
    }
  }, [runsData]);

  // WebSocket for real-time updates
  const { isConnected, sendMessage } = useWebSocket("/ws", {
    onMessage: (data) => {
      handleWebSocketMessage(data);
    },
  });

  // Subscribe to negotiation updates when connected
  useEffect(() => {
    if (isConnected && negotiationId) {
      sendMessage({
        type: "subscribe_negotiation",
        negotiationId,
      });
    }
  }, [isConnected, negotiationId, sendMessage]);

  // Handle WebSocket messages
  const handleWebSocketMessage = (data: any) => {
    console.log("WebSocket message:", data);

    // Add to activity feed
    const newEvent: ActivityEvent = {
      id: `${Date.now()}-${Math.random()}`,
      type: data.type,
      timestamp: new Date(),
      runId: data.runId || data.simulationRunId || "unknown",
      technique: data.technique,
      tactic: data.tactic,
      round: data.round,
      message: data.message,
    };

    setActivityEvents((prev) => [newEvent, ...prev]);

    // Update runs based on event type
    switch (data.type) {
      case "simulation_started":
        setLiveRuns((prev) =>
          prev.map((run) =>
            run.id === data.runId
              ? { ...run, status: "running" as const, startedAt: new Date().toISOString() }
              : run
          )
        );
        break;

      case "round_completed":
        setLiveRuns((prev) =>
          prev.map((run) =>
            run.id === data.runId
              ? { ...run, currentRound: data.round }
              : run
          )
        );
        break;

      case "simulation_completed":
        setLiveRuns((prev) =>
          prev.map((run) =>
            run.id === data.runId
              ? {
                  ...run,
                  status: "completed" as const,
                  completedAt: new Date().toISOString(),
                }
              : run
          )
        );
        // Refetch to get full results
        refetchRuns();
        break;

      case "simulation_failed":
        setLiveRuns((prev) =>
          prev.map((run) =>
            run.id === data.runId
              ? {
                  ...run,
                  status: "failed" as const,
                  errorMessage: data.error || "Unknown error",
                }
              : run
          )
        );
        break;
    }
  };

  // Calculate queue statistics
  const queueStats = useMemo(() => {
    const total = liveRuns.length;
    const completed = liveRuns.filter((r) => r.status === "completed").length;
    const running = liveRuns.filter((r) => r.status === "running").length;
    const pending = liveRuns.filter((r) => r.status === "pending").length;
    const failed = liveRuns.filter((r) => r.status === "failed").length;

    // Estimate time remaining (rough estimate: 30s per simulation)
    const estimatedTimeRemaining = (pending + running) * 30;

    return {
      total,
      completed,
      running,
      pending,
      failed,
      estimatedTimeRemaining,
    };
  }, [liveRuns]);

  // Enrich runs with technique/tactic names
  const enrichedRuns = useMemo(() => {
    return liveRuns.map((run) => ({
      ...run,
      techniqueName:
        techniques.find((t: any) => t.id === run.techniqueId)?.name ||
        "Unknown",
      tacticName:
        tactics.find((t: any) => t.id === run.tacticId)?.name || "Unknown",
    }));
  }, [liveRuns, techniques, tactics]);

  const isLoading = loadingNegotiation || loadingQueue || loadingRuns;

  if (!match || !negotiationId) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Invalid negotiation ID. Please select a valid negotiation to monitor.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/negotiations")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isLoading ? (
                <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
              ) : (
                negotiation?.title || "Monitor Simulation"
              )}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {isLoading ? (
                <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
              ) : (
                <>
                  Real-time monitoring •{" "}
                  <span
                    className={`inline-flex items-center gap-1 ${
                      isConnected ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    <span className="relative flex h-2 w-2">
                      {isConnected && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      )}
                      <span
                        className={`relative inline-flex rounded-full h-2 w-2 ${
                          isConnected ? "bg-green-500" : "bg-red-500"
                        }`}
                      ></span>
                    </span>
                    {isConnected ? "Connected" : "Disconnected"}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Stop All Button (future feature) */}
        {queueStats.running > 0 && (
          <Button variant="destructive" size="sm" disabled>
            <StopCircle className="w-4 h-4 mr-2" />
            Stop All
          </Button>
        )}
      </div>

      {/* Queue Overview */}
      {isLoading ? (
        <SimulationQueueOverviewSkeleton />
      ) : (
        <SimulationQueueOverview
          totalRuns={queueStats.total}
          completedRuns={queueStats.completed}
          runningRuns={queueStats.running}
          pendingRuns={queueStats.pending}
          failedRuns={queueStats.failed}
          estimatedTimeRemaining={queueStats.estimatedTimeRemaining}
        />
      )}

      {/* Two-column layout: Runs table + Activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {isLoading ? (
            <ActiveRunsTableSkeleton />
          ) : (
            <ActiveRunsTable runs={enrichedRuns} />
          )}
        </div>

        <div>
          {isLoading ? (
            <LiveActivityFeedSkeleton />
          ) : (
            <LiveActivityFeed events={activityEvents} />
          )}
        </div>
      </div>
    </div>
  );
}
