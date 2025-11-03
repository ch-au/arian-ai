import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";
import { useLocation } from "wouter";

const pageTitles: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Dashboard",
    description: "Monitor live negotiations and platform performance"
  },
  "/agents": {
    title: "Agent Configuration",
    description: "Configure AI agents with personalities and tactics"
  },
  "/negotiations": {
    title: "Negotiations",
    description: "Monitor and manage AI negotiation sessions"
  },
  "/analytics": {
    title: "Analytics",
    description: "Advanced performance analytics and insights"
  },
  "/testing": {
    title: "Testing Suite",
    description: "Multi-scenario testing and validation"
  },
  "/reports": {
    title: "Reports",
    description: "Export and analyze negotiation reports"
  },
};

export default function Header() {
  const [location] = useLocation();
  
  const { data: systemStatus } = useQuery<any>({
    queryKey: ["/api/system/status"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const currentPage = pageTitles[location] || {
    title: "ARIAN Platform",
    description: "AI Negotiation Platform"
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{currentPage.title}</h2>
          <p className="text-gray-600 mt-1">{currentPage.description}</p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Real-time Status Indicator */}
          <div className="flex items-center space-x-2 px-3 py-2 bg-green-50 text-green-600 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse-dot"></div>
            <span className="text-sm font-medium">System Online</span>
          </div>
          
          {/* API Usage Meter */}
          {systemStatus && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Zap className="text-yellow-500 w-4 h-4" />
              <span>
                Active: <span className="font-medium text-gray-900">{(systemStatus as any).activeNegotiations || 0}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
