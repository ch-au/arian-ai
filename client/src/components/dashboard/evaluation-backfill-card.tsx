import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Brain, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface EvaluationStats {
  total: number;
  evaluated: number;
  needingEvaluation: number;
  evaluationRate: number;
}

export default function EvaluationBackfillCard() {
  const [isBackfilling, setIsBackfilling] = useState(false);

  const { data: stats, isLoading, refetch } = useQuery<EvaluationStats>({
    queryKey: ["/api/dashboard/evaluation-status"],
    refetchInterval: isBackfilling ? 5000 : false,
  });

  const backfillMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/dashboard/evaluations/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to start backfill");
      return response.json();
    },
    onSuccess: (data) => {
      setIsBackfilling(true);
      setTimeout(() => {
        refetch();
      }, 2000);
    },
    onError: (error) => {
      console.error("Backfill failed:", error);
      setIsBackfilling(false);
    },
  });

  const handleBackfill = () => {
    backfillMutation.mutate();
  };

  const handleRefresh = () => {
    refetch().then(() => {
      if (stats && stats.needingEvaluation === 0) {
        setIsBackfilling(false);
      }
    });
  };

  const percentageEvaluated = stats?.evaluationRate || 0;
  const isComplete = stats ? stats.needingEvaluation === 0 : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5" />
          KI-Auswertungen
        </CardTitle>
        <CardDescription>Automatische Bewertungen für abgeschlossene Simulationen</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats?.total ?? "–"}</div>
            <div className="text-xs text-muted-foreground">Gesamt</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats?.evaluated ?? "–"}</div>
            <div className="text-xs text-muted-foreground">Ausgewertet</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats?.needingEvaluation ?? "–"}</div>
            <div className="text-xs text-muted-foreground">Offen</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Fortschritt</span>
            <span className="font-medium">{percentageEvaluated.toFixed(1)}%</span>
          </div>
          <Progress value={percentageEvaluated} className="h-2" />
        </div>

        <div className="flex items-center justify-center gap-2">
          {isComplete ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle className="w-3 h-3" />
              Alle Bewertungen abgeschlossen
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <AlertCircle className="w-3 h-3" />
              {stats?.needingEvaluation ?? 0} Simulationen offen
            </Badge>
          )}
        </div>

        <div className="flex gap-2">
          {!isComplete && (
            <Button
              onClick={handleBackfill}
              disabled={backfillMutation.isPending || isBackfilling}
              className="flex-1"
            >
              {backfillMutation.isPending || isBackfilling ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Bewertung läuft …
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  KI-Bewertung starten
                </>
              )}
            </Button>
          )}
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="icon"
            disabled={isBackfilling}
          >
            <RefreshCw className={`w-4 h-4 ${isBackfilling ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {isBackfilling && (
          <p className="text-xs text-muted-foreground text-center">
            Die Bewertungen laufen im Hintergrund und können mehrere Minuten dauern.
          </p>
        )}

        {isLoading && (
          <p className="text-xs text-muted-foreground text-center">Lade aktuelle Kennzahlen …</p>
        )}
      </CardContent>
    </Card>
  );
}
