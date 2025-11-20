import type { InsertDimensionResult, InsertProductResult, Product } from "@shared/schema";
import type { NegotiationRecord, NegotiationScenarioConfig } from "../storage";

type DimensionValues = Record<string, unknown>;

interface NormalizedEntry {
  key: string;
  normalized: string;
  raw: unknown;
  numeric: number | null;
}

type ProductLike = {
  id?: string;
  name: string;
  attrs?: Record<string, unknown> | null;
};

interface ProductComputationInput {
  runId: string;
  products: ProductLike[];
  entries: NormalizedEntry[];
  matchedKeys: Set<string>;
  userRole: "buyer" | "seller";
}

export interface SimulationResultArtifacts {
  dimensionRows: InsertDimensionResult[];
  productRows: InsertProductResult[];
  dealValue: string | null;
  otherDimensions: Record<string, number | string>;
}

const PRICE_KEYWORDS = ["preis", "price", "prize"];
const VOLUME_KEYWORDS = ["volumen", "volume", "menge", "absatz", "stk", "pieces"];

export function buildSimulationResultArtifacts({
  runId,
  negotiation,
  products,
  dimensionValues,
  conversationLog,
}: {
  runId: string;
  negotiation: NegotiationRecord | null;
  products: Product[];
  dimensionValues: DimensionValues | null | undefined;
  conversationLog?: Array<Record<string, any>>;
}): SimulationResultArtifacts {
  const scenarioDimensions = negotiation?.scenario?.dimensions ?? [];
  const entries = normalizeEntries(dimensionValues, conversationLog);
  const matchedKeys = new Set<string>();
  const userRole = (negotiation?.scenario?.userRole?.toLowerCase() === "buyer" ? "buyer" : "seller") as "buyer" | "seller";

  const dimensionRows = buildDimensionRows(runId, scenarioDimensions, entries);
  const normalizedProducts = resolveProductDataset(products, negotiation);

  const { rows: productRows, totalDealValue } = buildProductRows({
    runId,
    products: normalizedProducts,
    entries,
    matchedKeys,
    userRole,
  });

  // Filter otherDimensions to only include non product-matched entries
  const filteredOtherDimensions: Record<string, number | string> = {};
  for (const entry of entries) {
    if (matchedKeys.has(entry.key)) {
      continue;
    }
    if (entry.raw === undefined || entry.raw === null) {
      continue;
    }
    filteredOtherDimensions[entry.key] = entry.numeric ?? (entry.raw as any);
  }

  const result = {
    dimensionRows,
    productRows,
    dealValue: totalDealValue > 0 ? totalDealValue.toFixed(2) : null,
    otherDimensions: filteredOtherDimensions,
  };

  // Only log if deal value calculation failed (for debugging)
  if (!result.dealValue && productRows.length === 0 && products.length > 0) {
    console.log(`[DEAL_VALUE] WARNING: No products matched for simulation ${runId.slice(0, 8)}`);
    console.log(`[DEAL_VALUE] Expected products: ${products.map(p => p.name).join(', ')}`);
    console.log(`[DEAL_VALUE] Dimension keys: ${entries.map(e => e.key).join(', ')}`);
  } else if (result.dealValue) {
    console.log(`[DEAL_VALUE] ✓ Calculated deal value: €${result.dealValue} (${productRows.length} products)`);
  }

  return result;
}

function buildDimensionRows(
  runId: string,
  dimensions: NegotiationScenarioConfig["dimensions"],
  entries: NormalizedEntry[],
): InsertDimensionResult[] {
  if (!dimensions?.length) {
    return [];
  }

  return dimensions.map((dim) => {
    const match = findEntryForDimension(dim.name, entries);
    const fallback = dim.targetValue ?? dim.minValue ?? dim.maxValue ?? 0;
    const finalValue = coerceNumber(match?.numeric ?? match?.raw ?? fallback);
    const targetValue = coerceNumber(dim.targetValue ?? fallback);
    const minValue = coerceNumber(dim.minValue);
    const maxValue = coerceNumber(dim.maxValue);

    return {
      simulationRunId: runId,
      dimensionName: dim.name,
      finalValue: formatDecimal(finalValue, 4),
      targetValue: formatDecimal(targetValue, 4),
      achievedTarget: isWithinRange(finalValue, minValue, maxValue),
      priorityScore: dim.priority ?? 3,
      improvementOverBatna: null,
    };
  });
}

function buildProductRows({ runId, products, entries, matchedKeys, userRole }: ProductComputationInput): {
  rows: InsertProductResult[];
  totalDealValue: number;
} {
  const rows: InsertProductResult[] = [];
  let totalDealValue = 0;

  for (const product of products) {
    const attrs = (product.attrs ?? {}) as Record<string, unknown>;
    const normalizedName = normalizeKey(product.name ?? "");
    
    // Also normalize product_key if available (often more reliable)
    const productKey = attrs.product_key ? normalizeKey(String(attrs.product_key)) : "";

    // Strategy 1: Exact match on normalized name or product_key
    let priceEntry = entries.find((entry) => 
      (normalizedName && entry.normalized === normalizedName) ||
      (productKey && entry.normalized === productKey)
    );

    // Strategy 2: Keyword match (contains name + price keyword)
    if (!priceEntry) {
      priceEntry = entries.find((entry) =>
        normalizedName ? entry.normalized.includes(normalizedName) && hasKeyword(entry.normalized, PRICE_KEYWORDS) : hasKeyword(entry.normalized, PRICE_KEYWORDS),
      );
    }

    // Strategy 3: Fuzzy substring match for keys that might be truncated (e.g. "milkanu" vs "milkanuss")
    // Only if we haven't matched yet and have a specific name to look for
    if (!priceEntry && (normalizedName || productKey)) {
      // Check if entry key is a substantial substring of product name (or vice versa)
      // But filter out generic "preis" keys to avoid false positives
      priceEntry = entries.find((entry) => {
        if (hasKeyword(entry.normalized, ["gesamt", "total", "summe"])) return false;
        
        const key = entry.normalized;
        const name = normalizedName;
        const pKey = productKey;
        
        // Check for common prefix (at least 5 chars)
        if (name.length > 5 && key.startsWith(name.slice(0, 6))) return true;
        if (pKey.length > 5 && key.startsWith(pKey.slice(0, 6))) return true;
        
        // Check if key is contained in name (or vice versa) if length is significant
        if (name.length > 4 && key.length > 4) {
           if (name.includes(key) || key.includes(name)) return true;
        }
        
        return false;
      });
    }

    if (priceEntry) matchedKeys.add(priceEntry.key);

    const volumeEntry = entries.find((entry) =>
      normalizedName ? entry.normalized.includes(normalizedName) && hasKeyword(entry.normalized, VOLUME_KEYWORDS) : hasKeyword(entry.normalized, VOLUME_KEYWORDS),
    );
    if (volumeEntry) matchedKeys.add(volumeEntry.key);

    const targetPrice = coerceNumber(attrs.targetPrice);
    const minPrice = coerceNumber(attrs.minPrice ?? attrs.min);
    const maxPrice = coerceNumber(attrs.maxPrice ?? attrs.max);
    const estimatedVolume = Math.round(coerceNumber(attrs.estimatedVolume ?? attrs.volume) ?? 0);
    const agreedPrice = priceEntry?.numeric ?? targetPrice ?? minPrice ?? maxPrice ?? null;
    const volumeValue = Math.max(1, Math.round((coerceNumber(volumeEntry?.numeric ?? volumeEntry?.raw) ?? estimatedVolume ?? 1)));

    if (agreedPrice === null) {
      continue;
    }

    const roleAwareMin = userRole === "buyer" ? null : minPrice;
    const roleAwareMax = userRole === "seller" ? null : maxPrice;

    const subtotal = agreedPrice * volumeValue;
    totalDealValue += subtotal;

    const priceVsTarget = targetPrice ? computePercentageDelta(agreedPrice, targetPrice) : null;
    const withinZopa = isWithinRange(agreedPrice, roleAwareMin, roleAwareMax);
    const zopaUtilization = computeZopaUtilization(agreedPrice, roleAwareMin, roleAwareMax);
    const performanceScore = computePerformanceScore(agreedPrice, targetPrice, withinZopa);
    const targetSubtotal = (targetPrice ?? agreedPrice) * volumeValue;

    rows.push({
      simulationRunId: runId,
      productId: product.id || `fallback-${runId}-${rows.length}`,
      productName: product.name,
      targetPrice: formatDecimal(targetPrice ?? agreedPrice, 2),
      minMaxPrice: formatDecimal(maxPrice ?? minPrice ?? agreedPrice, 2),
      estimatedVolume: volumeValue,
      agreedPrice: formatDecimal(agreedPrice, 2),
      priceVsTarget: priceVsTarget !== null ? formatDecimal(priceVsTarget, 2) : null,
      absoluteDeltaFromTarget: formatDecimal(targetPrice !== null ? agreedPrice - targetPrice : 0, 4),
      priceVsMinMax: zopaUtilization !== null ? formatDecimal(zopaUtilization * 100, 2) : null,
      absoluteDeltaFromMinMax: formatDecimal(computeDeltaFromBounds(agreedPrice, roleAwareMin, roleAwareMax), 4),
      withinZopa,
      zopaUtilization: zopaUtilization !== null ? formatDecimal(zopaUtilization, 2) : null,
      subtotal: formatDecimal(subtotal, 2),
      targetSubtotal: formatDecimal(targetSubtotal, 2),
      deltaFromTargetSubtotal: formatDecimal(subtotal - targetSubtotal, 2),
      performanceScore: formatDecimal(performanceScore, 2),
      dimensionKey: priceEntry?.key,
      negotiationRound: null,
      metadata: {},
    });
  }

  if (rows.length === 0) {
    const fallbackRow = buildFallbackProductRow(runId, entries, userRole);
    if (fallbackRow) {
      rows.push(fallbackRow.row);
      totalDealValue += fallbackRow.dealValue;
    }
  }

  return { rows, totalDealValue };
}

function buildFallbackProductRow(runId: string, entries: NormalizedEntry[], userRole: "buyer" | "seller") {
  const priceEntry = entries.find((entry) => hasKeyword(entry.normalized, PRICE_KEYWORDS) && entry.numeric !== null);
  if (!priceEntry || priceEntry.numeric === null) {
    return null;
  }
  const volumeEntry = entries.find((entry) => hasKeyword(entry.normalized, VOLUME_KEYWORDS));
  const agreedPrice = priceEntry.numeric;
  const volumeValue = Math.max(1, Math.round(coerceNumber(volumeEntry?.numeric ?? volumeEntry?.raw) ?? 1));
  const subtotal = agreedPrice * volumeValue;

  const row: InsertProductResult = {
    simulationRunId: runId,
    productId: `fallback-${runId}`,
    productName: "Gesamt",
    targetPrice: formatDecimal(agreedPrice, 2),
    minMaxPrice: formatDecimal(agreedPrice, 2),
    estimatedVolume: volumeValue,
    agreedPrice: formatDecimal(agreedPrice, 2),
    priceVsTarget: null,
    absoluteDeltaFromTarget: formatDecimal(0, 4),
    priceVsMinMax: null,
    absoluteDeltaFromMinMax: formatDecimal(0, 4),
    withinZopa: true,
    zopaUtilization: null,
    subtotal: formatDecimal(subtotal, 2),
    targetSubtotal: formatDecimal(subtotal, 2),
    deltaFromTargetSubtotal: formatDecimal(0, 2),
    performanceScore: formatDecimal(100, 2),
    dimensionKey: priceEntry.key,
    negotiationRound: null,
    metadata: {},
  };

  return { row, dealValue: subtotal };
}

function resolveProductDataset(products: Product[], negotiation: NegotiationRecord | null): ProductLike[] {
  if (products.length) {
    return products.map((product) => ({
      id: product.id,
      name: product.name,
      attrs: (product.attrs ?? {}) as Record<string, unknown>,
    }));
  }

  const scenarioProducts = (negotiation?.scenario?.products ?? []) as Array<{
    productId?: string;
    name?: string;
    attrs?: Record<string, unknown>;
    targetPrice?: number;
    minPrice?: number;
    maxPrice?: number;
    estimatedVolume?: number;
  }>;

  return scenarioProducts.map((product, index) => {
    const attrs: Record<string, unknown> = {
      ...(product.attrs ?? {}),
      targetPrice: product.targetPrice ?? product.attrs?.targetPrice,
      minPrice: product.minPrice ?? product.attrs?.minPrice,
      maxPrice: product.maxPrice ?? product.attrs?.maxPrice,
      estimatedVolume: product.estimatedVolume ?? product.attrs?.estimatedVolume,
      // Ensure product_key is carried over to attrs for matching logic
      product_key: (product as any).product_key ?? product.attrs?.product_key,
    };

    return {
      id: product.productId ?? `scenario-${index}`,
      name: product.name ?? `Produkt ${index + 1}`,
      attrs,
    };
  });
}

function hasKeyword(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function normalizeEntries(
  values: DimensionValues | null | undefined,
  conversationLog?: Array<Record<string, any>>,
): NormalizedEntry[] {
  const entryMap = new Map<string, NormalizedEntry>();

  if (values) {
    for (const [key, raw] of Object.entries(values)) {
      const normalized = normalizeKey(key);
      entryMap.set(normalized, {
        key,
        normalized,
        raw,
        numeric: coerceNumber(raw),
      });
    }
  }

  if (conversationLog?.length) {
    for (let i = conversationLog.length - 1; i >= 0; i -= 1) {
      const entry = conversationLog[i];
      if (!entry || typeof entry !== "object") continue;
      const offer = (entry as any).offer;
      if (!offer || typeof offer !== "object") continue;
      const dimensionValues = (offer as any).dimension_values || (offer as any).dimensionValues;
      if (!dimensionValues || typeof dimensionValues !== "object") continue;

      for (const [key, raw] of Object.entries(dimensionValues)) {
        const normalized = normalizeKey(key);
        if (entryMap.has(normalized)) {
          continue;
        }
        entryMap.set(normalized, {
          key,
          normalized,
          raw,
          numeric: coerceNumber(raw),
        });
      }
    }
  }

  return Array.from(entryMap.values());
}

function findEntryForDimension(name: string, entries: NormalizedEntry[]): NormalizedEntry | undefined {
  const normalizedName = normalizeKey(name);
  return (
    entries.find((entry) => entry.normalized === normalizedName) ??
    entries.find((entry) => entry.normalized.includes(normalizedName)) ??
    entries.find((entry) => normalizedName.includes(entry.normalized))
  );
}

function normalizeKey(value: string): string {
  if (!value) return "";
  
  let normalized = value.toLowerCase();
  
  // Manually handle German umlauts and sharp s before normalization
  normalized = normalized
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
    
  return normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const normalized = value.replace(",", ".");
    const match = normalized.match(/-?\d+(\.\d+)?/);
    if (match) {
      const parsed = Number(match[0]);
      return Number.isFinite(parsed) ? parsed : null;
    }
  }
  return null;
}

function formatDecimal(value: number | null, places: number): string {
  const safe = value === null || Number.isNaN(value) ? 0 : value;
  return safe.toFixed(places);
}

function isWithinRange(value: number | null, min?: number | null, max?: number | null): boolean {
  if (value === null) return false;
  if (min == null && max == null) return true;
  const lower = Math.min(min ?? value, max ?? value);
  const upper = Math.max(min ?? value, max ?? value);
  return value >= lower && value <= upper;
}

function computePercentageDelta(value: number, target: number): number {
  if (!target) return 0;
  return ((value - target) / target) * 100;
}

function computeZopaUtilization(value: number, min?: number | null, max?: number | null): number | null {
  if (min == null || max == null || max === min) {
    return null;
  }
  const range = max - min;
  return (value - min) / range;
}

function computeDeltaFromBounds(value: number, min?: number | null, max?: number | null): number {
  if (min == null && max == null) return 0;
  if (min != null && value < min) {
    return value - min;
  }
  if (max != null && value > max) {
    return value - max;
  }
  return 0;
}

function computePerformanceScore(value: number, target: number | null, withinZopa: boolean): number {
  if (target && target > 0) {
    const deltaPct = Math.abs((value - target) / target);
    const base = Math.max(0, 100 - deltaPct * 100);
    return withinZopa ? base : Math.max(0, base - 10);
  }
  return withinZopa ? 80 : 60;
}
