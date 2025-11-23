import { Router } from "express";
import { analyticsService } from "../services/analytics";
import { createRequestLogger } from "../services/logger";
import { SimulationQueueService } from "../services/simulation-queue";
import { requireAuth } from "../middleware/auth";

export function createDashboardRouter(): Router {
  const router = Router();
  const log = createRequestLogger("routes:dashboard");

  router.get("/metrics", requireAuth, async (req, res) => {
    try {
      const metrics = await analyticsService.getDashboardMetrics((req as any).user.id);
      res.json(metrics);
    } catch (error) {
      log.error({ err: error }, "Failed to get dashboard metrics");
      res.status(500).json({ error: "Failed to get dashboard metrics" });
    }
  });

  router.get("/success-trends", requireAuth, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const trends = await analyticsService.getSuccessRateTrends(days, (req as any).user.id);
      res.json(trends);
    } catch (error) {
      log.error({ err: error, days: req.query.days }, "Failed to get success trends");
      res.status(500).json({ error: "Failed to get success trends" });
    }
  });

  router.get("/top-agents", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const agents = await analyticsService.getTopPerformingAgents(limit, (req as any).user.id);
      res.json(agents);
    } catch (error) {
      log.error({ err: error, limit: req.query.limit }, "Failed to get top agents");
      res.status(500).json({ error: "Failed to get top agents" });
    }
  });

  router.get("/evaluation-status", async (_req, res) => {
    try {
      const stats = await SimulationQueueService.getEvaluationStats();
      res.json(stats);
    } catch (error) {
      log.error({ err: error }, "Failed to load evaluation stats");
      res.status(500).json({ error: "Failed to load evaluation stats" });
    }
  });

  router.post("/evaluations/backfill", async (req, res) => {
    try {
      const limit = typeof req.body?.limit === "number" ? req.body.limit : undefined;
      const runs = await SimulationQueueService.getSimulationRunsNeedingEvaluation();
      const subset = limit ? runs.slice(0, limit) : runs;

      if (subset.length === 0) {
        res.json({ queued: 0, remaining: 0 });
        return;
      }

      await SimulationQueueService.backfillEvaluations(subset);
      const stats = await SimulationQueueService.getEvaluationStats();

      res.json({
        queued: subset.length,
        remaining: stats.needingEvaluation,
      });
    } catch (error) {
      log.error({ err: error }, "Failed to backfill evaluations");
      res.status(500).json({ error: "Failed to backfill evaluations" });
    }
  });

  return router;
}
