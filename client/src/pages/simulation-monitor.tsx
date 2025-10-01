/**
 * Improved Simulation Monitor - Better Status Display and Controls
 * Addresses issues with incorrect status display and confusing button configuration
 */

import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useWebSocket } from '@/hooks/use-websocket';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Play, 
  Pause, 
  Square, 
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  Timer,
  MessageCircle,
  Eye,
  BarChart3,
  PlayCircle,
  StopCircle,
  PauseCircle,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QueueStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  totalSimulations: number;
  completedCount: number;
  failedCount: number;
  estimatedTimeRemaining: number;
  currentSimulation?: any;
  progressPercentage: number;
  actualCost: number;
  estimatedCost: number;
}

interface SimulationResult {
  id: string;
  runNumber: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  techniqueId: string;
  tacticId: string;
  totalRounds?: number;
  actualCost?: number;
  startedAt?: string;
  completedAt?: string;
  conversationLog?: any[];
  dimensionResults?: any;
}

interface NegotiationOverview {
  completed: SimulationResult[];
  running: SimulationResult[];
  outstanding: SimulationResult[];
  failed: SimulationResult[];
  timeout: SimulationResult[];
}

export default function ImprovedSimulationMonitor() {
  const { negotiationId } = useParams<{ negotiationId: string }>();
  const [, setLocation] = useLocation();
  
  // State management
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [simulationResults, setSimulationResults] = useState<SimulationResult[]>([]);
  const [negotiationDetails, setNegotiationDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<SimulationResult | null>(null);
  const [conversationModalOpen, setConversationModalOpen] = useState(false);
  const [techniques, setTechniques] = useState<any[]>([]);
  const [tactics, setTactics] = useState<any[]>([]);
  const [realTimeUpdates, setRealTimeUpdates] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<string>('');
  const [buttonLoading, setButtonLoading] = useState<{
    executeNext: boolean;
    executeAll: boolean;
    pause: boolean;
    resume: boolean;
    stop: boolean;
    createQueue: boolean;
    startQueue: boolean;
    restartFailed: boolean;
  }>({
    executeNext: false,
    executeAll: false,
    pause: false,
    resume: false,
    stop: false,
    createQueue: false,
    startQueue: false,
    restartFailed: false
  });

  // Calculate actual overview from simulation results
  const negotiationOverview: NegotiationOverview = React.useMemo(() => {
    const overview = {
      completed: simulationResults.filter(r => r.status === 'completed'),
      running: simulationResults.filter(r => r.status === 'running'),
      outstanding: simulationResults.filter(r => r.status === 'pending'),
      failed: simulationResults.filter(r => r.status === 'failed'),
      timeout: simulationResults.filter(r => r.status === 'timeout')
    };
    return overview;
  }, [simulationResults]);

  // WebSocket connection for real-time updates
  const { isConnected } = useWebSocket('/ws', {
    onMessage: (data) => {
      if (data.negotiationId === negotiationId) {
        switch (data.type) {
          case 'simulation_started':
            setCurrentActivity(`🚀 Started: Run #${data.data?.runNumber || '?'} (${getTechniqueName(data.data?.techniqueId)} + ${getTacticName(data.data?.tacticId)})`);
            if (queueStatus?.id) {
              fetchQueueStatus(queueStatus.id);
              fetchResults(queueStatus.id);
            }
            break;
          case 'simulation_completed':
            setCurrentActivity(`✅ Completed: Run #${data.data?.runNumber || '?'}`);
            if (queueStatus?.id) {
                fetchQueueStatus(queueStatus.id);
                fetchResults(queueStatus.id);
            }
            break;
          case 'simulation_failed':
          setCurrentActivity(`❌ Failed: Run #${data.data?.runNumber || '?'}`);
            if (queueStatus?.id) {
                fetchQueueStatus(queueStatus.id);
                fetchResults(queueStatus.id);
            }
            break;
        case 'simulation_stopped':
          setCurrentActivity(`🛑 Stopped: Run #${data.data?.runNumber || '?'}`);
            if (queueStatus?.id) {
              fetchQueueStatus(queueStatus.id);
            fetchResults(queueStatus.id);
            }
            break;
        case 'negotiation_round':
          setCurrentActivity(`💬 Round ${data.data?.round || '?'}: ${data.data?.agent || '?'} speaking...`);
          break;
        case 'queue_progress':
          case 'queue_completed':
            if (queueStatus?.id) {
                fetchQueueStatus(queueStatus.id);
                fetchResults(queueStatus.id);
            }
            break;
        }
      }
    },
    onOpen: () => setRealTimeUpdates(true),
    onClose: () => setRealTimeUpdates(false),
    onError: () => setRealTimeUpdates(false)
  });

  // Fetch queue status
  const fetchQueueStatus = async (queueId: string) => {
    try {
      const response = await fetch(`/api/simulations/queue/${queueId}/status`);
      const data = await response.json();

      if (data.success) {
        setQueueStatus(data.data);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch queue status');
      }
    } catch (err: any) {
      console.error('Error fetching queue status:', err);
        setError('Network error - check connection');
    }
  };

  // Fetch simulation results
  const fetchResults = async (queueId: string) => {
    try {
      const response = await fetch(`/api/simulations/queue/${queueId}/results`);
      const data = await response.json();

      if (data.success) {
        setSimulationResults(data.data);
      }
    } catch (err: any) {
      console.error('Error fetching results:', err);
    }
  };

  // Load reference data and negotiation details
  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const [techniquesRes, tacticsRes, negotiationRes] = await Promise.all([
          fetch('/api/techniques'),
          fetch('/api/tactics'),
          negotiationId ? fetch(`/api/negotiations/${negotiationId}`) : Promise.resolve(null)
        ]);
        
        if (techniquesRes.ok) {
          const techniquesData = await techniquesRes.json();
          setTechniques(techniquesData);
        }
        
        if (tacticsRes.ok) {
          const tacticsData = await tacticsRes.json();
          setTactics(tacticsData);
        }

        if (negotiationRes && negotiationRes.ok) {
          const negotiationData = await negotiationRes.json();
          setNegotiationDetails(negotiationData);
        }
      } catch (error) {
        console.error('Failed to load reference data:', error);
      }
    };
    
    loadReferenceData();
  }, [negotiationId]);

  // Initialize: find queue for negotiation and load data
  useEffect(() => {
    const initialize = async () => {
      if (!negotiationId) return;

      setLoading(true);
      
      try {
        // Find queue for this negotiation
        const queueResponse = await fetch(`/api/simulations/queue/by-negotiation/${negotiationId}`);
        
        if (queueResponse.ok) {
          const queueData = await queueResponse.json();
          if (queueData.success && queueData.queueId) {
            await fetchQueueStatus(queueData.queueId);
            await fetchResults(queueData.queueId);
          } else {
            setQueueStatus(null);
          }
        }
      } catch (error) {
        console.error('Error initializing simulation monitor:', error);
      }
      
      setLoading(false);
    };

    initialize();
  }, [negotiationId]);

  // Polling for updates
  useEffect(() => {
    if (!queueStatus?.id) return;

    const interval = setInterval(() => {
      if (queueStatus.status === 'running' || queueStatus.status === 'pending' || !realTimeUpdates) {
        fetchQueueStatus(queueStatus.id);
        fetchResults(queueStatus.id);
      }
    }, realTimeUpdates ? 10000 : 3000);

    return () => clearInterval(interval);
  }, [queueStatus?.id, queueStatus?.status, realTimeUpdates]);

  // Helper function for API requests
  const makeApiRequest = async (url: string, options: RequestInit = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  // Control functions
  const handleExecuteNext = async () => {
    if (!queueStatus?.id || buttonLoading.executeNext) return;

    setButtonLoading(prev => ({ ...prev, executeNext: true }));
    try {
      const data = await makeApiRequest(`/api/simulations/queue/${queueStatus.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'next' })
      });
      if (data.success) {
        await fetchQueueStatus(queueStatus.id);
          setError(null);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
        setError(`Failed to start next simulation: ${err.message || 'Unknown error'}`);
    } finally {
      setButtonLoading(prev => ({ ...prev, executeNext: false }));
    }
  };

  const handleExecuteAll = async () => {
    if (!queueStatus?.id || buttonLoading.executeAll) return;

    setButtonLoading(prev => ({ ...prev, executeAll: true }));
    try {
      const data = await makeApiRequest(`/api/simulations/queue/${queueStatus.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'all' })
      });

      if (data.success) {
        await fetchQueueStatus(queueStatus.id);
        setError(null);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
        setError(`Failed to start all simulations: ${err.message || 'Unknown error'}`);
    } finally {
      setButtonLoading(prev => ({ ...prev, executeAll: false }));
    }
  };

  const handlePause = async () => {
    if (!queueStatus?.id || buttonLoading.pause) return;

    setButtonLoading(prev => ({ ...prev, pause: true }));
    try {
      await makeApiRequest(`/api/simulations/queue/${queueStatus.id}/pause`, {
        method: 'POST'
      });

      await fetchQueueStatus(queueStatus.id);
      setError(null);
    } catch (err: any) {
        setError(`Failed to pause queue: ${err.message || 'Unknown error'}`);
    } finally {
      setButtonLoading(prev => ({ ...prev, pause: false }));
    }
  };

  const handleResume = async () => {
    if (!queueStatus?.id || buttonLoading.resume) return;

    setButtonLoading(prev => ({ ...prev, resume: true }));
    try {
      await makeApiRequest(`/api/simulations/queue/${queueStatus.id}/resume`, {
        method: 'POST'
      });

      await fetchQueueStatus(queueStatus.id);
      setError(null);
    } catch (err: any) {
        setError(`Failed to resume queue: ${err.message || 'Unknown error'}`);
    } finally {
      setButtonLoading(prev => ({ ...prev, resume: false }));
    }
  };

  const handleStop = async () => {
    if (!queueStatus?.id || buttonLoading.stop) return;

    setButtonLoading(prev => ({ ...prev, stop: true }));
    try {
      await makeApiRequest(`/api/simulations/queue/${queueStatus.id}/stop`, {
        method: 'POST'
      });

      await fetchQueueStatus(queueStatus.id);
      setError(null);
    } catch (err: any) {
        setError(`Failed to stop queue: ${err.message || 'Unknown error'}`);
    } finally {
      setButtonLoading(prev => ({ ...prev, stop: false }));
    }
  };

  const handleCreateNewQueue = async () => {
    if (!negotiationId || buttonLoading.createQueue) return;

    setButtonLoading(prev => ({ ...prev, createQueue: true }));
    try {
      const data = await makeApiRequest(`/api/negotiations/${negotiationId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (data.queueId) {
        setQueueStatus(null);
        await fetchQueueStatus(data.queueId);
        await fetchResults(data.queueId);
        setError(null);
      } else {
        setError(data.error || 'Failed to create new queue');
      }
    } catch (err: any) {
        setError(`Failed to create new simulation queue: ${err.message || 'Unknown error'}`);
    } finally {
      setButtonLoading(prev => ({ ...prev, createQueue: false }));
    }
  };

  const handleStartQueue = async () => {
    if (!queueStatus?.id || buttonLoading.startQueue) return;

    setButtonLoading(prev => ({ ...prev, startQueue: true }));
    try {
      const data = await makeApiRequest(`/api/simulations/queue/${queueStatus.id}/start`, {
        method: 'POST'
      });

      if (data.success) {
        await fetchQueueStatus(queueStatus.id);
        await fetchResults(queueStatus.id);
        setError(null);
      } else {
        setError(data.error || 'Failed to start queue');
      }
    } catch (err: any) {
      setError(`Failed to start queue: ${err.message || 'Unknown error'}`);
    } finally {
      setButtonLoading(prev => ({ ...prev, startQueue: false }));
    }
  };

  const handleRestartFailed = async () => {
    if (!queueStatus?.id || buttonLoading.restartFailed) return;

    setButtonLoading(prev => ({ ...prev, restartFailed: true }));
    try {
      const data = await makeApiRequest(`/api/simulations/queue/${queueStatus.id}/restart-failed`, {
        method: 'POST'
      });

      if (data.success) {
        await fetchQueueStatus(queueStatus.id);
        await fetchResults(queueStatus.id);
        setError(null);
        setCurrentActivity(`🔄 Restarted ${data.restartedCount} failed simulations`);
      } else {
        setError(data.error || 'Failed to restart failed simulations');
      }
    } catch (err: any) {
      setError(`Failed to restart failed simulations: ${err.message || 'Unknown error'}`);
    } finally {
      setButtonLoading(prev => ({ ...prev, restartFailed: false }));
    }
  };

  // Helper functions
  const getTechniqueName = (techniqueId: string) => {
    const technique = techniques.find(t => t.id === techniqueId);
    return technique?.name || techniqueId.slice(0, 8);
  };

  const getTacticName = (tacticId: string) => {
    const tactic = tactics.find(t => t.id === tacticId);
    return tactic?.name || tacticId.slice(0, 8);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      pending: { color: 'bg-gray-500', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
      running: { color: 'bg-blue-500', icon: <Activity className="w-3 h-3" />, label: 'Running' },
      completed: { color: 'bg-green-500', icon: <CheckCircle className="w-3 h-3" />, label: 'Completed' },
      failed: { color: 'bg-red-500', icon: <XCircle className="w-3 h-3" />, label: 'Failed' },
      timeout: { color: 'bg-orange-500', icon: <Timer className="w-3 h-3" />, label: 'Timeout' },
      paused: { color: 'bg-yellow-500', icon: <Pause className="w-3 h-3" />, label: 'Paused' }
    };

    const variant = variants[status] || variants.pending;
    
    return (
      <Badge className={cn('text-white', variant.color)}>
        {variant.icon}
        <span className="ml-1">{variant.label}</span>
      </Badge>
    );
  };

  const formatDealValue = (dimensionResults: any) => {
    if (!dimensionResults || typeof dimensionResults === 'string') {
      try {
        const parsed = typeof dimensionResults === 'string' ? JSON.parse(dimensionResults) : dimensionResults;
        return parsed?.Preis ? `€${parsed.Preis}` : '-';
      } catch {
        return '-';
      }
    }
    return dimensionResults?.Preis ? `€${dimensionResults.Preis}` : '-';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <span className="ml-2">Loading simulation monitor...</span>
        </div>
      </div>
    );
  }

  // No queue found
  if (!queueStatus && !loading) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>No Simulation Queue Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              No simulation queue exists for this negotiation. You need to configure simulations first.
            </p>
            <Button onClick={() => setLocation(`/configure/${negotiationId}`)}>
              Configure Simulations
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasOutstandingWork = negotiationOverview.outstanding.length > 0 || negotiationOverview.running.length > 0;
  const allCompleted = negotiationOverview.completed.length + negotiationOverview.failed.length + negotiationOverview.timeout.length === queueStatus?.totalSimulations;

  return (
    <div className="p-6 space-y-6">
      {/* Enhanced Header Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 mb-2">
                <Activity className="h-5 w-5 text-blue-600" />
                {negotiationDetails?.title || 'Simulation Monitor'}
              </CardTitle>
              <CardDescription className="space-y-1">
                <div className="flex items-center gap-4 text-sm">
                  <span>ID: {negotiationId?.slice(0, 8)}</span>
                  {negotiationDetails && (
                    <>
                      <span>•</span>
                      <span>Type: {negotiationDetails.negotiationType}</span>
                      <span>•</span>
                      <span>Relationship: {negotiationDetails.relationshipType}</span>
                      <span>•</span>
                      <span>Role: {negotiationDetails.userRole?.toUpperCase()}</span>
                    </>
                  )}
            </div>
                {negotiationDetails?.productMarketDescription && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {negotiationDetails.productMarketDescription}
                  </div>
                )}
              </CardDescription>
                  </div>
            <div className="flex flex-col items-end gap-2">
              {queueStatus && getStatusBadge(queueStatus.status)}
                  <div className="flex items-center gap-1 text-xs">
                    <div className={`w-2 h-2 rounded-full ${realTimeUpdates ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-muted-foreground">
                      {realTimeUpdates ? 'Real-time' : 'Polling'}
                    </span>
                  </div>
                </div>
            </div>

          {/* Current Activity Banner */}
          {(negotiationOverview.running.length > 0 || currentActivity) && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-blue-800">Current Activity</span>
          </div>
              </div>
              <div className="mt-1 text-sm text-blue-700">
                {currentActivity || (negotiationOverview.running.length > 0 
                  ? `${negotiationOverview.running.length} simulation(s) running...` 
                  : 'Monitoring for activity...')}
              </div>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="space-y-6">
          {queueStatus && (
            <>
              {/* Progress Section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span>Progress: {negotiationOverview.completed.length + negotiationOverview.failed.length + negotiationOverview.timeout.length}/{queueStatus.totalSimulations} simulations</span>
                  <span className="text-muted-foreground">
                    Cost: €{queueStatus.actualCost.toFixed(2)} / €{queueStatus.estimatedCost.toFixed(2)}
                  </span>
                </div>
                <Progress 
                  value={((negotiationOverview.completed.length + negotiationOverview.failed.length + negotiationOverview.timeout.length) / queueStatus.totalSimulations) * 100} 
                  className="h-3" 
                          />
                        </div>

              {/* Control Buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => {
                    if (queueStatus?.id) {
                      fetchQueueStatus(queueStatus.id);
                      fetchResults(queueStatus.id);
                    }
                  }}
                  size="sm"
                  variant="outline"
                  disabled={!queueStatus?.id}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh
                </Button>

                {queueStatus.status === 'running' && (
                    <Button 
                    onClick={handlePause} 
                      size="sm"
                    variant="outline"
                    disabled={buttonLoading.pause}
                    >
                    {buttonLoading.pause ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                      <PauseCircle className="h-4 w-4 mr-2" />
                      )}
                    {buttonLoading.pause ? 'Pausing...' : 'Pause'}
                    </Button>
                )}

                {queueStatus.status === 'paused' && (
                    <Button 
                    onClick={handleResume} 
                      size="sm" 
                      variant="outline"
                    disabled={buttonLoading.resume}
                    >
                    {buttonLoading.resume ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                      <PlayCircle className="h-4 w-4 mr-2" />
                      )}
                    {buttonLoading.resume ? 'Resuming...' : 'Resume'}
                    </Button>
                )}

                <Button 
                  onClick={handleStop} 
                  size="sm" 
                  variant="destructive"
                  disabled={buttonLoading.stop}
                >
                  {buttonLoading.stop ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <StopCircle className="h-4 w-4 mr-2" />
                  )}
                  {buttonLoading.stop ? 'Stopping...' : 'Stop'}
                </Button>

                {allCompleted && negotiationOverview.failed.length === 0 && negotiationOverview.timeout.length === 0 && (
                  <Button 
                    onClick={handleCreateNewQueue}
                    size="sm"
                    variant="ghost"
                    disabled={buttonLoading.createQueue}
                    className="text-xs text-muted-foreground"
                  >
                    {buttonLoading.createQueue ? (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Advanced: New Queue
                      </>
                    )}
                  </Button>
                )}
              </div>
            </>
          )}
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Running Simulations Section */}
      {negotiationOverview.running.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Activity className="h-5 w-5 animate-pulse" />
              Currently Running ({negotiationOverview.running.length})
            </CardTitle>
            <CardDescription>
              Active simulations in progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {negotiationOverview.running.map((simulation) => (
                <div key={simulation.id} className="flex items-center justify-between p-3 bg-white border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <div>
                      <div className="font-medium">Run #{simulation.runNumber}</div>
                      <div className="text-sm text-muted-foreground">
                        {getTechniqueName(simulation.techniqueId)} + {getTacticName(simulation.tacticId)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">Round {simulation.totalRounds || 0}</div>
                    <div className="text-xs text-muted-foreground">
                      {simulation.startedAt ? `Started ${new Date(simulation.startedAt).toLocaleTimeString()}` : 'Just started'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue Management Section */}
      {(negotiationOverview.outstanding.length > 0 || (negotiationOverview.failed.length + negotiationOverview.timeout.length > 0)) && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <PlayCircle className="h-5 w-5" />
              Queue Management
            </CardTitle>
            <CardDescription>
              Start, restart, or manage simulation execution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Primary Actions */}
              <div className="flex gap-3 flex-wrap">
                {negotiationOverview.outstanding.length > 0 && (
                  <>
                  <Button 
                      onClick={handleStartQueue}
                      disabled={buttonLoading.startQueue || queueStatus?.status === 'running'}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {buttonLoading.startQueue ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        <PlayCircle className="h-4 w-4 mr-2" />
                    )}
                      {buttonLoading.startQueue ? 'Starting...' : `Start Queue (${negotiationOverview.outstanding.length} pending)`}
                  </Button>
                    
                  <Button 
                      onClick={handleExecuteNext}
                    variant="outline"
                      disabled={buttonLoading.executeNext || queueStatus?.status === 'running'}
                      className="border-green-600 text-green-700 hover:bg-green-50"
                  >
                      {buttonLoading.executeNext ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        <Play className="h-4 w-4 mr-2" />
                    )}
                      {buttonLoading.executeNext ? 'Starting...' : 'Start Next Only'}
                  </Button>
                  </>
                )}
                
                {(negotiationOverview.failed.length + negotiationOverview.timeout.length > 0) && (
                <Button 
                    onClick={handleRestartFailed}
                    variant="outline"
                    disabled={buttonLoading.restartFailed}
                    className="border-orange-600 text-orange-700 hover:bg-orange-50"
                  >
                    {buttonLoading.restartFailed ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                      <RotateCcw className="h-4 w-4 mr-2" />
                  )}
                    {buttonLoading.restartFailed ? 'Restarting...' : `Restart ${negotiationOverview.failed.length + negotiationOverview.timeout.length} Failed`}
                </Button>
                )}
              </div>
              
              {/* Status Information */}
              <div className="text-sm text-muted-foreground space-y-1">
                {negotiationOverview.outstanding.length > 0 && (
                  <div>
                    📋 <strong>{negotiationOverview.outstanding.length} simulations</strong> ready to start
                  </div>
                )}
                {(negotiationOverview.failed.length + negotiationOverview.timeout.length > 0) && (
                  <div>
                    🔄 <strong>{negotiationOverview.failed.length + negotiationOverview.timeout.length} simulations</strong> can be restarted ({negotiationOverview.failed.length} failed, {negotiationOverview.timeout.length} timeout)
                  </div>
                )}
                {negotiationOverview.outstanding.length > 0 && (
                  <div className="mt-2">
                    <strong>Next up:</strong> {negotiationOverview.outstanding.slice(0, 3).map((sim, idx) => (
                      <span key={sim.id}>
                        Run #{sim.runNumber} ({getTechniqueName(sim.techniqueId)} + {getTacticName(sim.tacticId)})
                        {idx < Math.min(2, negotiationOverview.outstanding.length - 1) && ', '}
                      </span>
                    ))}
                    {negotiationOverview.outstanding.length > 3 && ` and ${negotiationOverview.outstanding.length - 3} more...`}
                  </div>
                )}
              </div>
            </div>
        </CardContent>
      </Card>
      )}

      {/* Negotiation Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Negotiation Overview
          </CardTitle>
          <CardDescription>
            Status breakdown of all simulation runs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{negotiationOverview.completed.length}</div>
                  <div className="text-sm text-muted-foreground">✅ Completed</div>
                </div>
                <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{negotiationOverview.running.length}</div>
              <div className="text-sm text-muted-foreground">🔄 Running</div>
                </div>
                <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{negotiationOverview.outstanding.length}</div>
              <div className="text-sm text-muted-foreground">⏳ Outstanding</div>
                </div>
                <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{negotiationOverview.failed.length}</div>
                  <div className="text-sm text-muted-foreground">❌ Failed</div>
                </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{negotiationOverview.timeout.length}</div>
              <div className="text-sm text-muted-foreground">⏱️ Timeout</div>
              </div>
              </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Simulation Results</CardTitle>
          <CardDescription>
            Detailed results for all simulation runs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run #</TableHead>
                  <TableHead>Technique</TableHead>
                  <TableHead>Tactic</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rounds</TableHead>
                  <TableHead>Deal Value</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {simulationResults.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell className="font-mono font-semibold">
                      {result.runNumber}
                    </TableCell>
                    <TableCell className="max-w-32 truncate" title={getTechniqueName(result.techniqueId)}>
                      {getTechniqueName(result.techniqueId)}
                    </TableCell>
                    <TableCell className="max-w-32 truncate" title={getTacticName(result.tacticId)}>
                      {getTacticName(result.tacticId)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(result.status)}
                    </TableCell>
                    <TableCell>
                      {result.totalRounds || 0}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatDealValue(result.dimensionResults)}
                    </TableCell>
                    <TableCell>
                      €{(result.actualCost || 0).toFixed(3)}
                    </TableCell>
                    <TableCell>
                      {result.conversationLog && result.conversationLog.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
          setSelectedConversation(result);
          setConversationModalOpen(true);
        }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {simulationResults.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No simulation results available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Conversation Modal */}
      <Dialog open={conversationModalOpen} onOpenChange={setConversationModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Negotiation Conversation - Run #{selectedConversation?.runNumber}</DialogTitle>
                <DialogDescription>
              Detailed conversation log and negotiation progress
                </DialogDescription>
          </DialogHeader>
          
          {selectedConversation && (
            <ScrollArea className="h-96 w-full border rounded">
              <div className="p-4 space-y-4">
                {selectedConversation.conversationLog && selectedConversation.conversationLog.length > 0 ? (
                  selectedConversation.conversationLog.map((exchange: any, index: number) => (
                  <div key={index} className="border-b pb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={exchange.agent === 'BUYER' ? 'default' : 'secondary'}>
                        Round {exchange.round} - {exchange.agent}
                      </Badge>
                        {exchange.offer?.dimension_values?.Preis && (
                        <span className="text-xs text-gray-600 font-mono">
                            €{exchange.offer.dimension_values.Preis}
                        </span>
                      )}
                    </div>
                    <div className="text-sm mb-2">
                        {exchange.message || '[No message content]'}
                        </div>
                      {exchange.offer && (
                      <div className="bg-gray-50 p-2 rounded text-xs">
                          <strong>Offer:</strong> {JSON.stringify(exchange.offer.dimension_values, null, 2)}
                      </div>
                    )}
                  </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No conversation data available for this simulation</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
