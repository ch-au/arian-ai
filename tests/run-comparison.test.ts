import { describe, it, expect } from "vitest";
import { buildRadarMetrics, buildComparisonSummary } from "@/lib/run-comparison";

const baseRun = {
  id: "run-1",
  techniqueName: "Tech A",
  tacticName: "Tac A",
  dealValue: 100000,
  totalRounds: 5,
  dimensionResults: [{ achievedTarget: true }, { achievedTarget: false }],
  productResults: [{ withinZopa: true }, { withinZopa: false }],
  techniqueEffectivenessScore: 8,
  tacticEffectivenessScore: 6,
};

describe("run-comparison helpers", () => {
  it("creates radar metrics for selected runs", () => {
    const data = buildRadarMetrics([
      baseRun,
      { ...baseRun, id: "run-2", dealValue: 50000, totalRounds: 8, techniqueEffectivenessScore: 6 },
    ]);

    expect(data).toHaveLength(6);
    const dealValueMetric = data.find((point) => point.metric === "Deal Value");
    expect(dealValueMetric?.["run-1"]).toBe(100);
    expect(dealValueMetric?.["run-2"]).toBe(50);
  });

  it("summarizes averages across runs", () => {
    const summary = buildComparisonSummary([
      baseRun,
      { ...baseRun, id: "run-2", dealValue: 50000, totalRounds: 10, dimensionResults: [] },
    ]);

    expect(summary.avgDealValue).toBe(75000);
    expect(summary.avgRounds).toBe(7.5);
    expect(summary.successShare).toBeCloseTo(50);
  });
});
