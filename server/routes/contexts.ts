import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertNegotiationContextSchema } from "@shared/schema";
import { createRequestLogger } from "../services/logger";

export function createContextRouter(): Router {
  const router = Router();
  const log = createRequestLogger("routes:contexts");

  router.get("/", async (_req, res) => {
    try {
      const contexts = await storage.getAllNegotiationContexts();
      res.json(contexts);
    } catch (error) {
      log.error({ err: error }, "Failed to get contexts");
      res.status(500).json({ error: "Failed to get contexts" });
    }
  });

  router.get("/:id", async (req, res) => {
    try {
      const context = await storage.getNegotiationContext(req.params.id);
      if (!context) {
        return res.status(404).json({ error: "Context not found" });
      }
      res.json(context);
    } catch (error) {
      log.error({ err: error, contextId: req.params.id }, "Failed to get context");
      res.status(500).json({ error: "Failed to get context" });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const contextData = insertNegotiationContextSchema.parse(req.body);
      const context = await storage.createNegotiationContext(contextData);
      res.status(201).json(context);
    } catch (error) {
      log.error({ err: error }, "Failed to create context");
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid context data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create context" });
    }
  });

  return router;
}
