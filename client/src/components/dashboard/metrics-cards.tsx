import { Card, CardContent } from "@/components/ui/card";
import { HandMetal, CheckCircle, Clock, DollarSign, TrendingUp, TrendingDown } from "lucide-react";

interface MetricsCardsProps {
  metrics: {
    activeNegotiations: number;
    successRate: number;
    avgDuration: number;
    apiCostToday: number;
    recentTrend: {
      activeNegotiationsChange: number;
      successRateChange: number;
      avgDurationChange: number;
      apiCostChange: number;
    };
  };
}

export default function MetricsCards({ metrics }: MetricsCardsProps) {
  const formatChange = (change: number, suffix: string = "%") => {
    const isPositive = change > 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const color = isPositive ? "text-green-600" : "text-red-600";
    
    return (
      <div className={`flex items-center text-sm ${color}`}>
        <Icon className="w-4 h-4 mr-1" />
        <span className="font-medium">{isPositive ? "+" : ""}{change}{suffix}</span>
        <span className="text-gray-500 ml-1">from last period</span>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      {/* Active Negotiations Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Negotiations</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{metrics.activeNegotiations}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <HandMetal className="text-blue-600 text-xl" />
            </div>
          </div>
          <div className="mt-4">
            {formatChange(metrics.recentTrend.activeNegotiationsChange)}
          </div>
        </CardContent>
      </Card>

      {/* Success Rate Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Success Rate</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{metrics.successRate.toFixed(1)}%</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="text-green-600 text-xl" />
            </div>
          </div>
          <div className="mt-4">
            {formatChange(metrics.recentTrend.successRateChange)}
          </div>
        </CardContent>
      </Card>

      {/* Average Duration Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Duration</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{metrics.avgDuration.toFixed(1)}m</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="text-yellow-600 text-xl" />
            </div>
          </div>
          <div className="mt-4">
            {formatChange(metrics.recentTrend.avgDurationChange, "s")}
          </div>
        </CardContent>
      </Card>

      {/* API Cost Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">API Cost Today</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">${metrics.apiCostToday.toFixed(2)}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-purple-600 text-xl" />
            </div>
          </div>
          <div className="mt-4">
            {formatChange(metrics.recentTrend.apiCostChange)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
