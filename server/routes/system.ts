import { Router } from "express";
import type { NegotiationEngine } from "../services/negotiation-engine";
import { createRequestLogger } from "../services/logger";

export function createSystemRouter(negotiationEngine: NegotiationEngine): Router {
  const router = Router();
  const log = createRequestLogger("routes:system");

  router.get("/prompts/reload", async (_req, res) => {
    try {
      const { langfuseService } = await import("../services/langfuse");
      langfuseService.reloadPrompts();
      res.json({ message: "Prompts reloaded successfully" });
    } catch (error) {
      log.error({ err: error }, "Failed to reload prompts");
      res.status(500).json({ error: "Failed to reload prompts" });
    }
  });

  router.get("/system/status", async (_req, res) => {
    try {
      const status = {
        timestamp: new Date().toISOString(),
        activeNegotiations: negotiationEngine.getActiveNegotiationsCount(),
        systemHealth: "online",
        version: "1.0.0",
      };
      res.json(status);
    } catch (error) {
      log.error({ err: error }, "Failed to get system status");
      res.status(500).json({ error: "Failed to get system status" });
    }
  });

  router.get("/agents/health", async (_req, res) => {
    try {
      const { pythonAgentsBridge } = await import("../services/python-agents-bridge");
      const isHealthy = await pythonAgentsBridge.testConnection();

      if (isHealthy) {
        res.json({
          status: "healthy",
          pythonService: "connected",
          message: "Python OpenAI Agents service is running",
        });
      } else {
        res.status(503).json({
          status: "unhealthy",
          pythonService: "disconnected",
          message: "Python OpenAI Agents service is not responding",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(503).json({ status: "error", pythonService: "error", message, error: String(error) });
    }
  });

  router.post("/agents/test", async (_req, res) => {
    try {
      const { pythonAgentsBridge } = await import("../services/python-agents-bridge");
      const testResult = await pythonAgentsBridge.testAgents();
      res.json({ status: "success", message: "Python agents test completed", result: testResult });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ status: "error", message, error: String(error) });
    }
  });

  router.post("/python-negotiation/test", async (req, res) => {
    try {
      const { PythonNegotiationService } = await import("../services/python-negotiation-service");
      const { negotiationId, simulationRunId, maxRounds } = req.body;
      const result = await PythonNegotiationService.runNegotiation({
        negotiationId,
        simulationRunId,
        maxRounds: maxRounds || 3,
      });
      res.json({ status: "success", message: "Python negotiation completed", result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ status: "error", message, error: String(error) });
    }
  });

  return router;
}
