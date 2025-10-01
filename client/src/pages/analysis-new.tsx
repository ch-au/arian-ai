/**
 * Analysis Dashboard - Complete Results Visualization
 * Clean architecture: Smart container with dumb presentational components
 * Following React best practices and clean code principles
 */

import { useState, useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Download,
  ArrowLeft,
  BarChart3,
  Grid3x3,
  TrendingUp,
  Table,
  AlertCircle
} from 'lucide-react';

// Analytics Components (clean, modular)
import {
  AnalyticsSummaryCards,
  AnalyticsSummaryCardsSkeleton
} from '@/components/analytics/AnalyticsSummaryCards';
import {
  SuccessRateHeatmap,
  SuccessRateHeatmapSkeleton
} from '@/components/analytics/SuccessRateHeatmap';
import {
  TopPerformers,
  TopPerformersSkeleton
} from '@/components/analytics/TopPerformers';

// Utilities
import {
  calculateSuccessRate,
  calculateAverageRounds,
  calculateTotalCost,
  formatCurrency
} from '@/lib/analytics-utils';
import type { SimulationResult, AnalyticsSummary } from '@/lib/types/analytics';

/**
 * Calculate summary analytics from results
 * Pure function - easily testable
 */
function calculateSummaryAnalytics(results: SimulationResult[]): AnalyticsSummary {
  const completed = results.filter(r => r.status === 'completed');

  if (completed.length === 0) {
    return {
      totalRuns: results.length,
      completedRuns: 0,
      successRate: 0,
      avgRounds: 0,
      avgCost: 0,
      totalCost: 0,
      bestDealValue: 0,
      worstDealValue: 0,
      avgDealValue: 0
    };
  }

  return {
    totalRuns: results.length,
    completedRuns: completed.length,
    successRate: calculateSuccessRate(completed),
    avgRounds: calculateAverageRounds(completed),
    avgCost: calculateTotalCost(completed) / completed.length,
    totalCost: calculateTotalCost(completed),
    bestDealValue: 0, // TODO: Calculate from dimension results
    worstDealValue: 0,
    avgDealValue: 0
  };
}

/**
 * Export Options Component
 */
interface ExportOptionsProps {
  negotiationId: string;
  negotiationTitle: string;
}

function ExportOptions({ negotiationId, negotiationTitle }: ExportOptionsProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: 'csv' | 'json' | 'excel') => {
    setExporting(true);
    try {
      const response = await fetch(
        `/api/analytics/export/${negotiationId}?format=${format}`
      );

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Create download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${negotiationTitle}-results.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export results. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport('csv')}
        disabled={exporting}
      >
        <Download className="w-4 h-4 mr-2" />
        CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport('excel')}
        disabled={exporting}
      >
        <Download className="w-4 h-4 mr-2" />
        Excel
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport('json')}
        disabled={exporting}
      >
        <Download className="w-4 h-4 mr-2" />
        JSON
      </Button>
    </div>
  );
}

/**
 * Main Analysis Dashboard Component
 * Smart container that manages data fetching and state
 */
export default function AnalysisDashboard() {
  const { negotiationId } = useParams<{ negotiationId: string }>();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Fetch negotiation details
  const {
    data: negotiation,
    isLoading: loadingNegotiation
  } = useQuery<any>({
    queryKey: [`/api/negotiations/${negotiationId}`]
  });

  // Fetch simulation results - first get queue, then results
  // Step 1: Get queue ID for this negotiation
  const {
    data: queueData,
    isLoading: loadingQueue
  } = useQuery<any>({
    queryKey: [`/api/simulations/queue/by-negotiation/${negotiationId}`],
    enabled: !!negotiationId
  });

  // Step 2: Get results for the queue
  const {
    data: resultsResponse,
    isLoading: loadingResults
  } = useQuery<any>({
    queryKey: [`/api/simulations/queue/${queueData?.queueId}/results`],
    enabled: !!queueData?.queueId
  });

  const results = resultsResponse?.data || [];

  // Fetch techniques and tactics for labeling
  const { data: techniques = [] } = useQuery<any[]>({
    queryKey: ['/api/influencing-techniques']
  });

  const { data: tactics = [] } = useQuery<any[]>({
    queryKey: ['/api/negotiation-tactics']
  });

  // Calculate analytics (memoized for performance)
  const analytics = useMemo(() => {
    return calculateSummaryAnalytics(results);
  }, [results]);

  // Loading state
  const isLoading = loadingNegotiation || loadingQueue || loadingResults;

  // Error state
  if (!negotiationId) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Invalid negotiation ID. Please select a valid negotiation.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/negotiations')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isLoading ? (
                <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
              ) : (
                negotiation?.title || 'Analysis Dashboard'
              )}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {isLoading ? (
                <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
              ) : (
                `${analytics.completedRuns} of ${analytics.totalRuns} simulations completed`
              )}
            </p>
          </div>
        </div>

        {/* Export Options */}
        {!isLoading && negotiation && (
          <ExportOptions
            negotiationId={negotiationId}
            negotiationTitle={negotiation.title}
          />
        )}
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <AnalyticsSummaryCardsSkeleton />
      ) : (
        <AnalyticsSummaryCards data={analytics} />
      )}

      {/* Tabs for Different Views */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="heatmap" className="flex items-center gap-2">
            <Grid3x3 className="w-4 h-4" />
            Heatmap
          </TabsTrigger>
          <TabsTrigger value="trends" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="detailed" className="flex items-center gap-2">
            <Table className="w-4 h-4" />
            Detailed Results
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Top Performers */}
          {isLoading ? (
            <TopPerformersSkeleton />
          ) : (
            <TopPerformers
              results={results}
              techniques={techniques}
              tactics={tactics}
              topN={5}
            />
          )}

          {/* Heatmap Preview */}
          {isLoading ? (
            <SuccessRateHeatmapSkeleton />
          ) : (
            <SuccessRateHeatmap
              results={results}
              techniques={techniques}
              tactics={tactics}
            />
          )}
        </TabsContent>

        {/* Heatmap Tab */}
        <TabsContent value="heatmap">
          {isLoading ? (
            <SuccessRateHeatmapSkeleton />
          ) : (
            <SuccessRateHeatmap
              results={results}
              techniques={techniques}
              tactics={tactics}
            />
          )}
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends">
          <div className="p-12 border-2 border-dashed border-gray-200 rounded-lg text-center">
            <TrendingUp className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Trend Analysis
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Time-series analysis showing how performance evolves across simulations.
              Coming soon!
            </p>
          </div>
        </TabsContent>

        {/* Detailed Results Tab */}
        <TabsContent value="detailed">
          <div className="p-12 border-2 border-dashed border-gray-200 rounded-lg text-center">
            <Table className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Detailed Results Table
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Sortable, filterable table with all simulation results and conversation logs.
              Coming soon!
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* No Results State */}
      {!isLoading && results.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 h-4" />
          <AlertDescription>
            No simulation results found for this negotiation.
            Start a simulation to see analytics.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
