/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Dashboard from "@/pages/dashboard";

const mocks = vi.hoisted(() => {
  return {
    setLocationMock: vi.fn(),
    toastMock: vi.fn(),
    apiRequestMock: vi.fn(),
    negotiationContextMock: { setSelectedNegotiationId: vi.fn() },
    defaultQueryFn: null as ReturnType<typeof vi.fn> | null,
    testQueryClient: null as QueryClient | null,
  };
});

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useLocation: () => ["/dashboard", mocks.setLocationMock],
  };
});

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toastMock }),
}));

vi.mock("@/hooks/use-websocket", () => ({
  useWebSocket: () => undefined,
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/contexts/negotiation-context", () => ({
  useNegotiationContext: () => mocks.negotiationContextMock,
}));

vi.mock("@/lib/queryClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queryClient")>("@/lib/queryClient");
  const { QueryClient } = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");

  if (!mocks.defaultQueryFn) {
    mocks.defaultQueryFn = vi.fn().mockResolvedValue(null);
  }
  if (!mocks.testQueryClient) {
    mocks.testQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Infinity,
          refetchOnWindowFocus: false,
          queryFn: mocks.defaultQueryFn,
        },
        mutations: {
          retry: false,
        },
      },
    });
  }

  return {
    ...actual,
    apiRequest: mocks.apiRequestMock,
    queryClient: mocks.testQueryClient,
  };
});

const negotiate = (overrides: Partial<any> = {}) => ({
  id: "neg-running",
  title: "Enterprise Deal",
  status: "running",
  scenario: {
    userRole: "buyer",
    maxRounds: 4,
    selectedTechniques: ["t1"],
    selectedTactics: ["ta1"],
    companyProfile: { organization: "Demo GmbH" },
    counterpartProfile: { name: "Retailer AG" },
  },
  simulationStats: {
    totalRuns: 3,
    completedRuns: 1,
    runningRuns: 1,
    failedRuns: 0,
    pendingRuns: 1,
    successRate: 0.33,
    isPlanned: false,
  },
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
  ...overrides,
});

const renderDashboard = () =>
  render(
    <QueryClientProvider client={mocks.testQueryClient!}>
      <Dashboard />
    </QueryClientProvider>,
  );

describe("Dashboard page", () => {
  beforeEach(() => {
    mocks.testQueryClient!.clear();
    mocks.defaultQueryFn!.mockClear();
    mocks.apiRequestMock.mockReset();
    mocks.toastMock.mockReset();
    mocks.setLocationMock.mockReset();
    mocks.negotiationContextMock.setSelectedNegotiationId.mockReset();
  });

  afterEach(() => {
    mocks.testQueryClient!.clear();
  });

  it("renders cached metrics and negotiation rows", () => {
    mocks.testQueryClient.setQueryData(["/api/dashboard/metrics"], {
      activeNegotiations: 1,
      successRate: 75,
      avgDuration: 6,
      runningNegotiations: 1,
      finishedNegotiations: 0,
      totalSimulationRuns: 3,
      recentTrend: {
        activeNegotiationsChange: 2,
        successRateChange: 1,
        avgDurationChange: -1,
        runningNegotiationsChange: 1,
        finishedNegotiationsChange: 0,
      },
    });
    mocks.testQueryClient.setQueryData(["/api/negotiations"], [negotiate()]);

    renderDashboard();

    expect(screen.getByText("Aktive Verhandlungen")).toBeInTheDocument();
    expect(screen.getByText("Enterprise Deal")).toBeInTheDocument();
    expect(screen.getByText("Demo GmbH ↔ Retailer AG")).toBeInTheDocument();
    expect(screen.getByText("Anzahl Simulationsläufe")).toBeInTheDocument();
  });

  it("stops all running negotiations and shows a success toast", async () => {
    const runningNegotiation = negotiate();
    const completedNegotiation = negotiate({
      id: "neg-completed",
      status: "completed",
      simulationStats: { totalRuns: 2, completedRuns: 2, runningRuns: 0, failedRuns: 0, pendingRuns: 0, successRate: 1, isPlanned: false },
    });

    mocks.apiRequestMock.mockImplementation(async (method: string, url: string) => {
      if (method === "GET") {
        expect(url).toContain(runningNegotiation.id);
        return { json: async () => [{ id: "queue-1", status: "running" }, { id: "queue-2", status: "completed" }] };
      }
      return { json: async () => ({ stopped: true }) };
    });

    mocks.testQueryClient.setQueryData(["/api/negotiations"], [runningNegotiation, completedNegotiation]);
    mocks.testQueryClient.setQueryData(["/api/dashboard/metrics"], null);

    renderDashboard();

    fireEvent.click(screen.getAllByRole("button", { name: /Alle stoppen/i })[0]);

    await waitFor(() => {
      expect(mocks.apiRequestMock).toHaveBeenCalledWith("POST", "/api/simulations/queue/queue-1/stop");
      expect(mocks.apiRequestMock).not.toHaveBeenCalledWith(expect.anything(), expect.stringContaining("queue-2/stop"));
      expect(mocks.toastMock).toHaveBeenCalledWith({
        title: "Alle Queues gestoppt",
        description: "Alle laufenden Simulationen wurden angehalten.",
      });
    });
  });

  it("navigates to the creation page when starting a new negotiation", () => {
    mocks.testQueryClient.setQueryData(["/api/negotiations"], []);
    mocks.testQueryClient.setQueryData(["/api/dashboard/metrics"], null);

    renderDashboard();

    fireEvent.click(screen.getAllByRole("button", { name: "Neue Verhandlung" })[0]);

    expect(mocks.setLocationMock).toHaveBeenCalledWith("/create-negotiation");
  });
});
