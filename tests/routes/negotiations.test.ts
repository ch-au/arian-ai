import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../server/middleware/auth", () => ({
  requireAuth: async (req: any, res: any, next: any) => {
    req.user = { id: 1, username: "testuser" };
    next();
  },
  optionalAuth: async (req: any, res: any, next: any) => {
    req.user = { id: 1, username: "testuser" };
    next();
  },
}));

vi.mock("../../server/storage", () => {
  const storage = {
    getAllNegotiations: vi.fn(),
    getNegotiation: vi.fn(),
    getActiveNegotiations: vi.fn(),
    getRecentNegotiations: vi.fn(),
    getNegotiationDimensions: vi.fn(),
    getNegotiationRounds: vi.fn(),
    getAllInfluencingTechniques: vi.fn(),
    getAllNegotiationTactics: vi.fn(),
    getAllAgents: vi.fn(),
    createNegotiation: vi.fn(),
    startNegotiation: vi.fn(),
    updateNegotiation: vi.fn(),
    updateNegotiationStatus: vi.fn(),
    setNegotiationDimensions: vi.fn(),
    getProductsByNegotiation: vi.fn(),
  };
  return { storage };
});

vi.mock("../../server/services/simulation-queue", () => {
  class SimulationQueueServiceMock {
    static getSimulationResultsByNegotiation = vi.fn();
    static createQueue = vi.fn();
    static startQueue = vi.fn();
    static stopQueuesForNegotiation = vi.fn();
    static getSimulationStats = vi.fn();
    static backfillEvaluationsForNegotiation = vi.fn();
    static findQueueByNegotiation = vi.fn();
    static getQueueStatus = vi.fn();
    static pauseQueue = vi.fn();
    static resumeQueue = vi.fn();
    static restartFailedSimulations = vi.fn();
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
  startNegotiation: vi.fn(),
  stopNegotiation: vi.fn(),
};

function setupInvoker() {
  return createRouterInvoker(() => createNegotiationRouter(negotiationEngineMock as any));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Negotiation routes", () => {
  it("returns negotiations", async () => {
    storage.getAllNegotiations.mockResolvedValue([
      { id: "neg-1", title: "Test", scenario: {}, status: "planned" },
    ]);
    (SimulationQueueService as any).getSimulationStats.mockResolvedValue({
      totalRuns: 0,
      completedRuns: 0,
      runningRuns: 0,
      failedRuns: 0,
      pendingRuns: 0,
      successRate: 0,
      isPlanned: false,
    });

    const { invoke } = setupInvoker();
    const res = await invoke("get", "/");

    expect(res.statusCode).toBe(200);
    expect(storage.getAllNegotiations).toHaveBeenCalled();
    expect(res.jsonData).toHaveLength(1);
    expect(res.jsonData[0].simulationStats.totalRuns).toBe(0);
  });

  it("creates negotiation with scenario", async () => {
    storage.createNegotiation.mockResolvedValue({ id: "neg-123" });

    const payload = {
      registrationId: "11111111-1111-1111-1111-111111111111",
      title: "Test Deal",
      scenario: {
        userRole: "buyer",
        dimensions: [
          {
            name: "Price",
            minValue: 10,
            maxValue: 20,
            targetValue: 15,
            priority: 1,
          },
        ],
      },
    };

    const { invoke } = setupInvoker();
    const res = await invoke("post", "/", { body: payload });

    expect(res.statusCode).toBe(201);
    expect(storage.createNegotiation).toHaveBeenCalledWith(expect.objectContaining({ title: "Test Deal" }));
  });

  it("starts negotiation by creating simulation queue", async () => {
    storage.getNegotiation.mockResolvedValue({
      id: "neg-1",
      scenario: { selectedTechniques: ["tech-1"], selectedTactics: ["tactic-1"] },
      status: "planned",
      userId: 1,
    });
    storage.startNegotiation.mockResolvedValue({
      id: "neg-1",
      status: "running",
    });
    (SimulationQueueService as any).findQueueByNegotiation.mockResolvedValue(null);
    (SimulationQueueService as any).createQueue = vi.fn().mockResolvedValue("queue-1");
    (SimulationQueueService as any).startQueue = vi.fn().mockResolvedValue(undefined);
    // Mock getQueueStatus in case it's called (though it shouldn't be when findQueueByNegotiation returns null)
    (SimulationQueueService as any).getQueueStatus.mockResolvedValue({
      status: "pending",
      totalSimulations: 0,
      completedCount: 0,
      failedCount: 0,
    });
    // Mock resumeQueue and restartFailedSimulations in case they're called
    (SimulationQueueService as any).resumeQueue = vi.fn().mockResolvedValue(undefined);
    (SimulationQueueService as any).restartFailedSimulations = vi.fn().mockResolvedValue(undefined);

    const { invoke } = setupInvoker();
    const res = await invoke("post", "/:id/start", { params: { id: "neg-1" } });

    expect(res.statusCode).toBe(200);
    expect(storage.startNegotiation).toHaveBeenCalledWith("neg-1");
    expect(SimulationQueueService.createQueue).toHaveBeenCalledWith({ negotiationId: "neg-1" });
  });

  it("stops negotiation via engine", async () => {
    storage.updateNegotiationStatus.mockResolvedValue({ id: "neg-1", status: "aborted" });
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
    expect(res.jsonData.dimensions).toHaveLength(1);
    expect(storage.getNegotiationDimensions).toHaveBeenCalledWith("neg-1");
  });

  it("returns negotiation analysis", async () => {
    storage.getNegotiation.mockResolvedValue({
      id: "neg-1",
      title: "Test Negotiation",
      scenario: { userRole: "buyer" },
    });
    storage.getProductsByNegotiation.mockResolvedValue([{ id: "prod-1" }]);
    storage.getAllInfluencingTechniques.mockResolvedValue([{ id: "tech-1", name: "Foot in the Door" }]);
    storage.getAllNegotiationTactics.mockResolvedValue([{ id: "tac-1", name: "Anchoring" }]);
    (SimulationQueueService as any).getSimulationResultsByNegotiation.mockResolvedValue([
      {
        id: "run-1",
        runNumber: 1,
        status: "completed",
        techniqueId: "tech-1",
        tacticId: "tac-1",
        personalityId: null,
        dealValue: "100.00",
        outcome: "DEAL_ACCEPTED",
        totalRounds: 4,
        conversationLog: [],
        otherDimensions: {},
        actualCost: "1.25",
        startedAt: null,
        completedAt: null,
        tacticalSummary: "Great summary",
        techniqueEffectivenessScore: "8.0",
        tacticEffectivenessScore: "7.0",
        dimensionResults: [
          {
            simulationRunId: "run-1",
            dimensionName: "Preis",
            finalValue: "1.10",
            targetValue: "1.15",
            achievedTarget: true,
            priorityScore: 1,
          },
        ],
        productResults: [
          {
            simulationRunId: "run-1",
            productName: "Produkt A",
            agreedPrice: "1.10",
            subtotal: "110.00",
            withinZopa: true,
            performanceScore: "90",
          },
        ],
      },
    ]);

    const { invoke } = setupInvoker();
    const res = await invoke("get", "/:id/analysis", { params: { id: "neg-1" } });

    expect(res.statusCode).toBe(200);
    expect(res.jsonData.negotiation.userRole).toBe("buyer");
    expect(res.jsonData.runs).toHaveLength(1);
    expect(res.jsonData.runs[0].dimensionResults).toHaveLength(1);
    expect(res.jsonData.summary.totalRuns).toBe(1);
  });

  it("triggers analysis evaluation", async () => {
    (SimulationQueueService as any).backfillEvaluationsForNegotiation.mockResolvedValue({
      successCount: 1,
      failedCount: 0,
      totalRuns: 1,
    });

    const { invoke } = setupInvoker();
    const res = await invoke("post", "/:id/analysis/evaluate", { params: { id: "neg-1" } });

    expect(res.statusCode).toBe(200);
    expect(SimulationQueueService.backfillEvaluationsForNegotiation).toHaveBeenCalledWith("neg-1");
    expect(res.jsonData.successCount).toBe(1);
  });
});
