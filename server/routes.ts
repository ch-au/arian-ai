import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { NegotiationEngine } from "./services/negotiation-engine";
import { analyticsService } from "./services/analytics";
import simulationQueueRoutes from "./api/simulation-queue";
import { setNegotiationEngine } from "./services/simulation-queue";
// import testWebSocketRoutes, { setTestNegotiationEngine } from "./api/test-websocket";
import {
  insertAgentSchema,
  insertNegotiationContextSchema,
  insertZopaConfigurationSchema,
  insertNegotiationSchema,
  insertTacticSchema,
  insertInfluencingTechniqueSchema,
  insertNegotiationTacticSchema,
  personalityProfileSchema,
  zopaBoundariesSchema,
} from "@shared/schema";
import { z } from "zod";

let negotiationEngine: NegotiationEngine;

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Initialize negotiation engine with WebSocket support
  negotiationEngine = new NegotiationEngine(httpServer);
  
  // Set negotiation engine for simulation queue WebSocket broadcasts
  setNegotiationEngine(negotiationEngine);
  // setTestNegotiationEngine(negotiationEngine);

  // Dashboard metrics
  app.get("/api/dashboard/metrics", async (req, res) => {
    try {
      const metrics = await analyticsService.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Failed to get dashboard metrics:", error);
      res.status(500).json({ error: "Failed to get dashboard metrics" });
    }
  });

  app.get("/api/dashboard/success-trends", async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const trends = await analyticsService.getSuccessRateTrends(days);
      res.json(trends);
    } catch (error) {
      console.error("Failed to get success trends:", error);
      res.status(500).json({ error: "Failed to get success trends" });
    }
  });

  app.get("/api/dashboard/top-agents", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const agents = await analyticsService.getTopPerformingAgents(limit);
      res.json(agents);
    } catch (error) {
      console.error("Failed to get top agents:", error);
      res.status(500).json({ error: "Failed to get top agents" });
    }
  });

  // Agents CRUD
  app.get("/api/agents", async (req, res) => {
    try {
      const agents = await storage.getAllAgents();
      res.json(agents);
    } catch (error) {
      console.error("Failed to get agents:", error);
      res.status(500).json({ error: "Failed to get agents" });
    }
  });

  app.get("/api/agents/:id", async (req, res) => {
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

  app.post("/api/agents", async (req, res) => {
    try {
      const agentData = insertAgentSchema.parse(req.body);
      
      // Validate personality profile
      personalityProfileSchema.parse(agentData.personalityProfile);
      
      const agent = await storage.createAgent(agentData);
      res.status(201).json(agent);
    } catch (error) {
      console.error("Failed to create agent:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid agent data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create agent" });
    }
  });

  app.put("/api/agents/:id", async (req, res) => {
    try {
      const agentData = req.body;
      
      // Validate personality profile if provided
      if (agentData.personalityProfile) {
        personalityProfileSchema.parse(agentData.personalityProfile);
      }
      
      const agent = await storage.updateAgent(req.params.id, agentData);
      res.json(agent);
    } catch (error) {
      console.error("Failed to update agent:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid agent data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update agent" });
    }
  });

  app.delete("/api/agents/:id", async (req, res) => {
    try {
      await storage.deleteAgent(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete agent:", error);
      res.status(500).json({ error: "Failed to delete agent" });
    }
  });

  // Negotiation contexts CRUD
  app.get("/api/contexts", async (req, res) => {
    try {
      const contexts = await storage.getAllNegotiationContexts();
      res.json(contexts);
    } catch (error) {
      console.error("Failed to get contexts:", error);
      res.status(500).json({ error: "Failed to get contexts" });
    }
  });

  app.get("/api/contexts/:id", async (req, res) => {
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

  app.post("/api/contexts", async (req, res) => {
    try {
      const contextData = insertNegotiationContextSchema.parse(req.body);
      const context = await storage.createNegotiationContext(contextData);
      res.status(201).json(context);
    } catch (error) {
      console.error("Failed to create context:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid context data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create context" });
    }
  });

  // ZOPA configurations
  app.get("/api/zopa/context/:contextId", async (req, res) => {
    try {
      const configurations = await storage.getZopaConfigurationsByContext(req.params.contextId);
      res.json(configurations);
    } catch (error) {
      console.error("Failed to get ZOPA configurations:", error);
      res.status(500).json({ error: "Failed to get ZOPA configurations" });
    }
  });

  app.get("/api/zopa/agent/:agentId", async (req, res) => {
    try {
      const configurations = await storage.getZopaConfigurationsByAgent(req.params.agentId);
      res.json(configurations);
    } catch (error) {
      console.error("Failed to get ZOPA configurations:", error);
      res.status(500).json({ error: "Failed to get ZOPA configurations" });
    }
  });

  app.post("/api/zopa", async (req, res) => {
    try {
      const zopaData = insertZopaConfigurationSchema.parse(req.body);
      
      // Validate boundaries if provided
      if (zopaData.boundaries) {
        zopaBoundariesSchema.parse(zopaData.boundaries);
      }
      
      const configuration = await storage.createZopaConfiguration(zopaData);
      res.status(201).json(configuration);
    } catch (error) {
      console.error("Failed to create ZOPA configuration:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid ZOPA data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create ZOPA configuration" });
    }
  });

  app.post("/api/zopa/analyze", async (req, res) => {
    try {
      const { buyerZopa, sellerZopa } = req.body;
      
      zopaBoundariesSchema.parse(buyerZopa);
      zopaBoundariesSchema.parse(sellerZopa);
      
      const analysis = await analyticsService.analyzeZopaOverlap(buyerZopa, sellerZopa);
      res.json(analysis);
    } catch (error) {
      console.error("Failed to analyze ZOPA:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid ZOPA data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to analyze ZOPA" });
    }
  });

  // Negotiations
  app.get("/api/negotiations", async (req, res) => {
    try {
      const negotiations = await storage.getAllNegotiations();
      
      // Get simulation stats for each negotiation
      const negotiationsWithStats = await Promise.all(
        negotiations.map(async (negotiation) => {
          try {
            // Import simulation queue service
            const { SimulationQueueService } = await import('./services/simulation-queue');
            
            // Try to get simulation results for this negotiation
            const simulationResults = await SimulationQueueService.getSimulationResultsByNegotiation(negotiation.id);
            
            const totalRuns = simulationResults.length;
            const completedRuns = simulationResults.filter(r => r.status === 'completed').length;
            const runningRuns = simulationResults.filter(r => r.status === 'running').length;
            const failedRuns = simulationResults.filter(r => r.status === 'failed').length;
            const pendingRuns = simulationResults.filter(r => r.status === 'pending').length;
            
            return {
              ...negotiation,
              simulationStats: {
                totalRuns,
                completedRuns,
                runningRuns,
                failedRuns,
                pendingRuns,
                successRate: totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0
              }
            };
          } catch (error) {
            // If no queue exists for this negotiation, return zero stats
            return {
              ...negotiation,
              simulationStats: {
                totalRuns: 0,
                completedRuns: 0,
                runningRuns: 0,
                failedRuns: 0,
                pendingRuns: 0,
                successRate: 0
              }
            };
          }
        })
      );

      res.json(negotiationsWithStats);
    } catch (error) {
      console.error("Failed to get negotiations:", error);
      res.status(500).json({ error: "Failed to get negotiations" });
    }
  });

  app.get("/api/negotiations/active", async (req, res) => {
    try {
      const negotiations = await storage.getActiveNegotiations();
      res.json(negotiations);
    } catch (error) {
      console.error("Failed to get active negotiations:", error);
      res.status(500).json({ error: "Failed to get active negotiations" });
    }
  });

  app.get("/api/negotiations/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const negotiations = await storage.getRecentNegotiations(limit);
      res.json(negotiations);
    } catch (error) {
      console.error("Failed to get recent negotiations:", error);
      res.status(500).json({ error: "Failed to get recent negotiations" });
    }
  });

  app.get("/api/negotiations/:id", async (req, res) => {
    try {
      const negotiation = await storage.getNegotiation(req.params.id);
      if (!negotiation) {
        return res.status(404).json({ error: "Negotiation not found" });
      }
      
      // Fetch all related data in parallel
      const [dimensions, allTechniques, allTactics] = await Promise.all([
        storage.getNegotiationDimensions(req.params.id).catch(() => []),
        storage.getAllInfluencingTechniques().catch(() => []),
        storage.getAllNegotiationTactics().catch(() => [])
      ]);
      
      // Format dimensions
      const formattedDimensions = dimensions.map(dim => ({
        id: dim.id,
        name: dim.name,
        minValue: parseFloat(dim.minValue),
        maxValue: parseFloat(dim.maxValue),
        targetValue: parseFloat(dim.targetValue),
        priority: dim.priority,
        unit: dim.unit
      }));
      
      // Convert technique/tactic UUIDs to objects with names
      const selectedTechniques = (negotiation.selectedTechniques || [])
        .map(id => allTechniques.find(tech => tech.id === id))
        .filter(tech => tech !== undefined)
        .map(tech => tech.id); // Frontend expects IDs
        
      const selectedTactics = (negotiation.selectedTactics || [])
        .map(id => allTactics.find(tactic => tactic.id === id))
        .filter(tactic => tactic !== undefined)
        .map(tactic => tactic.id); // Frontend expects IDs
      
      const response = {
        ...negotiation,
        selectedTechniques,
        selectedTactics,
        dimensions: formattedDimensions
      };
      
      res.json(response);
    } catch (error) {
      console.error("Failed to get negotiation:", error);
      res.status(500).json({ error: "Failed to get negotiation" });
    }
  });

  // Debug endpoint for dimensions
  app.get("/api/negotiations/:id/dimensions", async (req, res) => {
    try {
      const dimensions = await storage.getNegotiationDimensions(req.params.id);
      res.json({
        negotiationId: req.params.id,
        dimensionsFound: dimensions.length,
        dimensions: dimensions
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/negotiations/:id/rounds", async (req, res) => {
    try {
      const rounds = await storage.getNegotiationRounds(req.params.id);
      res.json(rounds);
    } catch (error) {
      console.error("Failed to get negotiation rounds:", error);
      res.status(500).json({ error: "Failed to get negotiation rounds" });
    }
  });

  // Enhanced negotiation creation endpoint for new configuration wizard
  app.post("/api/negotiations/enhanced", async (req, res) => {
    try {
      console.log("Received enhanced negotiation data:", JSON.stringify(req.body, null, 2));
      
      // Validation schema for enhanced negotiation creation
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
        dimensions: z.array(z.object({
          id: z.string(),
          name: z.string().min(1, "Dimension name is required"),
          minValue: z.number(),
          maxValue: z.number(),
          targetValue: z.number(),
          priority: z.number().int().min(1).max(3),
          unit: z.string().optional()
        })).min(1, "At least one dimension is required")
      });

      const validatedData = enhancedNegotiationSchema.parse(req.body);
      
      // Get default agents and context for now (will be enhanced later)
      const agents = await storage.getAllAgents();
      const contexts = await storage.getAllNegotiationContexts();
      
      if (agents.length < 2) {
        throw new Error("At least 2 agents required");
      }
      if (contexts.length === 0) {
        throw new Error("At least 1 context required");
      }

      // Get all available techniques and tactics to map names to UUIDs
      const [allTechniques, allTactics] = await Promise.all([
        storage.getAllInfluencingTechniques(),
        storage.getAllNegotiationTactics()
      ]);

      // Convert technique/tactic names to UUIDs (if they're not already UUIDs)
      const selectedTechniqueUUIDs = validatedData.selectedTechniques
        .map(nameOrId => {
          // Try to find by ID first, then by name
          return allTechniques.find(tech => tech.id === nameOrId || tech.name === nameOrId)?.id;
        })
        .filter(id => id !== undefined);
        
      const selectedTacticUUIDs = validatedData.selectedTactics
        .map(nameOrId => {
          // Try to find by ID first, then by name
          return allTactics.find(tactic => tactic.id === nameOrId || tactic.name === nameOrId)?.id;
        })
        .filter(id => id !== undefined);

      // Create negotiation with enhanced fields
      const negotiationData = {
        title: validatedData.title,
        negotiationType: validatedData.negotiationType,
        relationshipType: validatedData.relationshipType,
        contextId: contexts[0].id, // Use first available context for now
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

      // Create negotiation with dimensions
      const negotiation = await storage.createNegotiationWithDimensions(
        negotiationData,
        validatedData.dimensions.map(d => ({
          name: d.name,
          minValue: d.minValue.toString(),
          maxValue: d.maxValue.toString(),
          targetValue: d.targetValue.toString(),
          priority: d.priority,
          unit: d.unit || null
        }))
      );
      console.log(`Created enhanced negotiation "${validatedData.title}" with ${validatedData.dimensions.length} dimensions`);
      
      const responseData = {
        negotiation,
        dimensionsCount: validatedData.dimensions.length,
        message: "Negotiation created successfully"
      };
      
      console.log("Sending response:", JSON.stringify(responseData, null, 2));
      res.status(201).json(responseData);
    } catch (error) {
      console.error("Failed to create enhanced negotiation:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
      
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ error: "Invalid negotiation data", details: error.errors });
      }
      
      const errorResponse = { 
        error: error instanceof Error ? error.message : "Failed to create negotiation",
        timestamp: new Date().toISOString()
      };
      console.log("Sending error response:", JSON.stringify(errorResponse, null, 2));
      res.status(500).json(errorResponse);
    }
  });

  // Update existing negotiation endpoint
  app.put("/api/negotiations/:id", async (req, res) => {
    try {
      const negotiationId = req.params.id;
      console.log("Updating negotiation:", negotiationId, JSON.stringify(req.body, null, 2));
      
      // Use the same validation schema as creation
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
        dimensions: z.array(z.object({
          id: z.string(),
          name: z.string().min(1, "Dimension name is required"),
          minValue: z.number(),
          maxValue: z.number(),
          targetValue: z.number(),
          priority: z.number().int().min(1).max(3),
          unit: z.string().optional()
        })).min(1, "At least one dimension is required")
      });

      const validatedData = enhancedNegotiationSchema.parse(req.body);

      // Create negotiation object for update
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
        zopaDistance: validatedData.zopaDistance
      };

      // Update the negotiation
      const updatedNegotiation = await storage.updateNegotiation(negotiationId, negotiationData);
      
      // TODO: Update dimensions (would require more complex logic)
      
      const responseData = {
        negotiation: updatedNegotiation,
        message: "Negotiation updated successfully"
      };
      
      console.log("Update response:", JSON.stringify(responseData, null, 2));
      res.json(responseData);
    } catch (error) {
      console.error("Failed to update negotiation:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid negotiation data", details: error.errors });
      }
      
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to update negotiation"
      });
    }
  });

  // Get individual negotiation by ID
  app.get("/api/negotiations/:id", async (req, res) => {
    try {
      const negotiationId = req.params.id;
      const negotiation = await storage.getNegotiationById(negotiationId);
      
      if (!negotiation) {
        return res.status(404).json({ error: "Negotiation not found" });
      }
      
      res.json(negotiation);
    } catch (error) {
      console.error("Failed to get negotiation:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to get negotiation"
      });
    }
  });

  // Legacy negotiation creation endpoint (kept for compatibility)
  app.post("/api/negotiations", async (req, res) => {
    try {
      console.log("Received negotiation data:", JSON.stringify(req.body, null, 2));
      
      // Create a custom validation schema for negotiation creation
      const createNegotiationSchema = z.object({
        contextId: z.string().uuid(),
        buyerAgentId: z.string().uuid(),
        sellerAgentId: z.string().uuid(),
        userRole: z.enum(["buyer", "seller"]),
        maxRounds: z.number().int().min(1).max(100),
        selectedTechniques: z.array(z.string()),
        selectedTactics: z.array(z.string()),
        userZopa: z.object({
          volumen: z.object({
            min: z.number(),
            max: z.number(),
            target: z.number(),
          }),
          preis: z.object({
            min: z.number(),
            max: z.number(),
            target: z.number(),
          }),
          laufzeit: z.object({
            min: z.number(),
            max: z.number(),
            target: z.number(),
          }),
          zahlungskonditionen: z.object({
            min: z.number(),
            max: z.number(),
            target: z.number(),
          }),
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
      
      // Transform data to match database schema
      const negotiationData = {
        contextId: validatedData.contextId,
        buyerAgentId: validatedData.buyerAgentId,
        sellerAgentId: validatedData.sellerAgentId,
        userRole: validatedData.userRole,
        maxRounds: validatedData.maxRounds,
        selectedTechniques: validatedData.selectedTechniques, // Keep as string array for now
        selectedTactics: validatedData.selectedTactics, // Keep as string array for now
        userZopa: validatedData.userZopa,
        counterpartDistance: validatedData.counterpartDistance,
        sonderinteressen: validatedData.sonderinteressen || null,
        status: "pending" as const,
      };

      // Use the new combinatorial simulation creation
      const result = await storage.createNegotiationWithSimulationRuns(negotiationData);
      
      console.log(`Created negotiation with ${result.simulationRuns.length} simulation runs (${validatedData.selectedTechniques.length}×${validatedData.selectedTactics.length} combinations)`);
      
      res.status(201).json({
        negotiation: result.negotiation,
        simulationRuns: result.simulationRuns,
        totalCombinations: result.simulationRuns.length
      });
    } catch (error) {
      console.error("Failed to create negotiation:", error);
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ error: "Invalid negotiation data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create negotiation" });
    }
  });

  // Start a negotiation by creating simulation queue
  app.post("/api/negotiations/:id/start", async (req, res) => {
    try {
      const negotiation = await storage.getNegotiation(req.params.id);
      if (!negotiation) {
        return res.status(404).json({ error: "Negotiation not found" });
      }

      if (negotiation.status !== "configured") {
        return res.status(400).json({ error: "Negotiation must be configured before starting" });
      }

      // Import simulation queue service
      const { SimulationQueueService } = await import('./services/simulation-queue');

      // Use the actual negotiation's selected techniques and tactics
      const selectedTechniques = negotiation.selectedTechniques || [];
      const selectedTactics = negotiation.selectedTactics || [];

      if (selectedTechniques.length === 0 || selectedTactics.length === 0) {
        return res.status(400).json({ error: "Negotiation must have at least one technique and one tactic selected" });
      }

      // Convert counterpartPersonality and zopaDistance to arrays for queue creation
      let personalities: string[] = [];
      let zopaDistances: string[] = [];

      // Handle personality configuration
      if (negotiation.counterpartPersonality) {
        if (negotiation.counterpartPersonality === "all-personalities") {
          personalities = ["all"];
        } else {
          personalities = [negotiation.counterpartPersonality];
        }
      } else {
        // Default to all personalities if not specified
        personalities = ["all"];
      }

      // Handle ZOPA distance configuration
      if (negotiation.zopaDistance) {
        if (negotiation.zopaDistance === "all-distances") {
          zopaDistances = ["all"];
        } else {
          zopaDistances = [negotiation.zopaDistance];
        }
      } else {
        // Default to all distances if not specified
        zopaDistances = ["all"];
      }

      // Create simulation queue with full configuration
      const queueId = await SimulationQueueService.createQueue({
        negotiationId: req.params.id,
        techniques: selectedTechniques,
        tactics: selectedTactics,
        personalities,
        zopaDistances
      });

      // Update negotiation status to running
      await storage.updateNegotiationStatus(req.params.id, "running");

      // Calculate total simulations for response
      const personalityMultiplier = personalities.includes("all") ? 5 : personalities.length; // Assume 5 personality types
      const distanceMultiplier = zopaDistances.includes("all") ? 3 : zopaDistances.length; // close, medium, far
      const totalSimulations = selectedTechniques.length * selectedTactics.length * personalityMultiplier * distanceMultiplier;

      res.json({ 
        message: "Simulation queue created successfully",
        queueId,
        totalSimulations,
        breakdown: {
          techniques: selectedTechniques.length,
          tactics: selectedTactics.length,
          personalities: personalityMultiplier,
          distances: distanceMultiplier
        }
      });
    } catch (error) {
      console.error("Failed to start negotiation:", error);
      res.status(500).json({ error: "Failed to start negotiation" });
    }
  });

  // Stop a negotiation
  app.post("/api/negotiations/:id/stop", async (req, res) => {
    try {
      await negotiationEngine.stopNegotiation(req.params.id);
      res.json({ message: "Negotiation stopped successfully" });
    } catch (error) {
      console.error("Failed to stop negotiation:", error);
      res.status(500).json({ error: "Failed to stop negotiation" });
    }
  });

  // Delete a negotiation
  app.delete("/api/negotiations/:id", async (req, res) => {
    try {
      await storage.deleteNegotiation(req.params.id);
      res.json({ message: "Negotiation deleted successfully" });
    } catch (error) {
      console.error("Failed to delete negotiation:", error);
      res.status(500).json({ error: "Failed to delete negotiation" });
    }
  });

  // Simulation run management
  app.get("/api/negotiations/:id/simulation-runs", async (req, res) => {
    try {
      const runs = await storage.getSimulationRuns(req.params.id);
      res.json(runs);
    } catch (error) {
      console.error("Failed to get simulation runs:", error);
      res.status(500).json({ error: "Failed to get simulation runs" });
    }
  });

  app.get("/api/simulation-runs/:runId/status", async (req, res) => {
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

  app.post("/api/simulation-runs/:runId/stop", async (req, res) => {
    try {
      await negotiationEngine.stopNegotiation(req.params.runId);
      res.json({ message: "Simulation run stopped successfully" });
    } catch (error) {
      console.error("Failed to stop simulation run:", error);
      res.status(500).json({ error: "Failed to stop simulation run" });
    }
  });

  // Get negotiation rounds
  app.get("/api/negotiations/:id/rounds", async (req, res) => {
    try {
      const rounds = await storage.getNegotiationRounds(req.params.id);
      res.json(rounds);
    } catch (error) {
      console.error("Failed to get negotiation rounds:", error);
      res.status(500).json({ error: "Failed to get negotiation rounds" });
    }
  });



  app.get("/api/tactics/category/:category", async (req, res) => {
    try {
      const tactics = await storage.getTacticsByCategory(req.params.category);
      res.json(tactics);
    } catch (error) {
      console.error("Failed to get tactics by category:", error);
      res.status(500).json({ error: "Failed to get tactics by category" });
    }
  });

  app.post("/api/tactics", async (req, res) => {
    try {
      const tacticData = insertTacticSchema.parse(req.body);
      const tactic = await storage.createTactic(tacticData);
      res.status(201).json(tactic);
    } catch (error) {
      console.error("Failed to create tactic:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid tactic data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create tactic" });
    }
  });

  // Analytics and reports
  app.get("/api/analytics/performance", async (req, res) => {
    try {
      const { agentId, startDate, endDate } = req.query;
      const report = await analyticsService.generatePerformanceReport(
        agentId as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(report);
    } catch (error) {
      console.error("Failed to generate performance report:", error);
      res.status(500).json({ error: "Failed to generate performance report" });
    }
  });

  // Prompt management routes
  app.get("/api/prompts/reload", async (req, res) => {
    try {
      const { langfuseService } = await import("./services/langfuse");
      langfuseService.reloadPrompts();
      res.json({ message: "Prompts reloaded successfully" });
    } catch (error) {
      console.error("Failed to reload prompts:", error);
      res.status(500).json({ error: "Failed to reload prompts" });
    }
  });

  // System status
  // Influencing techniques
  app.get("/api/influencing-techniques", async (req, res) => {
    try {
      const techniques = await storage.getAllInfluencingTechniques();
      res.json(techniques);
    } catch (error) {
      console.error("Failed to get influencing techniques:", error);
      res.status(500).json({ error: "Failed to get influencing techniques" });
    }
  });

  app.post("/api/influencing-techniques", async (req, res) => {
    try {
      const technique = await storage.createInfluencingTechnique(req.body);
      res.status(201).json(technique);
    } catch (error) {
      console.error("Failed to create influencing technique:", error);
      res.status(500).json({ error: "Failed to create influencing technique" });
    }
  });

  // Personality types
  app.get("/api/personality-types", async (req, res) => {
    try {
      console.log("Getting personality types from database...");
      // TODO: Fix database query for personality types
      // For now, return mock data to continue with UI development
      const personalityTypes = [
        { id: "1", name: "Aggressive", description: "Assertive and competitive negotiator", traits: "High assertiveness, low cooperation" },
        { id: "2", name: "Collaborative", description: "Seeks win-win solutions", traits: "High assertiveness, high cooperation" },
        { id: "3", name: "Accommodating", description: "Prioritizes relationships over outcomes", traits: "Low assertiveness, high cooperation" },
        { id: "4", name: "Competitive", description: "Focuses on winning at all costs", traits: "High assertiveness, low cooperation" },
        { id: "5", name: "Avoiding", description: "Prefers to avoid conflict", traits: "Low assertiveness, low cooperation" }
      ];
      console.log("Found personality types:", personalityTypes.length);
      res.json(personalityTypes);
    } catch (error) {
      console.error("Failed to get personality types:", error);
      res.status(500).json({ error: "Failed to get personality types" });
    }
  });

  app.post("/api/personality-types", async (req, res) => {
    try {
      const personalityType = await storage.createPersonalityType(req.body);
      res.status(201).json(personalityType);
    } catch (error) {
      console.error("Failed to create personality type:", error);
      res.status(500).json({ error: "Failed to create personality type" });
    }
  });

  // Negotiation tactics  
  app.get("/api/negotiation-tactics", async (req, res) => {
    try {
      const tactics = await storage.getAllNegotiationTactics();
      res.json(tactics);
    } catch (error) {
      console.error("Failed to get negotiation tactics:", error);
      res.status(500).json({ error: "Failed to get negotiation tactics" });
    }
  });

  app.post("/api/negotiation-tactics", async (req, res) => {
    try {
      const tactic = await storage.createNegotiationTactic(req.body);
      res.status(201).json(tactic);
    } catch (error) {
      console.error("Failed to create negotiation tactic:", error);
      res.status(500).json({ error: "Failed to create negotiation tactic" });
    }
  });

  // Short aliases for frontend
  app.get("/api/tactics", async (req, res) => {
    try {
      const tactics = await storage.getAllNegotiationTactics();
      res.json(tactics);
    } catch (error) {
      console.error("Failed to get tactics:", error);
      res.status(500).json({ error: "Failed to get tactics" });
    }
  });

  app.get("/api/techniques", async (req, res) => {
    try {
      const techniques = await storage.getAllInfluencingTechniques();
      res.json(techniques);
    } catch (error) {
      console.error("Failed to get techniques:", error);
      res.status(500).json({ error: "Failed to get techniques" });
    }
  });

  app.get("/api/system/status", async (req, res) => {
    try {
      const status = {
        timestamp: new Date().toISOString(),
        activeNegotiations: negotiationEngine.getActiveNegotiationsCount(),
        systemHealth: "online",
        version: "1.0.0",
      };
      res.json(status);
    } catch (error) {
      console.error("Failed to get system status:", error);
      res.status(500).json({ error: "Failed to get system status" });
    }
  });

  // Python agents service health check
  app.get("/api/agents/health", async (req, res) => {
    try {
      const { pythonAgentsBridge } = await import('./services/python-agents-bridge');
      
      const isHealthy = await pythonAgentsBridge.testConnection();
      
      if (isHealthy) {
        res.json({ 
          status: "healthy", 
          pythonService: "connected",
          message: "Python OpenAI Agents service is running"
        });
      } else {
        res.status(503).json({ 
          status: "unhealthy", 
          pythonService: "disconnected",
          message: "Python OpenAI Agents service is not responding"
        });
      }
    } catch (error) {
      res.status(503).json({ 
        status: "error", 
        pythonService: "error",
        message: error instanceof Error ? error.message : "Unknown error",
        error: String(error)
      });
    }
  });

  // Test Python agents functionality
  app.post("/api/agents/test", async (req, res) => {
    try {
      const { pythonAgentsBridge } = await import('./services/python-agents-bridge');
      
      const testResult = await pythonAgentsBridge.testAgents();
      
      res.json({ 
        status: "success", 
        message: "Python agents test completed",
        result: testResult
      });
    } catch (error) {
      res.status(500).json({ 
        status: "error", 
        message: error instanceof Error ? error.message : "Unknown error",
        error: String(error)
      });
    }
  });

  // Python negotiation service test endpoint
  app.post("/api/python-negotiation/test", async (req, res) => {
    try {
      const { PythonNegotiationService } = await import('./services/python-negotiation-service');
      
      const { negotiationId, simulationRunId, maxRounds } = req.body;
      
      const result = await PythonNegotiationService.runNegotiation({
        negotiationId,
        simulationRunId,
        maxRounds: maxRounds || 3
      });
      
      res.json({ 
        status: "success", 
        message: "Python negotiation completed",
        result 
      });
    } catch (error) {
      res.status(500).json({ 
        status: "error", 
        message: error instanceof Error ? error.message : "Unknown error",
        error: String(error)
      });
    }
  });

  // Simulation queue management routes
  app.use("/api/simulations", simulationQueueRoutes);
  
  // Test WebSocket routes
  // app.use("/api/test", testWebSocketRoutes);

  return httpServer;
}
