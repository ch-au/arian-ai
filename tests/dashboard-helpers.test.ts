import { describe, expect, it } from "vitest";
import type { NegotiationListItem } from "@/hooks/use-negotiations";
import { deriveDashboardMetrics, deriveSuccessTrends } from "@/lib/dashboard-helpers";

function buildNegotiation(
  overrides: Partial<NegotiationListItem> = {},
): NegotiationListItem {
  return {
    id: "neg-1",
    title: "Demo",
    status: "running",
    scenario: { maxRounds: 5, companyProfile: { organization: "A" }, counterpartProfile: { name: "B" } },
    simulationStats: {
      totalRuns: 4,
      completedRuns: 2,
      runningRuns: 1,
      failedRuns: 0,
      pendingRuns: 1,
      successRate: 0.5,
      isPlanned: false,
    },
    techniqueCount: 1,
    tacticCount: 1,
    progressPercentage: 50,
    summary: "A ↔ B",
    marketLabel: "DACH",
    counterpartLabel: "B",
    hasStrategy: true,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  } as NegotiationListItem;
}

describe("dashboard-helpers", () => {
  it("derives metrics from negotiation list", () => {
    const metrics = deriveDashboardMetrics([
      buildNegotiation({ status: "running" }),
      buildNegotiation({
        status: "completed",
        scenario: { maxRounds: 8 },
        simulationStats: { totalRuns: 2, completedRuns: 2, runningRuns: 0, failedRuns: 0, pendingRuns: 0, successRate: 1, isPlanned: false },
      }),
    ]);

    expect(metrics.activeNegotiations).toBe(1);
    expect(metrics.successRate).toBeGreaterThan(0);
    expect(metrics.avgDuration).toBeGreaterThan(0);
  });

  it("builds trend buckets from negotiation dates", () => {
    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const trends = deriveSuccessTrends([
      buildNegotiation({ createdAt: today }),
      buildNegotiation({
        createdAt: yesterday,
        simulationStats: {
          totalRuns: 1,
          completedRuns: 1,
          runningRuns: 0,
          failedRuns: 0,
          pendingRuns: 0,
          successRate: 1,
          isPlanned: false,
        },
      }),
    ], 2);

    expect(trends).toHaveLength(2);
    expect(trends[0].successRate).toBeGreaterThanOrEqual(0);
    expect(trends[1].successRate).toBeGreaterThanOrEqual(0);
  });
});
