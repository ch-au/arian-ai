import { describe, it, expect } from "vitest";
import type { NegotiationListItem } from "@/hooks/use-negotiations";
import { buildReportEntries, filterReportEntries } from "@/lib/report-helpers";

function buildNegotiation(overrides: Partial<NegotiationListItem>): NegotiationListItem {
  return {
    id: "neg-1",
    title: "Standard Deal",
    description: "Test",
    status: "planned",
    scenario: {
      userRole: "buyer",
      companyProfile: { organization: "Acme" },
      counterpartProfile: { name: "Globex" },
      market: { name: "DACH" },
    },
    simulationStats: {
      totalRuns: 4,
      completedRuns: 2,
      runningRuns: 1,
      failedRuns: 0,
      pendingRuns: 1,
      successRate: 0.5,
      isPlanned: true,
    },
    techniqueCount: 2,
    tacticCount: 2,
    progressPercentage: 50,
    summary: "Acme ↔ Globex",
    marketLabel: "DACH",
    counterpartLabel: "Globex",
    hasStrategy: true,
    createdAt: "2024-01-10T10:00:00.000Z",
    updatedAt: "2024-01-11T10:00:00.000Z",
    ...overrides,
  } as NegotiationListItem;
}

describe("report-helpers", () => {
  it("buildReportEntries maps negotiation metadata correctly", () => {
    const negotiations = [
      buildNegotiation({
        id: "neg-42",
        title: "Premium Einkauf",
        scenario: {
          userRole: "seller",
          companyProfile: { organization: "Seller GmbH" },
          counterpartProfile: { name: "Buyer AG" },
          market: { name: "EU" },
        },
      }),
    ];

    const entries = buildReportEntries(negotiations);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: "neg-42",
      title: "Premium Einkauf",
      companyLabel: "Seller GmbH",
      counterpartLabel: "Buyer AG",
      marketLabel: "EU",
      userRole: "seller",
      techniqueCount: 2,
      tacticCount: 2,
      simulationStats: negotiations[0].simulationStats,
    });
  });

  it("filterReportEntries applies search, status, role and date constraints", () => {
    const base = buildNegotiation({});
    const negotiations = [
      base,
      buildNegotiation({
        id: "neg-2",
        title: "Nordic Pitch",
        status: "completed",
        scenario: {
          userRole: "seller",
          companyProfile: { organization: "Nordic AB" },
          counterpartProfile: { name: "Oslo Retail" },
          market: { name: "Nordics" },
        },
        createdAt: "2024-02-01T08:00:00.000Z",
      }),
    ];

    const entries = buildReportEntries(negotiations);
    const filtered = filterReportEntries(entries, {
      search: "Nordic",
      statuses: ["completed"],
      roles: ["seller"],
      from: new Date("2024-02-01T00:00:00.000Z"),
      to: new Date("2024-02-05T00:00:00.000Z"),
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("neg-2");
  });
});
