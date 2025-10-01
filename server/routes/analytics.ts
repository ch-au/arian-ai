import { Router } from "express";
import { analyticsService } from "../services/analytics";
import { createAnalyticsExportRouter } from "./analytics-export";

export function createAnalyticsRouter(): Router {
  const router = Router();

  router.get("/performance", async (req, res) => {
    try {
      const { agentId, startDate, endDate } = req.query;
      const report = await analyticsService.generatePerformanceReport(
        agentId as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
      );
      res.json(report);
    } catch (error) {
      console.error("Failed to generate performance report:", error);
      res.status(500).json({ error: "Failed to generate performance report" });
    }
  });

  // Mount export routes
  router.use(createAnalyticsExportRouter());

  return router;
}
