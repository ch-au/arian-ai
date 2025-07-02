import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Crown, Medal, Award } from "lucide-react";

interface AgentPerformanceProps {
  agents: Array<{
    agent: {
      id: string;
      name: string;
      personalityProfile: any;
    };
    successRate: number;
    totalNegotiations: number;
    avgResponseTime: number;
    totalApiCost: number;
  }>;
}

export default function AgentPerformance({ agents }: AgentPerformanceProps) {
  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Crown className="w-4 h-4 text-yellow-600" />;
      case 1:
        return <Medal className="w-4 h-4 text-gray-600" />;
      case 2:
        return <Award className="w-4 h-4 text-orange-600" />;
      default:
        return <span className="w-4 h-4 flex items-center justify-center text-xs font-medium text-gray-600">{index + 1}</span>;
    }
  };

  const getPersonalityType = (personalityProfile: any) => {
    if (!personalityProfile) return "Balanced";
    
    const traits = personalityProfile;
    if (traits.agreeableness > 0.7) return "Collaborative";
    if (traits.conscientiousness > 0.7) return "Analytical";
    if (traits.extraversion > 0.7) return "Assertive";
    if (traits.openness > 0.7) return "Creative";
    return "Balanced";
  };

  return (
    <Card>
      <CardHeader className="border-b border-gray-200">
        <CardTitle className="text-lg font-semibold text-gray-900">Top Performing Agents</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {agents.length > 0 ? (
          <div className="space-y-4">
            {agents.slice(0, 5).map((agentData, index) => (
              <div key={agentData.agent.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    {getRankIcon(index)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{agentData.agent.name}</p>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        {getPersonalityType(agentData.agent.personalityProfile)}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {agentData.totalNegotiations} negotiations
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-green-600">
                    {agentData.successRate.toFixed(1)}%
                  </span>
                  <div className="text-xs text-gray-500">
                    {agentData.avgResponseTime > 0 && `${(agentData.avgResponseTime / 1000).toFixed(1)}s avg`}
                  </div>
                </div>
              </div>
            ))}
            
            <Button variant="ghost" className="w-full mt-4 justify-center">
              View Detailed Analysis
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Award className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No performance data available</p>
            <p className="text-sm">Complete some negotiations to see agent rankings</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
