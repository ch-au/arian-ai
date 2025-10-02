/**
 * Progress Dashboard Component
 * Clean, focused view of simulation progress and controls
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Timer,
  DollarSign,
  RefreshCw,
  PlayCircle,
  PauseCircle,
  StopCircle,
  RotateCcw,
  AlertCircle,
} from "lucide-react";

interface ProgressDashboardProps {
  queueStatus: any;
  overview: {
    completed: any[];
    running: any[];
    outstanding: any[];
    failed: any[];
    timeout: any[];
  };
  currentActivity?: string;
  realTimeUpdates: boolean;
  buttonLoading: any;
  error?: string | null;
  onRefresh: () => void;
  onStartQueue?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onRestartFailed?: () => void;
}

function getStatusBadge(status: string) {
  const variants: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    pending: { color: "bg-gray-500", icon: <Clock className="w-3 h-3" />, label: "Pending" },
    running: { color: "bg-blue-500", icon: <Activity className="w-3 h-3" />, label: "Running" },
    completed: { color: "bg-green-500", icon: <CheckCircle2 className="w-3 h-3" />, label: "Completed" },
    failed: { color: "bg-red-500", icon: <XCircle className="w-3 h-3" />, label: "Failed" },
    paused: { color: "bg-yellow-500", icon: <PauseCircle className="w-3 h-3" />, label: "Paused" },
  };

  const variant = variants[status] || variants.pending;

  return (
    <Badge className={`${variant.color} text-white`}>
      {variant.icon}
      <span className="ml-1">{variant.label}</span>
    </Badge>
  );
}

export function ProgressDashboard({
  queueStatus,
  overview,
  currentActivity,
  realTimeUpdates,
  buttonLoading,
  error,
  onRefresh,
  onStartQueue,
  onPause,
  onResume,
  onStop,
  onRestartFailed,
}: ProgressDashboardProps) {
  const totalCompleted = overview.completed.length + overview.failed.length + overview.timeout.length;
  const progressPercentage = queueStatus ? (totalCompleted / queueStatus.totalSimulations) * 100 : 0;

  const hasOutstandingWork = overview.outstanding.length > 0 || overview.running.length > 0;
  const hasFailedWork = overview.failed.length + overview.timeout.length > 0;

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Queue Status</CardTitle>
            <div className="flex items-center gap-3">
              {queueStatus && getStatusBadge(queueStatus.status)}
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <div className={`w-2 h-2 rounded-full ${realTimeUpdates ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                {realTimeUpdates ? "Live" : "Polling"}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {totalCompleted} / {queueStatus?.totalSimulations || 0} simulations
              </span>
              <span className="text-gray-600">{progressPercentage.toFixed(0)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Current Activity */}
          {(overview.running.length > 0 || currentActivity) && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-blue-800">Current Activity</span>
              </div>
              <p className="text-sm text-blue-700">
                {currentActivity || `${overview.running.length} simulation(s) running...`}
              </p>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{overview.completed.length}</div>
              <div className="text-xs text-gray-600">✅ Completed</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{overview.running.length}</div>
              <div className="text-xs text-gray-600">🔄 Running</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{overview.outstanding.length}</div>
              <div className="text-xs text-gray-600">⏳ Pending</div>
            </div>
          </div>

          {/* Failed/Timeout Stats */}
          {hasFailedWork && (
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="text-xl font-bold text-red-600">{overview.failed.length}</div>
                <div className="text-xs text-red-700">❌ Failed</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-xl font-bold text-orange-600">{overview.timeout.length}</div>
                <div className="text-xs text-orange-700">⏱️ Timeout</div>
              </div>
            </div>
          )}

          {/* Cost */}
          {queueStatus && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-600" />
                <span className="text-gray-700">Total Cost</span>
              </div>
              <span className="font-medium">
                €{queueStatus.actualCost.toFixed(2)} / €{queueStatus.estimatedCost.toFixed(2)}
              </span>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Primary Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button onClick={onRefresh} size="sm" variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>

            {queueStatus?.status === "running" && onPause && (
              <Button onClick={onPause} size="sm" variant="outline" disabled={buttonLoading.pause}>
                {buttonLoading.pause ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <PauseCircle className="h-4 w-4 mr-2" />
                )}
                {buttonLoading.pause ? "Pausing..." : "Pause"}
              </Button>
            )}

            {queueStatus?.status === "paused" && onResume && (
              <Button onClick={onResume} size="sm" variant="outline" disabled={buttonLoading.resume}>
                {buttonLoading.resume ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4 mr-2" />
                )}
                {buttonLoading.resume ? "Resuming..." : "Resume"}
              </Button>
            )}

            {onStop && (
              <Button onClick={onStop} size="sm" variant="destructive" disabled={buttonLoading.stop}>
                {buttonLoading.stop ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <StopCircle className="h-4 w-4 mr-2" />
                )}
                {buttonLoading.stop ? "Stopping..." : "Stop"}
              </Button>
            )}
          </div>

          {/* Queue Actions */}
          {hasOutstandingWork && onStartQueue && (
            <Button
              onClick={onStartQueue}
              disabled={buttonLoading.startQueue || queueStatus?.status === "running"}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {buttonLoading.startQueue ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4 mr-2" />
              )}
              {buttonLoading.startQueue
                ? "Starting..."
                : `Start Queue (${overview.outstanding.length} pending)`}
            </Button>
          )}

          {hasFailedWork && onRestartFailed && (
            <Button
              onClick={onRestartFailed}
              variant="outline"
              disabled={buttonLoading.restartFailed}
              className="w-full border-orange-600 text-orange-700 hover:bg-orange-50"
            >
              {buttonLoading.restartFailed ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              {buttonLoading.restartFailed
                ? "Restarting..."
                : `Restart ${overview.failed.length + overview.timeout.length} Failed`}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
