import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import {
  insertInfluencingTechniqueSchema,
  insertNegotiationTacticSchema,
} from "@shared/schema";
import { createRequestLogger } from "../services/logger";

export function createStrategyRouter(): Router {
  const router = Router();
  const log = createRequestLogger("routes:strategies");

  router.get("/tactics/category/:category", async (req, res) => {
    try {
      const tactics = await storage.getTacticsByCategory(req.params.category);
      res.json(tactics);
    } catch (error) {
      log.error({ err: error, category: req.params.category }, "Failed to get tactics by category");
      res.status(500).json({ error: "Failed to get tactics by category" });
    }
  });

  router.post("/tactics", async (req, res) => {
    try {
      const tacticData = insertNegotiationTacticSchema.parse(req.body);
      const tactic = await storage.createTactic(tacticData);
      res.status(201).json(tactic);
    } catch (error) {
      log.error({ err: error }, "Failed to create tactic");
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid tactic data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create tactic" });
    }
  });

  router.get("/influencing-techniques", async (_req, res) => {
    try {
      const techniques = await storage.getAllInfluencingTechniques();
      res.json(techniques);
    } catch (error) {
      log.error({ err: error }, "Failed to get influencing techniques");
      res.status(500).json({ error: "Failed to get influencing techniques" });
    }
  });

  router.post("/influencing-techniques", async (req, res) => {
    try {
      const techniqueData = insertInfluencingTechniqueSchema.parse(req.body);
      const technique = await storage.createInfluencingTechnique(techniqueData);
      res.status(201).json(technique);
    } catch (error) {
      log.error({ err: error }, "Failed to create influencing technique");
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid influencing technique data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create influencing technique" });
    }
  });

  router.get("/personality-types", async (_req, res) => {
    try {
      const personalityTypes = [
        {
          id: "1",
          name: "Aggressive",
          description: "Assertive and competitive negotiator",
          traits: "High assertiveness, low cooperation",
        },
        {
          id: "2",
          name: "Collaborative",
          description: "Seeks win-win solutions",
          traits: "High assertiveness, high cooperation",
        },
        {
          id: "3",
          name: "Accommodating",
          description: "Prioritizes relationships over outcomes",
          traits: "Low assertiveness, high cooperation",
        },
        {
          id: "4",
          name: "Competitive",
          description: "Focuses on winning at all costs",
          traits: "High assertiveness, low cooperation",
        },
        {
          id: "5",
          name: "Avoiding",
          description: "Prefers to avoid conflict",
          traits: "Low assertiveness, low cooperation",
        },
      ];
      res.json(personalityTypes);
    } catch (error) {
      log.error({ err: error }, "Failed to get personality types");
      res.status(500).json({ error: "Failed to get personality types" });
    }
  });

  router.post("/personality-types", async (req, res) => {
    try {
      const personalityType = await storage.createPersonalityType(req.body);
      res.status(201).json(personalityType);
    } catch (error) {
      log.error({ err: error }, "Failed to create personality type");
      res.status(500).json({ error: "Failed to create personality type" });
    }
  });

  router.get("/negotiation-tactics", async (_req, res) => {
    try {
      const tactics = await storage.getAllNegotiationTactics();
      res.json(tactics);
    } catch (error) {
      log.error({ err: error }, "Failed to get negotiation tactics");
      res.status(500).json({ error: "Failed to get negotiation tactics" });
    }
  });

  router.post("/negotiation-tactics", async (req, res) => {
    try {
      const tactic = await storage.createNegotiationTactic(req.body);
      res.status(201).json(tactic);
    } catch (error) {
      log.error({ err: error }, "Failed to create negotiation tactic");
      res.status(500).json({ error: "Failed to create negotiation tactic" });
    }
  });

  router.get("/tactics", async (_req, res) => {
    try {
      const tactics = await storage.getAllNegotiationTactics();
      res.json(tactics);
    } catch (error) {
      log.error({ err: error }, "Failed to get tactics");
      res.status(500).json({ error: "Failed to get tactics" });
    }
  });

  router.get("/techniques", async (_req, res) => {
    try {
      const techniques = await storage.getAllInfluencingTechniques();
      res.json(techniques);
    } catch (error) {
      log.error({ err: error }, "Failed to get techniques");
      res.status(500).json({ error: "Failed to get techniques" });
    }
  });

  return router;
}
