import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, List } from "lucide-react";
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
            negotiations.map((neg) => (
              <div key={neg.id} className="p-4 border rounded-lg flex justify-between items-center">
                <div>
                  <h4 className="font-semibold">{neg.contextName}</h4>
                  <p className="text-sm text-gray-600">
                    {neg.buyerAgentName} vs. {neg.sellerAgentName}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline">{neg.simulationRuns?.length || 0} runs</Badge>
                    <Badge variant={neg.status === 'completed' ? 'default' : 'secondary'}>
                      {neg.status}
                    </Badge>
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
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
