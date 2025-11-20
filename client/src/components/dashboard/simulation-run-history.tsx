import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, List } from "lucide-react";
import { useLocation } from "wouter";
import type { NegotiationListItem } from "@/hooks/use-negotiations";
import { translateNegotiationStatus } from "@/hooks/use-negotiations";

interface SimulationRunHistoryProps {
  negotiations: NegotiationListItem[];
  isLoading: boolean;
}

export default function SimulationRunHistory({ negotiations, isLoading }: SimulationRunHistoryProps) {
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Simulationen</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Lade Verlauf …</p>
        </CardContent>
      </Card>
    );
  }

  const items = negotiations.slice(0, 4);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <List className="w-5 h-5 mr-2" />
          Simulationen & Fortschritt
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.length === 0 ? (
            <p className="text-sm text-gray-500">Noch keine Simulationen vorhanden.</p>
          ) : (
            items.map((neg) => (
              <div key={neg.id} className="p-4 border rounded-lg flex justify-between items-center gap-4">
                <div className="flex-1">
                  <h4 className="font-semibold">{neg.title}</h4>
                  <p className="text-sm text-gray-600">{neg.summary}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge variant="outline">
                      {neg.simulationStats.completedRuns}/{neg.simulationStats.totalRuns || 0} Runs
                    </Badge>
                    <Badge variant={neg.status === "completed" ? "default" : "secondary"}>
                      {translateNegotiationStatus(neg.status)}
                    </Badge>
                    <Badge variant="outline">
                      Techniken {neg.techniqueCount} · Taktiken {neg.tacticCount}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation(`/negotiations/${neg.id}`)}
                >
                  Details <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
