import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Play, 
  Square, 
  RotateCcw, 
  Download, 
  TestTube, 
  CheckCircle, 
  XCircle, 
  Clock,
  Beaker,
  Target,
  Zap
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TestScenario {
  id: string;
  name: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  results?: {
    totalRuns: number;
    successfulRuns: number;
    averageScore: number;
    averageDuration: number;
    totalCost: number;
  };
}

export default function TestingSuite() {
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [testConfig, setTestConfig] = useState({
    iterations: 10,
    timeout: 300, // 5 minutes
    parallelRuns: 3,
    enableDetailedLogging: true,
  });
  const { toast } = useToast();

  // Mock test scenarios - in real app this would come from API
  const [testScenarios, setTestScenarios] = useState<TestScenario[]>([
    {
      id: "scenario-1",
      name: "High-Volume Product Negotiation",
      description: "Test agents negotiating bulk product purchases with varying volume requirements",
      status: "pending",
      progress: 0,
    },
    {
      id: "scenario-2",
      name: "Price-Sensitive Service Agreement",
      description: "Focus on price negotiations with tight margin constraints",
      status: "pending",
      progress: 0,
    },
    {
      id: "scenario-3",
      name: "Multi-Parameter Complex Deal",
      description: "Test complex negotiations involving price, volume, payment terms, and duration",
      status: "completed",
      progress: 100,
      results: {
        totalRuns: 10,
        successfulRuns: 8,
        averageScore: 84.6,
        averageDuration: 4.2,
        totalCost: 12.45,
      },
    },
    {
      id: "scenario-4",
      name: "Personality Clash Simulation",
      description: "Test negotiations between agents with conflicting personality traits",
      status: "pending",
      progress: 0,
    },
    {
      id: "scenario-5",
      name: "Time-Constrained Negotiations",
      description: "Simulate negotiations with aggressive deadlines and time pressure",
      status: "failed",
      progress: 60,
      results: {
        totalRuns: 6,
        successfulRuns: 2,
        averageScore: 45.3,
        averageDuration: 8.1,
        totalCost: 18.67,
      },
    },
  ]);

  const { data: agents } = useQuery({
    queryKey: ["/api/agents"],
  });

  const { data: contexts } = useQuery({
    queryKey: ["/api/contexts"],
  });

  const runTestsMutation = useMutation({
    mutationFn: async (config: any) => {
      // Simulate test execution
      return new Promise((resolve) => {
        setTimeout(() => resolve({ success: true }), 2000);
      });
    },
    onSuccess: () => {
      toast({
        title: "Tests Started",
        description: "Test scenarios are now running. You'll be notified when they complete.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start test scenarios. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-gray-500" />;
      case "running":
        return <Play className="w-4 h-4 text-blue-500" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <TestTube className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "gray";
      case "running":
        return "blue";
      case "completed":
        return "green";
      case "failed":
        return "red";
      default:
        return "gray";
    }
  };

  const handleScenarioToggle = (scenarioId: string) => {
    setSelectedScenarios(prev => 
      prev.includes(scenarioId) 
        ? prev.filter(id => id !== scenarioId)
        : [...prev, scenarioId]
    );
  };

  const handleRunTests = () => {
    if (selectedScenarios.length === 0) {
      toast({
        title: "No Scenarios Selected",
        description: "Please select at least one test scenario to run.",
        variant: "destructive",
      });
      return;
    }

    runTestsMutation.mutate({
      scenarios: selectedScenarios,
      config: testConfig,
    });

    // Simulate updating scenario status
    setTestScenarios(prev => 
      prev.map(scenario => 
        selectedScenarios.includes(scenario.id)
          ? { ...scenario, status: "running" as const, progress: 0 }
          : scenario
      )
    );
  };

  const formatDuration = (minutes: number) => {
    return `${minutes.toFixed(1)}m`;
  };

  const calculateOverallStats = () => {
    const completedScenarios = testScenarios.filter(s => s.status === "completed" && s.results);
    if (completedScenarios.length === 0) {
      return { successRate: 0, averageScore: 0, totalCost: 0, totalRuns: 0 };
    }

    const totalRuns = completedScenarios.reduce((sum, s) => sum + (s.results?.totalRuns || 0), 0);
    const successfulRuns = completedScenarios.reduce((sum, s) => sum + (s.results?.successfulRuns || 0), 0);
    const totalScore = completedScenarios.reduce((sum, s) => sum + ((s.results?.averageScore || 0) * (s.results?.totalRuns || 0)), 0);
    const totalCost = completedScenarios.reduce((sum, s) => sum + (s.results?.totalCost || 0), 0);

    return {
      successRate: totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0,
      averageScore: totalRuns > 0 ? totalScore / totalRuns : 0,
      totalCost,
      totalRuns,
    };
  };

  const overallStats = calculateOverallStats();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Testing Suite</h1>
          <p className="text-gray-600 mt-1">Multi-scenario testing and validation for AI negotiations</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Results
          </Button>
          <Button 
            onClick={handleRunTests}
            disabled={runTestsMutation.isPending || selectedScenarios.length === 0}
          >
            <Play className="w-4 h-4 mr-2" />
            Run Selected Tests
          </Button>
        </div>
      </div>

      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Beaker className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Runs</p>
                <p className="text-xl font-bold text-gray-900">{overallStats.totalRuns}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Target className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Success Rate</p>
                <p className="text-xl font-bold text-gray-900">{overallStats.successRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Avg Score</p>
                <p className="text-xl font-bold text-gray-900">{overallStats.averageScore.toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Zap className="w-8 h-8 text-yellow-600" />
              <div>
                <p className="text-sm text-gray-600">Total Cost</p>
                <p className="text-xl font-bold text-gray-900">${overallStats.totalCost.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Test Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Test Configuration</CardTitle>
            <CardDescription>Configure test parameters and execution settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="iterations">Iterations per Scenario</Label>
              <Input
                id="iterations"
                type="number"
                value={testConfig.iterations}
                onChange={(e) => setTestConfig(prev => ({ ...prev, iterations: parseInt(e.target.value) || 10 }))}
                min="1"
                max="100"
              />
            </div>

            <div>
              <Label htmlFor="timeout">Timeout (seconds)</Label>
              <Input
                id="timeout"
                type="number"
                value={testConfig.timeout}
                onChange={(e) => setTestConfig(prev => ({ ...prev, timeout: parseInt(e.target.value) || 300 }))}
                min="60"
                max="1800"
              />
            </div>

            <div>
              <Label htmlFor="parallel">Parallel Runs</Label>
              <Select 
                value={testConfig.parallelRuns.toString()} 
                onValueChange={(value) => setTestConfig(prev => ({ ...prev, parallelRuns: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 (Sequential)</SelectItem>
                  <SelectItem value="2">2 Parallel</SelectItem>
                  <SelectItem value="3">3 Parallel</SelectItem>
                  <SelectItem value="5">5 Parallel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="logging"
                checked={testConfig.enableDetailedLogging}
                onCheckedChange={(checked) => 
                  setTestConfig(prev => ({ ...prev, enableDetailedLogging: checked as boolean }))
                }
              />
              <Label htmlFor="logging" className="text-sm">Enable detailed logging</Label>
            </div>

            <Button variant="outline" className="w-full">
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset to Defaults
            </Button>
          </CardContent>
        </Card>

        {/* Test Scenarios */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Test Scenarios</CardTitle>
            <CardDescription>
              Select and manage test scenarios for comprehensive validation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {testScenarios.map((scenario) => (
                <div key={scenario.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        checked={selectedScenarios.includes(scenario.id)}
                        onCheckedChange={() => handleScenarioToggle(scenario.id)}
                        disabled={scenario.status === "running"}
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          {getStatusIcon(scenario.status)}
                          <h4 className="font-medium text-gray-900">{scenario.name}</h4>
                          <Badge variant={getStatusColor(scenario.status) as any}>
                            {scenario.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{scenario.description}</p>
                        
                        {scenario.status === "running" && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-gray-600">Progress</span>
                              <span className="text-sm font-medium">{scenario.progress}%</span>
                            </div>
                            <Progress value={scenario.progress} className="h-2" />
                          </div>
                        )}

                        {scenario.results && (
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Success Rate:</span>
                              <span className="font-medium ml-1">
                                {((scenario.results.successfulRuns / scenario.results.totalRuns) * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">Avg Score:</span>
                              <span className="font-medium ml-1">{scenario.results.averageScore.toFixed(1)}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Duration:</span>
                              <span className="font-medium ml-1">{formatDuration(scenario.results.averageDuration)}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Cost:</span>
                              <span className="font-medium ml-1">${scenario.results.totalCost.toFixed(2)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {selectedScenarios.length} of {testScenarios.length} scenarios selected
              </p>
              <div className="space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedScenarios(testScenarios.map(s => s.id))}
                >
                  Select All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedScenarios([])}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
