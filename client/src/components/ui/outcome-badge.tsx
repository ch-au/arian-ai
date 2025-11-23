/**
 * Outcome Badge Component
 * Displays negotiation outcome with appropriate color coding
 */

import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, StopCircle, AlertCircle, Clock } from "lucide-react";

type NegotiationOutcome =
  | "DEAL_ACCEPTED"
  | "WALK_AWAY"
  | "TERMINATED"
  | "MAX_ROUNDS_REACHED"
  | "PAUSED"
  | "ERROR"
  | string;

interface OutcomeBadgeProps {
  outcome: NegotiationOutcome | null | undefined;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

const outcomeConfig: Record<string, {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  DEAL_ACCEPTED: {
    label: "Deal akzeptiert",
    color: "bg-green-500 hover:bg-green-600 text-white border-green-600",
    icon: CheckCircle,
  },
  WALK_AWAY: {
    label: "Walk Away",
    color: "bg-red-500 hover:bg-red-600 text-white border-red-600",
    icon: XCircle,
  },
  TERMINATED: {
    label: "Abgebrochen",
    color: "bg-orange-500 hover:bg-orange-600 text-white border-orange-600",
    icon: StopCircle,
  },
  MAX_ROUNDS_REACHED: {
    label: "Timeout",
    color: "bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-600",
    icon: Clock,
  },
  PAUSED: {
    label: "Pausiert",
    color: "bg-gray-500 hover:bg-gray-600 text-white border-gray-600",
    icon: AlertCircle,
  },
  ERROR: {
    label: "Fehler",
    color: "bg-red-700 hover:bg-red-800 text-white border-red-800",
    icon: XCircle,
  },
};

export function OutcomeBadge({ outcome, size = "md", showIcon = true }: OutcomeBadgeProps) {
  if (!outcome) {
    return (
      <Badge variant="outline" className="text-gray-400">
        N/A
      </Badge>
    );
  }

  const config = outcomeConfig[outcome] || {
    label: outcome,
    color: "bg-gray-500 hover:bg-gray-600 text-white border-gray-600",
    icon: AlertCircle,
  };

  const Icon = config.icon;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  };

  return (
    <Badge className={`${config.color} ${sizeClasses[size]} inline-flex items-center gap-1.5`}>
      {showIcon && <Icon className={iconSizes[size]} />}
      <span>{config.label}</span>
    </Badge>
  );
}

/**
 * Compact version for use in tables (mini badge)
 */
export function OutcomeBadgeMini({ outcome }: { outcome: NegotiationOutcome | null | undefined }) {
  return <OutcomeBadge outcome={outcome} size="sm" showIcon={true} />;
}
