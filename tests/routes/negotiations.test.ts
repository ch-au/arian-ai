import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../server/storage", () => {
  const storage = {
    getAllNegotiations: vi.fn(),
    getNegotiation: vi.fn(),
    getNegotiationById: vi.fn(),
    getActiveNegotiations: vi.fn(),
    getRecentNegotiations: vi.fn(),
    getNegotiationDimensions: vi.fn(),
    getNegotiationRounds: vi.fn(),
    getAllInfluencingTechniques: vi.fn(),
    getAllNegotiationTactics: vi.fn(),
    getTacticsByCategory: vi.fn(),
    getAllAgents: vi.fn(),
    getAllNegotiationContexts: vi.fn(),
    createNegotiationWithDimensions: vi.fn(),
    createNegotiationWithSimulationRuns: vi.fn(),
    updateNegotiation: vi.fn(),
    deleteNegotiation: vi.fn(),
    getSimulationRuns: vi.fn(),
    getSimulationRun: vi.fn(),
    updateNegotiationStatus: vi.fn(),
  };
  return { storage };
});

vi.mock("../../server/services/simulation-queue", () => {
  class SimulationQueueServiceMock {
    static getSimulationResultsByNegotiation = vi.fn();
    static createQueue = vi.fn();
  }
  return {
    SimulationQueueService: SimulationQueueServiceMock,
    setNegotiationEngine: vi.fn(),
  };
});

const { storage } = await import("../../server/storage");
const { SimulationQueueService } = await import("../../server/services/simulation-queue");
const { createNegotiationRouter } = await import("../../server/routes/negotiations");
const { createRouterInvoker } = await import("./utils");

const negotiationEngineMock = {
  stopNegotiation: vi.fn(),
};

function setupInvoker() {
  return createRouterInvoker(() => createNegotiationRouter(negotiationEngineMock as any));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Negotiation routes", () => {
  it("returns negotiations with simulation stats", async () => {
    storage.getAllNegotiations.mockResolvedValue([
      { id: "neg-1", selectedTechniques: [], selectedTactics: [], status: "configured" },
    ]);
    (SimulationQueueService as any).getSimulationResultsByNegotiation.mockResolvedValue([]);

    const { invoke } = setupInvoker();
    const res = await invoke("get", "/");

    expect(res.statusCode).toBe(200);
    expect(res.jsonData[0].simulationStats).toEqual({
      totalRuns: 0,
      completedRuns: 0,
      runningRuns: 0,
      failedRuns: 0,
      pendingRuns: 0,
      successRate: 0,
    });
  });

  it("creates enhanced negotiation with dimensions", async () => {
    storage.getAllAgents.mockResolvedValue([{ id: "agent-1" }, { id: "agent-2" }]);
    storage.getAllNegotiationContexts.mockResolvedValue([{ id: "context-1" }]);
    storage.getAllInfluencingTechniques.mockResolvedValue([{ id: "tech-1", name: "Technique" }]);
    storage.getAllNegotiationTactics.mockResolvedValue([{ id: "tactic-1", name: "Tactic" }]);
    storage.createNegotiationWithDimensions.mockResolvedValue({ id: "neg-123" });

    const payload = {
      title: "Test Deal",
      userRole: "buyer",
      negotiationType: "one-shot",
      relationshipType: "first",
      selectedTechniques: ["Technique"],
      selectedTactics: ["Tactic"],
      dimensions: [
        {
          id: "dim-1",
          name: "Price",
          minValue: 10,
          maxValue: 20,
          targetValue: 15,
          priority: 1,
        },
      ],
    };

    const { invoke } = setupInvoker();
    const res = await invoke("post", "/enhanced", { body: payload });

    expect(res.statusCode).toBe(201);
    expect(storage.createNegotiationWithDimensions).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Test Deal" }),
      [
        {
          name: "Price",
          minValue: "10",
          maxValue: "20",
          targetValue: "15",
          priority: 1,
          unit: null,
        },
      ],
    );
  });

  it("starts negotiation by creating simulation queue", async () => {
    storage.getNegotiation.mockResolvedValue({
      id: "neg-1",
      status: "configured",
      selectedTechniques: ["tech-1"],
      selectedTactics: ["tactic-1"],
      counterpartPersonality: "all-personalities",
      zopaDistance: "all-distances",
    });
    storage.updateNegotiationStatus.mockResolvedValue(undefined);
    (SimulationQueueService as any).createQueue.mockResolvedValue("queue-1");

    const { invoke } = setupInvoker();
    const res = await invoke("post", "/:id/start", { params: { id: "neg-1" } });

    expect(res.statusCode).toBe(200);
    expect(SimulationQueueService.createQueue).toHaveBeenCalledWith({
      negotiationId: "neg-1",
      techniques: ["tech-1"],
      tactics: ["tactic-1"],
      personalities: ["all"],
      zopaDistances: ["all"],
    });
    expect(storage.updateNegotiationStatus).toHaveBeenCalledWith("neg-1", "running");
    expect(res.jsonData.totalSimulations).toBeGreaterThan(0);
  });

  it("stops negotiation via engine", async () => {
    const { invoke } = setupInvoker();
    const res = await invoke("post", "/:id/stop", { params: { id: "neg-1" } });
    expect(res.statusCode).toBe(200);
    expect(negotiationEngineMock.stopNegotiation).toHaveBeenCalledWith("neg-1");
  });

  it("returns negotiation dimensions", async () => {
    storage.getNegotiationDimensions.mockResolvedValue([
      { id: "dim-1", name: "Price", minValue: "1", maxValue: "2", targetValue: "1.5", priority: 1, unit: "USD" },
    ]);

    const { invoke } = setupInvoker();
    const res = await invoke("get", "/:id/dimensions", { params: { id: "neg-1" } });

    expect(res.statusCode).toBe(200);
    expect(res.jsonData.dimensionsFound).toBe(1);
    expect(storage.getNegotiationDimensions).toHaveBeenCalledWith("neg-1");
  });
});
