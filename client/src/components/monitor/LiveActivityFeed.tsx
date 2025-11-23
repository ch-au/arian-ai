/**
 * Live Activity Feed Component
 * Shows recent events from WebSocket in real-time
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  XCircle,
  MessageSquare,
  Play,
  Clock
} from "lucide-react";

export interface ActivityEvent {
  id: string;
  type: "simulation_started" | "round_completed" | "simulation_completed" | "simulation_failed";
  timestamp: Date;
  runId: string;
  technique?: string;
  tactic?: string;
  round?: number;
  message?: string;
}

interface LiveActivityFeedProps {
  events: ActivityEvent[];
  maxEvents?: number;
}

function getEventIcon(type: ActivityEvent["type"]) {
  switch (type) {
    case "simulation_started":
      return <Play className="w-4 h-4 text-blue-600" />;
    case "round_completed":
      return <MessageSquare className="w-4 h-4 text-gray-600" />;
    case "simulation_completed":
      return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    case "simulation_failed":
      return <XCircle className="w-4 h-4 text-red-600" />;
  }
}

function getEventLabel(type: ActivityEvent["type"]) {
  switch (type) {
    case "simulation_started":
      return "Gestartet";
    case "round_completed":
      return "Runde";
    case "simulation_completed":
      return "Abgeschlossen";
    case "simulation_failed":
      return "Fehlgeschlagen";
  }
}

function formatTimestamp(date: Date): string {
  const now = Date.now();
  const diffSeconds = Math.round((date.getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat("de", { numeric: "auto" });

  if (Math.abs(diffSeconds) < 60) return rtf.format(diffSeconds, "second");
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");
  return date.toLocaleString("de-DE");
}

export function LiveActivityFeed({ events, maxEvents = 50 }: LiveActivityFeedProps) {
  const displayEvents = events.slice(0, maxEvents);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Live-Aktivität</span>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Live
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {displayEvents.length > 0 ? (
              displayEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="mt-0.5">{getEventIcon(event.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {getEventLabel(event.type)}
                      </Badge>
                      <span className="text-xs text-gray-500 font-mono">
                        {event.runId.slice(0, 8)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800">
                      {event.technique && event.tactic && (
                        <>
                          <span className="font-medium">{event.technique}</span>
                          {" × "}
                          <span className="font-medium">{event.tactic}</span>
                        </>
                      )}
                      {event.round && (
                        <span className="text-gray-600"> · Runde {event.round}</span>
                      )}
                    </p>
                    {event.message && (
                      <p className="text-xs text-gray-600 mt-1 truncate">
                        {event.message}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    {formatTimestamp(event.timestamp)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">Noch keine Ereignisse</p>
                <p className="text-xs text-gray-400 mt-1">
                  Sobald Simulationen laufen, erscheinen hier Updates.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export function LiveActivityFeedSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
