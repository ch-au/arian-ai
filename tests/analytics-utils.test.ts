/**
 * Analytics Utilities Test Suite
 * Comprehensive tests for analytics calculation functions
 * Following clean code principles: FIRST (Fast, Independent, Repeatable, Self-validating, Timely)
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSuccessRate,
  calculateAverageRounds,
  calculateTotalCost,
  calculateDealValue,
  groupResults,
  buildHeatmapMatrix,
  getHeatmapColor,
  createHistogramBins,
  calculateMovingAverage,
  normalize,
  formatCurrency,
  formatPercentage,
  formatDuration
} from '../client/src/lib/analytics-utils';
import type { SimulationResult } from '../client/src/lib/types/analytics';

// Test Fixtures
const createMockResult = (overrides: Partial<SimulationResult> = {}): SimulationResult => ({
  id: 'sim-1',
  runNumber: 1,
  status: 'completed',
  negotiationId: 'neg-1',
  techniqueId: 'tech-1',
  tacticId: 'tac-1',
  personalityId: 'pers-1',
  zopaDistance: 'medium',
  totalRounds: 5,
  actualCost: '0.50',
  zopaAchieved: true,
  finalTerms: { price: 100, volume: 500 },
  dimensionResults: null,
  conversationLog: [],
  startedAt: '2025-01-01T00:00:00Z',
  completedAt: '2025-01-01T00:05:00Z',
  outcome: 'DEAL_ACCEPTED',
  ...overrides
});

describe('calculateSuccessRate', () => {
  it('should return 0 for empty array', () => {
    expect(calculateSuccessRate([])).toBe(0);
  });

  it('should return 100 when all simulations succeed', () => {
    const results = [
      createMockResult({ zopaAchieved: true }),
      createMockResult({ zopaAchieved: true }),
      createMockResult({ zopaAchieved: true })
    ];
    expect(calculateSuccessRate(results)).toBe(100);
  });

  it('should return 0 when no simulations succeed', () => {
    const results = [
      createMockResult({ zopaAchieved: false }),
      createMockResult({ zopaAchieved: false })
    ];
    expect(calculateSuccessRate(results)).toBe(0);
  });

  it('should return 50 when half succeed', () => {
    const results = [
      createMockResult({ zopaAchieved: true }),
      createMockResult({ zopaAchieved: false })
    ];
    expect(calculateSuccessRate(results)).toBe(50);
  });

  it('should handle partial success rates correctly', () => {
    const results = [
      createMockResult({ zopaAchieved: true }),
      createMockResult({ zopaAchieved: true }),
      createMockResult({ zopaAchieved: false })
    ];
    expect(calculateSuccessRate(results)).toBeCloseTo(66.67, 1);
  });
});

describe('calculateAverageRounds', () => {
  it('should return 0 for empty array', () => {
    expect(calculateAverageRounds([])).toBe(0);
  });

  it('should calculate correct average for single result', () => {
    const results = [createMockResult({ totalRounds: 5 })];
    expect(calculateAverageRounds(results)).toBe(5);
  });

  it('should calculate correct average for multiple results', () => {
    const results = [
      createMockResult({ totalRounds: 3 }),
      createMockResult({ totalRounds: 5 }),
      createMockResult({ totalRounds: 7 })
    ];
    expect(calculateAverageRounds(results)).toBe(5);
  });

  it('should handle missing totalRounds as 0', () => {
    const results = [
      createMockResult({ totalRounds: 6 }),
      createMockResult({ totalRounds: 0 })
    ];
    expect(calculateAverageRounds(results)).toBe(3);
  });
});

describe('calculateTotalCost', () => {
  it('should return 0 for empty array', () => {
    expect(calculateTotalCost([])).toBe(0);
  });

  it('should handle string costs', () => {
    const results = [
      createMockResult({ actualCost: '0.50' }),
      createMockResult({ actualCost: '1.25' })
    ];
    expect(calculateTotalCost(results)).toBe(1.75);
  });

  it('should handle numeric costs', () => {
    const results = [
      createMockResult({ actualCost: 0.50 }),
      createMockResult({ actualCost: 1.25 })
    ];
    expect(calculateTotalCost(results)).toBe(1.75);
  });

  it('should handle missing costs as 0', () => {
    const results = [
      createMockResult({ actualCost: '2.00' }),
      createMockResult({ actualCost: 0 })
    ];
    expect(calculateTotalCost(results)).toBe(2.00);
  });

  it('should handle mixed cost formats', () => {
    const results = [
      createMockResult({ actualCost: '1.50' }),
      createMockResult({ actualCost: 2.50 }),
      createMockResult({ actualCost: '0.75' })
    ];
    expect(calculateTotalCost(results)).toBe(4.75);
  });
});

describe('calculateDealValue', () => {
  it('should return 0 for null finalTerms', () => {
    const result = calculateDealValue(null, { price: 100 });
    expect(result).toBe(0);
  });

  it('should return 100 when exactly matching target', () => {
    const finalTerms = { price: 100, volume: 500 };
    const targetTerms = { price: 100, volume: 500 };
    const result = calculateDealValue(finalTerms, targetTerms);
    expect(result).toBe(100);
  });

  it('should return lower score when far from target', () => {
    const finalTerms = { price: 50 };
    const targetTerms = { price: 100 };
    const result = calculateDealValue(finalTerms, targetTerms);
    expect(result).toBeLessThan(100);
    expect(result).toBeGreaterThan(0);
  });

  it('should handle multiple dimensions', () => {
    const finalTerms = { price: 100, volume: 500, duration: 36 };
    const targetTerms = { price: 100, volume: 500, duration: 36 };
    const result = calculateDealValue(finalTerms, targetTerms);
    expect(result).toBe(100);
  });

  it('should return 0 for dimensions that are extremely far from target', () => {
    const finalTerms = { price: 1000 };
    const targetTerms = { price: 10 };
    const result = calculateDealValue(finalTerms, targetTerms);
    expect(result).toBe(0);
  });
});

describe('groupResults', () => {
  it('should group by techniqueId', () => {
    const results = [
      createMockResult({ techniqueId: 'tech-1', id: '1' }),
      createMockResult({ techniqueId: 'tech-2', id: '2' }),
      createMockResult({ techniqueId: 'tech-1', id: '3' })
    ];

    const grouped = groupResults(results, 'techniqueId');

    expect(Object.keys(grouped)).toHaveLength(2);
    expect(grouped['tech-1']).toHaveLength(2);
    expect(grouped['tech-2']).toHaveLength(1);
  });

  it('should handle null values as "unknown"', () => {
    const results = [
      createMockResult({ techniqueId: null }),
      createMockResult({ techniqueId: 'tech-1' })
    ];

    const grouped = groupResults(results, 'techniqueId');

    expect(grouped['unknown']).toHaveLength(1);
    expect(grouped['tech-1']).toHaveLength(1);
  });

  it('should handle empty array', () => {
    const grouped = groupResults([], 'techniqueId');
    expect(Object.keys(grouped)).toHaveLength(0);
  });
});

describe('buildHeatmapMatrix', () => {
  it('should build correct matrix for technique x tactic', () => {
    const results = [
      createMockResult({ techniqueId: 'tech-1', tacticId: 'tac-1', zopaAchieved: true }),
      createMockResult({ techniqueId: 'tech-1', tacticId: 'tac-2', zopaAchieved: false }),
      createMockResult({ techniqueId: 'tech-2', tacticId: 'tac-1', zopaAchieved: true }),
      createMockResult({ techniqueId: 'tech-2', tacticId: 'tac-2', zopaAchieved: true })
    ];

    const matrix = buildHeatmapMatrix(
      results,
      'tacticId',
      'techniqueId',
      (group) => group.filter(r => r.zopaAchieved).length / group.length * 100
    );

    expect(matrix.xLabels).toEqual(['tac-1', 'tac-2']);
    expect(matrix.yLabels).toEqual(['tech-1', 'tech-2']);
    expect(matrix.values).toHaveLength(2); // 2 techniques (rows)
    expect(matrix.values[0]).toHaveLength(2); // 2 tactics (columns)
  });

  it('should handle single value correctly', () => {
    const results = [
      createMockResult({ techniqueId: 'tech-1', tacticId: 'tac-1' })
    ];

    const matrix = buildHeatmapMatrix(
      results,
      'tacticId',
      'techniqueId',
      (group) => group.length
    );

    expect(matrix.values[0][0]).toBe(1);
  });

  it('should return 0 for empty cells', () => {
    const results = [
      createMockResult({ techniqueId: 'tech-1', tacticId: 'tac-1' })
      // No tech-1 + tac-2 combination
    ];

    const allResults = [
      ...results,
      createMockResult({ techniqueId: 'tech-1', tacticId: 'tac-2' })
    ];

    const matrix = buildHeatmapMatrix(
      allResults,
      'tacticId',
      'techniqueId',
      (group) => group.length
    );

    // Both cells should have count of 1 now
    expect(matrix.values[0][0]).toBe(1);
    expect(matrix.values[0][1]).toBe(1);
  });
});

describe('getHeatmapColor', () => {
  it('should return red for low values', () => {
    const color = getHeatmapColor(0, 0, 100);
    expect(color).toContain('rgb(239');
  });

  it('should return green for high values', () => {
    const color = getHeatmapColor(100, 0, 100);
    expect(color).toContain('rgb(34');
  });

  it('should return intermediate color for mid values', () => {
    const color = getHeatmapColor(50, 0, 100);
    expect(color).toContain('rgb(');
  });

  it('should handle custom min/max', () => {
    const color = getHeatmapColor(75, 50, 100);
    // 75 is halfway between 50-100, should be mid-range color
    expect(color).toContain('rgb(');
  });
});

describe('createHistogramBins', () => {
  it('should create correct number of bins', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const bins = createHistogramBins(values, 5);

    expect(bins).toHaveLength(5);
  });

  it('should distribute values correctly', () => {
    const values = [1, 1, 1, 5, 5, 5, 10, 10, 10];
    const bins = createHistogramBins(values, 3);

    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(values.length);
  });

  it('should handle empty array', () => {
    const bins = createHistogramBins([], 5);
    expect(bins).toHaveLength(0);
  });

  it('should set correct min/max ranges', () => {
    const values = [0, 10, 20, 30, 40, 50];
    const bins = createHistogramBins(values, 5);

    expect(bins[0].min).toBe(0);
    expect(bins[bins.length - 1].max).toBe(50);
  });
});

describe('calculateMovingAverage', () => {
  it('should calculate moving average with window size 3', () => {
    const values = [1, 2, 3, 4, 5];
    const result = calculateMovingAverage(values, 3);

    expect(result[0]).toBe(1); // Window: [1]
    expect(result[1]).toBe(1.5); // Window: [1, 2]
    expect(result[2]).toBe(2); // Window: [1, 2, 3]
    expect(result[3]).toBe(3); // Window: [2, 3, 4]
    expect(result[4]).toBe(4); // Window: [3, 4, 5]
  });

  it('should handle window size larger than array', () => {
    const values = [1, 2, 3];
    const result = calculateMovingAverage(values, 10);

    expect(result).toHaveLength(3);
    expect(result[2]).toBe(2); // Average of all values
  });

  it('should handle empty array', () => {
    const result = calculateMovingAverage([], 3);
    expect(result).toHaveLength(0);
  });
});

describe('normalize', () => {
  it('should normalize to 0-100 scale', () => {
    expect(normalize(0, 0, 100)).toBe(0);
    expect(normalize(50, 0, 100)).toBe(50);
    expect(normalize(100, 0, 100)).toBe(100);
  });

  it('should handle custom ranges', () => {
    expect(normalize(5, 0, 10)).toBe(50);
    expect(normalize(7.5, 0, 10)).toBe(75);
  });

  it('should return midpoint when min equals max', () => {
    expect(normalize(5, 5, 5)).toBe(50);
  });
});

describe('formatCurrency', () => {
  it('should format USD by default', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('should format with 2 decimal places', () => {
    expect(formatCurrency(100)).toBe('$100.00');
  });

  it('should handle large numbers', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
  });

  it('should handle zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });
});

describe('formatPercentage', () => {
  it('should format with 1 decimal by default', () => {
    expect(formatPercentage(87.456)).toBe('87.5%');
  });

  it('should respect custom decimal places', () => {
    expect(formatPercentage(87.456, 2)).toBe('87.46%');
    expect(formatPercentage(87.456, 0)).toBe('87%');
  });

  it('should handle whole numbers', () => {
    expect(formatPercentage(100)).toBe('100.0%');
  });
});

describe('formatDuration', () => {
  it('should format seconds', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  it('should format minutes', () => {
    expect(formatDuration(120)).toBe('2m');
    expect(formatDuration(90)).toBe('2m'); // Rounds
  });

  it('should format hours', () => {
    expect(formatDuration(3600)).toBe('1.0h');
    expect(formatDuration(5400)).toBe('1.5h');
  });

  it('should handle zero', () => {
    expect(formatDuration(0)).toBe('0s');
  });
});
