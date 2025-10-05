/**
 * Results Table with Individual Run Controls
 * Shows simulation results with ability to restart individual runs and view conversations
 */

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Eye,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  Timer,
  MessageSquare,
} from "lucide-react";

interface SimulationResult {
  id: string;
  runNumber: number;
  status: "pending" | "running" | "completed" | "failed" | "timeout";
  techniqueId: string;
  tacticId: string;
  totalRounds?: number;
  actualCost?: number;
  startedAt?: string;
  completedAt?: string;
  conversationLog?: any[];
  otherDimensions?: any;
  dealValue?: number | string;
}

interface ResultsTableProps {
  results: SimulationResult[];
  techniques: any[];
  tactics: any[];
  onRestartSingle?: (runId: string) => void;
  restarting?: Record<string, boolean>;
  negotiationId?: string;
}

function getStatusBadge(status: string) {
  const variants: Record<
    string,
    { color: string; icon: React.ReactNode; label: string }
  > = {
    pending: {
      color: "bg-gray-500",
      icon: <Clock className="w-3 h-3" />,
      label: "Pending",
    },
    running: {
      color: "bg-blue-500",
      icon: <Activity className="w-3 h-3 animate-pulse" />,
      label: "Running",
    },
    completed: {
      color: "bg-green-500",
      icon: <CheckCircle2 className="w-3 h-3" />,
      label: "Completed",
    },
    failed: {
      color: "bg-red-500",
      icon: <XCircle className="w-3 h-3" />,
      label: "Failed",
    },
    timeout: {
      color: "bg-orange-500",
      icon: <Timer className="w-3 h-3" />,
      label: "Timeout",
    },
  };

  const variant = variants[status] || variants.pending;

  return (
    <Badge className={`${variant.color} text-white text-xs`}>
      {variant.icon}
      <span className="ml-1">{variant.label}</span>
    </Badge>
  );
}

export function ResultsTable({
  results,
  techniques,
  tactics,
  onRestartSingle,
  restarting = {},
  negotiationId,
}: ResultsTableProps) {
  const [selectedConversation, setSelectedConversation] = useState<SimulationResult | null>(null);
  const [conversationModalOpen, setConversationModalOpen] = useState(false);

  const getTechniqueName = (techniqueId: string) => {
    const technique = techniques.find((t) => t.id === techniqueId);
    return technique?.name || techniqueId.slice(0, 8);
  };

  const getTacticName = (tacticId: string) => {
    const tactic = tactics.find((t) => t.id === tacticId);
    return tactic?.name || tacticId.slice(0, 8);
  };

  const formatDealValue = (result: any) => {
    // Use calculated dealValue if available (from database)
    if (result.dealValue) {
      const value = typeof result.dealValue === 'string'
        ? parseFloat(result.dealValue)
        : result.dealValue;
      return `€${value.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }

    // otherDimensions doesn't contain price/volume - those are stored separately
    // If dealValue is not set, show "-"
    return "-";
  };

  const formatOtherDimensions = (result: any) => {
    const otherDimensions = result.otherDimensions;
    if (!otherDimensions) return null;

    let parsed = otherDimensions;
    if (typeof otherDimensions === "string") {
      try {
        parsed = JSON.parse(otherDimensions);
      } catch {
        return null;
      }
    }

    // otherDimensions contains all non-price/volume negotiation terms
    // (e.g., contract duration, payment terms, delivery, etc.)
    return Object.keys(parsed || {}).length > 0 ? parsed : null;
  };

  const canRestart = (status: string) => {
    return status === "failed" || status === "timeout" || status === "completed";
  };

  if (results.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Simulation Results</CardTitle>
          <CardDescription>No simulation runs available yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Simulation Results ({results.length})</CardTitle>
            <CardDescription>
              View conversations and restart individual simulations
            </CardDescription>
          </div>
          {results.some(r => r.status === "completed") && negotiationId && (
            <Button
              onClick={() => {
                window.location.href = `/negotiations/${negotiationId}/analysis`;
              }}
              className="ml-auto"
            >
              📊 Ergebnisse analysieren
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-16">Run #</TableHead>
                  <TableHead>Technique</TableHead>
                  <TableHead>Tactic</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Rounds</TableHead>
                  <TableHead className="text-right">Deal Value</TableHead>
                  <TableHead>Other Dimensions</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={result.id} className="hover:bg-gray-50">
                    <TableCell className="font-mono font-semibold">
                      {result.runNumber}
                    </TableCell>
                    <TableCell
                      className="max-w-32 truncate"
                      title={getTechniqueName(result.techniqueId)}
                    >
                      {getTechniqueName(result.techniqueId)}
                    </TableCell>
                    <TableCell
                      className="max-w-32 truncate"
                      title={getTacticName(result.tacticId)}
                    >
                      {getTacticName(result.tacticId)}
                    </TableCell>
                    <TableCell>{getStatusBadge(result.status)}</TableCell>
                    <TableCell className="text-center">
                      {result.totalRounds || 0}
                    </TableCell>
                    <TableCell className="font-medium text-right">
                      {formatDealValue(result)}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const otherDims = formatOtherDimensions(result);
                        if (!otherDims) return <span className="text-gray-400 text-xs">-</span>;
                        return (
                          <div className="text-xs space-y-0.5">
                            {Object.entries(otherDims).map(([key, value]) => (
                              <div key={key} className="flex items-center gap-1">
                                <span className="text-gray-600 font-medium">{key}:</span>
                                <span className="font-mono">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      €{(result.actualCost || 0).toFixed(3)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-center">
                        {/* View Conversation */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedConversation(result);
                            setConversationModalOpen(true);
                          }}
                          title="View Conversation"
                          disabled={
                            !result.conversationLog ||
                            result.conversationLog.length === 0
                          }
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {/* Restart Single Run */}
                        {canRestart(result.status) && onRestartSingle && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRestartSingle(result.id)}
                            disabled={restarting[result.id]}
                            title="Restart this simulation"
                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          >
                            <RotateCcw
                              className={`h-4 w-4 ${
                                restarting[result.id] ? "animate-spin" : ""
                              }`}
                            />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Conversation Modal */}
      <Dialog open={conversationModalOpen} onOpenChange={setConversationModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Conversation - Run #{selectedConversation?.runNumber}
            </DialogTitle>
            <DialogDescription>
              {selectedConversation && (
                <>
                  {getTechniqueName(selectedConversation.techniqueId)} ×{" "}
                  {getTacticName(selectedConversation.tacticId)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedConversation && (
            <ScrollArea className="h-96 w-full border rounded">
              <div className="p-4 space-y-4">
                {selectedConversation.conversationLog &&
                selectedConversation.conversationLog.length > 0 ? (
                  selectedConversation.conversationLog.map(
                    (exchange: any, index: number) => (
                      <div key={index} className="border-b pb-4 last:border-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant={
                              exchange.agent === "BUYER" ? "default" : "secondary"
                            }
                          >
                            Round {exchange.round} - {exchange.agent}
                          </Badge>
                          {exchange.offer?.dimension_values?.Preis && (
                            <span className="text-xs text-gray-600 font-mono">
                              €{exchange.offer.dimension_values.Preis}
                            </span>
                          )}
                        </div>
                        <div className="text-sm mb-2">
                          {exchange.message || "[No message content]"}
                        </div>
                        {exchange.offer && (
                          <div className="bg-gray-50 p-2 rounded text-xs">
                            <strong>Offer:</strong>{" "}
                            {JSON.stringify(
                              exchange.offer.dimension_values,
                              null,
                              2
                            )}
                          </div>
                        )}
                      </div>
                    )
                  )
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">No conversation data available</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {selectedConversation.status === "pending"
                        ? "Simulation hasn't started yet"
                        : selectedConversation.status === "running"
                        ? "Simulation is in progress"
                        : "Simulation completed without logs"}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ResultsTableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
