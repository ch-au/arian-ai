import { Router } from "express";
import { z } from "zod";
import { storage, type NegotiationDimensionConfig, type NegotiationScenarioConfig } from "../storage";
import { createRequestLogger } from "../services/logger";
import type { NegotiationEngine } from "../services/negotiation-engine";
import { SimulationQueueService } from "../services/simulation-queue";
import { PlaybookGeneratorService } from "../services/playbook-generator";
import { type Negotiation, registrations, counterparts } from "@shared/schema";
import { requireAuth } from "../middleware/auth";
import { db } from "../db";
import { eq } from "drizzle-orm";

// Helper to fetch enriched metadata
async function getEnrichedMetadata(negotiationId: string, currentMetadata: any = {}) {
  const negotiation = await storage.getNegotiation(negotiationId);
  if (!negotiation) return currentMetadata;

  const simulationStats = await SimulationQueueService.getSimulationStats(negotiationId);
  
  // Default names
  let companyName = currentMetadata.company_name || "Ihr Unternehmen";
  let opponentName = currentMetadata.opponent_name || "Verhandlungspartner";
  
  // Fetch Registration (Company Name)
  if (negotiation.registrationId) {
    const [registration] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, negotiation.registrationId));
      
    if (registration) {
      companyName = registration.company || registration.organization || companyName;
    }
  }
  
  // Fetch Counterpart (Opponent Name)
  if (negotiation.counterpartId) {
    const [counterpart] = await db
      .select()
      .from(counterparts)
      .where(eq(counterparts.id, negotiation.counterpartId));
      
    if (counterpart) {
      opponentName = counterpart.name || opponentName;
    }
  }
  
  // Fallback to scenario if relational data is missing
  if ((companyName === "Ihr Unternehmen" || opponentName === "Verhandlungspartner") && negotiation.scenario) {
    const scenario = negotiation.scenario as any;
    if (companyName === "Ihr Unternehmen" && scenario.companyProfile) {
      companyName = scenario.companyProfile.company || scenario.companyProfile.organization || companyName;
    }
    if (opponentName === "Verhandlungspartner" && scenario.counterpartProfile) {
      opponentName = scenario.counterpartProfile.name || opponentName;
    }
  }

  return {
    ...currentMetadata,
    negotiation_id: negotiationId,
    negotiation_title: negotiation.title,
    company_name: companyName,
    opponent_name: opponentName,
    total_runs: simulationStats.totalRuns,
    generated_at: currentMetadata.generated_at || negotiation.playbookGeneratedAt || new Date(),
  };
}

const scenarioSchema: z.ZodType<NegotiationScenarioConfig> = z.object({
  title: z.string().optional(),
  userRole: z.enum(["buyer", "seller"]).optional(),
  negotiationType: z.string().optional(),
  relationshipType: z.string().optional(),
  negotiationFrequency: z.string().optional(),
  productMarketDescription: z.string().optional(),
  additionalComments: z.string().optional(),
  counterpartPersonality: z.string().optional(),
  zopaDistance: z.string().optional(),
  sonderinteressen: z.string().optional(),
  maxRounds: z.number().int().positive().optional(),
  selectedTechniques: z.array(z.string()).optional(),
  selectedTactics: z.array(z.string()).optional(),
  userZopa: z.record(z.any()).optional(),
  counterpartDistance: z.record(z.number()).optional(),
  metadata: z.record(z.any()).optional(),
  market: z
    .object({
      name: z.string().optional(),
      region: z.string().optional(),
      countryCode: z.string().optional(),
      currencyCode: z.string().optional(),
      intelligence: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  companyProfile: z
    .object({
      organization: z.string().optional(),
      company: z.string().optional(),
      country: z.string().optional(),
      negotiationType: z.string().optional(),
      negotiationFrequency: z.string().optional(),
      goals: z.record(z.any()).optional(),
    })
    .optional(),
  counterpartProfile: z
    .object({
      name: z.string().optional(),
      kind: z.string().optional(),
      powerBalance: z.string().optional(),
      style: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  products: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string(),
        brand: z.string().optional(),
        category: z.string().optional(),
        targetPrice: z.number().optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        estimatedVolume: z.number().optional(),
        attrs: z.record(z.any()).optional(),
      }),
    )
    .optional(),
  dimensions: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string(),
        minValue: z.number(),
        maxValue: z.number(),
        targetValue: z.number(),
        priority: z.number().int().min(1).max(3),
        unit: z.string().optional().nullable(),
      }),
    )
    .optional(),
});

const createNegotiationSchema = z.object({
  registrationId: z.string().uuid(),
  marketId: z.string().uuid().optional(),
  counterpartId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  scenario: scenarioSchema,
  productIds: z.array(z.string().uuid()).optional(),
});

const updateNegotiationSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["planned", "running", "completed", "aborted"]).optional(),
  scenario: scenarioSchema.optional(),
});

const dimensionsSchema = z.object({
  dimensions: z.array(
    z.object({
      id: z.string().uuid().optional(),
      name: z.string(),
      minValue: z.number(),
      maxValue: z.number(),
      targetValue: z.number(),
      priority: z.number().int().min(1).max(3),
      unit: z.string().optional().nullable(),
    }),
  ),
});

export function createNegotiationRouter(negotiationEngine: NegotiationEngine): Router {
  const router = Router();
  const log = createRequestLogger("routes:negotiations");

  router.get("/", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const records = await storage.getAllNegotiations(userId);
      const enriched = await Promise.all(
        records.map(async (negotiation) => ({
          ...negotiation,
          simulationStats: await SimulationQueueService.getSimulationStats(negotiation.id),
        })),
      );
      res.json(enriched);
    } catch (error) {
      log.error({ err: error }, "Failed to list negotiations");
      res.status(500).json({ error: "Failed to load negotiations" });
    }
  });

  router.get("/:id", requireAuth, async (req, res) => {
    try {
      const negotiation = await storage.getNegotiation(req.params.id);
      if (!negotiation) {
        return res.status(404).json({ error: "Negotiation not found" });
      }

      if (negotiation.userId && negotiation.userId !== (req as any).user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const products = await storage.getProductsByNegotiation(negotiation.id);
      const simulationStats = await SimulationQueueService.getSimulationStats(negotiation.id);
      res.json({
        negotiation,
        products,
        simulationStats,
      });
    } catch (error) {
      log.error({ err: error, negotiationId: req.params.id }, "Failed to fetch negotiation");
      res.status(500).json({ error: "Failed to fetch negotiation" });
    }
  });

  router.post("/", requireAuth, async (req, res) => {
    try {
      const payload = createNegotiationSchema.parse(req.body);
      const negotiation = await storage.createNegotiation({
        registrationId: payload.registrationId,
        userId: (req as any).user.id,
        marketId: payload.marketId,
        counterpartId: payload.counterpartId,
        title: payload.title,
        description: payload.description,
        scenario: payload.scenario,
        productIds: payload.productIds,
        status: "planned",
      });

      res.status(201).json(negotiation);
    } catch (error) {
      log.error({ err: error }, "Failed to create negotiation");
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.flatten() });
      } else {
        res.status(500).json({ error: "Failed to create negotiation" });
      }
    }
  });

  router.patch("/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getNegotiation(req.params.id);
      if (existing && existing.userId && existing.userId !== (req as any).user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const payload = updateNegotiationSchema.parse(req.body);
      const negotiation = await storage.updateNegotiation(req.params.id, {
        title: payload.title,
        description: payload.description,
        status: payload.status,
        scenario: payload.scenario,
      });

      res.json(negotiation);
    } catch (error) {
      log.error({ err: error, negotiationId: req.params.id }, "Failed to update negotiation");
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.flatten() });
      } else {
        res.status(500).json({ error: "Failed to update negotiation" });
      }
    }
  });

  router.post("/:id/start", requireAuth, async (req, res) => {
    try {
      const negotiation = await storage.getNegotiation(req.params.id);
      if (!negotiation) {
        return res.status(404).json({ error: "Negotiation not found" });
      }

      if (negotiation.userId && negotiation.userId !== (req as any).user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const ensureRunning = async () => {
        if (negotiation.status !== "running") {
          await storage.startNegotiation(negotiation.id);
        }
      };

      // Check for existing queue to resume
      const existingQueueId = await SimulationQueueService.findQueueByNegotiation(negotiation.id);
      if (existingQueueId) {
        const status = await SimulationQueueService.getQueueStatus(existingQueueId);

        // Resume if pending, paused, or running
        if (["pending", "paused", "running"].includes(status.status)) {
          await ensureRunning();
          if (status.status === "paused") {
            await SimulationQueueService.resumeQueue(existingQueueId);
          } else {
            await SimulationQueueService.startQueue(existingQueueId);
          }
          return res.json({ negotiationId: negotiation.id, queueId: existingQueueId, action: "resumed" });
        }

        // If completed/failed with outstanding work (pending, failed, or timeout runs), resume
        const outstandingCount = status.totalSimulations - status.completedCount;
        if (outstandingCount <= 0 && status.failedCount === 0) {
          return res.json({
            negotiationId: negotiation.id,
            queueId: existingQueueId,
            action: "already_completed",
            message: "Alle Simulationen durchgeführt",
          });
        }

        if (outstandingCount > 0) {
          // If there are failed runs, restart them
          if (status.failedCount > 0) {
            await SimulationQueueService.restartFailedSimulations(existingQueueId);
          }
          // Start the queue to process pending/restarted runs
          await ensureRunning();
          await SimulationQueueService.startQueue(existingQueueId);
          return res.json({ negotiationId: negotiation.id, queueId: existingQueueId, action: "resumed_pending" });
        }
      }

      // Create new queue ONLY if none exists OR previous is fully complete (all runs finished)
      await ensureRunning();
      const queueId = await SimulationQueueService.createQueue({ negotiationId: negotiation.id });
      await SimulationQueueService.startQueue(queueId);

      res.json({ negotiationId: negotiation.id, queueId, action: "created" });
    } catch (error) {
      log.error({ err: error, negotiationId: req.params.id }, "Failed to start negotiation");
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to start negotiation" });
    }
  });

  router.post("/:id/pause", requireAuth, async (req, res) => {
    try {
      const negotiation = await storage.getNegotiation(req.params.id);
      if (!negotiation) {
        return res.status(404).json({ error: "Negotiation not found" });
      }

      if (negotiation.userId && negotiation.userId !== (req as any).user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const queueId = await SimulationQueueService.findQueueByNegotiation(negotiation.id);
      if (queueId) {
        await SimulationQueueService.pauseQueue(queueId);
        // Update negotiation status to reflect paused state
        // Since 'paused' isn't a negotiation status in schema (only planned/running/completed/aborted),
        // we keep it as 'running' or update schema. 
        // SimulationQueueService.updateQueueStatus syncs negotiation status.
        // But updateQueueStatus sets negotiation to 'running' for 'paused' queue status.
        // So this is consistent.
      }

      res.json({ success: true });
    } catch (error) {
      log.error({ err: error, negotiationId: req.params.id }, "Failed to pause negotiation");
      res.status(500).json({ error: "Failed to pause negotiation" });
    }
  });

  router.post("/:id/stop", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getNegotiation(req.params.id);
      if (existing && existing.userId && existing.userId !== (req as any).user.id) {
         return res.status(403).json({ error: "Forbidden" });
      }

      await negotiationEngine.stopNegotiation(req.params.id);
      await SimulationQueueService.stopQueuesForNegotiation(req.params.id);
      const negotiation = await storage.updateNegotiationStatus(req.params.id, "aborted");
      res.json({ negotiation });
    } catch (error) {
      log.error({ err: error, negotiationId: req.params.id }, "Failed to stop negotiation");
      res.status(500).json({ error: "Failed to stop negotiation" });
    }
  });

  router.delete("/:id", requireAuth, async (req, res) => {
    try {
      const negotiation = await storage.getNegotiation(req.params.id);
      if (!negotiation) {
        return res.status(404).json({ error: "Negotiation not found" });
      }

      if (negotiation.userId && negotiation.userId !== (req as any).user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await negotiationEngine.stopNegotiation(req.params.id);
      await SimulationQueueService.stopQueuesForNegotiation(req.params.id);
      await storage.deleteNegotiation(req.params.id);
      res.json({ success: true });
    } catch (error) {
      log.error({ err: error, negotiationId: req.params.id }, "Failed to delete negotiation");
      res.status(500).json({ error: "Failed to delete negotiation" });
    }
  });

  router.get("/:id/dimensions", requireAuth, async (req, res) => {
    try {
      const negotiation = await storage.getNegotiation(req.params.id);
      if (negotiation && negotiation.userId && negotiation.userId !== (req as any).user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const dimensions = await storage.getNegotiationDimensions(req.params.id);
      res.json({ negotiationId: req.params.id, dimensions });
    } catch (error) {
      log.error({ err: error, negotiationId: req.params.id }, "Failed to fetch dimensions");
      res.status(500).json({ error: "Failed to fetch dimensions" });
    }
  });

  router.put("/:id/dimensions", requireAuth, async (req, res) => {
    try {
      const negotiation = await storage.getNegotiation(req.params.id);
      if (negotiation && negotiation.userId && negotiation.userId !== (req as any).user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const payload = dimensionsSchema.parse(req.body);
      const updated = await storage.setNegotiationDimensions(req.params.id, payload.dimensions as NegotiationDimensionConfig[]);
      res.json({ negotiationId: req.params.id, dimensions: updated });
    } catch (error) {
      log.error({ err: error, negotiationId: req.params.id }, "Failed to update dimensions");
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.flatten() });
      } else {
        res.status(500).json({ error: "Failed to update dimensions" });
      }
    }
  });

  router.get("/:id/analysis", requireAuth, async (req, res) => {
    try {
      const negotiation = await storage.getNegotiation(req.params.id);
      if (!negotiation) {
        return res.status(404).json({ error: "Negotiation not found" });
      }

      if (negotiation.userId && negotiation.userId !== (req as any).user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const [products, techniques, tactics, results] = await Promise.all([
        storage.getProductsByNegotiation(negotiation.id),
        storage.getAllInfluencingTechniques(),
        storage.getAllNegotiationTactics(),
        SimulationQueueService.getSimulationResultsByNegotiation(negotiation.id),
      ]);

      const techniqueMap = new Map((techniques ?? []).map((tech) => [tech.id, tech.name]));
      const tacticMap = new Map((tactics ?? []).map((tactic) => [tactic.id, tactic.name]));

      const userRole = negotiation.scenario?.userRole?.toLowerCase() === "buyer" ? "buyer" : "seller";

      const runs = results.map((run) => {
        const dealValue = run.dealValue ? Number(run.dealValue) : 0;
        const totalRounds = typeof run.totalRounds === "number" ? run.totalRounds : Number(run.totalRounds ?? 0);
        const actualCost = run.actualCost ? Number(run.actualCost) : 0;
        const efficiency = totalRounds > 0 ? dealValue / totalRounds : 0;
        const roundDimensions = extractRoundDimensions(run.conversationLog ?? []);

        return {
          id: run.id,
          runNumber: run.runNumber,
          status: run.status,
          techniqueId: run.techniqueId,
          techniqueName: techniqueMap.get(run.techniqueId ?? "") ?? "Unbekannte Technik",
          tacticId: run.tacticId,
          tacticName: tacticMap.get(run.tacticId ?? "") ?? "Unbekannte Taktik",
          dealValue,
          totalRounds,
          actualCost,
          outcome: run.outcome,
          otherDimensions: run.otherDimensions ?? {},
          conversationLog: run.conversationLog ?? [],
          efficiency,
          rank: 0,
          tacticalSummary: run.tacticalSummary,
          techniqueEffectivenessScore: run.techniqueEffectivenessScore ? Number(run.techniqueEffectivenessScore) : null,
          tacticEffectivenessScore: run.tacticEffectivenessScore ? Number(run.tacticEffectivenessScore) : null,
          dimensionResults: run.dimensionResults ?? [],
          productResults: run.productResults ?? [],
          roundDimensions,
          zopaDistance: run.zopaDistance ?? null,
        };
      });

      const rankedRuns = [...runs].sort((a, b) => {
        if (userRole === "buyer") {
          // Buyer: Lower price is better (ascending)
          // Handle 0 deal values (failed/incomplete) by pushing them to end?
          // Or assume filtered? This is all runs.
          // If dealValue is 0, treat as worst? 
          // But here we sort all runs.
          // Let's stick to numeric sort, but handle 0 properly if needed.
          // Actually dealValue 0 usually means failed/no agreement.
          // If a,b both > 0: a - b
          // If a=0, b>0: b is better? No, 0 is usually invalid.
          // Let's treat 0 as infinity for buyer?
          const valA = a.dealValue > 0 ? a.dealValue : Number.MAX_VALUE;
          const valB = b.dealValue > 0 ? b.dealValue : Number.MAX_VALUE;
          return valA - valB;
        } else {
          // Seller: Higher price is better (descending)
          return b.dealValue - a.dealValue;
        }
      });

      const rankMap = new Map(rankedRuns.map((run, index) => [run.id, index + 1]));
      const runsWithRank = runs.map((run) => ({ ...run, rank: rankMap.get(run.id) ?? 0 }));

      const completedRuns = runsWithRank.filter((run) => run.status === "completed");
      const completedWithDeals = completedRuns.filter((run) => run.dealValue > 0);

      const totalRuns = runsWithRank.length;
      const completedCount = completedRuns.length;

      const avgDealValue =
        completedWithDeals.length > 0
          ? completedWithDeals.reduce((sum, run) => sum + run.dealValue, 0) / completedWithDeals.length
          : 0;
      const avgRounds =
        completedRuns.length > 0
          ? completedRuns.reduce((sum, run) => sum + (run.totalRounds || 0), 0) / completedRuns.length
          : 0;

      const bestRun = completedWithDeals.reduce<typeof completedWithDeals[number] | null>((best, current) => {
        if (!best) return current;
        
        if (userRole === "buyer") {
           // Buyer: Lower is better
           if (current.dealValue < best.dealValue) return current;
        } else {
           // Seller: Higher is better
           if (current.dealValue > best.dealValue) return current;
        }
        return best;
      }, null);

      const fastestRun = completedRuns.reduce<typeof completedRuns[number] | null>((best, current) => {
        if (!best || (current.totalRounds ?? Infinity) < (best.totalRounds ?? Infinity)) {
          return current;
        }
        return best;
      }, null);

      const mostEfficientRun = completedWithDeals.reduce<typeof completedWithDeals[number] | null>((best, current) => {
        if (!best || current.efficiency > (best.efficiency ?? -Infinity)) {
          return current;
        }
        return best;
      }, null);

      const matrix = runsWithRank.map((run) => ({
        techniqueId: run.techniqueId,
        techniqueName: run.techniqueName,
        tacticId: run.tacticId,
        tacticName: run.tacticName,
        dealValue: run.dealValue,
        rounds: run.totalRounds,
        efficiency: run.efficiency,
        runId: run.id,
      }));

        res.json({
          negotiation: {
            id: negotiation.id,
            title: negotiation.title,
            description: negotiation.description,
            status: negotiation.status,
            scenario: negotiation.scenario,
            userRole: userRole,
            productCount: products.length,
          },
        runs: runsWithRank,
        summary: {
          bestDealValue: bestRun
            ? {
                runId: bestRun.id,
                value: bestRun.dealValue,
                technique: bestRun.techniqueName,
                tactic: bestRun.tacticName,
                rounds: bestRun.totalRounds,
              }
            : null,
          fastestCompletion: fastestRun
            ? {
                runId: fastestRun.id,
                rounds: fastestRun.totalRounds,
                technique: fastestRun.techniqueName,
                tactic: fastestRun.tacticName,
                dealValue: fastestRun.dealValue,
              }
            : null,
          mostEfficient: mostEfficientRun
            ? {
                runId: mostEfficientRun.id,
                efficiency: mostEfficientRun.efficiency,
                technique: mostEfficientRun.techniqueName,
                tactic: mostEfficientRun.tacticName,
                dealValue: mostEfficientRun.dealValue,
                rounds: mostEfficientRun.totalRounds,
              }
            : null,
          avgDealValue,
          avgRounds,
          totalRuns,
          completedRuns: completedCount,
        },
        matrix,
      });
    } catch (error) {
      log.error({ err: error, negotiationId: req.params.id }, "Failed to build negotiation analysis");
      res.status(500).json({ error: "Failed to build negotiation analysis" });
    }
  });

  router.post("/:id/analysis/evaluate", requireAuth, async (req, res) => {
    try {
      const negotiation = await storage.getNegotiation(req.params.id);
      if (negotiation && negotiation.userId && negotiation.userId !== (req as any).user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const result = await SimulationQueueService.backfillEvaluationsForNegotiation(req.params.id);
      res.json({ success: true, ...result });
    } catch (error) {
      log.error({ err: error, negotiationId: req.params.id }, "Failed to evaluate negotiation analysis");
      res.status(500).json({ error: "Failed to trigger evaluation" });
    }
  });

  // Shared playbook generation logic using PlaybookGeneratorService
  const generatePlaybookForNegotiation = async (negotiationId: string, res: any) => {
    log.info({ negotiationId }, "Generating playbook via service");

    // Set a longer timeout for this response (8 minutes to exceed the 7-minute service timeout)
    res.setTimeout(8 * 60 * 1000);

    // Set headers to prevent proxy/load balancer timeouts
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Keep-Alive", "timeout=600");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering if present

    try {
      // Use the PlaybookGeneratorService which has proper timeout handling
      const result = await PlaybookGeneratorService.generatePlaybook(negotiationId);

      if (!result.success) {
        log.error({ negotiationId, error: result.error }, "Playbook generation error");
        return res.status(500).json({
          error: "Playbook generation failed",
          details: result.error,
        });
      }

      // Save playbook to database
      try {
        await storage.updateNegotiation(negotiationId, {
          playbook: result.playbook,
          playbookGeneratedAt: new Date(),
        });
        log.info({ negotiationId }, "Playbook saved to database");
      } catch (dbError) {
        log.error({ negotiationId, dbError }, "Failed to save playbook to database");
        // Continue anyway - we can still return the result
      }

      // Enrich metadata with reliable DB data
      try {
        const enrichedMetadata = await getEnrichedMetadata(negotiationId, result.metadata);
        result.metadata = enrichedMetadata;
      } catch (enrichError) {
        log.error({ negotiationId, enrichError }, "Failed to enrich metadata");
        // Continue with original metadata
      }

      log.info({ negotiationId, playbookLength: result.playbook?.length }, "Playbook generated successfully");
      res.json(result);
    } catch (error: any) {
      log.error({ negotiationId, error: error.message }, "Failed to generate playbook");
      res.status(500).json({
        error: "Failed to generate playbook",
        details: error.message || String(error),
      });
    }
  };

  // GET endpoint to retrieve/generate playbook
  router.get("/:id/playbook", requireAuth, async (req, res) => {
    try {
      const negotiation = await storage.getNegotiation(req.params.id);
      if (!negotiation) {
        return res.status(404).json({ error: "Negotiation not found" });
      }

      if (negotiation.userId && negotiation.userId !== (req as any).user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Check if playbook already exists in database
      if (negotiation.playbook) {
        log.info({ negotiationId: req.params.id }, "Returning cached playbook from database");
        
        const metadata = await getEnrichedMetadata(negotiation.id, {
          cached: true,
          model: "cached-model",
          prompt_version: 0,
        });

        return res.json({
          success: true,
          playbook: negotiation.playbook,
          metadata
        });
      }

      // If not cached, generate new playbook
      log.info({ negotiationId: req.params.id }, "No cached playbook found, generating new one");
      await generatePlaybookForNegotiation(req.params.id, res);
    } catch (error) {
      log.error({ err: error, negotiationId: req.params.id }, "Failed to generate playbook");
      res.status(500).json({ error: "Failed to generate playbook" });
    }
  });

  // POST endpoint to trigger playbook generation
  router.post("/:id/playbook", requireAuth, async (req, res) => {
    try {
      const negotiation = await storage.getNegotiation(req.params.id);
      if (!negotiation) {
        return res.status(404).json({ error: "Negotiation not found" });
      }

      if (negotiation.userId && negotiation.userId !== (req as any).user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await generatePlaybookForNegotiation(req.params.id, res);
    } catch (error) {
      log.error({ err: error, negotiationId: req.params.id }, "Failed to generate playbook");
      res.status(500).json({ error: "Failed to generate playbook" });
    }
  });

  return router;
}

function extractRoundDimensions(conversationLog: unknown[]): Array<{ round: number; dimension: string; value: number }> {
  if (!Array.isArray(conversationLog)) {
    return [];
  }

  const timeline: Array<{ round: number; dimension: string; value: number }> = [];

  for (const entry of conversationLog) {
    if (!entry || typeof entry !== "object") continue;
    const round = typeof (entry as any).round === "number" ? (entry as any).round : null;
    const offer = (entry as any).offer;
    if (round === null || !offer || typeof offer !== "object") continue;
    const dimensionValues = (offer as any).dimension_values || (offer as any).dimensionValues;
    if (!dimensionValues || typeof dimensionValues !== "object") continue;

    for (const [dimension, rawValue] of Object.entries(dimensionValues)) {
      const numeric = coerceNumber(rawValue);
      if (numeric === null) continue;
      timeline.push({ round, dimension, value: numeric });
    }
  }

  return timeline;
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const normalized = value.replace(",", ".");
    const parsed = Number(normalized.match(/-?\d+(\.\d+)?/)?.[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
