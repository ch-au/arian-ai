import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertNegotiationContextSchema } from "@shared/schema";

export function createContextRouter(): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      const contexts = await storage.getAllNegotiationContexts();
      res.json(contexts);
    } catch (error) {
      console.error("Failed to get contexts:", error);
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
      console.error("Failed to get context:", error);
      res.status(500).json({ error: "Failed to get context" });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const contextData = insertNegotiationContextSchema.parse(req.body);
      const context = await storage.createNegotiationContext(contextData);
      res.status(201).json(context);
    } catch (error) {
      console.error("Failed to create context:", error);
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
