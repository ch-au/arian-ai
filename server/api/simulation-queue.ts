/**
 * API Endpoints for Simulation Queue Management
 */

import { Router } from 'express';
import { SimulationQueueService, CreateQueueRequest, ExecuteRequest } from '../services/simulation-queue';

const router = Router();

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
    console.error('Failed to create simulation queue:', error);
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
    console.error('Failed to get queues:', error);
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
    console.error('Failed to get queue status:', error);
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
      SimulationQueueService.executeAll(queueId).catch(error => {
        console.error('Background execution failed:', error);
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
    console.error('Failed to execute simulations:', error);
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
    console.error('Failed to pause queue:', error);
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
    console.error('Failed to resume queue:', error);
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
    console.error('Failed to stop queue:', error);
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
    console.error('Failed to check recovery opportunities:', error);
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
    console.error('Failed to recover simulations:', error);
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
    console.error('Failed to get simulation results:', error);
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
    console.error('Failed to find queue by negotiation:', error);
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
    console.error('Failed to restart failed simulations:', error);
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
    console.error('Failed to start queue:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router;