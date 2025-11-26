/**
 * API Endpoints for Simulation Queue Management
 */

import { Router, Response } from 'express';
import { SimulationQueueService, CreateQueueRequest, ExecuteRequest } from '../services/simulation-queue';
import { createRequestLogger } from '../services/logger';
import { requireAuth } from '../middleware/auth';
import { storage } from '../storage';
import { db } from '../db';
import { simulationQueue, simulationRuns } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();
const log = createRequestLogger('api:simulation-queue');

// Helper to verify negotiation ownership
async function verifyNegotiationAccess(negotiationId: string, userId: number): Promise<boolean> {
  const negotiation = await storage.getNegotiation(negotiationId);
  if (!negotiation) return false;
  return negotiation.userId === userId;
}

// Helper to verify queue ownership (via negotiation)
async function verifyQueueAccess(queueId: string, userId: number): Promise<boolean> {
  const [queue] = await db
    .select({ negotiationId: simulationQueue.negotiationId })
    .from(simulationQueue)
    .where(eq(simulationQueue.id, queueId));
    
  if (!queue) return false;
  return verifyNegotiationAccess(queue.negotiationId, userId);
}

// Helper to verify run access (via negotiation ownership)
async function verifyRunAccess(runId: string, userId: number): Promise<boolean> {
  const [run] = await db
    .select({ negotiationId: simulationRuns.negotiationId })
    .from(simulationRuns)
    .where(eq(simulationRuns.id, runId));

  if (!run || !run.negotiationId) return false;
  return verifyNegotiationAccess(run.negotiationId, userId);
}

/**
 * POST /api/simulations/queue/:negotiationId
 * Create a new simulation queue
 */
router.post('/queue/:negotiationId', requireAuth, async (req, res) => {
  try {
    const { negotiationId } = req.params;
    const userId = (req as any).user.id;

    if (!await verifyNegotiationAccess(negotiationId, userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const queueId = await SimulationQueueService.createQueue({
      negotiationId,
      ...(req.body || {}),
    });
    
    res.json({ 
      success: true,
      queueId
    });
  } catch (error) {
    log.error({ err: error, negotiationId: req.params.negotiationId }, 'Failed to create simulation queue');
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * GET /api/simulations/queues
 * Get queues by negotiation ID
 */
router.get('/queues', requireAuth, async (req, res) => {
  try {
    const { negotiationId } = req.query;
    const userId = (req as any).user.id;
    
    if (!negotiationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'negotiationId query parameter is required' 
      });
    }

    if (!await verifyNegotiationAccess(negotiationId as string, userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    
    const queues = await SimulationQueueService.getQueuesByNegotiation(negotiationId as string);
    res.json(queues);
  } catch (error) {
    log.error({ err: error, negotiationId: req.query.negotiationId }, 'Failed to get queues');
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * GET /api/simulations/queue/:queueId/status
 * Get current queue status and progress
 */
router.get('/queue/:queueId/status', requireAuth, async (req, res) => {
  try {
    const { queueId } = req.params;
    const userId = (req as any).user.id;

    if (!await verifyQueueAccess(queueId, userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const status = await SimulationQueueService.getQueueStatus(queueId);

    res.json({ success: true, data: status });
  } catch (error) {
    log.error({ err: error, queueId: req.params.queueId }, 'Failed to get queue status');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/simulations/queue/:queueId/retry
 * Retry failed simulation runs
 * Body: { runIds?: string[] } - optional array of specific run IDs to retry
 */
router.post('/queue/:queueId/retry', requireAuth, async (req, res) => {
  try {
    const { queueId } = req.params;
    const userId = (req as any).user.id;
    const { runIds } = req.body || {};

    if (!await verifyQueueAccess(queueId, userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    log.info({ queueId: queueId.slice(0, 8), runIds: runIds?.length }, 'Retrying failed runs');

    const result = await SimulationQueueService.retryFailedRuns(queueId, runIds);

    res.json({
      success: true,
      ...result,
      message: `Successfully marked ${result.retriedCount} runs for retry`
    });
  } catch (error) {
    log.error({ err: error, queueId: req.params.queueId }, 'Failed to retry runs');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/simulations/queue/:queueId/execute
 * Execute simulations (next or all)
 */
router.post('/queue/:queueId/execute', requireAuth, async (req, res) => {
  try {
    const { queueId } = req.params;
    const userId = (req as any).user.id;
    const executeRequest: ExecuteRequest = req.body;

    if (!await verifyQueueAccess(queueId, userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    if (executeRequest.mode === 'next') {
      const hasNext = await SimulationQueueService.executeNext(queueId);
      res.json({ 
        success: true, 
        hasNext,
        message: hasNext ? 'Next simulation started' : 'No more simulations to run'
      });
    } else if (executeRequest.mode === 'all') {
      // Execute all in background
      const qId = queueId;
      SimulationQueueService.executeAll(queueId).catch(error => {
        log.error({ err: error, queueId: qId }, 'Background execution failed');
      });
      
      res.json({ 
        success: true, 
        message: 'All simulations started in background'
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid execution mode. Use "next" or "all"' 
      });
    }
  } catch (error) {
    log.error({ err: error, queueId: req.params.queueId }, 'Failed to execute simulations');
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * POST /api/simulations/queue/:queueId/pause
 * Pause queue execution
 */
router.post('/queue/:queueId/pause', requireAuth, async (req, res) => {
  try {
    const { queueId } = req.params;
    const userId = (req as any).user.id;

    if (!await verifyQueueAccess(queueId, userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    await SimulationQueueService.pauseQueue(queueId);
    
    res.json({ success: true, message: 'Queue paused successfully' });
  } catch (error) {
    log.error({ err: error, queueId: req.params.queueId }, 'Failed to pause queue');
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * POST /api/simulations/queue/:queueId/resume
 * Resume queue execution
 */
router.post('/queue/:queueId/resume', requireAuth, async (req, res) => {
  try {
    const { queueId } = req.params;
    const userId = (req as any).user.id;

    if (!await verifyQueueAccess(queueId, userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    await SimulationQueueService.resumeQueue(queueId);
    
    res.json({ success: true, message: 'Queue resumed successfully' });
  } catch (error) {
    log.error({ err: error, queueId: req.params.queueId }, 'Failed to resume queue');
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * POST /api/simulations/queue/:queueId/stop
 * Stop queue execution
 */
router.post('/queue/:queueId/stop', requireAuth, async (req, res) => {
  try {
    const { queueId } = req.params;
    const userId = (req as any).user.id;

    if (!await verifyQueueAccess(queueId, userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    await SimulationQueueService.stopQueue(queueId);
    
    res.json({ success: true, message: 'Queue stopped successfully' });
  } catch (error) {
    log.error({ err: error, queueId: req.params.queueId }, 'Failed to stop queue');
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * GET /api/simulations/recovery/:negotiationId
 * Check for recovery opportunities
 */
router.get('/recovery/:negotiationId', requireAuth, async (req, res) => {
  try {
    const { negotiationId } = req.params;
    const userId = (req as any).user.id;

    if (!await verifyNegotiationAccess(negotiationId, userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const recoveryData = await SimulationQueueService.findRecoveryOpportunities(negotiationId);
    
    res.json({ success: true, data: recoveryData });
  } catch (error) {
    log.error({ err: error, negotiationId: req.params.negotiationId }, 'Failed to check recovery opportunities');
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * POST /api/simulations/recovery/:negotiationId/recover
 * Recover orphaned simulations
 */
router.post('/recovery/:negotiationId/recover', requireAuth, async (req, res) => {
  try {
    const { negotiationId } = req.params;
    const userId = (req as any).user.id;
    const { orphanedSimulations } = req.body;
    
    if (!await verifyNegotiationAccess(negotiationId, userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    if (orphanedSimulations && orphanedSimulations.length > 0) {
      await SimulationQueueService.recoverOrphanedSimulations(orphanedSimulations);
    }
    
    res.json({ 
      success: true, 
      message: `Recovered ${orphanedSimulations?.length || 0} simulations`
    });
  } catch (error) {
    log.error({ err: error, negotiationId: req.params.negotiationId }, 'Failed to recover simulations');
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * GET /api/simulations/queue/:queueId/results
 * Get simulation results for visualization
 */
router.get('/queue/:queueId/results', requireAuth, async (req, res) => {
  try {
    const { queueId } = req.params;
    const userId = (req as any).user.id;

    if (!await verifyQueueAccess(queueId, userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const results = await SimulationQueueService.getSimulationResults(queueId);
    
    res.json({ success: true, data: results });
  } catch (error) {
    log.error({ err: error, queueId: req.params.queueId }, 'Failed to get simulation results');
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * GET /api/simulations/queue/by-negotiation/:negotiationId
 * Find queue ID by negotiation ID
 */
router.get('/queue/by-negotiation/:negotiationId', requireAuth, async (req, res) => {
  try {
    const { negotiationId } = req.params;
    const userId = (req as any).user.id;

    if (!await verifyNegotiationAccess(negotiationId, userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const queueId = await SimulationQueueService.findQueueByNegotiation(negotiationId);
    
    if (queueId) {
      res.json({ success: true, queueId });
    } else {
      res.json({ success: false, message: 'No queue found for this negotiation' });
    }
  } catch (error) {
    log.error({ err: error, negotiationId: req.params.negotiationId }, 'Failed to find queue by negotiation');
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * GET /api/simulations/queue/:queueId/runs
 * Get all simulation runs for a queue
 */
router.get('/queue/:queueId/runs', requireAuth, async (req, res) => {
  try {
    const { queueId } = req.params;
    const userId = (req as any).user.id;

    if (!await verifyQueueAccess(queueId, userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const runs = await SimulationQueueService.getQueueRuns(queueId);

    res.json({
      success: true,
      data: runs
    });
  } catch (error) {
    log.error({ err: error, queueId: req.params.queueId }, 'Failed to get queue runs');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/simulations/queue/:queueId/restart-failed
 * Restart failed/timeout simulations
 */
router.post('/queue/:queueId/restart-failed', requireAuth, async (req, res) => {
  try {
    const { queueId } = req.params;
    const userId = (req as any).user.id;

    if (!await verifyQueueAccess(queueId, userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const restartedCount = await SimulationQueueService.restartFailedSimulations(queueId);

    res.json({
      success: true,
      message: `Restarted ${restartedCount} failed simulations`,
      restartedCount
    });
  } catch (error) {
    log.error({ err: error, queueId: req.params.queueId }, 'Failed to restart failed simulations');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/simulations/system/status
 * Get system status including background processor
 */
router.get('/system/status', requireAuth, async (req, res) => {
  try {
    // System status might be restricted to admins, but for now allow authenticated users
    // Or restrict to admin if we have roles. Assuming authenticated is enough for now.
    const status = await SimulationQueueService.getSystemStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    log.error({ err: error }, 'Failed to get system status');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/simulations/system/reset-processing
 * Reset stuck processing queues (debug endpoint)
 */
router.post('/system/reset-processing', requireAuth, async (req, res) => {
  try {
    SimulationQueueService.resetProcessingQueues();
    res.json({
      success: true,
      message: 'Processing queue set cleared'
    });
  } catch (error) {
    log.error({ err: error }, 'Failed to reset processing queues');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/simulations/run/:runId/restart
 * Restart a single simulation run
 */
router.post('/run/:runId/restart', requireAuth, async (req, res) => {
  try {
    const { runId } = req.params;
    const userId = (req as any).user.id;

    if (!await verifyRunAccess(runId, userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    // Verify access via run -> queue -> negotiation
    // Since we don't have a direct helper for runId, we might need to implement one or fetch run details first.
    // For now, let's assume we can check access if we fetch the run.
    // However, `restartSingleRun` doesn't return the run details before restart.
    // Let's leave this specific endpoint for now or try to secure it if we can easily get the queueId from runId.
    // Actually, `restartSingleRun` fetches the run. We should probably add ownership check there or here.
    
    // TODO: Ideally, we should check ownership here.
    // For now, relying on queue-level security for other endpoints.
    // If strict security is needed for this specific endpoint, we should implement `verifyRunAccess(runId, userId)`.

    log.info({ runId }, '[API] Restarting simulation run');
    const result = await SimulationQueueService.restartSingleRun(runId);

    res.json({
      success: true,
      message: 'Simulation restarted successfully',
      runNumber: result.runNumber,
      newRunId: result.newRunId
    });
  } catch (error) {
    log.error({ err: error, runId: req.params.runId }, '[API] Failed to restart simulation run');
    if (error instanceof Error && error.stack) {
      log.error({ stack: error.stack }, '[API] Error stack');
    }
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/simulations/queue/:queueId/start
 * Start/resume a queue
 */
router.post('/queue/:queueId/start', requireAuth, async (req, res) => {
  try {
    const { queueId } = req.params;
    const userId = (req as any).user.id;

    if (!await verifyQueueAccess(queueId, userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    await SimulationQueueService.startQueue(queueId);

    res.json({
      success: true,
      message: 'Queue started/resumed successfully'
    });
  } catch (error) {
    log.error({ err: error, queueId: req.params.queueId }, 'Failed to start queue');
    res.status(500).json({
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router;
