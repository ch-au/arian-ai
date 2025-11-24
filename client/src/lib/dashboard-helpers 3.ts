import { subDays, startOfDay, formatISO } from "date-fns";
import type { NegotiationListItem } from "@/hooks/use-negotiations";

export interface DashboardMetricSummary {
  activeNegotiations: number;
  successRate: number;
  avgDuration: number;
  runningNegotiations: number;
  finishedNegotiations: number;
  totalSimulationRuns: number;
  recentTrend: {
    activeNegotiationsChange: number;
    successRateChange: number;
    avgDurationChange: number;
    runningNegotiationsChange: number;
    finishedNegotiationsChange: number;
  };
}

export interface SuccessTrendPoint {
  date: string;
  successRate: number;
}

function toPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value * 100));
}

export function deriveDashboardMetrics(negotiations: NegotiationListItem[]): DashboardMetricSummary {
  const activeNegotiations = negotiations.filter((neg) => neg.status === "running").length;
  const runningNegotiations = negotiations.filter((neg) => neg.status === "running").length;
  const finishedNegotiations = negotiations.filter((neg) => neg.status === "completed").length;

  const totalSimulationRuns = negotiations.reduce((sum, neg) => {
    return sum + (neg.simulationStats?.totalRuns ?? 0);
  }, 0);

  const successValues = negotiations
    .map((neg) => {
      const stats = neg.simulationStats;
      if (!stats?.totalRuns) return null;
      return stats.completedRuns / stats.totalRuns;
    })
    .filter((value): value is number => value !== null && Number.isFinite(value));

  const avgDurationValues = negotiations
    .map((neg) => neg.scenario?.maxRounds ?? neg.simulationStats.totalRuns ?? 0)
    .filter((value) => Number.isFinite(value) && value > 0);

  const successRate =
    successValues.length > 0 ? toPercentage(successValues.reduce((sum, value) => sum + value, 0) / successValues.length) : 0;

  const avgDuration =
    avgDurationValues.length > 0 ? avgDurationValues.reduce((sum, value) => sum + value, 0) / avgDurationValues.length : 0;

  return {
    activeNegotiations,
    successRate,
    avgDuration,
    runningNegotiations,
    finishedNegotiations,
    totalSimulationRuns,
    recentTrend: {
      activeNegotiationsChange: 0,
      successRateChange: 0,
      avgDurationChange: 0,
      runningNegotiationsChange: 0,
      finishedNegotiationsChange: 0,
    },
  };
}

export function deriveSuccessTrends(
  negotiations: NegotiationListItem[],
  days = 30,
): SuccessTrendPoint[] {
  const buckets = new Map<string, { sum: number; count: number }>();
  const today = startOfDay(new Date());

  for (let i = days - 1; i >= 0; i--) {
    const bucketDate = subDays(today, i);
    const key = formatISO(bucketDate, { representation: "date" });
    buckets.set(key, { sum: 0, count: 0 });
  }

  negotiations.forEach((neg) => {
    const createdAt = neg.createdAt ? new Date(neg.createdAt) : today;
    const key = formatISO(startOfDay(createdAt), { representation: "date" });
    if (!buckets.has(key)) {
      return;
    }

    const stats = neg.simulationStats;
    const ratio =
      stats && stats.totalRuns
        ? stats.completedRuns / stats.totalRuns
        : 0;
    const bucket = buckets.get(key)!;
    bucket.sum += toPercentage(ratio);
    bucket.count += 1;
  });

  return Array.from(buckets.entries()).map(([date, { sum, count }]) => ({
    date,
    successRate: count > 0 ? sum / count : 0,
  }));
}
