import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useState } from "react";

interface SuccessChartProps {
  data: Array<{
    date: string;
    successRate: number;
  }>;
}

export default function SuccessChart({ data }: SuccessChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState("30D");

  // Transform data for the chart
  const chartData = data.map((item, index) => ({
    name: `Week ${index + 1}`,
    rate: item.successRate,
    date: item.date,
  }));

  const formatTooltip = (value: any, name: any, props: any) => {
    if (name === "rate") {
      return [`${value.toFixed(1)}%`, "Success Rate"];
    }
    return [value, name];
  };

  return (
    <Card>
      <CardHeader className="border-b border-gray-200">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">Success Rate Trends</CardTitle>
          <div className="flex items-center space-x-2">
            {["7D", "30D", "90D"].map((period) => (
              <Button
                key={period}
                variant={selectedPeriod === period ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedPeriod(period)}
                className="text-xs"
              >
                {period}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="name" 
                axisLine={false}
                tickLine={false}
                className="text-xs"
              />
              <YAxis 
                domain={[80, 100]}
                axisLine={false}
                tickLine={false}
                className="text-xs"
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip 
                formatter={formatTooltip}
                labelStyle={{ color: '#374151' }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="rate" 
                stroke="hsl(207, 90%, 54%)" 
                strokeWidth={3}
                dot={{ fill: "hsl(207, 90%, 54%)", strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, stroke: "hsl(207, 90%, 54%)", strokeWidth: 2, fill: "white" }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-48 text-gray-500">
            <div className="text-center">
              <p>No trend data available</p>
              <p className="text-sm">Complete some negotiations to see trends</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
