import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import CreateNegotiationForm from "@/components/CreateNegotiationForm";

export default function CreateNegotiation() {
  const [, setLocation] = useLocation();

  const { data: techniques = [], isLoading: loadingTechniques } = useQuery<any[]>({
    queryKey: ["/api/influencing-techniques"],
    queryFn: () => apiRequest("GET", "/api/influencing-techniques").then(res => res.json()),
  });

  const { data: tactics = [], isLoading: loadingTactics } = useQuery<any[]>({
    queryKey: ["/api/negotiation-tactics"],
    queryFn: () => apiRequest("GET", "/api/negotiation-tactics").then(res => res.json()),
  });

  const handleSuccess = () => {
    setLocation("/");
  };

  const isLoading = loadingTechniques || loadingTactics;

  return (
    <>
      {isLoading ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Lade Einfluss-Techniken und Taktiken …
        </div>
      ) : (
        <CreateNegotiationForm
          techniques={techniques}
          tactics={tactics}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
