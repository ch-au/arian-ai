import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useState } from "react";
import { TrendingUp, TrendingDown, Users, Clock, DollarSign, Target } from "lucide-react";

export default function Analytics() {
  const [selectedPeriod, setSelectedPeriod] = useState("30");
  const [selectedAgent, setSelectedAgent] = useState("all");

  const { data: performanceReport } = useQuery<any>({
    queryKey: ["/api/analytics/performance", { agentId: selectedAgent !== "all" ? selectedAgent : undefined }],
  });

  const { data: agents } = useQuery<any[]>({
    queryKey: ["/api/agents"],
  });

  const { data: tactics } = useQuery<any[]>({
    queryKey: ["/api/tactics"],
  });

  // Mock analytics data for visualization
  const mockTacticPerformance = [
    { name: "Collaborative", success: 95, usage: 45, cost: 12.50 },
    { name: "Competitive", success: 88, usage: 35, cost: 15.20 },
    { name: "Anchoring", success: 82, usage: 28, cost: 10.80 },
    { name: "Rapport Building", success: 91, usage: 32, cost: 14.60 },
    { name: "Deadline Pressure", success: 76, usage: 22, cost: 18.90 },
    { name: "Information Gathering", success: 89, usage: 38, cost: 11.30 },
  ];

  const mockPersonalityEffectiveness = [
    { trait: "High Agreeableness", value: 94, color: "#22c55e" },
    { trait: "High Conscientiousness", value: 91, color: "#3b82f6" },
    { trait: "High Openness", value: 87, color: "#a855f7" },
    { trait: "High Extraversion", value: 83, color: "#f59e0b" },
    { trait: "Low Neuroticism", value: 89, color: "#ef4444" },
  ];

  const mockNegotiationOutcomes = [
    { name: "Successful", value: 68, color: "#22c55e" },
    { name: "Partial Success", value: 24, color: "#f59e0b" },
    { name: "Failed", value: 8, color: "#ef4444" },
  ];

  const formatChange = (value: number, isPositive?: boolean) => {
    const Icon = isPositive !== false && value > 0 ? TrendingUp : TrendingDown;
    const colorClass = isPositive !== false && value > 0 ? "text-green-600" : "text-red-600";
    
    return (
      <div className={`flex items-center ${colorClass}`}>
        <Icon className="w-4 h-4 mr-1" />
        <span className="text-sm font-medium">
          {value > 0 ? "+" : ""}{value}%
        </span>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Advanced Analytics</h1>
          <p className="text-gray-600 mt-1">Deep insights into negotiation performance and optimization opportunities</p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agents?.map((agent: any) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 Days</SelectItem>
              <SelectItem value="30">30 Days</SelectItem>
              <SelectItem value="90">90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Negotiations</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">284</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <div className="mt-3">
              {formatChange(12)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Success Score</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">87.3</p>
              </div>
              <Target className="w-8 h-8 text-green-600" />
            </div>
            <div className="mt-3">
              {formatChange(5.2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Duration</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">4.2m</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
            <div className="mt-3">
              {formatChange(-8.1)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total API Cost</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">$142.67</p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-600" />
            </div>
            <div className="mt-3">
              {formatChange(-15.3)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Tactic Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Tactic Performance Analysis</CardTitle>
            <CardDescription>Success rates and usage patterns by negotiation tactic</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mockTacticPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'success' ? `${value}%` : 
                    name === 'usage' ? `${value} uses` : 
                    `$${value}`,
                    name === 'success' ? 'Success Rate' :
                    name === 'usage' ? 'Usage Count' :
                    'Avg Cost'
                  ]}
                />
                <Bar dataKey="success" fill="#3b82f6" name="success" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Negotiation Outcomes */}
        <Card>
          <CardHeader>
            <CardTitle>Negotiation Outcomes</CardTitle>
            <CardDescription>Distribution of negotiation results</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={mockNegotiationOutcomes}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {mockNegotiationOutcomes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value}%`, "Percentage"]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Personality Effectiveness & Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Personality Effectiveness */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Personality Trait Effectiveness</CardTitle>
            <CardDescription>Success rates by dominant personality traits (Big 5)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockPersonalityEffectiveness.map((trait) => (
                <div key={trait.trait} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: trait.color }}
                    ></div>
                    <span className="text-sm font-medium">{trait.trait}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-24 h-2 bg-gray-200 rounded-full">
                      <div 
                        className="h-2 rounded-full" 
                        style={{ 
                          width: `${trait.value}%`, 
                          backgroundColor: trait.color 
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold w-12">{trait.value}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle>AI Recommendations</CardTitle>
            <CardDescription>Optimization suggestions based on data analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="flex items-start space-x-2">
                  <Badge variant="default" className="text-xs mt-0.5">High Impact</Badge>
                  <div>
                    <p className="text-sm font-medium text-blue-900">Increase Collaborative Tactics</p>
                    <p className="text-xs text-blue-700 mt-1">
                      Collaborative tactics show 95% success rate. Consider training more agents with high agreeableness.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-green-50 rounded-lg">
                <div className="flex items-start space-x-2">
                  <Badge variant="secondary" className="text-xs mt-0.5">Cost Saving</Badge>
                  <div>
                    <p className="text-sm font-medium text-green-900">Optimize API Usage</p>
                    <p className="text-xs text-green-700 mt-1">
                      Information gathering tactics use fewer tokens while maintaining 89% success rate.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-start space-x-2">
                  <Badge variant="outline" className="text-xs mt-0.5">Performance</Badge>
                  <div>
                    <p className="text-sm font-medium text-yellow-900">Review Deadline Pressure</p>
                    <p className="text-xs text-yellow-700 mt-1">
                      Lowest success rate (76%) and highest cost. Consider alternative approaches.
                    </p>
                  </div>
                </div>
              </div>

              <Button variant="outline" size="sm" className="w-full mt-4">
                Generate Detailed Report
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
