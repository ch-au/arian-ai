export interface AnalysisRun {
  id: string;
  techniqueName: string;
  tacticName: string;
  dealValue?: number;
  totalRounds?: number;
  dimensionResults?: Array<{
    dimensionName: string;
    finalValue: string | number;
    achievedTarget: boolean;
  }>;
  productResults?: Array<{
    productName: string;
    agreedPrice: string | number;
    withinZopa?: boolean;
  }>;
  techniqueEffectivenessScore?: number;
  tacticEffectivenessScore?: number;
}

export interface RadarMetricPoint {
  metric: string;
  [runId: string]: number | string;
}

const SAFE_DIVISOR = 0.00001;

function toPercentage(value: number, max: number): number {
  if (!Number.isFinite(value) || max <= SAFE_DIVISOR) {
    return 0;
  }
  return Math.round((value / max) * 100);
}

function invertRatio(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || max - min <= SAFE_DIVISOR) {
    return 0;
  }
  const normalized = (value - min) / (max - min);
  return Math.round((1 - normalized) * 100);
}

function ratioOfTrue(items: Array<{ flag?: boolean }> | undefined, key: "flag" = "flag"): number {
  if (!items || items.length === 0) return 0;
  const positives = items.filter((item) => item[key]).length;
  return Math.round((positives / items.length) * 100);
}

export function buildRadarMetrics(runs: AnalysisRun[]): RadarMetricPoint[] {
  if (runs.length === 0) return [];

  const maxDealValue = Math.max(...runs.map((run) => run.dealValue ?? 0));
  const minRounds = Math.min(...runs.map((run) => run.totalRounds ?? 0));
  const maxRounds = Math.max(...runs.map((run) => run.totalRounds ?? 0));

  const template: RadarMetricPoint[] = [
    { metric: "Deal Value" },
    { metric: "Effizienz" },
    { metric: "Dimensionserfolg" },
    { metric: "Produkt in ZOPA" },
    { metric: "Technik-Score" },
    { metric: "Taktik-Score" },
  ];

  runs.forEach((run) => {
    template[0][run.id] = toPercentage(run.dealValue ?? 0, maxDealValue || 1);
    template[1][run.id] = invertRatio(run.totalRounds ?? maxRounds, minRounds, maxRounds || minRounds + 1);
    template[2][run.id] = ratioOfTrue(
      run.dimensionResults?.map((dim) => ({ flag: dim.achievedTarget })),
    );
    template[3][run.id] = ratioOfTrue(
      run.productResults?.map((prod) => ({ flag: prod.withinZopa ?? true })),
    );
    template[4][run.id] = toPercentage(run.techniqueEffectivenessScore ?? 0, 10);
    template[5][run.id] = toPercentage(run.tacticEffectivenessScore ?? 0, 10);
  });

  return template;
}

/**
 * Build radar chart data using ranking logic (1st place = highest score)
 * Higher values get better rankings, inverted for display (1st place = 100%)
 */
export function buildActualValuesRadar(runs: AnalysisRun[]): RadarMetricPoint[] {
  if (runs.length === 0) return [];

  // Collect all unique dimension names across all runs
  const allDimensions = new Set<string>();
  const allProducts = new Set<string>();

  runs.forEach((run) => {
    run.dimensionResults?.forEach((dim) => allDimensions.add(dim.dimensionName));
    run.productResults?.forEach((prod) => allProducts.add(prod.productName));
  });

  const metrics: RadarMetricPoint[] = [];

  // Helper function to convert values to rankings (higher value = better rank = higher score)
  const rankValues = (values: Array<{ runId: string; value: number }>) => {
    const sorted = [...values].sort((a, b) => b.value - a.value);
    const rankings = new Map<string, number>();
    sorted.forEach((item, index) => {
      // Convert rank to score: 1st place = 100, 2nd = ~80, 3rd = ~60, etc.
      const score = Math.max(0, 100 - (index * (100 / Math.max(1, values.length - 1))));
      rankings.set(item.runId, score);
    });
    return rankings;
  };

  // Add deal value ranking
  const dealValueMetric: RadarMetricPoint = { metric: "Deal Value" };
  const dealValues = runs.map((run) => ({ runId: run.id, value: run.dealValue ?? 0 }));
  const dealRankings = rankValues(dealValues);
  runs.forEach((run) => {
    dealValueMetric[run.id] = dealRankings.get(run.id) ?? 0;
  });
  metrics.push(dealValueMetric);

  // Add dimensions ranking
  allDimensions.forEach((dimName) => {
    const metric: RadarMetricPoint = { metric: dimName };
    const dimValues = runs.map((run) => {
      const dim = run.dimensionResults?.find((d) => d.dimensionName === dimName);
      return { runId: run.id, value: dim ? parseFloat(String(dim.finalValue)) || 0 : 0 };
    });
    const dimRankings = rankValues(dimValues);
    runs.forEach((run) => {
      metric[run.id] = dimRankings.get(run.id) ?? 0;
    });
    metrics.push(metric);
  });

  // Add products ranking (lower price = better for buyer perspective)
  allProducts.forEach((prodName) => {
    const metric: RadarMetricPoint = { metric: prodName };
    const prodValues = runs.map((run) => {
      const prod = run.productResults?.find((p) => p.productName === prodName);
      // Invert for price: lower price = higher value (negate to reverse ranking)
      return { runId: run.id, value: prod ? -(parseFloat(String(prod.agreedPrice)) || 0) : 0 };
    });
    const prodRankings = rankValues(prodValues);
    runs.forEach((run) => {
      metric[run.id] = prodRankings.get(run.id) ?? 0;
    });
    metrics.push(metric);
  });

  return metrics;
}

export function buildComparisonSummary(runs: AnalysisRun[]) {
  if (runs.length === 0) {
    return {
      avgDealValue: 0,
      avgRounds: 0,
      successShare: 0,
    };
  }

  const totalDealValue = runs.reduce((sum, run) => sum + (run.dealValue ?? 0), 0);
  const totalRounds = runs.reduce((sum, run) => sum + (run.totalRounds ?? 0), 0);
  const successCount = runs.filter((run) => (run.dimensionResults?.filter((d) => d.achievedTarget).length ?? 0) > 0).length;

  return {
    avgDealValue: totalDealValue / runs.length,
    avgRounds: runs.length ? totalRounds / runs.length : 0,
    successShare: (successCount / runs.length) * 100,
  };
}
