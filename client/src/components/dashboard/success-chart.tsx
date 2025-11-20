import React, { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface SuccessChartProps {
  data: Array<{
    date: string;
    successRate: number;
  }>;
}

export default function SuccessChart({ data }: SuccessChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState("30D");

  const chartData = useMemo(
    () =>
      data.map((item) => ({
        name: format(parseISO(item.date), "dd.MM.", { locale: de }),
        rate: Number(item.successRate.toFixed(1)),
        date: item.date,
      })),
    [data],
  );

  const filteredData = useMemo(() => {
    const periodLength =
      selectedPeriod === "7D" ? 7 : selectedPeriod === "90D" ? 90 : 30;
    return chartData.slice(-periodLength);
  }, [chartData, selectedPeriod]);

  const formatTooltip = (value: number) => [`${value.toFixed(1)}%`, "Erfolgsquote"];

  return (
    <Card>
      <CardHeader className="border-b border-gray-200">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">Erfolgsquote (Trend)</CardTitle>
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
        {filteredData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="name" 
                axisLine={false}
                tickLine={false}
                className="text-xs"
              />
              <YAxis 
                domain={[0, 100]}
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
              <p>Keine Trenddaten vorhanden</p>
              <p className="text-sm">Schließe Simulationen ab, um Verlaufskurven zu sehen.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
