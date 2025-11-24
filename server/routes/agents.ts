import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertAgentSchema, personalityProfileSchema } from "@shared/schema";
import { createRequestLogger } from "../services/logger";
import { requireAuth } from "../middleware/auth";

export function createAgentRouter(): Router {
  const router = Router();
  const log = createRequestLogger("routes:agents");

  // All agent management endpoints require authentication
  router.use(requireAuth);

  router.get("/", async (_req, res) => {
    try {
      const agents = await storage.getAllAgents();
      res.json(agents);
    } catch (error) {
      log.error({ err: error }, "Failed to get agents");
      res.status(500).json({ error: "Failed to get agents" });
    }
  });

  router.get("/:id", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      log.error({ err: error, agentId: req.params.id }, "Failed to get agent");
      res.status(500).json({ error: "Failed to get agent" });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const agentData = insertAgentSchema.parse(req.body);
      personalityProfileSchema.parse(agentData.personalityProfile);
      const agent = await storage.createAgent(agentData);
      res.status(201).json(agent);
    } catch (error) {
      log.error({ err: error }, "Failed to create agent");
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid agent data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create agent" });
    }
  });

  router.put("/:id", async (req, res) => {
    try {
      const agentData = req.body;
      if (agentData.personalityProfile) {
        personalityProfileSchema.parse(agentData.personalityProfile);
      }
      const agent = await storage.updateAgent(req.params.id, agentData);
      res.json(agent);
    } catch (error) {
      log.error({ err: error, agentId: req.params.id }, "Failed to update agent");
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid agent data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update agent" });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      await storage.deleteAgent(req.params.id);
      res.status(204).send();
    } catch (error) {
      log.error({ err: error, agentId: req.params.id }, "Failed to delete agent");
      res.status(500).json({ error: "Failed to delete agent" });
    }
  });

  return router;
}
