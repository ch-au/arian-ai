import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, LogOut, User } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";

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
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const { data: systemStatus } = useQuery<any>({
    queryKey: ["/api/system/status"],
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!user,
  });

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

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

          {/* User Menu */}
          {user && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg border-2 border-blue-200">
                <User className="w-4 h-4" />
                <span className="text-sm font-medium">{user.username}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
