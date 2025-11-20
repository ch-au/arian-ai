import { useLocation } from "wouter";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Play, Check, Clock, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { NegotiationScenario } from "@/hooks/use-negotiations";
import { translateNegotiationStatus } from "@/hooks/use-negotiations";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

type NegotiationDetailResponse = {
  negotiation: {
    id: string;
    title: string;
    description?: string | null;
    status: "planned" | "running" | "completed" | "aborted";
    scenario: NegotiationScenario;
  };
  products: Array<{ id: string; name: string; brand?: string | null; attrs?: Record<string, unknown> }>;
  simulationStats: {
    totalRuns: number;
    completedRuns: number;
    runningRuns: number;
    failedRuns: number;
    pendingRuns: number;
    successRate: number;
    isPlanned: boolean;
  };
};

const DEFAULT_STATS = {
  totalRuns: 0,
  completedRuns: 0,
  runningRuns: 0,
  failedRuns: 0,
  pendingRuns: 0,
  successRate: 0,
  isPlanned: false,
};

export default function SimulationConfirmation() {
  const [, setLocation] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const negotiationId = urlParams.get("id");
  const [isStarting, setIsStarting] = useState(false);

  const { data, isLoading } = useQuery<NegotiationDetailResponse>({
    queryKey: negotiationId ? [`/api/negotiations/${negotiationId}`] : [],
    enabled: Boolean(negotiationId),
  });

  const { data: techniques = [] } = useQuery<any[]>({
    queryKey: ["/api/influencing-techniques"],
  });
  const { data: tactics = [] } = useQuery<any[]>({
    queryKey: ["/api/negotiation-tactics"],
  });

  const startAllSimulations = async () => {
    if (!negotiationId) return;
    setIsStarting(true);
    try {
      const response = await fetchWithAuth(`/api/negotiations/${negotiationId}/start`, {
        method: "POST",
      });
      if (response.ok) {
        setLocation(`/monitor/${negotiationId}`);
      }
    } catch (error) {
      console.error("Failed to start simulations:", error);
    } finally {
      setIsStarting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/3 bg-gray-200 rounded" />
          <div className="h-4 w-2/3 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!data?.negotiation) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Verhandlung nicht gefunden. Bitte gehen Sie zurück und wählen Sie eine gültige Konfiguration aus.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const negotiation = data.negotiation;
  const scenario = negotiation.scenario ?? {};
  const stats = data.simulationStats ?? DEFAULT_STATS;
  const products = data.products ?? [];
  const techniqueMap = useMemo(() => new Map(techniques.map((t: any) => [t.id, t])), [techniques]);
  const tacticMap = useMemo(() => new Map(tactics.map((t: any) => [t.id, t])), [tactics]);

  const techniqueIds = scenario.selectedTechniques ?? [];
  const tacticIds = scenario.selectedTactics ?? [];
  const matrixRows = techniqueIds.flatMap((techId) =>
    tacticIds.map((tacticId) => ({
      techniqueId: techId,
      tacticId,
      techniqueName: techniqueMap.get(techId)?.name ?? "Unbekannte Technik",
      tacticName: tacticMap.get(tacticId)?.name ?? "Unbekannte Taktik",
    })),
  );
  const totalRuns = stats.totalRuns || matrixRows.length;
  const COST_PER_RUN = 0.11;
  const estimatedCost = totalRuns * COST_PER_RUN;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{negotiation.title}</h1>
        <p className="text-muted-foreground mt-2">
          Verhandlung konfigurieren und Simulationen starten · Status: {translateNegotiationStatus(negotiation.status)}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Unternehmens- & Marktprofil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">Unternehmen</p>
              <p>{scenario.companyProfile?.organization ?? "n/v"}</p>
              <p>Land: {scenario.companyProfile?.country ?? "n/v"}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Gegenpartei</p>
              <p>{scenario.counterpartProfile?.name ?? "Noch offen"}</p>
              <p>Stil: {scenario.counterpartProfile?.style ?? "n/v"}</p>
              <p>Machtverhältnis: {scenario.counterpartProfile?.powerBalance ?? "n/v"}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Markt</p>
              <p>{scenario.market?.name ?? "Noch nicht definiert"}</p>
              <p>
                Region: {scenario.market?.region ?? "n/v"} · Währung: {scenario.market?.currencyCode ?? "n/v"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Simulation & Strategie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Strategiekombinationen</h4>
              <p className="text-2xl font-semibold text-foreground">
                {techniqueIds.length} Techniken × {tacticIds.length} Taktiken
              </p>
              <p className="text-xs text-muted-foreground">Für jede Kombination wird ein Run erzeugt.</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Kostenabschätzung</h4>
              <p className="text-2xl font-semibold text-green-600">~€{estimatedCost.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Ø Kosten pro Run: €{COST_PER_RUN.toFixed(2)}</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Fortschritt</span>
                <span>
                  {stats.completedRuns}/{totalRuns}
                </span>
              </div>
              <Progress value={totalRuns ? (stats.completedRuns / totalRuns) * 100 : 0} />
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Check className="h-3 w-3 text-green-600" />
                  {stats.completedRuns} abgeschlossen
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-blue-600" />
                  {stats.runningRuns} aktiv
                </span>
                {stats.failedRuns > 0 && (
                  <span className="flex items-center gap-1">
                    <X className="h-3 w-3 text-red-600" />
                    {stats.failedRuns} fehlgeschlagen
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Produkte & Dimensionen</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground">Produkte</h4>
            {products.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Produkte verknüpft.</p>}
            {products.map((product) => (
              <div key={product.id} className="p-3 border rounded-lg">
                <p className="font-medium">{product.name}</p>
                {product.brand && <p className="text-xs text-muted-foreground">Marke: {product.brand}</p>}
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground">Verhandlungsdimensionen</h4>
            {(scenario.dimensions ?? []).map((dim) => (
              <div key={`${dim.id ?? dim.name}`} className="p-3 border rounded-lg space-y-1">
                <p className="font-medium">{dim.name}</p>
                <p className="text-xs text-muted-foreground">
                  Ziel: {dim.targetValue} {dim.unit ?? ""} · Bereich: {dim.minValue} – {dim.maxValue}
                </p>
                <Badge variant="outline">Priorität {dim.priority}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Simulation-Matrix</CardTitle>
          <p className="text-sm text-muted-foreground">Jede Technik × Taktik-Kombination wird als eigener Run ausgeführt.</p>
        </CardHeader>
        <CardContent>
          {matrixRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bitte wählen Sie mindestens eine Technik und eine Taktik aus.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {matrixRows.map((row, index) => (
                <Card key={`${row.techniqueId}-${row.tacticId}-${index}`} className="border border-dashed">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">Run #{index + 1}</Badge>
                      <Badge variant="secondary">Bereit</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Technik</p>
                      <p className="text-sm font-medium">{row.techniqueName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Taktik</p>
                      <p className="text-sm font-medium">{row.tacticName}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={() => setLocation("/")}>
            Zurück zur Übersicht
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            disabled={isStarting || matrixRows.length === 0}
            onClick={startAllSimulations}
          >
            <Play className="h-4 w-4 mr-2" />
            {isStarting ? "Simulation wird gestartet …" : `Alle ${matrixRows.length || totalRuns} Runs starten`}
          </Button>
      </div>
    </div>
  );
}
