/**
 * Monitor Page - Real-time Simulation Monitoring
 * Shows live progress of simulation queue with WebSocket updates
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ArrowLeft, AlertCircle, StopCircle, RefreshCcw, Loader2, BarChart3, RotateCcw } from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { useNegotiationDetail } from "@/hooks/use-negotiation-detail";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

// Monitor Components
import {
  SimulationQueueOverview,
  SimulationQueueOverviewSkeleton,
} from "@/components/monitor/SimulationQueueOverview";
import {
  ActiveRunsTable,
  ActiveRunsTableSkeleton,
} from "@/components/monitor/ActiveRunsTable";
import type { NegotiationDetailPayload } from "@/hooks/use-negotiation-detail";

interface SimulationRun {
  id: string;
  negotiationId: string;
  queueId: string;
  techniqueId: string;
  techniqueName?: string;
  tacticId: string;
  tacticName?: string;
  status: "pending" | "running" | "completed" | "failed" | "timeout";
  currentRound: number;
  maxRounds: number;
  dealValue?: number | string | null;
  actualCost?: number | string | null;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  zopaDistance?: string | null;
  roundDimensions?: Array<{ round: number; dimension: string; value: number }>;
}

interface QueueLookupResponse {
  success: boolean;
  queueId?: string;
  message?: string;
}

interface QueueRunsResponse {
  success: boolean;
  data: SimulationRun[];
}

interface AnalysisRunDetails {
  id: string;
  dealValue?: number | string | null;
  actualCost?: number | string | null;
  totalRounds?: number;
  dimensionResults?: Array<{
    dimensionName: string;
    finalValue: string | number;
    achievedTarget: boolean;
  }>;
  productResults?: Array<{
    productName: string;
    agreedPrice: string | number;
    subtotal?: string | number;
  }>;
  roundDimensions?: Array<{ round: number; dimension: string; value: number }>;
}

interface MonitorAnalysisResponse {
  runs: AnalysisRunDetails[];
}

const MAX_ACTIVITY_EVENTS = 75;

type QueueStats = {
  total: number;
  completed: number;
  running: number;
  pending: number;
  failed: number;
  estimatedTimeRemaining: number;
};

function ConnectionChip({ isConnected }: { isConnected: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
        isConnected ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-rose-300 bg-rose-50 text-rose-700"
      }`}
    >
      <span className="relative flex h-2 w-2">
        {isConnected && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75 animate-ping" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            isConnected ? "bg-emerald-500" : "bg-rose-500"
          }`}
        />
      </span>
      {isConnected ? "Live verbunden" : "Offline"}
    </span>
  );
}

export default function MonitorPage() {
  const [matchWithId, paramsWithId] = useRoute("/monitor/:id");
  const [matchWithoutId] = useRoute("/monitor");
  const [, setLocation] = useLocation();
  const negotiationId = paramsWithId?.id;

  // If we're on /monitor without an ID, redirect to dashboard
  // (alternatively, we could show a list of all negotiations here)
  if (matchWithoutId && !negotiationId) {
    setLocation("/");
    return null;
  }

  // Local state for real-time updates
  const [liveRuns, setLiveRuns] = useState<SimulationRun[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const { toast } = useToast();
  const [restartingRuns, setRestartingRuns] = useState<Record<string, boolean>>({});

  const {
    data: negotiationDetail,
    isLoading: loadingNegotiation,
  } = useNegotiationDetail(negotiationId ?? null);

  const { data: analysisResponse } = useQuery<MonitorAnalysisResponse>({
    queryKey: negotiationId ? ["monitor-analysis-v2", negotiationId] : [],
    enabled: Boolean(negotiationId),
    refetchInterval: negotiationId ? 15000 : false,
    refetchIntervalInBackground: true,
    staleTime: 0,
    queryFn: async ({ queryKey }) => {
      const [, id] = queryKey;
      const response = await fetchWithAuth(`/api/negotiations/${id}/analysis`);
      if (!response.ok) {
        throw new Error("Analyse konnte nicht geladen werden");
      }
      return response.json();
    },
  });

  const {
    data: queueData,
    isLoading: loadingQueue,
    refetch: refetchQueue,
  } = useQuery<QueueLookupResponse>({
    queryKey: ["simulation-queue", negotiationId],
    enabled: Boolean(negotiationId),
    refetchInterval: negotiationId ? 10000 : false,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      if (!negotiationId) {
        throw new Error("Keine Verhandlungs-ID vorhanden.");
      }
      const response = await fetchWithAuth(`/api/simulations/queue/by-negotiation/${negotiationId}`);
      if (!response.ok) {
        throw new Error("Simulation-Queue konnte nicht geladen werden.");
      }
      return response.json();
    },
  });

  const queueId = queueData?.success ? queueData.queueId : undefined;
  const analysisMap = useMemo(() => {
    const map = new Map<string, AnalysisRunDetails>();
    analysisResponse?.runs?.forEach((run) => {
      map.set(run.id, run);
    });
    return map;
  }, [analysisResponse]);

  const {
    data: runsResponse,
    isLoading: loadingRuns,
    refetch: refetchRuns,
  } = useQuery<QueueRunsResponse>({
    queryKey: ["simulation-runs", queueId, negotiationId],
    enabled: Boolean(queueId),
    refetchInterval: queueId ? 5000 : false,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      if (!queueId) {
        throw new Error("Keine Queue-ID vorhanden.");
      }
      const response = await fetchWithAuth(`/api/simulations/queue/${queueId}/runs`);
      if (!response.ok) {
        throw new Error("Simulation-Läufe konnten nicht geladen werden.");
      }
      return response.json();
    },
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
    if (runsResponse?.success && runsResponse.data) {
      setLiveRuns(runsResponse.data);
      setLastUpdatedAt(new Date());
    } else if (!queueId) {
      setLiveRuns([]);
    }
  }, [runsResponse, queueId]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback(
    (data: any) => {
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
              run.id === data.runId ? { ...run, currentRound: data.round } : run
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
          refetchRuns();
          break;
        case "simulation_failed":
          setLiveRuns((prev) =>
            prev.map((run) =>
              run.id === data.runId
                ? {
                    ...run,
                    status: "failed" as const,
                    errorMessage: data.error || "Unbekannter Fehler",
                  }
                : run
            )
          );
          break;
      }
      setLastUpdatedAt(new Date());
    },
    [refetchRuns]
  );

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

  // Calculate queue statistics
  const queueStats: QueueStats = useMemo(() => {
    const total = liveRuns.length;
    const completed = liveRuns.filter((r) => r.status === "completed").length;
    const running = liveRuns.filter((r) => r.status === "running").length;
    const pending = liveRuns.filter((r) => r.status === "pending").length;
    const failed = liveRuns.filter((r) => r.status === "failed" || r.status === "timeout").length;

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
    return liveRuns.map((run) => {
      const details = analysisMap.get(run.id);
      const dealValueFromProducts = details?.productResults?.reduce((sum, product) => sum + Number(product.subtotal ?? 0), 0);
      const dealValue = dealValueFromProducts && dealValueFromProducts > 0
        ? dealValueFromProducts
        : Number(details?.dealValue ?? run["dealValue"] ?? 0);
      const actualCost = Number(details?.actualCost ?? run.actualCost ?? 0);

      return {
        ...run,
        techniqueName:
          techniques.find((t: any) => t.id === run.techniqueId)?.name ||
          "Unknown",
        tacticName:
          tactics.find((t: any) => t.id === run.tacticId)?.name || "Unknown",
        dealValue,
        actualCost,
        dimensionResults: details?.dimensionResults,
        productResults: details?.productResults,
        roundDimensions: details?.roundDimensions ?? [],
      };
    });
  }, [liveRuns, techniques, tactics, analysisMap]);

  const negotiation: NegotiationDetailPayload["negotiation"] | undefined = negotiationDetail?.negotiation;
  const scenario = negotiation?.scenario ?? {};
  const queueNotice = queueData && !queueData.success ? (queueData.message ?? "Keine aktive Simulation gefunden.") : null;
  const runsLoading = queueId ? loadingRuns : false;

  const isLoading = loadingNegotiation || loadingQueue || runsLoading;
  const handleManualRefresh = useCallback(() => {
    refetchRuns();
    refetchQueue();
  }, [refetchRuns, refetchQueue]);

  const stopMutation = useMutation({
    mutationFn: async () => {
      if (!negotiationId) {
        throw new Error("Keine Verhandlungs-ID vorhanden");
      }
      await apiRequest("POST", `/api/negotiations/${negotiationId}/stop`);
    },
    onSuccess: () => {
      toast({
        title: "Simulation gestoppt",
        description: "Alle laufenden Kombinationen wurden abgebrochen.",
      });
      handleManualRefresh();
    },
    onError: (error) => {
      toast({
        title: "Stoppen fehlgeschlagen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  const retryMutation = useMutation({
    mutationFn: async () => {
      if (!queueId) {
        throw new Error("Keine Queue-ID vorhanden");
      }
      const response = await apiRequest("POST", `/api/simulations/queue/${queueId}/retry`);
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Fehlgeschlagene Simulationen werden wiederholt",
        description: `${data.retriedCount} Simulationen wurden zur Wiederholung markiert.`,
      });
      handleManualRefresh();
    },
    onError: (error) => {
      toast({
        title: "Wiederholung fehlgeschlagen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  const handleStopNegotiation = useCallback(() => {
    if (!negotiationId) {
      toast({
        title: "Keine Verhandlung ausgewählt",
        description: "Bitte wählen Sie eine Verhandlung aus.",
        variant: "destructive",
      });
      return;
    }
    stopMutation.mutate();
  }, [negotiationId, stopMutation, toast]);

  const handleRetryFailed = useCallback(() => {
    if (!queueId) {
      toast({
        title: "Keine Queue vorhanden",
        description: "Es konnte keine aktive Queue gefunden werden.",
        variant: "destructive",
      });
      return;
    }
    retryMutation.mutate();
  }, [queueId, retryMutation, toast]);

  const handleRestartRun = useCallback(
    async (runId: string) => {
      if (!runId) return;
      setRestartingRuns((prev) => ({ ...prev, [runId]: true }));
      try {
        const res = await apiRequest("POST", `/api/simulations/run/${runId}/restart`);
        const data = await res.json();
        if (!data?.success) {
          throw new Error(data?.error || "Simulation konnte nicht neu gestartet werden.");
        }
        toast({
          title: "Run neu gestartet",
          description: data?.runNumber
            ? `Run #${data.runNumber} wurde gelöscht und neu gestartet.`
            : "Simulation wurde gelöscht und neu gestartet.",
        });
        handleManualRefresh();
      } catch (error) {
        toast({
          title: "Wiederholung fehlgeschlagen",
          description: error instanceof Error ? error.message : "Unbekannter Fehler",
          variant: "destructive",
        });
      } finally {
        setRestartingRuns((prev) => {
          const next = { ...prev };
          delete next[runId];
          return next;
        });
      }
    },
    [handleManualRefresh, toast]
  );

  if (!matchWithId || !negotiationId) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Ungültige Verhandlungs-ID. Bitte wählen Sie eine gültige Verhandlung aus.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Actions */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück
          </Button>
          <ConnectionChip isConnected={isConnected} />
          {queueId && (
            <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs uppercase tracking-wider text-slate-700">
              Queue {queueId.slice(0, 8)}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            Aktualisieren
          </Button>
          {queueStats.failed > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryFailed}
              disabled={retryMutation.isPending}
            >
              {retryMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
              {retryMutation.isPending ? "Wiederholt …" : `Nicht abgeschlossene wiederholen (${queueStats.failed})`}
            </Button>
          )}
          {queueStats.running > 0 && (
            <Button variant="destructive" size="sm" onClick={handleStopNegotiation} disabled={stopMutation.isPending}>
              {stopMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <StopCircle className="w-4 h-4 mr-2" />}
              {stopMutation.isPending ? "Stoppt …" : "Alle stoppen"}
            </Button>
          )}
        </div>
      </div>

      {/* Negotiation Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>{negotiation?.title || "Simulation Monitor"}</CardTitle>
          <CardDescription>
            {scenario?.companyProfile?.organization ?? "Unbekanntes Unternehmen"} ↔{" "}
            {scenario?.counterpartProfile?.name ?? "Unbekannte Gegenseite"} ·{" "}
            {scenario?.negotiationType ?? "Verhandlung"} ·{" "}
            {scenario?.selectedTechniques?.length ?? 0} Techniken ×{" "}
            {scenario?.selectedTactics?.length ?? 0} Taktiken
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Gesamt</p>
              <p className="text-2xl font-semibold">{queueStats.total}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Laufend</p>
              <p className="text-2xl font-semibold">{queueStats.running}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Ausstehend</p>
              <p className="text-2xl font-semibold">{queueStats.pending}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Fehler</p>
              <p className={`text-2xl font-semibold ${queueStats.failed > 0 ? "text-red-600" : ""}`}>
                {queueStats.failed}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Letztes Update</p>
              <p className="text-sm font-semibold">
                {lastUpdatedAt
                  ? lastUpdatedAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                  : "–"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {!queueId && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {queueNotice ??
              "Für diese Verhandlung existiert noch keine aktive Queue. Starten Sie eine Simulation auf der Bestätigungsseite."}
          </AlertDescription>
        </Alert>
      )}

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

      {/* Runs table */}
      <div className="space-y-6">
        {isLoading ? (
          <ActiveRunsTableSkeleton />
        ) : (
          <ActiveRunsTable
            runs={enrichedRuns}
            onRestartRun={handleRestartRun}
            restarting={restartingRuns}
          />
        )}
      </div>

      {/* Analysis CTA - only show when completed */}
      {negotiation?.status === 'completed' && (
        <Card className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Simulation abgeschlossen
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  Detaillierte Analyse mit AI-Insights und Run-Vergleich verfügbar
                </p>
              </div>
              <Button
                size="lg"
                onClick={() => setLocation(`/analysis/${negotiationId}`)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <BarChart3 className="mr-2 h-5 w-5" />
                Zur Analyse
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
