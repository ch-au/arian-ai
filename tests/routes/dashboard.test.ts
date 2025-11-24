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

const analyticsServiceMock = {
  getDashboardMetrics: vi.fn(),
  getSuccessRateTrends: vi.fn(),
  getTopPerformingAgents: vi.fn(),
};

class SimulationQueueServiceMock {
  static getEvaluationStats = vi.fn();
  static getSimulationRunsNeedingEvaluation = vi.fn();
  static backfillEvaluations = vi.fn();
}

vi.mock("../../server/services/analytics", () => ({
  analyticsService: analyticsServiceMock,
}));

vi.mock("../../server/services/simulation-queue", () => ({
  SimulationQueueService: SimulationQueueServiceMock,
}));

const { createDashboardRouter } = await import("../../server/routes/dashboard");
const { createRouterInvoker } = await import("./utils");

function setupInvoker() {
  return createRouterInvoker(() => createDashboardRouter());
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Dashboard routes", () => {
  it("returns dashboard metrics", async () => {
    analyticsServiceMock.getDashboardMetrics.mockResolvedValue({ activeNegotiations: 2 });
    const { invoke } = setupInvoker();
    const res = await invoke("get", "/metrics");
    expect(res.statusCode).toBe(200);
    expect(res.jsonData.activeNegotiations).toBe(2);
    expect(analyticsServiceMock.getDashboardMetrics).toHaveBeenCalled();
  });

  it("returns evaluation stats", async () => {
    (SimulationQueueServiceMock.getEvaluationStats as any).mockResolvedValue({
      total: 3,
      evaluated: 1,
      needingEvaluation: 2,
      evaluationRate: 33.3,
    });
    const { invoke } = setupInvoker();
    const res = await invoke("get", "/evaluation-status");
    expect(res.statusCode).toBe(200);
    expect(res.jsonData.needingEvaluation).toBe(2);
  });

  it("backfills evaluations with limit", async () => {
    (SimulationQueueServiceMock.getSimulationRunsNeedingEvaluation as any).mockResolvedValue([
      { id: "run-1" },
      { id: "run-2" },
    ]);
    (SimulationQueueServiceMock.backfillEvaluations as any).mockResolvedValue(undefined);
    (SimulationQueueServiceMock.getEvaluationStats as any).mockResolvedValue({
      total: 2,
      evaluated: 1,
      needingEvaluation: 1,
      evaluationRate: 50,
    });

    const { invoke } = setupInvoker();
    const res = await invoke("post", "/evaluations/backfill", { body: { limit: 1 } });

    expect(res.statusCode).toBe(200);
    expect(SimulationQueueServiceMock.backfillEvaluations).toHaveBeenCalledWith([{ id: "run-1" }]);
    expect(res.jsonData).toMatchObject({ queued: 1, remaining: 1 });
  });
});
