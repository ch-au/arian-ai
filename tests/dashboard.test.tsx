/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Dashboard from "@/pages/dashboard";
import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const setLocationMock = vi.fn();

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useLocation: () => ["/", setLocationMock],
  };
});

describe("Dashboard page", () => {
  const renderWithData = (options: {
    metrics?: any;
    successTrends?: any[];
    topAgents?: any[];
    negotiations?: any[];
    evaluationStats?: any;
  }) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false,
          queryFn: async () => null,
        },
      },
    });

    queryClient.setQueryData(["/api/dashboard/metrics"], options.metrics);
    queryClient.setQueryData(["/api/dashboard/success-trends"], options.successTrends);
    queryClient.setQueryData(["/api/dashboard/top-agents"], options.topAgents);
    queryClient.setQueryData(["/api/negotiations"], options.negotiations);
    queryClient.setQueryData(
      ["/api/dashboard/evaluation-status"],
      options.evaluationStats ?? {
        total: 0,
        evaluated: 0,
        needingEvaluation: 0,
        evaluationRate: 0,
      },
    );
    
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return render(<Dashboard />, { wrapper });
  };

  beforeEach(() => {
    setLocationMock.mockClear();
  });

  it("renders metrics, trends, top agents and live negotiations from cached data", () => {
    renderWithData({
      metrics: {
        activeNegotiations: 3,
        successRate: 82.5,
        avgDuration: 12.3,
        apiCostToday: 4.56,
        recentTrend: {
          activeNegotiationsChange: 5,
          successRateChange: 2,
          avgDurationChange: -1,
          apiCostChange: -3,
        },
      },
      successTrends: [
        { date: "2024-01-01", successRate: 80 },
        { date: "2024-01-02", successRate: 84 },
      ],
      topAgents: [
        {
          agent: {
            id: "agent-1",
            name: "Negotiator One",
            personalityProfile: { agreeableness: 0.8, conscientiousness: 0.6, extraversion: 0.5, openness: 0.4, neuroticism: 0.2 },
          },
          successRate: 91,
          totalNegotiations: 12,
          avgResponseTime: 1200,
          totalApiCost: 12.34,
        },
      ],
      negotiations: [
        {
          id: "neg-1",
          title: "Enterprise Deal",
          status: "running",
          simulationStats: {
            totalRuns: 4,
            completedRuns: 1,
            runningRuns: 1,
            failedRuns: 0,
            pendingRuns: 2,
            successRate: 0,
            isPlanned: true,
          },
          scenario: {
            userRole: "seller",
            selectedTechniques: ["tech"],
            selectedTactics: ["tactic"],
            companyProfile: { organization: "Demo GmbH" },
            counterpartProfile: { name: "Retailer AG" },
            market: { name: "DACH Grocery" },
          },
        },
      ],
      evaluationStats: {
        total: 2,
        evaluated: 1,
        needingEvaluation: 1,
        evaluationRate: 50,
      },
    });

    expect(screen.getAllByText("Aktive Verhandlungen").length).toBeGreaterThan(0);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Negotiator One")).toBeInTheDocument();
    expect(screen.getAllByText("Demo GmbH ↔ Retailer AG").length).toBeGreaterThan(0);
    expect(screen.getByText("Alle Verhandlungen anzeigen")).toBeInTheDocument();
    expect(screen.getByText("KI-Auswertungen")).toBeInTheDocument();
  });

  it("handles missing data gracefully", () => {
    renderWithData({});

    expect(screen.getAllByText("Aktive Verhandlungen").length).toBeGreaterThan(0);
    expect(screen.getByText("Keine aktiven Verhandlungen")).toBeInTheDocument();
  });

  it("navigates to configure page when creating a new negotiation", () => {
    renderWithData({
      metrics: {
        activeNegotiations: 0,
        successRate: 0,
        avgDuration: 0,
        apiCostToday: 0,
        recentTrend: { activeNegotiationsChange: 0, successRateChange: 0, avgDurationChange: 0, apiCostChange: 0 },
      },
      successTrends: [],
      topAgents: [],
      negotiations: [],
    });

    const buttons = screen.getAllByLabelText("Neue Verhandlung");
    fireEvent.click(buttons[0]);
    expect(setLocationMock).toHaveBeenCalledWith("/configure");
  });
});
