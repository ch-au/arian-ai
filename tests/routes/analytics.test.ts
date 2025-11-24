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

vi.mock("../../server/services/analytics", () => ({
  analyticsService: {
    generatePerformanceReport: vi.fn(),
  },
}));

const { analyticsService } = await import("../../server/services/analytics");
const { createAnalyticsRouter } = await import("../../server/routes/analytics");
const { createRouterInvoker } = await import("./utils");

function setupInvoker() {
  return createRouterInvoker(() => createAnalyticsRouter());
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Analytics routes", () => {
  it("returns performance report", async () => {
    analyticsService.generatePerformanceReport.mockResolvedValue({ totalNegotiations: 5 });

    const { invoke } = setupInvoker();
    const res = await invoke("get", "/performance", {
      query: { agentId: "agent-1", startDate: "2024-01-01", endDate: "2024-01-10" },
    });

    expect(res.statusCode).toBe(200);
    expect(analyticsService.generatePerformanceReport).toHaveBeenCalledWith(
      "agent-1",
      new Date("2024-01-01"),
      new Date("2024-01-10"),
    );
    expect(res.jsonData).toEqual({ totalNegotiations: 5 });
  });

  it("handles service errors", async () => {
    analyticsService.generatePerformanceReport.mockRejectedValue(new Error("boom"));

    const { invoke } = setupInvoker();
    const res = await invoke("get", "/performance");

    expect(res.statusCode).toBe(500);
    expect(res.jsonData).toEqual({ error: "Failed to generate performance report" });
  });
});
