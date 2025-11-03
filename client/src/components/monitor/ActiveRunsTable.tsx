/**
 * Active Runs Table Component
 * Displays all simulation runs with expandable conversation logs
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  conversationLog?: ConversationMessage[];
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
}

interface ConversationMessage {
  round: number;
  speaker: "buyer" | "seller";
  message: string;
  timestamp: Date;
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
          Completed
        </Badge>
      );
    case "running":
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Running
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Failed
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
  }
}

function SimulationRunRow({ run }: { run: SimulationRun }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <TableRow className="hover:bg-gray-50">
        <TableCell className="w-8">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
              {isOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </TableCell>
        <TableCell className="font-mono text-xs text-gray-500">
          {run.id.slice(0, 8)}
        </TableCell>
        <TableCell>{run.techniqueName || run.techniqueId.slice(0, 8)}</TableCell>
        <TableCell>{run.tacticName || run.tacticId.slice(0, 8)}</TableCell>
        <TableCell>{getStatusBadge(run.status)}</TableCell>
        <TableCell>
          {run.currentRound} / {run.maxRounds}
        </TableCell>
        <TableCell>
          {run.conversationLog && run.conversationLog.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              className="text-blue-600 hover:text-blue-800"
            >
              <MessageSquare className="w-4 h-4 mr-1" />
              View ({run.conversationLog.length})
            </Button>
          )}
        </TableCell>
      </TableRow>

      <CollapsibleContent asChild>
        <TableRow>
          <TableCell colSpan={7} className="bg-gray-50 p-0">
            <div className="p-4 space-y-2">
              {run.errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                  <strong>Error:</strong> {run.errorMessage}
                </div>
              )}

              {run.conversationLog && run.conversationLog.length > 0 ? (
                <div className="bg-white border rounded-lg p-4 max-h-96 overflow-y-auto space-y-3">
                  <h4 className="font-semibold text-sm text-gray-900 mb-3">
                    Conversation Log
                  </h4>
                  {run.conversationLog.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 ${
                        msg.speaker === "buyer" ? "justify-start" : "justify-end"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.speaker === "buyer"
                            ? "bg-blue-50 border border-blue-200"
                            : "bg-green-50 border border-green-200"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-700">
                            {msg.speaker === "buyer" ? "Buyer" : "Seller"}
                          </span>
                          <span className="text-xs text-gray-500">Round {msg.round}</span>
                        </div>
                        <p className="text-sm text-gray-800">{msg.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No conversation logs yet
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Simulation Runs</span>
          <Badge variant="outline">{runs.length} total</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-8"></TableHead>
                <TableHead>Run ID</TableHead>
                <TableHead>Technique</TableHead>
                <TableHead>Tactic</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rounds</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRuns.length > 0 ? (
                sortedRuns.map((run) => (
                  <SimulationRunRow key={run.id} run={run} />
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No simulation runs found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function ActiveRunsTableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
