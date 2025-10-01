/**
 * Analytics Type Definitions
 * Centralized type definitions for analytics and visualization
 */

export interface SimulationResult {
  id: string;
  runNumber: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  negotiationId: string;
  techniqueId: string | null;
  tacticId: string | null;
  personalityId: string | null;
  zopaDistance: string | null;
  totalRounds: number;
  actualCost: string | number;
  zopaAchieved: boolean;
  finalTerms: Record<string, number> | null;
  dimensionResults: Record<string, DimensionResult> | null;
  conversationLog: ConversationTurn[];
  startedAt: string | null;
  completedAt: string | null;
  outcome: string | null;
}

export interface DimensionResult {
  name: string;
  finalValue: number;
  targetValue: number;
  minValue: number;
  maxValue: number;
  achievedTarget: boolean;
  priority: number;
  unit?: string;
}

export interface ConversationTurn {
  round: number;
  agent: 'buyer' | 'seller';
  message: string;
  offer?: {
    dimension_values: Record<string, number>;
    action: string;
  };
  internal_analysis?: string;
  batna_assessment?: number;
  walk_away_threshold?: number;
}

export interface AnalyticsSummary {
  totalRuns: number;
  completedRuns: number;
  successRate: number;
  avgRounds: number;
  avgCost: number;
  totalCost: number;
  bestDealValue: number;
  worstDealValue: number;
  avgDealValue: number;
}

export interface TechniquePerformance {
  techniqueId: string;
  techniqueName: string;
  totalRuns: number;
  successRate: number;
  avgRounds: number;
  avgCost: number;
  avgDealValue: number;
}

export interface TacticPerformance {
  tacticId: string;
  tacticName: string;
  totalRuns: number;
  successRate: number;
  avgRounds: number;
  avgCost: number;
  avgDealValue: number;
}

export interface CombinationPerformance {
  techniqueId: string;
  tacticId: string;
  techniqueName: string;
  tacticName: string;
  totalRuns: number;
  successRate: number;
  avgRounds: number;
  avgCost: number;
  avgDealValue: number;
}

export interface PersonalityPerformance {
  personalityId: string;
  personalityName: string;
  totalRuns: number;
  successRate: number;
  avgRounds: number;
  avgCost: number;
  avgDealValue: number;
}

export interface HeatmapData {
  xLabels: string[];
  yLabels: string[];
  values: number[][];
}

export interface HistogramBin {
  min: number;
  max: number;
  count: number;
  values: number[];
  label?: string;
  isTargetRange?: boolean;
}

export interface TrendPoint {
  executionOrder: number;
  movingAvgSuccess: number;
  actualSuccess: number;
  timestamp?: string;
}

export interface ScatterPoint {
  x: number;
  y: number;
  techniqueId: string;
  tacticId: string;
  color: string;
  label?: string;
  simulationId?: string;
}

export interface ExportFormat {
  format: 'csv' | 'json' | 'excel' | 'pdf';
  negotiationId: string;
  includeConversations?: boolean;
  includeCharts?: boolean;
}

export interface AnalyticsFilter {
  techniqueIds: string[];
  tacticIds: string[];
  personalityIds: string[];
  zopaDistances: string[];
  successOnly: boolean;
  minRounds: number;
  maxRounds: number;
  minCost: number;
  maxCost: number;
  dateFrom: string | null;
  dateTo: string | null;
}
