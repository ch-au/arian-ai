import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../server/services/langfuse", () => ({
  langfuseService: {
    reloadPrompts: vi.fn(),
  },
}));

vi.mock("../../server/services/python-agents-bridge", () => ({
  pythonAgentsBridge: {
    testConnection: vi.fn(),
    testAgents: vi.fn(),
  },
}));

vi.mock("../../server/services/python-negotiation-service", () => ({
  PythonNegotiationService: {
    runNegotiation: vi.fn(),
  },
}));

const { langfuseService } = await import("../../server/services/langfuse");
const { pythonAgentsBridge } = await import("../../server/services/python-agents-bridge");
const { PythonNegotiationService } = await import("../../server/services/python-negotiation-service");
const { createSystemRouter } = await import("../../server/routes/system");
const { createRouterInvoker } = await import("./utils");

const negotiationEngineMock = {
  getActiveNegotiationsCount: vi.fn().mockReturnValue(3),
};

function setupInvoker() {
  return createRouterInvoker(() => createSystemRouter(negotiationEngineMock as any));
}

beforeEach(() => {
  vi.clearAllMocks();
  negotiationEngineMock.getActiveNegotiationsCount.mockReturnValue(3);
});

describe("System routes", () => {
  it("reloads prompts", async () => {
    const { invoke } = setupInvoker();
    const res = await invoke("get", "/prompts/reload");

    expect(res.statusCode).toBe(200);
    expect(langfuseService.reloadPrompts).toHaveBeenCalled();
  });

  it("returns system status", async () => {
    const { invoke } = setupInvoker();
    const res = await invoke("get", "/system/status");

    expect(res.statusCode).toBe(200);
    expect(res.jsonData).toEqual(
      expect.objectContaining({
        systemHealth: "online",
        activeNegotiations: 3,
      }),
    );
  });

  it("reports python agents health", async () => {
    pythonAgentsBridge.testConnection.mockResolvedValue(true);

    const { invoke } = setupInvoker();
    const res = await invoke("get", "/agents/health");

    expect(res.statusCode).toBe(200);
    expect(res.jsonData.status).toBe("healthy");
  });

  it("reports python agents unhealthy status", async () => {
    pythonAgentsBridge.testConnection.mockResolvedValue(false);

    const { invoke } = setupInvoker();
    const res = await invoke("get", "/agents/health");

    expect(res.statusCode).toBe(503);
    expect(res.jsonData.status).toBe("unhealthy");
  });

  it("runs python agents test", async () => {
    pythonAgentsBridge.testAgents.mockResolvedValue({ ok: true });

    const { invoke } = setupInvoker();
    const res = await invoke("post", "/agents/test");

    expect(res.statusCode).toBe(200);
    expect(res.jsonData.result).toEqual({ ok: true });
  });

  it("runs python negotiation test", async () => {
    PythonNegotiationService.runNegotiation.mockResolvedValue({ outcome: "DEAL_ACCEPTED" });

    const { invoke } = setupInvoker();
    const res = await invoke("post", "/python-negotiation/test", {
      body: {
        negotiationId: "neg-1",
        simulationRunId: "run-1",
        maxRounds: 5,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(PythonNegotiationService.runNegotiation).toHaveBeenCalledWith({
      negotiationId: "neg-1",
      simulationRunId: "run-1",
      maxRounds: 5,
    });
  });
});
