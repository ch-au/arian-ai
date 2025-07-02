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

export interface NegotiationUpdate {
  type: 'negotiation_started' | 'round_completed' | 'negotiation_completed' | 'error';
  negotiationId: string;
  data: any;
}

export class NegotiationEngine {
  private wss: WebSocketServer;
  private activeNegotiations: Map<string, AbortController> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws',
      verifyClient: (info) => {
        // Add authentication here if needed
        return true;
      }
    });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('WebSocket client connected');
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
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

      const context = await storage.getNegotiationContext(negotiation.contextId!);
      const buyerAgent = await storage.getAgent(negotiation.buyerAgentId!);
      const sellerAgent = await storage.getAgent(negotiation.sellerAgentId!);

      if (!context || !buyerAgent || !sellerAgent) {
        throw new Error("Missing negotiation components");
      }

      // Get ZOPA configurations
      const buyerZopaConfigs = await storage.getZopaConfigurationsByAgent(buyerAgent.id);
      const sellerZopaConfigs = await storage.getZopaConfigurationsByAgent(sellerAgent.id);

      const buyerZopa = buyerZopaConfigs.find(z => z.contextId === context.id)?.boundaries as ZopaBoundaries;
      const sellerZopa = sellerZopaConfigs.find(z => z.contextId === context.id)?.boundaries as ZopaBoundaries;

      if (!buyerZopa || !sellerZopa) {
        throw new Error("ZOPA configurations not found");
      }

      // Start the negotiation
      await storage.startNegotiation(negotiationId);

      this.broadcast({
        type: 'negotiation_started',
        negotiationId,
        data: { negotiation, context, buyerAgent, sellerAgent }
      });

      // Create abort controller for this negotiation
      const abortController = new AbortController();
      this.activeNegotiations.set(negotiationId, abortController);

      // Run the negotiation loop
      await this.runNegotiationLoop(
        negotiation,
        context,
        buyerAgent,
        sellerAgent,
        buyerZopa,
        sellerZopa,
        abortController.signal
      );

    } catch (error) {
      console.error("Failed to start negotiation:", error);
      this.broadcast({
        type: 'error',
        negotiationId,
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }

  private async runNegotiationLoop(
    negotiation: Negotiation,
    context: NegotiationContext,
    buyerAgent: Agent,
    sellerAgent: Agent,
    buyerZopa: ZopaBoundaries,
    sellerZopa: ZopaBoundaries,
    abortSignal: AbortSignal
  ): Promise<void> {
    const negotiationHistory: NegotiationMessage[] = [];
    let currentRound = 1;
    let finalAgreement: any = null;
    let negotiationComplete = false;

    try {
      while (currentRound <= negotiation.maxRounds && !negotiationComplete && !abortSignal.aborted) {
        // Buyer's turn
        if (!abortSignal.aborted) {
          const buyerResponse = await this.executeNegotiationRound(
            buyerAgent,
            'buyer',
            context,
            buyerZopa,
            negotiationHistory,
            currentRound,
            negotiation.maxRounds,
            negotiation.id
          );

          await this.recordNegotiationRound(
            negotiation.id,
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
            negotiation.id
          );

          await this.recordNegotiationRound(
            negotiation.id,
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
      console.error("Negotiation loop error:", error);
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
    negotiationId: string
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
        negotiationId
      );

      // Record performance metrics
      const apiCost = openaiService.calculateApiCost(response.tokensUsed);
      
      // Note: We'll record the performance metric after we have the negotiation round ID
      
      return response;
    } catch (error) {
      console.error(`Failed to execute negotiation round for ${role}:`, error);
      throw error;
    }
  }

  private async recordNegotiationRound(
    negotiationId: string,
    roundNumber: number,
    agentId: string,
    response: any,
    role: 'buyer' | 'seller'
  ) {
    // Record negotiation round
    const roundData: InsertNegotiationRound = {
      negotiationId,
      roundNumber,
      agentId,
      message: response.message,
      proposal: response.proposal,
      responseTime: response.responseTime,
    };

    const round = await storage.createNegotiationRound(roundData);

    // Record performance metrics
    const apiCost = openaiService.calculateApiCost(response.tokensUsed);
    const performanceData: InsertPerformanceMetric = {
      negotiationId,
      agentId,
      tacticId: null, // Could be determined based on response analysis
      effectivenessScore: response.confidence * 100,
      responseTime: response.responseTime,
      apiTokensUsed: response.tokensUsed,
      apiCost: apiCost.toString(),
    };

    await storage.createPerformanceMetric(performanceData);

    // Update negotiation total rounds
    await storage.updateNegotiation(negotiationId, { totalRounds: roundNumber });
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
}
