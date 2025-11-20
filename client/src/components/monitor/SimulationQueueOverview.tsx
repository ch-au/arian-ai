/**
 * Simulation Queue Overview Component
 * Displays high-level progress for the entire simulation queue
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, XCircle, Loader2, Pause } from "lucide-react";

interface SimulationQueueOverviewProps {
  totalRuns: number;
  completedRuns: number;
  runningRuns: number;
  pendingRuns: number;
  failedRuns: number;
  estimatedTimeRemaining?: number; // in seconds
}

export function SimulationQueueOverview({
  totalRuns,
  completedRuns,
  runningRuns,
  pendingRuns,
  failedRuns,
  estimatedTimeRemaining,
}: SimulationQueueOverviewProps) {
  const progressPercentage = totalRuns > 0 ? (completedRuns / totalRuns) * 100 : 0;

  const formatTime = (seconds?: number) => {
    if (seconds === undefined) return "Berechnung läuft …";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} Min ${secs.toString().padStart(2, "0")} s`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Fortschritt der Simulationen</span>
          <div className="flex gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-green-600" />
              {completedRuns}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
              {runningRuns}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Pause className="w-3 h-3 text-gray-600" />
              {pendingRuns}
            </Badge>
            {failedRuns > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                {failedRuns}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              {completedRuns} von {totalRuns} Simulationen abgeschlossen
            </span>
            <span className="font-medium">{progressPercentage.toFixed(1)}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-gray-600">Geschätzte Restzeit</div>
              <div className="font-medium">{formatTime(estimatedTimeRemaining)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="w-4 h-4 text-blue-600" />
            <div>
              <div className="text-gray-600">Aktiv laufend</div>
              <div className="font-medium">
                {runningRuns} Simulation{runningRuns === 1 ? "" : "en"}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SimulationQueueOverviewSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-2 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-12 bg-gray-200 rounded animate-pulse" />
          <div className="h-12 bg-gray-200 rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}
