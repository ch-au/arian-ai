/**
 * Analytics Summary Cards Component
 * Clean, reusable component following Single Responsibility Principle
 * Displays key performance metrics in a card layout
 */

import { Card, CardContent } from '@/components/ui/card';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  DollarSign,
  Target,
  CheckCircle
} from 'lucide-react';
import {
  formatCurrency,
  formatPercentage,
  formatDuration
} from '@/lib/analytics-utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  iconColor: string;
  subtitle?: string;
}

/**
 * Single Metric Card - Following SRP and DRY principles
 */
function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  iconColor,
  subtitle
}: MetricCardProps) {
  const isPositive = change !== undefined && change > 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  const trendColor = isPositive ? 'text-green-600' : 'text-red-600';

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-600 font-medium">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconColor}`}>
            {icon}
          </div>
        </div>

        {change !== undefined && (
          <div className={`flex items-center mt-3 ${trendColor}`}>
            <TrendIcon className="w-4 h-4 mr-1" />
            <span className="text-sm font-medium">
              {change > 0 ? '+' : ''}{change}%
            </span>
            {changeLabel && (
              <span className="text-xs text-gray-500 ml-2">{changeLabel}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export interface AnalyticsSummary {
  totalRuns: number;
  completedRuns: number;
  successRate: number;
  avgRounds: number;
  avgCost: number;
  totalCost: number;
  bestDealValue: number;
  avgDuration?: number;
}

interface AnalyticsSummaryCardsProps {
  data: AnalyticsSummary;
  previousData?: AnalyticsSummary; // For trend comparison
}

/**
 * Analytics Summary Cards - Clean component composition
 * @param data - Current analytics summary
 * @param previousData - Previous period data for comparison
 */
export function AnalyticsSummaryCards({
  data,
  previousData
}: AnalyticsSummaryCardsProps) {
  // Calculate trends if previous data available
  const calculateChange = (current: number, previous?: number): number | undefined => {
    if (previous === undefined || previous === 0) return undefined;
    return ((current - previous) / previous) * 100;
  };

  const successRateChange = calculateChange(data.successRate, previousData?.successRate);
  const avgRoundsChange = calculateChange(data.avgRounds, previousData?.avgRounds);
  const avgCostChange = calculateChange(data.avgCost, previousData?.avgCost);
  const totalRunsChange = calculateChange(data.totalRuns, previousData?.totalRuns);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total Simulations */}
      <MetricCard
        title="Total Simulations"
        value={data.totalRuns.toLocaleString()}
        change={totalRunsChange}
        changeLabel="vs previous"
        icon={<Users className="w-6 h-6 text-white" />}
        iconColor="bg-blue-500"
        subtitle={`${data.completedRuns} completed`}
      />

      {/* Success Rate */}
      <MetricCard
        title="Success Rate"
        value={formatPercentage(data.successRate, 1)}
        change={successRateChange}
        changeLabel="vs previous"
        icon={<CheckCircle className="w-6 h-6 text-white" />}
        iconColor="bg-green-500"
        subtitle="ZOPA achieved"
      />

      {/* Average Rounds */}
      <MetricCard
        title="Avg Rounds"
        value={data.avgRounds.toFixed(1)}
        change={avgRoundsChange}
        changeLabel="vs previous"
        icon={<Clock className="w-6 h-6 text-white" />}
        iconColor="bg-yellow-500"
        subtitle={data.avgDuration ? formatDuration(data.avgDuration) : undefined}
      />

      {/* Total Cost */}
      <MetricCard
        title="Total API Cost"
        value={formatCurrency(data.totalCost)}
        change={avgCostChange}
        changeLabel="vs previous"
        icon={<DollarSign className="w-6 h-6 text-white" />}
        iconColor="bg-purple-500"
        subtitle={`${formatCurrency(data.avgCost)} avg per run`}
      />

      {/* Best Deal (Optional - shown if 5 columns) */}
      {data.bestDealValue > 0 && (
        <MetricCard
          title="Best Deal Score"
          value={data.bestDealValue.toFixed(0)}
          icon={<Target className="w-6 h-6 text-white" />}
          iconColor="bg-indigo-500"
          subtitle="out of 100"
        />
      )}
    </div>
  );
}

/**
 * Loading skeleton for summary cards
 */
export function AnalyticsSummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
                <div className="h-8 bg-gray-200 rounded w-16 animate-pulse" />
              </div>
              <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
