import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertAgentSchema, personalityProfileSchema } from "@shared/schema";

export function createAgentRouter(): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      const agents = await storage.getAllAgents();
      res.json(agents);
    } catch (error) {
      console.error("Failed to get agents:", error);
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
      console.error("Failed to get agent:", error);
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
      console.error("Failed to create agent:", error);
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
      console.error("Failed to update agent:", error);
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
      console.error("Failed to delete agent:", error);
      res.status(500).json({ error: "Failed to delete agent" });
    }
  });

  return router;
}
