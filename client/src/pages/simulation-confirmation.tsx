import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Play, Check, Clock, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SimulationRun {
  id: string;
  runNumber: number;
  techniqueId: string;
  techniqueName: string;
  tacticId: string;
  tacticName: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: string;
  completedAt?: string;
  totalRounds: number;
  successScore?: number;
  zopaAchieved?: boolean;
}

interface NegotiationWithRuns {
  id: string;
  contextId: string;
  contextName: string;
  buyerAgentName: string;
  sellerAgentName: string;
  userRole: string;
  maxRounds: number;
  selectedTechniques: string[];
  selectedTactics: string[];
  userZopa: any;
  counterpartDistance: any;
  status: string;
  createdAt: string;
  simulationRuns: SimulationRun[];
}

export default function SimulationConfirmation() {
  const [, setLocation] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const negotiationId = urlParams.get("id");
  const [isStarting, setIsStarting] = useState(false);

  const { data: negotiation, isLoading } = useQuery<NegotiationWithRuns>({
    queryKey: ["/api/negotiations", negotiationId],
    enabled: !!negotiationId,
  });

  const startAllSimulations = async () => {
    if (!negotiation) return;
    
    setIsStarting(true);
    try {
      const response = await fetch(`/api/negotiations/${negotiationId}/start-simulations`, {
        method: "POST",
      });
      
      if (response.ok) {
        // Navigate to tracking screen
        setLocation(`/negotiations/${negotiationId}/tracking`);
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
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!negotiation) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Negotiation not found. Please go back and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const totalRuns = negotiation.simulationRuns.length;
  const completedRuns = negotiation.simulationRuns.filter(run => run.status === "completed").length;
  const failedRuns = negotiation.simulationRuns.filter(run => run.status === "failed").length;
  const runningRuns = negotiation.simulationRuns.filter(run => run.status === "running").length;
  const COST_PER_RUN = 0.11; // Average cost per simulation run
  const estimatedCost = totalRuns * COST_PER_RUN;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Simulation Confirmation</h1>
        <p className="text-muted-foreground mt-2">
          Review your negotiation setup and start the simulation runs
        </p>
      </div>

      {/* Configuration Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Negotiation Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium">Context</h4>
              <p className="text-sm text-muted-foreground">{negotiation.contextName}</p>
            </div>
            <div>
              <h4 className="font-medium">Agents</h4>
              <p className="text-sm text-muted-foreground">
                Buyer: {negotiation.buyerAgentName} | Seller: {negotiation.sellerAgentName}
              </p>
            </div>
            <div>
              <h4 className="font-medium">Your Role</h4>
              <Badge variant="outline" className="capitalize">{negotiation.userRole}</Badge>
            </div>
            <div>
              <h4 className="font-medium">Max Rounds per Simulation</h4>
              <p className="text-sm text-muted-foreground">{negotiation.maxRounds} rounds</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Simulation Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium">Total Simulation Runs</h4>
              <p className="text-2xl font-bold text-blue-600">{totalRuns}</p>
              <p className="text-sm text-muted-foreground">
                {negotiation.selectedTechniques.length} techniques × {negotiation.selectedTactics.length} tactics
              </p>
            </div>
            
            <div>
              <h4 className="font-medium">Estimated Cost</h4>
              <p className="text-2xl font-bold text-green-600">
                ~${estimatedCost.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">
                Based on an average of ${COST_PER_RUN.toFixed(2)} per run.
              </p>
            </div>
            
            {totalRuns > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Progress</span>
                  <span className="text-sm">{completedRuns}/{totalRuns}</span>
                </div>
                <Progress value={(completedRuns / totalRuns) * 100} className="w-full" />
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-green-600" />
                    {completedRuns} completed
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-blue-600" />
                    {runningRuns} running
                  </span>
                  {failedRuns > 0 && (
                    <span className="flex items-center gap-1">
                      <X className="h-3 w-3 text-red-600" />
                      {failedRuns} failed
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Simulation Runs Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Simulation Run Matrix</CardTitle>
          <p className="text-sm text-muted-foreground">
            Each combination of technique and tactic will be tested in a separate simulation
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {negotiation.simulationRuns.map((run) => (
              <Card key={run.id} className="relative">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-xs">
                      Run #{run.runNumber}
                    </Badge>
                    <Badge 
                      variant={
                        run.status === "completed" ? "default" :
                        run.status === "running" ? "secondary" :
                        run.status === "failed" ? "destructive" : "outline"
                      }
                      className="text-xs"
                    >
                      {run.status}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <h5 className="text-sm font-medium">Technique</h5>
                      <p className="text-xs text-muted-foreground">{run.techniqueName}</p>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium">Tactic</h5>
                      <p className="text-xs text-muted-foreground">{run.tacticName}</p>
                    </div>
                    
                    {run.status === "completed" && run.successScore && (
                      <div>
                        <h5 className="text-sm font-medium">Success Score</h5>
                        <p className="text-sm font-bold text-green-600">{run.successScore}/100</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-4 justify-end">
        <Button 
          variant="outline" 
          onClick={() => setLocation("/negotiations/new")}
        >
          Back to Configuration
        </Button>
        
        {negotiation.status === "pending" && (
          <Button 
            onClick={startAllSimulations}
            disabled={isStarting || totalRuns === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Play className="h-4 w-4 mr-2" />
            {isStarting ? "Starting Simulations..." : `Start All ${totalRuns} Simulations`}
          </Button>
        )}
        
        {negotiation.status !== "pending" && (
          <Button 
            onClick={() => setLocation(`/negotiations/${negotiationId}/tracking`)}
            variant="outline"
          >
            View Progress
          </Button>
        )}
      </div>
    </div>
  );
}
