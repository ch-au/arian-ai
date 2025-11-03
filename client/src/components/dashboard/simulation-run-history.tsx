import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, List, Brain, CheckCircle, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

interface SimulationRunHistoryProps {
  negotiations: any[];
  isLoading: boolean;
}

export default function SimulationRunHistory({ negotiations, isLoading }: SimulationRunHistoryProps) {
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Simulation History</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Loading history...</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate evaluation stats for each negotiation
  const getEvaluationStats = (neg: any) => {
    const completedRuns = neg.simulationRuns?.filter((r: any) => 
      r.outcome === 'DEAL_ACCEPTED' || r.outcome === 'WALK_AWAY'
    ) || [];
    
    const evaluatedRuns = completedRuns.filter((r: any) => r.tacticalSummary);
    
    return {
      total: completedRuns.length,
      evaluated: evaluatedRuns.length,
      needsEvaluation: completedRuns.length - evaluatedRuns.length,
    };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <List className="w-5 h-5 mr-2" />
          Simulation Run History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {negotiations.length === 0 ? (
            <p className="text-sm text-gray-500">No simulations found.</p>
          ) : (
            negotiations.map((neg) => {
              const evalStats = getEvaluationStats(neg);
              const hasEvaluations = evalStats.total > 0;
              const allEvaluated = hasEvaluations && evalStats.needsEvaluation === 0;
              
              return (
                <div key={neg.id} className="p-4 border rounded-lg flex justify-between items-center">
                  <div className="flex-1">
                    <h4 className="font-semibold">{neg.contextName}</h4>
                    <p className="text-sm text-gray-600">
                      {neg.buyerAgentName} vs. {neg.sellerAgentName}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant="outline">{neg.simulationRuns?.length || 0} runs</Badge>
                      <Badge variant={neg.status === 'completed' ? 'default' : 'secondary'}>
                        {neg.status}
                      </Badge>
                      {hasEvaluations && (
                        allEvaluated ? (
                          <Badge variant="default" className="gap-1 bg-green-600">
                            <CheckCircle className="w-3 h-3" />
                            AI Evaluated
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <Brain className="w-3 h-3" />
                            {evalStats.evaluated}/{evalStats.total} evaluated
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLocation(`/negotiations/${neg.id}/tracking`)}
                  >
                    View Results <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
