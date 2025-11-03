import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();

  const { data: stats, isLoading, refetch } = useQuery<EvaluationStats>({
    queryKey: ["/api/negotiations/evaluation-status"],
    refetchInterval: isBackfilling ? 5000 : false, // Poll while backfilling
  });

  const backfillMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/negotiations/backfill-evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to start backfill");
      return response.json();
    },
    onSuccess: (data) => {
      console.log("Backfill started:", data);
      setIsBackfilling(true);
      // Refetch stats after a delay to show progress
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            AI Evaluation Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const percentageEvaluated = stats.evaluationRate || 0;
  const isComplete = stats.needingEvaluation === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5" />
          AI Evaluation Status
        </CardTitle>
        <CardDescription>
          AI summaries for completed simulation runs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Eligible</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.evaluated}</div>
            <div className="text-xs text-muted-foreground">Evaluated</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.needingEvaluation}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Completion Rate</span>
            <span className="font-medium">{percentageEvaluated.toFixed(1)}%</span>
          </div>
          <Progress value={percentageEvaluated} className="h-2" />
        </div>

        {/* Status Badge */}
        <div className="flex items-center justify-center gap-2">
          {isComplete ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle className="w-3 h-3" />
              All evaluations complete
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <AlertCircle className="w-3 h-3" />
              {stats.needingEvaluation} simulation{stats.needingEvaluation !== 1 ? 's' : ''} need evaluation
            </Badge>
          )}
        </div>

        {/* Action Buttons */}
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
                  Evaluating...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Generate AI Summaries
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
            Evaluations are running in the background. This may take several minutes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}


