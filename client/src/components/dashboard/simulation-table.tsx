/**
 * Advanced Simulation Results Table
 * Enhanced filtering, sorting, export, and bulk actions
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { 
  Search,
  Filter,
  Download,
  SortAsc,
  SortDesc,
  RefreshCw,
  Play,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  MoreHorizontal,
  FileText,
  BarChart3,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimulationResult {
  id: string;
  runNumber: number;
  status: string;
  techniqueId: string;
  tacticId: string;
  totalRounds?: number;
  actualCost?: number;
  startedAt?: string;
  completedAt?: string;
  conversationLog?: any[];
  dimensionResults?: any;
  outcome?: string;
}

interface FilterOptions {
  searchTerm: string;
  statusFilter: string;
  techniqueFilter: string;
  tacticFilter: string;
  outcomeFilter: string;
  costRange: { min: number; max: number };
  roundsRange: { min: number; max: number };
  dateRange: { start: string; end: string };
}

interface SortConfig {
  key: keyof SimulationResult;
  direction: 'asc' | 'desc';
}

interface SimulationTableProps {
  simulationResults: SimulationResult[];
  techniques: any[];
  tactics: any[];
  onViewConversation: (result: SimulationResult) => void;
  onRerunSimulation?: (result: SimulationResult) => void;
  onDeleteSimulation?: (result: SimulationResult) => void;
}

// Export formats
const exportFormats = [
  { key: 'csv', label: 'CSV File', icon: FileText },
  { key: 'json', label: 'JSON Data', icon: FileText },
  { key: 'pdf', label: 'PDF Report', icon: FileText },
  { key: 'analytics', label: 'Analytics Summary', icon: BarChart3 }
];

// Status icons and colors
const getStatusConfig = (status: string) => {
  const configs = {
    completed: { icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
    running: { icon: Activity, color: 'text-blue-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
    failed: { icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
    pending: { icon: Clock, color: 'text-gray-400', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' },
  };
  return configs[status as keyof typeof configs] || configs.pending;
};

// Helper functions
const formatDealValue = (dimensionResults: any): string => {
  if (!dimensionResults) return '-';
  try {
    const parsed = typeof dimensionResults === 'string' ? JSON.parse(dimensionResults) : dimensionResults;
    if (!parsed || Object.keys(parsed).length === 0) return '-';
    
    
    // Format all available dimensions with compact notation
    const dimensions = [];
    if (parsed.Price) dimensions.push(`$${parsed.Price.toLocaleString()}`);
    if (parsed.Volume) dimensions.push(`Vol:${parsed.Volume.toLocaleString()}`);
    if (parsed.Contract_Duration) dimensions.push(`${parsed.Contract_Duration}mo`);
    if (parsed.Payment_Terms) dimensions.push(`Pay:${parsed.Payment_Terms}d`);
    
    return dimensions.length > 0 ? dimensions.join(' • ') : '-';
  } catch (error) {
    return '-';
  }
};

const formatDuration = (startedAt?: string, completedAt?: string): string => {
  if (!startedAt || !completedAt) return '-';
  const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const seconds = Math.floor(duration / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
};

// Export functionality
const exportData = (data: SimulationResult[], format: string, techniques: any[], tactics: any[]) => {
  const enhancedData = data.map(result => ({
    ...result,
    techniqueName: techniques.find(t => t.id === result.techniqueId)?.name || 'Unknown',
    tacticName: tactics.find(t => t.id === result.tacticId)?.name || 'Unknown',
    dealValue: formatDealValue(result.dimensionResults),
    duration: formatDuration(result.startedAt, result.completedAt)
  }));

  switch (format) {
    case 'csv':
      const csvHeaders = ['Run #', 'Technique', 'Tactic', 'Status', 'Rounds', 'Deal Value', 'Cost', 'Duration'];
      const csvRows = enhancedData.map(r => [
        r.runNumber, r.techniqueName, r.tacticName, r.status, 
        r.totalRounds || 0, r.dealValue, `$${r.actualCost || 0}`, r.duration
      ]);
      const csvContent = [csvHeaders, ...csvRows].map(row => row.join(',')).join('\n');
      downloadFile(csvContent, 'simulation-results.csv', 'text/csv');
      break;
      
    case 'json':
      downloadFile(JSON.stringify(enhancedData, null, 2), 'simulation-results.json', 'application/json');
      break;
      
    case 'pdf':
      // PDF generation would require a library like jsPDF
      alert('PDF export functionality would be implemented with jsPDF library');
      break;
      
    case 'analytics':
      const analytics = generateAnalyticsSummary(enhancedData);
      downloadFile(JSON.stringify(analytics, null, 2), 'simulation-analytics.json', 'application/json');
      break;
  }
};

const downloadFile = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const generateAnalyticsSummary = (data: SimulationResult[]) => {
  const completed = data.filter(r => r.status === 'completed');
  const total = data.length;
  
  return {
    summary: {
      totalRuns: total,
      completedRuns: completed.length,
      successRate: (completed.length / total * 100).toFixed(1) + '%',
      avgRounds: completed.length > 0 ? (completed.reduce((sum, r) => sum + (r.totalRounds || 0), 0) / completed.length).toFixed(1) : '0',
      totalCost: `$${data.reduce((sum, r) => sum + (r.actualCost || 0), 0).toFixed(2)}`
    },
    byStrategy: data.reduce((acc, result) => {
      const key = `${result.techniqueId}-${result.tacticId}`;
      if (!acc[key]) {
        acc[key] = { runs: 0, completed: 0, totalCost: 0 };
      }
      acc[key].runs++;
      if (result.status === 'completed') acc[key].completed++;
      acc[key].totalCost += result.actualCost || 0;
      return acc;
    }, {} as any)
  };
};

export const SimulationResultsTable: React.FC<SimulationTableProps> = ({
  simulationResults,
  techniques,
  tactics,
  onViewConversation,
  onRerunSimulation,
  onDeleteSimulation
}) => {
  const [selectedResults, setSelectedResults] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({
    searchTerm: '',
    statusFilter: 'all',
    techniqueFilter: 'all',
    tacticFilter: 'all',
    outcomeFilter: 'all',
    costRange: { min: 0, max: 100 },
    roundsRange: { min: 1, max: 10 },
    dateRange: { start: '', end: '' }
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'runNumber', direction: 'desc' });
  const [showFilters, setShowFilters] = useState(false);

  // Helper functions for component
  const getTechniqueName = (techniqueId: string) => 
    techniques.find(t => t.id === techniqueId)?.name || techniqueId.slice(0, 8);
  
  const getTacticName = (tacticId: string) => 
    tactics.find(t => t.id === tacticId)?.name || tacticId.slice(0, 8);

  // Filter and sort logic
  const filteredAndSortedResults = useMemo(() => {
    let filtered = simulationResults.filter(result => {
      // Search term filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const techniqueName = getTechniqueName(result.techniqueId).toLowerCase();
        const tacticName = getTacticName(result.tacticId).toLowerCase();
        if (
          !techniqueName.includes(searchLower) && 
          !tacticName.includes(searchLower) &&
          !result.runNumber.toString().includes(searchLower)
        ) return false;
      }

      // Status filter
      if (filters.statusFilter !== 'all' && result.status !== filters.statusFilter) return false;

      // Technique filter
      if (filters.techniqueFilter !== 'all' && result.techniqueId !== filters.techniqueFilter) return false;

      // Tactic filter
      if (filters.tacticFilter !== 'all' && result.tacticId !== filters.tacticFilter) return false;

      // Outcome filter
      if (filters.outcomeFilter !== 'all' && result.outcome !== filters.outcomeFilter) return false;

      // Cost range filter
      const cost = result.actualCost || 0;
      if (cost < filters.costRange.min || cost > filters.costRange.max) return false;

      // Rounds range filter
      const rounds = result.totalRounds || 0;
      if (rounds < filters.roundsRange.min || rounds > filters.roundsRange.max) return false;

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      return sortConfig.direction === 'asc' 
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return filtered;
  }, [simulationResults, filters, sortConfig, techniques, tactics]);

  // Handle sorting
  const handleSort = (key: keyof SimulationResult) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Handle selection
  const toggleSelectAll = () => {
    setSelectedResults(
      selectedResults.length === filteredAndSortedResults.length 
        ? [] 
        : filteredAndSortedResults.map(r => r.id)
    );
  };

  const toggleSelectResult = (id: string) => {
    setSelectedResults(prev => 
      prev.includes(id) 
        ? prev.filter(selectedId => selectedId !== id)
        : [...prev, id]
    );
  };

  // Bulk actions
  const handleBulkAction = async (action: string) => {
    const selectedResultsData = filteredAndSortedResults.filter(r => selectedResults.includes(r.id));
    
    switch (action) {
      case 'rerun':
        if (onRerunSimulation) {
          for (const result of selectedResultsData) {
            await onRerunSimulation(result);
          }
        }
        break;
      case 'delete':
        if (onDeleteSimulation) {
          for (const result of selectedResultsData) {
            await onDeleteSimulation(result);
          }
        }
        break;
      case 'export-selected':
        exportData(selectedResultsData, 'json', techniques, tactics);
        break;
    }
    setSelectedResults([]);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Simulation Results ({filteredAndSortedResults.length})
            </CardTitle>
            <CardDescription>
              Advanced filtering, sorting, and analysis of negotiation simulations
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              {showFilters ? 'Hide' : 'Show'} Filters
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {exportFormats.map(format => (
                  <DropdownMenuItem
                    key={format.key}
                    onClick={() => exportData(filteredAndSortedResults, format.key, techniques, tactics)}
                  >
                    <format.icon className="h-4 w-4 mr-2" />
                    {format.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters Panel */}
        {showFilters && (
          <div className="p-4 bg-gray-50 rounded-lg border space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Search</label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search techniques, tactics..."
                    value={filters.searchTerm}
                    onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Status</label>
                <Select
                  value={filters.statusFilter}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, statusFilter: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="running">Running</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Technique Filter */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Technique</label>
                <Select
                  value={filters.techniqueFilter}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, techniqueFilter: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Techniques</SelectItem>
                    {techniques.map(technique => (
                      <SelectItem key={technique.id} value={technique.id}>
                        {technique.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tactic Filter */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Tactic</label>
                <Select
                  value={filters.tacticFilter}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, tacticFilter: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tactics</SelectItem>
                    {tactics.map(tactic => (
                      <SelectItem key={tactic.id} value={tactic.id}>
                        {tactic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Outcome Filter */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Outcome</label>
                <Select
                  value={filters.outcomeFilter}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, outcomeFilter: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Outcomes</SelectItem>
                    <SelectItem value="DEAL_ACCEPTED">Deal Accepted</SelectItem>
                    <SelectItem value="TERMINATED">Terminated</SelectItem>
                    <SelectItem value="WALK_AWAY">Walk Away</SelectItem>
                    <SelectItem value="PAUSED">Paused</SelectItem>
                    <SelectItem value="MAX_ROUNDS_REACHED">Max Rounds</SelectItem>
                    <SelectItem value="ERROR">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Actions */}
        {selectedResults.length > 0 && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-sm font-medium text-blue-800">
              {selectedResults.length} selected
            </span>
            <div className="flex gap-2 ml-auto">
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('rerun')}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Re-run
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('export-selected')}>
                <Download className="h-4 w-4 mr-1" />
                Export Selected
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('delete')}>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        )}

        {/* Results Table */}
        <div className="border rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-8 gap-4 p-4 bg-gray-50 border-b font-medium text-sm">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedResults.length === filteredAndSortedResults.length && filteredAndSortedResults.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <button
                onClick={() => handleSort('runNumber')}
                className="flex items-center gap-1 hover:text-blue-600"
              >
                #
                {sortConfig.key === 'runNumber' && (
                  sortConfig.direction === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                )}
              </button>
            </div>
            <div>
              <button
                onClick={() => handleSort('techniqueId')}
                className="flex items-center gap-1 hover:text-blue-600"
              >
                Technique
                {sortConfig.key === 'techniqueId' && (
                  sortConfig.direction === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                )}
              </button>
            </div>
            <div>
              <button
                onClick={() => handleSort('tacticId')}
                className="flex items-center gap-1 hover:text-blue-600"
              >
                Tactic
                {sortConfig.key === 'tacticId' && (
                  sortConfig.direction === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                )}
              </button>
            </div>
            <div>
              <button
                onClick={() => handleSort('status')}
                className="flex items-center gap-1 hover:text-blue-600"
              >
                Status
                {sortConfig.key === 'status' && (
                  sortConfig.direction === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                )}
              </button>
            </div>
            <div>Result</div>
            <div>
              <button
                onClick={() => handleSort('totalRounds')}
                className="flex items-center gap-1 hover:text-blue-600"
              >
                Rounds
                {sortConfig.key === 'totalRounds' && (
                  sortConfig.direction === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                )}
              </button>
            </div>
            <div>
              <button
                onClick={() => handleSort('actualCost')}
                className="flex items-center gap-1 hover:text-blue-600"
              >
                Cost
                {sortConfig.key === 'actualCost' && (
                  sortConfig.direction === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                )}
              </button>
            </div>
            <div>Actions</div>
          </div>

          {/* Results */}
          {filteredAndSortedResults.map(result => {
            const statusConfig = getStatusConfig(result.status);
            return (
              <div
                key={result.id}
                className={cn(
                  "grid grid-cols-8 gap-4 p-4 border-b text-sm hover:bg-gray-50 transition-colors",
                  selectedResults.includes(result.id) && "bg-blue-50"
                )}
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedResults.includes(result.id)}
                    onCheckedChange={() => toggleSelectResult(result.id)}
                  />
                  <span className="font-mono font-semibold">{result.runNumber}</span>
                </div>
                <div className="min-w-0" title={getTechniqueName(result.techniqueId)}>
                  <span className="truncate block">{getTechniqueName(result.techniqueId)}</span>
                </div>
                <div className="min-w-0" title={getTacticName(result.tacticId)}>
                  <span className="truncate block">{getTacticName(result.tacticId)}</span>
                </div>
                <div>
                  <Badge
                    variant={
                      result.status === 'completed' ? 'default' :
                      result.status === 'running' ? 'secondary' :
                      result.status === 'failed' ? 'destructive' : 'outline'
                    }
                    className="text-xs"
                    title={result.outcome ? `Outcome: ${result.outcome}` : undefined}
                  >
                    <statusConfig.icon className="h-3 w-3 mr-1" />
                    {result.outcome || result.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="font-medium text-sm">
                  {result.outcome ? (
                    <div className={cn(
                      "font-semibold",
                      result.outcome === 'DEAL' ? "text-green-600" :
                      result.outcome === 'WALK_AWAY' ? "text-orange-600" :
                      result.outcome === 'TIMEOUT' ? "text-yellow-600" :
                      "text-gray-600"
                    )}>
                      <div>{result.outcome}</div>
                      {result.dimensionResults && (
                        <div className="text-xs text-gray-500 mt-1">{formatDealValue(result.dimensionResults)}</div>
                      )}
                    </div>
                  ) : result.status === 'completed' ? (
                    <span className="text-green-600">Completed</span>
                  ) : result.status === 'failed' ? (
                    <span className="text-red-600">Failed</span>
                  ) : result.status === 'running' ? (
                    <span className="text-blue-600">Running</span>
                  ) : (
                    <span className="text-gray-500">Pending</span>
                  )}
                </div>
                <div>{result.totalRounds || '-'}</div>
                <div className="font-mono">{result.actualCost ? `$${result.actualCost}` : '-'}</div>
                <div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(result.status === 'completed' || result.status === 'failed' || result.conversationLog) && (
                        <DropdownMenuItem onClick={() => onViewConversation(result)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Conversation
                        </DropdownMenuItem>
                      )}
                      {onRerunSimulation && (
                        <DropdownMenuItem onClick={() => onRerunSimulation(result)}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Re-run Simulation
                        </DropdownMenuItem>
                      )}
                      {onDeleteSimulation && (
                        <DropdownMenuItem onClick={() => onDeleteSimulation(result)} className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}

          {filteredAndSortedResults.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No results found</p>
              <p className="text-sm">Try adjusting your filters or run some simulations</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};