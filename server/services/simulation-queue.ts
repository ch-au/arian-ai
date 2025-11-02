/**
 * Simulation Queue Management Service
 * Handles creation, execution, and monitoring of simulation queues with crash recovery
 */

import { db, storage } from '../storage';
import { simulationQueue, simulationRuns, negotiations, influencingTechniques, negotiationTactics, personalityTypes } from '../../shared/schema';
import { eq, and, or, lt, count, sum, desc, isNull } from 'drizzle-orm';
import { PythonNegotiationService } from './python-negotiation-service';
import { createRequestLogger } from './logger';

// Import WebSocket functionality
let negotiationEngine: any = null;

// Set the negotiation engine instance for WebSocket broadcasts
export function setNegotiationEngine(engine: any) {
  negotiationEngine = engine;
}

// WebSocket event types
export interface SimulationEvent {
  type: 'simulation_started' | 'simulation_completed' | 'simulation_failed' | 'simulation_stopped' | 'queue_progress' | 'queue_completed' | 'negotiation_round';
  queueId: string;
  negotiationId: string;
  data: any;
}

export interface SimulationCheckpoint {
  negotiationId: string;
  queueId: string;
  currentSimulationId?: string;
  completedSimulations: string[];
  failedSimulations: string[];
  currentRound?: number;
  lastMessage?: string;
  totalCost: number;
  startTime: number;
}

export interface CreateQueueRequest {
  negotiationId: string;
  techniques: string[];        // Technique IDs
  tactics: string[];          // Tactic IDs  
  personalities: string[];    // Personality type IDs or ["all"] for all personalities
  zopaDistances: string[];    // Distance types: ["close", "medium", "far"] or ["all"] for all distances
}

export interface QueueStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  totalSimulations: number;
  completedCount: number;
  failedCount: number;
  estimatedTimeRemaining: number;
  currentSimulation?: any;
  progressPercentage: number;
  actualCost: number;
  estimatedCost: number;
}

export interface ExecuteRequest {
  mode: 'next' | 'all';
  maxConcurrent?: number;
}

export class SimulationQueueService {
  private static log = createRequestLogger('service:simulation-queue')
  private static processingQueues = new Set<string>()
  private static processingInterval: NodeJS.Timeout | null = null;
  // Consider a running simulation stale if no completion after this duration
  private static readonly STALE_RUNNING_MS = 10 * 60 * 1000; // 10 minutes
  
  /**
   * Broadcast simulation event via WebSocket
   */
  private static broadcastEvent(event: SimulationEvent) {
    this.log.debug({ event }, `[SIMULATION-QUEUE] Broadcasting event: ${event.type}`);
    
    if (negotiationEngine && negotiationEngine.broadcast) {
      negotiationEngine.broadcast({
        type: event.type,
        negotiationId: event.negotiationId,
        data: {
          queueId: event.queueId,
          ...event.data
        }
      });
      this.log.debug({ event }, `[SIMULATION-QUEUE] Event broadcasted successfully`);
    } else {
      this.log.warn(`[SIMULATION-QUEUE] No negotiation engine available for broadcasting`);
    }
  }
  
  /**
   * Create a simulation queue with all technique-tactic-personality-distance combinations
   */
  static async createQueue(request: CreateQueueRequest): Promise<string> {
    const { negotiationId, techniques, tactics, personalities, zopaDistances } = request;
    
    this.log.info({ 
      negotiationId, 
      techniques: techniques.length, 
      tactics: tactics.length, 
      personalities: personalities.length, 
      zopaDistances: zopaDistances.length 
    }, `[SIMULATION-QUEUE] Creating queue for negotiation`);
    
    // Resolve personality types
    let actualPersonalities = personalities;
    if (personalities.includes('all')) {
      // Fetch all personality types from database
      const allPersonalityTypes = await db.select({ id: personalityTypes.id })
        .from(personalityTypes);
      actualPersonalities = allPersonalityTypes.map(p => p.id);
    }
    
    // Resolve ZOPA distances
    let actualDistances = zopaDistances;
    if (zopaDistances.includes('all')) {
      actualDistances = ['close', 'medium', 'far'];
    }
    
    // Default to single values if empty arrays
    if (actualPersonalities.length === 0) {
      actualPersonalities = ['default'];
    }
    if (actualDistances.length === 0) {
      actualDistances = ['medium'];
    }
    
    // Calculate total simulations (techniques × tactics × personalities × distances)
    const totalSimulations = techniques.length * tactics.length * actualPersonalities.length * actualDistances.length;
    
    // Estimate cost (rough estimate: $0.15 per simulation)
    const estimatedCost = totalSimulations * 0.15;
    
    // Create queue record
    const [queue] = await db.insert(simulationQueue).values({
      negotiationId,
      totalSimulations,
      estimatedTotalCost: estimatedCost.toString(),
      status: 'pending'
    }).returning();
    
    // Create simulation run records for all combinations (techniques × tactics × personalities × distances)
    const simulationRunData = [];
    let executionOrder = 1;
    
    for (const techniqueId of techniques) {
      for (const tacticId of tactics) {
        for (const personalityId of actualPersonalities) {
          for (const distance of actualDistances) {
            simulationRunData.push({
              negotiationId,
              queueId: queue.id,
              runNumber: executionOrder,
              executionOrder,
              techniqueId,
              tacticId,
              personalityId, // Add personality to simulation run
              zopaDistance: distance, // Add distance to simulation run
              status: 'pending' as const,
              estimatedDuration: 60 // 60 seconds default estimate
            });
            executionOrder++;
          }
        }
      }
    }
    
    await db.insert(simulationRuns).values(simulationRunData);
    
    this.log.info({ queueId: queue.id, simulationRunCount: simulationRunData.length }, `[SIMULATION-QUEUE] Created simulation runs for queue`);
    
    return queue.id;
  }

  /**
   * Get queues by negotiation ID
   */
  static async getQueuesByNegotiation(negotiationId: string): Promise<any[]> {
    this.log.info(`Getting queues for negotiation ${negotiationId}`);
    
    const queues = await db
      .select()
      .from(simulationQueue)
      .where(eq(simulationQueue.negotiationId, negotiationId))
      .orderBy(desc(simulationQueue.createdAt));
    
    return queues;
  }
  
  /**
   * Get queue status with current progress
   */
  static async getQueueStatus(queueId: string): Promise<QueueStatus> {
    // Get queue info
    const [queue] = await db.select()
      .from(simulationQueue)
      .where(eq(simulationQueue.id, queueId));
    
    if (!queue) {
      throw new Error(`Queue not found: ${queueId}`);
    }
    
    // Get current running simulation
    const [currentSimulation] = await db.select({
      id: simulationRuns.id,
      runNumber: simulationRuns.runNumber,
      techniqueId: simulationRuns.techniqueId,
      tacticId: simulationRuns.tacticId,
      startedAt: simulationRuns.startedAt
    })
    .from(simulationRuns)
    .where(
      and(
        eq(simulationRuns.queueId, queueId),
        eq(simulationRuns.status, 'running')
      )
    );
    
    // Calculate actual counts from simulation results (not from stale queue table)
    const [completedCount] = await db
      .select({ count: count(simulationRuns.id) })
      .from(simulationRuns)
      .where(and(
        eq(simulationRuns.queueId, queueId),
        eq(simulationRuns.status, 'completed')
      ));
    
    const [failedCount] = await db
      .select({ count: count(simulationRuns.id) })
      .from(simulationRuns)
      .where(and(
        eq(simulationRuns.queueId, queueId),
        or(
          eq(simulationRuns.status, 'failed'),
          eq(simulationRuns.status, 'timeout')
        )
      ));
    
    const actualCompletedCount = completedCount.count || 0;
    const actualFailedCount = failedCount.count || 0;
    
    // Calculate estimated time remaining
    const avgDuration = 60; // seconds
    const remainingCount = queue.totalSimulations - actualCompletedCount - actualFailedCount;
    const estimatedTimeRemaining = remainingCount * avgDuration;
    
    const progressPercentage = Math.round(((actualCompletedCount + actualFailedCount) / queue.totalSimulations) * 100);
    
    return {
      id: queue.id,
      status: queue.status as any,
      totalSimulations: queue.totalSimulations,
      completedCount: actualCompletedCount,
      failedCount: actualFailedCount,
      estimatedTimeRemaining,
      currentSimulation,
      progressPercentage,
      actualCost: parseFloat(queue.actualTotalCost || '0'),
      estimatedCost: parseFloat(queue.estimatedTotalCost || '0')
    };
  }
  
  /**
   * Reset some failed simulations back to pending for testing
   */
  static async resetFailedSimulationsToPending(queueId: string, count: number = 1) {
    this.log.info({ queueId, count }, `[SIMULATION-QUEUE] Resetting failed simulations to pending for testing`);
    
    const updatedRows = await db.update(simulationRuns)
      .set({ status: 'pending' })
      .where(and(
        eq(simulationRuns.queueId, queueId),
        eq(simulationRuns.status, 'failed')
      ))
      .returning({ id: simulationRuns.id });
    
    this.log.info({ queueId, resetCount: updatedRows.length }, `[SIMULATION-QUEUE] Reset simulations to pending`);
    return updatedRows.length > 0;
  }

  /**
   * Restart failed/timeout simulations by setting them back to pending
   */
  static async restartFailedSimulations(queueId: string): Promise<number> {
    this.log.info(`Restarting failed/timeout simulations for queue ${queueId}`);

    const updatedRows = await db.update(simulationRuns)
      .set({
        status: 'pending',
        actualCost: '0'
      })
      .where(and(
        eq(simulationRuns.queueId, queueId),
        or(
          eq(simulationRuns.status, 'failed'),
          eq(simulationRuns.status, 'timeout')
        )
      ))
      .returning({ id: simulationRuns.id, runNumber: simulationRuns.runNumber });

    if (updatedRows.length > 0) {
      // Update queue status to pending if it was completed
      await db.update(simulationQueue)
        .set({ status: 'pending' })
        .where(eq(simulationQueue.id, queueId));
    }

    this.log.info(`Restarted ${updatedRows.length} failed simulations`);
    return updatedRows.length;
  }

  /**
   * Restart a single simulation run
   */
  static async restartSingleRun(runId: string): Promise<{ runNumber: number }> {
    this.log.info(`Restarting single simulation run ${runId}`);

    const [run] = await db.select()
      .from(simulationRuns)
      .where(eq(simulationRuns.id, runId));

    if (!run) {
      throw new Error('Simulation run not found');
    }

    // Reset the run to pending state
    const [updatedRun] = await db.update(simulationRuns)
      .set({
        status: 'pending',
        actualCost: '0',
        completedAt: null,
        conversationLog: [],
        otherDimensions: {},
        crashRecoveryData: null
      })
      .where(eq(simulationRuns.id, runId))
      .returning({ runNumber: simulationRuns.runNumber });

    // Update queue status to pending if it was completed and queue exists
    if (run.queueId) {
      await db.update(simulationQueue)
        .set({ status: 'pending' })
        .where(eq(simulationQueue.id, run.queueId));
    }

    this.log.info(`Restarted run #${updatedRun.runNumber}`);
    return { runNumber: updatedRun.runNumber };
  }

  /**
   * Get system status
   */
  static async getSystemStatus() {
    const activeQueues = await db
      .select({ id: simulationQueue.id, status: simulationQueue.status })
      .from(simulationQueue)
      .where(or(
        eq(simulationQueue.status, 'pending'),
        eq(simulationQueue.status, 'running')
      ));

    return {
      backgroundProcessorRunning: this.processingInterval !== null,
      activeQueues: activeQueues.length,
      processingQueuesCount: this.processingQueues.size,
      processingQueues: Array.from(this.processingQueues),
      queues: activeQueues
    };
  }

  /**
   * Reset processing queues (debug utility)
   */
  static resetProcessingQueues() {
    const count = this.processingQueues.size;
    this.processingQueues.clear();
    this.log.info(`Cleared ${count} stuck queues from processing set`);
  }

  /**
   * Start the background processor if not already running
   */
  static startBackgroundProcessor(): void {
    if (this.processingInterval) {
      this.log.info('Background processor already running');
      return; // Already running
    }

    this.log.info('Starting background queue processor');
    this.processingInterval = setInterval(async () => {
      try {
        await this.processAllQueues();
      } catch (error) {
        this.log.error({ err: error }, 'Background processor error');
      }
    }, 2000); // Check every 2 seconds
  }

  /**
   * Stop the background processor
   */
  static stopBackgroundProcessor(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      this.log.info('Stopped background queue processor');
    }
  }

  /**
   * Process all active queues
   */
  static async processAllQueues(): Promise<void> {
    // First, mark stale running simulations as timeout
    await this.timeoutStaleRunningSimulations();

    // Find all queues that should be running
    const activeQueues = await db
      .select({ id: simulationQueue.id, status: simulationQueue.status })
      .from(simulationQueue)
      .where(or(
        eq(simulationQueue.status, 'pending'),
        eq(simulationQueue.status, 'running')
      ));

    if (activeQueues.length > 0) {
      this.log.info(`[PROCESSOR] Found ${activeQueues.length} active queues to process`);
      activeQueues.forEach(q => {
        this.log.info(`[PROCESSOR] Queue ${q.id.slice(0, 8)} status: ${q.status}`);
      });
    }

    for (const queue of activeQueues) {
      if (!this.processingQueues.has(queue.id)) {
        this.log.info(`[PROCESSOR] Starting processor for queue ${queue.id.slice(0, 8)}`);
        // Don't await - let it run in background, but catch errors
        this.processQueue(queue.id).catch(err => {
          this.log.error({ err, queueId: queue.id }, '[PROCESSOR] Uncaught error in processQueue');
        });
      } else {
        this.log.info(`[PROCESSOR] Queue ${queue.id.slice(0, 8)} already being processed`);
      }
    }
  }

  /**
   * Process a single queue continuously
   */
  static async processQueue(queueId: string): Promise<void> {
    const shortId = queueId.slice(0, 8);

    if (this.processingQueues.has(queueId)) {
      this.log.info(`[QUEUE ${shortId}] Already processing, skipping`);
      return; // Already processing
    }

    this.processingQueues.add(queueId);
    this.log.info(`[QUEUE ${shortId}] ✅ Added to processing set, starting queue processor`);

    try {
      let iteration = 0;
      while (true) {
        iteration++;
        this.log.info(`[QUEUE ${shortId}] 🔄 Iteration ${iteration}: Checking for next simulation`);

        const hasNext = await this.executeNext(queueId);

        if (!hasNext) {
          this.log.info(`[QUEUE ${shortId}] ✓ No more simulations - queue completed`);
          break;
        }

        this.log.info(`[QUEUE ${shortId}] ✓ Simulation executed, waiting 1s before next...`);
        // Small delay between simulations to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      this.log.error({ err: error, queueId }, `[QUEUE ${shortId}] ❌ Queue processing failed`);
      await this.updateQueueStatus(queueId, 'failed');
    } finally {
      this.processingQueues.delete(queueId);
      this.log.info(`[QUEUE ${shortId}] 🛑 Stopped queue processor, removed from processing set`);
    }
  }

  /**
   * Start/resume a queue - sets status to pending and begins execution
   */
  static async startQueue(queueId: string): Promise<void> {
    this.log.info(`Starting/resuming queue ${queueId}`);
    
    // Check if there are any pending simulations
    const [pendingCount] = await db
      .select({ count: count(simulationRuns.id) })
      .from(simulationRuns)
      .where(and(
        eq(simulationRuns.queueId, queueId),
        eq(simulationRuns.status, 'pending')
      ));
    
    if ((pendingCount.count || 0) === 0) {
      throw new Error('No pending simulations to start. Try restarting failed simulations first.');
    }
    
    // Set queue status to pending
    await db.update(simulationQueue)
      .set({ status: 'pending' })
      .where(eq(simulationQueue.id, queueId));
    
    this.log.info(`Queue ${queueId} is now ready to start with ${pendingCount.count} pending simulations`);
    
    // Ensure background processor is running
    this.startBackgroundProcessor();
  }

  /**
   * Execute next simulation in queue
   */
  static async executeNext(queueId: string): Promise<boolean> {
    this.log.info(`[EXECUTE] Checking for next simulation in queue ${queueId.slice(0, 8)}`);

    // Get next pending simulation
    let [nextSimulation] = await db.select()
      .from(simulationRuns)
      .where(
        and(
          eq(simulationRuns.queueId, queueId),
          eq(simulationRuns.status, 'pending')
        )
      )
      .orderBy(simulationRuns.executionOrder)
      .limit(1);

    // Do NOT auto-retry failed simulations. They are only retried via the restart-failed endpoint.

    if (!nextSimulation) {
      // No more simulations to run (no pending, no retryable failed)
      this.log.info(`[EXECUTE] No more pending simulations in queue ${queueId.slice(0, 8)}, marking as completed`);
      await this.updateQueueStatus(queueId, 'completed');
      return false;
    }

    this.log.info(`[EXECUTE] Found simulation to execute: ${nextSimulation.id.slice(0, 8)} (Run #${nextSimulation.runNumber})`);
    this.log.info(`[EXECUTE] Technique: ${nextSimulation.techniqueId?.slice(0, 8)}, Tactic: ${nextSimulation.tacticId?.slice(0, 8)}`);
    
    
    // Mark simulation as running (reset if it was failed)
    await db.update(simulationRuns)
      .set({ 
        status: 'running', 
        startedAt: new Date(),
        crashRecoveryData: JSON.stringify({
          simulationId: nextSimulation.id,
          queueId,
          startTime: Date.now(),
          round: 0
        })
      })
      .where(eq(simulationRuns.id, nextSimulation.id));
    
    // Update queue status to running
    await this.updateQueueStatus(queueId, 'running');
    
    // Broadcast simulation started event
    this.broadcastEvent({
      type: 'simulation_started',
      queueId,
      negotiationId: nextSimulation.negotiationId || '',
      data: {
        simulationId: nextSimulation.id,
        runNumber: nextSimulation.runNumber,
        techniqueId: nextSimulation.techniqueId,
        tacticId: nextSimulation.tacticId
      }
    });
    
    try {
      // Create round update callback for real-time WebSocket broadcasting
      const onRoundUpdate = (roundData: any) => {
        this.log.debug({ round: roundData.round, agent: roundData.agent }, `[SIMULATION-QUEUE] Received round update`);
        this.broadcastEvent({
          type: 'negotiation_round',
          queueId,
          negotiationId: nextSimulation.negotiationId || '',
          data: {
            simulationId: nextSimulation.id,
            runNumber: nextSimulation.runNumber,
            round: roundData.round,
            agent: roundData.agent,
            message: roundData.message,
            offer: roundData.offer
          }
        });
      };

      // Execute the negotiation using Python service
      this.log.info(`[PYTHON] Starting negotiation with Python service for simulation ${nextSimulation.id.slice(0, 8)}`);
      this.log.info(`[PYTHON] Negotiation ID: ${nextSimulation.negotiationId?.slice(0, 8)}`);

      // Check if simulation was stopped before we start
      const [currentSim] = await db.select()
        .from(simulationRuns)
        .where(eq(simulationRuns.id, nextSimulation.id));

      if (!currentSim || currentSim.status === 'failed') {
        this.log.info(`[PYTHON] Simulation ${nextSimulation.id.slice(0, 8)} was stopped before execution, skipping`);
        return false;
      }

      this.log.info(`[PYTHON] Calling PythonNegotiationService.runNegotiation()...`);

      const result = await PythonNegotiationService.runNegotiation({
        negotiationId: nextSimulation.negotiationId || '',
        simulationRunId: nextSimulation.id,
        techniqueId: nextSimulation.techniqueId || '',
        tacticId: nextSimulation.tacticId || '',
        maxRounds: 6,
        queueId: queueId
      }, onRoundUpdate);

      this.log.info(`[PYTHON] Negotiation completed! Outcome: ${result.outcome}, Rounds: ${result.totalRounds}`);

      // Guard against stop: if this run was marked non-running meanwhile, skip updating results
      const [latest] = await db.select({ status: simulationRuns.status })
        .from(simulationRuns)
        .where(eq(simulationRuns.id, nextSimulation.id));
      if (!latest || latest.status !== 'running') {
        this.log.info({ simulationId: nextSimulation.id, status: latest?.status }, 'Skipping result write; run was stopped externally');
        return true; // Continue processing other simulations
      }
      
      // Calculate actual cost based on rounds (more accurate than fixed estimate)
      const estimatedCostPerRound = 0.006; // ~$0.006 per round based on token usage
      const actualCost = result.totalRounds * estimatedCostPerRound;
      
      // Determine proper status based on outcome
      let status = 'failed'; // Default fallback
      if (result.outcome === 'DEAL_ACCEPTED' || result.outcome === 'TERMINATED' || result.outcome === 'WALK_AWAY') {
        status = 'completed';
      } else if (result.outcome === 'PAUSED') {
        status = 'paused';
      } else if (result.outcome === 'MAX_ROUNDS_REACHED') {
        status = 'timeout';
      } else {
        status = 'failed';
      }
      
      // Mark simulation as completed with real data
      const normalizedConversationLog = Array.isArray(result.conversationLog)
        ? result.conversationLog
        : [];

      const dimensionValues = result.finalOffer?.dimension_values ?? {};

      // Calculate deal value: SUM of (agreed price × geschätztesVolumen) for ALL products
      // NOTE: Volume is NOT negotiated - only prices are negotiated
      const calculateDealValue = async (dimensions: any, negotiationId: string, simulationRunId: string): Promise<number | null> => {
        if (!dimensions || typeof dimensions !== 'object') return null;

        // Fetch product configuration to get geschätztesVolumen (fixed estimated volume)
        const products = await storage.getProductsByNegotiation(negotiationId);

        if (!products || products.length === 0) {
          this.log.warn(`No products found for negotiation ${negotiationId}, cannot calculate deal value`);
          return null;
        }

        // Match each product with its price dimension and calculate total deal value
        let totalDealValue = 0;
        let productsMatched = 0;
        const productResultsToSave = [];

        for (const product of products) {
          const productId = product.id;
          const productName = product.produktName;
          const targetPrice = product.zielPreis;
          const minMaxPrice = product.minMaxPreis;
          const volume = product.geschätztesVolumen;

          if (!volume || volume === 0) {
            this.log.warn(`Product ${productName} has no geschätztesVolumen, skipping`);
            continue;
          }

          // Find the price dimension for this product
          // Dimension key formats: "Preis_ProductName" (exact from schema), or legacy formats
          let productPrice: number | null = null;

          // First try exact match: "Preis_ProductName"
          const exactKey = `Preis_${productName}`;
          if (dimensions[exactKey] !== undefined) {
            const numValue = typeof dimensions[exactKey] === 'number'
              ? dimensions[exactKey]
              : parseFloat(String(dimensions[exactKey]));
            if (!isNaN(numValue)) {
              productPrice = numValue;
              this.log.info(`Exact match: dimension "${exactKey}" = €${numValue}`);
            }
          }

          // Fallback: fuzzy matching for legacy formats
          if (productPrice === null) {
            for (const [key, value] of Object.entries(dimensions)) {
              const keyLower = key.toLowerCase().replace(/[_\s]/g, '');
              const productNameLower = productName.toLowerCase().replace(/[_\s]/g, '');

              // Match if dimension key contains both "preis"/"price" AND the product name
              if ((keyLower.includes('preis') || keyLower.includes('price')) &&
                  keyLower.includes(productNameLower)) {
                const numValue = typeof value === 'number' ? value : parseFloat(String(value));
                if (!isNaN(numValue)) {
                  productPrice = numValue;
                  this.log.info(`Fuzzy match: dimension "${key}" to product "${productName}" = €${numValue}`);
                  break;
                }
              }
            }
          }

          if (productPrice !== null && productPrice > 0) {
            const productDealValue = productPrice * volume;
            totalDealValue += productDealValue;
            productsMatched++;
            this.log.info(`Product "${productName}": €${productPrice} × ${volume} units = €${productDealValue}`);

            // Calculate performance metrics based on target and min/max prices
            const targetPriceNum = parseFloat(targetPrice?.toString() || '0');
            const minMaxPriceNum = parseFloat(minMaxPrice?.toString() || '0');

            let priceVsTarget: string | null = null;
            let withinZopa: boolean | null = null;
            let performanceScore: number | null = null;

            if (targetPriceNum > 0) {
              const diff = ((productPrice - targetPriceNum) / targetPriceNum) * 100;
              priceVsTarget = `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`;
            }

            if (minMaxPriceNum > 0) {
              withinZopa = productPrice >= minMaxPriceNum;

              // Performance score: 100 if at target, decreases as it moves toward min/max
              if (targetPriceNum > 0) {
                const range = Math.abs(targetPriceNum - minMaxPriceNum);
                const distance = Math.abs(productPrice - targetPriceNum);
                performanceScore = range > 0 ? Math.max(0, Math.min(100, 100 - (distance / range * 100))) : 100;
              }
            }

            // Prepare product result for saving (linked to products table via productId)
            productResultsToSave.push({
              simulationRunId: simulationRunId,
              productId: productId, // Foreign key to products table
              productName: productName,
              agreedPrice: productPrice.toString(),
              estimatedVolume: volume,
              subtotal: productDealValue.toString(),
              priceVsTarget: priceVsTarget,
              withinZopa: withinZopa,
              performanceScore: performanceScore?.toString() || null
            });
          } else {
            this.log.warn(`No price found for product "${productName}" in dimensions. Available dimensions: ${Object.keys(dimensions).join(', ')}`);
          }
        }

        // Save product results to database
        if (productResultsToSave.length > 0) {
          try {
            await db.insert(productResults).values(productResultsToSave);
            this.log.info(`Saved ${productResultsToSave.length} product results to database`);
          } catch (error) {
            this.log.error(`Failed to save product results: ${error}`);
          }
        }

        if (productsMatched === 0) {
          this.log.warn(`No products could be matched with price dimensions`);
          return null;
        }

        this.log.info(`Total deal value: €${totalDealValue} (${productsMatched}/${products.length} products)`);
        return totalDealValue;
      };

      const dealValue = await calculateDealValue(dimensionValues, nextSimulation.negotiationId || '', nextSimulation.id);

      // Separate product-related dimensions from other dimensions
      // otherDimensions should NOT include product prices/volumes (those are in productResults table)
      const products = await storage.getProductsByNegotiation(nextSimulation.negotiationId || '');
      const productNamesNormalized = new Set(
        products.map(p => p.produktName.toLowerCase().replace(/[_\s]/g, ''))
      );
      const otherDimensions: Record<string, any> = {};

      for (const [key, value] of Object.entries(dimensionValues)) {
        const keyLower = key.toLowerCase();
        const keyNormalized = keyLower.replace(/[_\s]/g, ''); // Remove spaces and underscores
        let isProductDimension = false;

        // Check if this dimension is product-related (price OR volume)
        for (const productNameNormalized of productNamesNormalized) {
          const isPrice = keyNormalized.includes('preis') || keyNormalized.includes('price');
          const isVolume = keyNormalized.includes('volumen') || keyNormalized.includes('volume') || keyNormalized.includes('menge');

          if ((isPrice || isVolume) && keyNormalized.includes(productNameNormalized)) {
            isProductDimension = true;
            break;
          }
        }

        // Only include non-product dimensions (e.g., Lieferzeit, Zahlungsbedingungen)
        if (!isProductDimension) {
          otherDimensions[key] = value;
        }
      }

      await db.update(simulationRuns)
        .set({
          status: status,
          completedAt: new Date(),
          conversationLog: normalizedConversationLog,
          totalRounds: result.totalRounds,
          otherDimensions: otherDimensions, // Only non-product dimensions
          dealValue: dealValue?.toString() ?? null,
          actualCost: actualCost.toString(),
          outcome: result.outcome, // Store the detailed outcome
          crashRecoveryData: null // Clear recovery data
        })
        .where(eq(simulationRuns.id, nextSimulation.id));
      
      // Update queue completed count
      const [completedCount] = await db
        .select({ count: count(simulationRuns.id) })
        .from(simulationRuns)
        .where(and(
          eq(simulationRuns.queueId, queueId),
          eq(simulationRuns.status, 'completed')
        ));
      
      const [totalCost] = await db
        .select({ total: sum(simulationRuns.actualCost) })
        .from(simulationRuns)
        .where(eq(simulationRuns.queueId, queueId));
        
      await db.update(simulationQueue)
        .set({ 
          completedCount: completedCount.count || 0,
          actualTotalCost: (totalCost.total || 0).toString()
        })
        .where(eq(simulationQueue.id, queueId));
      
      // Broadcast simulation completed event
      this.broadcastEvent({
        type: 'simulation_completed',
        queueId,
        negotiationId: nextSimulation.negotiationId || '',
        data: {
          simulationId: nextSimulation.id,
          runNumber: nextSimulation.runNumber,
          outcome: result.outcome,
          totalRounds: result.totalRounds,
          cost: actualCost,
          completed: completedCount.count || 0,
          total: (await this.getQueueStatus(queueId)).totalSimulations
        }
      });

      // Hook: Trigger AI evaluation after successful completion
      if (result.outcome === 'DEAL_ACCEPTED' || result.outcome === 'WALK_AWAY') {
        this.log.info(`[EVALUATION] Triggering AI evaluation for simulation ${nextSimulation.id.slice(0, 8)}`);
        this.triggerEvaluation(nextSimulation.id, nextSimulation.negotiationId || '').catch(err => {
          this.log.error(`[EVALUATION] Failed to evaluate simulation ${nextSimulation.id.slice(0, 8)}:`, err);
        });
      }

      // Check if queue is complete
      const queueStatus = await this.getQueueStatus(queueId);
      if (queueStatus.completedCount + queueStatus.failedCount >= queueStatus.totalSimulations) {
        await this.updateQueueStatus(queueId, 'completed');
        
        this.broadcastEvent({
          type: 'queue_completed',
          queueId,
          negotiationId: nextSimulation.negotiationId || '',
          data: {
            totalSimulations: queueStatus.totalSimulations,
            completed: queueStatus.completedCount,
            failed: queueStatus.failedCount,
            totalCost: queueStatus.actualCost
          }
        });
      } else {
        // Broadcast progress update
        this.broadcastEvent({
          type: 'queue_progress',
          queueId,
          negotiationId: nextSimulation.negotiationId || '',
          data: {
            completed: queueStatus.completedCount,
            failed: queueStatus.failedCount,
            total: queueStatus.totalSimulations,
            percentage: queueStatus.progressPercentage
          }
        });
      }
      
      return true;
      
    } catch (error) {
      this.log.error({ err: error, simulationId: nextSimulation.id }, `Simulation ${nextSimulation.id} failed`);
      
      // Increment retry count
      const newRetryCount = (nextSimulation.retryCount || 0) + 1;
      
      if (newRetryCount >= (nextSimulation.maxRetries || 3)) {
        // Max retries reached, mark as failed
        await db.update(simulationRuns)
          .set({ 
            status: 'failed',
            retryCount: newRetryCount,
            conversationLog: JSON.stringify([]), // Ensure conversationLog is not null
            crashRecoveryData: JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
              finalRetry: true
            })
          })
          .where(eq(simulationRuns.id, nextSimulation.id));
        
        // Update queue failed count
        const [failedCount] = await db
          .select({ count: count(simulationRuns.id) })
          .from(simulationRuns)
          .where(and(
            eq(simulationRuns.queueId, queueId),
            eq(simulationRuns.status, 'failed')
          ));
          
        await db.update(simulationQueue)
          .set({ failedCount: failedCount.count || 0 })
          .where(eq(simulationQueue.id, queueId));
        
        // Broadcast simulation failed event
        this.broadcastEvent({
          type: 'simulation_failed',
          queueId,
          negotiationId: nextSimulation.negotiationId || '',
          data: {
            simulationId: nextSimulation.id,
            runNumber: nextSimulation.runNumber,
            error: error instanceof Error ? error.message : 'Unknown error',
            retryCount: newRetryCount,
            failed: failedCount.count || 0
          }
        });
        
      } else {
        // Reset to pending for retry
        await db.update(simulationRuns)
          .set({ 
            status: 'pending',
            retryCount: newRetryCount,
            startedAt: null,
            crashRecoveryData: JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
              retryAttempt: newRetryCount
            })
          })
          .where(eq(simulationRuns.id, nextSimulation.id));
      }
      
      return false;
    }
  }
  
  /**
   * Execute all remaining simulations in queue
   */
  static async executeAll(queueId: string): Promise<void> {
    let hasNext = true;
    
    while (hasNext) {
      hasNext = await this.executeNext(queueId);
      
      if (hasNext) {
        // Small delay between simulations to avoid overwhelming APIs
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  /**
   * Pause queue execution
   */
  static async pauseQueue(queueId: string): Promise<void> {
    await db.update(simulationQueue)
      .set({ 
        status: 'paused',
        pausedAt: new Date() 
      })
      .where(eq(simulationQueue.id, queueId));
  }
  
  /**
   * Resume queue execution
   */
  static async resumeQueue(queueId: string): Promise<void> {
    await db.update(simulationQueue)
      .set({ 
        status: 'running',
        pausedAt: null
      })
      .where(eq(simulationQueue.id, queueId));
  }
  
  /**
   * Stop queue execution (mark remaining as cancelled and stop running simulations)
   */
  static async stopQueue(queueId: string): Promise<void> {
    this.log.info(`Stopping queue ${queueId} - cancelling pending and running simulations`);
    // Fetch the queue to get negotiation id
    const [queue] = await db.select({ id: simulationQueue.id, negotiationId: simulationQueue.negotiationId, totalSimulations: simulationQueue.totalSimulations })
      .from(simulationQueue)
      .where(eq(simulationQueue.id, queueId));
    
    // Mark all pending AND running simulations as failed/cancelled
    const updatedRuns = await db.update(simulationRuns)
      .set({ 
        status: 'failed',
        completedAt: new Date() // Mark as completed so they don't get picked up again
      })
      .where(
        and(
          eq(simulationRuns.queueId, queueId),
          or(
            eq(simulationRuns.status, 'pending'),
            eq(simulationRuns.status, 'running')
          )
        )
      )
      .returning({ id: simulationRuns.id, status: simulationRuns.status, runNumber: simulationRuns.runNumber });
    
    this.log.info(`Stopped ${updatedRuns.length} simulations in queue ${queueId}`);
    
    // Update queue status using helper (also syncs parent negotiation)
    await this.updateQueueStatus(queueId, 'completed');
    
    // Broadcast stop event for any running simulations
    updatedRuns.forEach(run => {
      this.broadcastEvent({
        type: 'simulation_stopped',
        queueId,
        negotiationId: queue?.negotiationId || '',
        data: {
          simulationId: run.id,
          runNumber: run.runNumber,
          reason: 'manually_stopped'
        }
      });
    });

    // Broadcast queue completion/progress state
    try {
      const status = await this.getQueueStatus(queueId);
      if (status.completedCount + status.failedCount >= status.totalSimulations) {
        this.broadcastEvent({
          type: 'queue_completed',
          queueId,
          negotiationId: queue?.negotiationId || '',
          data: {
            totalSimulations: status.totalSimulations,
            completed: status.completedCount,
            failed: status.failedCount,
            totalCost: status.actualCost
          }
        });
      } else {
        this.broadcastEvent({
          type: 'queue_progress',
          queueId,
          negotiationId: queue?.negotiationId || '',
          data: {
            completed: status.completedCount,
            failed: status.failedCount,
            total: status.totalSimulations,
            percentage: status.progressPercentage
          }
        });
      }
    } catch (err) {
      this.log.warn({ err, queueId }, 'Failed to broadcast queue status after stop');
    }
  }
  
  /**
   * Check for recovery opportunities (orphaned simulations)
   */
  static async findRecoveryOpportunities(negotiationId: string): Promise<{
    hasRecoverableSession: boolean;
    queueId?: string;
    checkpoint?: SimulationCheckpoint;
    orphanedSimulations: string[];
  }> {
    // Find queues for this negotiation
    const queues = await db.select()
      .from(simulationQueue)
      .where(eq(simulationQueue.negotiationId, negotiationId));
    
    if (!queues.length) {
      return { hasRecoverableSession: false, orphanedSimulations: [] };
    }
    
    // Find orphaned simulations (running for >5 minutes)
    const orphanedSimulations = await db.select({ id: simulationRuns.id })
      .from(simulationRuns)
      .where(
        and(
          eq(simulationRuns.negotiationId, negotiationId),
          eq(simulationRuns.status, 'running'),
          lt(simulationRuns.startedAt, new Date(Date.now() - 5 * 60 * 1000))
        )
      );
    
    const latestQueue = queues[queues.length - 1];
    
    // Check if there's a checkpoint in the queue
    const checkpoint = latestQueue.crashRecoveryCheckpoint as SimulationCheckpoint | null;
    
    return {
      hasRecoverableSession: !!checkpoint || orphanedSimulations.length > 0,
      queueId: latestQueue.id,
      checkpoint: checkpoint || undefined,
      orphanedSimulations: orphanedSimulations.map(s => s.id)
    };
  }
  
  /**
   * Recover orphaned simulations
   */
  static async recoverOrphanedSimulations(simulationIds: string[]): Promise<void> {
    // Reset orphaned simulations to pending
    await db.update(simulationRuns)
      .set({ 
        status: 'pending',
        startedAt: null,
        // Note: retryCount will be incremented by the recovery logic
        crashRecoveryData: JSON.stringify({
          recovered: true,
          recoveredAt: new Date().toISOString()
        })
      })
      .where(or(...simulationIds.map(id => eq(simulationRuns.id, id))));
  }
  
  /**
   * Get simulation results for display by queue ID
   */
  static async getSimulationResults(queueId: string) {
    const results = await db.select({
      id: simulationRuns.id,
      runNumber: simulationRuns.runNumber,
      status: simulationRuns.status,
      techniqueId: simulationRuns.techniqueId,
      tacticId: simulationRuns.tacticId,
      totalRounds: simulationRuns.totalRounds,
      conversationLog: simulationRuns.conversationLog,
      otherDimensions: simulationRuns.otherDimensions,
      dealValue: simulationRuns.dealValue,
      actualCost: simulationRuns.actualCost,
      startedAt: simulationRuns.startedAt,
      completedAt: simulationRuns.completedAt
    })
    .from(simulationRuns)
    .where(eq(simulationRuns.queueId, queueId))
    .orderBy(simulationRuns.executionOrder);
    
    this.log.debug({ queueId, count: results.length, statuses: results.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) }, `[SIMULATION-QUEUE] getSimulationResults for queue`);
    
    // Convert string costs to numbers for frontend compatibility
    return results.map(result => {
      let parsedConversationLog: any = result.conversationLog;
      if (typeof parsedConversationLog === 'string') {
        try {
          parsedConversationLog = JSON.parse(parsedConversationLog);
        } catch (error) {
          parsedConversationLog = [];
        }
      }

      let parsedOtherDimensions: any = result.otherDimensions;
      if (typeof parsedOtherDimensions === 'string') {
        try {
          parsedOtherDimensions = JSON.parse(parsedOtherDimensions);
        } catch (error) {
          parsedOtherDimensions = {};
        }
      }

      return {
        ...result,
        conversationLog: parsedConversationLog || [],
        otherDimensions: parsedOtherDimensions || {},
        dealValue: result.dealValue ? parseFloat(result.dealValue) : null,
        actualCost: result.actualCost ? parseFloat(result.actualCost) : 0
      };
    });
  }

  /**
   * Get simulation results for display by negotiation ID
   */
  static async getSimulationResultsByNegotiation(negotiationId: string) {
    try {
      const results = await db.select({
        id: simulationRuns.id,
        runNumber: simulationRuns.runNumber,
        status: simulationRuns.status,
        techniqueId: simulationRuns.techniqueId,
        tacticId: simulationRuns.tacticId,
        personalityId: simulationRuns.personalityId,
        dealValue: simulationRuns.dealValue,
        outcome: simulationRuns.outcome,
        totalRounds: simulationRuns.totalRounds,
        conversationLog: simulationRuns.conversationLog,
        otherDimensions: simulationRuns.otherDimensions,
        actualCost: simulationRuns.actualCost,
        startedAt: simulationRuns.startedAt,
        completedAt: simulationRuns.completedAt,
        // AI Evaluation fields
        tacticalSummary: simulationRuns.tacticalSummary,
        techniqueEffectivenessScore: simulationRuns.techniqueEffectivenessScore,
        tacticEffectivenessScore: simulationRuns.tacticEffectivenessScore,
      })
      .from(simulationRuns)
      .where(eq(simulationRuns.negotiationId, negotiationId))
      .orderBy(simulationRuns.executionOrder);
      
      return results.map(result => {
        let parsedConversationLog: any = result.conversationLog;
        if (typeof parsedConversationLog === 'string') {
          try {
            parsedConversationLog = JSON.parse(parsedConversationLog);
          } catch (error) {
            parsedConversationLog = [];
          }
        }

        let parsedOtherDimensions: any = result.otherDimensions;
        if (typeof parsedOtherDimensions === 'string') {
          try {
            parsedOtherDimensions = JSON.parse(parsedOtherDimensions);
          } catch (error) {
            parsedOtherDimensions = {};
          }
        }

        return {
          ...result,
          conversationLog: parsedConversationLog || [],
          otherDimensions: parsedOtherDimensions || {}
        };
      });
    } catch (error) {
      this.log.warn({ negotiationId }, `No simulation results found for negotiation`);
      return [];
    }
  }

  /**
   * Find queue ID by negotiation ID
   */
  static async findQueueByNegotiation(negotiationId: string): Promise<string | null> {
    try {
      const [queue] = await db.select({ id: simulationQueue.id })
        .from(simulationQueue)
        .where(eq(simulationQueue.negotiationId, negotiationId))
        .orderBy(desc(simulationQueue.createdAt)) // Get the latest queue
        .limit(1);

      return queue?.id || null;
    } catch (error) {
      this.log.error({ err: error, negotiationId }, `Failed to find queue for negotiation`);
      return null;
    }
  }

  /**
   * Get all simulation runs for a queue
   */
  static async getQueueRuns(queueId: string): Promise<any[]> {
    try {
      const runs = await db.select()
        .from(simulationRuns)
        .where(eq(simulationRuns.queueId, queueId))
        .orderBy(desc(simulationRuns.startedAt));

      return runs;
    } catch (error) {
      this.log.error({ err: error, queueId }, `Failed to get runs for queue`);
      throw error;
    }
  }
  
  private static async updateQueueStatus(queueId: string, status: string): Promise<void> {
    const updates: any = { status };
    
    // Update queue timestamps
    if (status === 'running') {
      updates.startedAt = new Date();
    } else if (status === 'completed') {
      updates.completedAt = new Date();
    } else if (status === 'paused') {
      updates.pausedAt = new Date();
    }
    
    // Apply queue status update
    const [updatedQueue] = await db.update(simulationQueue)
      .set(updates)
      .where(eq(simulationQueue.id, queueId))
      .returning({ id: simulationQueue.id, negotiationId: simulationQueue.negotiationId });

    // Best-effort sync of parent negotiation.status for dashboard consistency
    try {
      if (updatedQueue?.negotiationId) {
        let negotiationStatus: 'running' | 'completed' | 'pending' | 'failed' | 'configured' = 'pending';
        if (status === 'running') negotiationStatus = 'running';
        else if (status === 'completed') negotiationStatus = 'completed';
        else if (status === 'failed') negotiationStatus = 'failed';
        else if (status === 'paused') negotiationStatus = 'running'; // treat paused as running for overview

        await db.update(negotiations)
          .set({ status: negotiationStatus })
          .where(eq(negotiations.id, updatedQueue.negotiationId));
      }
    } catch (err) {
      this.log.warn({ err, queueId }, 'Failed to sync negotiation status');
    }
  }

  /**
   * Mark stale running simulations as timeout
   */
  private static async timeoutStaleRunningSimulations(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - this.STALE_RUNNING_MS);
      const staleRuns = await db.select({
        id: simulationRuns.id,
        queueId: simulationRuns.queueId,
        negotiationId: simulationRuns.negotiationId,
        runNumber: simulationRuns.runNumber
      })
      .from(simulationRuns)
      .where(and(
        eq(simulationRuns.status, 'running'),
        lt(simulationRuns.startedAt, cutoff)
      ));

      if (staleRuns.length === 0) {
        return;
      }

      this.log.info({ count: staleRuns.length }, 'Timing out stale running simulations');

      // Mark all as timeout
      const staleIds = staleRuns.map(r => r.id);
      await db.update(simulationRuns)
        .set({ status: 'timeout', completedAt: new Date() })
        .where(or(...staleIds.map(id => eq(simulationRuns.id, id))));

      // Broadcast and update queues per affected queue
      const byQueue = new Map<string, typeof staleRuns>();
      for (const run of staleRuns) {
        const key = (run.queueId || '') as string;
        if (!key) continue;
        const list = (byQueue.get(key) || []) as any;
        (list as any).push(run);
        byQueue.set(key, list as any);
      }

      for (const entry of Array.from(byQueue.entries())) {
        const [queueId, runs] = entry;
        const negotiationId = (runs[0]?.negotiationId || '') as string;

        for (const run of runs) {
          this.broadcastEvent({
            type: 'simulation_failed',
            queueId,
            negotiationId,
            data: {
              simulationId: run.id,
              runNumber: run.runNumber,
              error: 'timeout'
            }
          });
        }

        // Update queue status and broadcast progress/completion
        const status = await this.getQueueStatus(queueId);
        if (status.completedCount + status.failedCount >= status.totalSimulations) {
          await this.updateQueueStatus(queueId, 'completed');
          this.broadcastEvent({
            type: 'queue_completed',
            queueId,
            negotiationId,
            data: {
              totalSimulations: status.totalSimulations,
              completed: status.completedCount,
              failed: status.failedCount,
              totalCost: status.actualCost
            }
          });
        } else {
          this.broadcastEvent({
            type: 'queue_progress',
            queueId,
            negotiationId,
            data: {
              completed: status.completedCount,
              failed: status.failedCount,
              total: status.totalSimulations,
              percentage: status.progressPercentage
            }
          });
        }
      }
    } catch (err) {
      this.log.warn({ err }, 'Failed to timeout stale simulations');
    }
  }

  /**
   * Trigger AI evaluation for a completed simulation (post-processing hook)
   */
  private static async triggerEvaluation(simulationRunId: string, negotiationId: string): Promise<void> {
    try {
      const { SimulationEvaluationService } = await import('./simulation-evaluation');

      // Get simulation run data
      const run = await db.select()
        .from(simulationRuns)
        .where(eq(simulationRuns.id, simulationRunId))
        .limit(1);

      if (run.length === 0) {
        this.log.warn(`[EVALUATION] Simulation run ${simulationRunId} not found`);
        return;
      }

      const simulationRun = run[0];

      // Get negotiation details
      const { storage: storageModule } = await import('../storage');
      const [negotiation, techniques, tactics, personalities] = await Promise.all([
        storageModule.getNegotiation(negotiationId),
        storageModule.getAllInfluencingTechniques(),
        storageModule.getAllNegotiationTactics(),
        storageModule.getAllPersonalityTypes(),
      ]);

      if (!negotiation) {
        this.log.warn(`[EVALUATION] Negotiation ${negotiationId} not found`);
        return;
      }

      const technique = techniques.find((t: any) => t.id === simulationRun.techniqueId);
      const tactic = tactics.find((t: any) => t.id === simulationRun.tacticId);
      const personality = personalities.find((p: any) => p.id === simulationRun.personalityId);

      if (!technique || !tactic) {
        this.log.warn(`[EVALUATION] Technique or tactic not found for simulation ${simulationRunId}`);
        return;
      }

      // Determine counterpart attitude
      const counterpartRole = negotiation.userRole === 'BUYER' ? 'SELLER' : 'BUYER';
      const counterpartAttitude = personality?.archetype || 'Standard';

      // Run evaluation asynchronously (don't block)
      await SimulationEvaluationService.evaluateAndSave(
        simulationRunId,
        simulationRun.conversationLog as any[],
        negotiation.userRole,
        technique.name,
        tactic.name,
        counterpartAttitude,
      );

      this.log.info(`[EVALUATION] ✓ Evaluation completed for simulation ${simulationRunId.slice(0, 8)}`);
    } catch (error) {
      this.log.error({ error }, `[EVALUATION] Failed to trigger evaluation`);
      // Don't throw - evaluation failure shouldn't break the simulation flow
    }
  }

  /**
   * Get all simulation runs that need AI evaluation
   * (completed or walk_away without tacticalSummary)
   */
  static async getSimulationRunsNeedingEvaluation(): Promise<any[]> {
    const runs = await db.select()
      .from(simulationRuns)
      .where(
        and(
          or(
            eq(simulationRuns.outcome, 'DEAL_ACCEPTED'),
            eq(simulationRuns.outcome, 'WALK_AWAY')
          ),
          isNull(simulationRuns.tacticalSummary)
        )
      );

    return runs;
  }

  /**
   * Backfill evaluations for simulation runs
   */
  static async backfillEvaluations(runs: any[]): Promise<void> {
    this.log.info(`[EVALUATION_BACKFILL] Starting backfill for ${runs.length} simulation runs`);
    
    const { storage: storageModule } = await import('../storage');
    const techniques = await storageModule.getAllInfluencingTechniques();
    const tactics = await storageModule.getAllNegotiationTactics();
    const personalities = await storageModule.getAllPersonalityTypes();
    
    let successCount = 0;
    let failedCount = 0;

    for (const run of runs) {
      try {
        // Get negotiation details
        const negotiation = run.negotiationId ? await storageModule.getNegotiation(run.negotiationId) : null;
        
        if (!negotiation) {
          this.log.warn(`[EVALUATION_BACKFILL] Negotiation not found for run ${run.id.slice(0, 8)}, skipping`);
          failedCount++;
          continue;
        }

        const technique = techniques.find((t: any) => t.id === run.techniqueId);
        const tactic = tactics.find((t: any) => t.id === run.tacticId);
        const personality = personalities.find((p: any) => p.id === run.personalityId);

        if (!technique || !tactic) {
          this.log.warn(`[EVALUATION_BACKFILL] Technique or tactic not found for run ${run.id.slice(0, 8)}, skipping`);
          failedCount++;
          continue;
        }

        // Determine counterpart attitude
        const counterpartAttitude = personality?.archetype || 'Standard';

        // Run evaluation
        await this.triggerEvaluation(run.id, negotiation.id);
        
        successCount++;
        this.log.info(`[EVALUATION_BACKFILL] ✓ Evaluated ${run.id.slice(0, 8)} (${successCount}/${runs.length})`);
        
        // Add small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        this.log.error({ error }, `[EVALUATION_BACKFILL] Failed to evaluate run ${run.id.slice(0, 8)}`);
        failedCount++;
      }
    }

    this.log.info(`[EVALUATION_BACKFILL] ✓ Backfill complete: ${successCount} succeeded, ${failedCount} failed`);
  }

  /**
   * Backfill evaluations for a specific negotiation
   */
  static async backfillEvaluationsForNegotiation(negotiationId: string): Promise<{
    successCount: number;
    failedCount: number;
    totalRuns: number;
  }> {
    // Get all simulation runs for this negotiation
    const allRuns = await db.select()
      .from(simulationRuns)
      .where(
        and(
          eq(simulationRuns.negotiationId, negotiationId),
          or(
            eq(simulationRuns.outcome, 'DEAL_ACCEPTED'),
            eq(simulationRuns.outcome, 'WALK_AWAY')
          )
        )
      );

    // Filter runs that need evaluation (NULL or empty string)
    const runs = allRuns.filter(r => !r.tacticalSummary || r.tacticalSummary.trim() === '');

    this.log.info({ 
      negotiationId: negotiationId.slice(0, 8), 
      totalRuns: allRuns.length, 
      runsNeedingEvaluation: runs.length,
      runIds: runs.map(r => `${r.id.slice(0, 8)} (outcome: ${r.outcome}, hasSummary: ${!!r.tacticalSummary})`)
    }, `[EVALUATION_BACKFILL] Negotiation summary`);
    
    this.log.info(`[EVALUATION_BACKFILL] Starting backfill for negotiation ${negotiationId.slice(0, 8)}: ${runs.length} runs`);
    
    let successCount = 0;
    let failedCount = 0;

    for (const run of runs) {
      try {
        // Run evaluation
        await this.triggerEvaluation(run.id, negotiationId);
        
        successCount++;
        this.log.info(`[EVALUATION_BACKFILL] ✓ Evaluated ${run.id.slice(0, 8)} (${successCount}/${runs.length})`);
        
        // Add small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        this.log.error({ error }, `[EVALUATION_BACKFILL] Failed to evaluate run ${run.id.slice(0, 8)}`);
        failedCount++;
      }
    }

    this.log.info(`[EVALUATION_BACKFILL] ✓ Backfill complete for negotiation ${negotiationId.slice(0, 8)}: ${successCount} succeeded, ${failedCount} failed`);
    
    return {
      successCount,
      failedCount,
      totalRuns: runs.length,
    };
  }

  /**
   * Get evaluation statistics
   */
  static async getEvaluationStats(): Promise<{
    total: number;
    evaluated: number;
    needingEvaluation: number;
    evaluationRate: number;
  }> {
    // Get all completed/walk_away simulation runs
    const allEligibleRuns = await db.select()
      .from(simulationRuns)
      .where(
        or(
          eq(simulationRuns.outcome, 'DEAL_ACCEPTED'),
          eq(simulationRuns.outcome, 'WALK_AWAY')
        )
      );

    const total = allEligibleRuns.length;
    const evaluated = allEligibleRuns.filter(r => r.tacticalSummary !== null).length;
    const needingEvaluation = total - evaluated;
    const evaluationRate = total > 0 ? (evaluated / total) * 100 : 0;

    return {
      total,
      evaluated,
      needingEvaluation,
      evaluationRate,
    };
  }
}
