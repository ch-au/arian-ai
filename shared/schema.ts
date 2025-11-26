import { pgTable, pgEnum, uuid, text, boolean, integer, decimal, timestamp, jsonb, unique, index, primaryKey, serial } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// ENUMS
// ============================================================================

export const negotiationStatusEnum = pgEnum("negotiation_status", ["planned", "running", "completed", "aborted"]);
export const agentRoleEnum = pgEnum("agent_role", ["buyer", "seller", "coach", "observer", "other"]);
export const agentKindEnum = pgEnum("agent_kind", ["llm", "rule", "human", "hybrid"]);
export const counterpartKindEnum = pgEnum("counterpart_kind", ["retailer", "manufacturer", "distributor", "other"]);

// ============================================================================
// CORE TABLES - Authentication & Organization
// ============================================================================

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(), // Hashed token
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_refresh_tokens_user").on(table.userId),
  expiresAtIdx: index("idx_refresh_tokens_expires").on(table.expiresAt),
}));

export const registrations = pgTable("registrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organization: text("organization").notNull(),
  company: text("company"),
  country: text("country"),
  negotiationType: text("negotiation_type"),
  negotiationFrequency: text("negotiation_frequency"),
  goals: jsonb("goals").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// MASTER DATA - Markets, Counterparts, Products, Dimensions
// ============================================================================

export const markets = pgTable("markets", {
  id: uuid("id").primaryKey().defaultRandom(),
  registrationId: uuid("registration_id").references(() => registrations.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  region: text("region"),
  countryCode: text("country_code"),
  currencyCode: text("currency_code").notNull(),
  meta: jsonb("meta").notNull().default({}),
});

export const counterparts = pgTable("counterparts", {
  id: uuid("id").primaryKey().defaultRandom(),
  registrationId: uuid("registration_id").references(() => registrations.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  kind: counterpartKindEnum("kind").notNull(),
  powerBalance: decimal("power_balance", { precision: 5, scale: 2 }),
  dominance: decimal("dominance", { precision: 5, scale: 2 }),
  affiliation: decimal("affiliation", { precision: 5, scale: 2 }),
  style: text("style"),
  constraintsMeta: jsonb("constraints_meta").notNull().default({}),
  notes: text("notes"),
});

export const dimensions = pgTable("dimensions", {
  id: uuid("id").primaryKey().defaultRandom(),
  registrationId: uuid("registration_id").references(() => registrations.id, { onDelete: "cascade" }).notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  unit: text("unit"),
  spec: jsonb("spec").notNull().default({}),
}, (table) => ({
  registrationCodeUnique: unique("dimensions_registration_code_unique").on(table.registrationId, table.code),
}));

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  registrationId: uuid("registration_id").references(() => registrations.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  gtin: text("gtin"),
  brand: text("brand"),
  categoryPath: text("category_path"),
  attrs: jsonb("attrs").notNull().default({}),
}, (table) => ({
  registrationGtinUnique: unique("products_registration_gtin_unique").on(table.registrationId, table.gtin),
}));

// ============================================================================
// NEGOTIATION CONFIGURATION
// ============================================================================

export const negotiations = pgTable("negotiations", {
  id: uuid("id").primaryKey().defaultRandom(),
  registrationId: uuid("registration_id").references(() => registrations.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(), // Link to authenticated user
  marketId: uuid("market_id").references(() => markets.id),
  counterpartId: uuid("counterpart_id").references(() => counterparts.id),
  title: text("title").default("Untitled Negotiation"),
  description: text("description"),
  scenario: jsonb("scenario").notNull().default({}),
  status: negotiationStatusEnum("status").notNull().default("planned"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  metadata: jsonb("metadata").notNull().default({}),
  playbook: text("playbook"), // Generated playbook markdown
  playbookGeneratedAt: timestamp("playbook_generated_at", { withTimezone: true }),
});

export const negotiationProducts = pgTable("negotiation_products", {
  negotiationId: uuid("negotiation_id").references(() => negotiations.id, { onDelete: "cascade" }).notNull(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "restrict" }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.negotiationId, table.productId] }),
}));

export const influencingTechniques = pgTable("influencing_techniques", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  beschreibung: text("beschreibung").notNull(),
  anwendung: text("anwendung").notNull(),
  wichtigeAspekte: jsonb("wichtige_aspekte").notNull(),
  keyPhrases: jsonb("key_phrases").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const negotiationTactics = pgTable("negotiation_tactics", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  beschreibung: text("beschreibung").notNull(),
  anwendung: text("anwendung").notNull(),
  wichtigeAspekte: jsonb("wichtige_aspekte").notNull(),
  keyPhrases: jsonb("key_phrases").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const personalityTypes = pgTable("personality_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  archetype: text("archetype").notNull().unique(),
  behaviorDescription: text("behavior_description").notNull(),
  advantages: text("advantages").notNull(),
  risks: text("risks").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  registrationId: uuid("registration_id").references(() => registrations.id, { onDelete: "cascade" }),
  role: agentRoleEnum("role"),
  agentKind: agentKindEnum("agent_kind"),
  modelName: text("model_name"),
  systemPrompt: text("system_prompt"),
  tools: jsonb("tools").notNull().default([]),
  hyperparams: jsonb("hyperparams").notNull().default({}),
  personalityProfile: jsonb("personality_profile").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// SIMULATION EXECUTION
// ============================================================================

export const simulationQueue = pgTable("simulation_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  negotiationId: uuid("negotiation_id").references(() => negotiations.id, { onDelete: "cascade" }).notNull(),
  totalSimulations: integer("total_simulations").notNull(),
  priority: integer("priority").default(0),
  status: text("status").notNull().default("pending"),
  completedCount: integer("completed_count").default(0),
  failedCount: integer("failed_count").default(0),
  runningCount: integer("running_count").default(0),
  pendingCount: integer("pending_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  pausedAt: timestamp("paused_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  estimatedCompletionAt: timestamp("estimated_completion_at", { withTimezone: true }),
  maxConcurrent: integer("max_concurrent").default(1),
  currentConcurrent: integer("current_concurrent").default(0),
  estimatedTotalCost: decimal("estimated_total_cost", { precision: 10, scale: 4 }),
  actualTotalCost: decimal("actual_total_cost", { precision: 10, scale: 4 }).default("0"),
  errorCount: integer("error_count").default(0),
  lastError: text("last_error"),
  crashRecoveryCheckpoint: jsonb("crash_recovery_checkpoint"),
  metadata: jsonb("metadata").default({}),
});

export const simulationRuns = pgTable("simulation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  negotiationId: uuid("negotiation_id").references(() => negotiations.id, { onDelete: "cascade" }),
  queueId: uuid("queue_id").references(() => simulationQueue.id, { onDelete: "cascade" }),
  techniqueId: uuid("technique_id").references(() => influencingTechniques.id),
  tacticId: uuid("tactic_id").references(() => negotiationTactics.id),
  personalityId: text("personality_id"),
  zopaDistance: text("zopa_distance"),
  status: text("status").notNull().default("pending"),
  outcome: text("outcome"),
  outcomeReason: text("outcome_reason"),
  totalRounds: integer("total_rounds"),
  runNumber: integer("run_number"),
  executionOrder: integer("execution_order"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  dealValue: decimal("deal_value", { precision: 15, scale: 2 }),
  otherDimensions: jsonb("other_dimensions").notNull().default({}),
  conversationLog: jsonb("conversation_log").notNull().default([]),
  actualCost: decimal("actual_cost", { precision: 10, scale: 4 }),
  costEfficiencyScore: decimal("cost_efficiency_score", { precision: 10, scale: 4 }),
  techniqueEffectivenessScore: decimal("technique_effectiveness_score", { precision: 5, scale: 2 }),
  tacticEffectivenessScore: decimal("tactic_effectiveness_score", { precision: 5, scale: 2 }),
  tacticalSummary: text("tactical_summary"),
  langfuseTraceId: text("langfuse_trace_id"),
  metadata: jsonb("metadata").default({}),
});

// ============================================================================
// RESULTS & ANALYTICS
// ============================================================================

export const dimensionResults = pgTable("dimension_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  simulationRunId: uuid("simulation_run_id").references(() => simulationRuns.id, { onDelete: "cascade" }).notNull(),
  dimensionName: text("dimension_name").notNull(),
  finalValue: decimal("final_value", { precision: 15, scale: 4 }).notNull(),
  targetValue: decimal("target_value", { precision: 15, scale: 4 }).notNull(),
  achievedTarget: boolean("achieved_target").notNull(),
  priorityScore: integer("priority_score").notNull(),
  improvementOverBatna: decimal("improvement_over_batna", { precision: 15, scale: 4 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueDimensionPerRun: unique("dimension_results_unique_run_dimension").on(table.simulationRunId, table.dimensionName),
}));

export const productResults = pgTable("product_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  simulationRunId: uuid("simulation_run_id").references(() => simulationRuns.id, { onDelete: "cascade" }).notNull(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "restrict" }).notNull(),
  productName: text("product_name").notNull(),
  targetPrice: decimal("target_price", { precision: 15, scale: 2 }).notNull(),
  minMaxPrice: decimal("min_max_price", { precision: 15, scale: 2 }).notNull(),
  estimatedVolume: integer("estimated_volume").notNull(),
  agreedPrice: decimal("agreed_price", { precision: 15, scale: 2 }).notNull(),
  priceVsTarget: decimal("price_vs_target", { precision: 10, scale: 2 }),
  absoluteDeltaFromTarget: decimal("absolute_delta_from_target", { precision: 15, scale: 4 }),
  priceVsMinMax: decimal("price_vs_min_max", { precision: 10, scale: 2 }),
  absoluteDeltaFromMinMax: decimal("absolute_delta_from_min_max", { precision: 15, scale: 4 }),
  withinZopa: boolean("within_zopa").default(true),
  zopaUtilization: decimal("zopa_utilization", { precision: 5, scale: 2 }),
  subtotal: decimal("subtotal", { precision: 15, scale: 2 }).notNull(),
  targetSubtotal: decimal("target_subtotal", { precision: 15, scale: 2 }).notNull(),
  deltaFromTargetSubtotal: decimal("delta_from_target_subtotal", { precision: 15, scale: 2 }),
  performanceScore: decimal("performance_score", { precision: 5, scale: 2 }),
  dimensionKey: text("dimension_key"),
  negotiationRound: integer("negotiation_round"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  metadata: jsonb("metadata").default({}),
}, (table) => ({
  simulationRunIndex: index("product_results_simulation_run_idx").on(table.simulationRunId),
  productIndex: index("product_results_product_idx").on(table.productId),
}));

// ============================================================================
// SCHEMAS & TYPES
// ============================================================================

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInfluencingTechniqueSchema = createInsertSchema(influencingTechniques).omit({
  id: true,
  createdAt: true,
});

export const insertNegotiationTacticSchema = createInsertSchema(negotiationTactics).omit({
  id: true,
  createdAt: true,
});

export const personalityProfileSchema = z.object({
  openness: z.number().min(0).max(1),
  conscientiousness: z.number().min(0).max(1),
  extraversion: z.number().min(0).max(1),
  agreeableness: z.number().min(0).max(1),
  neuroticism: z.number().min(0).max(1),
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = typeof refreshTokens.$inferInsert;

export type Registration = typeof registrations.$inferSelect;
export type InsertRegistration = typeof registrations.$inferInsert;

export type Market = typeof markets.$inferSelect;
export type InsertMarket = typeof markets.$inferInsert;

export type Counterpart = typeof counterparts.$inferSelect;
export type InsertCounterpart = typeof counterparts.$inferInsert;

export type Dimension = typeof dimensions.$inferSelect;
export type InsertDimension = typeof dimensions.$inferInsert;

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

export type Negotiation = typeof negotiations.$inferSelect;
export type InsertNegotiation = typeof negotiations.$inferInsert;

export type SimulationQueue = typeof simulationQueue.$inferSelect;
export type InsertSimulationQueue = typeof simulationQueue.$inferInsert;

export type SimulationRun = typeof simulationRuns.$inferSelect;
export type InsertSimulationRun = typeof simulationRuns.$inferInsert;

export type DimensionResult = typeof dimensionResults.$inferSelect;
export type InsertDimensionResult = typeof dimensionResults.$inferInsert;

export type ProductResult = typeof productResults.$inferSelect;
export type InsertProductResult = typeof productResults.$inferInsert;

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;

export type InfluencingTechnique = typeof influencingTechniques.$inferSelect;
export type InsertInfluencingTechnique = z.infer<typeof insertInfluencingTechniqueSchema>;

export type NegotiationTactic = typeof negotiationTactics.$inferSelect;
export type InsertNegotiationTactic = z.infer<typeof insertNegotiationTacticSchema>;

export type PersonalityType = typeof personalityTypes.$inferSelect;
export type InsertPersonalityType = typeof personalityTypes.$inferInsert;

export type PersonalityProfile = z.infer<typeof personalityProfileSchema>;
