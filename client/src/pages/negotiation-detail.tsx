import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, BarChart2, Monitor, Play } from "lucide-react";
import { useNegotiationDetail } from "@/hooks/use-negotiation-detail";
import { translateNegotiationStatus } from "@/hooks/use-negotiations";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useToast } from "@/hooks/use-toast";

export default function NegotiationDetailPage() {
  const [, params] = useRoute("/negotiations/:id");
  const [, setLocation] = useLocation();
  const negotiationId = params?.id ?? null;
  const { data, isLoading } = useNegotiationDetail(negotiationId);
  const { toast } = useToast();

  const scenario = data?.negotiation.scenario;

  const handleStart = async () => {
    if (!negotiationId) return;
    try {
      const response = await fetchWithAuth(`/api/negotiations/${negotiationId}/start`, { method: "POST" });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Fehler beim Starten der Simulation");
      }
      const payload = await response.json();

      if (payload?.action === "already_completed") {
        toast({
          title: "Alle Simulationen durchgeführt",
          description: payload.message ?? "Keine offenen Simulationen mehr.",
        });
        return;
      }

      toast({
        title: "Simulation gestartet",
        description: "Die Verhandlung läuft jetzt in der Queue.",
      });
      setLocation(`/negotiations/${negotiationId}`);
    } catch (error) {
      toast({
        title: "Start fehlgeschlagen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 w-64 rounded bg-muted animate-pulse" />
        <div className="h-32 rounded bg-muted animate-pulse" />
        <div className="h-32 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  if (!data || !scenario) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Verhandlung nicht gefunden</CardTitle>
            <CardDescription>
              Bitte kehre zur Übersicht zurück und wähle eine gültige Verhandlung.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/")}>Zurück</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = data.simulationStats;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück
          </Button>
          <h1 className="text-3xl font-bold">{data.negotiation.title}</h1>
          <p className="text-muted-foreground">
            {scenario.companyProfile?.organization ?? "Unternehmen"} ↔ {scenario.counterpartProfile?.name ?? "Gegenpartei"}
          </p>
          <Badge>{translateNegotiationStatus(data.negotiation.status)}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLocation(`/negotiations/${negotiationId}/analysis`)}>
            <BarChart2 className="mr-2 h-4 w-4" />
            Analyse
          </Button>
          <Button variant="outline" onClick={() => setLocation(`/negotiations/${negotiationId}`)}>
            <Monitor className="mr-2 h-4 w-4" />
            Monitoring
          </Button>
          <Button onClick={handleStart}>
            <Play className="mr-2 h-4 w-4" />
            Simulation starten
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Verhandlungskontext</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3 text-sm text-muted-foreground">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Unternehmen</p>
            <p className="text-base text-foreground">{scenario.companyProfile?.organization ?? "Offen"}</p>
            <p>Land: {scenario.companyProfile?.country ?? "n/v"}</p>
            <p>Strategie: {scenario.negotiationType ?? "n/v"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Gegenpartei</p>
            <p className="text-base text-foreground">{scenario.counterpartProfile?.name ?? "Noch offen"}</p>
            <p>Stil: {scenario.counterpartProfile?.style ?? "n/v"}</p>
            <p>Macht: {scenario.counterpartProfile?.powerBalance ?? "n/v"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Markt & Produkte</p>
            <p className="text-base text-foreground">{scenario.market?.name ?? "Markt offen"}</p>
            <p>Währung: {scenario.market?.currencyCode ?? "n/v"}</p>
            <p>{data.products.length} Produkte</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Simulation Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Fortschritt</span>
                <span>
                  {stats.completedRuns}/{stats.totalRuns || 0}
                </span>
              </div>
              <Progress value={stats.totalRuns ? (stats.completedRuns / stats.totalRuns) * 100 : 0} />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Laufend</p>
                <p className="text-lg font-semibold text-blue-600">{stats.runningRuns}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Ausstehend</p>
                <p className="text-lg font-semibold text-yellow-600">{stats.pendingRuns}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Abgeschlossen</p>
                <p className="text-lg font-semibold text-green-600">{stats.completedRuns}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Fehlgeschlagen</p>
                <p className="text-lg font-semibold text-red-600">{stats.failedRuns}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Strategie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Techniken</p>
              <div className="flex flex-wrap gap-2">
                {(scenario.selectedTechniques ?? []).map((tech) => (
                  <Badge key={tech} variant="outline">
                    {tech}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Taktiken</p>
              <div className="flex flex-wrap gap-2">
                {(scenario.selectedTactics ?? []).map((tactic) => (
                  <Badge key={tactic} variant="outline">
                    {tactic}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Produkte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.products.length === 0 && <p className="text-sm text-muted-foreground">Keine Produkte verknüpft.</p>}
            {data.products.map((product) => (
              <div key={product.id} className="rounded border p-3">
                <p className="font-medium text-foreground">{product.name}</p>
                {product.brand && <p className="text-xs text-muted-foreground">Marke: {product.brand}</p>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dimensionen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(scenario.dimensions ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Noch keine Dimensionen definiert.</p>
            )}
            {(scenario.dimensions ?? []).map((dim) => (
              <div key={dim.id ?? dim.name} className="rounded border p-3 text-sm">
                <p className="font-medium text-foreground">{dim.name}</p>
                <p className="text-xs text-muted-foreground">
                  Ziel: {dim.targetValue} · Bereich: {dim.minValue} – {dim.maxValue} {dim.unit ?? ""}
                </p>
                <Badge variant="outline">Priorität {dim.priority}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
import React from "react";
