import React, { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRight, BarChart2, LineChart, Play } from "lucide-react";
import { useNegotiations } from "@/hooks/use-negotiations";
import { useNegotiationDetail } from "@/hooks/use-negotiation-detail";
import { buildRadarMetrics, buildActualValuesRadar, buildComparisonSummary } from "@/lib/run-comparison";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface AnalysisRun {
  id: string;
  techniqueName: string;
  tacticName: string;
  dealValue: number;
  totalRounds: number;
  outcome: string;
  actualCost?: number;
  completedAt?: string;
  zopaDistance?: string | null;
  dimensionResults?: Array<{
    dimensionName: string;
    finalValue: string | number;
    achievedTarget: boolean;
  }>;
  productResults?: Array<{
    productName: string;
    agreedPrice: string | number;
    withinZopa?: boolean;
  }>;
  techniqueEffectivenessScore?: number;
  tacticEffectivenessScore?: number;
}

interface AnalysisResponse {
  runs: AnalysisRun[];
}

const OUTCOME_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "ALL", label: "Alle Outcomes" },
  { id: "DEAL_ACCEPTED", label: "Deal erzielt" },
  { id: "WALK_AWAY", label: "Abbruch" },
  { id: "FAILED", label: "Fehlgeschlagen" },
];

export default function TestingSuite() {
  const [, setLocation] = useLocation();
  const [selectedNegotiationId, setSelectedNegotiationId] = useState<string | null>(null);
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [outcomeFilter, setOutcomeFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: negotiations = [] } = useNegotiations();
  const negotiationOptions = useMemo(
    () =>
      negotiations.map((neg) => ({
        id: neg.id,
        label: neg.title,
        summary: neg.summary,
      })),
    [negotiations],
  );

  useEffect(() => {
    if (!selectedNegotiationId && negotiationOptions.length > 0) {
      setSelectedNegotiationId(negotiationOptions[0].id);
    }
  }, [negotiationOptions, selectedNegotiationId]);

  const { data: negotiationDetail } = useNegotiationDetail(selectedNegotiationId);

  const { data: analysis, isLoading: loadingAnalysis } = useQuery<AnalysisResponse>({
    queryKey: selectedNegotiationId ? ["testing-suite-analysis-v2", selectedNegotiationId] : [],
    enabled: Boolean(selectedNegotiationId),
    staleTime: 0,
    queryFn: async ({ queryKey }) => {
      const [, negotiationId] = queryKey;
      const response = await fetchWithAuth(`/api/negotiations/${negotiationId}/analysis`);
      if (!response.ok) {
        throw new Error("Analyse konnte nicht geladen werden");
      }
      return response.json();
    },
  });

  const runs = analysis?.runs ?? [];

  useEffect(() => {
    setSelectedRunIds([]);
  }, [selectedNegotiationId]);

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      const matchesOutcome = outcomeFilter === "ALL" || run.outcome === outcomeFilter;
      const matchesSearch =
        searchTerm.trim().length === 0 ||
        run.techniqueName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        run.tacticName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesOutcome && matchesSearch;
    });
  }, [runs, outcomeFilter, searchTerm]);

  const selectedRuns = filteredRuns.filter((run) => selectedRunIds.includes(run.id));

  const radarData = buildActualValuesRadar(selectedRuns);
  const summary = buildComparisonSummary(selectedRuns);

  const handleToggleRun = (runId: string) => {
    setSelectedRunIds((prev) =>
      prev.includes(runId) ? prev.filter((id) => id !== runId) : [...prev, runId],
    );
  };

  const handleSelectAll = () => {
    if (selectedRunIds.length === filteredRuns.length) {
      setSelectedRunIds([]);
    } else {
      setSelectedRunIds(filteredRuns.map((run) => run.id));
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Testing Suite</h1>
          <p className="text-gray-600">
            Wähle eine Verhandlung und vergleiche Simulation-Runs auf einen Blick.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => selectedNegotiationId && setLocation(`/monitor/${selectedNegotiationId}`)}>
            <Play className="w-4 h-4 mr-2" />
            Monitor öffnen
          </Button>
          <Button variant="outline" size="sm" onClick={() => selectedNegotiationId && setLocation(`/negotiations/${selectedNegotiationId}/analysis`)}>
            <BarChart2 className="w-4 h-4 mr-2" />
            Analyse öffnen
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Verhandlung wählen</CardTitle>
          <CardDescription>Alle Runs dieser Verhandlung stehen für den Vergleich bereit.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Verhandlung</Label>
              <Select value={selectedNegotiationId ?? undefined} onValueChange={setSelectedNegotiationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Verhandlung auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {negotiationOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Outcome-Filter</Label>
              <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OUTCOME_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {negotiationDetail && (
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Unternehmen:</span>{" "}
                {negotiationDetail.negotiation.scenario?.companyProfile?.organization ?? "n/v"}
              </div>
              <div>
                <span className="font-medium">Gegenpartei:</span>{" "}
                {negotiationDetail.negotiation.scenario?.counterpartProfile?.name ?? "n/v"}
              </div>
              <div>
                <span className="font-medium">Produkte:</span> {negotiationDetail.products.length}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Simulation Runs</CardTitle>
            <CardDescription>Markiere Runs, um sie im Vergleich anzuzeigen.</CardDescription>
          </div>
          <Input
            placeholder="Technik oder Taktik suchen…"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="max-w-xs"
          />
        </CardHeader>
        <CardContent className="p-0">
          {loadingAnalysis ? (
            <div className="p-6 text-gray-500">Lade Simulationen …</div>
          ) : runs.length === 0 ? (
            <div className="p-6 text-gray-500">Für diese Verhandlung existieren noch keine Runs.</div>
          ) : (
            <ScrollArea className="max-h-[420px]">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="w-12 p-3 text-left">
                      <Checkbox
                        checked={
                          selectedRunIds.length > 0 && selectedRunIds.length === filteredRuns.length
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                    <th className="p-3 text-left">Technik</th>
                    <th className="p-3 text-left">Taktik</th>
                    <th className="p-3 text-left">Outcome</th>
                    <th className="p-3 text-left">Deal Value</th>
                    <th className="p-3 text-left">Runden</th>
                    <th className="p-3 text-left">Kosten</th>
                    <th className="p-3 text-left">Abschluss</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRuns.map((run) => (
                    <tr key={run.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <Checkbox
                          checked={selectedRunIds.includes(run.id)}
                          onCheckedChange={() => handleToggleRun(run.id)}
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-gray-900">{run.techniqueName}</div>
                        <div className="text-xs text-gray-500">{run.id.slice(0, 6)}</div>
                      </td>
                      <td className="p-3">{run.tacticName}</td>
                      <td className="p-3">
                        <Badge variant={run.outcome === "DEAL_ACCEPTED" ? "default" : "secondary"}>
                          {run.outcome.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="p-3">{run.dealValue ? `€ ${run.dealValue.toFixed(0)}` : "–"}</td>
                      <td className="p-3">{run.totalRounds ?? "–"}</td>
                      <td className="p-3">
                        {run.actualCost ? `€ ${Number(run.actualCost).toFixed(2)}` : "–"}
                      </td>
                      <td className="p-3 text-xs text-gray-500">
                        {run.completedAt ? new Date(run.completedAt).toLocaleString("de-DE") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Vergleich ausgewählter Runs</CardTitle>
            <CardDescription>
              {selectedRuns.length < 2
                ? "Bitte mindestens zwei Runs auswählen, um den Radar-Vergleich zu sehen."
                : "Radar-Diagramm zeigt relative Performance pro Kennzahl."}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[360px]">
            {selectedRuns.length < 2 ? (
              <div className="h-full flex items-center justify-center text-gray-500">
                Markiere mindestens zwei Runs in der Tabelle.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" key={selectedRunIds.join(',')}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarRadiusAxis angle={45} domain={[0, 100]} />
                  {selectedRuns.map((run, index) => (
                    <Radar
                      key={run.id}
                      name={`${run.techniqueName} × ${run.tacticName}${run.zopaDistance ? ` (${run.zopaDistance})` : ''}`}
                      dataKey={run.id}
                      strokeWidth={2}
                      stroke={`hsl(${index * 55}, 70%, 45%)`}
                      fill={`hsl(${index * 55}, 70%, 60%)`}
                      fillOpacity={0.2}
                    />
                  ))}
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Vergleichs-KPIs</CardTitle>
            <CardDescription>Aggregierte Werte für die aktuelle Auswahl.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Ausgewählte Runs</p>
              <p className="text-3xl font-bold">{selectedRuns.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Ø Deal Value</p>
              <p className="text-xl font-semibold">
                {selectedRuns.length ? `€ ${summary.avgDealValue.toFixed(0)}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Ø Runden</p>
              <p className="text-xl font-semibold">
                {selectedRuns.length ? summary.avgRounds.toFixed(1) : "—"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Dimensionserfolg</p>
              <p className="text-xl font-semibold">
                {selectedRuns.length ? `${summary.successShare.toFixed(1)}%` : "—"}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                disabled={!selectedRuns.length}
                onClick={() => selectedNegotiationId && setLocation(`/analysis/${selectedNegotiationId}`)}
              >
                <LineChart className="w-4 h-4 mr-2" />
                Analyse-Detail
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!selectedRuns.length}
                onClick={() => selectedNegotiationId && setLocation(`/reports?negotiationId=${selectedNegotiationId}`)}
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Ergebnis exportieren
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
