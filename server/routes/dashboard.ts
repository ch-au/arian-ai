import { Router } from "express";
import { analyticsService } from "../services/analytics";

export function createDashboardRouter(): Router {
  const router = Router();

  router.get("/metrics", async (_req, res) => {
    try {
      const metrics = await analyticsService.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Failed to get dashboard metrics:", error);
      res.status(500).json({ error: "Failed to get dashboard metrics" });
    }
  });

  router.get("/success-trends", async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const trends = await analyticsService.getSuccessRateTrends(days);
      res.json(trends);
    } catch (error) {
      console.error("Failed to get success trends:", error);
      res.status(500).json({ error: "Failed to get success trends" });
    }
  });

  router.get("/top-agents", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const agents = await analyticsService.getTopPerformingAgents(limit);
      res.json(agents);
    } catch (error) {
      console.error("Failed to get top agents:", error);
      res.status(500).json({ error: "Failed to get top agents" });
    }
  });

  return router;
}
