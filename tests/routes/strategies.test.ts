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
    createInfluencingTechnique: vi.fn(),
    getAllNegotiationTactics: vi.fn(),
    createNegotiationTactic: vi.fn(),
    getAllAgents: vi.fn(),
    getAllNegotiationContexts: vi.fn(),
    createNegotiationWithDimensions: vi.fn(),
    createNegotiationWithSimulationRuns: vi.fn(),
    updateNegotiation: vi.fn(),
    deleteNegotiation: vi.fn(),
    getSimulationRuns: vi.fn(),
    getSimulationRun: vi.fn(),
    updateNegotiationStatus: vi.fn(),
    createPersonalityType: vi.fn(),
  };
  return { storage };
});

const { storage } = await import("../../server/storage");
const { createStrategyRouter } = await import("../../server/routes/strategies");
const { createRouterInvoker } = await import("./utils");

function setupInvoker() {
  return createRouterInvoker(() => createStrategyRouter());
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Strategy routes", () => {
  it("returns influencing techniques", async () => {
    storage.getAllInfluencingTechniques.mockResolvedValue([
      { id: "tech-1", name: "Test Technique" },
    ]);

    const { invoke } = setupInvoker();
    const res = await invoke("get", "/influencing-techniques");

    expect(res.statusCode).toBe(200);
    expect(res.jsonData).toEqual([{ id: "tech-1", name: "Test Technique" }]);
  });

  it("creates influencing technique with validation", async () => {
    storage.createInfluencingTechnique.mockResolvedValue({ id: "tech-1" });

    const { invoke } = setupInvoker();
    const payload = {
      name: "Technique",
      beschreibung: "desc",
      anwendung: "use",
      wichtigeAspekte: ["one"],
      keyPhrases: ["phrase"],
    };
    const res = await invoke("post", "/influencing-techniques", { body: payload });

    expect(res.statusCode).toBe(201);
    expect(storage.createInfluencingTechnique).toHaveBeenCalledWith(payload);
  });

  it("rejects invalid influencing technique", async () => {
    const { invoke } = setupInvoker();
    const res = await invoke("post", "/influencing-techniques", { body: { name: "Incomplete" } });

    expect(res.statusCode).toBe(400);
    expect(storage.createInfluencingTechnique).not.toHaveBeenCalled();
  });

  it("creates negotiation tactic", async () => {
    storage.createNegotiationTactic.mockResolvedValue({ id: "tac-1" });

    const { invoke } = setupInvoker();
    const payload = {
      name: "Tactic",
      beschreibung: "desc",
      anwendung: "use",
      wichtigeAspekte: ["aspect"],
      keyPhrases: ["phrase"],
    };
    const res = await invoke("post", "/tactics", { body: payload });

    expect(res.statusCode).toBe(201);
    expect(storage.createNegotiationTactic).toHaveBeenCalledWith(payload);
  });
});
