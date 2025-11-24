type DimensionResult = {
  dimensionName: string;
  finalValue?: string | number | null;
  targetValue?: string | number | null;
  achievedTarget: boolean;
  priorityScore?: number | null;
};

type ProductResult = {
  productName: string;
  agreedPrice?: string | number | null;
  performanceScore?: string | number | null;
  withinZopa?: boolean | null;
};

export type AnalysisRun = {
  dimensionResults?: DimensionResult[];
  productResults?: ProductResult[];
};

export type DimensionSummary = {
  name: string;
  priority: number;
  total: number;
  achieved: number;
  rate: number;
};

export type ProductSummary = {
  name: string;
  avgPrice: number;
  avgScore: number;
  zopaRate: number;
};

export function summarizeDimensions(runs: AnalysisRun[]): DimensionSummary[] {
  const map = new Map<string, { priority: number; total: number; achieved: number }>();

  for (const run of runs) {
    for (const dim of run.dimensionResults ?? []) {
      const key = dim.dimensionName;
      const entry = map.get(key) ?? { priority: dim.priorityScore ?? 3, total: 0, achieved: 0 };
      entry.total += 1;
      if (dim.achievedTarget) entry.achieved += 1;
      entry.priority = dim.priorityScore ?? entry.priority;
      map.set(key, entry);
    }
  }

  return Array.from(map.entries()).map(([name, entry]) => ({
    name,
    priority: entry.priority,
    total: entry.total,
    achieved: entry.achieved,
    rate: entry.total ? Math.round((entry.achieved / entry.total) * 100) : 0,
  }));
}

export function summarizeProducts(runs: AnalysisRun[]): ProductSummary[] {
  const map = new Map<string, { priceSum: number; priceCount: number; scoreSum: number; scoreCount: number; zopaHits: number; total: number }>();

  for (const run of runs) {
    for (const product of run.productResults ?? []) {
      const key = product.productName;
      const entry = map.get(key) ?? { priceSum: 0, priceCount: 0, scoreSum: 0, scoreCount: 0, zopaHits: 0, total: 0 };
      const price = toNumber(product.agreedPrice);
      if (!Number.isNaN(price)) {
        entry.priceSum += price;
        entry.priceCount += 1;
      }
      const score = toNumber(product.performanceScore);
      if (!Number.isNaN(score)) {
        entry.scoreSum += score;
        entry.scoreCount += 1;
      }
      if (product.withinZopa) {
        entry.zopaHits += 1;
      }
      entry.total += 1;
      map.set(key, entry);
    }
  }

  return Array.from(map.entries()).map(([name, entry]) => ({
    name,
    avgPrice: entry.priceCount ? entry.priceSum / entry.priceCount : 0,
    avgScore: entry.scoreCount ? entry.scoreSum / entry.scoreCount : 0,
    zopaRate: entry.total ? Math.round((entry.zopaHits / entry.total) * 100) : 0,
  }));
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

