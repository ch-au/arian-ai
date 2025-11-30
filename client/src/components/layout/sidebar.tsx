import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { queryClient } from "@/lib/queryClient";
import { useNegotiationContext } from "@/contexts/negotiation-context";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Monitor,
  BarChart3,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LogIn,
  User,
  LogOut
} from "lucide-react";

const navigationItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    description: "Zentrale Übersicht"
  },
];

export default function Sidebar() {
  const [location] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user } = useAuth();
  const { selectedNegotiationId } = useNegotiationContext();

  // Check if we're currently on the playbook page
  const isOnPlaybookPage = location.startsWith(`/playbook/`);

  // Fetch negotiation stats to determine if links should be enabled
  const { data: negotiationStats } = useQuery<any>({
    queryKey: [`/api/negotiations/${selectedNegotiationId}`],
    enabled: !!selectedNegotiationId,
    refetchInterval: 5000, // Refetch every 5 seconds to detect playbook updates
  });

  const simulationStats = negotiationStats?.simulationStats;
  const hasCompletedRuns = (simulationStats?.completedRuns || 0) > 0;
  const allRunsComplete = simulationStats?.totalRuns > 0 &&
    simulationStats?.completedRuns === simulationStats?.totalRuns &&
    simulationStats?.runningRuns === 0 &&
    simulationStats?.pendingRuns === 0;
  const hasPlaybook = !!negotiationStats?.negotiation?.playbook || isOnPlaybookPage;

  // Context-aware navigation items (shown when a negotiation is selected)
  const contextNavigationItems = selectedNegotiationId ? [
    {
      title: "Monitor",
      href: `/monitor/${selectedNegotiationId}`,
      icon: Monitor,
      description: "Laufende Simulationen",
      disabled: false,
    },
    {
      title: "Analyse",
      href: `/analysis/${selectedNegotiationId}`,
      icon: BarChart3,
      description: "Detaillierte Auswertungen",
      disabled: !hasCompletedRuns,
    },
    {
      title: "Playbook",
      href: `/playbook/${selectedNegotiationId}`,
      icon: BookOpen,
      description: "KI-generiertes Playbook",
      disabled: !hasPlaybook && !allRunsComplete,
    },
  ] : [];

  return (
    <aside 
      className={cn(
        "bg-primary text-primary-foreground flex flex-col shadow-xl border-r border-primary/20 transition-all duration-300 relative",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-6 h-6 w-6 rounded-full bg-primary border border-primary-foreground/20 text-primary-foreground shadow-md hover:bg-primary hover:text-white z-50"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </Button>

      {/* Header / Logo Section */}
      <div className={cn(
        "border-b border-primary-foreground/10 flex items-center transition-all duration-300",
        isCollapsed ? "p-4 justify-center" : "p-6"
      )}>
        <div className={cn("flex items-center", isCollapsed ? "justify-center" : "space-x-3")}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img 
              src="/assets/arian-logo-small.png" 
              alt="ARIAN Logo" 
              className="w-full h-full object-cover"
            />
          </div>
          
          {!isCollapsed && (
            <div className="overflow-hidden whitespace-nowrap transition-all duration-300 animate-in fade-in slide-in-from-left-5">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">ARIA-N</h1>
                <span className="text-[10px] text-primary-foreground/50 font-medium">v0.91</span>
              </div>
              <p className="text-[10px] text-primary-foreground/70 uppercase tracking-wider font-medium">
                AI Negotiation Platform
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
        <ul className="space-y-2 px-3">
          {/* Main Navigation */}
          {navigationItems.map((item) => {
            const isActive = location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link href={item.href}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full flex items-center transition-all duration-200 hover:bg-primary-foreground/10 hover:text-primary-foreground",
                      isCollapsed ? "justify-center px-2 h-12" : "justify-start h-16 px-4 py-3",
                      isActive
                        ? "bg-primary-foreground/10 text-primary-foreground font-semibold shadow-sm ring-1 ring-primary-foreground/10"
                        : "text-primary-foreground/70"
                    )}
                    title={isCollapsed ? item.title : undefined}
                  >
                    <Icon className={cn(
                      "flex-shrink-0 opacity-90 transition-all",
                      isCollapsed ? "w-6 h-6" : "w-5 h-5 mr-3 mt-0.5"
                    )} />

                    {!isCollapsed && (
                      <div className="flex flex-col items-start text-left overflow-hidden whitespace-nowrap animate-in fade-in slide-in-from-left-2">
                        <span className="font-medium text-sm">{item.title}</span>
                        <span className="text-xs opacity-70 mt-0.5 leading-tight font-normal">
                          {(item as any).description}
                        </span>
                      </div>
                    )}
                  </Button>
                </Link>
              </li>
            );
          })}

          {/* Context Navigation (shown when negotiation is selected) */}
          {contextNavigationItems.length > 0 && (
            <>
              <li className="pt-4 pb-2">
                {!isCollapsed && (
                  <div className="px-4">
                    <div className="text-xs font-semibold text-primary-foreground/50 uppercase tracking-wider">
                      Ausgewählte Verhandlung
                    </div>
                  </div>
                )}
              </li>
              {contextNavigationItems.map((item) => {
                const isActive = location === item.href;
                const Icon = item.icon;
                const isDisabled = item.disabled;

                return (
                  <li key={item.href}>
                    {isDisabled ? (
                      <Button
                        variant="ghost"
                        disabled
                        className={cn(
                          "w-full flex items-center transition-all duration-200 cursor-not-allowed",
                          isCollapsed ? "justify-center px-2 h-12" : "justify-start h-16 px-4 py-3",
                          "text-primary-foreground/30 opacity-50"
                        )}
                        title={isCollapsed ? `${item.title} (noch nicht verfügbar)` : undefined}
                      >
                        <Icon className={cn(
                          "flex-shrink-0 opacity-90 transition-all",
                          isCollapsed ? "w-6 h-6" : "w-5 h-5 mr-3 mt-0.5"
                        )} />

                        {!isCollapsed && (
                          <div className="flex flex-col items-start text-left overflow-hidden whitespace-nowrap">
                            <span className="font-medium text-sm">{item.title}</span>
                            <span className="text-xs opacity-70 mt-0.5 leading-tight font-normal">
                              {item.description}
                            </span>
                          </div>
                        )}
                      </Button>
                    ) : (
                      <Link href={item.href}>
                        <Button
                          variant="ghost"
                          className={cn(
                            "w-full flex items-center transition-all duration-200 hover:bg-primary-foreground/10 hover:text-primary-foreground",
                            isCollapsed ? "justify-center px-2 h-12" : "justify-start h-16 px-4 py-3",
                            isActive
                              ? "bg-primary-foreground/10 text-primary-foreground font-semibold shadow-sm ring-1 ring-primary-foreground/10"
                              : "text-primary-foreground/70"
                          )}
                          title={isCollapsed ? item.title : undefined}
                        >
                          <Icon className={cn(
                            "flex-shrink-0 opacity-90 transition-all",
                            isCollapsed ? "w-6 h-6" : "w-5 h-5 mr-3 mt-0.5"
                          )} />

                          {!isCollapsed && (
                            <div className="flex flex-col items-start text-left overflow-hidden whitespace-nowrap animate-in fade-in slide-in-from-left-2">
                              <span className="font-medium text-sm">{item.title}</span>
                              <span className="text-xs opacity-70 mt-0.5 leading-tight font-normal">
                                {item.description}
                              </span>
                            </div>
                          )}
                        </Button>
                      </Link>
                    )}
                  </li>
                );
              })}
            </>
          )}
        </ul>
      </nav>

      {/* Partner Logos Section - Moved ABOVE User Profile */}
      <div className={cn(
        "border-t border-primary-foreground/10 transition-all duration-300",
        isCollapsed ? "p-0 h-0 opacity-0 overflow-hidden" : "p-6 opacity-100 h-auto"
      )}>
        <div className="flex flex-col space-y-6 items-start opacity-90">
          <img 
            src="/assets/retail-ai-logo-weiss-2025.svg" 
            alt="Retail AI Logo" 
            className="w-32 h-auto transition-opacity duration-300"
          />
          <img 
            src="/assets/HSM_Logo_Dachmarke_RGB_neg.png" 
            alt="HSM Logo" 
            className="w-28 h-auto transition-opacity duration-300"
          />
        </div>
      </div>

      {/* User Profile Section - Moved to BOTTOM */}
      <div className={cn(
        "border-t border-primary-foreground/10 flex items-center transition-all duration-300 bg-primary-foreground/5",
        isCollapsed ? "p-4 justify-center" : "p-4"
      )}>
        {user ? (
          <div className={cn("flex items-center w-full justify-between", isCollapsed ? "justify-center" : "gap-2")}>
            <div className={cn("flex items-center min-w-0", !isCollapsed && "gap-3")}>
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-primary shadow-sm flex-shrink-0">
                <User className="h-4 w-4" />
              </div>
              {!isCollapsed && user && (
                <div className="flex flex-col overflow-hidden min-w-0 animate-in fade-in slide-in-from-left-2">
                  <span className="text-sm font-medium truncate text-primary-foreground">{user.username}</span>
                  <span className="text-xs opacity-70 truncate text-primary-foreground/70">User ID: {user.id}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <Link href="/login">
            <Button
              variant="ghost"
              className={cn(
                "w-full text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground",
                isCollapsed ? "px-0" : "justify-start"
              )}
            >
              <LogIn className={cn("h-5 w-5", !isCollapsed && "mr-2")} />
              {!isCollapsed && "Sign In"}
            </Button>
          </Link>
        )}
      </div>
    </aside>
  );
}
