/**
 * API Endpoints for Simulation Queue Management
 */

import { Router } from 'express';
import { SimulationQueueService, CreateQueueRequest, ExecuteRequest } from '../services/simulation-queue';
import { createRequestLogger } from '../services/logger';

const router = Router();
const log = createRequestLogger('api:simulation-queue');

/**
 * POST /api/simulations/queue/:negotiationId
 * Create a new simulation queue
 */
router.post('/queue/:negotiationId', async (req, res) => {
  try {
    const { negotiationId } = req.params;
    const queueRequest: CreateQueueRequest = {
      negotiationId,
      ...req.body
    };

    const queueId = await SimulationQueueService.createQueue(queueRequest);
    
    res.json({ 
      success: true, 
      queueId,
      message: `Created queue with ${queueRequest.techniques.length * queueRequest.tactics.length * (queueRequest.personalities.length || 1) * (queueRequest.zopaDistances.length || 1)} simulations`
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
router.get('/queues', async (req, res) => {
  try {
    const { negotiationId } = req.query;
    
    if (!negotiationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'negotiationId query parameter is required' 
      });
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
router.get('/queue/:queueId/status', async (req, res) => {
  try {
    const { queueId } = req.params;
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
 * POST /api/simulations/queue/:queueId/execute
 * Execute simulations (next or all)
 */
router.post('/queue/:queueId/execute', async (req, res) => {
  try {
    const { queueId } = req.params;
    const executeRequest: ExecuteRequest = req.body;

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
router.post('/queue/:queueId/pause', async (req, res) => {
  try {
    const { queueId } = req.params;
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
router.post('/queue/:queueId/resume', async (req, res) => {
  try {
    const { queueId } = req.params;
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
router.post('/queue/:queueId/stop', async (req, res) => {
  try {
    const { queueId } = req.params;
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
router.get('/recovery/:negotiationId', async (req, res) => {
  try {
    const { negotiationId } = req.params;
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
router.post('/recovery/:negotiationId/recover', async (req, res) => {
  try {
    const { negotiationId } = req.params;
    const { orphanedSimulations } = req.body;
    
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
router.get('/queue/:queueId/results', async (req, res) => {
  try {
    const { queueId } = req.params;
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
router.get('/queue/by-negotiation/:negotiationId', async (req, res) => {
  try {
    const { negotiationId } = req.params;
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
router.get('/queue/:queueId/runs', async (req, res) => {
  try {
    const { queueId } = req.params;
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
router.post('/queue/:queueId/restart-failed', async (req, res) => {
  try {
    const { queueId } = req.params;
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
router.get('/system/status', async (req, res) => {
  try {
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
router.post('/system/reset-processing', async (req, res) => {
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
router.post('/run/:runId/restart', async (req, res) => {
  try {
    const { runId } = req.params;
    log.info({ runId }, '[API] Restarting simulation run');
    const result = await SimulationQueueService.restartSingleRun(runId);

    res.json({
      success: true,
      message: 'Simulation restarted successfully',
      runNumber: result.runNumber
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
router.post('/queue/:queueId/start', async (req, res) => {
  try {
    const { queueId } = req.params;
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