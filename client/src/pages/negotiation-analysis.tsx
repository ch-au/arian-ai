import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, Zap, DollarSign, Target, Info, Calendar, FileText, Building2, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { OutcomeBadgeMini } from "@/components/ui/outcome-badge";
import { SimulationRunSheet } from "@/components/SimulationRunSheet";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { AnalysisVisualizations } from "@/components/analytics/AnalysisVisualizations";
import { useToast } from "@/hooks/use-toast";

interface NegotiationAnalysis {
  negotiation: {
    id: string;
    title: string;
    description?: string;
    status?: string;
    scenario?: any;
    userRole: string;
    productCount: number;
  };
  runs: Array<{
    id: string;
    runNumber: number;
    techniqueId: string;
    tacticId: string;
    techniqueName: string;
    tacticName: string;
    dealValue: number;
    totalRounds: number;
    actualCost: number;
    outcome: string;
    status: string;
    otherDimensions: Record<string, any>;
    conversationLog?: Array<{
      agent: string; 
      round: number; 
      message: string;
      offer?: {
        products?: Array<{
          name: string;
          price?: number | string;
        }>
      };
    }>;
    efficiency: number;
    rank: number;
    // AI Evaluation fields
    tacticalSummary?: string;
    techniqueEffectivenessScore?: number;
    tacticEffectivenessScore?: number;
  }>;
  summary: {
    bestDealValue: {
      runId: string;
      value: number;
      technique: string;
      tactic: string;
      rounds: number;
    } | null;
    fastestCompletion: {
      runId: string;
      rounds: number;
      technique: string;
      tactic: string;
      dealValue: number;
    } | null;
    mostEfficient: {
      runId: string;
      efficiency: number;
      technique: string;
      tactic: string;
      dealValue: number;
      rounds: number;
    } | null;
    avgDealValue: number;
    avgRounds: number;
    totalRuns: number;
    completedRuns: number;
  };
  matrix: Array<{
    techniqueId: string;
    techniqueName: string;
    tacticId: string;
    tacticName: string;
    dealValue: number;
    rounds: number;
    efficiency: number;
    runId: string;
  }>;
}

export default function NegotiationAnalysisPage() {
  const [matchWithId, paramsWithId] = useRoute("/analysis/:id");
  const [matchWithoutId] = useRoute("/analysis");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const negotiationId = paramsWithId?.id;
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isGeneratingPlaybook, setIsGeneratingPlaybook] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // If we're on /analysis without an ID, redirect to dashboard
  if (matchWithoutId && !negotiationId) {
    setLocation("/");
    return null;
  }

  const { data: analysis, isLoading, error, refetch } = useQuery<NegotiationAnalysis>({
    queryKey: [`/api/negotiations/${negotiationId}/analysis`],
    enabled: !!negotiationId,
  });

  const handleGenerateEvaluation = async () => {
    if (!negotiationId) return;

    setIsEvaluating(true);
    try {
      const response = await fetchWithAuth(`/api/negotiations/${negotiationId}/analysis/evaluate`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to generate evaluation");
      }

      // Refresh analysis data
      await refetch();
    } catch (error) {
      console.error("Evaluation failed:", error);
      alert("Fehler beim Generieren der KI-Bewertung");
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleGeneratePlaybook = async () => {
    if (!negotiationId) return;

    setIsGeneratingPlaybook(true);
    try {
      const response = await fetchWithAuth(`/api/negotiations/${negotiationId}/playbook`, {
        method: "POST",
      });

      if (!response.ok) {
        // Check for timeout errors (502, 503, 504)
        if (response.status === 504 || response.status === 503 || response.status === 502) {
          // Timeout - but playbook might still be generated in background
          toast({
            title: "Zeitüberschreitung",
            description: "Die Anfrage hat zu lange gedauert, aber das Playbook wird möglicherweise im Hintergrund generiert. Wir prüfen den Status...",
          });

          // Wait a moment and then navigate to playbook page to check if it exists
          await new Promise(resolve => setTimeout(resolve, 2000));
          setLocation(`/playbook/${negotiationId}`);
          return;
        }

        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        // Navigate to playbook page
        setLocation(`/playbook/${negotiationId}`);
      } else {
        toast({
          title: "Fehler beim Generieren",
          description: result.error || "Unbekannter Fehler",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Playbook generation failed:", error);

      // Check if it's a timeout error in the message
      const errorMsg = error.message || String(error);
      if (errorMsg.includes("504") || errorMsg.includes("503") || errorMsg.includes("timeout")) {
        toast({
          title: "Zeitüberschreitung",
          description: "Die Generierung läuft möglicherweise noch. Wir öffnen die Playbook-Seite...",
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        setLocation(`/playbook/${negotiationId}`);
        return;
      }

      toast({
        title: "Fehler beim Generieren des Playbooks",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPlaybook(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>Failed to load analysis data</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getRankBadge = (rank: number) => {
    const baseClasses = "inline-flex items-center justify-center font-bold rounded-lg shadow-sm";
    
    if (rank === 1) {
      return (
        <div className={`${baseClasses} bg-yellow-100 text-yellow-700 border border-yellow-200 w-8 h-8 text-lg`}>
          1
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className={`${baseClasses} bg-gray-100 text-gray-700 border border-gray-200 w-8 h-8 text-lg`}>
          2
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className={`${baseClasses} bg-orange-100 text-orange-800 border border-orange-200 w-8 h-8 text-lg`}>
          3
        </div>
      );
    }
    return (
      <div className={`${baseClasses} bg-slate-100 text-slate-600 border border-slate-200 w-8 h-8 text-sm`}>
        {rank}
      </div>
    );
  };

  const getPerformanceColor = (rank: number, total: number) => {
    const percentile = rank / total;
    if (percentile <= 0.33) return "bg-green-100 text-green-800 border-green-300";
    if (percentile <= 0.66) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-red-100 text-red-800 border-red-300";
  };

  // Filter completed runs - show all completed, even if dealValue is 0 (legacy data)
  const completedRuns = analysis.runs.filter(r => r.status === "completed");
  const sortedRuns = [...completedRuns].sort((a, b) => {
    if (analysis.negotiation.userRole === 'buyer') {
      // Buyer: Lower price is better. Treat 0/invalid as max value (worst)
      const valA = a.dealValue > 0 ? a.dealValue : Number.MAX_VALUE;
      const valB = b.dealValue > 0 ? b.dealValue : Number.MAX_VALUE;
      return valA - valB;
    } else {
      // Seller: Higher price is better.
      return b.dealValue - a.dealValue;
    }
  });

  // Check if we have meaningful deal values
  const hasDeals = sortedRuns.some(r => r.dealValue > 0);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500 hover:bg-green-600">Abgeschlossen</Badge>;
      case "running":
        return <Badge className="bg-blue-500 hover:bg-blue-600 animate-pulse">Läuft</Badge>;
      case "planned":
        return <Badge variant="secondary">Geplant</Badge>;
      case "aborted":
        return <Badge variant="destructive">Abgebrochen</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Improved Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="pl-0 hover:bg-transparent hover:text-primary"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück zur Übersicht
            </Button>
          </div>
          
          <div className="flex gap-2">
            {hasDeals && completedRuns.length > 0 && (
              <Button
                onClick={handleGeneratePlaybook}
                disabled={isGeneratingPlaybook}
                className="bg-blue-600 hover:bg-blue-700 shadow-sm"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                {isGeneratingPlaybook ? "Generiere Playbook..." : "Playbook generieren"}
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start gap-6 bg-card border rounded-xl p-6 shadow-sm">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{analysis.negotiation.title}</h1>
              {getStatusBadge(analysis.negotiation.status)}
            </div>
            
            {analysis.negotiation.description && (
              <p className="text-muted-foreground max-w-2xl leading-relaxed">
                {analysis.negotiation.description}
              </p>
            )}

            <div className="flex flex-wrap gap-4 pt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5 bg-secondary/50 px-2.5 py-1 rounded-md">
                <Building2 className="h-3.5 w-3.5" />
                <span>
                  {analysis.negotiation.userRole === "buyer" ? "Einkäufer" : "Verkäufer"}
                </span>
              </div>
              
              <Separator orientation="vertical" className="h-6" />
              
              <div className="flex items-center gap-1.5 bg-secondary/50 px-2.5 py-1 rounded-md">
                <Target className="h-3.5 w-3.5" />
                <span>{analysis.negotiation.productCount} Produkte</span>
              </div>
              
              <Separator orientation="vertical" className="h-6" />
              
              <div className="flex items-center gap-1.5 bg-secondary/50 px-2.5 py-1 rounded-md">
                <FileText className="h-3.5 w-3.5" />
                <span>
                  {analysis.summary.completedRuns} / {analysis.summary.totalRuns} Simulationen
                </span>
              </div>

              {analysis.negotiation.scenario?.counterpartProfile?.name && (
                <>
                  <Separator orientation="vertical" className="h-6" />
                  <div className="flex items-center gap-1.5 bg-secondary/50 px-2.5 py-1 rounded-md">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>Gegenpart: {analysis.negotiation.scenario.counterpartProfile.name}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick Stats on the right */}
          {hasDeals && (
            <div className="grid grid-cols-2 gap-4 min-w-[300px]">
              <div className="bg-secondary/20 p-3 rounded-lg border">
                <div className="text-xs text-muted-foreground mb-1">Durchschnittswert</div>
                <div className="text-xl font-bold text-primary">
                  {formatCurrency(analysis.summary.avgDealValue)}
                </div>
              </div>
              <div className="bg-secondary/20 p-3 rounded-lg border">
                <div className="text-xs text-muted-foreground mb-1">Ø Runden</div>
                <div className="text-xl font-bold text-primary">
                  {Math.round(analysis.summary.avgRounds * 10) / 10}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Visualizations */}
      <AnalysisVisualizations runs={analysis.runs} />

      {/* Performance Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Matrix: Technik × Taktik</CardTitle>
          <CardDescription>
            Farbcodierung nach Deal Value: Grün (beste) → Gelb → Rot (schlechteste) ·
            <Info className="inline h-3 w-3 mx-1" />
            Klicke auf eine Zelle für KI-Bewertung und Details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border p-2 bg-gray-50 text-left font-medium">Technik / Taktik</th>
                  {[...new Set(analysis.matrix.map(m => m.tacticName))].map(tactic => (
                    <th key={tactic} className="border p-2 bg-gray-50 text-center font-medium min-w-[150px]">
                      {tactic}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...new Set(analysis.matrix.map(m => m.techniqueName))].map(technique => (
                  <tr key={technique}>
                    <td className="border p-2 font-medium bg-gray-50">{technique}</td>
                    {[...new Set(analysis.matrix.map(m => m.tacticName))].map(tactic => {
                      // Get all completed runs for this technique/tactic combination
                      const cellRuns = analysis.runs.filter(
                        r => r.techniqueName === technique && r.tacticName === tactic && r.status === 'completed'
                      );

                      if (cellRuns.length === 0) {
                        return (
                          <td key={tactic} className="border p-2 bg-gray-100 text-center text-gray-400">
                            -
                          </td>
                        );
                      }

                      // Calculate averages, excluding zero deal values
                      const cellRunsWithDeals = cellRuns.filter(r => r.dealValue > 0);
                      const avgDealValue = cellRunsWithDeals.length > 0
                        ? cellRunsWithDeals.reduce((sum, r) => sum + r.dealValue, 0) / cellRunsWithDeals.length
                        : 0;
                      const avgRounds = cellRuns.reduce((sum, r) => sum + r.totalRounds, 0) / cellRuns.length;

                      // Calculate rank based on average deal value
                      let rank;
                      if (analysis.negotiation.userRole === 'buyer') {
                        // Buyer: Count runs with LOWER (better) deal value
                        rank = sortedRuns.filter(r => r.dealValue < avgDealValue && r.dealValue > 0).length + 1;
                      } else {
                        // Seller: Count runs with HIGHER (better) deal value
                        rank = sortedRuns.filter(r => r.dealValue > avgDealValue).length + 1;
                      }
                      
                      const colorClass = getPerformanceColor(rank, sortedRuns.length);
                      const hasEvaluation = cellRuns.some(r => r.tacticalSummary);

                      return (
                        <td
                          key={tactic}
                          className={`border p-3 ${colorClass} cursor-pointer hover:opacity-80 transition-opacity relative`}
                          onClick={() => {
                            setSelectedRunId(cellRuns[0].id);
                            setSheetOpen(true);
                          }}
                        >
                          <div className="text-center">
                            <div className="mb-2 flex justify-center">{getRankBadge(rank)}</div>
                            <div className="font-bold text-lg">{formatCurrency(avgDealValue)}</div>
                            <div className="text-xs mt-1">{Math.round(avgRounds)} Runden (Ø)</div>
                            {hasEvaluation && (
                              <div className="absolute top-1 right-1">
                                <Info className="h-4 w-4 text-purple-600" />
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detaillierte Ergebnisse</CardTitle>
          <CardDescription>Alle Simulation Runs sortiert nach Performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">#</th>
                  <th className="text-left p-2 font-medium">Technik</th>
                  <th className="text-left p-2 font-medium">Taktik</th>
                  <th className="text-right p-2 font-medium">Deal Value</th>
                  <th className="text-right p-2 font-medium">Runden</th>
                  <th className="text-right p-2 font-medium">Effizienz</th>
                  <th className="text-left p-2 font-medium">Ergebnis</th>
                  <th className="text-left p-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedRuns.map((run, index) => {
                  const rank = index + 1;
                  const colorClass = getPerformanceColor(rank, sortedRuns.length);

                  return (
                    <tr key={run.id} className={`border-b hover:bg-gray-50 ${colorClass}`}>
                      <td className="p-2">
                        {getRankBadge(rank)}
                      </td>
                      <td className="p-2 font-medium">{run.techniqueName}</td>
                      <td className="p-2">{run.tacticName}</td>
                      <td className="p-2 text-right font-bold">{formatCurrency(run.dealValue)}</td>
                      <td className="p-2 text-right">{run.totalRounds}</td>
                      <td className="p-2 text-right text-sm text-muted-foreground">
                        {formatCurrency(run.efficiency)}/Runde
                      </td>
                      <td className="p-2">
                        <OutcomeBadgeMini outcome={run.outcome} />
                      </td>
                      <td className="p-2">
                        <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                          Abgeschlossen
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* AI Insights Panel */}
      {hasDeals && analysis.summary.bestDealValue && (() => {
        const bestRun = analysis.runs.find(r => r.id === analysis.summary.bestDealValue?.runId);
        if (!bestRun) return null;
        const hasEvaluation = bestRun?.tacticalSummary;

        return (
          <Card className="border-2 border-purple-500 bg-purple-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🤖 KI-Analyse: Beste Strategie
              </CardTitle>
              <CardDescription>
                Basierend auf Langfuse Prompt "simulation_eval" für: "{analysis.summary.bestDealValue!.technique}" + "{analysis.summary.bestDealValue!.tactic}"
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasEvaluation ? (
                <>
                  {/* AI Generated Summary */}
                  <div className="bg-white p-4 rounded-lg border border-purple-200">
                    <h4 className="font-semibold mb-2">📝 Taktische Zusammenfassung</h4>
                    <p className="text-sm leading-relaxed">{bestRun.tacticalSummary}</p>
                  </div>

                  {/* Effectiveness Scores */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-lg border border-purple-200">
                      <h4 className="font-semibold mb-2">📊 Influence Technique Score</h4>
                      <div className="flex items-center gap-2">
                        <div className="text-3xl font-bold text-purple-600">
                          {bestRun.techniqueEffectivenessScore}/10
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {analysis.summary.bestDealValue!.technique}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-purple-200">
                      <h4 className="font-semibold mb-2">🎯 Tactic Effectiveness Score</h4>
                      <div className="flex items-center gap-2">
                        <div className="text-3xl font-bold text-purple-600">
                          {bestRun.tacticEffectivenessScore}/10
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {analysis.summary.bestDealValue!.tactic}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Performance Context */}
                  <div className="bg-white p-4 rounded-lg border border-purple-200">
                    <h4 className="font-semibold mb-2">💰 Verhandlungsergebnis</h4>
                    <ul className="space-y-1 text-sm">
                      <li><strong>Deal Value:</strong> {formatCurrency(analysis.summary.bestDealValue!.value)}</li>
                      <li><strong>Runden:</strong> {analysis.summary.bestDealValue!.rounds}</li>
                      <li><strong>Effizienz:</strong> {formatCurrency(analysis.summary.bestDealValue!.value / analysis.summary.bestDealValue!.rounds)}/Runde</li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="font-bold text-lg mb-2">
                      Empfehlung: "{analysis.summary.bestDealValue!.technique}" + "{analysis.summary.bestDealValue!.tactic}"
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Klicke auf "KI-Bewertung generieren" um eine detaillierte Analyse zu erhalten.
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-purple-200">
                    <h4 className="font-semibold mb-2">✅ Warum diese Kombination?</h4>
                    <ul className="space-y-2 ml-4 text-sm">
                      <li>
                        <strong>Bester Deal Value:</strong> {formatCurrency(analysis.summary.bestDealValue!.value)}
                        {analysis.summary.avgDealValue > 0 && (
                          <span className="text-sm text-muted-foreground ml-2">
                            ({
                              analysis.negotiation.userRole === 'buyer' 
                                ? Math.round(((analysis.summary.avgDealValue - analysis.summary.bestDealValue!.value) / analysis.summary.avgDealValue) * 100)
                                : Math.round(((analysis.summary.bestDealValue!.value - analysis.summary.avgDealValue) / analysis.summary.avgDealValue) * 100)
                            }% vs. Durchschnitt)
                          </span>
                        )}
                      </li>
                      <li>
                        <strong>Verhandlungsdauer:</strong> {analysis.summary.bestDealValue!.rounds} Runden
                        {analysis.summary.avgRounds > 0 && analysis.summary.bestDealValue!.rounds <= analysis.summary.avgRounds && (
                          <span className="text-sm text-green-600 ml-2">
                            (Schneller als Durchschnitt)
                          </span>
                        )}
                      </li>
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Simulation Run Details Sheet */}
      <SimulationRunSheet
        simulationRunId={selectedRunId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
