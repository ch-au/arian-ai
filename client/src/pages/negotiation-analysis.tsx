import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, Zap, DollarSign, Target, Info, Calendar, FileText, Building2, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const negotiationId = paramsWithId?.id;
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isGeneratingPlaybook, setIsGeneratingPlaybook] = useState(false);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);

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
      const response = await fetch(`/api/negotiations/${negotiationId}/analysis/evaluate`, {
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
      const response = await fetch(`/api/negotiations/${negotiationId}/playbook`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to generate playbook");
      }

      const result = await response.json();

      if (result.success) {
        // Navigate to playbook page
        setLocation(`/playbook/${negotiationId}`);
      } else {
        alert(`Fehler beim Generieren des Playbooks: ${result.error || 'Unbekannter Fehler'}`);
      }
    } catch (error) {
      console.error("Playbook generation failed:", error);
      alert("Fehler beim Generieren des Playbooks");
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
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `${rank}️⃣`;
  };

  const getPerformanceColor = (rank: number, total: number) => {
    const percentile = rank / total;
    if (percentile <= 0.33) return "bg-green-100 text-green-800 border-green-300";
    if (percentile <= 0.66) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-red-100 text-red-800 border-red-300";
  };

  // Filter completed runs - show all completed, even if dealValue is 0 (legacy data)
  const completedRuns = analysis.runs.filter(r => r.status === "completed");
  const sortedRuns = [...completedRuns].sort((a, b) => b.dealValue - a.dealValue);

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
            {hasDeals && completedRuns.some(r => !r.tacticalSummary) && (
              <Button
                onClick={handleGenerateEvaluation}
                disabled={isEvaluating}
                className="bg-purple-600 hover:bg-purple-700 shadow-sm"
              >
                {isEvaluating ? "Generiere KI-Bewertung..." : "🤖 KI-Bewertung generieren"}
              </Button>
            )}
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
                      const rank = sortedRuns.filter(r => r.dealValue > avgDealValue).length + 1;
                      const colorClass = getPerformanceColor(rank, sortedRuns.length);
                      const hasEvaluation = cellRuns.some(r => r.tacticalSummary);

                      return (
                        <td
                          key={tactic}
                          className={`border p-3 ${colorClass} cursor-pointer hover:opacity-80 transition-opacity relative`}
                          onClick={() => setSelectedCell(cellRuns[0].id)}
                        >
                          <div className="text-center">
                            <div className="text-2xl mb-1">{getRankBadge(rank)}</div>
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
                        <span className="text-2xl">{getRankBadge(rank)}</span>
                      </td>
                      <td className="p-2 font-medium">{run.techniqueName}</td>
                      <td className="p-2">{run.tacticName}</td>
                      <td className="p-2 text-right font-bold">{formatCurrency(run.dealValue)}</td>
                      <td className="p-2 text-right">{run.totalRounds}</td>
                      <td className="p-2 text-right text-sm text-muted-foreground">
                        {formatCurrency(run.efficiency)}/Runde
                      </td>
                      <td className="p-2">
                        <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                          {run.outcome}
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
                        <strong>Höchster Deal Value:</strong> {formatCurrency(analysis.summary.bestDealValue!.value)}
                        {analysis.summary.avgDealValue > 0 && (
                          <span className="text-sm text-muted-foreground ml-2">
                            (+{Math.round(((analysis.summary.bestDealValue!.value - analysis.summary.avgDealValue) / analysis.summary.avgDealValue) * 100)}% vs. Durchschnitt)
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

      {/* Dialog for Cell Details */}
      {selectedCell && (() => {
        const selectedRun = analysis.runs.find(r => r.id === selectedCell);
        if (!selectedRun) return null;

        const technique = analysis.runs.find(r => r.techniqueId === selectedRun.techniqueId);
        const tactic = analysis.runs.find(r => r.tacticId === selectedRun.tacticId);

        return (
          <Dialog open={!!selectedCell} onOpenChange={() => setSelectedCell(null)}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl">
                  Run #{selectedRun.runNumber}: {selectedRun.techniqueName} × {selectedRun.tacticName}
                </DialogTitle>
                <DialogDescription>
                  Detaillierte KI-Bewertung dieser Kombination
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {/* Performance Overview */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-muted-foreground">Deal Value</div>
                    <div className="text-lg font-bold">{formatCurrency(selectedRun.dealValue)}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-muted-foreground">Runden</div>
                    <div className="text-lg font-bold">{selectedRun.totalRounds}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-muted-foreground">Effizienz</div>
                    <div className="text-lg font-bold">{formatCurrency(selectedRun.efficiency)}/R</div>
                  </div>
                </div>

                {/* AI Evaluation Scores */}
                {(selectedRun.techniqueEffectivenessScore || selectedRun.tacticEffectivenessScore) && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3">🤖 KI-Bewertung</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedRun.techniqueEffectivenessScore && (
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                          <div className="text-sm text-muted-foreground mb-1">Influence Technique</div>
                          <div className="text-3xl font-bold text-purple-600">
                            {selectedRun.techniqueEffectivenessScore}/10
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">{selectedRun.techniqueName}</div>
                        </div>
                      )}
                      {selectedRun.tacticEffectivenessScore && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                          <div className="text-sm text-muted-foreground mb-1">Verhandlungstaktik</div>
                          <div className="text-3xl font-bold text-blue-600">
                            {selectedRun.tacticEffectivenessScore}/10
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">{selectedRun.tacticName}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tactical Summary */}
                {selectedRun.tacticalSummary && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">📝 Taktische Zusammenfassung</h4>
                    <p className="text-sm leading-relaxed bg-gray-50 p-4 rounded-lg">
                      {selectedRun.tacticalSummary}
                    </p>
                  </div>
                )}

                {/* No Evaluation Yet */}
                {!selectedRun.tacticalSummary && (
                  <div className="border-t pt-4">
                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                      <p className="text-sm text-amber-800">
                        ℹ️ Für diesen Run wurde noch keine KI-Bewertung generiert.
                        {analysis.summary.bestDealValue?.runId === selectedRun.id && (
                          <span className="block mt-2">
                            Dies ist der beste Run - klicke auf "KI-Bewertung generieren" um eine Analyse zu erhalten.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Price Evolution Visualization */}
                {selectedRun.conversationLog && selectedRun.conversationLog.length > 0 && (() => {
                  // Extract product prices from conversation log
                  const priceEvolution: Record<string, Array<{round: number, price: number | null}>> = {};

                  selectedRun.conversationLog?.forEach((round) => {
                    if (round.offer?.products) {
                      round.offer.products.forEach((product: any) => {
                        if (!priceEvolution[product.name]) {
                          priceEvolution[product.name] = [];
                        }
                        priceEvolution[product.name].push({
                          round: round.round,
                          price: product.price !== null && product.price !== undefined ? parseFloat(product.price) : null
                        });
                      });
                    }
                  });

                  const hasProductData = Object.keys(priceEvolution).length > 0;

                  return hasProductData ? (
                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-3">📈 Preisverlauf über Verhandlungsrunden</h4>
                      <div className="space-y-4">
                        {Object.entries(priceEvolution).map(([productName, rounds]) => {
                          const validPrices = rounds.filter(r => r.price !== null).map(r => r.price!);
                          if (validPrices.length === 0) return null;

                          const minPrice = Math.min(...validPrices);
                          const maxPrice = Math.max(...validPrices);
                          const range = maxPrice - minPrice || 1;

                          return (
                            <div key={productName} className="space-y-1">
                              <div className="text-sm font-medium text-gray-700">{productName}</div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-8 bg-gray-100 rounded relative">
                                  {rounds.map((r, idx) => {
                                    if (r.price === null) return null;
                                    const position = ((r.price - minPrice) / range) * 100;
                                    const isBuyer = selectedRun?.conversationLog?.[idx]?.agent === 'BUYER';

                                    return (
                                      <div
                                        key={idx}
                                        className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white ${
                                          isBuyer ? 'bg-blue-500' : 'bg-green-500'
                                        }`}
                                        style={{ left: `${position}%` }}
                                        title={`Runde ${r.round}: €${r.price.toFixed(2)}`}
                                      />
                                    );
                                  })}
                                </div>
                                <div className="text-xs text-gray-500 w-20 text-right">
                                  €{minPrice.toFixed(2)} - €{maxPrice.toFixed(2)}
                                </div>
                              </div>
                              <div className="flex gap-3 text-xs text-gray-600">
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                  Käufer
                                </span>
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                  Verkäufer
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Conversation Log */}
                {selectedRun.conversationLog && selectedRun.conversationLog.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">💬 Gesprächsprotokoll ({selectedRun.conversationLog.length} Nachrichten)</h4>
                    <div className="max-h-96 overflow-y-auto space-y-3">
                      {selectedRun.conversationLog.map((round, idx) => (
                        <div key={idx} className="bg-gray-50 p-3 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              round.agent === 'BUYER' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {round.agent === 'BUYER' ? 'Käufer' : 'Verkäufer'}
                            </span>
                            <span className="text-xs text-muted-foreground">Runde {round.round}</span>
                          </div>
                          <p className="text-sm leading-relaxed">{round.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Outcome & Other Info */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2">ℹ️ Weitere Details</h4>
                  <div className="text-sm space-y-1">
                    <div><strong>Outcome:</strong> {selectedRun.outcome || 'N/A'}</div>
                    <div><strong>Status:</strong> {selectedRun.status}</div>
                    <div><strong>Kosten:</strong> €{selectedRun.actualCost.toFixed(4)}</div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
