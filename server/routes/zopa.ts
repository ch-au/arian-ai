import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertZopaConfigurationSchema, zopaBoundariesSchema } from "@shared/schema";
import { analyticsService } from "../services/analytics";
import { createRequestLogger } from "../services/logger";

export function createZopaRouter(): Router {
  const router = Router();
  const log = createRequestLogger("routes:zopa");

  router.get("/context/:contextId", async (req, res) => {
    try {
      const configurations = await storage.getZopaConfigurationsByContext(
        req.params.contextId,
      );
      res.json(configurations);
    } catch (error) {
      log.error({ err: error, contextId: req.params.contextId }, "Failed to get ZOPA configurations");
      res.status(500).json({ error: "Failed to get ZOPA configurations" });
    }
  });

  router.get("/agent/:agentId", async (req, res) => {
    try {
      const configurations = await storage.getZopaConfigurationsByAgent(
        req.params.agentId,
      );
      res.json(configurations);
    } catch (error) {
      log.error({ err: error, contextId: req.params.contextId }, "Failed to get ZOPA configurations");
      res.status(500).json({ error: "Failed to get ZOPA configurations" });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const zopaData = insertZopaConfigurationSchema.parse(req.body);

      if (zopaData.boundaries) {
        zopaBoundariesSchema.parse(zopaData.boundaries);
      }

      const configuration = await storage.createZopaConfiguration(zopaData);
      res.status(201).json(configuration);
    } catch (error) {
      log.error({ err: error }, "Failed to create ZOPA configuration");
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid ZOPA data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create ZOPA configuration" });
    }
  });

  router.post("/analyze", async (req, res) => {
    try {
      const { buyerZopa, sellerZopa } = req.body;

      zopaBoundariesSchema.parse(buyerZopa);
      zopaBoundariesSchema.parse(sellerZopa);

      const analysis = await analyticsService.analyzeZopaOverlap(
        buyerZopa,
        sellerZopa,
      );
      res.json(analysis);
    } catch (error) {
      log.error({ err: error }, "Failed to analyze ZOPA");
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid ZOPA data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to analyze ZOPA" });
    }
  });

  return router;
}
