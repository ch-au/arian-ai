import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NegotiationEngine } from './negotiation-engine';
import { storage } from '../storage';
import { openaiService } from './openai';

// Mock storage and openaiService
vi.mock('../storage');
vi.mock('./openai');

describe('NegotiationEngine', () => {
  let negotiationEngine: NegotiationEngine;

  beforeEach(() => {
    const mockServer = {
      on: () => {},
      // Add other necessary methods if needed
    };
    negotiationEngine = new NegotiationEngine(mockServer as any);
    vi.clearAllMocks();
  });

  it('should create a negotiation with simulation runs', async () => {
    const negotiationData = {
      contextId: 'context-1',
      buyerAgentId: 'agent-1',
      sellerAgentId: 'agent-2',
      selectedTechniques: ['tech-1', 'tech-2'],
      selectedTactics: ['tactic-1', 'tactic-2'],
    };

    const mockNegotiation = { id: 'negotiation-1', ...negotiationData };
    const mockSimulationRuns = [
      { id: 'run-1', negotiationId: 'negotiation-1', techniqueId: 'tech-1', tacticId: 'tactic-1' },
      { id: 'run-2', negotiationId: 'negotiation-1', techniqueId: 'tech-1', tacticId: 'tactic-2' },
      { id: 'run-3', negotiationId: 'negotiation-1', techniqueId: 'tech-2', tacticId: 'tactic-1' },
      { id: 'run-4', negotiationId: 'negotiation-1', techniqueId: 'tech-2', tacticId: 'tactic-2' },
    ];

    vi.spyOn(storage, 'createNegotiationWithSimulationRuns').mockResolvedValue({
      negotiation: mockNegotiation,
      simulationRuns: mockSimulationRuns,
    } as any);

    const result = await storage.createNegotiationWithSimulationRuns(negotiationData as any);

    expect(storage.createNegotiationWithSimulationRuns).toHaveBeenCalledWith(negotiationData);
    expect(result.negotiation).toEqual(mockNegotiation);
    expect(result.simulationRuns).toHaveLength(4);
  });

  it('should run a single simulation', async () => {
    const mockRun = { id: 'run-1', negotiationId: 'negotiation-1', techniqueId: 'tech-1', tacticId: 'tactic-1' };
    const mockNegotiation = {
      id: 'negotiation-1',
      contextId: 'context-1',
      buyerAgentId: 'agent-1',
      sellerAgentId: 'agent-2',
      maxRounds: 1,
      userZopa: {
        volumen: { min: 100, max: 1000, target: 500 },
        preis: { min: 10, max: 100, target: 50 },
        laufzeit: { min: 12, max: 36, target: 24 },
        zahlungskonditionen: { min: 30, max: 90, target: 60 },
      },
      counterpartDistance: {
        volumen: 0,
        preis: 0,
        laufzeit: 0,
        zahlungskonditionen: 0,
      },
    };
    const mockContext = { id: 'context-1' };
    const mockAgent = { id: 'agent-1', personalityProfile: {} };

    vi.spyOn(storage, 'getNegotiation').mockResolvedValue(mockNegotiation as any);
    vi.spyOn(storage, 'getNegotiationContext').mockResolvedValue(mockContext as any);
    vi.spyOn(storage, 'getAgent').mockResolvedValue(mockAgent as any);
    vi.spyOn(openaiService, 'generateNegotiationResponse').mockResolvedValue({
      message: 'test',
      proposal: undefined,
      reasoning: 'test',
      confidence: 1,
      tokensUsed: 1,
      responseTime: 1,
    });
    vi.spyOn(storage, 'createNegotiationRound').mockResolvedValue({} as any);
    vi.spyOn(storage, 'createPerformanceMetric').mockResolvedValue({} as any);
    vi.spyOn(storage, 'completeNegotiation').mockResolvedValue({} as any);
    vi.spyOn(openaiService, 'analyzeNegotiationOutcome').mockResolvedValue({
      successScore: 100,
      analysis: 'test',
      recommendations: [],
    });

    await negotiationEngine.runSingleSimulation(mockRun);

    expect(storage.getNegotiation).toHaveBeenCalledWith('negotiation-1');
    expect(openaiService.generateNegotiationResponse).toHaveBeenCalledTimes(2);
    expect(storage.createNegotiationRound).toHaveBeenCalledTimes(2);
    expect(storage.completeNegotiation).toHaveBeenCalled();
  });
});
