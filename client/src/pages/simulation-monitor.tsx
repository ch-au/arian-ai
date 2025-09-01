/**
 * Simulation Monitor - Screen 3
 * Real-time monitoring of negotiation simulation execution with crash recovery
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  Pause, 
  Square, 
  SkipForward,
  RefreshCw,
  AlertCircle,
  Clock,
  DollarSign,
  Target,
  CheckCircle,
  XCircle,
  Activity,
  TrendingUp,
  Timer,
  RotateCcw,
  MessageCircle,
  Eye,
  BarChart3,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PerformanceMetricsDashboard, LiveNegotiationStats } from '@/components/dashboard/simulation-analytics';
import { SimulationResultsTable } from '@/components/dashboard/simulation-table';

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
  status: string;
  techniqueId: string;
  tacticId: string;
  totalRounds?: number;
  actualCost?: number;
  startedAt?: string;
  completedAt?: string;
  conversationLog?: any[];
  dimensionResults?: any;
}

// Mini offer category cards
const OfferCategoryCards = ({ currentRounds, isCompleted }: { currentRounds: any[], isCompleted: boolean }) => {
  const categories = ['Price', 'Volume', 'Payment_Terms', 'Contract_Duration'];
  const categoryLabels = {
    'Price': 'Price ($)',
    'Volume': 'Volume (units)',
    'Payment_Terms': 'Payment (days)',
    'Contract_Duration': 'Duration (months)'
  };
  
  const getLatestValue = (category: string) => {
    const latestRound = [...currentRounds]
      .reverse()
      .find(round => round.offer?.dimension_values?.[category]);
    return latestRound?.offer?.dimension_values?.[category] || 'Pending';
  };
  
  // Calculate total value (Price × Volume)
  const calculateTotalValue = () => {
    const price = getLatestValue('Price');
    const volume = getLatestValue('Volume');
    
    if (price === 'Pending' || volume === 'Pending') return 'Pending';
    if (typeof price === 'number' && typeof volume === 'number') {
      return price * volume;
    }
    return 'Pending';
  };
  
  const formatValue = (category: string, value: any) => {
    if (value === 'Pending') return value;
    switch (category) {
      case 'Price': return `$${value.toLocaleString()}`;
      case 'Volume': return `${value.toLocaleString()} units`;
      case 'Payment_Terms': return `${value} days`;
      case 'Contract_Duration': return `${value} months`;
      default: return value;
    }
  };
  
  const totalValue = calculateTotalValue();
  
  return (
    <div className="space-y-4">
      {/* Total Value KPI */}
      <div className={`p-4 rounded-xl border-2 transition-all ${
        isCompleted && totalValue !== 'Pending' 
          ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 shadow-lg' 
          : totalValue !== 'Pending' 
          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 shadow-md' 
          : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className={`text-sm font-bold ${
            isCompleted && totalValue !== 'Pending' ? 'text-green-700' : totalValue !== 'Pending' ? 'text-blue-700' : 'text-gray-500'
          }`}>
            💰 Total Deal Value
          </div>
          {isCompleted && totalValue !== 'Pending' && (
            <CheckCircle className="h-4 w-4 text-green-500" />
          )}
        </div>
        <div className={`text-2xl font-bold ${
          isCompleted && totalValue !== 'Pending' ? 'text-green-800' : totalValue !== 'Pending' ? 'text-blue-800' : 'text-gray-400'
        }`}>
          {totalValue !== 'Pending' ? `$${totalValue.toLocaleString()}` : 'Pending'}
        </div>
        {totalValue !== 'Pending' && (
          <div className="text-xs text-gray-600 mt-1">
            {formatValue('Price', getLatestValue('Price'))} × {formatValue('Volume', getLatestValue('Volume'))}
          </div>
        )}
      </div>
      
      {/* Individual Dimensions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {categories.map(category => {
          const value = getLatestValue(category);
          const hasValue = value !== 'Pending';
          
          return (
            <div 
              key={category}
              className={`p-3 rounded-lg border-2 transition-all ${
                isCompleted && hasValue 
                  ? 'bg-green-50 border-green-200 shadow-sm' 
                  : hasValue 
                  ? 'bg-blue-50 border-blue-200' 
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className={`text-xs font-medium ${
                  isCompleted && hasValue ? 'text-green-700' : hasValue ? 'text-blue-700' : 'text-gray-500'
                }`}>
                  {categoryLabels[category] || category}
                </div>
                {isCompleted && hasValue && (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                )}
              </div>
              <div className={`text-sm font-semibold ${
                isCompleted && hasValue ? 'text-green-800' : hasValue ? 'text-blue-800' : 'text-gray-400'
              }`}>
                {formatValue(category, value)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Complete rounds component (proposal + response pairs)
const CompleteRoundsView = ({ rounds, isCompleted }: { rounds: any[], isCompleted: boolean }) => {
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  
  const toggleMessageExpansion = (messageId: string) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(messageId)) {
      newExpanded.delete(messageId);
    } else {
      newExpanded.add(messageId);
    }
    setExpandedMessages(newExpanded);
  };
  
  // Group rounds into complete exchanges (pairs)
  const completeRounds = [];
  const roundsByNumber = rounds.reduce((acc, round) => {
    acc[round.round] = acc[round.round] || [];
    acc[round.round].push(round);
    return acc;
  }, {} as Record<number, any[]>);
  
  Object.keys(roundsByNumber)
    .sort((a, b) => Number(a) - Number(b))
    .forEach(roundNum => {
      const roundData = roundsByNumber[Number(roundNum)];
      const buyer = roundData.find(r => r.agent === 'BUYER');
      const seller = roundData.find(r => r.agent === 'SELLER');
      
      if (buyer || seller) {
        completeRounds.push({ roundNum: Number(roundNum), buyer, seller });
      }
    });
  
  return (
    <div className="space-y-3 max-h-64 overflow-y-auto">
      {completeRounds.slice(-3).map(({ roundNum, buyer, seller }) => (
        <div key={roundNum} className="bg-white rounded-lg border shadow-sm">
          <div className="bg-gray-50 px-3 py-2 rounded-t-lg border-b">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-xs font-medium">
                Round {roundNum}
              </Badge>
              {(buyer?.offer || seller?.offer) && (
                <div className="text-xs text-gray-600">
                  {buyer?.offer?.dimension_values?.Price && `Buyer: $${buyer.offer.dimension_values.Price}`}
                  {buyer?.offer && seller?.offer && ' → '}
                  {seller?.offer?.dimension_values?.Price && `Seller: $${seller.offer.dimension_values.Price}`}
                </div>
              )}
            </div>
          </div>
          
          <div className="p-3 space-y-3">
            {buyer && (
              <div className="border-l-4 border-blue-400 pl-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="default" size="sm">BUYER</Badge>
                  {buyer.offer?.dimension_values?.Price && (
                    <span className="text-xs text-gray-600 font-mono">
                      ${buyer.offer.dimension_values.Price.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-700">
                  {buyer.message.length > 100 ? (
                    <div>
                      {expandedMessages.has(`buyer-${roundNum}`) ? (
                        <div>
                          {buyer.message}
                          <button 
                            onClick={() => toggleMessageExpansion(`buyer-${roundNum}`)}
                            className="ml-2 text-blue-600 hover:text-blue-800 text-xs underline"
                          >
                            Show less
                          </button>
                        </div>
                      ) : (
                        <div>
                          {buyer.message.substring(0, 100)}...
                          <button 
                            onClick={() => toggleMessageExpansion(`buyer-${roundNum}`)}
                            className="ml-2 text-blue-600 hover:text-blue-800 text-xs underline"
                          >
                            Show more
                          </button>
                        </div>
                      )}
                    </div>
                  ) : buyer.message}
                </div>
              </div>
            )}
            
            {seller && (
              <div className="border-l-4 border-red-400 pl-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" size="sm">SELLER</Badge>
                  {seller.offer?.dimension_values?.Price && (
                    <span className="text-xs text-gray-600 font-mono">
                      ${seller.offer.dimension_values.Price.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-700">
                  {seller.message.length > 100 ? (
                    <div>
                      {expandedMessages.has(`seller-${roundNum}`) ? (
                        <div>
                          {seller.message}
                          <button 
                            onClick={() => toggleMessageExpansion(`seller-${roundNum}`)}
                            className="ml-2 text-red-600 hover:text-red-800 text-xs underline"
                          >
                            Show less
                          </button>
                        </div>
                      ) : (
                        <div>
                          {seller.message.substring(0, 100)}...
                          <button 
                            onClick={() => toggleMessageExpansion(`seller-${roundNum}`)}
                            className="ml-2 text-red-600 hover:text-red-800 text-xs underline"
                          >
                            Show more
                          </button>
                        </div>
                      )}
                    </div>
                  ) : seller.message}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
      
      {completeRounds.length === 0 && (
        <div className="text-center py-6 text-gray-500">
          <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Waiting for negotiation rounds...</p>
        </div>
      )}
    </div>
  );
};

// Multi-dimensional offer progression chart component
const OfferProgressionChart = ({ conversationLog }: { conversationLog: any[] }) => {
  // Extract all dimension data from conversation
  const dimensionData = conversationLog
    .filter(exchange => exchange.response?.offer?.dimension_values)
    .reduce((acc, exchange) => {
      const dimensions = exchange.response.offer.dimension_values;
      Object.keys(dimensions).forEach(dimension => {
        if (!acc[dimension]) acc[dimension] = [];
        acc[dimension].push({
          round: exchange.round,
          agent: exchange.agent,
          value: dimensions[dimension]
        });
      });
      return acc;
    }, {} as Record<string, Array<{round: number, agent: string, value: number}>>);

  const availableDimensions = Object.keys(dimensionData);
  if (availableDimensions.length === 0) return null;

  // Single chart component for each dimension
  const DimensionChart = ({ dimension, offers }: { dimension: string, offers: Array<{round: number, agent: string, value: number}> }) => {
    const maxValue = Math.max(...offers.map(o => o.value));
    const minValue = Math.min(...offers.map(o => o.value));
    const valueRange = maxValue - minValue || 1000;
    const maxRound = Math.max(...offers.map(o => o.round));

    // Chart dimensions - smaller for grid layout
    const width = 240;
    const height = 100;
    const padding = 25;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Generate paths for each agent
    const buyerOffers = offers.filter(o => o.agent === 'BUYER');
    const sellerOffers = offers.filter(o => o.agent === 'SELLER');

    const createPath = (agentOffers: typeof offers) => {
      if (agentOffers.length === 0) return '';
      
      return agentOffers
        .map((offer, index) => {
          const x = padding + (offer.round - 1) * (chartWidth / Math.max(maxRound - 1, 1));
          const y = padding + chartHeight - ((offer.value - minValue) / valueRange) * chartHeight;
          return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
        })
        .join(' ');
    };

    const buyerPath = createPath(buyerOffers);
    const sellerPath = createPath(sellerOffers);

    // Format value based on dimension type
    const formatValue = (value: number) => {
      if (dimension === 'Price') return `$${(value / 1000).toFixed(0)}K`;
      if (dimension === 'Volume') return `${value.toLocaleString()}`;
      if (dimension === 'Contract_Duration') return `${value}mo`;
      if (dimension === 'Payment_Terms') return `${value}d`;
      return value.toString();
    };

    return (
      <div className="border rounded p-3 bg-gray-50 shadow-sm">
        <div className="text-sm font-medium mb-2 text-center">{dimension.replace('_', ' ')}</div>
        <svg width={width} height={height + 20} className="overflow-visible">
          {/* Grid lines */}
          <line x1={padding} y1={padding + chartHeight} x2={padding + chartWidth} y2={padding + chartHeight} stroke="#e5e7eb" strokeWidth="1" />
          <line x1={padding} y1={padding} x2={padding} y2={padding + chartHeight} stroke="#e5e7eb" strokeWidth="1" />
          
          {/* Buyer line */}
          {buyerPath && (
            <path
              d={buyerPath}
              stroke="#3b82f6"
              strokeWidth="2"
              fill="none"
              opacity="0.8"
            />
          )}
          
          {/* Seller line */}
          {sellerPath && (
            <path
              d={sellerPath}
              stroke="#ef4444"
              strokeWidth="2"
              fill="none"
              opacity="0.8"
            />
          )}
          
          {/* Data points */}
          {offers.map((offer, index) => {
            const x = padding + (offer.round - 1) * (chartWidth / Math.max(maxRound - 1, 1));
            const y = padding + chartHeight - ((offer.value - minValue) / valueRange) * chartHeight;
            
            return (
              <g key={index}>
                <circle
                  cx={x}
                  cy={y}
                  r="4"
                  fill={offer.agent === 'BUYER' ? '#3b82f6' : '#ef4444'}
                  stroke="white"
                  strokeWidth="1.5"
                />
                <title>{formatValue(offer.value)}</title>
              </g>
            );
          })}
          
          {/* Y-axis labels - improved positioning to avoid overlap */}
          <text x="5" y={padding - 5} fontSize="9" fill="#6b7280" fontWeight="500">
            {formatValue(maxValue)}
          </text>
          <text x="5" y={padding + chartHeight + 15} fontSize="9" fill="#6b7280" fontWeight="500">
            {formatValue(minValue)}
          </text>
          
          {/* X-axis labels - positioned below chart with more space */}
          <text x={padding} y={height + 15} fontSize="9" fill="#9ca3af" textAnchor="middle">
            R1
          </text>
          <text x={padding + chartWidth} y={height + 15} fontSize="9" fill="#9ca3af" textAnchor="middle">
            R{maxRound}
          </text>
        </svg>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Grid layout for multiple dimensions */}
      <div className={`grid gap-4 ${availableDimensions.length === 1 ? 'grid-cols-1' : availableDimensions.length === 2 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-3'}`}>
        {availableDimensions.map(dimension => (
          <DimensionChart 
            key={dimension}
            dimension={dimension}
            offers={dimensionData[dimension]}
          />
        ))}
      </div>
      
      {/* Legend */}
      <div className="flex gap-4 mt-2 justify-center">
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-blue-500 rounded"></div>
          <span className="text-xs text-gray-700">Buyer</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-red-500 rounded"></div>
          <span className="text-xs text-gray-700">Seller</span>
        </div>
      </div>
    </div>
  );
};

export default function SimulationMonitor() {
  const { negotiationId } = useParams<{ negotiationId: string }>();
  const [, setLocation] = useLocation();
  
  // State management
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [simulationResults, setSimulationResults] = useState<SimulationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recoveryData, setRecoveryData] = useState<any>(null);
  const [selectedConversation, setSelectedConversation] = useState<SimulationResult | null>(null);
  const [conversationModalOpen, setConversationModalOpen] = useState(false);
  const [techniques, setTechniques] = useState<any[]>([]);
  const [tactics, setTactics] = useState<any[]>([]);
  const [realTimeUpdates, setRealTimeUpdates] = useState(false);
  const [currentNegotiation, setCurrentNegotiation] = useState<{
    simulationId: string;
    runNumber: number;
    rounds: Array<{
      round: number;
      agent: string;
      message: string;
      offer?: any;
    }>;
    maxRounds: number;
    isCompleted?: boolean;
  } | null>(null);
  const [buttonLoading, setButtonLoading] = useState<{
    executeNext: boolean;
    executeAll: boolean;
    pause: boolean;
    resume: boolean;
    stop: boolean;
    createQueue: boolean;
  }>({
    executeNext: false,
    executeAll: false,
    pause: false,
    resume: false,
    stop: false,
    createQueue: false
  });

  // WebSocket connection for real-time updates
  const { isConnected } = useWebSocket('/ws', {
    onMessage: (data) => {
      console.log('🔔 WebSocket message received:', data);
      console.log('🔍 Current negotiationId:', negotiationId);
      console.log('🔍 Message negotiationId:', data.negotiationId);
      console.log('🔍 Current queueStatus:', queueStatus);
      
      if (data.negotiationId === negotiationId) {
        console.log('✅ Message matches current negotiation:', negotiationId);
        switch (data.type) {
          case 'simulation_started':
            console.log('🚀 Simulation started:', data);
            // Immediately refresh queue status
            if (queueStatus?.id) {
              fetchQueueStatus(queueStatus.id);
              fetchResults(queueStatus.id);
            }
            // Initialize current negotiation tracking (clear old data)
            console.log('🆕 Initializing new negotiation:', data.data.simulationId);
            setCurrentNegotiation({
              simulationId: data.data.simulationId,
              runNumber: data.data.runNumber,
              rounds: [],
              maxRounds: 6,
              isCompleted: false
            });
            break;
          case 'negotiation_round':
            console.log('📢 Negotiation round received:', data);
            console.log('🔍 Current negotiation state:', currentNegotiation);
            setCurrentNegotiation(prev => {
              console.log('🔄 Updating negotiation state - prev:', prev);
              console.log('🔄 Simulation ID match?', prev?.simulationId, '===', data.data.simulationId);
              
              if (prev && prev.simulationId === data.data.simulationId) {
                const newState = {
                  ...prev,
                  rounds: [...prev.rounds, {
                    round: data.data.round,
                    agent: data.data.agent,
                    message: data.data.message,
                    offer: data.data.offer
                  }]
                };
                console.log('✅ Updated negotiation state:', newState);
                return newState;
              }
              console.log('❌ No simulation ID match, keeping prev state');
              return prev;
            });
            break;
          case 'simulation_completed':
            console.log('Simulation completed:', data);
            // Mark negotiation as completed
            setCurrentNegotiation(prev => prev ? { ...prev, isCompleted: true } : null);
            // Force refresh queue status and results
            if (queueStatus?.id) {
              setTimeout(() => {
                fetchQueueStatus(queueStatus.id);
                fetchResults(queueStatus.id);
              }, 500);
            }
            // Clear current negotiation after showing final state
            setTimeout(() => setCurrentNegotiation(null), 5000);
            break;
          case 'simulation_failed':
            console.log('Simulation failed:', data);
            if (queueStatus?.id) {
              setTimeout(() => {
                fetchQueueStatus(queueStatus.id);
                fetchResults(queueStatus.id);
              }, 500);
            }
            setCurrentNegotiation(null);
            break;
          case 'queue_progress':
            console.log('Queue progress:', data);
            if (queueStatus?.id) {
              fetchQueueStatus(queueStatus.id);
            }
            break;
          case 'queue_completed':
            console.log('Queue completed:', data);
            if (queueStatus?.id) {
              setTimeout(() => {
                fetchQueueStatus(queueStatus.id);
                fetchResults(queueStatus.id);
              }, 500);
            }
            setCurrentNegotiation(null);
            break;
          default:
            console.log('Unknown WebSocket event:', data);
        }
      }
    },
    onOpen: () => {
      console.log('WebSocket connected');
      setRealTimeUpdates(true);
    },
    onClose: () => {
      console.log('WebSocket disconnected');
      setRealTimeUpdates(false);
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
      setRealTimeUpdates(false);
    }
  });

  // Fetch queue status
  const fetchQueueStatus = async (queueId: string) => {
    try {
      const response = await fetch(`/api/simulations/queue/${queueId}/status`);
      const data = await response.json();
      
      if (data.success) {
        console.log('📊 Queue status received:', {
          status: data.data.status,
          total: data.data.totalSimulations,
          completed: data.data.completedCount,
          failed: data.data.failedCount,
          pending: data.data.totalSimulations - data.data.completedCount - data.data.failedCount
        });
        
        // Clear current negotiation if queue is stopped/paused/completed
        if (data.data.status === 'paused' || data.data.status === 'completed' || data.data.status === 'failed') {
          setCurrentNegotiation(null);
        }
        
        setQueueStatus(data.data);
      } else {
        setError(data.error || 'Failed to fetch queue status');
      }
    } catch (err) {
      console.error('Error fetching queue status:', err);
      setError('Network error');
    }
  };

  // Fetch simulation results
  const fetchResults = async (queueId: string) => {
    try {
      const response = await fetch(`/api/simulations/queue/${queueId}/results`);
      const data = await response.json();
      
      if (data.success) {
        console.log('📈 Simulation results received:', {
          count: data.data.length,
          statuses: data.data.reduce((acc: any, item: any) => {
            acc[item.status] = (acc[item.status] || 0) + 1;
            return acc;
          }, {})
        });
        setSimulationResults(data.data);
      }
    } catch (err) {
      console.error('Error fetching results:', err);
    }
  };

  // Check for recovery opportunities
  const checkRecovery = async () => {
    if (!negotiationId) return;

    try {
      const response = await fetch(`/api/simulations/recovery/${negotiationId}`);
      const data = await response.json();
      
      if (data.success && data.data.hasRecoverableSession) {
        setRecoveryData(data.data);
      }
    } catch (err) {
      console.error('Error checking recovery:', err);
    }
  };

  // Load reference data
  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const [techniquesRes, tacticsRes] = await Promise.all([
          fetch('/api/techniques'),
          fetch('/api/tactics')
        ]);
        
        if (techniquesRes.ok) {
          const techniquesData = await techniquesRes.json();
          setTechniques(techniquesData);
        }
        
        if (tacticsRes.ok) {
          const tacticsData = await tacticsRes.json();
          setTactics(tacticsData);
        }
      } catch (error) {
        console.error('Failed to load reference data:', error);
      }
    };
    
    loadReferenceData();
  }, []);

  // Initialize: find queue for negotiation and load data
  useEffect(() => {
    const initialize = async () => {
      if (!negotiationId) return;

      setLoading(true);
      
      try {
        // First, try to find a queue for this negotiation
        const queueResponse = await fetch(`/api/simulations/queue/by-negotiation/${negotiationId}`);
        
        if (queueResponse.ok) {
          const queueData = await queueResponse.json();
          if (queueData.success && queueData.queueId) {
            // Found a queue, load its status and results
            await fetchQueueStatus(queueData.queueId);
            await fetchResults(queueData.queueId);
            
            console.log('🔍 Queue found:', queueData.queueId);
          } else {
            // No queue found
            setQueueStatus(null);
            console.log('❌ No queue found for negotiation:', negotiationId);
          }
        } else {
          // No queue exists, check for recovery opportunities
          await checkRecovery();
        }
      } catch (error) {
        console.error('Error initializing simulation monitor:', error);
        await checkRecovery();
      }
      
      setLoading(false);
    };

    initialize();
  }, [negotiationId]);

  // Enhanced polling for queue updates
  useEffect(() => {
    if (!queueStatus?.id) return;

    const interval = setInterval(() => {
      // Always poll for queue status when active or when WebSocket is down
      if (queueStatus.status === 'running' || queueStatus.status === 'pending' || !realTimeUpdates) {
        console.log('🔄 Polling queue status and results...');
        fetchQueueStatus(queueStatus.id);
        fetchResults(queueStatus.id);
      }
    }, realTimeUpdates ? 10000 : 3000); // Poll every 10s with WebSocket, 3s without

    return () => clearInterval(interval);
  }, [queueStatus?.id, queueStatus?.status, realTimeUpdates]);

  // Queue control functions
  const handleExecuteNext = async () => {
    if (!queueStatus?.id || buttonLoading.executeNext) return;

    setButtonLoading(prev => ({ ...prev, executeNext: true }));
    try {
      const response = await fetch(`/api/simulations/queue/${queueStatus.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'next' })
      });
      
      const data = await response.json();
      if (data.success) {
        await fetchQueueStatus(queueStatus.id);
        if (data.hasNext) {
          setError(null);
        }
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to start next simulation');
    } finally {
      setButtonLoading(prev => ({ ...prev, executeNext: false }));
    }
  };

  const handleExecuteAll = async () => {
    if (!queueStatus?.id || buttonLoading.executeAll) return;

    setButtonLoading(prev => ({ ...prev, executeAll: true }));
    try {
      const response = await fetch(`/api/simulations/queue/${queueStatus.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'all' })
      });
      
      const data = await response.json();
      if (data.success) {
        await fetchQueueStatus(queueStatus.id);
        setError(null);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to start all simulations');
    } finally {
      setButtonLoading(prev => ({ ...prev, executeAll: false }));
    }
  };

  const handlePause = async () => {
    if (!queueStatus?.id || buttonLoading.pause) return;

    setButtonLoading(prev => ({ ...prev, pause: true }));
    try {
      const response = await fetch(`/api/simulations/queue/${queueStatus.id}/pause`, {
        method: 'POST'
      });
      
      if (response.ok) {
        await fetchQueueStatus(queueStatus.id);
        setError(null);
      }
    } catch (err) {
      setError('Failed to pause queue');
    } finally {
      setButtonLoading(prev => ({ ...prev, pause: false }));
    }
  };

  const handleResume = async () => {
    if (!queueStatus?.id || buttonLoading.resume) return;

    setButtonLoading(prev => ({ ...prev, resume: true }));
    try {
      const response = await fetch(`/api/simulations/queue/${queueStatus.id}/resume`, {
        method: 'POST'
      });
      
      if (response.ok) {
        await fetchQueueStatus(queueStatus.id);
        setError(null);
      }
    } catch (err) {
      setError('Failed to resume queue');
    } finally {
      setButtonLoading(prev => ({ ...prev, resume: false }));
    }
  };

  const handleStop = async () => {
    if (!queueStatus?.id || buttonLoading.stop) return;

    setButtonLoading(prev => ({ ...prev, stop: true }));
    try {
      const response = await fetch(`/api/simulations/queue/${queueStatus.id}/stop`, {
        method: 'POST'
      });
      
      if (response.ok) {
        await fetchQueueStatus(queueStatus.id);
        setError(null);
      }
    } catch (err) {
      setError('Failed to stop queue');
    } finally {
      setButtonLoading(prev => ({ ...prev, stop: false }));
    }
  };

  const handleCreateNewQueue = async () => {
    if (!negotiationId || buttonLoading.createQueue) return;

    setButtonLoading(prev => ({ ...prev, createQueue: true }));
    try {
      const response = await fetch(`/api/negotiations/${negotiationId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.queueId) {
          // Load the new queue
          setQueueStatus(null);
          await fetchQueueStatus(data.queueId);
          await fetchResults(data.queueId);
          setError(null);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create new queue');
      }
    } catch (err) {
      setError('Failed to create new simulation queue');
    } finally {
      setButtonLoading(prev => ({ ...prev, createQueue: false }));
    }
  };

  const handleRecovery = async (action: 'resume' | 'restart') => {
    if (!negotiationId || !recoveryData) return;

    try {
      if (action === 'resume' && recoveryData.orphanedSimulations.length > 0) {
        await fetch(`/api/simulations/recovery/${negotiationId}/recover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orphanedSimulations: recoveryData.orphanedSimulations })
        });
      }
      
      setRecoveryData(null);
      
      if (recoveryData.queueId) {
        await fetchQueueStatus(recoveryData.queueId);
        await fetchResults(recoveryData.queueId);
      }
    } catch (err) {
      setError('Failed to recover session');
    }
  };

  // Format time remaining
  const formatTimeRemaining = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; icon: React.ReactNode }> = {
      pending: { color: 'bg-gray-500', icon: <Clock className="w-3 h-3" /> },
      running: { color: 'bg-blue-500', icon: <Play className="w-3 h-3" /> },
      completed: { color: 'bg-green-500', icon: <CheckCircle className="w-3 h-3" /> },
      failed: { color: 'bg-red-500', icon: <XCircle className="w-3 h-3" /> },
      paused: { color: 'bg-yellow-500', icon: <Pause className="w-3 h-3" /> }
    };

    const variant = variants[status] || variants.pending;
    
    return (
      <Badge className={cn('text-white', variant.color)}>
        {variant.icon}
        <span className="ml-1 capitalize">{status}</span>
      </Badge>
    );
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

  const formatDealValue = (dimensionResults: any) => {
    if (!dimensionResults || typeof dimensionResults === 'string') {
      try {
        const parsed = typeof dimensionResults === 'string' ? JSON.parse(dimensionResults) : dimensionResults;
        return parsed?.Price ? `$${parsed.Price}` : '-';
      } catch {
        return '-';
      }
    }
    return dimensionResults?.Price ? `$${dimensionResults.Price}` : '-';
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

  // Recovery UI
  if (recoveryData && recoveryData.hasRecoverableSession) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center">
              <RefreshCw className="w-5 h-5 mr-2" />
              Recovery Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                We found an interrupted simulation session:
                <ul className="mt-2 ml-4 list-disc">
                  <li>{recoveryData.checkpoint?.completedSimulations?.length || 0} simulations completed</li>
                  <li>{recoveryData.orphanedSimulations?.length || 0} simulations need recovery</li>
                </ul>
              </AlertDescription>
            </Alert>
            
            <div className="flex gap-3 mt-4">
              <Button onClick={() => handleRecovery('resume')} className="flex-1">
                <RefreshCw className="w-4 h-4 mr-2" />
                Resume from checkpoint
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setRecoveryData(null)}
                className="flex-1"
              >
                Start fresh
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No queue found - redirect to configuration
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

  return (
    <div className="p-6 space-y-6">
      {/* Header Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                "Office Supplies Procurement" Simulation Monitor
              </CardTitle>
              <CardDescription>
                Real-time execution monitoring for negotiation simulations
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              {queueStatus && (
                <Badge 
                  variant={queueStatus.status === 'running' ? 'default' : 'outline'}
                  className="text-sm"
                >
                  {queueStatus.status === 'running' && '🟡'} 
                  {queueStatus.status === 'completed' && '🟢'}
                  {queueStatus.status === 'paused' && '⏸️'}
                  {queueStatus.status === 'failed' && '🔴'}
                  {queueStatus.status === 'pending' && '⏳'}
                  {' '}{queueStatus.status.toUpperCase()}
                </Badge>
              )}
              {queueStatus && (
                <div className="flex flex-col items-end gap-1">
                  <div className="text-xs text-muted-foreground">
                    Started: {new Date().toLocaleTimeString()}
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <div className={`w-2 h-2 rounded-full ${realTimeUpdates ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-muted-foreground">
                      {realTimeUpdates ? 'Real-time' : 'Polling'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {queueStatus && (
            <>
              {/* Progress Section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span>Progress: {queueStatus.completedCount}/{queueStatus.totalSimulations} simulations ({queueStatus.progressPercentage}%)</span>
                  <span className="text-muted-foreground">
                    Estimated: {formatTimeRemaining(queueStatus.estimatedTimeRemaining)} remaining
                  </span>
                </div>
                <Progress value={queueStatus.progressPercentage} className="h-3" />
              </div>

              {/* Live Negotiation Statistics */}
              {currentNegotiation && (
                <LiveNegotiationStats currentNegotiation={currentNegotiation} />
              )}

              {/* Real-time Negotiation Tracking */}
              {currentNegotiation && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      🚀 Live Negotiation - Run #{currentNegotiation.runNumber}
                      <Badge variant="secondary" className="animate-pulse">
                        Round {Math.ceil(currentNegotiation.rounds.length / 2)}/{Math.ceil(currentNegotiation.maxRounds / 2)}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Offer Category Cards */}
                      {currentNegotiation.rounds.length > 0 && (
                        <div className="bg-white p-4 rounded-lg border">
                          <div className="text-sm font-medium mb-3 flex items-center gap-2">
                            📊 Current Negotiation Status
                            {currentNegotiation.isCompleted && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                ✅ Deal Reached
                              </Badge>
                            )}
                          </div>
                          <OfferCategoryCards 
                            currentRounds={currentNegotiation.rounds} 
                            isCompleted={currentNegotiation.isCompleted || false}
                          />
                        </div>
                      )}
                      
                      {/* Complete Rounds View */}
                      {currentNegotiation.rounds.length > 0 && (
                        <div className="bg-white p-4 rounded-lg border">
                          <div className="text-sm font-medium mb-3">💬 Negotiation Exchanges</div>
                          <CompleteRoundsView 
                            rounds={currentNegotiation.rounds} 
                            isCompleted={currentNegotiation.isCompleted || false}
                          />
                        </div>
                      )}
                      
                      {/* Chart for historical view */}
                      {currentNegotiation.rounds.length > 2 && (
                        <div className="bg-white p-3 rounded border">
                          <div className="text-sm font-medium mb-2">📈 Live Offer Progression</div>
                          <OfferProgressionChart 
                            conversationLog={currentNegotiation.rounds.map((round, index) => ({
                              round: round.round,
                              agent: round.agent,
                              response: {
                                message: round.message,
                                offer: round.offer
                              }
                            }))} 
                          />
                        </div>
                      )}
                      
                      {currentNegotiation.rounds.length === 0 && (
                        <div className="text-center py-6 text-muted-foreground">
                          {queueStatus?.status === 'running' ? (
                            <>
                              <Activity className="h-8 w-8 mx-auto mb-2 animate-spin" />
                              <p>Waiting for first negotiation round...</p>
                            </>
                          ) : queueStatus?.status === 'paused' ? (
                            <>
                              <div className="h-8 w-8 mx-auto mb-2 bg-yellow-100 rounded-full flex items-center justify-center">
                                <span className="text-yellow-600 text-lg">⏸</span>
                              </div>
                              <p>Queue paused - No active negotiation</p>
                            </>
                          ) : queueStatus?.status === 'completed' ? (
                            <>
                              <div className="h-8 w-8 mx-auto mb-2 bg-green-100 rounded-full flex items-center justify-center">
                                <span className="text-green-600 text-lg">✓</span>
                              </div>
                              <p>All simulations completed</p>
                            </>
                          ) : (
                            <>
                              <div className="h-8 w-8 mx-auto mb-2 bg-gray-100 rounded-full flex items-center justify-center">
                                <span className="text-gray-600 text-lg">⏹</span>
                              </div>
                              <p>Queue stopped - No active negotiation</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Control Buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button 
                  onClick={() => setCurrentNegotiation(null)}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  Clear Live Data
                </Button>
                {/* Show Run buttons when there are actually pending simulations */}
                {(queueStatus.completedCount + queueStatus.failedCount < queueStatus.totalSimulations) && (
                  <>
                    <Button 
                      onClick={handleExecuteNext}
                      size="sm"
                      disabled={queueStatus.status === 'running' || buttonLoading.executeNext}
                    >
                      {buttonLoading.executeNext ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      {buttonLoading.executeNext ? 'Starting...' : 'Run Next'}
                    </Button>
                    <Button 
                      onClick={handleExecuteAll}
                      size="sm" 
                      variant="outline"
                      disabled={queueStatus.status === 'running' || buttonLoading.executeAll}
                    >
                      {buttonLoading.executeAll ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          <Play className="h-4 w-4 mr-2 -ml-4" />
                        </>
                      )}
                      {buttonLoading.executeAll ? 'Starting All...' : 'Run All'}
                    </Button>
                  </>
                )}
                {/* Show completion message only when all simulations are truly done */}
                {queueStatus.status === 'completed' && (queueStatus.completedCount + queueStatus.failedCount >= queueStatus.totalSimulations) && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    All simulations completed!
                  </div>
                )}
                {queueStatus.status === 'completed' && (queueStatus.completedCount + queueStatus.failedCount >= queueStatus.totalSimulations) && (
                  <Button 
                    onClick={handleCreateNewQueue}
                    size="sm"
                    variant="outline"
                    disabled={buttonLoading.createQueue}
                  >
                    {buttonLoading.createQueue ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Create New Queue
                      </>
                    )}
                  </Button>
                )}
                {queueStatus.status === 'running' ? (
                  <Button 
                    onClick={handlePause} 
                    size="sm" 
                    variant="outline"
                    disabled={buttonLoading.pause}
                  >
                    {buttonLoading.pause ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Pause className="h-4 w-4 mr-2" />
                    )}
                    {buttonLoading.pause ? 'Pausing...' : 'Pause'}
                  </Button>
                ) : queueStatus.status === 'paused' ? (
                  <Button 
                    onClick={handleResume} 
                    size="sm" 
                    variant="outline"
                    disabled={buttonLoading.resume}
                  >
                    {buttonLoading.resume ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4 mr-2" />
                    )}
                    {buttonLoading.resume ? 'Resuming...' : 'Resume'}
                  </Button>
                ) : null}
                <Button 
                  onClick={handleStop} 
                  size="sm" 
                  variant="destructive"
                  disabled={buttonLoading.stop}
                >
                  {buttonLoading.stop ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Square className="h-4 w-4 mr-2" />
                  )}
                  {buttonLoading.stop ? 'Stopping...' : 'Stop'}
                </Button>
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

      {/* Enhanced Performance Metrics Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Real-time Performance Metrics
          </CardTitle>
          <CardDescription>
            Live analytics and performance insights across all simulations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PerformanceMetricsDashboard
            simulationResults={simulationResults}
            queueStatus={queueStatus}
            techniques={techniques}
            tactics={tactics}
            totalRuns={queueStatus?.totalSimulations || 0}
          />
        </CardContent>
      </Card>


      {/* Queue Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📋 Simulation Queue ({queueStatus?.totalSimulations || 0} total)</CardTitle>
        </CardHeader>
        <CardContent>
          {queueStatus && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{queueStatus.completedCount}</div>
                  <div className="text-sm text-muted-foreground">✅ Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {queueStatus.currentSimulation ? 1 : 0}
                  </div>
                  <div className="text-sm text-muted-foreground">🟡 Running</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {queueStatus.totalSimulations - queueStatus.completedCount - queueStatus.failedCount - (queueStatus.currentSimulation ? 1 : 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">⏳ Pending</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{queueStatus.failedCount}</div>
                  <div className="text-sm text-muted-foreground">❌ Failed</div>
                </div>
              </div>
              
              <Separator className="my-4" />
              
              <div className="flex flex-wrap justify-between items-center gap-4 text-sm">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Success Rate: {Math.round((queueStatus.completedCount / Math.max(queueStatus.completedCount + queueStatus.failedCount, 1)) * 100)}%
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Avg Duration: 45s
                </span>
                <span className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Total Cost: ${queueStatus.actualCost.toFixed(2)}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>


      {/* Advanced Results Table */}
      <SimulationResultsTable
        simulationResults={simulationResults}
        techniques={techniques}
        tactics={tactics}
        onViewConversation={(result) => {
          setSelectedConversation(result);
          setConversationModalOpen(true);
        }}
        onRerunSimulation={async (result) => {
          // TODO: Implement rerun functionality
          console.log('Rerunning simulation:', result.id);
        }}
        onDeleteSimulation={async (result) => {
          // TODO: Implement delete functionality
          console.log('Deleting simulation:', result.id);
        }}
      />

      {/* Conversation Modal */}
      <Dialog open={conversationModalOpen} onOpenChange={setConversationModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Negotiation Conversation</DialogTitle>
                <DialogDescription>
                  Detailed conversation log and offer progression
                </DialogDescription>
              </div>
              {selectedConversation && selectedConversation.conversationLog && (
                <div className="flex-shrink-0 ml-4">
                  <div className="text-xs text-gray-600 mb-2">Offer Progression</div>
                  <OfferProgressionChart 
                    conversationLog={Array.isArray(selectedConversation.conversationLog) 
                      ? selectedConversation.conversationLog 
                      : JSON.parse(selectedConversation.conversationLog || '[]')
                    } 
                  />
                </div>
              )}
            </div>
          </DialogHeader>
          
          {selectedConversation && selectedConversation.conversationLog && (
            <ScrollArea className="h-96 w-full border rounded">
              <div className="p-4 space-y-4">
                {(Array.isArray(selectedConversation.conversationLog) 
                  ? selectedConversation.conversationLog 
                  : JSON.parse(selectedConversation.conversationLog || '[]')
                ).map((exchange: any, index: number) => (
                  <div key={index} className="border-b pb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={exchange.agent === 'BUYER' ? 'default' : 'secondary'}>
                        Round {exchange.round} - {exchange.agent}
                      </Badge>
                      {exchange.response?.offer?.dimension_values?.Price && (
                        <span className="text-xs text-gray-600 font-mono">
                          ${exchange.response.offer.dimension_values.Price.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="text-sm mb-2">{exchange.response?.message}</div>
                    {exchange.response?.offer && (
                      <div className="bg-gray-50 p-2 rounded text-xs">
                        <strong>Offer:</strong> {JSON.stringify(exchange.response.offer.dimension_values, null, 2)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}