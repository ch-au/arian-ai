import type { Express } from "express";
import { createServer, type Server } from "http";
import { NegotiationEngine } from "./services/negotiation-engine";
import simulationQueueRoutes from "./api/simulation-queue";
import { setNegotiationEngine, SimulationQueueService } from "./services/simulation-queue";
// import testWebSocketRoutes, { setTestNegotiationEngine } from "./api/test-websocket";
import { createDashboardRouter } from "./routes/dashboard";
import { createAgentRouter } from "./routes/agents";
import { createContextRouter } from "./routes/contexts";
import { createZopaRouter } from "./routes/zopa";
import { createNegotiationRouter } from "./routes/negotiations";
import { createStrategyRouter } from "./routes/strategies";
import { createAnalyticsRouter } from "./routes/analytics";
import { createSystemRouter } from "./routes/system";
import marketIntelligenceRouter from "./routes/market-intelligence";
import transcribeRouter from "./routes/transcribe";

let negotiationEngine: NegotiationEngine;

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Initialize negotiation engine with WebSocket support
  negotiationEngine = new NegotiationEngine(httpServer);
  
  // Set negotiation engine for simulation queue WebSocket broadcasts
  setNegotiationEngine(negotiationEngine);
  // setTestNegotiationEngine(negotiationEngine);
  
  // Start the background queue processor
  SimulationQueueService.startBackgroundProcessor();

  app.use("/api/dashboard", createDashboardRouter());
  app.use("/api/agents", createAgentRouter());
  app.use("/api/contexts", createContextRouter());
  app.use("/api/zopa", createZopaRouter());
  app.use("/api/negotiations", createNegotiationRouter(negotiationEngine));
  app.use("/api", createStrategyRouter());
  app.use("/api/analytics", createAnalyticsRouter());
  app.use("/api", createSystemRouter(negotiationEngine));
  app.use("/api/market-intelligence", marketIntelligenceRouter);
  app.use("/api/transcribe", transcribeRouter);

  // Simulation queue management routes
  app.use("/api/simulations", simulationQueueRoutes);
  
  // Test WebSocket routes
  // app.use("/api/test", testWebSocketRoutes);

  return httpServer;
}
