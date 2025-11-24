import {
  users,
  agents,
  personalityTypes,
  type PersonalityType,
  type InsertPersonalityType,
  registrations,
  markets,
  counterparts,
  dimensions,
  products,
  negotiations,
  negotiationProducts,
  simulationQueue,
  simulationRuns,
  influencingTechniques,
  negotiationTactics,
  dimensionResults,
  productResults,
  type User,
  type InsertUser,
  type Agent,
  type InsertAgent,
  type Registration,
  type InsertRegistration,
  type Market,
  type InsertMarket,
  type Counterpart,
  type InsertCounterpart,
  type Dimension,
  type InsertDimension,
  type Product,
  type InsertProduct,
  type Negotiation,
  type InsertNegotiation,
  type SimulationQueue,
  type InsertSimulationQueue,
  type SimulationRun,
  type InsertSimulationRun,
  type InfluencingTechnique,
  type InsertInfluencingTechnique,
  type NegotiationTactic,
  type InsertNegotiationTactic,
  type DimensionResult,
  type InsertDimensionResult,
  type ProductResult,
  type InsertProductResult,
} from "@shared/schema";

// Placeholder types for missing schema definitions
type PerformanceMetric = any;
type InsertPerformanceMetric = any;
type Offer = any;
type InsertOffer = any;
type Event = any;
type InsertEvent = any;
type NegotiationRound = any;
type InsertNegotiationRound = any;
type RoundState = any;
type InsertRoundState = any;
type ProductDimensionValue = any;
type InsertProductDimensionValue = any;
const offers: any = {};
const events: any = {};
import { db } from "./db";
import { and, asc, avg, count, desc, eq, gte, sum } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export type NegotiationDimensionConfig = {
  id?: string;
  name: string;
  minValue: number;
  maxValue: number;
  targetValue: number;
  priority: number;
  unit?: string | null;
};

export type NegotiationScenarioConfig = {
  title?: string;
  userRole?: "buyer" | "seller";
  negotiationType?: string;
  relationshipType?: string;
  negotiationFrequency?: string;
  productMarketDescription?: string;
  additionalComments?: string;
  counterpartPersonality?: string;
  zopaDistance?: string;
  sonderinteressen?: string;
  maxRounds?: number;
  selectedTechniques?: string[];
  selectedTactics?: string[];
  userZopa?: Record<string, unknown>;
  counterpartDistance?: Record<string, number>;
  dimensions?: NegotiationDimensionConfig[];
  metadata?: Record<string, unknown>;
  market?: {
    name?: string;
    region?: string;
    countryCode?: string;
    currencyCode?: string;
    intelligence?: string;
    notes?: string;
  };
  companyProfile?: {
    organization?: string;
    company?: string;
    country?: string;
    negotiationType?: string;
    negotiationFrequency?: string;
    goals?: Record<string, unknown>;
  };
  counterpartProfile?: {
    name?: string;
    kind?: string;
    powerBalance?: string;
    style?: string;
    notes?: string;
  };
  products?: Array<{
    id?: string;
    name: string;
    brand?: string;
    category?: string;
    targetPrice?: number;
    minPrice?: number;
    maxPrice?: number;
    estimatedVolume?: number;
    attrs?: Record<string, unknown>;
    product_key?: string;
  }>;
};

export type NegotiationRecord = Omit<Negotiation, "scenario"> & {
  scenario: NegotiationScenarioConfig;
};

const DEFAULT_SCENARIO: NegotiationScenarioConfig = {
  userRole: "buyer",
  negotiationType: "one-shot",
  relationshipType: "first",
  selectedTechniques: [],
  selectedTactics: [],
  dimensions: [],
};

function normalizeScenario(raw: unknown): NegotiationScenarioConfig {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_SCENARIO };
  }

  const scenario = raw as NegotiationScenarioConfig;
  const products = Array.isArray(scenario.products)
    ? scenario.products.map((product, index) => {
        const normalizedName = product?.name ?? `Produkt ${index + 1}`;
        return {
          ...product,
          name: normalizedName,
          product_key: product?.product_key ?? slugifyProductName(normalizedName),
        };
      })
    : [];

  return {
    ...DEFAULT_SCENARIO,
    ...scenario,
    dimensions: Array.isArray(scenario.dimensions)
      ? scenario.dimensions.map((dim) => ({
        ...dim,
        id: dim.id ?? randomUUID(),
      }))
      : [],
    products,
  };
}

function mapNegotiationRow(row: Negotiation): NegotiationRecord {
  return {
    ...row,
    scenario: normalizeScenario(row.scenario),
  };
}

function slugifyProductName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s_-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "_");
}

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Agent management
  getAgent(id: string): Promise<Agent | undefined>;
  getAllAgents(): Promise<Agent[]>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: string, agent: Partial<InsertAgent>): Promise<Agent>;
  deleteAgent(id: string): Promise<void>;

  // Master data
  getRegistrations(): Promise<Registration[]>;
  createRegistration(data: InsertRegistration): Promise<Registration>;
  getMarkets(registrationId: string): Promise<Market[]>;
  createMarket(data: InsertMarket): Promise<Market>;
  getCounterparts(registrationId: string): Promise<Counterpart[]>;
  createCounterpart(data: InsertCounterpart): Promise<Counterpart>;
  getDimensions(registrationId: string): Promise<Dimension[]>;
  createDimension(data: InsertDimension): Promise<Dimension>;

  // Products & attributes
  getProducts(registrationId: string): Promise<Product[]>;
  createProduct(data: InsertProduct): Promise<Product>;
  upsertProductDimension(value: InsertProductDimensionValue): Promise<ProductDimensionValue>;

  // Negotiations
  getNegotiation(id: string): Promise<NegotiationRecord | undefined>;
  getAllNegotiations(userId?: string): Promise<NegotiationRecord[]>;
  getActiveNegotiations(userId?: string): Promise<NegotiationRecord[]>;
  getRecentNegotiations(limit?: number, userId?: string): Promise<NegotiationRecord[]>;
  createNegotiation(data: InsertNegotiation & { scenario?: NegotiationScenarioConfig; dimensions?: NegotiationDimensionConfig[]; productIds?: string[] }): Promise<NegotiationRecord>;
  updateNegotiation(id: string, data: Partial<InsertNegotiation> & { scenario?: NegotiationScenarioConfig }): Promise<NegotiationRecord>;
  startNegotiation(id: string): Promise<NegotiationRecord>;
  completeNegotiation(id: string, finalAgreement?: Record<string, unknown>, successScore?: number): Promise<NegotiationRecord>;
  updateNegotiationStatus(id: string, status: Negotiation["status"]): Promise<NegotiationRecord>;
  deleteNegotiation(id: string): Promise<void>;
  getNegotiationDimensions(id: string): Promise<NegotiationDimensionConfig[]>;
  setNegotiationDimensions(id: string, dimensions: NegotiationDimensionConfig[]): Promise<NegotiationDimensionConfig[]>;
  attachProductsToNegotiation(negotiationId: string, productIds: string[]): Promise<void>;
  getProductsByNegotiation(negotiationId: string): Promise<Product[]>;

  // Rounds & states
  getNegotiationRounds(negotiationId: string): Promise<NegotiationRound[]>;
  createNegotiationRound(round: InsertNegotiationRound): Promise<NegotiationRound>;
  upsertRoundState(state: InsertRoundState): Promise<RoundState>;

  // Simulation management
  getSimulationRuns(negotiationId: string): Promise<SimulationRun[]>;
  getSimulationRun(id: string): Promise<SimulationRun | undefined>;
  createSimulationRun(run: InsertSimulationRun): Promise<SimulationRun>;
  updateSimulationRun(id: string, run: Partial<InsertSimulationRun>): Promise<SimulationRun>;

  // Offers & events
  createOffer(offer: InsertOffer): Promise<Offer>;
  getOffersByRound(roundId: string): Promise<Offer[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  getEventsByRound(roundId: string): Promise<Event[]>;

  // Metrics
  createPerformanceMetric(metric: InsertPerformanceMetric): Promise<PerformanceMetric>;
  getDashboardMetrics(userId?: string): Promise<{
    activeNegotiations: number;
    successRate: number;
    avgDuration: number;
    apiCostToday: number;
  }>;
  getSuccessRateTrends(days: number, userId?: string): Promise<Array<{ date: string; successRate: number }>>;
  getTopPerformingAgents(limit?: number): Promise<Array<{ agent: Agent; successRate: number }>>;
  getAgentPerformanceMetrics(agentId: string): Promise<PerformanceMetric[]>;

  // Techniques / tactics
  getAllInfluencingTechniques(): Promise<InfluencingTechnique[]>;
  getInfluencingTechnique(id: string): Promise<InfluencingTechnique | undefined>;
  createInfluencingTechnique(data: InsertInfluencingTechnique): Promise<InfluencingTechnique>;
  updateInfluencingTechnique(id: string, data: Partial<InsertInfluencingTechnique>): Promise<InfluencingTechnique>;
  deleteInfluencingTechnique(id: string): Promise<void>;

  getAllNegotiationTactics(): Promise<NegotiationTactic[]>;
  getNegotiationTactic(id: string): Promise<NegotiationTactic | undefined>;
  createNegotiationTactic(data: InsertNegotiationTactic): Promise<NegotiationTactic>;
  updateNegotiationTactic(id: string, data: Partial<InsertNegotiationTactic>): Promise<NegotiationTactic>;
  deleteNegotiationTactic(id: string): Promise<void>;
  createPersonalityType(data: InsertPersonalityType): Promise<PersonalityType>;
  getAllPersonalityTypes(): Promise<PersonalityType[]>;
}

class DatabaseStorage implements IStorage {
  // #region Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user ?? undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user ?? undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  // #endregion

  // #region Agents
  async getAgent(id: string): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent ?? undefined;
  }

  async getAllAgents(): Promise<Agent[]> {
    return db.select().from(agents).orderBy(asc(agents.createdAt));
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    const [created] = await db.insert(agents).values(agent).returning();
    return created;
  }

  async updateAgent(id: string, agent: Partial<InsertAgent>): Promise<Agent> {
    const [updated] = await db
      .update(agents)
      .set({ ...agent, updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning();
    return updated;
  }

  async deleteAgent(id: string): Promise<void> {
    await db.delete(agents).where(eq(agents.id, id));
  }
  // #endregion

  // #region Master data
  async getRegistrations(): Promise<Registration[]> {
    return db.select().from(registrations).orderBy(desc(registrations.createdAt));
  }

  async createRegistration(data: InsertRegistration): Promise<Registration> {
    const [registration] = await db.insert(registrations).values(data).returning();
    return registration;
  }

  async getMarkets(registrationId: string): Promise<Market[]> {
    return db.select().from(markets).where(eq(markets.registrationId, registrationId));
  }

  async createMarket(data: InsertMarket): Promise<Market> {
    const [market] = await db.insert(markets).values(data).returning();
    return market;
  }

  async getCounterparts(registrationId: string): Promise<Counterpart[]> {
    return db.select().from(counterparts).where(eq(counterparts.registrationId, registrationId));
  }

  async createCounterpart(data: InsertCounterpart): Promise<Counterpart> {
    const [counterpart] = await db.insert(counterparts).values(data).returning();
    return counterpart;
  }

  async getDimensions(registrationId: string): Promise<Dimension[]> {
    return db.select().from(dimensions).where(eq(dimensions.registrationId, registrationId));
  }

  async createDimension(data: InsertDimension): Promise<Dimension> {
    const [dimension] = await db.insert(dimensions).values(data).returning();
    return dimension;
  }

  async getProducts(registrationId: string): Promise<Product[]> {
    return db.select().from(products).where(eq(products.registrationId, registrationId));
  }

  async createProduct(data: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(data).returning();
    return product;
  }

  async upsertProductDimension(value: InsertProductDimensionValue): Promise<ProductDimensionValue> {
    return {} as ProductDimensionValue;
  }
  // #endregion

  // #region Negotiations
  async getNegotiation(id: string): Promise<NegotiationRecord | undefined> {
    const [row] = await db.select().from(negotiations).where(eq(negotiations.id, id));
    return row ? mapNegotiationRow(row) : undefined;
  }

  async getAllNegotiations(userId?: string): Promise<NegotiationRecord[]> {
    const userFilter = userId ? eq(negotiations.userId, Number(userId)) : null;
    let query = db.select().from(negotiations).orderBy(desc(negotiations.startedAt));
    if (userFilter) {
      query = query.where(userFilter);
    }

    const rows = await query;

    return rows.map(mapNegotiationRow);
  }

  async getActiveNegotiations(userId?: string): Promise<NegotiationRecord[]> {
    const statusFilter = eq(negotiations.status, "running");
    const userFilter = userId ? eq(negotiations.userId, Number(userId)) : null;
    const whereClause = userFilter ? and(statusFilter, userFilter) : statusFilter;
    
    const rows = await db
      .select()
      .from(negotiations)
      .where(whereClause);
    return rows.map(mapNegotiationRow);
  }

  async getRecentNegotiations(limit = 10, userId?: string): Promise<NegotiationRecord[]> {
    const userFilter = userId ? eq(negotiations.userId, Number(userId)) : null;
    let query = db.select().from(negotiations).orderBy(desc(negotiations.startedAt)).limit(limit);
    if (userFilter) {
      query = query.where(userFilter);
    }

    const rows = await query;
    return rows.map(mapNegotiationRow);
  }

  async createNegotiation(
    data: InsertNegotiation & {
      scenario?: NegotiationScenarioConfig;
      dimensions?: NegotiationDimensionConfig[];
      productIds?: string[];
    },
  ): Promise<NegotiationRecord> {
    const scenario = normalizeScenario(data.scenario);
    if (data.dimensions) {
      scenario.dimensions = data.dimensions;
    }

    const [row] = await db
      .insert(negotiations)
      .values({
        ...data,
        scenario,
      })
      .returning();

    if (data.productIds?.length) {
      await this.attachProductsToNegotiation(row.id, data.productIds);
    }

    return mapNegotiationRow(row);
  }

  async updateNegotiation(id: string, data: Partial<InsertNegotiation> & { scenario?: NegotiationScenarioConfig }): Promise<NegotiationRecord> {
    const current = await this.getNegotiation(id);
    if (!current) {
      throw new Error("Negotiation not found");
    }

    const scenario = data.scenario ? normalizeScenario(data.scenario) : current.scenario;

    const [row] = await db
      .update(negotiations)
      .set({
        ...data,
        scenario,
      })
      .where(eq(negotiations.id, id))
      .returning();

    return mapNegotiationRow(row);
  }

  async startNegotiation(id: string): Promise<NegotiationRecord> {
    const [row] = await db
      .update(negotiations)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(negotiations.id, id))
      .returning();
    return mapNegotiationRow(row);
  }

  async completeNegotiation(id: string, finalAgreement?: Record<string, unknown>, successScore?: number): Promise<NegotiationRecord> {
    const negotiation = await this.getNegotiation(id);
    if (!negotiation) {
      throw new Error("Negotiation not found");
    }

    const scenarioUpdate = finalAgreement
      ? {
        ...negotiation.scenario,
        finalAgreement,
      }
      : negotiation.scenario;

    const [row] = await db
      .update(negotiations)
      .set({
        status: "completed",
        endedAt: new Date(),
        scenario: scenarioUpdate,
        metadata: successScore ? { successScore } : undefined,
      })
      .where(eq(negotiations.id, id))
      .returning();
    return mapNegotiationRow(row);
  }

  async updateNegotiationStatus(id: string, status: Negotiation["status"]): Promise<NegotiationRecord> {
    const [row] = await db
      .update(negotiations)
      .set({ status })
      .where(eq(negotiations.id, id))
      .returning();
    return mapNegotiationRow(row);
  }

  async deleteNegotiation(id: string): Promise<void> {
    await db.delete(negotiations).where(eq(negotiations.id, id));
  }

  async getNegotiationDimensions(id: string): Promise<NegotiationDimensionConfig[]> {
    const negotiation = await this.getNegotiation(id);
    if (!negotiation) {
      return [];
    }
    return negotiation.scenario.dimensions ?? [];
  }

  async setNegotiationDimensions(id: string, dimensions: NegotiationDimensionConfig[]): Promise<NegotiationDimensionConfig[]> {
    const negotiation = await this.getNegotiation(id);
    if (!negotiation) {
      throw new Error("Negotiation not found");
    }

    const scenario = {
      ...negotiation.scenario,
      dimensions,
    };

    await this.updateNegotiation(id, { scenario });
    return dimensions;
  }

  async attachProductsToNegotiation(negotiationId: string, productIds: string[]): Promise<void> {
    if (!productIds.length) return;

    await db
      .insert(negotiationProducts)
      .values(productIds.map((productId) => ({ negotiationId, productId })))
      .onConflictDoNothing({ target: [negotiationProducts.negotiationId, negotiationProducts.productId] });
  }

  async getProductsByNegotiation(negotiationId: string): Promise<Product[]> {
    const rows = await db
      .select({
        product: products,
      })
      .from(negotiationProducts)
      .innerJoin(products, eq(products.id, negotiationProducts.productId))
      .where(eq(negotiationProducts.negotiationId, negotiationId));
    return rows.map((row) => row.product);
  }
  // #endregion

  // #region Rounds & States
  async getNegotiationRounds(negotiationId: string): Promise<NegotiationRound[]> {
    return [];
  }

  async createNegotiationRound(round: InsertNegotiationRound): Promise<NegotiationRound> {
    return {} as NegotiationRound;
  }

  async upsertRoundState(state: InsertRoundState): Promise<RoundState> {
    return {} as RoundState;
  }
  // #endregion

  // #region Simulation Runs
  async getSimulationRuns(negotiationId: string): Promise<SimulationRun[]> {
    return db.select().from(simulationRuns).where(eq(simulationRuns.negotiationId, negotiationId)).orderBy(asc(simulationRuns.runNumber));
  }

  async getSimulationRun(id: string): Promise<SimulationRun | undefined> {
    const [run] = await db.select().from(simulationRuns).where(eq(simulationRuns.id, id));
    return run ?? undefined;
  }

  async createSimulationRun(run: InsertSimulationRun): Promise<SimulationRun> {
    const [created] = await db.insert(simulationRuns).values(run).returning();
    return created;
  }

  async updateSimulationRun(id: string, run: Partial<InsertSimulationRun>): Promise<SimulationRun> {
    const [updated] = await db.update(simulationRuns).set(run).where(eq(simulationRuns.id, id)).returning();
    return updated;
  }
  // #endregion

  // #region Offers & Events
  async createOffer(offer: InsertOffer): Promise<Offer> {
    return {} as Offer;
  }

  async getOffersByRound(roundId: string): Promise<Offer[]> {
    return [];
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    return {} as Event;
  }

  async getEventsByRound(roundId: string): Promise<Event[]> {
    return [];
  }
  // #endregion

  // #region Metrics & Analytics
  async createPerformanceMetric(metric: InsertPerformanceMetric): Promise<PerformanceMetric> {
    return {} as PerformanceMetric;
  }

  async getDashboardMetrics(userId?: string): Promise<{
    activeNegotiations: number;
    successRate: number;
    avgDuration: number;
    apiCostToday: number;
    totalSimulationRuns: number;
  }> {
    const userFilter = userId ? eq(negotiations.userId, Number(userId)) : null;

    const [activeNegotiationCount] = await db
      .select({ value: count() })
      .from(negotiations)
      .where(userFilter ? and(eq(negotiations.status, "running"), userFilter) : eq(negotiations.status, "running"));

    // For simulation runs, we need to join with negotiations to filter by user
    const completedFilter = eq(simulationRuns.status, "completed");
    const completedWhere = userFilter ? and(completedFilter, userFilter) : completedFilter;

    const [successRateRow] = await db
      .select({ success: count() })
      .from(simulationRuns)
      .innerJoin(negotiations, eq(simulationRuns.negotiationId, negotiations.id))
      .where(completedWhere);

    const [avgDurationRow] = await db
      .select({ duration: avg(simulationRuns.totalRounds) })
      .from(simulationRuns)
      .innerJoin(negotiations, eq(simulationRuns.negotiationId, negotiations.id))
      .where(completedWhere);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startedToday = gte(simulationRuns.startedAt, today);
    const apiCostWhere = userFilter ? and(startedToday, userFilter) : startedToday;

    const [apiCostRow] = await db
      .select({ cost: sum(simulationRuns.actualCost) })
      .from(simulationRuns)
      .innerJoin(negotiations, eq(simulationRuns.negotiationId, negotiations.id))
      .where(apiCostWhere);

    const totalRunsWhere = userFilter ? userFilter : undefined;
    const totalRunsQuery = db
      .select({ count: count() })
      .from(simulationRuns)
      .innerJoin(negotiations, eq(simulationRuns.negotiationId, negotiations.id));

    const [totalRunsRow] = await (totalRunsWhere ? totalRunsQuery.where(totalRunsWhere) : totalRunsQuery);

    return {
      activeNegotiations: Number(activeNegotiationCount?.value || 0),
      successRate: Number(successRateRow?.success || 0),
      avgDuration: Number(avgDurationRow?.duration || 0),
      apiCostToday: Number(apiCostRow?.cost || 0),
      totalSimulationRuns: Number(totalRunsRow?.count || 0),
    };
  }

  async getSuccessRateTrends(days: number): Promise<Array<{ date: string; successRate: number }>> {
    const trend: Array<{ date: string; successRate: number }> = [];
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);

      const [row] = await db
        .select({
          success: count(),
        })
        .from(simulationRuns)
        .where(
          and(
            eq(simulationRuns.status, "completed"),
            gte(simulationRuns.completedAt, date),
          ),
        );

      trend.push({
        date: date.toISOString().split("T")[0],
        successRate: Number(row?.success || 0),
      });
    }

    return trend.reverse();
  }

  async getTopPerformingAgents(limit = 5): Promise<Array<{ agent: Agent; successRate: number }>> {
    const agentRows = await db
      .select({
        agent: agents,
      })
      .from(agents)
      .groupBy(agents.id)
      .limit(limit);

    return agentRows.map((row) => ({
      agent: row.agent,
      successRate: 0, // Placeholder as successRate is not in the query
    }));
  }

  async getAgentPerformanceMetrics(agentId: string): Promise<PerformanceMetric[]> {
    return [];
  }
  // #endregion

  // #region Techniques / Tactics
  async getAllInfluencingTechniques(): Promise<InfluencingTechnique[]> {
    return db.select().from(influencingTechniques).orderBy(asc(influencingTechniques.createdAt));
  }

  async getInfluencingTechnique(id: string): Promise<InfluencingTechnique | undefined> {
    const [technique] = await db.select().from(influencingTechniques).where(eq(influencingTechniques.id, id));
    return technique ?? undefined;
  }

  async createInfluencingTechnique(data: InsertInfluencingTechnique): Promise<InfluencingTechnique> {
    const [technique] = await db.insert(influencingTechniques).values(data).returning();
    return technique;
  }

  async updateInfluencingTechnique(id: string, data: Partial<InsertInfluencingTechnique>): Promise<InfluencingTechnique> {
    const [technique] = await db
      .update(influencingTechniques)
      .set(data)
      .where(eq(influencingTechniques.id, id))
      .returning();
    return technique;
  }

  async deleteInfluencingTechnique(id: string): Promise<void> {
    await db.delete(influencingTechniques).where(eq(influencingTechniques.id, id));
  }

  async getAllNegotiationTactics(): Promise<NegotiationTactic[]> {
    return db.select().from(negotiationTactics).orderBy(asc(negotiationTactics.createdAt));
  }

  async getNegotiationTactic(id: string): Promise<NegotiationTactic | undefined> {
    const [tactic] = await db.select().from(negotiationTactics).where(eq(negotiationTactics.id, id));
    return tactic ?? undefined;
  }

  async createNegotiationTactic(data: InsertNegotiationTactic): Promise<NegotiationTactic> {
    const [tactic] = await db.insert(negotiationTactics).values(data).returning();
    return tactic;
  }

  async updateNegotiationTactic(id: string, data: Partial<InsertNegotiationTactic>): Promise<NegotiationTactic> {
    const [tactic] = await db
      .update(negotiationTactics)
      .set(data)
      .where(eq(negotiationTactics.id, id))
      .returning();
    return tactic;
  }

  async deleteNegotiationTactic(id: string): Promise<void> {
    await db.delete(negotiationTactics).where(eq(negotiationTactics.id, id));
  }

  async createPersonalityType(data: InsertPersonalityType): Promise<PersonalityType> {
    const [type] = await db.insert(personalityTypes).values(data).returning();
    return type;
  }

  async getAllPersonalityTypes(): Promise<PersonalityType[]> {
    return db.select().from(personalityTypes).orderBy(asc(personalityTypes.archetype));
  }
  // #endregion
}

export const storage = new DatabaseStorage();
