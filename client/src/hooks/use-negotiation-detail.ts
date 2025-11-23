import { useQuery } from "@tanstack/react-query";
import type { NegotiationScenario } from "./use-negotiations";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

export interface NegotiationDetailPayload {
  negotiation: {
    id: string;
    title: string;
    description?: string | null;
    status: "planned" | "running" | "completed" | "aborted";
    scenario: NegotiationScenario;
  };
  products: Array<{
    id: string;
    name: string;
    brand?: string | null;
    attrs?: Record<string, unknown>;
  }>;
  simulationStats: {
    totalRuns: number;
    completedRuns: number;
    runningRuns: number;
    failedRuns: number;
    pendingRuns: number;
    successRate: number;
    isPlanned: boolean;
  };
}

export function useNegotiationDetail(negotiationId?: string | null) {
  return useQuery<NegotiationDetailPayload>({
    queryKey: negotiationId ? ["/api/negotiations/", negotiationId] : [],
    queryFn: async ({ queryKey }) => {
      const [, id] = queryKey;
      const res = await fetchWithAuth(`/api/negotiations/${id}`);
      if (!res.ok) {
        throw new Error("Failed to load negotiation");
      }
      return res.json();
    },
    enabled: Boolean(negotiationId),
  });
}
