/**
 * Active Runs List Component
 * Displays all simulation runs with expandable conversation logs
 * Refactored from Table to List/Card view for better width utilization
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, MessageSquare, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";

interface SimulationRun {
  id: string;
  techniqueId: string;
  techniqueName?: string;
  tacticId: string;
  tacticName?: string;
  status: "pending" | "running" | "completed" | "failed";
  currentRound: number;
  maxRounds: number;
  dealValue?: number | string | null;
  actualCost?: number | string | null;
  zopaDistance?: string | null;
  conversationLog?: ConversationMessage[];
  roundDimensions?: Array<{ round: number; dimension: string; value: number }>;
  errorMessage?: string;
  startedAt?: string | Date;
  completedAt?: string | Date;
}

interface ConversationMessage {
  round: number;
  speaker?: "buyer" | "seller";
  agent?: string;
  message: string;
  timestamp?: string | Date;
  offer?: any;
}

interface ActiveRunsTableProps {
  runs: SimulationRun[];
  onViewConversation?: (runId: string) => void;
}

function getStatusBadge(status: SimulationRun["status"]) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Abgeschlossen
        </Badge>
      );
    case "running":
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Laufend
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Fehlgeschlagen
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
          <Clock className="w-3 h-3 mr-1" />
          Wartend
        </Badge>
      );
  }
}

function SimulationRunCard({ run }: { run: SimulationRun }) {
  const [isOpen, setIsOpen] = useState(false);

  const formatDealValue = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return "—";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return isNaN(num) ? "—" : `€${num.toFixed(0)}`;
  };

  // Helper to flatten nested objects for display
  const flattenObject = (obj: any, prefix = ''): Record<string, any> => {
    if (!obj || typeof obj !== 'object') return {};
    
    return Object.keys(obj).reduce((acc: Record<string, any>, key) => {
      const value = obj[key];
      const newKey = prefix ? `${prefix} ${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(acc, flattenObject(value, newKey));
      } else {
        acc[newKey] = value;
      }
      return acc;
    }, {});
  };

  const formatKey = (key: string) => {
    return key
      .split(/[_ ]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const formatOfferValue = (val: any): string | null => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') {
      // Check if it looks like a currency amount
      if (val > 0 && val < 1000 && val % 1 !== 0) return `€${val.toFixed(2)}`;
      return String(val);
    }
    return String(val);
  };

  const renderComparisonTable = (sellerOffer: any, buyerOffer: any) => {
    if (!sellerOffer && !buyerOffer) return null;

    // Flatten and filter offers
    const flatSeller = flattenObject(sellerOffer);
    const flatBuyer = flattenObject(buyerOffer);
    
    // Filter out internal keys
    const ignoredKeys = ['reasoning', 'confidence', 'sender', 'recipient', 'timestamp', 'round'];
    const filterKeys = (keys: string[]) => keys.filter(k => !ignoredKeys.some(ignored => k.toLowerCase().includes(ignored)));

    const sellerKeys = filterKeys(Object.keys(flatSeller));
    const buyerKeys = filterKeys(Object.keys(flatBuyer));
    const allKeys = Array.from(new Set([...sellerKeys, ...buyerKeys])).sort();

    if (allKeys.length === 0) return null;

    return (
      <div className="mt-4 border rounded-lg overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50/80 text-slate-500 font-medium border-b text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 w-1/3 font-semibold">Dimension</th>
              <th className="px-4 py-3 w-1/3 text-emerald-700 font-semibold">Verkäufer</th>
              <th className="px-4 py-3 w-1/3 text-blue-700 font-semibold">Käufer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {allKeys.map((key) => {
              const sellerVal = flatSeller[key] !== undefined ? formatOfferValue(flatSeller[key]) : null;
              const buyerVal = flatBuyer[key] !== undefined ? formatOfferValue(flatBuyer[key]) : null;
              
              if (!sellerVal && !buyerVal) return null;

              return (
                <tr key={key} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-700">{formatKey(key)}</td>
                  <td className="px-4 py-2.5 text-emerald-900">
                    {sellerVal ? (
                      <span className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        {sellerVal}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-blue-900">
                    {buyerVal ? (
                      <span className="bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        {buyerVal}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg bg-white shadow-sm">
      <div className="p-4 flex items-center gap-4">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="p-0 h-8 w-8 hover:bg-slate-100 rounded-full shrink-0">
            {isOpen ? (
              <ChevronDown className="w-5 h-5 text-slate-500" />
            ) : (
              <ChevronRight className="w-5 h-5 text-slate-500" />
            )}
          </Button>
        </CollapsibleTrigger>
        
        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div className="flex flex-col gap-1 md:col-span-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900 text-lg">
                {run.techniqueName || run.techniqueId}
              </span>
              {getStatusBadge(run.status)}
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <span className="font-medium">{run.tacticName || run.tacticId}</span>
            </div>
          </div>

          <div className="flex items-center gap-6 md:col-span-2 justify-start md:justify-end text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Runde:</span>
              <span className="font-mono font-medium">{run.currentRound}/{run.maxRounds}</span>
            </div>
            {run.dealValue && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Deal:</span>
                <span className="font-mono font-bold text-green-700">{formatDealValue(run.dealValue)}</span>
              </div>
            )}
            {run.conversationLog && run.conversationLog.length > 0 && (
              <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                <MessageSquare className="w-3 h-3" />
                <span className="text-xs font-medium">{run.conversationLog.length}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <CollapsibleContent>
        <div className="border-t bg-slate-50/50 p-4 md:p-6 space-y-6">
          {run.errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 flex items-start gap-3">
              <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Simulation fehlgeschlagen</div>
                <div>{run.errorMessage}</div>
              </div>
            </div>
          )}

          {run.conversationLog && run.conversationLog.length > 0 ? (
            <div className="space-y-8">
              {Array.from(new Set(run.conversationLog.map(m => m.round))).sort((a, b) => a - b).map(roundNum => {
                const roundMessages = run.conversationLog!.filter(m => m.round === roundNum);
                const roundDims = run.roundDimensions?.filter(d => d.round === roundNum) || [];
                
                // Handle both "speaker" (legacy) and "agent" (new) fields
                const buyerMsg = roundMessages.find(m => 
                  (m.speaker === "buyer") || (m.agent && m.agent.toLowerCase() === "buyer")
                );
                const sellerMsg = roundMessages.find(m => 
                  (m.speaker === "seller") || (m.agent && m.agent.toLowerCase() === "seller")
                );

                // Determine who starts (first message in round)
                const firstMessage = roundMessages[0];
                const buyerStarts = firstMessage && (
                  (firstMessage.speaker === "buyer") || 
                  (firstMessage.agent && firstMessage.agent.toLowerCase() === "buyer")
                );

                return (
                  <div key={roundNum} className="relative">
                    <div className="absolute left-0 right-0 top-0 flex items-center justify-center -mt-3">
                      <span className="bg-slate-200 text-slate-600 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                        Runde {roundNum}
                      </span>
                    </div>
                    
                    <div className="border rounded-xl p-4 pt-6 bg-white shadow-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                        {/* Seller Side (User) - Left */}
                        <div className="flex flex-col h-full gap-3">
                          <div className="flex items-center justify-between shrink-0">
                            <span className="text-sm font-bold text-emerald-700 flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                              Verkäufer (User/AI)
                            </span>
                            {!buyerStarts && (
                              <Badge variant="secondary" className="text-[10px] h-5">Startet</Badge>
                            )}
                          </div>
                          
                          <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-3 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap flex-1">
                            {sellerMsg?.message || <span className="text-slate-400 italic">Keine Nachricht</span>}
                          </div>
                        </div>

                        {/* Buyer Side (AI) - Right */}
                        <div className="flex flex-col h-full gap-3">
                          <div className="flex items-center justify-between shrink-0">
                            <span className="text-sm font-bold text-blue-700 flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                              Käufer (AI)
                            </span>
                            {buyerStarts && (
                              <Badge variant="secondary" className="text-[10px] h-5">Startet</Badge>
                            )}
                          </div>

                          <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap flex-1">
                            {buyerMsg?.message || <span className="text-slate-400 italic">Keine Nachricht</span>}
                          </div>
                        </div>
                      </div>

                      {/* Comparison Table */}
                      {(sellerMsg?.offer || buyerMsg?.offer) && renderComparisonTable(sellerMsg?.offer, buyerMsg?.offer)}

                      {/* Legacy Round Results Fallback */}
                      {roundDims.length > 0 && !buyerMsg?.offer && !sellerMsg?.offer && (
                        <div className="mt-4 flex flex-wrap gap-3 justify-center">
                          {roundDims.map((dim, i) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-md border text-xs">
                              <span className="font-medium text-slate-500">{dim.dimension}</span>
                              <span className="font-bold font-mono text-slate-900">{dim.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 flex flex-col items-center gap-2">
              <MessageSquare className="w-8 h-8 text-slate-300" />
              <p>Noch keine Gespräche aufgezeichnet.</p>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ActiveRunsTable({ runs }: ActiveRunsTableProps) {
  const sortedRuns = [...runs].sort((a, b) => {
    // Sort by status: running > pending > completed > failed
    const statusOrder = { running: 0, pending: 1, completed: 2, failed: 3 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-semibold text-slate-900">Simulationen</h2>
        <Badge variant="outline" className="bg-white">{runs.length} gesamt</Badge>
      </div>
      
      {sortedRuns.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {sortedRuns.map((run) => (
            <SimulationRunCard key={run.id} run={run} />
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            Keine Simulationen gefunden.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function ActiveRunsTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-lg border animate-pulse" />
        ))}
      </div>
    </div>
  );
}
