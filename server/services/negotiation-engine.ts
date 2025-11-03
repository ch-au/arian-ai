import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { storage } from "../storage";
import { openaiService, NegotiationMessage } from "./openai";
import {
  Negotiation,
  Agent,
  NegotiationContext,
  ZopaBoundaries,
  PersonalityProfile,
  InsertNegotiationRound,
  InsertPerformanceMetric,
} from "@shared/schema";
import type { PythonNegotiationResult } from './python-negotiation-service';
import { createRequestLogger } from "./logger";

export interface NegotiationUpdate {
  type: 'negotiation_started' | 'round_completed' | 'negotiation_completed' | 'error';
  negotiationId: string;
  data: any;
}

export class NegotiationEngine {
  private wss: WebSocketServer;
  private activeNegotiations: Map<string, AbortController> = new Map();
  private log = createRequestLogger('service:negotiation-engine');

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws',
      verifyClient: (_info: any) => {
        // Add authentication here if needed
        return true;
      }
    });

    this.wss.on('connection', (ws: WebSocket) => {
      this.log.debug({ event: 'ws_connected' }, 'WebSocket client connected');
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          this.log.warn({ err: error }, 'Invalid WebSocket message');
        }
      });

      ws.on('close', () => {
        this.log.debug({ event: 'ws_disconnected' }, 'WebSocket client disconnected');
      });
    });
  }

  private handleWebSocketMessage(ws: WebSocket, data: any) {
    switch (data.type) {
      case 'subscribe_negotiation':
        // Handle subscription to specific negotiation updates
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
    }
  }

  private broadcast(update: NegotiationUpdate) {
    const message = JSON.stringify(update);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  async startNegotiation(negotiationId: string): Promise<void> {
    try {
      // Get negotiation data
      const negotiation = await storage.getNegotiation(negotiationId);
      if (!negotiation) {
        throw new Error("Negotiation not found");
      }

      // Start the negotiation
      await storage.startNegotiation(negotiationId);

      this.broadcast({
        type: 'negotiation_started',
        negotiationId,
        data: { negotiation }
      });

      // Run the simulation matrix
      await this.runSimulationMatrix(negotiationId);

    } catch (error) {
      this.log.error({ err: error, negotiationId }, "Failed to start negotiation");
      this.broadcast({
        type: 'error',
        negotiationId,
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }

  async runSimulationMatrix(negotiationId: string): Promise<void> {
    const simulationRuns = await storage.getSimulationRuns(negotiationId);
    
    for (const run of simulationRuns) {
      try {
        await this.runSingleSimulation(run);
      } catch (error) {
        this.log.error({ err: error, runId: run.id }, "Simulation run failed");
        await storage.updateSimulationRun(run.id, { status: 'failed' });
      }
    }
  }

  async runSingleSimulation(run: any): Promise<void> {
    const negotiation = await storage.getNegotiation(run.negotiationId);
    if (!negotiation) {
      throw new Error("Negotiation not found for simulation run");
    }

    // Use Python OpenAI Agents service for negotiation simulation
    const { PythonNegotiationService } = await import('./python-negotiation-service');
    
    try {
      this.log.info({ runId: run.id }, 'Running simulation with Python OpenAI Agents');
      
      // Call Python agents service
      const result = await PythonNegotiationService.runNegotiation(
        {
          negotiationId: negotiation.id,
          simulationRunId: run.id,
          techniqueId: run.techniqueId,
          tacticId: run.tacticId,
          maxRounds: 6
        },
        (roundUpdate) => {
          // Broadcast real-time round updates
          this.broadcast({
            type: 'round_completed',
            negotiationId: negotiation.id,
            data: roundUpdate
          });
        }
      );
      
      // Process and broadcast results
      await this.processSimulationResult(negotiation, result);
      
    } catch (error) {
      this.log.error({ err: error, runId: run.id }, 'Python agents simulation failed');
      
      // Update run status to failed
      await storage.updateSimulationRun(run.id, { status: 'failed' });
      
      this.broadcast({
        type: 'error',
        negotiationId: negotiation.id,
        data: { 
          error: error instanceof Error ? error.message : 'Unknown error',
          simulationRunId: run.id
        }
      });
      
      throw error;
    }
  }

  private async processSimulationResult(negotiation: Negotiation, result: PythonNegotiationResult): Promise<void> {
    try {
      this.log.debug({ negotiationId: negotiation.id }, 'Processing simulation result');
      
      // The PythonNegotiationService already handles database updates
      // So we just need to broadcast the completion
      this.broadcast({
        type: 'negotiation_completed',
        negotiationId: negotiation.id,
        data: {
          outcome: result.outcome,
          totalRounds: result.totalRounds,
          conversationLog: result.conversationLog,
          finalOffer: result.finalOffer,
          langfuseTraceId: result.langfuseTraceId
        }
      });
      
    } catch (error) {
      this.log.error({ err: error, negotiationId: negotiation.id }, 'Error processing simulation result');
      throw error;
    }
  }

  private async runNegotiationLoop(
    negotiation: Negotiation,
    context: NegotiationContext,
    buyerAgent: Agent,
    sellerAgent: Agent,
    buyerZopa: ZopaBoundaries,
    sellerZopa: ZopaBoundaries,
    abortSignal: AbortSignal,
    run: any
  ): Promise<void> {
    const negotiationHistory: NegotiationMessage[] = [];
    let currentRound = 1;
    let finalAgreement: any = null;
    let negotiationComplete = false;

    try {
      while (currentRound <= (negotiation.maxRounds || 10) && !negotiationComplete && !abortSignal.aborted) {
        // Buyer's turn
        if (!abortSignal.aborted) {
          const buyerResponse = await this.executeNegotiationRound(
            buyerAgent,
            'buyer',
            context,
            buyerZopa,
            negotiationHistory,
            currentRound,
            negotiation.maxRounds || 10,
            negotiation,
            run.id
          );

          await this.recordNegotiationRound(
            run.id,
            currentRound,
            buyerAgent.id,
            buyerResponse,
            'buyer'
          );

          negotiationHistory.push({
            role: 'buyer',
            content: buyerResponse.message,
            proposal: buyerResponse.proposal
          });

          this.broadcast({
            type: 'round_completed',
            negotiationId: negotiation.id,
            data: {
              round: currentRound,
              agent: 'buyer',
              message: buyerResponse.message,
              proposal: buyerResponse.proposal
            }
          });

          // Check for agreement
          if (buyerResponse.proposal && this.isWithinBothZopas(buyerResponse.proposal, buyerZopa, sellerZopa)) {
            finalAgreement = buyerResponse.proposal;
            negotiationComplete = true;
            break;
          }
        }

        // Seller's turn
        if (!abortSignal.aborted && !negotiationComplete) {
          const sellerResponse = await this.executeNegotiationRound(
            sellerAgent,
            'seller',
            context,
            sellerZopa,
            negotiationHistory,
            currentRound,
            negotiation.maxRounds || 10,
            negotiation,
            run.id
          );

          await this.recordNegotiationRound(
            run.id,
            currentRound,
            sellerAgent.id,
            sellerResponse,
            'seller'
          );

          negotiationHistory.push({
            role: 'seller',
            content: sellerResponse.message,
            proposal: sellerResponse.proposal
          });

          this.broadcast({
            type: 'round_completed',
            negotiationId: negotiation.id,
            data: {
              round: currentRound,
              agent: 'seller',
              message: sellerResponse.message,
              proposal: sellerResponse.proposal
            }
          });

          // Check for agreement
          if (sellerResponse.proposal && this.isWithinBothZopas(sellerResponse.proposal, buyerZopa, sellerZopa)) {
            finalAgreement = sellerResponse.proposal;
            negotiationComplete = true;
          }
        }

        currentRound++;
      }

      // Analyze outcome and complete negotiation
      let analysisResult;
      let successScore = 0;

      if (finalAgreement) {
        analysisResult = await openaiService.analyzeNegotiationOutcome(
          negotiationHistory,
          finalAgreement,
          buyerZopa,
          sellerZopa
        );
        successScore = analysisResult.successScore;
      }

      await storage.completeNegotiation(negotiation.id, finalAgreement, successScore);

      this.broadcast({
        type: 'negotiation_completed',
        negotiationId: negotiation.id,
        data: {
          finalAgreement,
          successScore,
          analysis: analysisResult?.analysis,
          recommendations: analysisResult?.recommendations,
          totalRounds: currentRound - 1
        }
      });

    } catch (error) {
      this.log.error({ err: error, negotiationId: negotiation.id }, 'Negotiation loop error');
      this.broadcast({
        type: 'error',
        negotiationId: negotiation.id,
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    } finally {
      this.activeNegotiations.delete(negotiation.id);
    }
  }

  private async executeNegotiationRound(
    agent: Agent,
    role: 'buyer' | 'seller',
    context: NegotiationContext,
    zopaBoundaries: ZopaBoundaries,
    negotiationHistory: NegotiationMessage[],
    roundNumber: number,
    maxRounds: number,
    negotiation: Negotiation,
    simulationRunId: string
  ) {
    const startTime = Date.now();

    try {
      const response = await openaiService.generateNegotiationResponse(
        agent,
        role,
        context,
        zopaBoundaries,
        negotiationHistory,
        roundNumber,
        maxRounds,
        negotiation.id,
        negotiation.selectedTechniques,
        negotiation.selectedTactics
      );

      // Record performance metrics
      const apiCost = openaiService.calculateApiCost(response.tokensUsed);
      
      // Note: We'll record the performance metric after we have the negotiation round ID
      
      return response;
    } catch (error) {
      this.log.error({ err: error, role, simulationRunId }, 'Failed to execute negotiation round');
      throw error;
    }
  }

  private async recordNegotiationRound(
    simulationRunId: string,
    roundNumber: number,
    agentId: string,
    response: any,
    role: 'buyer' | 'seller'
  ) {
    // Record negotiation round
    const roundData: InsertNegotiationRound = {
      simulationRunId,
      roundNumber,
      agentId,
      message: response.message,
      proposal: response.proposal,
      responseTimeMs: response.responseTime,
    };

    const round = await storage.createNegotiationRound(roundData);

    // Record performance metrics
    const apiCost = openaiService.calculateApiCost(response.tokensUsed);
    const performanceData: InsertPerformanceMetric = {
      negotiationId: simulationRunId, // This is incorrect, but we'll fix it later
      agentId,
      tacticId: null, // Could be determined based on response analysis
      effectivenessScore: (response.confidence * 100).toString(),
      responseTime: response.responseTime,
      apiTokensUsed: response.tokensUsed,
      apiCost: apiCost.toString(),
    };

    await storage.createPerformanceMetric(performanceData);
  }

  private isWithinBothZopas(proposal: any, buyerZopa: ZopaBoundaries, sellerZopa: ZopaBoundaries): boolean {
    // Check if proposal is acceptable to both buyer and seller
    if (proposal.volume !== undefined) {
      const buyerVolumeOk = !buyerZopa.volume || 
        (proposal.volume >= buyerZopa.volume.minAcceptable && proposal.volume <= buyerZopa.volume.maxDesired);
      const sellerVolumeOk = !sellerZopa.volume || 
        (proposal.volume >= sellerZopa.volume.minAcceptable && proposal.volume <= sellerZopa.volume.maxDesired);
      
      if (!buyerVolumeOk || !sellerVolumeOk) return false;
    }

    if (proposal.price !== undefined) {
      const buyerPriceOk = !buyerZopa.price || 
        (proposal.price >= buyerZopa.price.minAcceptable && proposal.price <= buyerZopa.price.maxDesired);
      const sellerPriceOk = !sellerZopa.price || 
        (proposal.price >= sellerZopa.price.minAcceptable && proposal.price <= sellerZopa.price.maxDesired);
      
      if (!buyerPriceOk || !sellerPriceOk) return false;
    }

    if (proposal.paymentTerms !== undefined) {
      const buyerPaymentOk = !buyerZopa.paymentTerms || 
        (proposal.paymentTerms >= buyerZopa.paymentTerms.minAcceptable && proposal.paymentTerms <= buyerZopa.paymentTerms.maxDesired);
      const sellerPaymentOk = !sellerZopa.paymentTerms || 
        (proposal.paymentTerms >= sellerZopa.paymentTerms.minAcceptable && proposal.paymentTerms <= sellerZopa.paymentTerms.maxDesired);
      
      if (!buyerPaymentOk || !sellerPaymentOk) return false;
    }

    if (proposal.contractDuration !== undefined) {
      const buyerContractOk = !buyerZopa.contractDuration || 
        (proposal.contractDuration >= buyerZopa.contractDuration.minAcceptable && proposal.contractDuration <= buyerZopa.contractDuration.maxDesired);
      const sellerContractOk = !sellerZopa.contractDuration || 
        (proposal.contractDuration >= sellerZopa.contractDuration.minAcceptable && proposal.contractDuration <= sellerZopa.contractDuration.maxDesired);
      
      if (!buyerContractOk || !sellerContractOk) return false;
    }

    return true;
  }

  async stopNegotiation(negotiationId: string): Promise<void> {
    const abortController = this.activeNegotiations.get(negotiationId);
    if (abortController) {
      abortController.abort();
      this.activeNegotiations.delete(negotiationId);
    }
  }

  getActiveNegotiationsCount(): number {
    return this.activeNegotiations.size;
  }

  private convertToZopaBoundaries(userZopa: any): ZopaBoundaries {
    return {
      volume: userZopa.volumen ? {
        minAcceptable: userZopa.volumen.min,
        maxDesired: userZopa.volumen.max,
      } : undefined,
      price: userZopa.preis ? {
        minAcceptable: userZopa.preis.min,
        maxDesired: userZopa.preis.max,
      } : undefined,
      paymentTerms: userZopa.zahlungskonditionen ? {
        minAcceptable: userZopa.zahlungskonditionen.min,
        maxDesired: userZopa.zahlungskonditionen.max,
      } : undefined,
      contractDuration: userZopa.laufzeit ? {
        minAcceptable: userZopa.laufzeit.min,
        maxDesired: userZopa.laufzeit.max,
      } : undefined
    };
  }

  private generateCounterpartZopa(userZopa: any, counterpartDistance: any): ZopaBoundaries {
    // Generate counterpart ZOPA based on distance settings
    const adjustRange = (original: any, distance: number) => {
      if (!original) return undefined;
      
      const range = original.max - original.min;
      const adjustment = range * (distance / 100); // distance as percentage
      
      return {
        minAcceptable: original.min - adjustment,
        maxDesired: original.max + adjustment,
        target: original.target + (adjustment * 0.5) // Shift target slightly
      };
    };

    return {
      volume: adjustRange(userZopa.volumen, counterpartDistance.volumen || 0),
      price: adjustRange(userZopa.preis, counterpartDistance.preis || 0),
      paymentTerms: adjustRange(userZopa.zahlungskonditionen, counterpartDistance.zahlungskonditionen || 0),
      contractDuration: adjustRange(userZopa.laufzeit, counterpartDistance.laufzeit || 0)
    };
  }
}
