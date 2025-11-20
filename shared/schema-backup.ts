import { pgTable, pgEnum, uuid, text, boolean, integer, decimal, timestamp, jsonb, unique, index, primaryKey, serial } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sideEnum = pgEnum("side", ["buyer", "seller"]);
export const negotiationStatusEnum = pgEnum("negotiation_status", ["planned", "running", "completed", "aborted"]);
export const agentRoleEnum = pgEnum("agent_role", ["buyer", "seller", "coach", "observer", "other"]);
export const agentKindEnum = pgEnum("agent_kind", ["llm", "rule", "human", "hybrid"]);
export const valueKindEnum = pgEnum("value_kind", ["integer", "numeric", "text", "boolean", "json"]);
export const eventKindEnum = pgEnum("event_kind", ["message", "action", "tool"]);
export const counterpartKindEnum = pgEnum("counterpart_kind", ["retailer", "manufacturer", "distributor", "other"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

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
  style: text("style"),
  constraintsMeta: jsonb("constraints_meta").notNull().default({}),
  notes: text("notes"),
});

export const dimensions = pgTable("dimensions", {
  id: uuid("id").primaryKey().defaultRandom(),
  registrationId: uuid("registration_id").references(() => registrations.id, { onDelete: "cascade" }).notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  valueType: valueKindEnum("value_type").notNull(),
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

export const productDimensionValues = pgTable("product_dimension_values", {
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  dimensionId: uuid("dimension_id").references(() => dimensions.id, { onDelete: "cascade" }).notNull(),
  value: jsonb("value").notNull(),
  measuredAt: timestamp("measured_at", { withTimezone: true }).defaultNow().notNull(),
  source: text("source"),
  isCurrent: boolean("is_current").default(true),
}, (table) => ({
  pk: primaryKey({ columns: [table.productId, table.dimensionId, table.measuredAt] }),
  dimensionIndex: index("product_dimension_values_dimension_idx").on(table.dimensionId),
}));

export const negotiations = pgTable("negotiations", {
  id: uuid("id").primaryKey().defaultRandom(),
  registrationId: uuid("registration_id").references(() => registrations.id, { onDelete: "cascade" }).notNull(),
  marketId: uuid("market_id").references(() => markets.id),
  counterpartId: uuid("counterpart_id").references(() => counterparts.id),
  title: text("title").default("Untitled Negotiation"),
  description: text("description"),
  scenario: jsonb("scenario").notNull().default({}),
  status: negotiationStatusEnum("status").notNull().default("planned"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  metadata: jsonb("metadata").notNull().default({}),
});

export const negotiationProducts = pgTable("negotiation_products", {
  negotiationId: uuid("negotiation_id").references(() => negotiations.id, { onDelete: "cascade" }).notNull(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "restrict" }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.negotiationId, table.productId] }),
}));

export const negotiationRounds = pgTable("negotiation_rounds", {
  id: uuid("id").primaryKey().defaultRandom(),
  negotiationId: uuid("negotiation_id").references(() => negotiations.id, { onDelete: "cascade" }).notNull(),
  roundNumber: integer("round_number").notNull(),
  state: jsonb("state").notNull().default({}),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
}, (table) => ({
  uniqueRound: unique("negotiation_rounds_unique_round").on(table.negotiationId, table.roundNumber),
}));

export const roundStates = pgTable("round_states", {
  id: uuid("id").primaryKey().defaultRandom(),
  roundId: uuid("round_id").references(() => negotiationRounds.id, { onDelete: "cascade" }).notNull(),
  beliefs: jsonb("beliefs").notNull().default({}),
  intentions: text("intentions"),
  internalAnalysis: text("internal_analysis"),
  batnaAssessment: decimal("batna_assessment", { precision: 5, scale: 2 }),
  walkAwayThreshold: decimal("walk_away_threshold", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueRoundState: unique("round_states_unique_round").on(table.roundId),
}));

export const simulations = pgTable("simulations", {
  id: uuid("id").primaryKey().defaultRandom(),
  registrationId: uuid("registration_id").references(() => registrations.id, { onDelete: "cascade" }).notNull(),
  negotiationId: uuid("negotiation_id").references(() => negotiations.id, { onDelete: "cascade" }),
  name: text("name"),
  settings: jsonb("settings").notNull().default({}),
  numRounds: integer("num_rounds"),
  seed: integer("seed"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const simulationQueue = pgTable("simulation_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  negotiationId: uuid("negotiation_id").references(() => negotiations.id, { onDelete: "cascade" }).notNull(),
  simulationId: uuid("simulation_id").references(() => simulations.id, { onDelete: "cascade" }),
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

export const simulationRuns = pgTable("simulation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  negotiationId: uuid("negotiation_id").references(() => negotiations.id, { onDelete: "cascade" }),
  simulationId: uuid("simulation_id").references(() => simulations.id, { onDelete: "cascade" }),
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

export const policies = pgTable("policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: text("kind"),
  config: jsonb("config").notNull().default({}),
});

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  registrationId: uuid("registration_id").references(() => registrations.id, { onDelete: "cascade" }),
  simulationId: uuid("simulation_id").references(() => simulations.id, { onDelete: "cascade" }),
  role: agentRoleEnum("role"),
  agentKind: agentKindEnum("agent_kind"),
  modelName: text("model_name"),
  systemPrompt: text("system_prompt"),
  tools: jsonb("tools").notNull().default([]),
  policyId: uuid("policy_id").references(() => policies.id),
  hyperparams: jsonb("hyperparams").notNull().default({}),
  personalityProfile: jsonb("personality_profile").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const agentMetrics = pgTable("agent_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }).notNull(),
  metricName: text("metric_name").notNull(),
  metricValue: decimal("metric_value", { precision: 10, scale: 4 }),
  details: jsonb("details").default({}),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
});

export const interactions = pgTable("interactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  roundId: uuid("round_id").references(() => negotiationRounds.id, { onDelete: "cascade" }).notNull(),
  stepNo: integer("step_no"),
  agentId: uuid("agent_id").references(() => agents.id),
  observation: jsonb("observation").notNull().default({}),
  reward: decimal("reward", { precision: 10, scale: 4 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  roundId: uuid("round_id").references(() => negotiationRounds.id, { onDelete: "cascade" }).notNull(),
  eventKind: eventKindEnum("event_kind").notNull(),
  role: text("role"),
  agentId: uuid("agent_id").references(() => agents.id),
  name: text("name"),
  parameters: jsonb("parameters").notNull().default({}),
  observations: jsonb("observations").notNull().default({}),
  reasoning: text("reasoning"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const offers = pgTable("offers", {
  id: uuid("id").primaryKey().defaultRandom(),
  roundId: uuid("round_id").references(() => negotiationRounds.id, { onDelete: "cascade" }).notNull(),
  side: sideEnum("side").notNull(),
  agentId: uuid("agent_id").references(() => agents.id),
  price: decimal("price", { precision: 15, scale: 2 }),
  quantity: decimal("quantity", { precision: 15, scale: 2 }),
  currencyCode: text("currency_code"),
  unit: text("unit"),
  terms: jsonb("terms").notNull().default({}),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  accepted: boolean("accepted").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const concessions = pgTable("concessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  offerId: uuid("offer_id").references(() => offers.id, { onDelete: "cascade" }).notNull(),
  fieldPath: text("field_path"),
  beforeValue: jsonb("before_value"),
  afterValue: jsonb("after_value"),
});

export const benchmarks = pgTable("benchmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  dataset: jsonb("dataset").notNull().default({}),
});

export const experiments = pgTable("experiments", {
  id: uuid("id").primaryKey().defaultRandom(),
  benchmarkId: uuid("benchmark_id").references(() => benchmarks.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  hypothesis: text("hypothesis"),
  design: jsonb("design").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const experimentRuns = pgTable("experiment_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  experimentId: uuid("experiment_id").references(() => experiments.id, { onDelete: "cascade" }).notNull(),
  simulationId: uuid("simulation_id").references(() => simulations.id, { onDelete: "set null" }),
  batchLabel: text("batch_label"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  metrics: jsonb("metrics").notNull().default({}),
  resultSummary: text("result_summary"),
});

export const analyticsSessions = pgTable("analytics_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionName: text("session_name").notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).defaultNow(),
  endTime: timestamp("end_time", { withTimezone: true }),
  totalNegotiations: integer("total_negotiations").default(0),
  successfulNegotiations: integer("successful_negotiations").default(0),
  averageDuration: integer("average_duration_ms"),
  totalApiCost: decimal("total_api_cost", { precision: 10, scale: 4 }),
  metadata: jsonb("metadata"),
});

export const performanceMetrics = pgTable("performance_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  negotiationId: uuid("negotiation_id").references(() => negotiations.id, { onDelete: "set null" }),
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
  tacticId: uuid("tactic_id").references(() => negotiationTactics.id, { onDelete: "set null" }),
  effectivenessScore: decimal("effectiveness_score", { precision: 5, scale: 2 }),
  responseTime: integer("response_time_ms"),
  apiTokensUsed: integer("api_tokens_used"),
  apiCost: decimal("api_cost", { precision: 8, scale: 4 }),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
});

export const personalityTypes = pgTable("personality_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  archetype: text("archetype").notNull().unique(),
  behaviorDescription: text("behavior_description").notNull(),
  advantages: text("advantages").notNull(),
  risks: text("risks").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

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

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

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

export type ProductDimensionValue = typeof productDimensionValues.$inferSelect;
export type InsertProductDimensionValue = typeof productDimensionValues.$inferInsert;

export type Negotiation = typeof negotiations.$inferSelect;
export type InsertNegotiation = typeof negotiations.$inferInsert;

export type NegotiationRound = typeof negotiationRounds.$inferSelect;
export type InsertNegotiationRound = typeof negotiationRounds.$inferInsert;

export type RoundState = typeof roundStates.$inferSelect;
export type InsertRoundState = typeof roundStates.$inferInsert;

export type Simulation = typeof simulations.$inferSelect;
export type InsertSimulation = typeof simulations.$inferInsert;

export type SimulationQueue = typeof simulationQueue.$inferSelect;
export type InsertSimulationQueue = typeof simulationQueue.$inferInsert;

export type SimulationRun = typeof simulationRuns.$inferSelect;
export type InsertSimulationRun = typeof simulationRuns.$inferInsert;

export type DimensionResult = typeof dimensionResults.$inferSelect;
export type InsertDimensionResult = typeof dimensionResults.$inferInsert;

export type ProductResult = typeof productResults.$inferSelect;
export type InsertProductResult = typeof productResults.$inferInsert;

export type Policy = typeof policies.$inferSelect;
export type InsertPolicy = typeof policies.$inferInsert;

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;

export type AgentMetric = typeof agentMetrics.$inferSelect;
export type InsertAgentMetric = typeof agentMetrics.$inferInsert;

export type Interaction = typeof interactions.$inferSelect;
export type InsertInteraction = typeof interactions.$inferInsert;

export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;

export type Offer = typeof offers.$inferSelect;
export type InsertOffer = typeof offers.$inferInsert;

export type Concession = typeof concessions.$inferSelect;
export type InsertConcession = typeof concessions.$inferInsert;

export type Benchmark = typeof benchmarks.$inferSelect;
export type InsertBenchmark = typeof benchmarks.$inferInsert;

export type Experiment = typeof experiments.$inferSelect;
export type InsertExperiment = typeof experiments.$inferInsert;

export type ExperimentRun = typeof experimentRuns.$inferSelect;
export type InsertExperimentRun = typeof experimentRuns.$inferInsert;

export type AnalyticsSession = typeof analyticsSessions.$inferSelect;
export type InsertAnalyticsSession = typeof analyticsSessions.$inferInsert;

export type PerformanceMetric = typeof performanceMetrics.$inferSelect;
export type InsertPerformanceMetric = typeof performanceMetrics.$inferInsert;

export type InfluencingTechnique = typeof influencingTechniques.$inferSelect;
export type InsertInfluencingTechnique = z.infer<typeof insertInfluencingTechniqueSchema>;

export type NegotiationTactic = typeof negotiationTactics.$inferSelect;
export type InsertNegotiationTactic = z.infer<typeof insertNegotiationTacticSchema>;

export type PersonalityType = typeof personalityTypes.$inferSelect;
export type InsertPersonalityType = typeof personalityTypes.$inferInsert;

export type PersonalityProfile = z.infer<typeof personalityProfileSchema>;
