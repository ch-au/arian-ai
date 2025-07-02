import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLocation } from "wouter";
import { Play, Square, Eye, Plus, Clock, CheckCircle, XCircle, Users, BarChart3 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";


interface Negotiation {
  id: string;
  contextId: string;
  buyerAgentId: string;
  sellerAgentId: string;
  status: "pending" | "active" | "completed" | "failed";
  startedAt: string;
  completedAt: string;
  totalRounds: number;
  maxRounds: number;
  finalAgreement: any;
  successScore: number;
}

export default function Negotiations() {
  const [selectedNegotiation, setSelectedNegotiation] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: negotiations, isLoading } = useQuery<Negotiation[]>({
    queryKey: ["/api/negotiations"],
    refetchInterval: 5000,
  });

  const { data: agents } = useQuery({
    queryKey: ["/api/agents"],
  });

  const { data: contexts } = useQuery({
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
      const response = await apiRequest("POST", `/api/negotiations/${negotiationId}/stop`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/negotiations"] });
      toast({
        title: "Negotiation Stopped",
        description: "The negotiation has been stopped successfully.",
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

  // WebSocket connection for real-time updates
  useWebSocket("ws://localhost:5000/ws", (message) => {
    if (message.type === 'negotiation_started' || message.type === 'round_completed' || message.type === 'negotiation_completed') {
      queryClient.invalidateQueries({ queryKey: ["/api/negotiations"] });
      
      if (message.type === 'negotiation_completed') {
        toast({
          title: "Negotiation Completed",
          description: `Negotiation ${message.negotiationId} has finished.`,
        });
      }
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500";
      case "completed": return "bg-blue-500";
      case "failed": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active": return <Clock className="h-4 w-4" />;
      case "completed": return <CheckCircle className="h-4 w-4" />;
      case "failed": return <XCircle className="h-4 w-4" />;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Negotiations</h1>
          <p className="text-muted-foreground">Monitor and manage AI negotiation sessions</p>
        </div>
        <Button 
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => setLocation("/negotiations/new")}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Negotiation
        </Button>
      </div>

      {/* Empty State */}
      {negotiations && negotiations.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <div className="mx-auto max-w-sm">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-blue-100 p-4">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No negotiations yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first AI negotiation session to get started with automated negotiations between intelligent agents.
              </p>
              <Button 
                onClick={() => setLocation("/negotiations/new")} 
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="mr-2 h-4 w-4" />
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
                  <TableHead>Context</TableHead>
                  <TableHead>Agents</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Success Score</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {negotiations?.map((negotiation) => {
                  const buyerAgent = (agents as any)?.find((a: any) => a.id === negotiation.buyerAgentId);
                  const sellerAgent = (agents as any)?.find((a: any) => a.id === negotiation.sellerAgentId);
                  const context = (contexts as any)?.find((c: any) => c.id === negotiation.contextId);
                  const progressPercent = Math.round((negotiation.totalRounds / (negotiation.maxRounds || 1)) * 100);

                  return (
                    <TableRow key={negotiation.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {context?.name || 'Unknown Context'}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="text-blue-600">B: {buyerAgent?.name || 'Unknown'}</div>
                          <div className="text-green-600">S: {sellerAgent?.name || 'Unknown'}</div>
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
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground">
                            {negotiation.totalRounds}/{negotiation.maxRounds} rounds
                          </div>
                          <Progress value={progressPercent} className="h-2" />
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDuration(negotiation.startedAt, negotiation.completedAt)}
                      </TableCell>
                      <TableCell>
                        {negotiation.status === "completed" && negotiation.successScore ? (
                          <span className={
                            negotiation.successScore > 70 ? "text-green-600 font-medium" : 
                            negotiation.successScore > 40 ? "text-yellow-600 font-medium" : 
                            "text-red-600 font-medium"
                          }>
                            {negotiation.successScore}%
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
                            onClick={() => setSelectedNegotiation(negotiation.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {negotiation.status === "pending" && (
                            <Button 
                              variant="ghost"
                              size="sm"
                              onClick={() => startNegotiationMutation.mutate(negotiation.id)}
                              disabled={startNegotiationMutation.isPending}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          
                          {negotiation.status === "active" && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => stopNegotiationMutation.mutate(negotiation.id)}
                              disabled={stopNegotiationMutation.isPending}
                            >
                              <Square className="h-4 w-4" />
                            </Button>
                          )}

                          {negotiation.status === "completed" && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setSelectedNegotiation(negotiation.id)}
                            >
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                          )}
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

      {/* Negotiation Detail Panel */}
      {selectedNegotiation && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Negotiation Details</CardTitle>
              <Button variant="outline" onClick={() => setSelectedNegotiation(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p>Negotiation details for {selectedNegotiation} will be shown here</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}