import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import CreateNegotiationForm from "@/components/CreateNegotiationForm";

export default function CreateNegotiation() {
  const [, setLocation] = useLocation();

  const { data: agents, isLoading: isLoadingAgents } = useQuery<any[]>({
    queryKey: ["/api/agents"],
    queryFn: () => apiRequest("GET", "/api/agents").then(res => res.json()),
  });

  const { data: contexts, isLoading: isLoadingContexts } = useQuery<any[]>({
    queryKey: ["/api/contexts"],
    queryFn: () => apiRequest("GET", "/api/contexts").then(res => res.json()),
  });

  const handleSuccess = () => {
    setLocation("/negotiations");
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center space-x-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocation("/negotiations")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Negotiations
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create New Negotiation</h1>
          <p className="text-gray-600 mt-2">Configure a new AI negotiation simulation with custom agents and strategies</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Negotiation Configuration</CardTitle>
          <CardDescription>
            Follow the 4-step process to set up your negotiation simulation with specific techniques and tactics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAgents || isLoadingContexts ? (
            <div className="text-center py-8">
              <p>Loading agents and contexts...</p>
            </div>
          ) : (
            <CreateNegotiationForm
              agents={agents || []}
              contexts={contexts || []}
              onSuccess={handleSuccess}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
