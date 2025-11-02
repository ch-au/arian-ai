import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import type { NegotiationEngine } from "../services/negotiation-engine";
import { createRequestLogger } from "../services/logger";

export function createNegotiationRouter(negotiationEngine: NegotiationEngine): Router {
  const router = Router();
  const log = createRequestLogger("routes:negotiations");

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

            // For configured negotiations without queue, calculate planned simulations
            let plannedSimulations = 0;
            if (totalRuns === 0 && (negotiation.status === "configured" || negotiation.status === "pending")) {
              const techniques = negotiation.selectedTechniques?.length || 0;
              const tactics = negotiation.selectedTactics?.length || 0;

              // Calculate based on configuration
              const personalityMultiplier = negotiation.counterpartPersonality === "all-personalities" ? 5 : 1;
              const distanceMultiplier = negotiation.zopaDistance === "all-distances" ? 3 : 1;

              plannedSimulations = techniques * tactics * personalityMultiplier * distanceMultiplier;
            }

            return {
              ...negotiation,
              simulationStats: {
                totalRuns: totalRuns > 0 ? totalRuns : plannedSimulations,
                completedRuns,
                runningRuns,
                failedRuns,
                pendingRuns,
                successRate: totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0,
                isPlanned: totalRuns === 0 && plannedSimulations > 0, // Flag to indicate planned vs actual
              },
            };
          } catch (error) {
            log.warn({ err: error, negotiationId: negotiation.id }, "Failed to load simulation stats");
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
      log.error({ err: error }, "Failed to get negotiations");
      res.status(500).json({ error: "Failed to get negotiations" });
    }
  });

  router.get("/active", async (_req, res) => {
    try {
      const negotiations = await storage.getActiveNegotiations();
      res.json(negotiations);
    } catch (error) {
      log.error({ err: error }, "Failed to get active negotiations");
      res.status(500).json({ error: "Failed to get active negotiations" });
    }
  });

  router.get("/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const negotiations = await storage.getRecentNegotiations(limit);
      res.json(negotiations);
    } catch (error) {
      log.error({ err: error }, "Failed to get recent negotiations");
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
      log.error({ err: error, negotiationId: req.params.id }, "Failed to get negotiation");
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
      log.error({ err: error, negotiationId: req.params.id }, "Failed to get negotiation rounds");
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
        maxRounds: z.number().int().min(1).max(100).optional().default(10),
        buyerAgentId: z.string().uuid().optional(),
        sellerAgentId: z.string().uuid().optional(),
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
        buyerAgentId: validatedData.buyerAgentId || (validatedData.userRole === "buyer" ? agents[0].id : agents[1].id),
        sellerAgentId: validatedData.sellerAgentId || (validatedData.userRole === "buyer" ? agents[1].id : agents[0].id),
        userRole: validatedData.userRole,
        productMarketDescription: validatedData.productMarketDescription || null,
        additionalComments: validatedData.additionalComments || null,
        selectedTechniques: selectedTechniqueUUIDs,
        selectedTactics: selectedTacticUUIDs,
        counterpartPersonality: validatedData.counterpartPersonality || null,
        zopaDistance: validatedData.zopaDistance || null,
        maxRounds: validatedData.maxRounds || 10,
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
      log.error({ err: error }, "Failed to create enhanced negotiation");
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
      log.error({ err: error, negotiationId: req.params.id }, "Failed to update negotiation");
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
        title: z.string().min(1).default("Untitled Negotiation"),
        negotiationType: z.enum(["one-shot", "multi-year"]).default("one-shot"),
        relationshipType: z.enum(["first", "long-standing"]).default("first"),
        productMarketDescription: z.string().optional(),
        additionalComments: z.string().optional(),
        counterpartPersonality: z.string().optional(),
        zopaDistance: z.enum(["close", "medium", "far"]).optional(),
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
        title: validatedData.title,
        negotiationType: validatedData.negotiationType,
        relationshipType: validatedData.relationshipType,
        productMarketDescription: validatedData.productMarketDescription || null,
        additionalComments: validatedData.additionalComments || null,
        counterpartPersonality: validatedData.counterpartPersonality || null,
        zopaDistance: validatedData.zopaDistance || null,
        userZopa: validatedData.userZopa,
        counterpartDistance: validatedData.counterpartDistance,
        sonderinteressen: validatedData.sonderinteressen || null,
        status: "pending" as const,
      };

      // Create negotiation WITHOUT simulation runs (runs will be created by /start route via queue)
      const negotiation = await storage.createNegotiation(negotiationData);

      res.status(201).json({
        negotiation,
        message: "Negotiation created successfully. Use POST /api/negotiations/:id/start to begin simulations.",
      });
    } catch (error) {
      log.error({ err: error }, "Failed to create negotiation");
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

      if (negotiation.status !== "configured" && negotiation.status !== "pending") {
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

      // Auto-start the queue execution
      await SimulationQueueService.startQueue(queueId);

      const personalityMultiplier = personalities.includes("all") ? 5 : personalities.length;
      const distanceMultiplier = zopaDistances.includes("all") ? 3 : zopaDistances.length;
      const totalSimulations = selectedTechniques.length * selectedTactics.length * personalityMultiplier * distanceMultiplier;

      res.json({
        message: "Simulation queue created and started successfully",
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
      log.error({ err: error, negotiationId: req.params.id }, "Failed to start negotiation");
      
      // Provide more detailed error information
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorDetails = error instanceof Error ? error.stack : undefined;
      
      log.error({ 
        error: errorMessage, 
        stack: errorDetails,
        negotiationId: req.params.id 
      }, "Detailed error information");
      
      res.status(500).json({ 
        error: "Failed to start negotiation",
        details: errorMessage,
        negotiationId: req.params.id
      });
    }
  });

  router.post("/:id/stop", async (req, res) => {
    try {
      await negotiationEngine.stopNegotiation(req.params.id);
      res.json({ message: "Negotiation stopped successfully" });
    } catch (error) {
      log.error({ err: error, negotiationId: req.params.id }, "Failed to stop negotiation");
      res.status(500).json({ error: "Failed to stop negotiation" });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      await storage.deleteNegotiation(req.params.id);
      res.json({ message: "Negotiation deleted successfully" });
    } catch (error) {
      log.error({ err: error, negotiationId: req.params.id }, "Failed to delete negotiation");
      res.status(500).json({ error: "Failed to delete negotiation" });
    }
  });

  router.get("/:id/simulation-runs", async (req, res) => {
    try {
      const runs = await storage.getSimulationRuns(req.params.id);
      res.json(runs);
    } catch (error) {
      log.error({ err: error, negotiationId: req.params.id }, "Failed to get simulation runs");
      res.status(500).json({ error: "Failed to get simulation runs" });
    }
  });

  /**
   * POST /api/negotiations/:id/analysis/evaluate
   * Backfill AI evaluations for simulation runs that are missing them
   */
  router.post("/:id/analysis/evaluate", async (req, res) => {
    try {
      const { id: negotiationId } = req.params;
      
      if (!negotiationId) {
        return res.status(400).json({ error: 'Negotiation ID is required' });
      }

      const { SimulationQueueService } = await import("../services/simulation-queue");
      
      log.info({ negotiationId }, "[EVALUATION_BACKFILL] Starting evaluation");
      
      // Get count of runs that will be evaluated (same logic as service)
      const { simulationRuns } = await import("@shared/schema");
      const { db } = await import("../db");
      const { and, or, eq } = await import("drizzle-orm");
      
      const allRuns = await db.select()
        .from(simulationRuns)
        .where(
          and(
            eq(simulationRuns.negotiationId, negotiationId),
            or(
              eq(simulationRuns.outcome, 'DEAL_ACCEPTED'),
              eq(simulationRuns.outcome, 'WALK_AWAY')
            )
          )
        );
      
      // Filter runs that need evaluation (NULL or empty string)
      const runsToEvaluate = allRuns.filter(r => !r.tacticalSummary || r.tacticalSummary.trim() === '');
      
      log.info({ negotiationId, runsToEvaluate: runsToEvaluate.length, totalRuns: allRuns.length }, "[EVALUATION_BACKFILL] Found runs needing evaluation");
      
      // Start backfill process asynchronously
      SimulationQueueService.backfillEvaluationsForNegotiation(negotiationId).catch(error => {
        log.error({ err: error, negotiationId }, "[EVALUATION_BACKFILL] Backfill failed");
      });
      
      res.json({
        success: true,
        message: `Started evaluation for ${runsToEvaluate.length} simulation runs`,
        totalRuns: runsToEvaluate.length,
      });
    } catch (error) {
      log.error({ err: error }, "[EVALUATION_BACKFILL] Failed to start evaluation");
      const message = error instanceof Error ? error.message : 'Failed to start evaluation';
      res.status(500).json({ error: message });
    }
  });

  router.get("/:id/analysis", async (req, res) => {
    try {
      const negotiationId = req.params.id;

      // Get negotiation details
      const negotiation = await storage.getNegotiation(negotiationId);
      if (!negotiation) {
        return res.status(404).json({ error: "Negotiation not found" });
      }

      // Get all simulation runs via queue
      const { SimulationQueueService } = await import("../services/simulation-queue");
      const runs = await SimulationQueueService.getSimulationResultsByNegotiation(negotiationId);

      // Get techniques and tactics for name mapping
      const [allTechniques, allTactics, products] = await Promise.all([
        storage.getAllInfluencingTechniques(),
        storage.getAllNegotiationTactics(),
        storage.getProductsByNegotiation(negotiationId),
      ]);

      // Transform runs with enhanced data
      const enhancedRuns = runs.map((run) => {
        const technique = allTechniques.find(t => t.id === run.techniqueId);
        const tactic = allTactics.find(t => t.id === run.tacticId);
        const dealValue = run.dealValue ? parseFloat(run.dealValue) : 0;
        const totalRounds = run.totalRounds || 0;
        const efficiency = totalRounds > 0 ? dealValue / totalRounds : 0;

        return {
          id: run.id,
          runNumber: run.runNumber,
          techniqueId: run.techniqueId,
          tacticId: run.tacticId,
          techniqueName: technique?.name || "Unknown",
          tacticName: tactic?.name || "Unknown",
          dealValue,
          totalRounds,
          actualCost: parseFloat(run.actualCost || "0"),
          outcome: run.outcome,
          status: run.status,
          otherDimensions: run.otherDimensions || {},
          conversationLog: run.conversationLog || [],
          efficiency,
          // AI Evaluation fields
          tacticalSummary: run.tacticalSummary,
          techniqueEffectivenessScore: run.techniqueEffectivenessScore ? parseFloat(run.techniqueEffectivenessScore) : null,
          tacticEffectivenessScore: run.tacticEffectivenessScore ? parseFloat(run.tacticEffectivenessScore) : null,
        };
      });

      // Calculate summary statistics
      const completedRuns = enhancedRuns.filter(r => r.status === "completed" && r.dealValue > 0);

      const sortedByDealValue = [...completedRuns].sort((a, b) => b.dealValue - a.dealValue);
      const sortedByRounds = [...completedRuns].sort((a, b) => a.totalRounds - b.totalRounds);
      const sortedByEfficiency = [...completedRuns].sort((a, b) => b.efficiency - a.efficiency);

      const summary = {
        bestDealValue: sortedByDealValue[0] ? {
          runId: sortedByDealValue[0].id,
          value: sortedByDealValue[0].dealValue,
          technique: sortedByDealValue[0].techniqueName,
          tactic: sortedByDealValue[0].tacticName,
          rounds: sortedByDealValue[0].totalRounds,
        } : null,
        fastestCompletion: sortedByRounds[0] ? {
          runId: sortedByRounds[0].id,
          rounds: sortedByRounds[0].totalRounds,
          technique: sortedByRounds[0].techniqueName,
          tactic: sortedByRounds[0].tacticName,
          dealValue: sortedByRounds[0].dealValue,
        } : null,
        mostEfficient: sortedByEfficiency[0] ? {
          runId: sortedByEfficiency[0].id,
          efficiency: sortedByEfficiency[0].efficiency,
          technique: sortedByEfficiency[0].techniqueName,
          tactic: sortedByEfficiency[0].tacticName,
          dealValue: sortedByEfficiency[0].dealValue,
          rounds: sortedByEfficiency[0].totalRounds,
        } : null,
        avgDealValue: completedRuns.length > 0
          ? completedRuns.reduce((sum, r) => sum + r.dealValue, 0) / completedRuns.length
          : 0,
        avgRounds: completedRuns.length > 0
          ? completedRuns.reduce((sum, r) => sum + r.totalRounds, 0) / completedRuns.length
          : 0,
        totalRuns: runs.length,
        completedRuns: completedRuns.length,
      };

      // Create performance matrix (technique × tactic)
      const matrix: Record<string, any> = {};
      completedRuns.forEach(run => {
        const key = `${run.techniqueId}_${run.tacticId}`;
        if (!matrix[key]) {
          matrix[key] = {
            techniqueId: run.techniqueId,
            techniqueName: run.techniqueName,
            tacticId: run.tacticId,
            tacticName: run.tacticName,
            dealValue: run.dealValue,
            rounds: run.totalRounds,
            efficiency: run.efficiency,
            runId: run.id,
          };
        }
      });

      // Rank runs by deal value
      const rankedRuns = enhancedRuns.map((run, index) => ({
        ...run,
        rank: completedRuns.findIndex(r => r.id === run.id) + 1,
      }));

      res.json({
        negotiation: {
          id: negotiation.id,
          title: negotiation.title,
          userRole: negotiation.userRole,
          productCount: products.length,
        },
        runs: rankedRuns,
        summary,
        matrix: Object.values(matrix),
      });
    } catch (error) {
      log.error({ err: error, negotiationId: req.params.id }, "Failed to get negotiation analysis");
      res.status(500).json({ error: "Failed to get negotiation analysis" });
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
      log.error({ err: error, simulationRunId: req.params.runId }, "Failed to get simulation run status");
      res.status(500).json({ error: "Failed to get simulation run status" });
    }
  });

  router.post("/simulation-runs/:runId/stop", async (req, res) => {
    try {
      await negotiationEngine.stopNegotiation(req.params.runId);
      res.json({ message: "Simulation run stopped successfully" });
    } catch (error) {
      log.error({ err: error, simulationRunId: req.params.runId }, "Failed to stop simulation run");
      res.status(500).json({ error: "Failed to stop simulation run" });
    }
  });

  /**
   * POST /api/negotiations/phase2
   * Create negotiation with Phase 2 enhanced configuration
   */
  router.post("/phase2", async (req, res) => {
    try {
      const phase2Schema = z.object({
        // Grundeinstellungen
        title: z.string().min(1, "Title is required"),
        userRole: z.enum(["buyer", "seller"]),
        negotiationType: z.enum(["one-shot", "multi-year"]),
        companyKnown: z.boolean().optional(),
        counterpartKnown: z.boolean().optional(),
        negotiationFrequency: z.enum(["yearly", "quarterly", "monthly", "ongoing"]).optional(),
        powerBalance: z.number().int().min(0).max(100).optional(),
        maxRounds: z.number().int().min(1).max(15),
        marktProduktKontext: z.string().optional(),
        wichtigerKontext: z.string().optional(),

        // Dimensionen
        produkte: z.array(
          z.object({
            id: z.string(),
            produktName: z.string(),
            zielPreis: z.number(),
            minMaxPreis: z.number(),
            geschätztesVolumen: z.number().int(),
          })
        ).optional(),
        konditionen: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            einheit: z.string().optional(),
            minWert: z.number().optional(),
            maxWert: z.number().optional(),
            zielWert: z.number(),
            priorität: z.number().int().min(1).max(3),
          })
        ).optional(),

        // Taktiken & Techniken
        selectedTacticIds: z.array(z.string()),
        selectedTechniqueIds: z.array(z.string()),

        // Gegenseite
        beschreibungGegenseite: z.string().optional(),
        verhandlungsModus: z.enum(["kooperativ", "moderat", "aggressiv", "sehr-aggressiv"]).optional(),
        geschätzteDistanz: z.record(z.string(), z.number()).optional(),

        // Market Intelligence
        marketIntelligence: z.array(
          z.object({
            aspekt: z.string(),
            quelle: z.string(),
            relevanz: z.enum(["hoch", "mittel", "niedrig"]),
          })
        ).optional(),
      });

      const validatedData = phase2Schema.parse(req.body);

      log.debug({ 
        title: validatedData.title,
        produkte: validatedData.produkte?.length || 0,
        konditionen: validatedData.konditionen?.length || 0,
        tactics: validatedData.selectedTacticIds.length,
        techniques: validatedData.selectedTechniqueIds.length,
      }, "[phase2] Creating negotiation");

      // Get agents
      const agents = await storage.getAllAgents();

      if (agents.length === 0) {
        return res.status(400).json({
          error: "System not initialized",
          message: "No agents found. Please run seed data first.",
        });
      }

      // Use first two agents as buyer and seller
      const buyerAgent = agents[0];
      const sellerAgent = agents[1] || agents[0]; // Fallback to same agent if only one exists

      // Create a custom context for this phase2 negotiation based on actual data
      const customContext = await storage.createNegotiationContext({
        name: validatedData.title,
        description: validatedData.marktProduktKontext || "Phase 2 negotiation",
        productInfo: {
          products: validatedData.produkte || []
        },
        marketConditions: validatedData.marketIntelligence || [],
        baselineValues: {}
      });

      // Create negotiation with Phase 2 enhanced data
      const negotiationData = {
        contextId: customContext.id,
        buyerAgentId: buyerAgent.id,
        sellerAgentId: sellerAgent.id,
        title: validatedData.title,
        userRole: validatedData.userRole,
        negotiationType: validatedData.negotiationType,
        maxRounds: validatedData.maxRounds,
        status: "configured" as const, // Set status to configured so it can be started

        // Phase2 specific fields
        companyKnown: validatedData.companyKnown || false,
        counterpartKnown: validatedData.counterpartKnown || false,
        negotiationFrequency: validatedData.negotiationFrequency || null,
        powerBalance: validatedData.powerBalance || 50,
        verhandlungsModus: validatedData.verhandlungsModus || null,

        // Store Phase 2 data in appropriate fields
        relationshipType: validatedData.counterpartKnown ? "long-standing" : "first",
        productMarketDescription: validatedData.marktProduktKontext || "",
        additionalComments: validatedData.wichtigerKontext || "",

        selectedTechniques: validatedData.selectedTechniqueIds,
        selectedTactics: validatedData.selectedTacticIds,

        counterpartPersonality: validatedData.beschreibungGegenseite || "",
        zopaDistance: validatedData.verhandlungsModus || "moderat", // Keep for compatibility, but verhandlungsModus is preferred

        // Store geschätzteDistanz in metadata
        metadata: {
          geschätzteDistanz: validatedData.geschätzteDistanz || {},
        },

        // Default ZOPA for now - will be replaced with products/conditions
        userZopa: {
          volumen: { min: 100, max: 1000, target: 500 },
          preis: { min: 1, max: 10, target: 5 },
          laufzeit: { min: 1, max: 12, target: 6 },
          zahlungskonditionen: { min: 14, max: 90, target: 30 },
        },
        counterpartDistance: {
          volumen: 0,
          preis: 0,
          laufzeit: 0,
          zahlungskonditionen: 0,
        },
      };

      const negotiation = await storage.createNegotiation(negotiationData);

      // Store products with the negotiation
      if (validatedData.produkte && validatedData.produkte.length > 0) {
        const productsData = validatedData.produkte.map((p) => ({
          negotiationId: negotiation.id,
          produktName: p.produktName,
          zielPreis: p.zielPreis.toString(),
          minMaxPreis: p.minMaxPreis.toString(),
          geschätztesVolumen: p.geschätztesVolumen,
        }));
        await storage.createProducts(productsData);
      log.debug({ negotiationId: negotiation.id, productsCount: productsData.length }, "[phase2] Saved products");
      }

      // Store conditions (other dimensions) in negotiation_dimensions table
      if (validatedData.konditionen && validatedData.konditionen.length > 0) {
        const dimensionsData = validatedData.konditionen.map((k) => ({
          negotiationId: negotiation.id,
          name: k.name,
          minValue: (k.minWert || 0).toString(),
          maxValue: (k.maxWert || k.zielWert).toString(),
          targetValue: k.zielWert.toString(),
          priority: k.priorität,
          unit: k.einheit || null,
        }));
        await storage.createNegotiationDimensions(negotiation.id, dimensionsData);
        log.debug({ negotiationId: negotiation.id, dimensionsCount: dimensionsData.length }, "[phase2] Saved dimensions");
      }

      // TODO: Store market intelligence
      log.debug({ 
        negotiationId: negotiation.id,
        produkte: validatedData.produkte?.length || 0,
        konditionen: validatedData.konditionen?.length || 0,
        marketIntelligence: validatedData.marketIntelligence?.length || 0,
      }, "[phase2] Phase 2 data received");

      res.json({
        success: true,
        negotiation,
        message: "Phase 2 negotiation created successfully",
        productsCount: validatedData.produkte?.length || 0,
      });
    } catch (error) {
      log.error({ err: error }, "[phase2] Failed to create negotiation");
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Invalid negotiation data",
          details: error.errors
        });
      }
      const message = error instanceof Error ? error.message : "Failed to create Phase 2 negotiation";
      res.status(500).json({ error: message });
    }
  });

  /**
   * POST /api/negotiations/backfill-evaluations
   * Backfill AI evaluations for simulation runs that don't have them yet
   */
  router.post("/backfill-evaluations", async (req, res) => {
    try {
      const { SimulationQueueService } = await import("../services/simulation-queue");
      
      // Get all simulation runs that need evaluation
      const runsNeedingEvaluation = await SimulationQueueService.getSimulationRunsNeedingEvaluation();
      
      log.info({ runsNeedingEvaluation: runsNeedingEvaluation.length }, "[EVALUATION_BACKFILL] Found runs needing evaluation");
      
      // Start backfill process asynchronously
      SimulationQueueService.backfillEvaluations(runsNeedingEvaluation).catch(error => {
        log.error({ err: error }, "[EVALUATION_BACKFILL] Backfill process failed");
      });
      
      res.json({
        success: true,
        message: `Started backfill process for ${runsNeedingEvaluation.length} simulation runs`,
        totalRuns: runsNeedingEvaluation.length,
      });
    } catch (error) {
      log.error({ err: error }, "[EVALUATION_BACKFILL] Failed to start backfill");
      const message = error instanceof Error ? error.message : 'Failed to start evaluation backfill';
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /api/negotiations/evaluation-status
   * Get evaluation status statistics
   */
  router.get("/evaluation-status", async (_req, res) => {
    try {
      const { SimulationQueueService } = await import("../services/simulation-queue");
      
      const stats = await SimulationQueueService.getEvaluationStats();
      
      res.json(stats);
    } catch (error) {
      log.error({ err: error }, "[EVALUATION_STATUS] Failed to get evaluation status");
      const message = error instanceof Error ? error.message : 'Failed to get evaluation status';
      res.status(500).json({ error: message });
    }
  });

  return router;
}
