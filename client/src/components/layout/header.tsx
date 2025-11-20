import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";
import { useLocation } from "wouter";
import { useUser } from "@stackframe/react";

const pageTitles: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Dashboard",
    description: "Zentrale Übersicht aller Verhandlungen"
  },
  "/monitor": {
    title: "Simulation Monitor",
    description: "Status und Fortschritt laufender Simulationen"
  },
  "/analysis": {
    title: "Verhandlungsanalyse",
    description: "Detaillierte Auswertung abgeschlossener Verhandlungen"
  },
  "/create-negotiation": {
    title: "Neue Verhandlung",
    description: "Verhandlung konfigurieren und starten"
  },
};

export default function Header() {
  const [location] = useLocation();
  const user = useUser();
  
  const { data: systemStatus } = useQuery<any>({
    queryKey: ["/api/system/status"],
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!user,
  });

  // Handle dynamic routes (with IDs)
  let currentPage = pageTitles[location];

  if (!currentPage) {
    if (location.startsWith("/monitor/")) {
      currentPage = pageTitles["/monitor"];
    } else if (location.startsWith("/analysis/")) {
      currentPage = pageTitles["/analysis"];
    } else {
      currentPage = {
        title: "ARIAN Platform",
        description: "AI Negotiation Platform"
      };
    }
  }

  return (
    <header className="bg-white border-b-2 border-border px-6 py-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{currentPage.title}</h1>
          <p className="text-sm text-slate-600">{currentPage.description}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Real-time Status Indicator */}
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg border-2 border-emerald-200 shadow-sm">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse-dot"></div>
            <span className="text-sm font-semibold">System Online</span>
          </div>
          
          {/* API Usage Meter */}
          {systemStatus && (
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-700 rounded-lg border-2 border-slate-200 shadow-sm">
              <Zap className="text-amber-500 w-4 h-4" />
              <span className="text-sm">
                Active: <span className="font-semibold text-slate-900">{(systemStatus as any).activeNegotiations || 0}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
