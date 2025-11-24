/**
 * Simulation Queue Management Service
 * Handles creation, execution, and monitoring of simulation queues with crash recovery
 */

import { db } from '../db';
import { storage } from '../storage';
import { simulationQueue, simulationRuns, negotiations, influencingTechniques, negotiationTactics, personalityTypes, dimensionResults, productResults } from '../../shared/schema';
import { eq, and, or, lt, count, sum, desc, isNull, inArray, sql } from 'drizzle-orm';
import { PythonNegotiationService } from './python-negotiation-service';
import { createRequestLogger } from './logger';
import { buildSimulationResultArtifacts } from './simulation-result-processor';
import { PlaybookGeneratorService } from './playbook-generator';

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
  techniques?: string[];
  tactics?: string[];
  personalities?: string[];
  // zopaDistances removed - distance is now modeled explicitly via counterpartDistance
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
  // Structured audit helper for log searchability
  private static audit(event: string, data: Record<string, any>) {
    this.log.info({ audit: event, ...data }, `[AUDIT] ${event}`);
  }
  
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
    const { negotiationId } = request;
    const negotiation = await storage.getNegotiation(negotiationId);
    if (!negotiation) {
      throw new Error(`Negotiation not found: ${negotiationId}`);
    }

    // Check if a queue already exists for this negotiation
    const existingQueues = await db.select()
      .from(simulationQueue)
      .where(eq(simulationQueue.negotiationId, negotiationId));

    if (existingQueues.length > 0) {
      const activeQueue = existingQueues.find(q =>
        q.status === 'pending' || q.status === 'running'
      );

      if (activeQueue) {
        this.log.warn({ negotiationId, queueId: activeQueue.id },
          '[SIMULATION-QUEUE] Queue already exists for this negotiation, returning existing queue');
        return activeQueue.id;
      }
    }

    const scenario = negotiation.scenario ?? {};
    const techniques =
      request.techniques?.length ? request.techniques : scenario.selectedTechniques ?? [];
    const tactics =
      request.tactics?.length ? request.tactics : scenario.selectedTactics ?? [];

    if (!techniques.length || !tactics.length) {
      throw new Error("Negotiation must have selected techniques and tactics before starting simulations");
    }

    let personalities = request.personalities?.length ? request.personalities : [];
    if (!personalities.length) {
      if (scenario.counterpartPersonality === "all-personalities") {
        personalities = ["all"];
      } else if (scenario.counterpartPersonality) {
        personalities = [scenario.counterpartPersonality];
      }
    }
    if (!personalities.length) {
      personalities = ["default"];
    }

    this.log.info(
      {
        negotiationId,
        techniques: techniques.length,
        tactics: tactics.length,
        personalities: personalities.length,
      },
      `[SIMULATION-QUEUE] Creating queue for negotiation`,
    );

    // Resolve personality types
    let actualPersonalities = personalities;
    if (personalities.includes('all')) {
      // Fetch all personality types from database
      const allPersonalityTypes = await db.select({ id: personalityTypes.id })
        .from(personalityTypes);
      actualPersonalities = allPersonalityTypes.map(p => p.id);
    }
    
    // Default to single value if empty array
    if (actualPersonalities.length === 0) {
      actualPersonalities = ['default'];
    }
    
    // Calculate total simulations (techniques × tactics × personalities)
    // Note: Distance is now modeled explicitly via counterpartDistance, so we skip distance variations
    const totalSimulations = techniques.length * tactics.length * actualPersonalities.length;
    
    // Estimate cost (rough estimate: $0.15 per simulation)
    const estimatedCost = totalSimulations * 0.15;
    
    // Create queue record
    const [queue] = await db.insert(simulationQueue).values({
      negotiationId,
      totalSimulations,
      estimatedTotalCost: estimatedCost.toString(),
      status: 'pending'
    }).returning();
    
    // Create simulation run records for all combinations (techniques × tactics × personalities)
    // Note: Distance is now modeled explicitly via counterpartDistance, so we skip distance variations
    const simulationRunData = [];
    let executionOrder = 1;
    
    for (const techniqueId of techniques) {
      for (const tacticId of tactics) {
        for (const personalityId of actualPersonalities) {
          simulationRunData.push({
            negotiationId,
            queueId: queue.id,
            runNumber: executionOrder,
            executionOrder,
            techniqueId,
            tacticId,
            personalityId,
            zopaDistance: null, // No longer used - distance is modeled via counterpartDistance
            status: 'pending' as const,
            estimatedDuration: 60 // 60 seconds default estimate
          });
          executionOrder++;
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
  
  static async stopQueuesForNegotiation(negotiationId: string): Promise<void> {
    const queues = await this.getQueuesByNegotiation(negotiationId);
    await Promise.all(
      queues.map((queue) =>
        queue?.id ? this.stopQueue(queue.id).catch((error) => this.log.warn({ err: error, queueId: queue.id }, 'Failed to stop queue')) : Promise.resolve(),
      ),
    );
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

      // Start the queue to ensure the background processor picks it up
      this.log.info(`Starting queue ${queueId.slice(0, 8)} after restarting ${updatedRows.length} failed runs`);
      await this.startQueue(queueId);
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
        otherDimensions: {}
      })
      .where(eq(simulationRuns.id, runId))
      .returning({ runNumber: simulationRuns.runNumber });

    // Update queue status to pending if it was completed and queue exists
    if (run.queueId) {
      await db.update(simulationQueue)
        .set({ status: 'pending' })
        .where(eq(simulationQueue.id, run.queueId));

      // Start the queue to ensure the background processor picks it up
      this.log.info(`Starting queue ${run.queueId.slice(0, 8)} after restarting run`);
      await this.startQueue(run.queueId);
    }

    if (!updatedRun) {
      throw new Error('Failed to restart simulation run');
    }

    const runNumber = Number(updatedRun.runNumber ?? 0);
    this.log.info(`Restarted run #${runNumber}`);
    return { runNumber };
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

    // Lock queue row and select/claim next run atomically to avoid multi-instance races
    const claimResult = await db.transaction(async (tx) => {
      // Lock queue row to serialize per-queue picks
      await tx.execute(sql`SELECT id FROM simulation_queue WHERE id = ${queueId} FOR UPDATE`);

      const [queueConfig] = await tx
        .select({ maxConcurrent: simulationQueue.maxConcurrent })
        .from(simulationQueue)
        .where(eq(simulationQueue.id, queueId));

      const maxConcurrent = queueConfig?.maxConcurrent && queueConfig.maxConcurrent > 0 ? queueConfig.maxConcurrent : 1;

      const [runningCountRow] = await tx
        .select({ count: count(simulationRuns.id) })
        .from(simulationRuns)
        .where(and(eq(simulationRuns.queueId, queueId), eq(simulationRuns.status, 'running')));

      const runningCount = runningCountRow?.count || 0;
      if (runningCount >= maxConcurrent) {
        return { status: 'at_capacity' as const };
      }

      // Find next pending run with row lock to prevent double-claim
      const pendingResult = await tx.execute(sql`
        SELECT id, negotiation_id, run_number, technique_id, tactic_id, personality_id, retry_count
        FROM simulation_runs
        WHERE queue_id = ${queueId} AND status = 'pending'
        ORDER BY execution_order
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `);

      const next = pendingResult.rows?.[0] as any;
      if (!next) {
        return { status: 'none' as const };
      }

      const startedAt = new Date();
      const [claimedRun] = await tx.update(simulationRuns)
        .set({
          status: 'running',
          startedAt,
          metadata: {
            checkpoint: {
              simulationId: next.id,
              queueId,
              startTime: Date.now(),
              round: 0,
            }
          }
        })
        .where(
          and(
            eq(simulationRuns.id, next.id),
            eq(simulationRuns.status, 'pending')
          )
        )
        .returning({
          id: simulationRuns.id,
          negotiationId: simulationRuns.negotiationId,
          runNumber: simulationRuns.runNumber,
          techniqueId: simulationRuns.techniqueId,
          tacticId: simulationRuns.tacticId,
          personalityId: simulationRuns.personalityId,
          retryCount: simulationRuns.retryCount,
        });

      if (!claimedRun) {
        return { status: 'contested' as const };
      }

      return { status: 'claimed' as const, run: claimedRun };
    });

    if (claimResult.status === 'at_capacity') {
      this.log.info(`[EXECUTE] Max concurrency reached for queue ${queueId.slice(0, 8)}, skipping this tick`);
      return true;
    }

    if (claimResult.status === 'none') {
      this.log.info(`[EXECUTE] No more pending simulations in queue ${queueId.slice(0, 8)}, marking as completed`);
      await this.updateQueueStatus(queueId, 'completed');
      return false;
    }

    if (claimResult.status !== 'claimed' || !claimResult.run) {
      this.log.warn(`[EXECUTE] Could not claim simulation (status=${claimResult.status}) for queue ${queueId.slice(0, 8)}`);
      return true;
    }

    let nextSimulation = claimResult.run;

    this.log.info(`[EXECUTE] Found simulation to execute: ${nextSimulation.id.slice(0, 8)} (Run #${nextSimulation.runNumber})`);
    this.log.info(`[EXECUTE] Technique: ${nextSimulation.techniqueId?.slice(0, 8)}, Tactic: ${nextSimulation.tacticId?.slice(0, 8)}`);
    this.audit('run_claimed', {
      queueId,
      simulationId: nextSimulation.id,
      runNumber: nextSimulation.runNumber,
      negotiationId: nextSimulation.negotiationId,
      techniqueId: nextSimulation.techniqueId,
      tacticId: nextSimulation.tacticId,
    });

    // Update queue status to running
    await this.updateQueueStatus(queueId, 'running');

    this.log.info({
      simulationId: nextSimulation.id,
      runNumber: nextSimulation.runNumber,
      techniqueId: nextSimulation.techniqueId,
      tacticId: nextSimulation.tacticId,
      retryCount: nextSimulation.retryCount || 0
    }, `🚀 Starting Run #${nextSimulation.runNumber}${nextSimulation.retryCount ? ` (Retry ${nextSimulation.retryCount})` : ''}`);

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

      this.log.info({
        simulationId: nextSimulation.id,
        runNumber: nextSimulation.runNumber,
        outcome: result.outcome,
        rounds: result.totalRounds
      }, `✅ [PYTHON] Negotiation completed! Outcome: ${result.outcome}, Rounds: ${result.totalRounds}`);

      // Guard against stop: if this run was marked non-running meanwhile, skip updating results
      const [latest] = await db.select({ status: simulationRuns.status })
        .from(simulationRuns)
        .where(eq(simulationRuns.id, nextSimulation.id));

      this.log.debug({
        simulationId: nextSimulation.id,
        runNumber: nextSimulation.runNumber,
        statusBeforeExecution: 'running',
        statusAfterExecution: latest?.status,
        outcome: result.outcome
      }, `Status check after Python execution`);

      // Guard against missing run
      if (!latest) {
        this.log.error({ simulationId: nextSimulation.id }, '⚠️ Simulation run disappeared from database!');
        return false;
      }

      // IMPORTANT: Only skip if explicitly aborted by user
      // If status is 'failed' but we got a successful result from Python, proceed anyway
      // This handles race conditions where retry logic marks run as 'failed' while Python is still completing
      if (latest.status === 'aborted') {
        this.log.warn(
          { simulationId: nextSimulation.id, status: latest.status, outcome: result.outcome },
          'Skipping result write; run was aborted by user'
        );
        return true; // Continue processing other simulations
      }

      // If status is 'failed' but Python succeeded with valid outcome, log warning but proceed
      if (latest.status === 'failed' && ['DEAL_ACCEPTED', 'WALK_AWAY', 'TERMINATED', 'MAX_ROUNDS_REACHED'].includes(result.outcome)) {
        this.log.warn(
          { simulationId: nextSimulation.id, status: latest.status, outcome: result.outcome },
          '⚠️ Run marked as failed but Python succeeded - likely retry race condition, proceeding with result write'
        );
      }

      // For any other status (including 'running', 'pending', 'completed', 'timeout', 'paused'),
      // proceed with writing results - the status will be updated correctly below
      if (latest.status !== 'running') {
        this.log.info({
          simulationId: nextSimulation.id,
          currentStatus: latest.status,
          outcome: result.outcome
        }, `Run status changed during execution (${latest.status}), but proceeding with result write`);
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
      const negotiationIdForRun = nextSimulation.negotiationId || '';

      // CRITICAL: Mark simulation as completed FIRST, before any analytics processing
      // This ensures Python execution success is persisted even if post-processing fails
      //
      // Design Decision: We intentionally do NOT use a transaction here because:
      // 1. Simulation completion must be committed immediately (Python succeeded)
      // 2. Analytics failures are non-critical and should not rollback the simulation
      // 3. Operators need to distinguish "negotiation failed" from "analytics failed"
      await db.update(simulationRuns)
        .set({
          status: status,
          completedAt: new Date(),
          conversationLog: normalizedConversationLog,
          totalRounds: result.totalRounds,
          actualCost: actualCost.toString(),
          outcome: result.outcome,
          metadata: {
            ...(nextSimulation.metadata ?? {}),
            checkpoint: null,
          },
        })
        .where(eq(simulationRuns.id, nextSimulation.id));

      this.log.info({
        simulationId: nextSimulation.id,
        runNumber: nextSimulation.runNumber,
        outcome: result.outcome,
        totalRounds: result.totalRounds,
        actualCost
      }, `✅ Simulation Run #${nextSimulation.runNumber} completed: ${result.outcome}, ${result.totalRounds} rounds`);
      this.audit('run_completed', {
        queueId,
        simulationId: nextSimulation.id,
        runNumber: nextSimulation.runNumber,
        negotiationId: nextSimulation.negotiationId,
        outcome: result.outcome,
        totalRounds: result.totalRounds,
        actualCost,
      });

      // Post-processing: Build and persist analytics (wrapped in try/catch)
      // Failures here should NOT flip the simulation back to failed status
      try {
        const negotiationRecord = (negotiationIdForRun ? await storage.getNegotiation(negotiationIdForRun) : null) ?? null;
        const products = negotiationIdForRun ? await storage.getProductsByNegotiation(negotiationIdForRun) : [];

        this.log.info({
          simulationId: nextSimulation.id.slice(0, 8),
          hasFinalOffer: !!result.finalOffer,
          dimensionValuesKeys: Object.keys(dimensionValues).join(', '),
          productsCount: products.length
        }, "[DEAL_VALUE] Calling buildSimulationResultArtifacts");

        const artifacts = buildSimulationResultArtifacts({
          runId: nextSimulation.id,
          negotiation: negotiationRecord,
          products,
          dimensionValues,
          conversationLog: normalizedConversationLog,
        });

        this.log.debug(
          {
            simulationId: nextSimulation.id,
            dealValue: artifacts.dealValue,
            dimensionsCaptured: artifacts.dimensionRows.length,
            productsCaptured: artifacts.productRows.length,
          },
          "[RESULTS] Processed simulation artifacts",
        );

        // Update deal value and dimensions (separate from critical status update)
        await db.update(simulationRuns)
          .set({
            otherDimensions: artifacts.otherDimensions,
            dealValue: artifacts.dealValue,
          })
          .where(eq(simulationRuns.id, nextSimulation.id));

        // Persist structured dimension + product results for analytics
        await db.delete(dimensionResults).where(eq(dimensionResults.simulationRunId, nextSimulation.id));
        if (artifacts.dimensionRows.length) {
          await db.insert(dimensionResults).values(artifacts.dimensionRows);
          this.log.debug(
            { simulationId: nextSimulation.id, count: artifacts.dimensionRows.length },
            "[RESULTS] Stored dimension results",
          );
        }

        await db.delete(productResults).where(eq(productResults.simulationRunId, nextSimulation.id));
        if (artifacts.productRows.length) {
          await db.insert(productResults).values(artifacts.productRows);
          this.log.debug(
            { simulationId: nextSimulation.id, count: artifacts.productRows.length, dealValue: artifacts.dealValue },
            "[RESULTS] Stored product results",
          );
        }

        this.log.info({
          simulationId: nextSimulation.id.slice(0, 8),
          dealValue: artifacts.dealValue
        }, `[RESULTS] Analytics persisted successfully, Deal: €${artifacts.dealValue || 0}`);

      } catch (analyticsError) {
        // Post-processing failure should NOT affect simulation success
        const errMsg = analyticsError instanceof Error ? analyticsError.message : String(analyticsError);
        this.log.error({
          err: analyticsError,
          simulationId: nextSimulation.id,
          runNumber: nextSimulation.runNumber,
        }, `⚠️  Analytics post-processing failed for Run #${nextSimulation.runNumber}: ${errMsg}`);

        // Store the analytics error in metadata for debugging, but keep status as completed
        await db.update(simulationRuns)
          .set({
            metadata: {
              ...(nextSimulation.metadata ?? {}),
              checkpoint: null,
              analyticsError: errMsg,
              analyticsErrorAt: new Date().toISOString(),
            },
          })
          .where(eq(simulationRuns.id, nextSimulation.id));
      }
      
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

      // Hook: Trigger AI evaluation after completion (successful or not)
      // Trigger for all completed outcomes except PAUSED or ERROR
      const completedOutcomes = ['DEAL_ACCEPTED', 'TERMINATED', 'WALK_AWAY', 'MAX_ROUNDS_REACHED'];
      if (completedOutcomes.includes(result.outcome)) {
        console.log(`[EVALUATION] 🚀 Starting evaluation for ${nextSimulation.id.slice(0, 8)} (outcome: ${result.outcome})`);
        this.triggerEvaluation(nextSimulation.id, nextSimulation.negotiationId || '', result.outcome).catch(err => {
          console.log(`[EVALUATION] ❌ Error: ${err.message}`);
          this.log.error(
            {
              simulationId: nextSimulation.id.slice(0, 8),
              error: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined
            },
            `[EVALUATION] Failed to evaluate simulation`
          );
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

        // Trigger playbook generation after all simulations are complete
        if (nextSimulation.negotiationId) {
          this.log.info(
            { negotiationId: nextSimulation.negotiationId.slice(0, 8), queueId: queueId.slice(0, 8) },
            '[QUEUE] All simulations complete - triggering playbook generation'
          );

          // Generate playbook asynchronously (don't block queue completion)
          PlaybookGeneratorService.generatePlaybook(nextSimulation.negotiationId)
            .then((result) => {
              if (result.success) {
                this.log.info(
                  {
                    negotiationId: nextSimulation.negotiationId?.slice(0, 8),
                    playbookLength: result.playbook?.length
                  },
                  '[QUEUE] Playbook generated successfully'
                );
              } else {
                this.log.error(
                  {
                    negotiationId: nextSimulation.negotiationId?.slice(0, 8),
                    error: result.error
                  },
                  '[QUEUE] Playbook generation failed'
                );
              }
            })
            .catch((err) => {
              this.log.error(
                {
                  negotiationId: nextSimulation.negotiationId?.slice(0, 8),
                  err
                },
                '[QUEUE] Playbook generation error'
              );
            });
        }
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
      // Extract detailed error information
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.log.error({
        err: error,
        simulationId: nextSimulation.id,
        runNumber: nextSimulation.runNumber,
        techniqueId: nextSimulation.techniqueId,
        tacticId: nextSimulation.tacticId,
        errorMessage,
        errorStack
      }, `❌ Simulation Run #${nextSimulation.runNumber} failed: ${errorMessage}`);

      // Log to console for visibility
      console.error(`\n========== SIMULATION FAILED ==========`);
      console.error(`Run #${nextSimulation.runNumber} (${nextSimulation.id.slice(0, 8)})`);
      console.error(`Error: ${errorMessage}`);
      console.error(`Stack: ${errorStack?.substring(0, 500)}`);
      console.error(`=======================================\n`);

      // Increment retry count
      const newRetryCount = (nextSimulation.retryCount || 0) + 1;

      if (newRetryCount >= (nextSimulation.maxRetries || 3)) {
        this.log.warn({
          simulationId: nextSimulation.id,
          runNumber: nextSimulation.runNumber,
          retryCount: newRetryCount,
          maxRetries: nextSimulation.maxRetries || 3
        }, `🔴 Max retries reached for Run #${nextSimulation.runNumber}, marking as failed`);

        // Max retries reached, mark as failed
        await db.update(simulationRuns)
          .set({
            status: 'failed',
            retryCount: newRetryCount,
            conversationLog: JSON.stringify([]), // Ensure conversationLog is not null
            metadata: {
              ...(nextSimulation.metadata ?? {}),
              lastError: errorMessage,
              errorStack: errorStack?.substring(0, 500), // Truncate stack trace
              finalRetry: true,
              failedAt: new Date().toISOString(),
            },
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
        
        this.audit('run_failed', {
          queueId,
          simulationId: nextSimulation.id,
          runNumber: nextSimulation.runNumber,
          negotiationId: nextSimulation.negotiationId,
          retryCount: newRetryCount,
          maxRetries: nextSimulation.maxRetries || 3,
          error: errorMessage,
        });

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
        this.log.info({
          simulationId: nextSimulation.id,
          runNumber: nextSimulation.runNumber,
          retryCount: newRetryCount,
          maxRetries: nextSimulation.maxRetries || 3
        }, `🔄 Retrying Run #${nextSimulation.runNumber} (Attempt ${newRetryCount}/${nextSimulation.maxRetries || 3})`);
        this.audit('run_retry', {
          queueId,
          simulationId: nextSimulation.id,
          runNumber: nextSimulation.runNumber,
          negotiationId: nextSimulation.negotiationId,
          retryCount: newRetryCount,
          error: errorMessage,
        });

        // Reset to pending for retry
        await db.update(simulationRuns)
          .set({
            status: 'pending',
            retryCount: newRetryCount,
            startedAt: null,
            metadata: {
              ...(nextSimulation.metadata ?? {}),
              lastError: errorMessage,
              errorStack: errorStack?.substring(0, 500),
              retryAttempt: newRetryCount,
              lastRetryAt: new Date().toISOString(),
            },
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
    const recoveryMetadata = {
      recovered: true,
      recoveredAt: new Date().toISOString(),
    };

    await db.update(simulationRuns)
      .set({ 
        status: 'pending',
        startedAt: null,
        metadata: recoveryMetadata,
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
      completedAt: simulationRuns.completedAt,
      metadata: simulationRuns.metadata,
      outcome: simulationRuns.outcome
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

      // Extract error message from metadata
      let errorMessage = null;
      if (result.metadata && typeof result.metadata === 'object') {
        const metadata = result.metadata as any;
        errorMessage = metadata.lastError || null;
      }

      return {
        ...result,
        conversationLog: parsedConversationLog || [],
        otherDimensions: parsedOtherDimensions || {},
        dealValue: result.dealValue ? parseFloat(result.dealValue) : null,
        actualCost: result.actualCost ? parseFloat(result.actualCost) : 0,
        errorMessage
      };
    });
  }

  static async getSimulationStats(negotiationId: string) {
    const runs = await db
      .select({
        status: simulationRuns.status,
      })
      .from(simulationRuns)
      .where(eq(simulationRuns.negotiationId, negotiationId));

    const stats = {
      totalRuns: runs.length,
      completedRuns: 0,
      runningRuns: 0,
      failedRuns: 0,
      pendingRuns: 0,
      successRate: 0,
      isPlanned: false,
    };

    for (const run of runs) {
      if (run.status === "completed") stats.completedRuns++;
      else if (run.status === "running") stats.runningRuns++;
      else if (run.status === "failed" || run.status === "timeout") stats.failedRuns++;
      else if (run.status === "pending") stats.pendingRuns++;
    }

    if (stats.totalRuns > 0) {
      stats.successRate = Math.round((stats.completedRuns / stats.totalRuns) * 100);
    } else {
      const negotiation = await storage.getNegotiation(negotiationId);
      const scenario = negotiation?.scenario ?? {};
      const planned =
        (scenario.selectedTechniques?.length || 0) *
        (scenario.selectedTactics?.length || 0);
      stats.isPlanned = planned > 0;
      if (stats.isPlanned) {
        stats.pendingRuns = planned;
      }
    }

    return stats;
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
        zopaDistance: simulationRuns.zopaDistance,
        dealValue: simulationRuns.dealValue,
        outcome: simulationRuns.outcome,
        totalRounds: simulationRuns.totalRounds,
        conversationLog: simulationRuns.conversationLog,
        otherDimensions: simulationRuns.otherDimensions,
        actualCost: simulationRuns.actualCost,
        startedAt: simulationRuns.startedAt,
        completedAt: simulationRuns.completedAt,
        metadata: simulationRuns.metadata,
        // AI Evaluation fields
        tacticalSummary: simulationRuns.tacticalSummary,
        techniqueEffectivenessScore: simulationRuns.techniqueEffectivenessScore,
        tacticEffectivenessScore: simulationRuns.tacticEffectivenessScore,
      })
      .from(simulationRuns)
      .where(eq(simulationRuns.negotiationId, negotiationId))
      .orderBy(simulationRuns.executionOrder);
      
      const runIds = results.map(r => r.id).filter(Boolean) as string[];
      let dimensionMap = new Map<string, Array<any>>();
      let productMap = new Map<string, Array<any>>();

      if (runIds.length) {
        const dimensionRows = await db
          .select({
            simulationRunId: dimensionResults.simulationRunId,
            dimensionName: dimensionResults.dimensionName,
            finalValue: dimensionResults.finalValue,
            targetValue: dimensionResults.targetValue,
            achievedTarget: dimensionResults.achievedTarget,
            priorityScore: dimensionResults.priorityScore,
          })
          .from(dimensionResults)
          .where(inArray(dimensionResults.simulationRunId, runIds));

        for (const row of dimensionRows) {
          const existing = dimensionMap.get(row.simulationRunId) ?? [];
          existing.push(row);
          dimensionMap.set(row.simulationRunId, existing);
        }

        const productRows = await db
          .select({
            simulationRunId: productResults.simulationRunId,
            productName: productResults.productName,
            agreedPrice: productResults.agreedPrice,
            subtotal: productResults.subtotal,
            withinZopa: productResults.withinZopa,
            performanceScore: productResults.performanceScore,
          })
          .from(productResults)
          .where(inArray(productResults.simulationRunId, runIds));

        for (const row of productRows) {
          const existing = productMap.get(row.simulationRunId) ?? [];
          existing.push(row);
          productMap.set(row.simulationRunId, existing);
        }
      }

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

        // Extract error message from metadata
        let errorMessage = null;
        if (result.metadata && typeof result.metadata === 'object') {
          const metadata = result.metadata as any;
          errorMessage = metadata.lastError || null;
        }

        return {
          ...result,
          conversationLog: parsedConversationLog || [],
          otherDimensions: parsedOtherDimensions || {},
          dimensionResults: dimensionMap.get(result.id) ?? [],
          productResults: productMap.get(result.id) ?? [],
          errorMessage
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
        let negotiationStatus: 'planned' | 'running' | 'completed' | 'aborted' = 'planned';
        if (status === 'running' || status === 'paused') negotiationStatus = 'running';
        else if (status === 'completed') negotiationStatus = 'completed';
        else if (status === 'failed' || status === 'timeout') negotiationStatus = 'aborted';

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
        this.audit('run_timeout', {
          queueId: run.queueId,
          simulationId: run.id,
          runNumber: run.runNumber,
          negotiationId: run.negotiationId,
        });
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
  private static async triggerEvaluation(simulationRunId: string, negotiationId: string, outcome?: string): Promise<void> {
    try {
      console.log(`[EVALUATION] → triggerEvaluation called for ${simulationRunId.slice(0, 8)}`);

      const { SimulationEvaluationService } = await import('./simulation-evaluation');
      this.audit('evaluation_triggered', {
        simulationId: simulationRunId,
        negotiationId,
        outcome,
      });

      // Get simulation run data
      const run = await db.select()
        .from(simulationRuns)
        .where(eq(simulationRuns.id, simulationRunId))
        .limit(1);

      if (run.length === 0) {
        this.log.warn(
          { simulationId: simulationRunId.slice(0, 8) },
          `[EVALUATION] Simulation run not found in database`
        );
        return;
      }

      const simulationRun = run[0];

      // Use provided outcome or fallback to DB value
      const finalOutcome = outcome || simulationRun.outcome || 'UNKNOWN';

      this.log.debug(
        {
          simulationId: simulationRunId.slice(0, 8),
          conversationLogLength: (simulationRun.conversationLog as any[])?.length || 0,
          techniqueId: simulationRun.techniqueId?.slice(0, 8),
          tacticId: simulationRun.tacticId?.slice(0, 8),
          personalityId: simulationRun.personalityId
        },
        "[EVALUATION] Fetching negotiation details"
      );

      // Get negotiation details
      const { storage: storageModule } = await import('../storage');
      const [negotiation, techniques, tactics, personalities] = await Promise.all([
        storageModule.getNegotiation(negotiationId),
        storageModule.getAllInfluencingTechniques(),
        storageModule.getAllNegotiationTactics(),
        storageModule.getAllPersonalityTypes(),
      ]);

      if (!negotiation) {
        this.log.warn(
          {
            simulationId: simulationRunId.slice(0, 8),
            negotiationId: negotiationId.slice(0, 8)
          },
          `[EVALUATION] Negotiation not found in database`
        );
        return;
      }

      const technique = techniques.find((t: any) => t.id === simulationRun.techniqueId);
      const tactic = tactics.find((t: any) => t.id === simulationRun.tacticId);
      const personality = personalities.find((p: any) => p.id === simulationRun.personalityId);

      if (!technique || !tactic) {
        this.log.warn(
          {
            simulationId: simulationRunId.slice(0, 8),
            hasTechnique: !!technique,
            hasTactic: !!tactic,
            techniqueId: simulationRun.techniqueId,
            tacticId: simulationRun.tacticId,
            availableTechniques: techniques.length,
            availableTactics: tactics.length
          },
          `[EVALUATION] Required technique or tactic not found in database`
        );
        return;
      }

      this.log.debug(
        {
          simulationId: simulationRunId.slice(0, 8),
          technique: technique.name,
          tactic: tactic.name,
          hasPersonality: !!personality
        },
        "[EVALUATION] Found technique and tactic data"
      );

      // Determine the role being evaluated
      // scenario.userRole = the role explicitly set by user in UI ("Ihre Rolle")
      // This is the SELF/USER agent role that we want to evaluate
      // Example: If user selects "Verkäufer:in" → userRole = "seller" → evaluate SELLER
      const selfAgentRole = (negotiation.scenario.userRole ?? 'buyer').toUpperCase() === 'SELLER' ? 'SELLER' : 'BUYER';
      const counterpartAttitude = personality?.archetype || 'Standard';

      this.log.info(
        {
          simulationId: simulationRunId.slice(0, 8),
          selfAgentRole,
          technique: technique.name,
          tactic: tactic.name,
          counterpartAttitude,
          outcome: finalOutcome
        },
        "[EVALUATION] Calling evaluateAndSave - evaluating SELF agent (scenario.userRole)"
      );

      // Run evaluation asynchronously (don't block)
      await SimulationEvaluationService.evaluateAndSave(
        simulationRunId,
        simulationRun.conversationLog as any[],
        selfAgentRole, // Evaluate the SELF agent (the role set in "Ihre Rolle")
        technique.name,
        technique.beschreibung, // Pass description
        tactic.name,
        tactic.beschreibung, // Pass description
        counterpartAttitude,
        finalOutcome
      );

      console.log(`[EVALUATION] ✓ Evaluation complete for ${simulationRunId.slice(0, 8)}`);
    } catch (error) {
      console.log(`[EVALUATION] ❌ FAILED for ${simulationRunId.slice(0, 8)}: ${error instanceof Error ? error.message : String(error)}`);
      this.log.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          simulationId: simulationRunId.slice(0, 8)
        },
        `[EVALUATION] Failed to trigger evaluation`
      );
      this.audit('evaluation_failed', {
        simulationId: simulationRunId,
        negotiationId,
        error: error instanceof Error ? error.message : String(error),
      });
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
        await this.triggerEvaluation(run.id, negotiation.id, run.outcome);
        
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
        await this.triggerEvaluation(run.id, negotiationId, run.outcome ?? undefined);
        
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

  /**
   * Retry failed or timed-out simulation runs
   * @param queueId - Queue ID to retry runs for
   * @param runIds - Optional array of specific run IDs to retry (if empty, retries all failed/timed-out runs)
   * @returns Number of runs marked for retry
   */
  static async retryFailedRuns(queueId: string, runIds?: string[]): Promise<{
    retriedCount: number;
    runIds: string[];
  }> {
    this.log.info({
      queueId: queueId.slice(0, 8),
      specificRuns: runIds?.length
    }, `[RETRY] Retrying ${runIds ? `${runIds.length} specific` : 'all failed/timed-out'} runs`);

    try {
      // Build query conditions
      let query;
      if (runIds && runIds.length > 0) {
        // Retry specific runs (failed or timed-out)
        query = db.update(simulationRuns)
          .set({
            status: 'pending',
            startedAt: null,
            completedAt: null,
            // Keep existing results but allow re-run
            metadata: {
              retried: true,
              retriedAt: new Date().toISOString(),
            }
          })
          .where(
            and(
              eq(simulationRuns.queueId, queueId),
              inArray(simulationRuns.id, runIds),
              or(
                eq(simulationRuns.status, 'failed'),
                eq(simulationRuns.status, 'timeout')
              )
            )
          );
      } else {
        // Retry all failed/timed-out runs in queue
        query = db.update(simulationRuns)
          .set({
            status: 'pending',
            startedAt: null,
            completedAt: null,
            metadata: {
              retried: true,
              retriedAt: new Date().toISOString(),
            }
          })
          .where(
            and(
              eq(simulationRuns.queueId, queueId),
              or(
                eq(simulationRuns.status, 'failed'),
                eq(simulationRuns.status, 'timeout')
              )
            )
          );
      }

      // Execute update
      await query;

      // Get updated runs to return their IDs
      let retriedRuns;
      if (runIds && runIds.length > 0) {
        retriedRuns = await db.select({ id: simulationRuns.id })
          .from(simulationRuns)
          .where(
            and(
              eq(simulationRuns.queueId, queueId),
              inArray(simulationRuns.id, runIds)
            )
          );
      } else {
        retriedRuns = await db.select({ id: simulationRuns.id })
          .from(simulationRuns)
          .where(
            and(
              eq(simulationRuns.queueId, queueId),
              eq(simulationRuns.status, 'pending')
            )
          );
      }

      const retriedIds = retriedRuns.map(r => r.id);

      // Reset queue status to pending if it was failed or completed
      const [queue] = await db.select()
        .from(simulationQueue)
        .where(eq(simulationQueue.id, queueId))
        .limit(1);

      if (queue && (queue.status === 'failed' || queue.status === 'completed')) {
        await db.update(simulationQueue)
          .set({ status: 'pending' })
          .where(eq(simulationQueue.id, queueId));
      }

      this.log.info({
        queueId: queueId.slice(0, 8),
        retriedCount: retriedIds.length
      }, `[RETRY] Marked ${retriedIds.length} runs for retry`);

      // Start the queue to trigger background processor
      if (retriedIds.length > 0) {
        this.log.info(`Starting queue ${queueId.slice(0, 8)} after retrying ${retriedIds.length} runs`);
        await this.startQueue(queueId);
      }

      // Broadcast retry event
      const [firstRun] = await db.select()
        .from(simulationRuns)
        .where(eq(simulationRuns.queueId, queueId))
        .limit(1);

      if (firstRun) {
        this.broadcastEvent({
          type: 'queue_progress',
          queueId,
          negotiationId: firstRun.negotiationId || '',
          data: {
            retriedCount: retriedIds.length,
            message: `Retrying ${retriedIds.length} failed runs`
          }
        });
      }

      return {
        retriedCount: retriedIds.length,
        runIds: retriedIds,
      };
    } catch (error) {
      this.log.error({ error, queueId: queueId.slice(0, 8) }, `[RETRY] Failed to retry runs`);
      throw error;
    }
  }
}
