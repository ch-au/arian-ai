/**
 * Top Performers Component
 * Displays best-performing technique-tactic combinations
 * Clean, data-driven component with clear separation of concerns
 */

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, DollarSign, Clock } from 'lucide-react';
import {
  calculateSuccessRate,
  calculateAverageRounds,
  calculateTotalCost,
  groupResults,
  formatCurrency,
  formatPercentage
} from '@/lib/analytics-utils';
import type { SimulationResult } from '@/lib/types/analytics';

interface CombinationPerformance {
  techniqueId: string;
  tacticId: string;
  techniqueName: string;
  tacticName: string;
  totalRuns: number;
  successRate: number;
  avgRounds: number;
  avgCost: number;
  rank: number;
}

interface TopPerformersProps {
  results: SimulationResult[];
  techniques: Array<{ id: string; name: string }>;
  tactics: Array<{ id: string; name: string }>;
  topN?: number;
  title?: string;
}

/**
 * Performance Badge Component
 */
interface PerformanceBadgeProps {
  rank: number;
}

function PerformanceBadge({ rank }: PerformanceBadgeProps) {
  const badgeConfig = {
    1: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: '🥇' },
    2: { color: 'bg-gray-100 text-gray-800 border-gray-300', icon: '🥈' },
    3: { color: 'bg-orange-100 text-orange-800 border-orange-300', icon: '🥉' },
    default: { color: 'bg-blue-100 text-blue-800 border-blue-300', icon: '⭐' }
  };

  const config = badgeConfig[rank as keyof typeof badgeConfig] || badgeConfig.default;

  return (
    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${config.color}`}>
      <span className="text-lg">{config.icon}</span>
    </div>
  );
}

/**
 * Performance Metric Component
 */
interface MetricProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
}

function Metric({ icon, label, value, sublabel }: MetricProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-gray-400">
        {icon}
      </div>
      <div>
        <div className="text-xs text-gray-600">{label}</div>
        <div className="font-semibold text-sm">{value}</div>
        {sublabel && <div className="text-xs text-gray-500">{sublabel}</div>}
      </div>
    </div>
  );
}

/**
 * Calculate performance metrics for all combinations
 * Pure function - testable and reusable
 */
function calculateCombinationPerformance(
  results: SimulationResult[],
  techniques: Array<{ id: string; name: string }>,
  tactics: Array<{ id: string; name: string }>
): CombinationPerformance[] {
  const techniqueMap = new Map(techniques.map(t => [t.id, t.name]));
  const tacticMap = new Map(tactics.map(t => [t.id, t.name]));

  // Group by technique-tactic combination
  const combinations = new Map<string, SimulationResult[]>();

  for (const result of results) {
    if (!result.techniqueId || !result.tacticId) continue;

    const key = `${result.techniqueId}:${result.tacticId}`;
    if (!combinations.has(key)) {
      combinations.set(key, []);
    }
    combinations.get(key)!.push(result);
  }

  // Calculate metrics for each combination
  const performances: CombinationPerformance[] = [];

  for (const [key, combResults] of combinations.entries()) {
    const [techniqueId, tacticId] = key.split(':');

    performances.push({
      techniqueId,
      tacticId,
      techniqueName: techniqueMap.get(techniqueId) || techniqueId,
      tacticName: tacticMap.get(tacticId) || tacticId,
      totalRuns: combResults.length,
      successRate: calculateSuccessRate(combResults),
      avgRounds: calculateAverageRounds(combResults),
      avgCost: calculateTotalCost(combResults) / combResults.length,
      rank: 0 // Will be set after sorting
    });
  }

  // Sort by success rate (descending), then by average cost (ascending)
  performances.sort((a, b) => {
    if (b.successRate !== a.successRate) {
      return b.successRate - a.successRate;
    }
    return a.avgCost - b.avgCost; // Lower cost is better
  });

  // Assign ranks
  performances.forEach((perf, index) => {
    perf.rank = index + 1;
  });

  return performances;
}

/**
 * Top Performers Component - Main
 */
export function TopPerformers({
  results,
  techniques,
  tactics,
  topN = 5,
  title = 'Top Performing Combinations'
}: TopPerformersProps) {
  // Memoized calculation
  const topPerformers = useMemo(() => {
    const allPerformances = calculateCombinationPerformance(results, techniques, tactics);
    return allPerformances.slice(0, topN);
  }, [results, techniques, tactics, topN]);

  // Handle empty state
  if (results.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            {title}
          </CardTitle>
          <CardDescription>Best technique-tactic combinations by success rate</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-gray-400">
            <div className="text-center">
              <p>No combinations to rank yet</p>
              <p className="text-sm mt-1">Complete simulations to see top performers</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (topPerformers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400 text-center py-8">
            No valid combinations found
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-600" />
          {title}
        </CardTitle>
        <CardDescription>
          Best technique-tactic combinations ranked by success rate and cost efficiency
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {topPerformers.map((performer) => (
            <div
              key={`${performer.techniqueId}-${performer.tacticId}`}
              className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors bg-white"
            >
              {/* Rank Badge */}
              <PerformanceBadge rank={performer.rank} />

              {/* Combination Info */}
              <div className="flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {performer.techniqueName}
                      <span className="text-gray-400 mx-2">+</span>
                      {performer.tacticName}
                    </h4>
                    <p className="text-sm text-gray-500 mt-1">
                      Based on {performer.totalRuns} simulation{performer.totalRuns !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Success Badge */}
                  <Badge
                    variant={performer.successRate >= 90 ? 'default' : 'secondary'}
                    className="text-sm"
                  >
                    {formatPercentage(performer.successRate, 0)} success
                  </Badge>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-4">
                  <Metric
                    icon={<TrendingUp className="w-4 h-4" />}
                    label="Success Rate"
                    value={formatPercentage(performer.successRate, 1)}
                  />

                  <Metric
                    icon={<Clock className="w-4 h-4" />}
                    label="Avg Rounds"
                    value={performer.avgRounds.toFixed(1)}
                    sublabel="negotiations"
                  />

                  <Metric
                    icon={<DollarSign className="w-4 h-4" />}
                    label="Avg Cost"
                    value={formatCurrency(performer.avgCost)}
                    sublabel="per simulation"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Show More Link */}
        {topPerformers.length >= topN && (
          <div className="mt-4 text-center">
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View All Combinations →
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton
 */
export function TopPerformersSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-64 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-96 bg-gray-200 rounded animate-pulse mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg">
              <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
                <div className="grid grid-cols-3 gap-4 mt-3">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="h-12 bg-gray-200 rounded animate-pulse" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Export the calculation function for testing
 */
export { calculateCombinationPerformance };
