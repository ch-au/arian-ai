/**
 * API Endpoints for Simulation Run Details
 */

import { Router } from 'express';
import { createRequestLogger } from '../services/logger';
import { requireAuth } from '../middleware/auth';
import { storage } from '../storage';
import { db } from '../db';
import {
  simulationRuns,
  influencingTechniques,
  negotiationTactics,
  productResults,
  dimensionResults
} from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();
const log = createRequestLogger('api:simulation-runs');

// Helper to verify simulation run access (via negotiation ownership)
async function verifySimulationRunAccess(runId: string, userId: number): Promise<boolean> {
  const [run] = await db
    .select({ negotiationId: simulationRuns.negotiationId })
    .from(simulationRuns)
    .where(eq(simulationRuns.id, runId));

  if (!run || !run.negotiationId) return false;

  const negotiation = await storage.getNegotiation(run.negotiationId);
  if (!negotiation) return false;

  return negotiation.userId === userId;
}

/**
 * GET /api/simulation-runs/:id
 * Get detailed information about a specific simulation run
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    // Verify access
    if (!await verifySimulationRunAccess(id, userId)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have access to this simulation run'
      });
    }

    // Get simulation run
    const run = await storage.getSimulationRun(id);

    if (!run) {
      return res.status(404).json({
        success: false,
        error: 'Simulation run not found'
      });
    }

    // Get related technique
    let technique = null;
    if (run.techniqueId) {
      const [t] = await db
        .select()
        .from(influencingTechniques)
        .where(eq(influencingTechniques.id, run.techniqueId));
      technique = t;
    }

    // Get related tactic
    let tactic = null;
    if (run.tacticId) {
      const [t] = await db
        .select()
        .from(negotiationTactics)
        .where(eq(negotiationTactics.id, run.tacticId));
      tactic = t;
    }

    // Get product results
    const products = await db
      .select()
      .from(productResults)
      .where(eq(productResults.simulationRunId, id));

    // Get dimension results
    const dimensions = await db
      .select()
      .from(dimensionResults)
      .where(eq(dimensionResults.simulationRunId, id));

    // Return comprehensive data
    res.json({
      success: true,
      data: {
        run,
        technique,
        tactic,
        productResults: products,
        dimensionResults: dimensions,
      }
    });

  } catch (error) {
    log.error({ error, runId: req.params.id }, 'Failed to fetch simulation run details');
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
