import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";

export type NegotiationStatus = "planned" | "running" | "completed" | "aborted";

export interface NegotiationScenarioDimension {
  id?: string;
  name: string;
  minValue?: number;
  maxValue?: number;
  targetValue?: number;
  priority?: number;
  unit?: string | null;
}

export interface NegotiationScenario {
  userRole?: "buyer" | "seller";
  negotiationType?: string;
  relationshipType?: string;
  negotiationFrequency?: string;
  productMarketDescription?: string;
  additionalComments?: string;
  sonderinteressen?: string;
  maxRounds?: number;
  selectedTechniques?: string[];
  selectedTactics?: string[];
  dimensions?: NegotiationScenarioDimension[];
  companyProfile?: {
    organization?: string;
    company?: string;
    country?: string;
    negotiationType?: string;
    negotiationFrequency?: string;
    goals?: Record<string, unknown>;
  };
  market?: {
    name?: string;
    region?: string;
    countryCode?: string;
    currencyCode?: string;
    intelligence?: string;
    notes?: string;
  };
  counterpartProfile?: {
    name?: string;
    kind?: string;
    powerBalance?: string;
    style?: string;
    notes?: string;
  };
  products?: Array<{
    productId?: string;
    name?: string;
    brand?: string;
    attrs?: Record<string, unknown>;
  }>;
}

export interface SimulationStats {
  totalRuns: number;
  completedRuns: number;
  runningRuns: number;
  failedRuns: number;
  pendingRuns: number;
  successRate: number;
  isPlanned: boolean;
}

export interface NegotiationListItem {
  id: string;
  title: string;
  description?: string | null;
  status: NegotiationStatus;
  scenario: NegotiationScenario;
  simulationStats: SimulationStats;
  techniqueCount: number;
  tacticCount: number;
  progressPercentage: number;
  summary: string;
  marketLabel: string;
  counterpartLabel: string;
  hasStrategy: boolean;
  maxRounds?: number;
  startedAt?: string;
  endedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

const STATUS_LABELS: Record<NegotiationStatus, string> = {
  planned: "Geplant",
  running: "Laufend",
  completed: "Abgeschlossen",
  aborted: "Abgebrochen",
};

export function translateNegotiationStatus(status: NegotiationStatus): string {
  return STATUS_LABELS[status] ?? status;
}

const DEFAULT_SIM_STATS: SimulationStats = {
  totalRuns: 0,
  completedRuns: 0,
  runningRuns: 0,
  failedRuns: 0,
  pendingRuns: 0,
  successRate: 0,
  isPlanned: false,
};

function buildSummary(scenario: NegotiationScenario, fallbackTitle: string): string {
  const company = scenario.companyProfile?.organization || fallbackTitle;
  const counterpart = scenario.counterpartProfile?.name || "Gegenpartei offen";
  return `${company} ↔ ${counterpart}`;
}

function buildProgress(stats: SimulationStats): number {
  if (!stats.totalRuns) {
    return 0;
  }
  const completedOrFailed = stats.completedRuns + stats.failedRuns;
  return Math.min(100, Math.round((completedOrFailed / stats.totalRuns) * 100));
}

export function mapNegotiation(raw: any): NegotiationListItem {
  const scenario: NegotiationScenario = raw?.scenario ?? {};
  const stats: SimulationStats = {
    ...DEFAULT_SIM_STATS,
    ...(raw?.simulationStats ?? {}),
  };

  const techniqueIds = scenario.selectedTechniques ?? [];
  const tacticIds = scenario.selectedTactics ?? [];
  const status: NegotiationStatus = (raw?.status as NegotiationStatus) ?? "planned";

  return {
    id: raw.id,
    title: raw.title ?? "Unbenannte Verhandlung",
    description: raw.description,
    status,
    scenario,
    simulationStats: stats,
    techniqueCount: techniqueIds.length,
    tacticCount: tacticIds.length,
    progressPercentage: buildProgress(stats),
    summary: buildSummary(scenario, raw.title ?? "Unbenannte Verhandlung"),
    marketLabel: scenario.market?.name || "Markt offen",
    counterpartLabel: scenario.counterpartProfile?.name || "Gegenpartei offen",
    hasStrategy: techniqueIds.length > 0 && tacticIds.length > 0,
    maxRounds: scenario.maxRounds,
    startedAt: raw.startedAt,
    endedAt: raw.endedAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function useNegotiations() {
  const { user } = useAuth();
  return useQuery<NegotiationListItem[]>({
    queryKey: ["/api/negotiations"],
    select: (data) => (data ?? []).map(mapNegotiation),
    refetchInterval: 5000,
    enabled: !!user,
  });
}
