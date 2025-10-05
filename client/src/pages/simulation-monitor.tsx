/**
 * Optimized Simulation Monitor
 * Clean, organized layout with configuration sidebar and focused progress view
 */

import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useWebSocket } from "@/hooks/use-websocket";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, AlertCircle } from "lucide-react";

// Import new components
import { NegotiationConfig, NegotiationConfigSkeleton } from "@/components/monitor/NegotiationConfig";
import { ProgressDashboard } from "@/components/monitor/ProgressDashboard";
import { ResultsTable } from "@/components/monitor/ResultsTable";

interface QueueStatus {
  id: string;
  status: "pending" | "running" | "completed" | "failed" | "paused";
  totalSimulations: number;
  completedCount: number;
  failedCount: number;
  estimatedTimeRemaining: number;
  currentSimulation?: any;
  progressPercentage: number;
  actualCost: number;
  estimatedCost: number;
}

interface SimulationResult {
  id: string;
  runNumber: number;
  status: "pending" | "running" | "completed" | "failed" | "timeout";
  techniqueId: string;
  tacticId: string;
  totalRounds?: number;
  actualCost?: number;
  startedAt?: string;
  completedAt?: string;
  conversationLog?: any[];
  otherDimensions?: any;
  dealValue?: number | string;
}

export default function OptimizedSimulationMonitor() {
  const { negotiationId } = useParams<{ negotiationId: string }>();
  const [, setLocation] = useLocation();

  // State management
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [simulationResults, setSimulationResults] = useState<SimulationResult[]>([]);
  const [negotiationDetails, setNegotiationDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [techniques, setTechniques] = useState<any[]>([]);
  const [tactics, setTactics] = useState<any[]>([]);
  const [realTimeUpdates, setRealTimeUpdates] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<string>("");
  const [buttonLoading, setButtonLoading] = useState<Record<string, boolean>>({
    executeNext: false,
    executeAll: false,
    pause: false,
    resume: false,
    stop: false,
    createQueue: false,
    startQueue: false,
    restartFailed: false,
  });
  const [restartingSingle, setRestartingSingle] = useState<Record<string, boolean>>({});

  // Calculate overview
  const negotiationOverview = useMemo(() => ({
    completed: simulationResults.filter((r) => r.status === "completed"),
    running: simulationResults.filter((r) => r.status === "running"),
    outstanding: simulationResults.filter((r) => r.status === "pending"),
    failed: simulationResults.filter((r) => r.status === "failed"),
    timeout: simulationResults.filter((r) => r.status === "timeout"),
  }), [simulationResults]);

  // WebSocket connection
  const { isConnected } = useWebSocket("/ws", {
    onMessage: (data) => {
      if (data.negotiationId === negotiationId) {
        switch (data.type) {
          case "simulation_started":
            setCurrentActivity(`🚀 Started: Run #${data.data?.runNumber || "?"}`);
            if (queueStatus?.id) {
              fetchQueueStatus(queueStatus.id);
              fetchResults(queueStatus.id);
            }
            break;
          case "simulation_completed":
            setCurrentActivity(`✅ Completed: Run #${data.data?.runNumber || "?"}`);
            if (queueStatus?.id) {
              fetchQueueStatus(queueStatus.id);
              fetchResults(queueStatus.id);
            }
            break;
          case "simulation_failed":
            setCurrentActivity(`❌ Failed: Run #${data.data?.runNumber || "?"}`);
            if (queueStatus?.id) {
              fetchQueueStatus(queueStatus.id);
              fetchResults(queueStatus.id);
            }
            break;
          case "negotiation_round":
            setCurrentActivity(`💬 Round ${data.data?.round || "?"}: ${data.data?.agent || "?"} speaking...`);
            break;
          case "queue_progress":
          case "queue_completed":
            if (queueStatus?.id) {
              fetchQueueStatus(queueStatus.id);
              fetchResults(queueStatus.id);
            }
            break;
        }
      }
    },
    onOpen: () => setRealTimeUpdates(true),
    onClose: () => setRealTimeUpdates(false),
    onError: () => setRealTimeUpdates(false),
  });

  // Fetch functions
  const fetchQueueStatus = async (queueId: string) => {
    try {
      const response = await fetch(`/api/simulations/queue/${queueId}/status`);
      const data = await response.json();
      if (data.success) {
        setQueueStatus(data.data);
        setError(null);
      } else {
        setError(data.error || "Failed to fetch queue status");
      }
    } catch (err: any) {
      console.error("Error fetching queue status:", err);
      setError("Network error - check connection");
    }
  };

  const fetchResults = async (queueId: string) => {
    try {
      const response = await fetch(`/api/simulations/queue/${queueId}/results`);
      const data = await response.json();
      if (data.success) {
        setSimulationResults(data.data);
      }
    } catch (err: any) {
      console.error("Error fetching results:", err);
    }
  };

  // Load reference data
  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const [techniquesRes, tacticsRes, negotiationRes] = await Promise.all([
          fetch("/api/techniques"),
          fetch("/api/tactics"),
          negotiationId ? fetch(`/api/negotiations/${negotiationId}`) : Promise.resolve(null),
        ]);

        if (techniquesRes.ok) {
          const techniquesData = await techniquesRes.json();
          setTechniques(techniquesData);
        }

        if (tacticsRes.ok) {
          const tacticsData = await tacticsRes.json();
          setTactics(tacticsData);
        }

        if (negotiationRes && negotiationRes.ok) {
          const negotiationData = await negotiationRes.json();
          setNegotiationDetails(negotiationData);
        }
      } catch (error) {
        console.error("Failed to load reference data:", error);
      }
    };

    loadReferenceData();
  }, [negotiationId]);

  // Initialize
  useEffect(() => {
    const initialize = async () => {
      if (!negotiationId) return;

      setLoading(true);

      try {
        const queueResponse = await fetch(`/api/simulations/queue/by-negotiation/${negotiationId}`);

        if (queueResponse.ok) {
          const queueData = await queueResponse.json();
          if (queueData.success && queueData.queueId) {
            await fetchQueueStatus(queueData.queueId);
            await fetchResults(queueData.queueId);
          } else {
            setQueueStatus(null);
          }
        }
      } catch (error) {
        console.error("Error initializing simulation monitor:", error);
      }

      setLoading(false);
    };

    initialize();
  }, [negotiationId]);

  // Polling
  useEffect(() => {
    if (!queueStatus?.id) return;

    const interval = setInterval(() => {
      if (queueStatus.status === "running" || queueStatus.status === "pending" || !realTimeUpdates) {
        fetchQueueStatus(queueStatus.id);
        fetchResults(queueStatus.id);
      }
    }, realTimeUpdates ? 10000 : 3000);

    return () => clearInterval(interval);
  }, [queueStatus?.id, queueStatus?.status, realTimeUpdates]);

  // Helper function for API requests
  const makeApiRequest = async (url: string, options: RequestInit = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  // Control handlers
  const handleRefresh = () => {
    if (queueStatus?.id) {
      fetchQueueStatus(queueStatus.id);
      fetchResults(queueStatus.id);
    }
  };

  const handleStartQueue = async () => {
    if (!queueStatus?.id || buttonLoading.startQueue) return;

    setButtonLoading((prev) => ({ ...prev, startQueue: true }));
    try {
      const data = await makeApiRequest(`/api/simulations/queue/${queueStatus.id}/start`, {
        method: "POST",
      });

      if (data.success) {
        await fetchQueueStatus(queueStatus.id);
        await fetchResults(queueStatus.id);
        setError(null);
      } else {
        setError(data.error || "Failed to start queue");
      }
    } catch (err: any) {
      setError(`Failed to start queue: ${err.message || "Unknown error"}`);
    } finally {
      setButtonLoading((prev) => ({ ...prev, startQueue: false }));
    }
  };

  const handlePause = async () => {
    if (!queueStatus?.id || buttonLoading.pause) return;

    setButtonLoading((prev) => ({ ...prev, pause: true }));
    try {
      await makeApiRequest(`/api/simulations/queue/${queueStatus.id}/pause`, {
        method: "POST",
      });

      await fetchQueueStatus(queueStatus.id);
      setError(null);
    } catch (err: any) {
      setError(`Failed to pause queue: ${err.message || "Unknown error"}`);
    } finally {
      setButtonLoading((prev) => ({ ...prev, pause: false }));
    }
  };

  const handleResume = async () => {
    if (!queueStatus?.id || buttonLoading.resume) return;

    setButtonLoading((prev) => ({ ...prev, resume: true }));
    try {
      await makeApiRequest(`/api/simulations/queue/${queueStatus.id}/resume`, {
        method: "POST",
      });

      await fetchQueueStatus(queueStatus.id);
      setError(null);
    } catch (err: any) {
      setError(`Failed to resume queue: ${err.message || "Unknown error"}`);
    } finally {
      setButtonLoading((prev) => ({ ...prev, resume: false }));
    }
  };

  const handleStop = async () => {
    if (!queueStatus?.id || buttonLoading.stop) return;

    setButtonLoading((prev) => ({ ...prev, stop: true }));
    try {
      await makeApiRequest(`/api/simulations/queue/${queueStatus.id}/stop`, {
        method: "POST",
      });

      await fetchQueueStatus(queueStatus.id);
      setError(null);
    } catch (err: any) {
      setError(`Failed to stop queue: ${err.message || "Unknown error"}`);
    } finally {
      setButtonLoading((prev) => ({ ...prev, stop: false }));
    }
  };

  const handleRestartFailed = async () => {
    if (!queueStatus?.id || buttonLoading.restartFailed) return;

    setButtonLoading((prev) => ({ ...prev, restartFailed: true }));
    try {
      const data = await makeApiRequest(`/api/simulations/queue/${queueStatus.id}/restart-failed`, {
        method: "POST",
      });

      if (data.success) {
        await fetchQueueStatus(queueStatus.id);
        await fetchResults(queueStatus.id);
        setError(null);
        setCurrentActivity(`🔄 Restarted ${data.restartedCount} failed simulations`);
      } else {
        setError(data.error || "Failed to restart failed simulations");
      }
    } catch (err: any) {
      setError(`Failed to restart failed simulations: ${err.message || "Unknown error"}`);
    } finally {
      setButtonLoading((prev) => ({ ...prev, restartFailed: false }));
    }
  };

  const handleRestartSingle = async (runId: string) => {
    if (restartingSingle[runId]) return;

    setRestartingSingle((prev) => ({ ...prev, [runId]: true }));
    try {
      const data = await makeApiRequest(`/api/simulations/run/${runId}/restart`, {
        method: "POST",
      });

      if (data.success) {
        await fetchQueueStatus(queueStatus!.id);
        await fetchResults(queueStatus!.id);
        setError(null);
        setCurrentActivity(`🔄 Restarted run #${data.runNumber || runId.slice(0, 8)}`);
      } else {
        setError(data.error || "Failed to restart simulation");
      }
    } catch (err: any) {
      setError(`Failed to restart simulation: ${err.message || "Unknown error"}`);
    } finally {
      setRestartingSingle((prev) => ({ ...prev, [runId]: false }));
    }
  };

  // Helper functions
  const getTechniqueName = (techniqueId: string) => {
    const technique = techniques.find((t) => t.id === techniqueId);
    return technique?.name || techniqueId.slice(0, 8);
  };

  const getTacticName = (tacticId: string) => {
    const tactic = tactics.find((t) => t.id === tacticId);
    return tactic?.name || tacticId.slice(0, 8);
  };

  const formatDealValue = (result: any) => {
    // Use calculated dealValue if available (from database)
    if (result.dealValue) {
      const value = typeof result.dealValue === 'string' ? parseFloat(result.dealValue) : result.dealValue;
      return `€${value.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }

    // If dealValue is not set, show "-"
    return "-";
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/negotiations")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-6">
          <NegotiationConfigSkeleton />
          <div className="col-span-2 space-y-4">
            <div className="h-64 bg-gray-200 rounded animate-pulse" />
            <div className="h-96 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // No queue found
  if (!queueStatus && !loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/negotiations")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Monitor Simulation</h1>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No simulation queue exists for this negotiation. Please configure and start simulations first.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/negotiations")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {negotiationDetails?.title || "Monitor Simulation"}
          </h1>
          <p className="text-sm text-gray-600">ID: {negotiationId?.slice(0, 8)}</p>
        </div>
      </div>

      {/* Main Layout: Sidebar + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Sidebar: Configuration */}
        <div className="lg:col-span-1">
          <NegotiationConfig negotiation={negotiationDetails} techniques={techniques} tactics={tactics} />
        </div>

        {/* Right Content: Progress & Controls */}
        <div className="lg:col-span-2">
          <ProgressDashboard
            queueStatus={queueStatus}
            overview={negotiationOverview}
            currentActivity={currentActivity}
            realTimeUpdates={realTimeUpdates}
            buttonLoading={buttonLoading}
            error={error}
            onRefresh={handleRefresh}
            onStartQueue={handleStartQueue}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleStop}
            onRestartFailed={handleRestartFailed}
          />
        </div>
      </div>

      {/* Results Table with Individual Controls */}
      <ResultsTable
        results={simulationResults}
        techniques={techniques}
        tactics={tactics}
        onRestartSingle={handleRestartSingle}
        restarting={restartingSingle}
        negotiationId={negotiationId}
      />
    </div>
  );
}
