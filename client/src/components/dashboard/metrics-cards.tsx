import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { HandMetal, CheckCircle, Clock, Play, TrendingUp, TrendingDown } from "lucide-react";

interface MetricsCardsProps {
  metrics: {
    activeNegotiations: number;
    successRate: number;
    avgDuration: number;
    runningNegotiations: number;
    finishedNegotiations: number;
    totalSimulationRuns: number;
    recentTrend: {
      activeNegotiationsChange: number;
      successRateChange: number;
      avgDurationChange: number;
      runningNegotiationsChange: number;
      finishedNegotiationsChange: number;
    };
  };
}

export default function MetricsCards({ metrics }: MetricsCardsProps) {
  const changeFormatter = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  const durationFormatter = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  const formatChange = (change: number, suffix: string = "%") => {
    const isPositive = change >= 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const color = isPositive ? "text-emerald-600" : "text-red-600"; // Emerald for success, standard red for down

    return (
      <div className={`flex items-center text-xs font-medium ${color}`}>
        <Icon className="w-3 h-3 mr-1" />
        <span>
          {isPositive ? "+" : ""}
          {changeFormatter.format(change)}
          {suffix}
        </span>
        <span className="text-muted-foreground ml-1.5 font-normal">vs. letzter Zeitraum</span>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Active Negotiations */}
      <Card className="border-blue-200 bg-gradient-to-br from-white to-blue-50/40">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
            <p className="text-sm font-semibold text-slate-600">Aktive Verhandlungen</p>
            <div className="p-2.5 bg-blue-100 rounded-lg border-2 border-blue-200 shadow-sm">
              <HandMetal className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
              {metrics.activeNegotiations}
            </h3>
            {formatChange(metrics.recentTrend.activeNegotiationsChange)}
          </div>
        </CardContent>
      </Card>

      {/* Success Rate */}
      <Card className="border-emerald-200 bg-gradient-to-br from-white to-emerald-50/40">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
            <p className="text-sm font-semibold text-slate-600">Erfolgsquote</p>
            <div className="p-2.5 bg-emerald-100 rounded-lg border-2 border-emerald-200 shadow-sm">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
              {changeFormatter.format(metrics.successRate)}%
            </h3>
            {formatChange(metrics.recentTrend.successRateChange)}
          </div>
        </CardContent>
      </Card>

      {/* Avg Duration */}
      <Card className="border-amber-200 bg-gradient-to-br from-white to-amber-50/40">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
            <p className="text-sm font-semibold text-slate-600">Ø Runden pro Simulation</p>
            <div className="p-2.5 bg-amber-100 rounded-lg border-2 border-amber-200 shadow-sm">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
              {durationFormatter.format(metrics.avgDuration)}
            </h3>
            {formatChange(metrics.recentTrend.avgDurationChange, "")}
          </div>
        </CardContent>
      </Card>

      {/* Total Simulation Runs */}
      <Card className="border-purple-200 bg-gradient-to-br from-white to-purple-50/40">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
            <p className="text-sm font-semibold text-slate-600">Anzahl Simulationsläufe</p>
            <div className="p-2.5 bg-purple-100 rounded-lg border-2 border-purple-200 shadow-sm">
              <Play className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
              {metrics.totalSimulationRuns}
            </h3>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
