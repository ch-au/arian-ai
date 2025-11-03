/**
 * Advanced Simulation Analytics Components
 * Real-time metrics, strategy effectiveness, and performance insights
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Clock, 
  Target, 
  Zap,
  Activity,
  Users,
  BarChart3,
  PieChart,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PerformanceMetric {
  label: string;
  value: number | string;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  format?: 'percentage' | 'currency' | 'duration' | 'number';
  color?: 'green' | 'blue' | 'red' | 'yellow' | 'purple';
}

interface StrategyPerformance {
  techniqueId: string;
  techniqueName: string;
  tacticId: string;
  tacticName: string;
  runs: number;
  successRate: number;
  avgDealValue: number;
  avgRounds: number;
  avgDuration: number;
  costEfficiency: number;
}

interface AnalyticsProps {
  simulationResults: any[];
  queueStatus: any;
  techniques: any[];
  tactics: any[];
  totalRuns?: number;
}

// Format value based on type
const formatValue = (value: number | string, format?: string): string => {
  if (typeof value === 'string') return value;
  
  switch (format) {
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'currency':
      return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    case 'duration':
      return `${Math.floor(value / 60)}:${(value % 60).toString().padStart(2, '0')}`;
    case 'number':
      return value.toLocaleString();
    default:
      return value.toString();
  }
};

// Get trend icon and color
const getTrendIndicator = (trend?: 'up' | 'down' | 'neutral', change?: number) => {
  if (!trend || !change) return null;
  
  const isPositive = change > 0;
  const color = trend === 'up' ? (isPositive ? 'text-green-500' : 'text-red-500') :
                trend === 'down' ? (isPositive ? 'text-red-500' : 'text-green-500') :
                'text-gray-500';
  
  const Icon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : Minus;
  
  return (
    <div className={cn('flex items-center', color)}>
      <Icon className="h-3 w-3 mr-1" />
      <span className="text-xs font-medium">{Math.abs(change).toFixed(1)}%</span>
    </div>
  );
};

// Performance Metric Card
const MetricCard: React.FC<{ metric: PerformanceMetric }> = ({ metric }) => {
  const colorClasses = {
    green: 'border-green-200 bg-green-50 text-green-800',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    red: 'border-red-200 bg-red-50 text-red-800',
    yellow: 'border-yellow-200 bg-yellow-50 text-yellow-800',
    purple: 'border-purple-200 bg-purple-50 text-purple-800',
  };

  const cardClass = metric.color ? colorClasses[metric.color] : 'border-gray-200 bg-gray-50';

  return (
    <Card className={cn('transition-all duration-200 hover:shadow-md', cardClass)}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {metric.label}
          </div>
          {getTrendIndicator(metric.trend, metric.change)}
        </div>
        <div className="text-2xl font-bold">
          {formatValue(metric.value, metric.format)}
        </div>
      </CardContent>
    </Card>
  );
};

// Real-time Performance Metrics Dashboard
export const PerformanceMetricsDashboard: React.FC<AnalyticsProps> = ({ 
  simulationResults, 
  queueStatus,
  totalRuns = 0
}) => {
  // Calculate metrics - consider all finished simulations (completed, failed, timeout)
  const successfulRuns = simulationResults.filter(r => r.status === 'completed');
  const failedRuns = simulationResults.filter(r => r.status === 'failed');
  const timeoutRuns = simulationResults.filter(r => r.status === 'timeout');
  const finishedRuns = [...successfulRuns, ...failedRuns, ...timeoutRuns];
  
  // Success rate based on deal acceptance (only 'completed' status means deal was accepted)
  const successRate = finishedRuns.length > 0 ? (successfulRuns.length / finishedRuns.length) * 100 : 0;
  
  // Average deal value only for successful deals (completed status)
  const avgDealValue = successfulRuns.length > 0 
    ? successfulRuns.reduce((sum, r) => {
        const dimensionResults = typeof r.dimensionResults === 'string' 
          ? JSON.parse(r.dimensionResults || '{}') 
          : r.dimensionResults || {};
        return sum + (dimensionResults.Price || 0);
      }, 0) / successfulRuns.length
    : 0;

  // Average rounds for all finished simulations
  const avgRounds = finishedRuns.length > 0
    ? finishedRuns.reduce((sum, r) => sum + (r.totalRounds || 0), 0) / finishedRuns.length
    : 0;

  // Total cost for all simulations (including running/pending)
  const totalCost = simulationResults.reduce((sum, r) => {
    const cost = typeof r.actualCost === 'string' ? parseFloat(r.actualCost) : (r.actualCost || 0);
    return sum + cost;
  }, 0);
  
  const costPerDeal = successfulRuns.length > 0 ? totalCost / finishedRuns.length : 0;

  const metrics: PerformanceMetric[] = [
    {
      label: 'Success Rate',
      value: successRate,
      format: 'percentage',
      color: successRate > 70 ? 'green' : successRate > 50 ? 'yellow' : 'red',
      trend: successRate > 60 ? 'up' : 'down',
      change: 5.2
    },
    {
      label: 'Avg Deal Value',
      value: avgDealValue,
      format: 'currency',
      color: 'blue',
      trend: 'up',
      change: 12.8
    },
    {
      label: 'Avg Rounds',
      value: avgRounds,
      format: 'number',
      color: avgRounds < 4 ? 'green' : 'yellow',
      trend: avgRounds < 4 ? 'down' : 'up',
      change: -8.3
    },
    {
      label: 'Cost per Deal',
      value: costPerDeal,
      format: 'currency',
      color: costPerDeal < 1 ? 'green' : 'yellow',
      trend: 'down',
      change: -15.4
    },
    {
      label: 'Active Runs',
      value: queueStatus?.status === 'running' ? 1 : 0,
      format: 'number',
      color: 'purple',
    },
    {
      label: 'Total Completed',
      value: finishedRuns.length,
      format: 'number',
      color: 'blue',
      trend: 'up',
      change: 23.1
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {metrics.map((metric, index) => (
        <MetricCard key={index} metric={metric} />
      ))}
    </div>
  );
};

// Strategy Effectiveness Matrix
export const StrategyEffectivenessMatrix: React.FC<AnalyticsProps> = ({ 
  simulationResults, 
  techniques, 
  tactics 
}) => {
  // Group results by strategy combination
  const strategyGroups = simulationResults.reduce((acc, result) => {
    const key = `${result.techniqueId}-${result.tacticId}`;
    if (!acc[key]) {
      acc[key] = {
        techniqueId: result.techniqueId,
        tacticId: result.tacticId,
        results: []
      };
    }
    acc[key].results.push(result);
    return acc;
  }, {} as Record<string, any>);

  // Calculate performance metrics for each strategy
  const strategyPerformance: StrategyPerformance[] = Object.values(strategyGroups).map((group: any) => {
    const completed = group.results.filter((r: any) => r.status === 'completed');
    const successRate = completed.length / group.results.length * 100;
    
    const avgDealValue = completed.length > 0 
      ? completed.reduce((sum: number, r: any) => {
          const dimensionResults = typeof r.dimensionResults === 'string' 
            ? JSON.parse(r.dimensionResults || '{}') 
            : r.dimensionResults || {};
          return sum + (dimensionResults.Price || 0);
        }, 0) / completed.length
      : 0;

    const avgRounds = completed.length > 0
      ? completed.reduce((sum: number, r: any) => sum + (r.totalRounds || 0), 0) / completed.length
      : 0;

    const avgCost = group.results.length > 0
      ? group.results.reduce((sum: number, r: any) => sum + (r.actualCost || 0), 0) / group.results.length
      : 0;

    const costEfficiency = avgDealValue > 0 ? avgDealValue / avgCost : 0;

    const technique = techniques.find(t => t.id === group.techniqueId);
    const tactic = tactics.find(t => t.id === group.tacticId);

    return {
      techniqueId: group.techniqueId,
      techniqueName: technique?.name || 'Unknown',
      tacticId: group.tacticId,
      tacticName: tactic?.name || 'Unknown',
      runs: group.results.length,
      successRate,
      avgDealValue,
      avgRounds,
      avgDuration: 45, // Placeholder
      costEfficiency
    };
  }).sort((a, b) => b.successRate - a.successRate);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Strategy Effectiveness Matrix
        </CardTitle>
        <CardDescription>
          Performance analysis by technique-tactic combinations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {strategyPerformance.slice(0, 6).map((strategy, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-sm">
                    {strategy.techniqueName} + {strategy.tacticName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {strategy.runs} runs
                  </div>
                </div>
                <Badge 
                  variant={strategy.successRate > 70 ? 'default' : strategy.successRate > 50 ? 'secondary' : 'outline'}
                  className="text-xs"
                >
                  {strategy.successRate.toFixed(0)}% Success
                </Badge>
              </div>
              
              <div className="grid grid-cols-4 gap-4 text-xs">
                <div>
                  <div className="text-muted-foreground">Deal Value</div>
                  <div className="font-medium">{formatValue(strategy.avgDealValue, 'currency')}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Avg Rounds</div>
                  <div className="font-medium">{strategy.avgRounds.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Efficiency</div>
                  <div className="font-medium">{strategy.costEfficiency.toFixed(0)}x</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Rating</div>
                  <div className="flex">
                    {Array.from({ length: 5 }, (_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-2 h-2 rounded-full mr-1",
                          i < Math.floor(strategy.successRate / 20) ? 'bg-green-400' : 'bg-gray-200'
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Performance Score</span>
                  <span>{strategy.successRate.toFixed(0)}%</span>
                </div>
                <Progress value={strategy.successRate} className="h-2" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Live Negotiation Stats
export const LiveNegotiationStats: React.FC<{ currentNegotiation: any }> = ({ 
  currentNegotiation 
}) => {
  if (!currentNegotiation || !currentNegotiation.rounds.length) return null;

  const lastRound = currentNegotiation.rounds[currentNegotiation.rounds.length - 1];
  const offerHistory = currentNegotiation.rounds.filter((r: any) => r.offer?.dimension_values?.Price);
  
  const priceRange = offerHistory.length > 1 ? {
    min: Math.min(...offerHistory.map((r: any) => r.offer.dimension_values.Price)),
    max: Math.max(...offerHistory.map((r: any) => r.offer.dimension_values.Price)),
    current: lastRound?.offer?.dimension_values?.Price || 0
  } : null;

  const convergenceScore = priceRange ? 
    ((priceRange.max - priceRange.min) > 0 ? 
      (1 - (priceRange.max - priceRange.current) / (priceRange.max - priceRange.min)) * 100 : 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800">Live Progress</span>
          </div>
          <div className="text-2xl font-bold text-green-900">
            Round {Math.ceil(currentNegotiation.rounds.length / 2)}/{Math.ceil(currentNegotiation.maxRounds / 2)}
          </div>
          <Progress 
            value={(currentNegotiation.rounds.length / currentNegotiation.maxRounds) * 100} 
            className="h-2 mt-2" 
          />
        </CardContent>
      </Card>

      {priceRange && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Deal Probability</span>
            </div>
            <div className="text-2xl font-bold text-blue-900">
              {convergenceScore.toFixed(0)}%
            </div>
            <div className="text-xs text-blue-700 mt-1">
              Range: {formatValue(priceRange.min, 'currency')} - {formatValue(priceRange.max, 'currency')}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-purple-200 bg-purple-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-800">Negotiation Intensity</span>
          </div>
          <div className="text-2xl font-bold text-purple-900">
            {currentNegotiation.rounds.length > 2 ? 'High' : 'Building'}
          </div>
          <div className="text-xs text-purple-700 mt-1">
            {currentNegotiation.rounds.length} exchanges
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
