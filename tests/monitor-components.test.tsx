/* @vitest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SimulationQueueOverview } from "@/components/monitor/SimulationQueueOverview";
import { LiveActivityFeed } from "@/components/monitor/LiveActivityFeed";

describe("Monitor components", () => {
  it("renders localized queue overview", () => {
    render(
      <SimulationQueueOverview
        totalRuns={4}
        completedRuns={2}
        runningRuns={1}
        pendingRuns={1}
        failedRuns={0}
        estimatedTimeRemaining={125}
      />,
    );

    expect(screen.getByText("Fortschritt der Simulationen")).toBeInTheDocument();
    expect(screen.getByText(/Simulationen abgeschlossen/)).toBeInTheDocument();
    expect(screen.getByText("Aktiv laufend")).toBeInTheDocument();
  });

  it("shows localized live activity feed entries", () => {
    render(
      <LiveActivityFeed
        events={[
          {
            id: "evt-1",
            type: "simulation_started",
            timestamp: new Date(),
            runId: "run-12345678",
            technique: "Strategie A",
            tactic: "Taktik B",
          },
        ]}
      />,
    );

    expect(screen.getByText("Live-Aktivität")).toBeInTheDocument();
    expect(screen.getByText("Gestartet")).toBeInTheDocument();
    expect(screen.getByText("Strategie A")).toBeInTheDocument();
    expect(screen.getByText("Taktik B")).toBeInTheDocument();
  });
});
