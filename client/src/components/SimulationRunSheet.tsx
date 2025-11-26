import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle, TrendingUp, Target, Brain, Zap, ChevronDown, ChevronRight, MessageSquare, FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SimulationRunSheetProps {
  simulationRunId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SimulationRunData {
  success: boolean;
  data?: {
    run: {
      id: string;
      status: string;
      outcome: string | null;
      outcomeReason: string | null;
      totalRounds: number | null;
      dealValue: string | null;
      personalityId: string | null;
      zopaDistance: string | null;
      techniqueEffectivenessScore: string | null;
      tacticEffectivenessScore: string | null;
      tacticalSummary: string | null;
      conversationLog: any[];
      startedAt: string | null;
      completedAt: string | null;
    };
    technique: {
      id: string;
      name: string;
      beschreibung: string;
    } | null;
    tactic: {
      id: string;
      name: string;
      beschreibung: string;
    } | null;
    productResults: Array<{
      id: string;
      productName: string;
      targetPrice: string;
      agreedPrice: string;
      priceVsTarget: string | null;
      subtotal: string;
      performanceScore: string | null;
      withinZopa: boolean | null;
    }>;
    dimensionResults: Array<{
      id: string;
      dimensionName: string;
      finalValue: string;
      targetValue: string;
      achievedTarget: boolean;
      priorityScore: number;
    }>;
    userRole?: "buyer" | "seller";
  };
  error?: string;
}

export function SimulationRunSheet({
  simulationRunId,
  open,
  onOpenChange,
}: SimulationRunSheetProps) {
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [conversationOpen, setConversationOpen] = useState(false);
  const [priceEvolutionOpen, setPriceEvolutionOpen] = useState(true);

  const { data, isLoading, error } = useQuery<SimulationRunData>({
    queryKey: [`/api/simulation-runs/${simulationRunId}`],
    enabled: !!simulationRunId && open,
  });

  // Parse conversation log to extract price evolution
  const parsePriceEvolution = () => {
    if (!data?.data?.run?.conversationLog) return {};

    const dimensionData: Record<string, Array<{turn: number, seller: number | null, buyer: number | null}>> = {};

    data.data.run.conversationLog.forEach((message: any) => {
      if (message.turn && message.agent && message.offer && message.offer.dimension_values) {
        const turn = message.turn;
        const agent = message.agent; // "SELLER" or "BUYER"
        const values = message.offer.dimension_values;

        Object.entries(values).forEach(([dimName, value]: [string, any]) => {
          if (!dimensionData[dimName]) {
            dimensionData[dimName] = [];
          }

          // Find or create entry for this turn
          let turnEntry = dimensionData[dimName].find(d => d.turn === turn);
          if (!turnEntry) {
            turnEntry = { turn, seller: null, buyer: null };
            dimensionData[dimName].push(turnEntry);
          }

          // Set value for this agent
          if (agent === 'SELLER') {
            turnEntry.seller = typeof value === 'number' ? value : null;
          } else if (agent === 'BUYER') {
            turnEntry.buyer = typeof value === 'number' ? value : null;
          }
        });
      }
    });

    // Sort by turn number
    Object.keys(dimensionData).forEach(dim => {
      dimensionData[dim].sort((a, b) => a.turn - b.turn);
    });

    return dimensionData;
  };

  const priceEvolution = data?.data ? parsePriceEvolution() : {};

  // Determine labels based on userRole
  const userRole = data?.data?.userRole || 'seller';
  const userIsBuyer = userRole === 'buyer';
  // In the chart: seller line is blue, buyer line is red
  // Labels should show "(Sie)" for the user's role
  const sellerLabel = userIsBuyer ? "Verkäufer" : "Verkäufer (Sie)";
  const buyerLabel = userIsBuyer ? "Käufer (Sie)" : "Käufer";

  const formatCurrency = (value: string | null) => {
    if (!value) return "N/A";
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(parseFloat(value));
  };

  const formatPercentage = (value: string | null) => {
    if (!value) return "N/A";
    return `${parseFloat(value).toFixed(1)}%`;
  };

  const getOutcomeBadgeVariant = (outcome: string | null) => {
    switch (outcome) {
      case "deal":
        return "default";
      case "no_deal":
        return "destructive";
      case "timeout":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Loading simulation details...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
              <p className="text-sm text-muted-foreground">
                Failed to load simulation details
              </p>
            </div>
          </div>
        )}

        {data?.success && data.data && (
          <div className="space-y-6 pb-6">
            <SheetHeader>
              <SheetTitle>Simulation Run Details</SheetTitle>
              <SheetDescription>
                ID: {data.data.run.id.slice(0, 8)}...
              </SheetDescription>
            </SheetHeader>

            <Separator />

            {/* Price Evolution Section - Collapsible */}
            {Object.keys(priceEvolution).length > 0 && (
              <>
                <Collapsible open={priceEvolutionOpen} onOpenChange={setPriceEvolutionOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-4 h-auto"
                    >
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        <span className="font-semibold text-lg">Price Evolution</span>
                        <Badge variant="secondary" className="ml-2">
                          {Object.keys(priceEvolution).length} dimensions
                        </Badge>
                      </div>
                      {priceEvolutionOpen ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 px-2">
                    {/* Shared Legend */}
                    <Card className="bg-muted/30">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-center gap-6 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-0.5 bg-[#3b82f6]"></div>
                            <span>{sellerLabel}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-0.5 bg-[#ef4444]"></div>
                            <span>{buyerLabel}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Object.entries(priceEvolution).map(([dimName, chartData]) => (
                        <Card key={dimName}>
                          <CardHeader className="pb-2 pt-3">
                            <CardTitle className="text-sm font-medium">{dimName}</CardTitle>
                          </CardHeader>
                          <CardContent className="pb-2">
                            <ResponsiveContainer width="100%" height={150}>
                              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                <XAxis
                                  dataKey="turn"
                                  tick={{ fontSize: 11 }}
                                  height={30}
                                />
                                <YAxis
                                  tick={{ fontSize: 11 }}
                                  width={45}
                                  domain={['auto', 'auto']}
                                  padding={{ top: 10, bottom: 10 }}
                                />
                                <Tooltip
                                  contentStyle={{ fontSize: 11, padding: '4px 8px' }}
                                  formatter={(value: any) => {
                                    if (typeof value === 'number') {
                                      return value.toFixed(2);
                                    }
                                    return value;
                                  }}
                                  labelFormatter={(label) => `Round ${label}`}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="seller"
                                  stroke="#3b82f6"
                                  strokeWidth={2}
                                  connectNulls
                                  dot={{ r: 2.5 }}
                                  isAnimationActive={false}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="buyer"
                                  stroke="#ef4444"
                                  strokeWidth={2}
                                  connectNulls
                                  dot={{ r: 2.5 }}
                                  isAnimationActive={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                <Separator />
              </>
            )}

            {/* Summary Section - Collapsible */}
            <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between p-4 h-auto"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    <span className="font-semibold text-lg">Summary</span>
                  </div>
                  {summaryOpen ? (
                    <ChevronDown className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 px-2">
                {/* Status and Outcome */}
                <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant={data.data.run.status === "completed" ? "default" : "secondary"}>
                    {data.data.run.status}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Outcome</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant={getOutcomeBadgeVariant(data.data.run.outcome)}>
                    {data.data.run.outcome || "N/A"}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {/* Technique and Tactic */}
            {(data.data.technique || data.data.tactic) && (
              <div className="space-y-3">
                {data.data.technique && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Brain className="h-4 w-4" />
                        Influencing Technique
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-semibold">{data.data.technique.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {data.data.technique.beschreibung}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {data.data.tactic && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Negotiation Tactic
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-semibold">{data.data.tactic.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {data.data.tactic.beschreibung}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Key Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Key Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Deal Value</span>
                  <span className="font-semibold">
                    {formatCurrency(data.data.run.dealValue)}
                  </span>
                </div>
                {data.data.run.totalRounds && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Rounds</span>
                    <span className="font-semibold">{data.data.run.totalRounds}</span>
                  </div>
                )}
                {data.data.run.personalityId && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Personality</span>
                    <span className="font-semibold">{data.data.run.personalityId}</span>
                  </div>
                )}
                {data.data.run.zopaDistance && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">ZOPA Distance</span>
                    <span className="font-semibold">{data.data.run.zopaDistance}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Effectiveness Scores */}
            {(data.data.run.techniqueEffectivenessScore ||
              data.data.run.tacticEffectivenessScore) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Effectiveness Scores
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.data.run.techniqueEffectivenessScore && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Technique</span>
                      <span className="font-semibold">
                        {formatPercentage(data.data.run.techniqueEffectivenessScore)}
                      </span>
                    </div>
                  )}
                  {data.data.run.tacticEffectivenessScore && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Tactic</span>
                      <span className="font-semibold">
                        {formatPercentage(data.data.run.tacticEffectivenessScore)}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Outcome Reason */}
            {data.data.run.outcomeReason && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Outcome Reason</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{data.data.run.outcomeReason}</p>
                </CardContent>
              </Card>
            )}

            {/* Tactical Summary */}
            {data.data.run.tacticalSummary && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Tactical Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">
                    {data.data.run.tacticalSummary}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Product Results */}
            {data.data.productResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Product Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Agreed</TableHead>
                        <TableHead>vs Target</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.data.productResults.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">
                            {product.productName}
                          </TableCell>
                          <TableCell>{formatCurrency(product.targetPrice)}</TableCell>
                          <TableCell>{formatCurrency(product.agreedPrice)}</TableCell>
                          <TableCell>
                            {product.priceVsTarget
                              ? formatPercentage(product.priceVsTarget)
                              : "N/A"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Dimension Results */}
            {data.data.dimensionResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Dimension Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dimension</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Final</TableHead>
                        <TableHead>Achieved</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.data.dimensionResults.map((dimension) => (
                        <TableRow key={dimension.id}>
                          <TableCell className="font-medium">
                            {dimension.dimensionName}
                          </TableCell>
                          <TableCell>{dimension.targetValue}</TableCell>
                          <TableCell>{dimension.finalValue}</TableCell>
                          <TableCell>
                            <Badge
                              variant={dimension.achievedTarget ? "default" : "secondary"}
                            >
                              {dimension.achievedTarget ? "Yes" : "No"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
              </CollapsibleContent>
            </Collapsible>

            {/* Conversation Section - Collapsible */}
            <Collapsible open={conversationOpen} onOpenChange={setConversationOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between p-4 h-auto"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    <span className="font-semibold text-lg">Conversation</span>
                    {data.data.run.conversationLog && (
                      <Badge variant="secondary" className="ml-2">
                        {data.data.run.conversationLog.length} messages
                      </Badge>
                    )}
                  </div>
                  {conversationOpen ? (
                    <ChevronDown className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 px-2">
                {data.data.run.conversationLog && data.data.run.conversationLog.length > 0 ? (
                  <div className="space-y-3">
                    {data.data.run.conversationLog.map((message: any, index: number) => {
                      // Parse the conversation log message format
                      const agent = message.agent || 'Unknown';
                      const turn = message.turn || index + 1;
                      const reasoning = message.offer?.reasoning || '';
                      const confidence = message.confidence;
                      const offer = message.offer;

                      // Format dimension values if available
                      const dimensionValues = offer?.dimension_values;
                      const dimensionText = dimensionValues
                        ? Object.entries(dimensionValues)
                            .map(([key, value]) => `${key}: ${typeof value === 'number' ? value.toFixed(2) : value}`)
                            .join(', ')
                        : '';

                      // Determine if this message is from the user's role
                      const isUserMessage = (agent === 'BUYER' && userIsBuyer) || (agent === 'SELLER' && !userIsBuyer);
                      const agentLabel = agent === 'BUYER'
                        ? (userIsBuyer ? 'Käufer (Sie)' : 'Käufer')
                        : agent === 'SELLER'
                          ? (userIsBuyer ? 'Verkäufer' : 'Verkäufer (Sie)')
                          : agent;

                      return (
                        <Card key={index} className={agent === 'BUYER' ? 'bg-blue-50/50 border-blue-200' : 'bg-green-50/50 border-green-200'}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant={agent === 'BUYER' ? 'default' : 'secondary'} className="text-xs">
                                  {agentLabel}
                                </Badge>
                                <span className="text-xs text-muted-foreground">Turn {turn}</span>
                                {confidence && (
                                  <Badge variant="outline" className="text-xs">
                                    Confidence: {(confidence * 100).toFixed(0)}%
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {reasoning && (
                              <div>
                                <p className="text-sm font-medium mb-1">Message:</p>
                                <p className="text-sm leading-relaxed">
                                  {reasoning}
                                </p>
                              </div>
                            )}

                            {dimensionText && (
                              <div className="bg-white/50 p-2 rounded border">
                                <p className="text-xs font-medium mb-1">Offer Dimensions:</p>
                                <p className="text-xs text-muted-foreground font-mono">
                                  {dimensionText}
                                </p>
                              </div>
                            )}

                            {message.batna_assessment && (
                              <div className="text-xs text-muted-foreground">
                                <span className="font-medium">BATNA Assessment:</span> {(message.batna_assessment * 100).toFixed(0)}%
                              </div>
                            )}

                            {message.internal_analysis && (
                              <div className="bg-white/50 p-2 rounded border">
                                <p className="text-xs font-medium mb-1">Internal Analysis:</p>
                                <p className="text-xs text-muted-foreground italic">
                                  {message.internal_analysis}
                                </p>
                              </div>
                            )}

                            {message.walk_away_threshold !== undefined && (
                              <div className="text-xs text-muted-foreground">
                                <span className="font-medium">Walk Away Threshold:</span> {(message.walk_away_threshold * 100).toFixed(0)}%
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-6 text-center text-sm text-muted-foreground">
                      No conversation log available
                    </CardContent>
                  </Card>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
