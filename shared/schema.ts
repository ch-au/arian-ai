import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table (keeping existing structure)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Agents table - represents AI negotiation agents
export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  personalityProfile: jsonb("personality_profile").notNull(), // Big 5 traits
  powerLevel: decimal("power_level", { precision: 3, scale: 2 }).notNull(),
  preferredTactics: jsonb("preferred_tactics").notNull(), // array of tactic IDs
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Negotiation contexts - templates for negotiations
export const negotiationContexts = pgTable("negotiation_contexts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  productInfo: jsonb("product_info").notNull(),
  marketConditions: jsonb("market_conditions"),
  baselineValues: jsonb("baseline_values").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ZOPA configurations
export const zopaConfigurations = pgTable("zopa_configurations", {
  id: uuid("id").primaryKey().defaultRandom(),
  contextId: uuid("context_id").references(() => negotiationContexts.id),
  agentId: uuid("agent_id").references(() => agents.id),
  boundaries: jsonb("boundaries").notNull(), // min/max acceptable values
  preferences: jsonb("preferences"), // desired values
});

// Negotiations - actual negotiation sessions
export const negotiations = pgTable("negotiations", {
  id: uuid("id").primaryKey().defaultRandom(),
  contextId: uuid("context_id").references(() => negotiationContexts.id),
  buyerAgentId: uuid("buyer_agent_id").references(() => agents.id),
  sellerAgentId: uuid("seller_agent_id").references(() => agents.id),
  status: text("status").notNull().default("pending"), // pending, active, completed, failed
  userRole: text("user_role").notNull(), // "buyer" or "seller" - which role the user is interested in
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  totalRounds: integer("total_rounds").default(0),
  maxRounds: integer("max_rounds").default(10),
  selectedTechniques: text("selected_techniques").array().default([]).notNull(),
  selectedTactics: text("selected_tactics").array().default([]).notNull(),
  simulationRuns: integer("simulation_runs").default(1).notNull(),
  // User ZOPA configuration for all dimensions
  userZopaVolumen: jsonb("user_zopa_volumen").notNull(), // {min, max, target}
  userZopaPreis: jsonb("user_zopa_preis").notNull(), // {min, max, target}
  userZopaLaufzeit: jsonb("user_zopa_laufzeit").notNull(), // {min, max, target}
  userZopaZahlungskonditionen: jsonb("user_zopa_zahlungskonditionen").notNull(), // {min, max, target}
  // Counterpart distance settings (-1: far, 0: neutral, 1: close)
  counterpartDistanceVolumen: integer("counterpart_distance_volumen").default(0),
  counterpartDistancePreis: integer("counterpart_distance_preis").default(0),
  counterpartDistanceLaufzeit: integer("counterpart_distance_laufzeit").default(0),
  counterpartDistanceZahlungskonditionen: integer("counterpart_distance_zahlungskonditionen").default(0),
  sonderinteressen: text("sonderinteressen"), // Special interests/requirements
  metadata: jsonb("metadata"), // additional tracking data
});

// Simulation Results - individual simulation runs for each negotiation
export const simulationResults = pgTable("simulation_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  negotiationId: uuid("negotiation_id").references(() => negotiations.id, { onDelete: "cascade" }),
  simulationNumber: integer("simulation_number").notNull(), // 1, 2, 3... for multiple runs
  status: text("status").notNull().default("pending"), // pending, running, completed, failed
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  totalRounds: integer("total_rounds").default(0),
  finalAgreement: jsonb("final_agreement"), // Final negotiated terms
  zopaAchieved: boolean("zopa_achieved").default(false), // Whether user's ZOPA was met
  successScore: decimal("success_score", { precision: 5, scale: 2 }),
  // Final negotiated values for each dimension
  finalVolumen: decimal("final_volumen", { precision: 15, scale: 2 }),
  finalPreis: decimal("final_preis", { precision: 15, scale: 2 }),
  finalLaufzeit: integer("final_laufzeit"), // in months
  finalZahlungskonditionen: integer("final_zahlungskonditionen"), // payment terms in days
  // Performance metrics
  avgResponseTime: decimal("avg_response_time", { precision: 8, scale: 2 }),
  techniqueEffectiveness: jsonb("technique_effectiveness"), // effectiveness scores per technique
  tacticEffectiveness: jsonb("tactic_effectiveness"), // effectiveness scores per tactic
  metadata: jsonb("metadata"),
});

// Negotiation rounds - individual turns in a negotiation
export const negotiationRounds = pgTable("negotiation_rounds", {
  id: uuid("id").primaryKey().defaultRandom(),
  negotiationId: uuid("negotiation_id").references(() => negotiations.id),
  roundNumber: integer("round_number").notNull(),
  agentId: uuid("agent_id").references(() => agents.id),
  message: text("message").notNull(),
  proposal: jsonb("proposal"),
  responseTime: integer("response_time_ms"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Tactics - negotiation tactics/strategies
export const tactics = pgTable("tactics", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  category: text("category").notNull(), // collaborative, competitive, etc.
  description: text("description"),
  effectivenessScore: decimal("effectiveness_score", { precision: 3, scale: 2 }),
  usageCount: integer("usage_count").default(0),
});

// Analytics sessions - for tracking performance over time
export const analyticsSessions = pgTable("analytics_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionName: text("session_name").notNull(),
  startTime: timestamp("start_time").defaultNow(),
  endTime: timestamp("end_time"),
  totalNegotiations: integer("total_negotiations").default(0),
  successfulNegotiations: integer("successful_negotiations").default(0),
  averageDuration: integer("average_duration_ms"),
  totalApiCost: decimal("total_api_cost", { precision: 10, scale: 4 }),
  metadata: jsonb("metadata"),
});

// Performance metrics - detailed performance tracking
export const performanceMetrics = pgTable("performance_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  negotiationId: uuid("negotiation_id").references(() => negotiations.id),
  agentId: uuid("agent_id").references(() => agents.id),
  tacticId: uuid("tactic_id").references(() => tactics.id),
  effectivenessScore: decimal("effectiveness_score", { precision: 5, scale: 2 }),
  responseTime: integer("response_time_ms"),
  apiTokensUsed: integer("api_tokens_used"),
  apiCost: decimal("api_cost", { precision: 8, scale: 4 }),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Influencing techniques for negotiations
export const influencingTechniques = pgTable("influencing_techniques", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  beschreibung: text("beschreibung").notNull(),
  anwendung: text("anwendung").notNull(),
  wichtigeAspekte: jsonb("wichtige_aspekte").notNull(),
  keyPhrases: jsonb("key_phrases").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Negotiation tactics for strategic approaches
export const negotiationTactics = pgTable("negotiation_tactics", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  beschreibung: text("beschreibung").notNull(),
  anwendung: text("anwendung").notNull(),
  wichtigeAspekte: jsonb("wichtige_aspekte").notNull(),
  keyPhrases: jsonb("key_phrases").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const agentRelations = relations(agents, ({ many }) => ({
  buyerNegotiations: many(negotiations, { relationName: "buyerAgent" }),
  sellerNegotiations: many(negotiations, { relationName: "sellerAgent" }),
  rounds: many(negotiationRounds),
  zopaConfigurations: many(zopaConfigurations),
  performanceMetrics: many(performanceMetrics),
}));

export const negotiationRelations = relations(negotiations, ({ one, many }) => ({
  context: one(negotiationContexts, {
    fields: [negotiations.contextId],
    references: [negotiationContexts.id],
  }),
  buyerAgent: one(agents, {
    fields: [negotiations.buyerAgentId],
    references: [agents.id],
    relationName: "buyerAgent",
  }),
  sellerAgent: one(agents, {
    fields: [negotiations.sellerAgentId],
    references: [agents.id],
    relationName: "sellerAgent",
  }),
  rounds: many(negotiationRounds),
  simulationResults: many(simulationResults),
  performanceMetrics: many(performanceMetrics),
}));

export const simulationResultRelations = relations(simulationResults, ({ one }) => ({
  negotiation: one(negotiations, {
    fields: [simulationResults.negotiationId],
    references: [negotiations.id],
  }),
}));

export const negotiationContextRelations = relations(negotiationContexts, ({ many }) => ({
  negotiations: many(negotiations),
  zopaConfigurations: many(zopaConfigurations),
}));

export const negotiationRoundRelations = relations(negotiationRounds, ({ one }) => ({
  negotiation: one(negotiations, {
    fields: [negotiationRounds.negotiationId],
    references: [negotiations.id],
  }),
  agent: one(agents, {
    fields: [negotiationRounds.agentId],
    references: [agents.id],
  }),
}));

export const tacticRelations = relations(tactics, ({ many }) => ({
  performanceMetrics: many(performanceMetrics),
}));

export const performanceMetricRelations = relations(performanceMetrics, ({ one }) => ({
  negotiation: one(negotiations, {
    fields: [performanceMetrics.negotiationId],
    references: [negotiations.id],
  }),
  agent: one(agents, {
    fields: [performanceMetrics.agentId],
    references: [agents.id],
  }),
  tactic: one(tactics, {
    fields: [performanceMetrics.tacticId],
    references: [tactics.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNegotiationContextSchema = createInsertSchema(negotiationContexts).omit({
  id: true,
  createdAt: true,
});

export const insertZopaConfigurationSchema = createInsertSchema(zopaConfigurations).omit({
  id: true,
});

export const insertNegotiationSchema = createInsertSchema(negotiations).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

export const insertSimulationResultSchema = createInsertSchema(simulationResults).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

export const insertNegotiationRoundSchema = createInsertSchema(negotiationRounds).omit({
  id: true,
  timestamp: true,
});

export const insertTacticSchema = createInsertSchema(tactics).omit({
  id: true,
});

export const insertAnalyticsSessionSchema = createInsertSchema(analyticsSessions).omit({
  id: true,
  startTime: true,
  endTime: true,
});

export const insertPerformanceMetricSchema = createInsertSchema(performanceMetrics).omit({
  id: true,
  timestamp: true,
});

export const insertInfluencingTechniqueSchema = createInsertSchema(influencingTechniques).omit({
  id: true,
  createdAt: true,
});

export const insertNegotiationTacticSchema = createInsertSchema(negotiationTactics).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;

export type NegotiationContext = typeof negotiationContexts.$inferSelect;
export type InsertNegotiationContext = z.infer<typeof insertNegotiationContextSchema>;

export type ZopaConfiguration = typeof zopaConfigurations.$inferSelect;
export type InsertZopaConfiguration = z.infer<typeof insertZopaConfigurationSchema>;

export type Negotiation = typeof negotiations.$inferSelect;
export type InsertNegotiation = z.infer<typeof insertNegotiationSchema>;

export type SimulationResult = typeof simulationResults.$inferSelect;
export type InsertSimulationResult = z.infer<typeof insertSimulationResultSchema>;

export type NegotiationRound = typeof negotiationRounds.$inferSelect;
export type InsertNegotiationRound = z.infer<typeof insertNegotiationRoundSchema>;

export type Tactic = typeof tactics.$inferSelect;
export type InsertTactic = z.infer<typeof insertTacticSchema>;

export type AnalyticsSession = typeof analyticsSessions.$inferSelect;
export type InsertAnalyticsSession = z.infer<typeof insertAnalyticsSessionSchema>;

export type PerformanceMetric = typeof performanceMetrics.$inferSelect;
export type InsertPerformanceMetric = z.infer<typeof insertPerformanceMetricSchema>;

export type InfluencingTechnique = typeof influencingTechniques.$inferSelect;
export type InsertInfluencingTechnique = z.infer<typeof insertInfluencingTechniqueSchema>;

export type NegotiationTactic = typeof negotiationTactics.$inferSelect;
export type InsertNegotiationTactic = z.infer<typeof insertNegotiationTacticSchema>;

// Personality profile schema
export const personalityProfileSchema = z.object({
  openness: z.number().min(0).max(1),
  conscientiousness: z.number().min(0).max(1),
  extraversion: z.number().min(0).max(1),
  agreeableness: z.number().min(0).max(1),
  neuroticism: z.number().min(0).max(1),
});

export type PersonalityProfile = z.infer<typeof personalityProfileSchema>;

// ZOPA boundaries schema
export const zopaBoundariesSchema = z.object({
  volume: z.object({
    minAcceptable: z.number(),
    maxDesired: z.number(),
  }).optional(),
  price: z.object({
    minAcceptable: z.number(),
    maxDesired: z.number(),
  }).optional(),
  paymentTerms: z.object({
    minAcceptable: z.number(),
    maxDesired: z.number(),
  }).optional(),
  contractDuration: z.object({
    minAcceptable: z.number(),
    maxDesired: z.number(),
  }).optional(),
});

export type ZopaBoundaries = z.infer<typeof zopaBoundariesSchema>;

// Enhanced ZOPA schemas for German business negotiations
export const zopaDimensionSchema = z.object({
  min: z.number(),
  max: z.number(),
  target: z.number(),
});

export const userZopaConfigSchema = z.object({
  volumen: zopaDimensionSchema, // Volume/quantity
  preis: zopaDimensionSchema, // Price
  laufzeit: zopaDimensionSchema, // Contract duration (months)
  zahlungskonditionen: zopaDimensionSchema, // Payment terms (days)
});

export const counterpartDistanceSchema = z.object({
  volumen: z.number().min(-1).max(1), // -1: far, 0: neutral, 1: close
  preis: z.number().min(-1).max(1),
  laufzeit: z.number().min(-1).max(1),
  zahlungskonditionen: z.number().min(-1).max(1),
});

export type ZopaDimension = z.infer<typeof zopaDimensionSchema>;
export type UserZopaConfig = z.infer<typeof userZopaConfigSchema>;
export type CounterpartDistance = z.infer<typeof counterpartDistanceSchema>;
