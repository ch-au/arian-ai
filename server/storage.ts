import {
  users,
  agents,
  negotiationContexts,
  zopaConfigurations,
  negotiations,
  negotiationDimensions,
  simulationRuns,
  negotiationRounds,
  tactics,
  analyticsSessions,
  performanceMetrics,
  influencingTechniques,
  negotiationTactics,
  personalityTypes,
  products,
  type User,
  type InsertUser,
  type Agent,
  type InsertAgent,
  type NegotiationContext,
  type InsertNegotiationContext,
  type ZopaConfiguration,
  type InsertZopaConfiguration,
  type Negotiation,
  type InsertNegotiation,
  type NegotiationRound,
  type InsertNegotiationRound,
  type Tactic,
  type InsertTactic,
  type AnalyticsSession,
  type InsertAnalyticsSession,
  type PerformanceMetric,
  type InsertPerformanceMetric,
  type InfluencingTechnique,
  type InsertInfluencingTechnique,
  type NegotiationTactic,
  type InsertNegotiationTactic,
  type PersonalityType,
  type InsertPersonalityType,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, gte, lte, avg, count, sum } from "drizzle-orm";

// Re-export db and schema tables for use in other services
export { db, negotiations, simulationRuns, agents, negotiationDimensions };

// storage is exported at the bottom of the file after the class definition

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Agent methods
  getAgent(id: string): Promise<Agent | undefined>;
  getAllAgents(): Promise<Agent[]>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: string, agent: Partial<InsertAgent>): Promise<Agent>;
  deleteAgent(id: string): Promise<void>;

  // Negotiation context methods
  getNegotiationContext(id: string): Promise<NegotiationContext | undefined>;
  getAllNegotiationContexts(): Promise<NegotiationContext[]>;
  createNegotiationContext(context: InsertNegotiationContext): Promise<NegotiationContext>;
  updateNegotiationContext(id: string, context: Partial<InsertNegotiationContext>): Promise<NegotiationContext>;
  deleteNegotiationContext(id: string): Promise<void>;

  // ZOPA configuration methods
  getZopaConfiguration(id: string): Promise<ZopaConfiguration | undefined>;
  getZopaConfigurationsByContext(contextId: string): Promise<ZopaConfiguration[]>;
  getZopaConfigurationsByAgent(agentId: string): Promise<ZopaConfiguration[]>;
  createZopaConfiguration(config: InsertZopaConfiguration): Promise<ZopaConfiguration>;
  updateZopaConfiguration(id: string, config: Partial<InsertZopaConfiguration>): Promise<ZopaConfiguration>;
  deleteZopaConfiguration(id: string): Promise<void>;

  // Negotiation methods
  getNegotiation(id: string): Promise<Negotiation | undefined>;
  getAllNegotiations(): Promise<Negotiation[]>;
  getActiveNegotiations(): Promise<Negotiation[]>;
  getRecentNegotiations(limit?: number): Promise<Negotiation[]>;
  createNegotiation(negotiation: InsertNegotiation): Promise<Negotiation>;
  // DEPRECATED: This method creates simulation runs directly, which causes duplicates.
  // Use createNegotiation() instead, then create runs via SimulationQueueService.createQueue()
  // Will be removed in a future version
  createNegotiationWithSimulationRuns(negotiation: InsertNegotiation): Promise<{ negotiation: Negotiation; simulationRuns: any[] }>;
  updateNegotiation(id: string, negotiation: Partial<InsertNegotiation>): Promise<Negotiation>;
  startNegotiation(id: string): Promise<Negotiation>;
  completeNegotiation(id: string, finalAgreement?: any, successScore?: number): Promise<Negotiation>;

  // Simulation run methods
  getSimulationRun(id: string): Promise<any | undefined>;
  getSimulationRuns(negotiationId: string): Promise<any[]>;
  createSimulationRun(run: any): Promise<any>;
  updateSimulationRun(id: string, run: Partial<any>): Promise<any>;

  // Negotiation round methods
  getNegotiationRounds(negotiationId: string): Promise<NegotiationRound[]>;
  createNegotiationRound(round: InsertNegotiationRound): Promise<NegotiationRound>;

  // Tactic methods
  getTactic(id: string): Promise<NegotiationTactic | undefined>;
  getAllTactics(): Promise<NegotiationTactic[]>;
  getTacticsByCategory(category: string): Promise<NegotiationTactic[]>;
  createTactic(tactic: InsertNegotiationTactic): Promise<NegotiationTactic>;
  updateTactic(id: string, tactic: Partial<InsertNegotiationTactic>): Promise<NegotiationTactic>;

  // Analytics methods
  getAnalyticsSession(id: string): Promise<AnalyticsSession | undefined>;
  getAllAnalyticsSessions(): Promise<AnalyticsSession[]>;
  createAnalyticsSession(session: InsertAnalyticsSession): Promise<AnalyticsSession>;
  updateAnalyticsSession(id: string, session: Partial<InsertAnalyticsSession>): Promise<AnalyticsSession>;

  // Performance metrics methods
  getPerformanceMetrics(negotiationId: string): Promise<PerformanceMetric[]>;
  getAgentPerformanceMetrics(agentId: string): Promise<PerformanceMetric[]>;
  createPerformanceMetric(metric: InsertPerformanceMetric): Promise<PerformanceMetric>;

  // Dashboard analytics methods
  getDashboardMetrics(): Promise<{
    activeNegotiations: number;
    successRate: number;
    avgDuration: number;
    apiCostToday: number;
  }>;
  getSuccessRateTrends(days: number): Promise<Array<{ date: string; successRate: number }>>;
  getTopPerformingAgents(limit?: number): Promise<Array<{ agent: Agent; successRate: number }>>;

  // Influencing techniques methods
  getInfluencingTechnique(id: string): Promise<InfluencingTechnique | undefined>;
  getAllInfluencingTechniques(): Promise<InfluencingTechnique[]>;
  createInfluencingTechnique(technique: InsertInfluencingTechnique): Promise<InfluencingTechnique>;
  updateInfluencingTechnique(id: string, technique: Partial<InsertInfluencingTechnique>): Promise<InfluencingTechnique>;
  deleteInfluencingTechnique(id: string): Promise<void>;

  // Negotiation tactics methods
  getNegotiationTactic(id: string): Promise<NegotiationTactic | undefined>;
  getAllNegotiationTactics(): Promise<NegotiationTactic[]>;
  createNegotiationTactic(tactic: InsertNegotiationTactic): Promise<NegotiationTactic>;
  updateNegotiationTactic(id: string, tactic: Partial<InsertNegotiationTactic>): Promise<NegotiationTactic>;
  deleteNegotiationTactic(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Agent methods
  async getAgent(id: string): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent || undefined;
  }

  async getAllAgents(): Promise<Agent[]> {
    return await db.select().from(agents).orderBy(asc(agents.name));
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    const [newAgent] = await db.insert(agents).values(agent).returning();
    return newAgent;
  }

  async updateAgent(id: string, agent: Partial<InsertAgent>): Promise<Agent> {
    const [updatedAgent] = await db
      .update(agents)
      .set({ ...agent, updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning();
    return updatedAgent;
  }

  async deleteAgent(id: string): Promise<void> {
    await db.delete(agents).where(eq(agents.id, id));
  }

  // Negotiation context methods
  async getNegotiationContext(id: string): Promise<NegotiationContext | undefined> {
    const [context] = await db.select().from(negotiationContexts).where(eq(negotiationContexts.id, id));
    return context || undefined;
  }

  async getAllNegotiationContexts(): Promise<NegotiationContext[]> {
    return await db.select().from(negotiationContexts).orderBy(desc(negotiationContexts.createdAt));
  }

  async createNegotiationContext(context: InsertNegotiationContext): Promise<NegotiationContext> {
    const [newContext] = await db.insert(negotiationContexts).values(context).returning();
    return newContext;
  }

  async updateNegotiationContext(id: string, context: Partial<InsertNegotiationContext>): Promise<NegotiationContext> {
    const [updatedContext] = await db
      .update(negotiationContexts)
      .set(context)
      .where(eq(negotiationContexts.id, id))
      .returning();
    return updatedContext;
  }

  async deleteNegotiationContext(id: string): Promise<void> {
    await db.delete(negotiationContexts).where(eq(negotiationContexts.id, id));
  }

  // ZOPA configuration methods
  async getZopaConfiguration(id: string): Promise<ZopaConfiguration | undefined> {
    const [config] = await db.select().from(zopaConfigurations).where(eq(zopaConfigurations.id, id));
    return config || undefined;
  }

  async getZopaConfigurationsByContext(contextId: string): Promise<ZopaConfiguration[]> {
    return await db.select().from(zopaConfigurations).where(eq(zopaConfigurations.contextId, contextId));
  }

  async getZopaConfigurationsByAgent(agentId: string): Promise<ZopaConfiguration[]> {
    return await db.select().from(zopaConfigurations).where(eq(zopaConfigurations.agentId, agentId));
  }

  async createZopaConfiguration(config: InsertZopaConfiguration): Promise<ZopaConfiguration> {
    const [newConfig] = await db.insert(zopaConfigurations).values(config).returning();
    return newConfig;
  }

  async updateZopaConfiguration(id: string, config: Partial<InsertZopaConfiguration>): Promise<ZopaConfiguration> {
    const [updatedConfig] = await db
      .update(zopaConfigurations)
      .set(config)
      .where(eq(zopaConfigurations.id, id))
      .returning();
    return updatedConfig;
  }

  async deleteZopaConfiguration(id: string): Promise<void> {
    await db.delete(zopaConfigurations).where(eq(zopaConfigurations.id, id));
  }

  // Negotiation methods
  async getNegotiation(id: string): Promise<Negotiation | undefined> {
    const [negotiation] = await db.select().from(negotiations).where(eq(negotiations.id, id));
    return negotiation || undefined;
  }

  async getAllNegotiations(): Promise<Negotiation[]> {
    return await db.select().from(negotiations).orderBy(desc(negotiations.startedAt));
  }

  async getActiveNegotiations(): Promise<Negotiation[]> {
    return await db.select().from(negotiations).where(eq(negotiations.status, "active"));
  }

  async getRecentNegotiations(limit: number = 10): Promise<Negotiation[]> {
    return await db
      .select()
      .from(negotiations)
      .orderBy(desc(negotiations.startedAt))
      .limit(limit);
  }

  async createNegotiation(negotiation: InsertNegotiation): Promise<Negotiation> {
    const [newNegotiation] = await db.insert(negotiations).values(negotiation).returning();
    return newNegotiation;
  }

  async createNegotiationWithDimensions(
    negotiation: InsertNegotiation, 
    dimensions: Array<{
      name: string;
      minValue: string;
      maxValue: string;
      targetValue: string;
      priority: number;
      unit: string | null;
    }>
  ): Promise<Negotiation> {
    // Create negotiation first
    const [newNegotiation] = await db.insert(negotiations).values(negotiation).returning();
    
    // Create dimensions
    const dimensionsData = dimensions.map(dimension => ({
      negotiationId: newNegotiation.id,
      name: dimension.name,
      minValue: dimension.minValue,
      maxValue: dimension.maxValue,
      targetValue: dimension.targetValue,
      priority: dimension.priority,
      unit: dimension.unit
    }));
    
    // Insert dimensions
    await db.insert(negotiationDimensions).values(dimensionsData);
    
    return newNegotiation;
  }

  // DEPRECATED: This method creates simulation runs directly, which causes duplicates.
  // Use createNegotiation() instead, then create runs via SimulationQueueService.createQueue()
  // Will be removed in a future version
  async createNegotiationWithSimulationRuns(negotiation: InsertNegotiation): Promise<{ negotiation: Negotiation; simulationRuns: any[] }> {
    // Create negotiation first
    const [newNegotiation] = await db.insert(negotiations).values(negotiation).returning();
    
    // Generate simulation runs for each technique-tactic combination
    const simulationRunsData = [];
    let runNumber = 1;
    
    // Get technique and tactic names from the arrays
    const techniqueIds = negotiation.selectedTechniques || [];
    const tacticIds = negotiation.selectedTactics || [];
    
    // Create N×M combinations
    for (const techniqueId of techniqueIds) {
      for (const tacticId of tacticIds) {
        simulationRunsData.push({
          negotiationId: newNegotiation.id,
          runNumber: runNumber++,
          techniqueId: techniqueId, // For now, store as string until we have proper UUIDs
          tacticId: tacticId, // For now, store as string until we have proper UUIDs
          status: "pending",
        });
      }
    }
    
    // Insert all simulation runs
    const createdRuns = [];
    for (const runData of simulationRunsData) {
      const [run] = await db.insert(simulationRuns).values(runData).returning();
      createdRuns.push(run);
    }
    
    return {
      negotiation: newNegotiation,
      simulationRuns: createdRuns,
    };
  }

  async updateNegotiation(id: string, negotiation: Partial<InsertNegotiation>): Promise<Negotiation> {
    const [updatedNegotiation] = await db
      .update(negotiations)
      .set(negotiation)
      .where(eq(negotiations.id, id))
      .returning();
    return updatedNegotiation;
  }

  async startNegotiation(id: string): Promise<Negotiation> {
    const [negotiation] = await db
      .update(negotiations)
      .set({ status: "active", startedAt: new Date() })
      .where(eq(negotiations.id, id))
      .returning();
    return negotiation;
  }

  async completeNegotiation(id: string, finalAgreement?: any, successScore?: number): Promise<Negotiation> {
    const [negotiation] = await db
      .update(negotiations)
      .set({
        status: "completed",
        completedAt: new Date(),
        // finalAgreement, // This field does not exist in the schema
        // successScore: successScore?.toString(), // This field does not exist in the schema
      })
      .where(eq(negotiations.id, id))
      .returning();
    return negotiation;
  }

  async deleteNegotiation(id: string): Promise<void> {
    // Delete negotiation (dimensions and simulation runs will cascade delete)
    await db.delete(negotiations).where(eq(negotiations.id, id));
  }

  // Simulation run methods
  async getSimulationRun(id: string): Promise<any | undefined> {
    const [run] = await db.select().from(simulationRuns).where(eq(simulationRuns.id, id));
    return run || undefined;
  }

  async getSimulationRuns(negotiationId: string): Promise<any[]> {
    return await db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.negotiationId, negotiationId))
      .orderBy(asc(simulationRuns.runNumber));
  }

  async createSimulationRun(run: any): Promise<any> {
    const [newRun] = await db.insert(simulationRuns).values(run).returning();
    return newRun;
  }

  async updateSimulationRun(id: string, run: Partial<any>): Promise<any> {
    const [updatedRun] = await db
      .update(simulationRuns)
      .set(run)
      .where(eq(simulationRuns.id, id))
      .returning();
    return updatedRun;
  }

  // Negotiation round methods
  async getNegotiationRounds(negotiationId: string): Promise<NegotiationRound[]> {
    // Get all simulation runs for this negotiation
    const simulationRunsResult = await db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.negotiationId, negotiationId));
    
    if (simulationRunsResult.length === 0) {
      return [];
    }

    // Get all rounds for all simulation runs (not just the first one)
    const simulationRunIds = simulationRunsResult.map(run => run.id);
    const rounds = await db
      .select()
      .from(negotiationRounds)
      .where(
        eq(negotiationRounds.simulationRunId, simulationRunIds[0]) // For now, return first run's rounds
        // TODO: Implement proper multi-run round retrieval
      )
      .orderBy(asc(negotiationRounds.roundNumber));
    
    return rounds;
  }

  async createNegotiationRound(round: InsertNegotiationRound): Promise<NegotiationRound> {
    const [newRound] = await db.insert(negotiationRounds).values(round).returning();
    return newRound;
  }

  // Tactic methods
  async getTactic(id: string): Promise<NegotiationTactic | undefined> {
    const [tactic] = await db.select().from(negotiationTactics).where(eq(negotiationTactics.id, id));
    return tactic || undefined;
  }

  async getAllTactics(): Promise<NegotiationTactic[]> {
    return await db.select().from(negotiationTactics).orderBy(asc(negotiationTactics.name));
  }

  async getTacticsByCategory(category: string): Promise<NegotiationTactic[]> {
    // Note: negotiationTactics doesn't have a 'category' field, returning all tactics for now
    return await db.select().from(negotiationTactics);
  }

  async createTactic(tactic: InsertNegotiationTactic): Promise<NegotiationTactic> {
    const [newTactic] = await db.insert(negotiationTactics).values(tactic).returning();
    return newTactic;
  }

  async updateTactic(id: string, tactic: Partial<InsertNegotiationTactic>): Promise<NegotiationTactic> {
    const [updatedTactic] = await db
      .update(negotiationTactics)
      .set(tactic)
      .where(eq(negotiationTactics.id, id))
      .returning();
    return updatedTactic;
  }

  // Analytics methods
  async getAnalyticsSession(id: string): Promise<AnalyticsSession | undefined> {
    const [session] = await db.select().from(analyticsSessions).where(eq(analyticsSessions.id, id));
    return session || undefined;
  }

  async getAllAnalyticsSessions(): Promise<AnalyticsSession[]> {
    return await db.select().from(analyticsSessions).orderBy(desc(analyticsSessions.startTime));
  }

  async createAnalyticsSession(session: InsertAnalyticsSession): Promise<AnalyticsSession> {
    const [newSession] = await db.insert(analyticsSessions).values(session).returning();
    return newSession;
  }

  async updateAnalyticsSession(id: string, session: Partial<InsertAnalyticsSession>): Promise<AnalyticsSession> {
    const [updatedSession] = await db
      .update(analyticsSessions)
      .set(session)
      .where(eq(analyticsSessions.id, id))
      .returning();
    return updatedSession;
  }

  // Performance metrics methods
  async getPerformanceMetrics(negotiationId: string): Promise<PerformanceMetric[]> {
    return await db
      .select()
      .from(performanceMetrics)
      .where(eq(performanceMetrics.negotiationId, negotiationId));
  }

  async getAgentPerformanceMetrics(agentId: string): Promise<PerformanceMetric[]> {
    return await db
      .select()
      .from(performanceMetrics)
      .where(eq(performanceMetrics.agentId, agentId));
  }

  async createPerformanceMetric(metric: InsertPerformanceMetric): Promise<PerformanceMetric> {
    const [newMetric] = await db.insert(performanceMetrics).values(metric).returning();
    return newMetric;
  }

  // Dashboard analytics methods
  async getDashboardMetrics(): Promise<{
    activeNegotiations: number;
    successRate: number;
    avgDuration: number;
    apiCostToday: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Active negotiations count
    const activeNegotiationsResult = await db
      .select({ count: count() })
      .from(negotiations)
      .where(eq(negotiations.status, "active"));

    // Success rate calculation
    const completedNegotiations = await db
      .select({ 
        total: count(),
      })
      .from(negotiations)
      .where(eq(negotiations.status, "completed"));
    
    const successfulNegotiations = await db
      .select({ 
        successful: count(),
      })
      .from(negotiations)
      .where(eq(negotiations.status, "completed"));

    // Average duration for completed negotiations today
    const avgDurationResult = await db
      .select({ avgDuration: avg(performanceMetrics.responseTime) })
      .from(performanceMetrics)
      .where(gte(performanceMetrics.timestamp, today));

    // API cost today - simplified calculation
    const apiCostResult = await db
      .select({ totalCost: count() })
      .from(performanceMetrics)
      .where(gte(performanceMetrics.timestamp, today));

    const activeNegotiations = activeNegotiationsResult[0]?.count || 0;
    const totalCompleted = completedNegotiations[0]?.total || 0;
    const successfulCompleted = successfulNegotiations[0]?.successful || 0;
    const successRate = totalCompleted > 0 ? (successfulCompleted / totalCompleted) * 100 : 0;
    const avgDuration = parseFloat(String(avgDurationResult[0]?.avgDuration || 0)) / 1000 / 60; // Convert to minutes
    const apiCostToday = parseFloat(String(apiCostResult[0]?.totalCost || 0));

    return {
      activeNegotiations,
      successRate,
      avgDuration,
      apiCostToday,
    };
  }

  async getSuccessRateTrends(days: number): Promise<Array<{ date: string; successRate: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // This is a simplified implementation - in a real scenario, you'd want more sophisticated date grouping
    const results = await db
      .select({
        date: negotiations.completedAt,
        // successScore: negotiations.successScore, // Field doesn't exist in schema
      })
      .from(negotiations)
      .where(
        and(
          eq(negotiations.status, "completed"),
          gte(negotiations.completedAt!, startDate)
        )
      )
      .orderBy(asc(negotiations.completedAt));

    // Group by date and calculate success rates
    const dateGroups: Record<string, { total: number; successful: number }> = {};
    results.forEach((result: any) => {
      const date = result.date!.toISOString().split('T')[0];
      if (!dateGroups[date]) {
        dateGroups[date] = { total: 0, successful: 0 };
      }
      dateGroups[date].total++;
      // if (parseFloat(result.successScore || "0") > 50) { // This field does not exist in the schema
      //   dateGroups[date].successful++;
      // }
    });

    return Object.entries(dateGroups).map(([date, data]) => ({
      date,
      successRate: (data.successful / data.total) * 100,
    }));
  }

  async getTopPerformingAgents(limit: number = 5): Promise<Array<{ agent: Agent; successRate: number }>> {
    const results = await db
      .select({
        agent: agents,
        totalNegotiations: count(negotiations.id),
      })
      .from(agents)
      .leftJoin(negotiations, eq(agents.id, negotiations.buyerAgentId))
      .where(eq(negotiations.status, "completed"))
      .groupBy(agents.id)
      .orderBy(desc(count(negotiations.id)))
      .limit(limit);

    return results.map((result: any) => ({
      agent: result.agent,
      successRate: result.totalNegotiations > 0 ? 85 : 0, // Simplified calculation for now
    }));
  }

  // Influencing techniques methods
  async getInfluencingTechnique(id: string): Promise<InfluencingTechnique | undefined> {
    const [technique] = await db.select().from(influencingTechniques).where(eq(influencingTechniques.id, id));
    return technique || undefined;
  }

  async getAllInfluencingTechniques(): Promise<InfluencingTechnique[]> {
    return await db.select().from(influencingTechniques).orderBy(asc(influencingTechniques.name));
  }

  async createInfluencingTechnique(technique: InsertInfluencingTechnique): Promise<InfluencingTechnique> {
    const [created] = await db.insert(influencingTechniques).values(technique).returning();
    return created;
  }

  async updateInfluencingTechnique(id: string, technique: Partial<InsertInfluencingTechnique>): Promise<InfluencingTechnique> {
    const [updated] = await db.update(influencingTechniques)
      .set(technique)
      .where(eq(influencingTechniques.id, id))
      .returning();
    return updated;
  }

  async deleteInfluencingTechnique(id: string): Promise<void> {
    await db.delete(influencingTechniques).where(eq(influencingTechniques.id, id));
  }

  // Negotiation tactics methods
  async getNegotiationTactic(id: string): Promise<NegotiationTactic | undefined> {
    const [tactic] = await db.select().from(negotiationTactics).where(eq(negotiationTactics.id, id));
    return tactic || undefined;
  }

  async getAllNegotiationTactics(): Promise<NegotiationTactic[]> {
    return await db.select().from(negotiationTactics).orderBy(asc(negotiationTactics.name));
  }

  async createNegotiationTactic(tactic: InsertNegotiationTactic): Promise<NegotiationTactic> {
    const [created] = await db.insert(negotiationTactics).values(tactic).returning();
    return created;
  }

  async updateNegotiationTactic(id: string, tactic: Partial<InsertNegotiationTactic>): Promise<NegotiationTactic> {
    const [updated] = await db.update(negotiationTactics)
      .set(tactic)
      .where(eq(negotiationTactics.id, id))
      .returning();
    return updated;
  }

  async deleteNegotiationTactic(id: string): Promise<void> {
    await db.delete(negotiationTactics).where(eq(negotiationTactics.id, id));
  }

  // Personality types methods
  async getPersonalityType(id: string): Promise<PersonalityType | undefined> {
    const [personalityType] = await db.select().from(personalityTypes).where(eq(personalityTypes.id, id));
    return personalityType || undefined;
  }

  async getAllPersonalityTypes(): Promise<PersonalityType[]> {
    return await db.select().from(personalityTypes).orderBy(asc(personalityTypes.archetype));
  }

  async createPersonalityType(personalityType: InsertPersonalityType): Promise<PersonalityType> {
    const [created] = await db.insert(personalityTypes).values(personalityType).returning();
    return created;
  }

  async updatePersonalityType(id: string, personalityType: Partial<InsertPersonalityType>): Promise<PersonalityType> {
    const [updated] = await db.update(personalityTypes)
      .set(personalityType)
      .where(eq(personalityTypes.id, id))
      .returning();
    return updated;
  }

  async deletePersonalityType(id: string): Promise<void> {
    await db.delete(personalityTypes).where(eq(personalityTypes.id, id));
  }

  // Additional negotiation methods
  async getNegotiationById(id: string): Promise<Negotiation | undefined> {
    return this.getNegotiation(id); // Use existing method
  }

  async updateNegotiationStatus(id: string, status: string): Promise<Negotiation> {
    return this.updateNegotiation(id, { status });
  }

  async getNegotiationDimensions(negotiationId: string) {
    return await db.select().from(negotiationDimensions).where(eq(negotiationDimensions.negotiationId, negotiationId));
  }

  async getPersonalityTypeByName(name: string) {
    const results = await db.select().from(personalityTypes).where(eq(personalityTypes.archetype, name));
    return results.length > 0 ? results[0] : null;
  }

  // Products methods
  async createProducts(productsData: Array<{ negotiationId: string; produktName: string; zielPreis: string; minMaxPreis: string; geschätztesVolumen: number }>) {
    if (productsData.length === 0) return [];
    return await db.insert(products).values(productsData).returning();
  }

  async getProductsByNegotiation(negotiationId: string) {
    return await db.select().from(products).where(eq(products.negotiationId, negotiationId));
  }

  async deleteProductsByNegotiation(negotiationId: string): Promise<void> {
    await db.delete(products).where(eq(products.negotiationId, negotiationId));
  }

  // Negotiation dimensions methods
  async createNegotiationDimensions(negotiationId: string, dimensionsData: Array<{ negotiationId: string; name: string; minValue: string; maxValue: string; targetValue: string; priority: number; unit: string | null }>) {
    if (dimensionsData.length === 0) return [];
    return await db.insert(negotiationDimensions).values(dimensionsData).returning();
  }
}

export const storage = new DatabaseStorage();
