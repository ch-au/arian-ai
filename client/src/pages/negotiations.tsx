import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Square, Eye, Plus, Clock, CheckCircle, XCircle } from "lucide-react";
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
  const { toast } = useToast();

  const { data: negotiations, isLoading } = useQuery<Negotiation[]>({
    queryKey: ["/api/negotiations"],
    refetchInterval: 5000, // Refresh every 5 seconds
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
        title: "Error",
        description: "Failed to start negotiation. Please try again.",
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
        title: "Error",
        description: "Failed to stop negotiation. Please try again.",
        variant: "destructive",
      });
    },
  });

  // WebSocket connection for real-time updates
  useWebSocket('/ws', {
    onMessage: (data) => {
      if (data.type === 'negotiation_started' || data.type === 'round_completed' || data.type === 'negotiation_completed') {
        queryClient.invalidateQueries({ queryKey: ["/api/negotiations"] });
        
        if (data.type === 'negotiation_completed') {
          toast({
            title: "Negotiation Completed",
            description: `Negotiation ${data.negotiationId} has completed with a success score of ${data.data.successScore}%.`,
          });
        }
      }
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-gray-500" />;
      case "active":
        return <Play className="h-4 w-4 text-blue-500" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "gray";
      case "active":
        return "blue";
      case "completed":
        return "green";
      case "failed":
        return "red";
      default:
        return "gray";
    }
  };

  const getAgentName = (agentId: string) => {
    return agents?.find((agent: any) => agent.id === agentId)?.name || "Unknown Agent";
  };

  const getContextName = (contextId: string) => {
    return contexts?.find((context: any) => context.id === contextId)?.name || "Unknown Context";
  };

  const formatDuration = (startedAt: string, completedAt?: string) => {
    if (!startedAt) return "Not started";
    
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000 / 60); // minutes
    
    return `${duration}m`;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Negotiations</h1>
          <p className="text-gray-600 mt-1">Monitor and manage AI negotiation sessions</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Negotiation
        </Button>
      </div>

      <div className="space-y-4">
        {negotiations?.map((negotiation) => (
          <Card key={negotiation.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(negotiation.status)}
                  <div>
                    <CardTitle className="text-lg">
                      {getContextName(negotiation.contextId)}
                    </CardTitle>
                    <CardDescription>
                      {getAgentName(negotiation.buyerAgentId)} vs {getAgentName(negotiation.sellerAgentId)}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={getStatusColor(negotiation.status) as any}>
                    {negotiation.status}
                  </Badge>
                  <div className="flex space-x-1">
                    {negotiation.status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() => startNegotiationMutation.mutate(negotiation.id)}
                        disabled={startNegotiationMutation.isPending}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Start
                      </Button>
                    )}
                    {negotiation.status === "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => stopNegotiationMutation.mutate(negotiation.id)}
                        disabled={stopNegotiationMutation.isPending}
                      >
                        <Square className="h-4 w-4 mr-1" />
                        Stop
                      </Button>
                    )}
                    <Button size="sm" variant="outline">
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Progress</div>
                  <div className="flex items-center space-x-2">
                    <Progress 
                      value={(negotiation.totalRounds / negotiation.maxRounds) * 100} 
                      className="flex-1"
                    />
                    <span className="text-sm text-gray-600">
                      {negotiation.totalRounds}/{negotiation.maxRounds}
                    </span>
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-500">Duration</div>
                  <div className="font-medium">
                    {formatDuration(negotiation.startedAt, negotiation.completedAt)}
                  </div>
                </div>
                
                {negotiation.successScore !== null && (
                  <div>
                    <div className="text-sm text-gray-500">Success Score</div>
                    <div className="font-medium">
                      {negotiation.successScore}%
                    </div>
                  </div>
                )}
                
                <div>
                  <div className="text-sm text-gray-500">Started</div>
                  <div className="font-medium">
                    {negotiation.startedAt 
                      ? new Date(negotiation.startedAt).toLocaleTimeString()
                      : "Not started"
                    }
                  </div>
                </div>
              </div>

              {negotiation.finalAgreement && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg">
                  <div className="text-sm font-medium text-green-900 mb-2">Final Agreement</div>
                  <div className="text-sm text-green-700">
                    {Object.entries(negotiation.finalAgreement).map(([key, value]) => (
                      <span key={key} className="mr-4">
                        {key}: {typeof value === 'number' ? value.toLocaleString() : value}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {negotiations?.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <div className="text-gray-500 mb-4">No negotiations found</div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Negotiation
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
