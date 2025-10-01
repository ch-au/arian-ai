import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Download, 
  FileText, 
  Calendar as CalendarIcon, 
  Filter,
  BarChart3,
  TrendingUp,
  Users,
  Zap,
  Eye,
  Share2
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Report {
  id: string;
  name: string;
  type: "performance" | "analytics" | "financial" | "summary";
  description: string;
  lastGenerated: string;
  size: string;
  status: "ready" | "generating" | "error";
}

export default function Reports() {
  const [selectedDateRange, setSelectedDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date(),
  });
  
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [selectedReportTypes, setSelectedReportTypes] = useState<string[]>(["performance"]);
  const [customReportName, setCustomReportName] = useState("");

  // Mock reports data
  const [availableReports] = useState<Report[]>([
    {
      id: "perf-001",
      name: "Monthly Performance Summary",
      type: "performance",
      description: "Comprehensive performance analysis for all agents over the past month",
      lastGenerated: "2024-01-15T10:30:00Z",
      size: "2.4 MB",
      status: "ready",
    },
    {
      id: "anal-001",
      name: "Negotiation Analytics Deep Dive",
      type: "analytics",
      description: "Detailed analytics including ZOPA analysis, tactic effectiveness, and trends",
      lastGenerated: "2024-01-14T16:45:00Z",
      size: "5.1 MB",
      status: "ready",
    },
    {
      id: "fin-001",
      name: "API Cost Analysis",
      type: "financial",
      description: "Financial breakdown of API usage, costs, and optimization opportunities",
      lastGenerated: "2024-01-15T09:15:00Z",
      size: "1.8 MB",
      status: "ready",
    },
    {
      id: "sum-001",
      name: "Executive Summary Dashboard",
      type: "summary",
      description: "High-level overview with key metrics and recommendations",
      lastGenerated: "2024-01-15T11:00:00Z",
      size: "850 KB",
      status: "ready",
    },
  ]);

  const { data: agents } = useQuery<any[]>({
    queryKey: ["/api/agents"],
  });

  const reportTypes = [
    { id: "performance", name: "Performance Analysis", icon: TrendingUp, description: "Agent and negotiation performance metrics" },
    { id: "analytics", name: "Advanced Analytics", icon: BarChart3, description: "Deep insights and trend analysis" },
    { id: "financial", name: "Financial Report", icon: Zap, description: "API costs and usage optimization" },
    { id: "summary", name: "Executive Summary", icon: FileText, description: "High-level overview for stakeholders" },
  ];

  const getReportTypeIcon = (type: string) => {
    const reportType = reportTypes.find(rt => rt.id === type);
    const Icon = reportType?.icon || FileText;
    return <Icon className="w-4 h-4" />;
  };

  const getReportTypeColor = (type: string) => {
    switch (type) {
      case "performance": return "bg-blue-100 text-blue-700";
      case "analytics": return "bg-purple-100 text-purple-700";
      case "financial": return "bg-green-100 text-green-700";
      case "summary": return "bg-orange-100 text-orange-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return <Badge variant="default" className="bg-green-100 text-green-700">Ready</Badge>;
      case "generating":
        return <Badge variant="secondary">Generating...</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const handleAgentToggle = (agentId: string) => {
    setSelectedAgents(prev => 
      prev.includes(agentId)
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  const handleReportTypeToggle = (typeId: string) => {
    setSelectedReportTypes(prev => 
      prev.includes(typeId)
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId]
    );
  };

  const generateCustomReport = () => {
    console.log("Generating custom report with:", {
      name: customReportName,
      dateRange: selectedDateRange,
      agents: selectedAgents,
      types: selectedReportTypes,
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">Export and analyze negotiation reports and analytics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Filter className="w-5 h-5" />
              <span>Custom Report Generator</span>
            </CardTitle>
            <CardDescription>Configure and generate custom reports</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Report Name */}
            <div>
              <Label htmlFor="reportName">Report Name</Label>
              <Input
                id="reportName"
                value={customReportName}
                onChange={(e) => setCustomReportName(e.target.value)}
                placeholder="Enter custom report name"
              />
            </div>

            {/* Date Range */}
            <div>
              <Label>Date Range</Label>
              <div className="grid grid-cols-2 gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !selectedDateRange.from && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDateRange.from ? (
                        format(selectedDateRange.from, "LLL dd, y")
                      ) : (
                        <span>Start date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDateRange.from}
                      onSelect={(date) => setSelectedDateRange(prev => ({ ...prev, from: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !selectedDateRange.to && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDateRange.to ? (
                        format(selectedDateRange.to, "LLL dd, y")
                      ) : (
                        <span>End date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDateRange.to}
                      onSelect={(date) => setSelectedDateRange(prev => ({ ...prev, to: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Report Types */}
            <div>
              <Label>Report Types</Label>
              <div className="space-y-3 mt-2">
                {reportTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <div key={type.id} className="flex items-start space-x-3">
                      <Checkbox
                        checked={selectedReportTypes.includes(type.id)}
                        onCheckedChange={() => handleReportTypeToggle(type.id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <Icon className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-medium">{type.name}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{type.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Agent Selection */}
            <div>
              <Label>Agents (Optional)</Label>
              <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                {agents?.map((agent: any) => (
                  <div key={agent.id} className="flex items-center space-x-2">
                    <Checkbox
                      checked={selectedAgents.includes(agent.id)}
                      onCheckedChange={() => handleAgentToggle(agent.id)}
                    />
                    <span className="text-sm">{agent.name}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to include all agents
              </p>
            </div>

            <Button 
              className="w-full" 
              onClick={generateCustomReport}
              disabled={selectedReportTypes.length === 0 || !customReportName}
            >
              <Download className="w-4 h-4 mr-2" />
              Generate Report
            </Button>
          </CardContent>
        </Card>

        {/* Available Reports */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Available Reports</span>
            </CardTitle>
            <CardDescription>Pre-generated reports ready for download</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {availableReports.map((report) => (
                <div key={report.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getReportTypeColor(report.type)}`}>
                        {getReportTypeIcon(report.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-gray-900">{report.name}</h4>
                          {getStatusBadge(report.status)}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{report.description}</p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>Size: {report.size}</span>
                          <span>Generated: {format(new Date(report.lastGenerated), "MMM dd, yyyy 'at' h:mm a")}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Share2 className="w-4 h-4" />
                      </Button>
                      <Button size="sm" disabled={report.status !== "ready"}>
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-3">Quick Reports</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Last 7 Days Summary
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Monthly Performance
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Cost Analysis
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Agent Comparison
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Templates */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Report Templates</CardTitle>
          <CardDescription>Pre-configured report templates for common use cases</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors">
              <div className="flex items-center space-x-3 mb-3">
                <Users className="w-8 h-8 text-blue-600" />
                <div>
                  <h4 className="font-medium">Agent Performance Review</h4>
                  <p className="text-sm text-gray-500">Individual agent analysis</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full">
                Use Template
              </Button>
            </div>

            <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors">
              <div className="flex items-center space-x-3 mb-3">
                <BarChart3 className="w-8 h-8 text-purple-600" />
                <div>
                  <h4 className="font-medium">Market Analysis</h4>
                  <p className="text-sm text-gray-500">ZOPA and trend insights</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full">
                Use Template
              </Button>
            </div>

            <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors">
              <div className="flex items-center space-x-3 mb-3">
                <Zap className="w-8 h-8 text-green-600" />
                <div>
                  <h4 className="font-medium">Cost Optimization</h4>
                  <p className="text-sm text-gray-500">API usage and savings</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full">
                Use Template
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
