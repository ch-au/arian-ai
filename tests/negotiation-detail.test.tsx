/** @vitest-environment jsdom */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const navigateSpy = vi.fn();
const fetchMock = vi.fn();

vi.mock("wouter", () => ({
  useRoute: () => [true, { id: "neg-1" }],
  useLocation: () => ["/negotiations/neg-1", navigateSpy],
}));


vi.mock("@/hooks/use-negotiation-detail", () => {
  const data = {
    negotiation: {
      id: "neg-1",
      title: "Test Negotiation",
      description: "",
      status: "planned",
      scenario: {
        userRole: "seller",
        negotiationType: "Jahresgespräch",
        negotiationFrequency: "jährlich",
        companyProfile: { organization: "Demo Foods", country: "DE" },
        counterpartProfile: { name: "Retailer AG", style: "partnerschaftlich", powerBalance: "50" },
        market: { name: "DACH Grocery", currencyCode: "EUR" },
        selectedTechniques: ["tech-1"],
        selectedTactics: ["tactic-1"],
        dimensions: [
          { id: "dim-1", name: "Preis", minValue: 0.9, maxValue: 1.2, targetValue: 1.0, priority: 1, unit: "EUR" },
        ],
      },
    },
    products: [{ id: "prod-1", name: "Schoko Riegel", brand: "Demo" }],
    simulationStats: {
      totalRuns: 4,
      completedRuns: 1,
      runningRuns: 1,
      failedRuns: 0,
      pendingRuns: 2,
      successRate: 25,
      isPlanned: true,
    },
  };

  return {
    useNegotiationDetail: () => ({ data, isLoading: false }),
  };
});

import NegotiationDetailPage from "@/pages/negotiation-detail";

describe("NegotiationDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("renders scenario summary and stats", () => {
    render(<NegotiationDetailPage />);

    expect(screen.getByText("Test Negotiation")).toBeInTheDocument();
    expect(screen.getByText(/Demo Foods ↔ Retailer AG/)).toBeInTheDocument();
    expect(screen.getByText("DACH Grocery")).toBeInTheDocument();
    expect(screen.getByText("Schoko Riegel")).toBeInTheDocument();
    expect(screen.getByText(/1\/4/)).toBeInTheDocument();
  });

  it("navigates to monitor when start clicked", async () => {
    render(<NegotiationDetailPage />);

    const [button] = screen.getAllByRole("button", { name: /Simulation starten/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/negotiations/neg-1/start", { method: "POST" });
      expect(navigateSpy).toHaveBeenCalledWith(`/monitor/${"neg-1"}`);
    });
  });
});
