import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal, uuid, unique } from "drizzle-orm/pg-core";
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

// Negotiations - actual negotiation sessions (ENHANCED)
export const negotiations = pgTable("negotiations", {
  id: uuid("id").primaryKey().defaultRandom(),
  contextId: uuid("context_id").references(() => negotiationContexts.id),
  buyerAgentId: uuid("buyer_agent_id").references(() => agents.id),
  sellerAgentId: uuid("seller_agent_id").references(() => agents.id),
  
  // NEW: Business context fields
  title: text("title").notNull().default("Untitled Negotiation"),
  negotiationType: text("negotiation_type").notNull().default("one-shot"), // one-shot, multi-year
  relationshipType: text("relationship_type").notNull().default("first"), // first, long-standing
  productMarketDescription: text("product_market_description"),
  additionalComments: text("additional_comments"),
  
  status: text("status").notNull().default("pending"), // pending, running, completed, failed
  userRole: text("user_role").notNull(), // "buyer" or "seller" - which role the user is interested in
  maxRounds: integer("max_rounds").default(10),
  
  // Selected techniques and tactics for this negotiation (UUIDs now instead of names)
  selectedTechniques: uuid("selected_techniques").array().default([]).notNull(),
  selectedTactics: uuid("selected_tactics").array().default([]).notNull(),
  
  // Counterpart configuration
  counterpartPersonality: text("counterpart_personality"), // Selected personality type
  zopaDistance: text("zopa_distance"), // "close", "medium", "far" 
  
  // DEPRECATED: Will be removed after migration to negotiation_dimensions table
  userZopa: jsonb("user_zopa"), // {volumen: {min,max,target}, preis: {min,max,target}, laufzeit: {min,max,target}, zahlungskonditionen: {min,max,target}}
  counterpartDistance: jsonb("counterpart_distance"), // {volumen: 0, preis: 0, laufzeit: 0, zahlungskonditionen: 0}
  
  sonderinteressen: text("sonderinteressen"), // Special interests/requirements
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  metadata: jsonb("metadata").default({}),
});

// Simulation Queue - manages execution queue for negotiations
export const simulationQueue = pgTable("simulation_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  negotiationId: uuid("negotiation_id").references(() => negotiations.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // pending, running, completed, failed, paused
  totalSimulations: integer("total_simulations").notNull(),
  completedCount: integer("completed_count").default(0),
  failedCount: integer("failed_count").default(0),
  startedAt: timestamp("started_at"),
  pausedAt: timestamp("paused_at"),
  completedAt: timestamp("completed_at"),
  estimatedTotalCost: decimal("estimated_total_cost", { precision: 10, scale: 4 }),
  actualTotalCost: decimal("actual_total_cost", { precision: 10, scale: 4 }).default("0"),
  crashRecoveryCheckpoint: jsonb("crash_recovery_checkpoint"), // Recovery state
  createdAt: timestamp("created_at").defaultNow(),
});

// Simulation Runs - individual runs for each technique-tactic combination
export const simulationRuns = pgTable("simulation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  negotiationId: uuid("negotiation_id").references(() => negotiations.id, { onDelete: "cascade" }),
  queueId: uuid("queue_id").references(() => simulationQueue.id, { onDelete: "cascade" }),
  runNumber: integer("run_number").notNull(), // Sequential number for this negotiation
  executionOrder: integer("execution_order"), // Queue position
  // Specific technique/tactic/personality/distance combination being tested
  techniqueId: uuid("technique_id").references(() => influencingTechniques.id),
  tacticId: uuid("tactic_id").references(() => negotiationTactics.id),
  personalityId: text("personality_id"), // Using text for mock personality IDs like "1", "2", etc.
  zopaDistance: text("zopa_distance"), // "close", "medium", "far"
  // Status and timing
  status: text("status").notNull().default("pending"), // pending, running, completed, failed, paused
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  estimatedDuration: integer("estimated_duration"), // Predicted seconds
  actualCost: decimal("actual_cost", { precision: 10, scale: 4 }), // OpenAI API cost
  crashRecoveryData: jsonb("crash_recovery_data"), // State for recovery
  retryCount: integer("retry_count").default(0), // Failed attempts
  maxRetries: integer("max_retries").default(3), // Retry limit
  // Results
  totalRounds: integer("total_rounds").default(0),
  finalAgreement: jsonb("final_agreement"), // Final negotiated terms
  zopaAchieved: boolean("zopa_achieved").default(false), // Whether user's ZOPA was met
  successScore: decimal("success_score", { precision: 5, scale: 2 }), // 0-100 score
  // Final negotiated values
  finalTerms: jsonb("final_terms"), // {volumen: X, preis: Y, laufzeit: Z, zahlungskonditionen: W}
  // Performance metrics
  avgResponseTimeMs: integer("avg_response_time_ms"),
  techniqueEffectivenessScore: decimal("technique_effectiveness_score", { precision: 5, scale: 2 }),
  tacticEffectivenessScore: decimal("tactic_effectiveness_score", { precision: 5, scale: 2 }),
  // NEW: Enhanced result tracking
  conversationLog: jsonb("conversation_log").default([]).notNull(), // Array of conversation turns
  dimensionResults: jsonb("dimension_results").default({}).notNull(), // Results per dimension
  personalityArchetype: text("personality_archetype"), // Link to personality type
  metadata: jsonb("metadata").default({}),
  // Langfuse integration
  langfuseTraceId: text("langfuse_trace_id"), // Langfuse trace ID for this negotiation
  outcome: text("outcome"), // Detailed outcome: DEAL_ACCEPTED, TERMINATED, WALK_AWAY, PAUSED, MAX_ROUNDS_REACHED, ERROR
});

// Negotiation rounds - individual turns in a simulation run
export const negotiationRounds = pgTable("negotiation_rounds", {
  id: uuid("id").primaryKey().defaultRandom(),
  simulationRunId: uuid("simulation_run_id").references(() => simulationRuns.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
  agentId: uuid("agent_id").references(() => agents.id),
  message: text("message").notNull(),
  proposal: jsonb("proposal"),
  responseTimeMs: integer("response_time_ms"),
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
  tacticId: uuid("tactic_id").references(() => negotiationTactics.id),
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

// NEW: Flexible negotiation dimensions (replaces hardcoded userZopa)
export const negotiationDimensions = pgTable("negotiation_dimensions", {
  id: uuid("id").primaryKey().defaultRandom(),
  negotiationId: uuid("negotiation_id").references(() => negotiations.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(), // e.g. "price", "volume", "delivery_time"
  minValue: decimal("min_value", { precision: 15, scale: 4 }).notNull(),
  maxValue: decimal("max_value", { precision: 15, scale: 4 }).notNull(),
  targetValue: decimal("target_value", { precision: 15, scale: 4 }).notNull(),
  priority: integer("priority").notNull(), // 1=must have, 2=important, 3=flexible
  unit: text("unit"), // e.g. "EUR", "pieces", "days", "%" (optional for display)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Unique constraint: one dimension name per negotiation
  uniqueDimensionPerNegotiation: unique().on(table.negotiationId, table.name),
}));

// NEW: Personality types from CSV data
export const personalityTypes = pgTable("personality_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  archetype: text("archetype").notNull().unique(), // "Offenheit für Erfahrungen", etc.
  behaviorDescription: text("behavior_description").notNull(), // "verhalten_in_verhandlungen"
  advantages: text("advantages").notNull(), // "vorteile"
  risks: text("risks").notNull(), // "risiken"
  createdAt: timestamp("created_at").defaultNow(),
});

// NEW: Normalized dimension results for efficient querying
export const dimensionResults = pgTable("dimension_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  simulationRunId: uuid("simulation_run_id").references(() => simulationRuns.id, { onDelete: "cascade" }).notNull(),
  dimensionName: text("dimension_name").notNull(), // Links to negotiation_dimensions.name
  finalValue: decimal("final_value", { precision: 15, scale: 4 }).notNull(),
  targetValue: decimal("target_value", { precision: 15, scale: 4 }).notNull(), // Denormalized for performance
  achievedTarget: boolean("achieved_target").notNull(),
  priorityScore: integer("priority_score").notNull(), // How well this addressed the priority level
  improvementOverBatna: decimal("improvement_over_batna", { precision: 15, scale: 4 }), // Improvement vs Best Alternative
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Unique constraint: one result per dimension per simulation run
  uniqueDimensionPerRun: unique().on(table.simulationRunId, table.dimensionName),
}));

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
  simulationRuns: many(simulationRuns),
  performanceMetrics: many(performanceMetrics),
  // NEW: Relations to flexible dimensions and queue
  dimensions: many(negotiationDimensions),
  simulationQueue: one(simulationQueue),
}));

// Simulation Queue Relations
export const simulationQueueRelations = relations(simulationQueue, ({ one, many }) => ({
  negotiation: one(negotiations, {
    fields: [simulationQueue.negotiationId],
    references: [negotiations.id],
  }),
  simulationRuns: many(simulationRuns),
}));

export const simulationRunRelations = relations(simulationRuns, ({ one, many }) => ({
  negotiation: one(negotiations, {
    fields: [simulationRuns.negotiationId],
    references: [negotiations.id],
  }),
  queue: one(simulationQueue, {
    fields: [simulationRuns.queueId],
    references: [simulationQueue.id],
  }),
  technique: one(influencingTechniques, {
    fields: [simulationRuns.techniqueId],
    references: [influencingTechniques.id],
  }),
  tactic: one(negotiationTactics, {
    fields: [simulationRuns.tacticId],
    references: [negotiationTactics.id],
  }),
  rounds: many(negotiationRounds),
  // NEW: Relations to dimension results for efficient querying
  dimensionResults: many(dimensionResults),
}));

export const negotiationContextRelations = relations(negotiationContexts, ({ many }) => ({
  negotiations: many(negotiations),
  zopaConfigurations: many(zopaConfigurations),
}));

export const negotiationRoundRelations = relations(negotiationRounds, ({ one }) => ({
  simulationRun: one(simulationRuns, {
    fields: [negotiationRounds.simulationRunId],
    references: [simulationRuns.id],
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

// NEW: Relations for negotiation dimensions
export const negotiationDimensionRelations = relations(negotiationDimensions, ({ one }) => ({
  negotiation: one(negotiations, {
    fields: [negotiationDimensions.negotiationId],
    references: [negotiations.id],
  }),
}));

// NEW: Relations for dimension results
export const dimensionResultRelations = relations(dimensionResults, ({ one }) => ({
  simulationRun: one(simulationRuns, {
    fields: [dimensionResults.simulationRunId],
    references: [simulationRuns.id],
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

export const insertSimulationRunSchema = createInsertSchema(simulationRuns).omit({
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

// NEW: Insert schemas for new tables
export const insertNegotiationDimensionSchema = createInsertSchema(negotiationDimensions).omit({
  id: true,
  createdAt: true,
});

export const insertPersonalityTypeSchema = createInsertSchema(personalityTypes).omit({
  id: true,
  createdAt: true,
});

export const insertDimensionResultSchema = createInsertSchema(dimensionResults).omit({
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

export type SimulationRun = typeof simulationRuns.$inferSelect;
export type InsertSimulationRun = z.infer<typeof insertSimulationRunSchema>;

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

// NEW: Types for new tables
export type NegotiationDimension = typeof negotiationDimensions.$inferSelect;
export type InsertNegotiationDimension = z.infer<typeof insertNegotiationDimensionSchema>;

export type PersonalityType = typeof personalityTypes.$inferSelect;
export type InsertPersonalityType = z.infer<typeof insertPersonalityTypeSchema>;

export type DimensionResult = typeof dimensionResults.$inferSelect;
export type InsertDimensionResult = z.infer<typeof insertDimensionResultSchema>;

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
