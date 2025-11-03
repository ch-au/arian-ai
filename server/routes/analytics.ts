import { Router } from "express";
import { analyticsService } from "../services/analytics.js";
import { createAnalyticsExportRouter } from "./analytics-export.js";
import { createRequestLogger } from "../services/logger";

export function createAnalyticsRouter(): Router {
  const router = Router();
  const log = createRequestLogger("routes:analytics");

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
      log.error({ err: error, agentId: req.query.agentId, startDate: req.query.startDate, endDate: req.query.endDate }, "Failed to generate performance report");
      res.status(500).json({ error: "Failed to generate performance report" });
    }
  });

  // Mount export routes
  router.use(createAnalyticsExportRouter());

  return router;
}
