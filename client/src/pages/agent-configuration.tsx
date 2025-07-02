import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings, Trash2, User } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Agent {
  id: string;
  name: string;
  description: string;
  personalityProfile: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  powerLevel: number;
  preferredTactics: string[];
  createdAt: string;
}

export default function AgentConfiguration() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const { toast } = useToast();

  const { data: agents, isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: tactics } = useQuery({
    queryKey: ["/api/tactics"],
  });

  const createAgentMutation = useMutation({
    mutationFn: async (agentData: any) => {
      const response = await apiRequest("POST", "/api/agents", agentData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Agent Created",
        description: "The agent has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create agent. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteAgentMutation = useMutation({
    mutationFn: async (agentId: string) => {
      await apiRequest("DELETE", `/api/agents/${agentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Agent Deleted",
        description: "The agent has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete agent. Please try again.",
        variant: "destructive",
      });
    },
  });

  const [newAgent, setNewAgent] = useState({
    name: "",
    description: "",
    personalityProfile: {
      openness: 0.5,
      conscientiousness: 0.5,
      extraversion: 0.5,
      agreeableness: 0.5,
      neuroticism: 0.5,
    },
    powerLevel: 0.5,
    preferredTactics: [],
  });

  const handleCreateAgent = () => {
    createAgentMutation.mutate(newAgent);
  };

  const getPersonalityLabel = (trait: string, value: number) => {
    const labels = {
      openness: value > 0.6 ? "Creative" : value < 0.4 ? "Traditional" : "Balanced",
      conscientiousness: value > 0.6 ? "Organized" : value < 0.4 ? "Flexible" : "Balanced",
      extraversion: value > 0.6 ? "Assertive" : value < 0.4 ? "Reserved" : "Balanced",
      agreeableness: value > 0.6 ? "Cooperative" : value < 0.4 ? "Competitive" : "Balanced",
      neuroticism: value > 0.6 ? "Cautious" : value < 0.4 ? "Stable" : "Balanced",
    };
    return labels[trait as keyof typeof labels];
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
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
          <h1 className="text-2xl font-bold text-gray-900">Agent Configuration</h1>
          <p className="text-gray-600 mt-1">Configure AI agents with personalities and tactics</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
              <DialogDescription>
                Configure a new AI negotiation agent with personality traits and tactics.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Agent Name</Label>
                <Input
                  id="name"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                  placeholder="Enter agent name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newAgent.description}
                  onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
                  placeholder="Describe the agent's role and characteristics"
                />
              </div>

              <div className="space-y-4">
                <Label className="text-base font-semibold">Personality Profile (Big 5)</Label>
                
                {Object.entries(newAgent.personalityProfile).map(([trait, value]) => (
                  <div key={trait} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="capitalize">{trait}</Label>
                      <Badge variant="outline">
                        {getPersonalityLabel(trait, value)}
                      </Badge>
                    </div>
                    <Slider
                      value={[value]}
                      onValueChange={([newValue]) =>
                        setNewAgent({
                          ...newAgent,
                          personalityProfile: {
                            ...newAgent.personalityProfile,
                            [trait]: newValue,
                          },
                        })
                      }
                      max={1}
                      min={0}
                      step={0.1}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-500">{(value * 100).toFixed(0)}%</div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Power Level</Label>
                <Slider
                  value={[newAgent.powerLevel]}
                  onValueChange={([value]) => setNewAgent({ ...newAgent, powerLevel: value })}
                  max={1}
                  min={0}
                  step={0.1}
                  className="w-full"
                />
                <div className="text-xs text-gray-500">
                  {(newAgent.powerLevel * 100).toFixed(0)}% - Higher values mean more negotiating power
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateAgent}
                disabled={createAgentMutation.isPending || !newAgent.name}
              >
                {createAgentMutation.isPending ? "Creating..." : "Create Agent"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents?.map((agent) => (
          <Card key={agent.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <User className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <CardDescription className="text-sm">
                      Power Level: {(agent.powerLevel * 100).toFixed(0)}%
                    </CardDescription>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedAgent(agent)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteAgentMutation.mutate(agent.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">{agent.description}</p>
              
              <div className="space-y-3">
                <div className="text-sm font-medium">Personality Traits</div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(agent.personalityProfile).map(([trait, value]) => (
                    <div key={trait} className="text-xs">
                      <div className="flex justify-between items-center">
                        <span className="capitalize">{trait.slice(0, 4)}</span>
                        <Badge variant="secondary" className="text-xs">
                          {getPersonalityLabel(trait, value)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
