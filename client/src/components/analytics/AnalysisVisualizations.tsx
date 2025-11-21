import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AnalysisVisualizationsProps {
  runs: Array<{
    dealValue: number;
    otherDimensions: Record<string, any>;
    dimensionResults?: Array<{
      dimensionName: string;
      finalValue: string | number;
    }>;
    productResults?: Array<{
      productName: string;
      agreedPrice: string | number;
    }>;
    status: string;
  }>;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

export function AnalysisVisualizations({ runs }: AnalysisVisualizationsProps) {
  // Filter for valid completed runs
  const validRuns = runs.filter(
    (run) => run.status === "completed" && run.dealValue > 0
  );

  if (validRuns.length === 0) {
    return null;
  }

  // --- Deal Value Histogram Logic ---
  const dealValues = validRuns.map((r) => r.dealValue);
  const minDeal = Math.min(...dealValues);
  const maxDeal = Math.max(...dealValues);
  
  // Create bins (e.g., 5 bins or fewer if fewer data points)
  const binCount = Math.min(10, Math.max(5, Math.floor(validRuns.length / 2)));
  const range = maxDeal - minDeal;
  // Avoid division by zero if all values are same
  const binSize = range === 0 ? 1000 : range / binCount; 

  const histogramData = Array.from({ length: binCount + (range === 0 ? 1 : 0) }, (_, i) => {
    const start = minDeal + i * binSize;
    const end = start + binSize;
    const count = validRuns.filter(
      (r) => r.dealValue >= start && (range === 0 ? true : r.dealValue < end || (i === binCount - 1 && r.dealValue <= end))
    ).length;

    return {
      range: `${new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(start)}`,
      count,
      fullRange: `${new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(start)} - ${new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(end)}`
    };
  }).filter(d => d.count > 0); // Optional: filter empty bins or keep them for scale

  // --- Dimension Histograms Logic ---
  // Infer dimensions from dimensionResults (preferred) or otherDimensions
  const dimensionNames = Array.from(new Set(
    validRuns.flatMap(r => 
      r.dimensionResults?.map(d => d.dimensionName) ?? Object.keys(r.otherDimensions || {})
    )
  ));

  // Infer product metrics from productResults
  const productNames = Array.from(new Set(
    validRuns.flatMap(r => 
      r.productResults?.map(p => p.productName) ?? []
    )
  ));

  // Combine all metrics to visualize
  const allMetrics = [
    ...dimensionNames.map(name => ({ type: 'dimension' as const, name })),
    ...productNames.map(name => ({ type: 'product' as const, name }))
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Main Deal Value Histogram */}
      <Card>
        <CardHeader>
          <CardTitle>Verteilung der Verhandlungsergebnisse</CardTitle>
          <CardDescription>Häufigkeit der erreichten Deal Values</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="range" 
                  tick={{ fontSize: 12 }} 
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis allowDecimals={false} />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-2 border rounded shadow-sm text-sm">
                          <p className="font-semibold">{payload[0].payload.fullRange}</p>
                          <p>Anzahl: {payload[0].value}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]}>
                   {histogramData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Mini Histograms for Dimensions & Products */}
      <Card>
        <CardHeader>
          <CardTitle>Ergebnisse je Dimension</CardTitle>
          <CardDescription>Übersicht der erreichten Werte pro Verhandlungsdimension</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[250px] overflow-y-auto pr-2">
            {allMetrics.map((metric) => {
              const metricName = metric.name;
              const displayName = metric.type === 'product' ? `${metricName} (Preis)` : metricName;

              // Extract values for this metric
              const values = validRuns.map(r => {
                if (metric.type === 'product') {
                  const prodResult = r.productResults?.find(p => p.productName === metricName);
                  if (prodResult) {
                    const val = Number(prodResult.agreedPrice);
                    return isNaN(val) ? null : val;
                  }
                  return null;
                } else {
                  // Try dimensionResults first
                  const dimResult = r.dimensionResults?.find(d => d.dimensionName === metricName);
                  if (dimResult) {
                    const val = Number(dimResult.finalValue);
                    return isNaN(val) ? null : val;
                  }
                  // Fallback to otherDimensions
                  const otherVal = r.otherDimensions?.[metricName];
                  return typeof otherVal === 'number' ? otherVal : (otherVal ? Number(otherVal) : null);
                }
              }).filter((v): v is number => v !== null);

              if (values.length === 0) return null;

              const min = Math.min(...values);
              const max = Math.max(...values);
              const dimRange = max - min;
              const dimBinCount = 5;
              const dimBinSize = dimRange === 0 ? 1 : dimRange / dimBinCount;

              const dimData = Array.from({ length: dimBinCount + (dimRange === 0 ? 1 : 0) }, (_, i) => {
                const start = min + i * dimBinSize;
                const end = start + dimBinSize;
                const count = values.filter(v => v >= start && (dimRange === 0 ? true : v < end || (i === dimBinCount - 1 && v <= end))).length;
                return {
                  name: Math.round(start),
                  count
                };
              });

              return (
                <div key={`${metric.type}-${metricName}`} className="border rounded p-2">
                  <h4 className="text-sm font-medium mb-1 text-center text-muted-foreground truncate" title={displayName}>{displayName}</h4>
                  <div className="h-[80px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dimData}>
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} hide />
                        <Tooltip 
                           content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white p-1 border rounded shadow-sm text-xs">
                                  <p>Wert ~ {payload[0].payload.name}</p>
                                  <p>Anzahl: {payload[0].value}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="count" fill="#6366f1" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
             {allMetrics.length === 0 && (
              <div className="col-span-2 text-center text-muted-foreground py-8">
                Keine Dimensionsdaten verfügbar
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
