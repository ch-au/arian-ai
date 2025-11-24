import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  Eye,
  Pause,
  Play,
  Square,
  Trash2,
  Users,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { useNegotiations, translateNegotiationStatus } from "@/hooks/use-negotiations";
import type { NegotiationListItem } from "@/hooks/use-negotiations";
import { useNegotiationContext } from "@/contexts/negotiation-context";

const STATUS_ICONS: Record<string, JSX.Element> = {
  completed: <CheckCircle className="h-4 w-4 text-green-500" />,
  running: <Activity className="h-4 w-4 text-blue-500 animate-pulse" />,
  planned: <Clock className="h-4 w-4 text-yellow-500" />,
  aborted: <AlertTriangle className="h-4 w-4 text-red-500" />,
};

function StatusBadge({ status }: { status: NegotiationListItem["status"] }) {
  const icon = STATUS_ICONS[status] ?? <Clock className="h-4 w-4 text-gray-500" />;
  return (
    <div className="inline-flex items-center gap-2">
      {icon}
      {translateNegotiationStatus(status)}
    </div>
  );
}

export default function NegotiationsList() {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: negotiations, isLoading } = useNegotiations();
  const { setSelectedNegotiationId } = useNegotiationContext();

  type StartNegotiationResponse = {
    negotiationId: string;
    queueId?: string;
    action: "created" | "resumed" | "resumed_pending" | "already_completed" | "restarted_failed" | string;
    message?: string;
  };

  const startNegotiationMutation = useMutation({
    mutationFn: async (negotiationId: string) => {
      const response = await apiRequest("POST", `/api/negotiations/${negotiationId}/start`);
      return response.json() as Promise<StartNegotiationResponse>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/negotiations"] });
      if (data?.action === "already_completed") {
        toast({
          title: "Alle Simulationen durchgeführt",
          description: data.message ?? "Es gibt keine offenen Simulationen für diese Verhandlung.",
        });
        return;
      }
      toast({
        title: "Simulation gestartet",
        description: data?.action === "resumed" ? "Die vorhandene Queue wurde fortgesetzt." : "Die Verhandlung läuft jetzt in der Queue.",
      });
    },
    onError: (error) => {
      toast({
        title: "Start fehlgeschlagen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  const pauseNegotiationMutation = useMutation({
    mutationFn: async (negotiationId: string) => {
      const response = await apiRequest("POST", `/api/negotiations/${negotiationId}/pause`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/negotiations"] });
      toast({
        title: "Simulation pausiert",
        description: "Die Verhandlung wurde pausiert.",
      });
    },
    onError: (error) => {
      toast({
        title: "Pausieren fehlgeschlagen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  const deleteNegotiationMutation = useMutation({
    mutationFn: async (negotiationId: string) => {
      const response = await apiRequest("DELETE", `/api/negotiations/${negotiationId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/negotiations"] });
      setDeleteConfirmId(null);
      toast({
        title: "Verhandlung gelöscht",
        description: "Die Konfiguration wurde entfernt.",
      });
    },
    onError: (error) => {
      toast({
        title: "Löschen fehlgeschlagen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  useWebSocket("/ws", {
    onMessage: (message: any) => {
      const actionableTypes = new Set([
        "negotiation_started",
        "round_completed",
        "negotiation_completed",
        "simulation_started",
        "simulation_completed",
        "simulation_failed",
        "simulation_stopped",
        "queue_progress",
        "queue_completed",
      ]);

      if (actionableTypes.has(message.type)) {
        queryClient.invalidateQueries({ queryKey: ["/api/negotiations"] });
      }
    },
  });

  const handleStart = (negotiation: NegotiationListItem) => {
    if (!negotiation.hasStrategy) {
      toast({
        title: "Strategie unvollständig",
        description: "Bitte wählen Sie mindestens eine Technik und eine Taktik aus.",
        variant: "destructive",
      });
      return;
    }
    startNegotiationMutation.mutate(negotiation.id);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Konfigurationen</CardTitle>
            <CardDescription>Alle Verhandlungen mit aktuellem Fortschritt</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {negotiations?.length ?? 0} aktiv
            </div>
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <BarChart3 className="h-4 w-4" />
              Live-Updates
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Verhandlung</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Strategie</TableHead>
                  <TableHead>Fortschritt</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {negotiations?.map((negotiation) => (
                  <TableRow key={negotiation.id}>
                    <TableCell className="align-top">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-semibold leading-tight">{negotiation.title}</p>
                            <p className="text-sm text-muted-foreground">{negotiation.summary}</p>
                            <p className="text-xs text-muted-foreground">
                              Markt: {negotiation.marketLabel} · Rolle:{" "}
                              {negotiation.scenario.userRole === "buyer" ? "Käufer" : "Verkäufer"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <StatusBadge status={negotiation.status} />
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-1">
                        <Badge variant="outline">
                          {negotiation.techniqueCount} Techniken · {negotiation.tacticCount} Taktiken
                        </Badge>
                        {!negotiation.hasStrategy && (
                          <p className="text-xs text-red-500">Strategie unvollständig</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-2">
                        <Progress value={negotiation.progressPercentage} />
                        <p className="text-xs text-muted-foreground">
                          {negotiation.simulationStats.completedRuns}/{negotiation.simulationStats.totalRuns || 0} Runs
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          title="Simulation starten"
                          disabled={!negotiation.hasStrategy || startNegotiationMutation.isPending}
                          onClick={() => handleStart(negotiation)}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          title="Simulation pausieren"
                          onClick={() => pauseNegotiationMutation.mutate(negotiation.id)}
                        >
                          <Pause className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          title="Monitoring öffnen"
                          onClick={() => {
                            setSelectedNegotiationId(negotiation.id);
                            setLocation(`/monitor/${negotiation.id}`);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          title="Analyse anzeigen"
                          disabled={negotiation.status !== "completed"}
                          onClick={() => {
                            setSelectedNegotiationId(negotiation.id);
                            setLocation(`/analysis/${negotiation.id}`);
                          }}
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Löschen"
                          onClick={() => setDeleteConfirmId(negotiation.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verhandlung löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Alle zugehörigen Simulationen werden entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => deleteConfirmId && deleteNegotiationMutation.mutate(deleteConfirmId)}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
