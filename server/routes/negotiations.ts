import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import type { NegotiationEngine } from "../services/negotiation-engine";

export function createNegotiationRouter(negotiationEngine: NegotiationEngine): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      const negotiations = await storage.getAllNegotiations();

      const negotiationsWithStats = await Promise.all(
        negotiations.map(async (negotiation) => {
          try {
            const { SimulationQueueService } = await import("../services/simulation-queue");
            const simulationResults = await SimulationQueueService.getSimulationResultsByNegotiation(
              negotiation.id,
            );

            const totalRuns = simulationResults.length;
            const completedRuns = simulationResults.filter((r) => r.status === "completed").length;
            const runningRuns = simulationResults.filter((r) => r.status === "running").length;
            const failedRuns = simulationResults.filter((r) => r.status === "failed").length;
            const pendingRuns = simulationResults.filter((r) => r.status === "pending").length;

            return {
              ...negotiation,
              simulationStats: {
                totalRuns,
                completedRuns,
                runningRuns,
                failedRuns,
                pendingRuns,
                successRate: totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0,
              },
            };
          } catch (error) {
            console.error("Failed to load simulation stats:", error);
            return {
              ...negotiation,
              simulationStats: {
                totalRuns: 0,
                completedRuns: 0,
                runningRuns: 0,
                failedRuns: 0,
                pendingRuns: 0,
                successRate: 0,
              },
            };
          }
        }),
      );

      res.json(negotiationsWithStats);
    } catch (error) {
      console.error("Failed to get negotiations:", error);
      res.status(500).json({ error: "Failed to get negotiations" });
    }
  });

  router.get("/active", async (_req, res) => {
    try {
      const negotiations = await storage.getActiveNegotiations();
      res.json(negotiations);
    } catch (error) {
      console.error("Failed to get active negotiations:", error);
      res.status(500).json({ error: "Failed to get active negotiations" });
    }
  });

  router.get("/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const negotiations = await storage.getRecentNegotiations(limit);
      res.json(negotiations);
    } catch (error) {
      console.error("Failed to get recent negotiations:", error);
      res.status(500).json({ error: "Failed to get recent negotiations" });
    }
  });

  router.get("/:id", async (req, res) => {
    try {
      const negotiation = await storage.getNegotiation(req.params.id);
      if (!negotiation) {
        return res.status(404).json({ error: "Negotiation not found" });
      }

      const [dimensions, allTechniques, allTactics] = await Promise.all([
        storage.getNegotiationDimensions(req.params.id).catch(() => []),
        storage.getAllInfluencingTechniques().catch(() => []),
        storage.getAllNegotiationTactics().catch(() => []),
      ]);

      const formattedDimensions = dimensions.map((dim) => ({
        id: dim.id,
        name: dim.name,
        minValue: parseFloat(dim.minValue),
        maxValue: parseFloat(dim.maxValue),
        targetValue: parseFloat(dim.targetValue),
        priority: dim.priority,
        unit: dim.unit,
      }));

      const selectedTechniques = (negotiation.selectedTechniques || []).filter((id) =>
        allTechniques.some((tech) => tech.id === id),
      );

      const selectedTactics = (negotiation.selectedTactics || []).filter((id) =>
        allTactics.some((tactic) => tactic.id === id),
      );

      const response = {
        ...negotiation,
        selectedTechniques,
        selectedTactics,
        dimensions: formattedDimensions,
      };

      res.json(response);
    } catch (error) {
      console.error("Failed to get negotiation:", error);
      res.status(500).json({ error: "Failed to get negotiation" });
    }
  });

  router.get("/:id/dimensions", async (req, res) => {
    try {
      const dimensions = await storage.getNegotiationDimensions(req.params.id);
      res.json({
        negotiationId: req.params.id,
        dimensionsFound: dimensions.length,
        dimensions,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to get negotiation dimensions";
      res.status(500).json({ error: message });
    }
  });

  router.get("/:id/rounds", async (req, res) => {
    try {
      const rounds = await storage.getNegotiationRounds(req.params.id);
      res.json(rounds);
    } catch (error) {
      console.error("Failed to get negotiation rounds:", error);
      res.status(500).json({ error: "Failed to get negotiation rounds" });
    }
  });

  router.post("/enhanced", async (req, res) => {
    try {
      const enhancedNegotiationSchema = z.object({
        title: z.string().min(1, "Title is required"),
        userRole: z.enum(["buyer", "seller"]),
        negotiationType: z.enum(["one-shot", "multi-year"]),
        relationshipType: z.enum(["first", "long-standing"]),
        productMarketDescription: z.string().optional(),
        additionalComments: z.string().optional(),
        selectedTechniques: z.array(z.string()),
        selectedTactics: z.array(z.string()),
        counterpartPersonality: z.string().optional(),
        zopaDistance: z.string().optional(),
        dimensions: z.array(
          z.object({
            id: z.string(),
            name: z.string().min(1, "Dimension name is required"),
            minValue: z.number(),
            maxValue: z.number(),
            targetValue: z.number(),
            priority: z.number().int().min(1).max(3),
            unit: z.string().optional(),
          }),
        ).min(1, "At least one dimension is required"),
      });

      const validatedData = enhancedNegotiationSchema.parse(req.body);

      const agents = await storage.getAllAgents();
      const contexts = await storage.getAllNegotiationContexts();

      if (agents.length < 2) {
        throw new Error("At least 2 agents required");
      }
      if (contexts.length === 0) {
        throw new Error("At least 1 context required");
      }

      const [allTechniques, allTactics] = await Promise.all([
        storage.getAllInfluencingTechniques(),
        storage.getAllNegotiationTactics(),
      ]);

      const selectedTechniqueUUIDs = validatedData.selectedTechniques
        .map((nameOrId) =>
          allTechniques.find((tech) => tech.id === nameOrId || tech.name === nameOrId)?.id,
        )
        .filter((id): id is string => Boolean(id));

      const selectedTacticUUIDs = validatedData.selectedTactics
        .map((nameOrId) =>
          allTactics.find((tactic) => tactic.id === nameOrId || tactic.name === nameOrId)?.id,
        )
        .filter((id): id is string => Boolean(id));

      const negotiationData = {
        title: validatedData.title,
        negotiationType: validatedData.negotiationType,
        relationshipType: validatedData.relationshipType,
        contextId: contexts[0].id,
        buyerAgentId: validatedData.userRole === "buyer" ? agents[0].id : agents[1].id,
        sellerAgentId: validatedData.userRole === "buyer" ? agents[1].id : agents[0].id,
        userRole: validatedData.userRole,
        productMarketDescription: validatedData.productMarketDescription || null,
        additionalComments: validatedData.additionalComments || null,
        selectedTechniques: selectedTechniqueUUIDs,
        selectedTactics: selectedTacticUUIDs,
        counterpartPersonality: validatedData.counterpartPersonality || null,
        zopaDistance: validatedData.zopaDistance || null,
        status: "configured" as const,
      };

      const negotiation = await storage.createNegotiationWithDimensions(
        negotiationData,
        validatedData.dimensions.map((d) => ({
          name: d.name,
          minValue: d.minValue.toString(),
          maxValue: d.maxValue.toString(),
          targetValue: d.targetValue.toString(),
          priority: d.priority,
          unit: d.unit || null,
        })),
      );

      res.status(201).json({
        negotiation,
        dimensionsCount: validatedData.dimensions.length,
        message: "Negotiation created successfully",
      });
    } catch (error) {
      console.error("Failed to create enhanced negotiation:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid negotiation data", details: error.errors });
      }
      const message = error instanceof Error ? error.message : "Failed to create negotiation";
      res.status(500).json({ error: message, timestamp: new Date().toISOString() });
    }
  });

  router.put("/:id", async (req, res) => {
    try {
      const negotiationId = req.params.id;

      const enhancedNegotiationSchema = z.object({
        title: z.string().min(1, "Title is required"),
        userRole: z.enum(["buyer", "seller"]),
        negotiationType: z.enum(["one-shot", "multi-year"]),
        relationshipType: z.enum(["first", "long-standing"]),
        productMarketDescription: z.string().optional(),
        additionalComments: z.string().optional(),
        selectedTechniques: z.array(z.string()),
        selectedTactics: z.array(z.string()),
        counterpartPersonality: z.string().optional(),
        zopaDistance: z.enum(["close", "medium", "far"]).optional(),
        dimensions: z.array(
          z.object({
            id: z.string(),
            name: z.string().min(1, "Dimension name is required"),
            minValue: z.number(),
            maxValue: z.number(),
            targetValue: z.number(),
            priority: z.number().int().min(1).max(3),
            unit: z.string().optional(),
          }),
        ).min(1, "At least one dimension is required"),
      });

      const validatedData = enhancedNegotiationSchema.parse(req.body);

      const negotiationData = {
        title: validatedData.title,
        userRole: validatedData.userRole,
        negotiationType: validatedData.negotiationType,
        relationshipType: validatedData.relationshipType,
        productMarketDescription: validatedData.productMarketDescription || "",
        additionalComments: validatedData.additionalComments || "",
        selectedTechniques: validatedData.selectedTechniques,
        selectedTactics: validatedData.selectedTactics,
        counterpartPersonality: validatedData.counterpartPersonality,
        zopaDistance: validatedData.zopaDistance,
      };

      const updatedNegotiation = await storage.updateNegotiation(negotiationId, negotiationData);

      res.json({ negotiation: updatedNegotiation, message: "Negotiation updated successfully" });
    } catch (error) {
      console.error("Failed to update negotiation:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid negotiation data", details: error.errors });
      }
      const message = error instanceof Error ? error.message : "Failed to update negotiation";
      res.status(500).json({ error: message });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const createNegotiationSchema = z.object({
        contextId: z.string().uuid(),
        buyerAgentId: z.string().uuid(),
        sellerAgentId: z.string().uuid(),
        userRole: z.enum(["buyer", "seller"]),
        maxRounds: z.number().int().min(1).max(100),
        selectedTechniques: z.array(z.string()),
        selectedTactics: z.array(z.string()),
        userZopa: z.object({
          volumen: z.object({ min: z.number(), max: z.number(), target: z.number() }),
          preis: z.object({ min: z.number(), max: z.number(), target: z.number() }),
          laufzeit: z.object({ min: z.number(), max: z.number(), target: z.number() }),
          zahlungskonditionen: z.object({ min: z.number(), max: z.number(), target: z.number() }),
        }),
        counterpartDistance: z.object({
          volumen: z.number().min(-1).max(1),
          preis: z.number().min(-1).max(1),
          laufzeit: z.number().min(-1).max(1),
          zahlungskonditionen: z.number().min(-1).max(1),
        }),
        sonderinteressen: z.string().optional(),
      });

      const validatedData = createNegotiationSchema.parse(req.body);

      const negotiationData = {
        contextId: validatedData.contextId,
        buyerAgentId: validatedData.buyerAgentId,
        sellerAgentId: validatedData.sellerAgentId,
        userRole: validatedData.userRole,
        maxRounds: validatedData.maxRounds,
        selectedTechniques: validatedData.selectedTechniques,
        selectedTactics: validatedData.selectedTactics,
        userZopa: validatedData.userZopa,
        counterpartDistance: validatedData.counterpartDistance,
        sonderinteressen: validatedData.sonderinteressen || null,
        status: "pending" as const,
      };

      const result = await storage.createNegotiationWithSimulationRuns(negotiationData);

      res.status(201).json({
        negotiation: result.negotiation,
        simulationRuns: result.simulationRuns,
        totalCombinations: result.simulationRuns.length,
      });
    } catch (error) {
      console.error("Failed to create negotiation:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid negotiation data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create negotiation" });
    }
  });

  router.post("/:id/start", async (req, res) => {
    try {
      const negotiation = await storage.getNegotiation(req.params.id);
      if (!negotiation) {
        return res.status(404).json({ error: "Negotiation not found" });
      }

      if (negotiation.status !== "configured") {
        return res.status(400).json({ error: "Negotiation must be configured before starting" });
      }

      const { SimulationQueueService } = await import("../services/simulation-queue");

      const selectedTechniques = negotiation.selectedTechniques || [];
      const selectedTactics = negotiation.selectedTactics || [];

      if (selectedTechniques.length === 0 || selectedTactics.length === 0) {
        return res.status(400).json({
          error: "Negotiation must have at least one technique and one tactic selected",
        });
      }

      let personalities: string[] = [];
      let zopaDistances: string[] = [];

      if (negotiation.counterpartPersonality) {
        personalities =
          negotiation.counterpartPersonality === "all-personalities"
            ? ["all"]
            : [negotiation.counterpartPersonality];
      } else {
        personalities = ["all"];
      }

      if (negotiation.zopaDistance) {
        zopaDistances =
          negotiation.zopaDistance === "all-distances"
            ? ["all"]
            : [negotiation.zopaDistance];
      } else {
        zopaDistances = ["all"];
      }

      const queueId = await SimulationQueueService.createQueue({
        negotiationId: req.params.id,
        techniques: selectedTechniques,
        tactics: selectedTactics,
        personalities,
        zopaDistances,
      });

      await storage.updateNegotiationStatus(req.params.id, "running");

      const personalityMultiplier = personalities.includes("all") ? 5 : personalities.length;
      const distanceMultiplier = zopaDistances.includes("all") ? 3 : zopaDistances.length;
      const totalSimulations = selectedTechniques.length * selectedTactics.length * personalityMultiplier * distanceMultiplier;

      res.json({
        message: "Simulation queue created successfully",
        queueId,
        totalSimulations,
        breakdown: {
          techniques: selectedTechniques.length,
          tactics: selectedTactics.length,
          personalities: personalityMultiplier,
          distances: distanceMultiplier,
        },
      });
    } catch (error) {
      console.error("Failed to start negotiation:", error);
      res.status(500).json({ error: "Failed to start negotiation" });
    }
  });

  router.post("/:id/stop", async (req, res) => {
    try {
      await negotiationEngine.stopNegotiation(req.params.id);
      res.json({ message: "Negotiation stopped successfully" });
    } catch (error) {
      console.error("Failed to stop negotiation:", error);
      res.status(500).json({ error: "Failed to stop negotiation" });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      await storage.deleteNegotiation(req.params.id);
      res.json({ message: "Negotiation deleted successfully" });
    } catch (error) {
      console.error("Failed to delete negotiation:", error);
      res.status(500).json({ error: "Failed to delete negotiation" });
    }
  });

  router.get("/:id/simulation-runs", async (req, res) => {
    try {
      const runs = await storage.getSimulationRuns(req.params.id);
      res.json(runs);
    } catch (error) {
      console.error("Failed to get simulation runs:", error);
      res.status(500).json({ error: "Failed to get simulation runs" });
    }
  });

  router.get("/simulation-runs/:runId/status", async (req, res) => {
    try {
      const run = await storage.getSimulationRun(req.params.runId);
      if (!run) {
        return res.status(404).json({ error: "Simulation run not found" });
      }
      res.json(run);
    } catch (error) {
      console.error("Failed to get simulation run status:", error);
      res.status(500).json({ error: "Failed to get simulation run status" });
    }
  });

  router.post("/simulation-runs/:runId/stop", async (req, res) => {
    try {
      await negotiationEngine.stopNegotiation(req.params.runId);
      res.json({ message: "Simulation run stopped successfully" });
    } catch (error) {
      console.error("Failed to stop simulation run:", error);
      res.status(500).json({ error: "Failed to stop simulation run" });
    }
  });

  return router;
}
