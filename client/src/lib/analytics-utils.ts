/**
 * Analytics Utilities
 * Pure functions for calculating metrics and transforming simulation results
 * Following clean code principles: Single Responsibility, Pure Functions, Testable
 */

import type { SimulationResult, DimensionResult } from './types/analytics';

/**
 * Calculate success rate as percentage
 * @param results - Array of simulation results
 * @returns Success rate as number between 0-100
 */
export function calculateSuccessRate(results: SimulationResult[]): number {
  if (results.length === 0) return 0;

  const successful = results.filter(r => r.zopaAchieved === true).length;
  return (successful / results.length) * 100;
}

/**
 * Calculate average rounds across simulations
 * @param results - Array of simulation results
 * @returns Average number of rounds
 */
export function calculateAverageRounds(results: SimulationResult[]): number {
  if (results.length === 0) return 0;

  const total = results.reduce((sum, r) => sum + (r.totalRounds || 0), 0);
  return total / results.length;
}

/**
 * Calculate total cost from simulation results
 * @param results - Array of simulation results
 * @returns Total cost as number
 */
export function calculateTotalCost(results: SimulationResult[]): number {
  return results.reduce((sum, r) => {
    const cost = typeof r.actualCost === 'string'
      ? parseFloat(r.actualCost)
      : (r.actualCost || 0);
    return sum + cost;
  }, 0);
}

/**
 * Calculate deal value from final terms
 * @param finalTerms - Object containing dimension values
 * @param targetTerms - Object containing target values for comparison
 * @returns Deal value score (higher is better)
 */
export function calculateDealValue(
  finalTerms: Record<string, number> | null,
  targetTerms: Record<string, number>
): number {
  if (!finalTerms) return 0;

  let totalScore = 0;
  let dimensionCount = 0;

  for (const [dimension, targetValue] of Object.entries(targetTerms)) {
    const finalValue = finalTerms[dimension];
    if (finalValue !== undefined) {
      // Calculate how close we got to target (0-100 scale)
      const distance = Math.abs(finalValue - targetValue);
      const maxDistance = Math.abs(targetValue); // Normalize by target
      const score = maxDistance > 0
        ? Math.max(0, 100 - (distance / maxDistance) * 100)
        : 100;

      totalScore += score;
      dimensionCount++;
    }
  }

  return dimensionCount > 0 ? totalScore / dimensionCount : 0;
}

/**
 * Group results by a specific field
 * @param results - Array of simulation results
 * @param groupByField - Field name to group by
 * @returns Object with groups
 */
export function groupResults<T extends Record<string, any>>(
  results: T[],
  groupByField: keyof T
): Record<string, T[]> {
  return results.reduce((groups, result) => {
    const key = String(result[groupByField] || 'unknown');
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(result);
    return groups;
  }, {} as Record<string, T[]>);
}

/**
 * Build a 2D matrix for heatmap visualization
 * @param results - Array of simulation results
 * @param xField - Field for X-axis (e.g., 'tacticId')
 * @param yField - Field for Y-axis (e.g., 'techniqueId')
 * @param aggregateFn - Function to calculate cell value from grouped results
 * @returns Matrix data structure
 */
export function buildHeatmapMatrix<T extends Record<string, any>>(
  results: T[],
  xField: keyof T,
  yField: keyof T,
  aggregateFn: (groupedResults: T[]) => number
): {
  xLabels: string[];
  yLabels: string[];
  values: number[][];
} {
  // Get unique labels
  const xLabels = Array.from(new Set(results.map(r => String(r[xField])))).sort();
  const yLabels = Array.from(new Set(results.map(r => String(r[yField])))).sort();

  // Build matrix
  const values: number[][] = [];

  for (const yLabel of yLabels) {
    const row: number[] = [];
    for (const xLabel of xLabels) {
      // Filter results for this cell
      const cellResults = results.filter(
        r => String(r[xField]) === xLabel && String(r[yField]) === yLabel
      );

      // Calculate cell value
      const cellValue = cellResults.length > 0
        ? aggregateFn(cellResults)
        : 0;

      row.push(cellValue);
    }
    values.push(row);
  }

  return { xLabels, yLabels, values };
}

/**
 * Get color for heatmap cell based on value
 * @param value - Numeric value (0-100 scale)
 * @param min - Minimum value in dataset
 * @param max - Maximum value in dataset
 * @returns RGB color string
 */
export function getHeatmapColor(value: number, min: number = 0, max: number = 100): string {
  // Normalize value to 0-1
  const normalized = max > min ? (value - min) / (max - min) : 0;

  // Color scale: Red (low) -> Yellow (medium) -> Green (high)
  if (normalized < 0.5) {
    // Red to Yellow
    const r = 239;
    const g = Math.round(68 + (normalized * 2) * (234 - 68));
    const b = 68;
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Yellow to Green
    const r = Math.round(250 - ((normalized - 0.5) * 2) * (250 - 34));
    const g = Math.round(204 + ((normalized - 0.5) * 2) * (197 - 204));
    const b = 21;
    return `rgb(${r}, ${g}, ${b})`;
  }
}

/**
 * Create histogram bins for distribution visualization
 * @param values - Array of numeric values
 * @param binCount - Number of bins to create
 * @returns Array of bins with ranges and counts
 */
export function createHistogramBins(
  values: number[],
  binCount: number = 10
): Array<{ min: number; max: number; count: number; values: number[] }> {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const binWidth = (max - min) / binCount;

  const bins = Array.from({ length: binCount }, (_, i) => ({
    min: min + i * binWidth,
    max: min + (i + 1) * binWidth,
    count: 0,
    values: [] as number[]
  }));

  // Assign values to bins
  for (const value of values) {
    const binIndex = Math.min(
      Math.floor((value - min) / binWidth),
      binCount - 1
    );
    bins[binIndex].count++;
    bins[binIndex].values.push(value);
  }

  return bins;
}

/**
 * Calculate moving average for trend analysis
 * @param values - Array of numeric values
 * @param windowSize - Size of the moving window
 * @returns Array of moving averages
 */
export function calculateMovingAverage(values: number[], windowSize: number): number[] {
  const result: number[] = [];

  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = values.slice(start, i + 1);
    const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
    result.push(avg);
  }

  return result;
}

/**
 * Normalize value to 0-100 scale
 * @param value - Value to normalize
 * @param min - Minimum value in range
 * @param max - Maximum value in range
 * @returns Normalized value
 */
export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 50; // Midpoint if no range
  return ((value - min) / (max - min)) * 100;
}

/**
 * Format currency value
 * @param value - Numeric value
 * @param currency - Currency code (default: USD)
 * @returns Formatted currency string
 */
export function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

/**
 * Format percentage value
 * @param value - Numeric value (0-100)
 * @param decimals - Number of decimal places
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format time duration
 * @param seconds - Duration in seconds
 * @returns Human-readable duration string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}
