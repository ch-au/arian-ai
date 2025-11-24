import type { NegotiationListItem, NegotiationStatus, NegotiationScenario } from "@/hooks/use-negotiations";
import { translateNegotiationStatus } from "@/hooks/use-negotiations";

export interface ReportEntry {
  id: string;
  title: string;
  status: NegotiationStatus;
  statusLabel: string;
  createdAt?: string;
  updatedAt?: string;
  companyLabel: string;
  counterpartLabel: string;
  marketLabel: string;
  userRole?: NegotiationScenario["userRole"];
  techniqueCount: number;
  tacticCount: number;
  simulationStats: NegotiationListItem["simulationStats"];
  summary: string;
}

export interface ReportFilters {
  search?: string;
  statuses?: NegotiationStatus[];
  roles?: NegotiationScenario["userRole"][];
  from?: Date;
  to?: Date;
}

function normalizeDate(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildReportEntries(negotiations: NegotiationListItem[]): ReportEntry[] {
  return negotiations.map((negotiation) => {
    const scenario = negotiation.scenario ?? {};
    const company = scenario.companyProfile?.organization ?? negotiation.title;
    const counterpart = scenario.counterpartProfile?.name ?? "Gegenpartei offen";
    const market = scenario.market?.name ?? "Markt offen";

    return {
      id: negotiation.id,
      title: negotiation.title,
      status: negotiation.status,
      statusLabel: translateNegotiationStatus(negotiation.status),
      createdAt: negotiation.createdAt,
      updatedAt: negotiation.updatedAt,
      companyLabel: company,
      counterpartLabel: counterpart,
      marketLabel: market,
      userRole: scenario.userRole,
      techniqueCount: negotiation.techniqueCount,
      tacticCount: negotiation.tacticCount,
      simulationStats: negotiation.simulationStats,
      summary: negotiation.summary,
    };
  });
}

export function filterReportEntries(entries: ReportEntry[], filters: ReportFilters): ReportEntry[] {
  const { search, statuses, roles, from, to } = filters;
  const searchValue = search?.trim().toLowerCase() ?? "";

  return entries.filter((entry) => {
    if (statuses && statuses.length > 0 && !statuses.includes(entry.status)) {
      return false;
    }

    if (roles && roles.length > 0) {
      if (!entry.userRole || !roles.includes(entry.userRole)) {
        return false;
      }
    }

    if (from || to) {
      const createdAtDate = normalizeDate(entry.createdAt);
      if (createdAtDate) {
        if (from && createdAtDate < from) {
          return false;
        }
        if (to) {
          const endOfDay = new Date(to);
          endOfDay.setHours(23, 59, 59, 999);
          if (createdAtDate > endOfDay) {
            return false;
          }
        }
      }
    }

    if (searchValue) {
      const haystack = [
        entry.title,
        entry.companyLabel,
        entry.counterpartLabel,
        entry.marketLabel,
        entry.summary,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(searchValue)) {
        return false;
      }
    }

    return true;
  });
}
