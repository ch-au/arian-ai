import { useRoute } from "wouter";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import NegotiationAnalysisPage from "@/pages/negotiation-analysis";

export default function AnalysisDashboard() {
  const [, params] = useRoute("/analysis/:negotiationId");
  const negotiationId = params?.negotiationId;

  if (!negotiationId) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Keine Analyse gefunden</CardTitle>
            <CardDescription>Bitte wähle eine Verhandlung und öffne anschließend den Analysebereich erneut.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return <NegotiationAnalysisPage />;
}
