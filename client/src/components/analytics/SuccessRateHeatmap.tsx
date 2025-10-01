/**
 * Success Rate Heatmap Component
 * Visualizes technique x tactic performance matrix
 * Clean, testable component following separation of concerns
 */

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { buildHeatmapMatrix, getHeatmapColor, calculateSuccessRate } from '@/lib/analytics-utils';
import type { SimulationResult } from '@/lib/types/analytics';

interface SuccessRateHeatmapProps {
  results: SimulationResult[];
  techniques: Array<{ id: string; name: string }>;
  tactics: Array<{ id: string; name: string }>;
  title?: string;
  description?: string;
}

/**
 * Heatmap Cell Component - Following SRP
 */
interface HeatmapCellProps {
  value: number;
  techniqueName: string;
  tacticName: string;
  count: number;
}

function HeatmapCell({ value, techniqueName, tacticName, count }: HeatmapCellProps) {
  const bgColor = getHeatmapColor(value);
  const textColor = value > 50 ? 'text-white' : 'text-gray-900';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`
              relative flex items-center justify-center
              min-w-16 h-16 border border-gray-200
              cursor-pointer transition-transform hover:scale-105
              ${textColor}
            `}
            style={{ backgroundColor: bgColor }}
          >
            <div className="text-center">
              <div className="font-semibold text-sm">
                {value.toFixed(0)}%
              </div>
              {count > 0 && (
                <div className="text-xs opacity-75">
                  n={count}
                </div>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <div className="font-semibold mb-1">
              {techniqueName} + {tacticName}
            </div>
            <div>Success Rate: {value.toFixed(1)}%</div>
            <div className="text-gray-400">Based on {count} simulation{count !== 1 ? 's' : ''}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Heatmap Legend Component
 */
function HeatmapLegend() {
  const gradientStops = [0, 25, 50, 75, 100];

  return (
    <div className="flex items-center justify-center mt-4 gap-2">
      <span className="text-xs text-gray-600">Low</span>
      <div className="flex gap-1">
        {gradientStops.map((value) => (
          <div
            key={value}
            className="w-8 h-6 border border-gray-300 flex items-center justify-center text-xs"
            style={{ backgroundColor: getHeatmapColor(value) }}
          >
            <span className={value > 50 ? 'text-white' : 'text-gray-900'}>
              {value}
            </span>
          </div>
        ))}
      </div>
      <span className="text-xs text-gray-600">High</span>
    </div>
  );
}

/**
 * Success Rate Heatmap - Main Component
 * Pure presentation component with business logic extracted to utilities
 */
export function SuccessRateHeatmap({
  results,
  techniques,
  tactics,
  title = 'Success Rate Heatmap',
  description = 'Technique × Tactic performance matrix'
}: SuccessRateHeatmapProps) {
  // Memoized matrix calculation for performance
  const matrixData = useMemo(() => {
    // Build heatmap matrix using pure utility function
    const matrix = buildHeatmapMatrix(
      results,
      'tacticId',
      'techniqueId',
      (groupedResults) => calculateSuccessRate(groupedResults)
    );

    // Get counts for each cell
    const counts = buildHeatmapMatrix(
      results,
      'tacticId',
      'techniqueId',
      (groupedResults) => groupedResults.length
    );

    // Map IDs to names
    const techniqueMap = new Map(techniques.map(t => [t.id, t.name]));
    const tacticMap = new Map(tactics.map(t => [t.id, t.name]));

    return {
      xLabels: matrix.xLabels.map(id => tacticMap.get(id) || id),
      yLabels: matrix.yLabels.map(id => techniqueMap.get(id) || id),
      values: matrix.values,
      counts: counts.values,
      techniqueIds: matrix.yLabels,
      tacticIds: matrix.xLabels
    };
  }, [results, techniques, tactics]);

  // Handle empty state
  if (results.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-gray-400">
            <div className="text-center">
              <p className="text-lg mb-2">No data available</p>
              <p className="text-sm">Run simulations to see performance heatmap</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Heatmap Table */}
            <div className="flex">
              {/* Y-axis labels (Techniques) */}
              <div className="flex flex-col">
                {/* Empty corner cell */}
                <div className="w-32 h-12 border-b border-gray-200" />

                {/* Technique labels */}
                {matrixData.yLabels.map((label, i) => (
                  <div
                    key={i}
                    className="w-32 h-16 flex items-center justify-end pr-3 text-sm font-medium text-gray-700"
                  >
                    <span className="truncate" title={label}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Heatmap grid */}
              <div className="flex-1">
                {/* X-axis labels (Tactics) */}
                <div className="flex">
                  {matrixData.xLabels.map((label, i) => (
                    <div
                      key={i}
                      className="min-w-16 h-12 flex items-end justify-center pb-2"
                    >
                      <span
                        className="text-xs font-medium text-gray-700 transform -rotate-45 origin-bottom-left"
                        style={{ width: '4rem', textAlign: 'left' }}
                        title={label}
                      >
                        {label.length > 12 ? label.substring(0, 12) + '...' : label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Heatmap cells */}
                {matrixData.values.map((row, rowIndex) => (
                  <div key={rowIndex} className="flex">
                    {row.map((value, colIndex) => (
                      <HeatmapCell
                        key={`${rowIndex}-${colIndex}`}
                        value={value}
                        techniqueName={matrixData.yLabels[rowIndex]}
                        tacticName={matrixData.xLabels[colIndex]}
                        count={matrixData.counts[rowIndex][colIndex]}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <HeatmapLegend />
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <div className="text-gray-600">Techniques</div>
              <div className="font-semibold text-lg">{matrixData.yLabels.length}</div>
            </div>
            <div>
              <div className="text-gray-600">Tactics</div>
              <div className="font-semibold text-lg">{matrixData.xLabels.length}</div>
            </div>
            <div>
              <div className="text-gray-600">Combinations</div>
              <div className="font-semibold text-lg">
                {matrixData.yLabels.length * matrixData.xLabels.length}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton for heatmap
 */
export function SuccessRateHeatmapSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-64 bg-gray-200 rounded animate-pulse mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-2">
              {[...Array(5)].map((_, j) => (
                <div key={j} className="w-16 h-16 bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
