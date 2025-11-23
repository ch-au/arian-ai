import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HandMetal, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import type { NegotiationListItem } from "@/hooks/use-negotiations";
import { translateNegotiationStatus } from "@/hooks/use-negotiations";

interface LiveNegotiationsProps {
  negotiations: NegotiationListItem[];
}

// Badge variants mapping
const BADGE_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  running: "default", // Blue/Primary usually
  completed: "secondary", // Greenish or secondary
  planned: "outline",
  aborted: "destructive",
};

// Custom styles for badges if needed to match specific colors
const BADGE_STYLES: Record<string, string> = {
  running: "bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200",
  completed: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200",
  planned: "bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-200",
  aborted: "bg-red-50 text-red-700 hover:bg-red-50 border-red-200",
};

export default function LiveNegotiations({ negotiations }: LiveNegotiationsProps) {
  const [, setLocation] = useLocation();

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100 pb-4 bg-gradient-to-r from-white to-emerald-50/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-primary">Live-Verhandlungen</CardTitle>
          <div className="flex items-center space-x-2 bg-emerald-100 px-2 py-1 rounded-full">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse-dot"></div>
            <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Live</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {negotiations.length > 0 ? (
          <div className="flex flex-col">
            {negotiations.slice(0, 3).map((negotiation, index) => (
              <div 
                key={negotiation.id} 
                className={`flex items-center justify-between p-4 hover:bg-slate-50 transition-colors ${
                  index !== negotiations.slice(0, 3).length - 1 ? "border-b border-slate-100" : ""
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200">
                    <HandMetal className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">{negotiation.summary}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge 
                        variant="outline" 
                        className={`font-normal text-xs h-5 px-2 ${BADGE_STYLES[negotiation.status]}`}
                      >
                        {translateNegotiationStatus(negotiation.status)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {negotiation.marketLabel}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right min-w-[100px]">
                  <div className="flex items-center justify-end gap-2 mb-1">
                    <span className="text-xs font-medium text-foreground">
                      {Math.round(negotiation.progressPercentage)}%
                    </span>
                  </div>
                  <Progress 
                    value={negotiation.progressPercentage} 
                    className="h-1.5 w-24"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {negotiation.simulationStats.completedRuns}/{negotiation.simulationStats.totalRuns || 0} Runs
                  </p>
                </div>
              </div>
            ))}
            
            <div className="p-4 border-t border-slate-100">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center text-primary hover:text-primary hover:bg-primary/5"
                onClick={() => setLocation("/")}
              >
                Alle Verhandlungen anzeigen
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-4">
              <HandMetal className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-foreground">Keine aktiven Verhandlungen</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
              Starten Sie eine neue Simulation, um Live-Updates zu sehen.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
