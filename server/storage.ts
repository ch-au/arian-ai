import {
  users,
  agents,
  negotiationContexts,
  zopaConfigurations,
  negotiations,
  negotiationRounds,
  tactics,
  analyticsSessions,
  performanceMetrics,
  influencingTechniques,
  negotiationTactics,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, gte, lte, avg, count, sum } from "drizzle-orm";

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
  updateNegotiation(id: string, negotiation: Partial<InsertNegotiation>): Promise<Negotiation>;
  startNegotiation(id: string): Promise<Negotiation>;
  completeNegotiation(id: string, finalAgreement?: any, successScore?: number): Promise<Negotiation>;

  // Negotiation round methods
  getNegotiationRounds(negotiationId: string): Promise<NegotiationRound[]>;
  createNegotiationRound(round: InsertNegotiationRound): Promise<NegotiationRound>;

  // Tactic methods
  getTactic(id: string): Promise<Tactic | undefined>;
  getAllTactics(): Promise<Tactic[]>;
  getTacticsByCategory(category: string): Promise<Tactic[]>;
  createTactic(tactic: InsertTactic): Promise<Tactic>;
  updateTactic(id: string, tactic: Partial<InsertTactic>): Promise<Tactic>;

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
        finalAgreement,
        successScore: successScore?.toString(),
      })
      .where(eq(negotiations.id, id))
      .returning();
    return negotiation;
  }

  // Negotiation round methods
  async getNegotiationRounds(negotiationId: string): Promise<NegotiationRound[]> {
    return await db
      .select()
      .from(negotiationRounds)
      .where(eq(negotiationRounds.negotiationId, negotiationId))
      .orderBy(asc(negotiationRounds.roundNumber));
  }

  async createNegotiationRound(round: InsertNegotiationRound): Promise<NegotiationRound> {
    const [newRound] = await db.insert(negotiationRounds).values(round).returning();
    return newRound;
  }

  // Tactic methods
  async getTactic(id: string): Promise<Tactic | undefined> {
    const [tactic] = await db.select().from(tactics).where(eq(tactics.id, id));
    return tactic || undefined;
  }

  async getAllTactics(): Promise<Tactic[]> {
    return await db.select().from(tactics).orderBy(asc(tactics.name));
  }

  async getTacticsByCategory(category: string): Promise<Tactic[]> {
    return await db.select().from(tactics).where(eq(tactics.category, category));
  }

  async createTactic(tactic: InsertTactic): Promise<Tactic> {
    const [newTactic] = await db.insert(tactics).values(tactic).returning();
    return newTactic;
  }

  async updateTactic(id: string, tactic: Partial<InsertTactic>): Promise<Tactic> {
    const [updatedTactic] = await db
      .update(tactics)
      .set(tactic)
      .where(eq(tactics.id, id))
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
        successful: sum(negotiations.successScore)
      })
      .from(negotiations)
      .where(eq(negotiations.status, "completed"));

    // Average duration for completed negotiations today
    const avgDurationResult = await db
      .select({ avgDuration: avg(performanceMetrics.responseTime) })
      .from(performanceMetrics)
      .where(gte(performanceMetrics.timestamp, today));

    // API cost today
    const apiCostResult = await db
      .select({ totalCost: sum(performanceMetrics.apiCost) })
      .from(performanceMetrics)
      .where(gte(performanceMetrics.timestamp, today));

    const activeNegotiations = activeNegotiationsResult[0]?.count || 0;
    const totalCompleted = completedNegotiations[0]?.total || 0;
    const successfulCompleted = parseFloat(completedNegotiations[0]?.successful || "0");
    const successRate = totalCompleted > 0 ? (successfulCompleted / totalCompleted) * 100 : 0;
    const avgDuration = parseFloat(avgDurationResult[0]?.avgDuration || "0") / 1000 / 60; // Convert to minutes
    const apiCostToday = parseFloat(apiCostResult[0]?.totalCost || "0");

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
        successScore: negotiations.successScore,
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
    results.forEach((result) => {
      const date = result.date!.toISOString().split('T')[0];
      if (!dateGroups[date]) {
        dateGroups[date] = { total: 0, successful: 0 };
      }
      dateGroups[date].total++;
      if (parseFloat(result.successScore || "0") > 50) {
        dateGroups[date].successful++;
      }
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
        successfulNegotiations: sum(negotiations.successScore),
      })
      .from(agents)
      .leftJoin(negotiations, eq(agents.id, negotiations.buyerAgentId))
      .where(eq(negotiations.status, "completed"))
      .groupBy(agents.id)
      .orderBy(desc(sum(negotiations.successScore)))
      .limit(limit);

    return results.map((result) => ({
      agent: result.agent,
      successRate: result.totalNegotiations > 0 
        ? (parseFloat(result.successfulNegotiations || "0") / result.totalNegotiations) * 100 
        : 0,
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
}

export const storage = new DatabaseStorage();
