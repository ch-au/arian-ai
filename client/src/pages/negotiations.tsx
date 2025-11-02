import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useLocation } from "wouter";
import { Play, Square, Eye, Plus, Clock, CheckCircle, XCircle, Users, BarChart3, Trash2, AlertTriangle, Edit, Activity, StopCircle, Pause } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";


interface Negotiation {
  id: string;
  title: string;
  negotiationType: "one-shot" | "multi-year";
  relationshipType: "first" | "long-standing";
  contextId: string;
  buyerAgentId: string;
  sellerAgentId: string;
  status: "configured" | "running" | "completed" | "error" | "pending";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  totalRounds?: number;
  maxRounds?: number;
  // Removed: finalAgreement and successScore (fields don't exist in schema)
  simulationRunsCount?: number;
  completedRunsCount?: number;
}

export default function Negotiations() {
  const [selectedNegotiation, setSelectedNegotiation] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: negotiations, isLoading } = useQuery<Negotiation[]>({
    queryKey: ["/api/negotiations"],
    refetchInterval: 5000,
  });

  const { data: agents } = useQuery<any[]>({
    queryKey: ["/api/agents"],
  });

  const { data: contexts } = useQuery<any[]>({
    queryKey: ["/api/contexts"],
  });

  const startNegotiationMutation = useMutation({
    mutationFn: async (negotiationId: string) => {
      const response = await apiRequest("POST", `/api/negotiations/${negotiationId}/start`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/negotiations"] });
      toast({
        title: "Negotiation Started",
        description: "The negotiation has been started successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to start negotiation",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const stopNegotiationMutation = useMutation({
    mutationFn: async (negotiationId: string) => {
      // First get the active queue for this negotiation
      const queuesResponse = await apiRequest("GET", `/api/simulations/queues?negotiationId=${negotiationId}`);
      const queues = await queuesResponse.json();
      
      // Stop all active queues for this negotiation
      const activeQueues = queues.filter((q: any) => q.status === 'running' || q.status === 'pending');
      
      if (activeQueues.length > 0) {
        await Promise.all(
          activeQueues.map((queue: any) => 
            apiRequest("POST", `/api/simulations/queue/${queue.id}/stop`)
          )
        );
      }
      
      // Also call the negotiation stop endpoint as fallback
      const response = await apiRequest("POST", `/api/negotiations/${negotiationId}/stop`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/negotiations"] });
      toast({
        title: "Negotiation Stopped",
        description: "All simulation queues have been stopped successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to stop negotiation",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const stopAllMutation = useMutation({
    mutationFn: async () => {
      // Get all running negotiations
      const runningNegotiations = negotiations?.filter(n => n.status === 'running') || [];
      
      // Stop all of them
      await Promise.all(
        runningNegotiations.map(async (negotiation) => {
          try {
            // Get active queues for this negotiation
            const queuesResponse = await apiRequest("GET", `/api/simulations/queues?negotiationId=${negotiation.id}`);
            const queues = await queuesResponse.json();
            
            // Stop all active queues
            const activeQueues = queues.filter((q: any) => q.status === 'running' || q.status === 'pending');
            
            if (activeQueues.length > 0) {
              await Promise.all(
                activeQueues.map((queue: any) => 
                  apiRequest("POST", `/api/simulations/queue/${queue.id}/stop`)
                )
              );
            }
          } catch (error) {
            console.error(`Failed to stop negotiation ${negotiation.id}:`, error);
          }
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/negotiations"] });
      toast({
        title: "All Simulations Stopped",
        description: "All running simulation queues have been stopped successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to stop all simulations",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const deleteNegotiationMutation = useMutation({
    mutationFn: async (negotiationId: string) => {
      const response = await apiRequest("DELETE", `/api/negotiations/${negotiationId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/negotiations"] });
      setDeleteConfirmId(null);
      toast({
        title: "Negotiation Deleted",
        description: "The negotiation has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete negotiation",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // WebSocket connection for real-time updates
  // Broaden WebSocket handling: also react to queue and simulation events
  useWebSocket("/ws", {
    onMessage: (message: any) => {
      const actionableTypes = new Set([
        'negotiation_started',
        'round_completed',
        'negotiation_completed',
        'simulation_started',
        'simulation_completed',
        'simulation_failed',
        'simulation_stopped',
        'queue_progress',
        'queue_completed'
      ]);

      if (actionableTypes.has(message.type)) {
        queryClient.invalidateQueries({ queryKey: ["/api/negotiations"] });

        if (message.type === 'negotiation_completed' || message.type === 'queue_completed') {
          toast({
            title: "Negotiation Completed",
            description: `Negotiation ${message.negotiationId || ''} has finished.`,
          });
        }
      }
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running": return "bg-green-500";
      case "completed": return "bg-blue-500";
      case "error": return "bg-red-500";
      case "configured": return "bg-yellow-500";
      case "pending": return "bg-yellow-500"; // Same as configured
      default: return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running": return <Clock className="h-4 w-4" />;
      case "completed": return <CheckCircle className="h-4 w-4" />;
      case "error": return <XCircle className="h-4 w-4" />;
      case "configured": return <AlertTriangle className="h-4 w-4" />;
      case "pending": return <AlertTriangle className="h-4 w-4" />; // Same as configured
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const formatDuration = (startedAt: string, completedAt?: string) => {
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins}m`;
    }
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ${diffMins % 60}m`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72 mt-2" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Negotiations</h1>
          <p className="text-gray-600 mt-2">Monitor and manage AI negotiation sessions</p>
        </div>
        <div className="flex gap-2">
          {negotiations && negotiations.some(n => n.status === 'running') && (
            <Button 
              variant="destructive"
              onClick={() => stopAllMutation.mutate()}
              disabled={stopAllMutation.isPending}
            >
              {stopAllMutation.isPending ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Stopping...
                </>
              ) : (
                <>
                  <StopCircle className="mr-2 h-4 w-4" />
                  Stop All
                </>
              )}
            </Button>
          )}
          <Button 
            className="bg-primary hover:bg-primary/90"
            onClick={() => setLocation("/configure")}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Negotiation
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {negotiations && negotiations.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-200">
          <CardContent className="text-center py-20">
            <div className="mx-auto max-w-md">
              <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-3 text-gray-900">No negotiations yet</h3>
              <p className="text-gray-600 mb-8 leading-relaxed">
                Create your first AI negotiation session to get started with automated negotiations between intelligent agents. You can test different techniques and tactics to find the most effective strategies.
              </p>
              <Button 
                onClick={() => setLocation("/configure")} 
                className="bg-primary hover:bg-primary/90 text-white px-6 py-3"
                size="lg"
              >
                <Plus className="mr-2 h-5 w-5" />
                Create Your First Negotiation
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Negotiations Table */
        <Card>
          <CardHeader>
            <CardTitle>Negotiations Overview</CardTitle>
            <CardDescription>
              All your AI negotiation sessions and their current status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type & Relationship</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Simulation Runs</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Success Score</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {negotiations?.map((negotiation) => {
                  const simulationStats = (negotiation as any).simulationStats || {
                    completedRuns: 0,
                    totalRuns: 0,
                    runningRuns: 0,
                    failedRuns: 0,
                    pendingRuns: 0,
                    successRate: 0
                  };
                  const completedRuns = simulationStats.completedRuns;
                  const totalRuns = simulationStats.totalRuns;

                  return (
                    <TableRow key={negotiation.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span className="font-semibold">{negotiation.title || 'Untitled Negotiation'}</span>
                          <span className="text-xs text-muted-foreground">ID: {negotiation.id.slice(0, 8)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {negotiation.negotiationType || 'one-shot'}
                            </Badge>
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {negotiation.relationshipType === 'first' ? 'First-time' : 'Long-standing'} relationship
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          className={`${getStatusColor(negotiation.status)} text-white`}
                        >
                          {getStatusIcon(negotiation.status)}
                          <span className="ml-1 capitalize">{negotiation.status}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="text-sm">
                            <span className="font-medium">{completedRuns}/{totalRuns}</span>
                            <span className="text-muted-foreground ml-1">
                              {simulationStats.isPlanned ? "planned" : "completed"}
                            </span>
                          </div>
                          
                          {/* Active Simulations Indicator */}
                          {simulationStats.runningRuns > 0 && (
                            <div className="flex items-center gap-2 text-xs">
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                <span className="text-blue-600 font-medium">{simulationStats.runningRuns} actively running</span>
                              </div>
                            </div>
                          )}
                          
                          {/* Queue Status */}
                          <div className="flex gap-2 text-xs">
                            {simulationStats.pendingRuns > 0 && (
                              <span className="text-gray-600">{simulationStats.pendingRuns} pending</span>
                            )}
                            {simulationStats.failedRuns > 0 && (
                              <span className="text-red-600">{simulationStats.failedRuns} failed</span>
                            )}
                          </div>
                          
                          {totalRuns > 0 && (
                            <Progress value={(completedRuns / totalRuns) * 100} className="h-2" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {negotiation.createdAt ? new Date(negotiation.createdAt).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        {totalRuns > 0 && completedRuns > 0 ? (
                          <span className={
                            simulationStats.successRate > 70 ? "text-green-600 font-medium" : 
                            simulationStats.successRate > 40 ? "text-yellow-600 font-medium" : 
                            "text-red-600 font-medium"
                          }>
                            {simulationStats.successRate}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setLocation(`/simulation-monitor/${negotiation.id}`)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLocation(`/simulation-monitor/${negotiation.id}`)}
                            title="Monitor Simulations"
                          >
                            <Activity className="h-4 w-4" />
                          </Button>

                          {completedRuns > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setLocation(`/negotiations/${negotiation.id}/analysis`)}
                              title="Analyse Results"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                          )}

                          {(negotiation.status === "configured" || negotiation.status === "pending") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                console.log(`Editing negotiation: ${negotiation.id}`);
                                console.log(`Navigating to: /configure?edit=${negotiation.id}`);
                                setLocation(`/configure?edit=${negotiation.id}`);
                              }}
                              title="Edit Configuration"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}

                          {(negotiation.status === "configured" || negotiation.status === "pending") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startNegotiationMutation.mutate(negotiation.id)}
                              disabled={startNegotiationMutation.isPending}
                              title="Start Simulation"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          
                          {negotiation.status === "running" && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => stopNegotiationMutation.mutate(negotiation.id)}
                              disabled={stopNegotiationMutation.isPending}
                              title="Stop Simulation"
                            >
                              <Square className="h-4 w-4" />
                            </Button>
                          )}

                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setDeleteConfirmId(negotiation.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete Negotiation"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Negotiation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this negotiation? This action cannot be undone and will permanently remove all simulation runs and conversation logs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && deleteNegotiationMutation.mutate(deleteConfirmId)}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteNegotiationMutation.isPending}
            >
              {deleteNegotiationMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
