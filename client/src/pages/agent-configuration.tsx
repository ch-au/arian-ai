import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit2, Trash2, Brain } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AgentConfiguration() {
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { toast } = useToast();

  const { data: agents, isLoading } = useQuery({
    queryKey: ["/api/agents"],
  });

  const deleteAgentMutation = useMutation({
    mutationFn: async (agentId: string) => {
      await apiRequest("DELETE", `/api/agents/${agentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Agent deleted",
        description: "The agent has been successfully deleted.",
      });
      setSelectedAgent(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete agent. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 mt-2" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agent Configuration</h1>
          <p className="text-gray-600 mt-2">Configure AI negotiation agents with personalities, tactics, and influencing techniques</p>
        </div>
        <Button 
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Agent
        </Button>
      </div>

      {agents && agents.length === 0 ? (
        <div className="text-center py-12">
          <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No agents configured</h3>
          <p className="text-gray-600 mb-6">
            Create your first AI negotiation agent to get started with automated negotiations.
          </p>
          <Button 
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Agent
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents?.map((agent: any) => (
            <Card key={agent.id} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <CardDescription className="mt-1">{agent.description}</CardDescription>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedAgent(agent)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAgentMutation.mutate(agent.id)}
                      disabled={deleteAgentMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Power Level</span>
                    <Badge variant="secondary">{agent.powerLevel}/10</Badge>
                  </div>
                  <Progress value={parseFloat(agent.powerLevel) * 10} className="h-2" />
                </div>
                
                <div>
                  <span className="text-sm font-medium mb-2 block">Personality Profile</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>Openness: {(agent.personalityProfile?.openness * 100 || 50).toFixed(0)}%</div>
                    <div>Conscientiousness: {(agent.personalityProfile?.conscientiousness * 100 || 50).toFixed(0)}%</div>
                    <div>Extraversion: {(agent.personalityProfile?.extraversion * 100 || 50).toFixed(0)}%</div>
                    <div>Agreeableness: {(agent.personalityProfile?.agreeableness * 100 || 50).toFixed(0)}%</div>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>Last Updated</span>
                    <span>{new Date(agent.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Placeholder for create/edit form */}
      {(showCreateForm || selectedAgent) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="text-center py-8">
              <h2 className="text-xl font-bold mb-4">
                {selectedAgent ? 'Edit Agent' : 'Create New Agent'}
              </h2>
              <p className="text-gray-600 mb-6">
                Agent configuration form will be available soon with full personality, tactics, and technique selection.
              </p>
              <Button
                onClick={() => {
                  setShowCreateForm(false);
                  setSelectedAgent(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}