import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { NegotiationEngine } from "./services/negotiation-engine";
import { analyticsService } from "./services/analytics";
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
      res.json(negotiations);
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
      res.json(negotiation);
    } catch (error) {
      console.error("Failed to get negotiation:", error);
      res.status(500).json({ error: "Failed to get negotiation" });
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

  app.post("/api/negotiations", async (req, res) => {
    try {
      const negotiationData = insertNegotiationSchema.parse(req.body);
      const negotiation = await storage.createNegotiation(negotiationData);
      res.status(201).json(negotiation);
    } catch (error) {
      console.error("Failed to create negotiation:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid negotiation data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create negotiation" });
    }
  });

  app.post("/api/negotiations/:id/start", async (req, res) => {
    try {
      await negotiationEngine.startNegotiation(req.params.id);
      res.json({ message: "Negotiation started successfully" });
    } catch (error) {
      console.error("Failed to start negotiation:", error);
      res.status(500).json({ error: "Failed to start negotiation" });
    }
  });

  app.post("/api/negotiations/:id/stop", async (req, res) => {
    try {
      await negotiationEngine.stopNegotiation(req.params.id);
      res.json({ message: "Negotiation stopped successfully" });
    } catch (error) {
      console.error("Failed to stop negotiation:", error);
      res.status(500).json({ error: "Failed to stop negotiation" });
    }
  });

  // Tactics
  app.get("/api/tactics", async (req, res) => {
    try {
      const tactics = await storage.getAllTactics();
      res.json(tactics);
    } catch (error) {
      console.error("Failed to get tactics:", error);
      res.status(500).json({ error: "Failed to get tactics" });
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

  return httpServer;
}
