import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { HandMetal, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface LiveNegotiationsProps {
  negotiations: Array<{
    id: string;
    contextId: string;
    status: string;
    totalRounds: number;
    maxRounds: number;
    buyerAgentId: string;
    sellerAgentId: string;
  }>;
}

export default function LiveNegotiations({ negotiations }: LiveNegotiationsProps) {
  const { data: agents } = useQuery<any[]>({
    queryKey: ["/api/agents"],
  });

  const { data: contexts } = useQuery<any[]>({
    queryKey: ["/api/contexts"],
  });

  const getAgentName = (agentId: string) => {
    return agents?.find((agent: any) => agent.id === agentId)?.name || "Unknown Agent";
  };

  const getContextName = (contextId: string) => {
    return contexts?.find((context: any) => context.id === contextId)?.name || "Unknown Context";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-blue-100 text-blue-600";
      case "completed":
        return "bg-green-100 text-green-600";
      case "pending":
        return "bg-yellow-100 text-yellow-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <Card>
      <CardHeader className="border-b border-gray-200">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">Live Negotiations</CardTitle>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse-dot"></div>
            <span className="text-sm text-green-600 font-medium">Real-time</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {negotiations.length > 0 ? (
          <div className="space-y-4">
            {negotiations.slice(0, 3).map((negotiation) => (
              <div key={negotiation.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusColor(negotiation.status)}`}>
                    <HandMetal className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {getContextName(negotiation.contextId)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {getAgentName(negotiation.buyerAgentId)} vs {getAgentName(negotiation.sellerAgentId)} • Round {negotiation.totalRounds}/{negotiation.maxRounds}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Progress 
                    value={(negotiation.totalRounds / negotiation.maxRounds) * 100} 
                    className="w-16 h-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.round((negotiation.totalRounds / negotiation.maxRounds) * 100)}% complete
                  </p>
                </div>
              </div>
            ))}
            
            <Button variant="ghost" className="w-full mt-4 justify-center">
              View All Negotiations
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <HandMetal className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No active negotiations</p>
            <p className="text-sm">Start a new negotiation to see live updates</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
