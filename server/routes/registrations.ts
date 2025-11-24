import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { createRequestLogger } from "../services/logger";
import { requireAuth } from "../middleware/auth";

const registrationSchema = z.object({
  organization: z.string().min(1),
  company: z.string().optional(),
  country: z.string().optional(),
  negotiationType: z.string().optional(),
  negotiationFrequency: z.string().optional(),
  goals: z.record(z.any()).optional(),
});

const marketSchema = z.object({
  name: z.string().min(1),
  region: z.string().optional(),
  countryCode: z.string().optional(),
  currencyCode: z.string().min(1),
  meta: z.record(z.any()).optional(),
});

const counterpartSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["retailer", "manufacturer", "distributor", "other"]),
  powerBalance: z.string().optional(),
  dominance: z.number().min(-100).max(100).optional(),
  affiliation: z.number().min(-100).max(100).optional(),
  style: z.string().optional(),
  constraintsMeta: z.record(z.any()).optional(),
  notes: z.string().optional(),
});

const productSchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional(),
  gtin: z.string().optional(),
  categoryPath: z.string().optional(),
  attrs: z.record(z.any()).optional(),
});

const dimensionSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  valueType: z.enum(["integer", "numeric", "text", "boolean", "json"]),
  unit: z.string().optional(),
  spec: z.record(z.any()).optional(),
});

export function createRegistrationRouter(): Router {
  const router = Router();
  const log = createRequestLogger("routes:registrations");

  // All registration/market/counterpart/product/dimension routes require authentication
  router.use(requireAuth);

  router.get("/", async (_req, res) => {
    try {
      const registrations = await storage.getRegistrations();
      res.json(registrations);
    } catch (error) {
      log.error({ err: error }, "Failed to list registrations");
      res.status(500).json({ error: "Failed to list registrations" });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const payload = registrationSchema.parse(req.body);
      const registration = await storage.createRegistration({
        ...payload,
        goals: payload.goals ?? {},
      });
      res.status(201).json(registration);
    } catch (error) {
      log.error({ err: error }, "Failed to create registration");
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.flatten() });
      }
      res.status(500).json({ error: "Failed to create registration" });
    }
  });

  router.get("/:registrationId/markets", async (req, res) => {
    try {
      const markets = await storage.getMarkets(req.params.registrationId);
      res.json(markets);
    } catch (error) {
      log.error({ err: error, registrationId: req.params.registrationId }, "Failed to list markets");
      res.status(500).json({ error: "Failed to list markets" });
    }
  });

  router.post("/:registrationId/markets", async (req, res) => {
    try {
      const payload = marketSchema.parse(req.body);
      const market = await storage.createMarket({
        ...payload,
        registrationId: req.params.registrationId,
        meta: payload.meta ?? {},
      });
      res.status(201).json(market);
    } catch (error) {
      log.error({ err: error, registrationId: req.params.registrationId }, "Failed to create market");
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.flatten() });
      }
      res.status(500).json({ error: "Failed to create market" });
    }
  });

  router.get("/:registrationId/counterparts", async (req, res) => {
    try {
      const counterparts = await storage.getCounterparts(req.params.registrationId);
      res.json(counterparts);
    } catch (error) {
      log.error({ err: error, registrationId: req.params.registrationId }, "Failed to list counterparts");
      res.status(500).json({ error: "Failed to list counterparts" });
    }
  });

  router.post("/:registrationId/counterparts", async (req, res) => {
    try {
      const payload = counterpartSchema.parse(req.body);
      const counterpart = await storage.createCounterpart({
        ...payload,
        registrationId: req.params.registrationId,
        constraintsMeta: payload.constraintsMeta ?? {},
        dominance: payload.dominance !== undefined ? String(payload.dominance) : undefined,
        affiliation: payload.affiliation !== undefined ? String(payload.affiliation) : undefined,
      });
      res.status(201).json(counterpart);
    } catch (error) {
      log.error({ err: error, registrationId: req.params.registrationId }, "Failed to create counterpart");
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.flatten() });
      }
      res.status(500).json({ error: "Failed to create counterpart" });
    }
  });

  router.get("/:registrationId/products", async (req, res) => {
    try {
      const products = await storage.getProducts(req.params.registrationId);
      res.json(products);
    } catch (error) {
      log.error({ err: error, registrationId: req.params.registrationId }, "Failed to list products");
      res.status(500).json({ error: "Failed to list products" });
    }
  });

  router.post("/:registrationId/products", async (req, res) => {
    try {
      const payload = productSchema.parse(req.body);
      const product = await storage.createProduct({
        ...payload,
        registrationId: req.params.registrationId,
        attrs: payload.attrs ?? {},
      });
      res.status(201).json(product);
    } catch (error) {
      log.error({ err: error, registrationId: req.params.registrationId }, "Failed to create product");
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.flatten() });
      }
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  router.get("/:registrationId/dimensions", async (req, res) => {
    try {
      const dims = await storage.getDimensions(req.params.registrationId);
      res.json(dims);
    } catch (error) {
      log.error({ err: error, registrationId: req.params.registrationId }, "Failed to list dimensions");
      res.status(500).json({ error: "Failed to list dimensions" });
    }
  });

  router.post("/:registrationId/dimensions", async (req, res) => {
    try {
      const payload = dimensionSchema.parse(req.body);
      const dimension = await storage.createDimension({
        ...payload,
        registrationId: req.params.registrationId,
        spec: payload.spec ?? {},
      });
      res.status(201).json(dimension);
    } catch (error) {
      log.error({ err: error, registrationId: req.params.registrationId }, "Failed to create dimension");
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.flatten() });
      }
      res.status(500).json({ error: "Failed to create dimension" });
    }
  });

  return router;
}
