# Database Schema Redesign - Negotiation Results

## Executive Summary

**✅ REVIEWED & APPROVED** - Ready for implementation with fresh DB reset

### Key Changes Based on Review:

1. **✅ Preserve Static Data**
   - Keep `influencingTechniques` and `negotiationTactics` tables EXACTLY as-is
   - Export/import seed data during DB reset
   - No schema changes to these tables

2. **✅ Products Scoped Per Negotiation**
   - Products belong to ONE negotiation (no cross-negotiation matching)
   - Same product name in different negotiations = separate records
   - Simplified queries and relationships

3. **✅ Remove ALL Legacy Fields**
   - NO backward compatibility needed
   - Optimized for future, clean slate
   - Removed: `dimensionResults`, `finalAgreement`, `finalTerms`, `personalityArchetype`

4. **✅ Track Distance from Optimal Values**
   - Multiple metrics per product: `absoluteDeltaFromTarget`, `priceVsTarget`, `zopaUtilization`
   - Monetary impact: `deltaFromTargetSubtotal`
   - Performance score: 0-100 rating

### Problems Solved:
- ❌ **OLD**: Product-level results mixed with other dimensions in JSON
- ✅ **NEW**: Normalized `productResults` table with one row per product per run

- ❌ **OLD**: Deal value = guessing which JSON keys are prices
- ✅ **NEW**: Deal value = `SUM(productResults.subtotal)` - simple, reliable

- ❌ **OLD**: No visibility into how far from target we landed
- ✅ **NEW**: Full tracking of distance metrics, ZOPA utilization, performance scores

- ❌ **OLD**: Legacy fields cluttering schema
- ✅ **NEW**: Clean, optimized schema for analysis and future growth

---

## Complete Schema Overview

### Entity Relationship Diagram

```
┌─────────────────────┐
│ influencingTechniques│ (Static Reference Data)
│ - id, name, desc    │
└─────────────────────┘
         │
         │ (referenced by)
         ▼
┌─────────────────────┐       ┌─────────────────────┐
│ negotiationTactics  │       │  contexts           │ (Static/Config Data)
│ - id, name, desc    │       │ - id, name, desc    │
└─────────────────────┘       └─────────────────────┘
         │                             │
         │                             │
         │                             ▼
         │                    ┌─────────────────────┐
         │                    │   negotiations      │ (Master Record)
         │                    │ - id, title, status │
         │                    │ - aggregated metrics│
         │                    └─────────────────────┘
         │                             │
         │                             │ 1:N
         │                             ▼
         │                    ┌─────────────────────┐
         │           ┌────────│  simulationQueue    │ (Queue Management)
         │           │        │ - id, status, config│
         │           │        └─────────────────────┘
         │           │                 │
         │           │                 │ 1:N
         │           │                 ▼
         └───────────┼────────►┌─────────────────────┐
                     │         │  simulationRuns     │ (Individual Execution)
                     │         │ - technique×tactic  │
                     │         │ - outcome, metrics  │
                     │         └─────────────────────┘
                     │                 │
                     │                 │ 1:N
                     │                 ▼
                     │         ┌─────────────────────┐
                     └────────►│  products           │ (Config: Per Negotiation)
                               │ - name, target, vol │
                               └─────────────────────┘
                                        │
                                        │ 1:N (results per run)
                                        ▼
                               ┌─────────────────────┐
                               │  productResults     │ (Results: Per Run)
                               │ - agreed price      │
                               │ - subtotal, delta   │
                               └─────────────────────┘
```

---

## Static Reference Data Tables

These tables contain the master data for techniques, tactics, and contexts. They are NOT modified per negotiation.

### `influencingTechniques` Table (Static - PRESERVE EXACTLY)
**Purpose**: Master list of psychological influencing techniques

**✅ KEEP CURRENT SCHEMA - Do NOT modify:**
```typescript
export const influencingTechniques = pgTable("influencing_techniques", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  beschreibung: text("beschreibung").notNull(),
  anwendung: text("anwendung").notNull(),
  wichtigeAspekte: jsonb("wichtige_aspekte").notNull(),
  keyPhrases: jsonb("key_phrases").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**⚠️ IMPORTANT**: Preserve ALL seed data from this table during DB reset.

### `negotiationTactics` Table (Static - PRESERVE EXACTLY)
**Purpose**: Master list of negotiation tactics/strategies

**✅ KEEP CURRENT SCHEMA - Do NOT modify:**
```typescript
export const negotiationTactics = pgTable("negotiation_tactics", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  beschreibung: text("beschreibung").notNull(),
  anwendung: text("anwendung").notNull(),
  wichtigeAspekte: jsonb("wichtige_aspekte").notNull(),
  keyPhrases: jsonb("key_phrases").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**⚠️ IMPORTANT**: Preserve ALL seed data from this table during DB reset.

### `contexts` Table (Static/Config)
**Purpose**: Reusable negotiation context templates

```typescript
export const contexts = pgTable("contexts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  industry: text("industry"), // "retail", "manufacturing", "services", etc.

  // Template data
  productInfo: jsonb("product_info"),
  marketConditions: jsonb("market_conditions"),
  baselineValues: jsonb("baseline_values"),

  // Usage tracking
  usageCount: integer("usage_count").default(0),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isActive: boolean("is_active").default(true),
});
```

---

## Queue Management

### `simulationQueue` Table
**Purpose**: Manage batch execution of simulation runs

```typescript
export const simulationQueue = pgTable("simulation_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  negotiationId: uuid("negotiation_id")
    .references(() => negotiations.id, { onDelete: "cascade" })
    .notNull(),

  // Queue Configuration
  totalRuns: integer("total_runs").notNull(), // Total N×M combinations
  priority: integer("priority").default(0),

  // Execution Status
  status: text("status").notNull().default("pending"),
  // Values: "pending", "running", "paused", "completed", "cancelled", "failed"

  // Progress Tracking
  completedRuns: integer("completed_runs").default(0),
  failedRuns: integer("failed_runs").default(0),
  runningRuns: integer("running_runs").default(0),
  pendingRuns: integer("pending_runs").default(0),

  // Timing
  createdAt: timestamp("created_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  estimatedCompletionAt: timestamp("estimated_completion_at"),

  // Resource Management
  maxConcurrent: integer("max_concurrent").default(1),
  currentConcurrent: integer("current_concurrent").default(0),

  // Cost Tracking
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 4 }),
  actualCost: decimal("actual_cost", { precision: 10, scale: 4 }),

  // Error Handling
  errorCount: integer("error_count").default(0),
  lastError: text("last_error"),

  metadata: jsonb("metadata").default({}),
});
```

---

## Proposed Schema Changes

### 1. Enhanced `negotiations` Table (Master Record)

**Purpose**: Track overall negotiation configuration and high-level outcomes

```typescript
export const negotiations = pgTable("negotiations", {
  // === EXISTING FIELDS (Keep) ===
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  contextId: uuid("context_id").references(() => contexts.id),
  userRole: text("user_role").notNull(), // "buyer" or "seller"
  negotiationType: text("negotiation_type").notNull(), // "one-shot", "multi-round", "iterative"

  // Configuration
  maxRounds: integer("max_rounds").default(10),
  counterpartStrategy: text("counterpart_strategy"),
  productMarketDescription: text("product_market_description"),
  marketIntelligence: jsonb("market_intelligence"), // Array of insights

  // === NEW OUTCOME FIELDS ===
  // Overall Status
  overallStatus: text("overall_status").default("pending"),
  // Values: "pending", "in_progress", "completed", "cancelled", "partially_completed"

  // High-level Results (aggregated from all simulation runs)
  totalSimulationRuns: integer("total_simulation_runs").default(0),
  completedRuns: integer("completed_runs").default(0),
  successfulDeals: integer("successful_deals").default(0), // Runs where deal was accepted
  averageDealValue: decimal("average_deal_value", { precision: 15, scale: 2 }),
  bestDealValue: decimal("best_deal_value", { precision: 15, scale: 2 }),
  worstDealValue: decimal("worst_deal_value", { precision: 15, scale: 2 }),

  // Tactical Analysis Summary
  mostEffectiveTechnique: uuid("most_effective_technique").references(() => influencingTechniques.id),
  mostEffectiveTactic: uuid("most_effective_tactic").references(() => negotiationTactics.id),
  averageRoundsToCompletion: decimal("average_rounds_to_completion", { precision: 5, 2 }),

  // Cost Tracking
  totalCost: decimal("total_cost", { precision: 10, scale: 4 }), // Sum of all API costs

  // Timestamps
  startedAt: timestamp("started_at"), // When first simulation started
  completedAt: timestamp("completed_at"), // When all simulations completed

  // Meta
  notes: text("notes"), // User notes/observations
  metadata: jsonb("metadata").default({}),
});
```

---

### 2. Enhanced `simulationRuns` Table (Individual Runs)

**Purpose**: Track each technique×tactic combination execution with detailed outcomes

```typescript
export const simulationRuns = pgTable("simulation_runs", {
  // === EXISTING FIELDS (Keep) ===
  id: uuid("id").primaryKey().defaultRandom(),
  negotiationId: uuid("negotiation_id").references(() => negotiations.id, { onDelete: "cascade" }),
  queueId: uuid("queue_id").references(() => simulationQueue.id, { onDelete: "cascade" }),
  runNumber: integer("run_number").notNull(),
  executionOrder: integer("execution_order"),

  // Configuration (what was tested)
  techniqueId: uuid("technique_id").references(() => influencingTechniques.id),
  tacticId: uuid("tactic_id").references(() => negotiationTactics.id),
  personalityId: text("personality_id"),
  zopaDistance: text("zopa_distance"),

  // Execution Status
  status: text("status").notNull().default("pending"),
  // Values: "pending", "running", "completed", "failed", "timeout", "paused"

  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  estimatedDuration: integer("estimated_duration"),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),

  // === NEW/ENHANCED OUTCOME FIELDS ===

  // Negotiation Outcome
  outcome: text("outcome").notNull(),
  // Values: "DEAL_ACCEPTED", "WALK_AWAY", "TERMINATED", "PAUSED", "MAX_ROUNDS_REACHED", "ERROR"

  outcomeReason: text("outcome_reason"),
  // Why did it end? "Both parties agreed", "Buyer walked away - price too high", etc.

  // Process Metrics
  totalRounds: integer("total_rounds").default(0),
  avgResponseTimeMs: integer("avg_response_time_ms"),

  // Financial Results
  dealValue: decimal("deal_value", { precision: 15, scale: 2 }),
  // CALCULATED: SUM of all product subtotals (price × volume)

  actualCost: decimal("actual_cost", { precision: 10, scale: 4 }),
  // API cost for this run

  costEfficiencyScore: decimal("cost_efficiency_score", { precision: 10, scale: 4 }),
  // dealValue / actualCost (ROI metric)

  // Success Metrics
  zopaAchieved: boolean("zopa_achieved").default(false),
  // Did we stay within user's acceptable range?

  successScore: decimal("success_score", { precision: 5, scale: 2 }),
  // 0-100: How well did we do vs target? (100 = hit target exactly)

  dealValueVsTarget: decimal("deal_value_vs_target", { precision: 10, scale: 2 }),
  // Percentage: +15% = 15% better than target, -10% = 10% worse

  // Tactical Effectiveness
  techniqueEffectivenessScore: decimal("technique_effectiveness_score", { precision: 5, scale: 2 }),
  // 0-100: How effective was the influencing technique?

  tacticEffectivenessScore: decimal("tactic_effectiveness_score", { precision: 5, scale: 2 }),
  // 0-100: How effective was the negotiation tactic?

  tacticalSummary: text("tactical_summary"),
  // AI-generated: "Authority technique with aggressive tactic achieved 95% of target in 4 rounds..."

  // Detailed Results Storage
  conversationLog: jsonb("conversation_log").default([]).notNull(),
  // Array of { round, agent, message, offer }

  otherDimensions: jsonb("other_dimensions").default({}).notNull(),
  // NON-PRICE negotiated terms: { "Zahlungskonditionen": 30, "Vertragslaufzeit": 24, "Lieferzeit": 14 }

  // Recovery & Debugging
  crashRecoveryData: jsonb("crash_recovery_data"),
  langfuseTraceId: text("langfuse_trace_id"),
  metadata: jsonb("metadata").default({}),
});
```

**🗑️ REMOVED LEGACY FIELDS** (optimized for fresh start, no backward compatibility needed):
- ~~`dimensionResults`~~ - replaced by `productResults` table + `otherDimensions`
- ~~`finalAgreement`~~ - redundant with `productResults` + `otherDimensions`
- ~~`finalTerms`~~ - redundant with `productResults` + `otherDimensions`
- ~~`personalityArchetype`~~ - not used in current implementation

**Rationale**: Clean schema, all data properly normalized in `productResults` table.
```

---

### 3. NEW `productResults` Table (Product-Level Outcomes)

**Purpose**: Store negotiated price for each product with calculated deal value contribution

```typescript
export const productResults = pgTable("product_results", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Relationships
  simulationRunId: uuid("simulation_run_id")
    .references(() => simulationRuns.id, { onDelete: "cascade" })
    .notNull(),

  productId: uuid("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),

  // Configuration (from products table - denormalized for easy access)
  productName: text("product_name").notNull(), // "Oreo Kleinkekse 200g"
  targetPrice: decimal("target_price", { precision: 15, scale: 4 }).notNull(), // User's target
  minMaxPrice: decimal("min_max_price", { precision: 15, scale: 4 }).notNull(), // User's min/max
  estimatedVolume: integer("estimated_volume").notNull(), // Fixed volume from config

  // Negotiation Results
  agreedPrice: decimal("agreed_price", { precision: 15, scale: 4 }).notNull(),
  // The final price achieved in negotiation

  // Distance from Optimal Values (KEY INSIGHT METRICS)
  priceVsTarget: decimal("price_vs_target", { precision: 10, scale: 2 }),
  // Percentage difference from target:
  // - Buyer: +5% = 5% worse (paid MORE than target), -5% = 5% better (paid LESS)
  // - Seller: +5% = 5% better (sold for MORE), -5% = 5% worse (sold for LESS)

  absoluteDeltaFromTarget: decimal("absolute_delta_from_target", { precision: 15, scale: 4 }),
  // Absolute currency difference: agreedPrice - targetPrice
  // Example: agreed €1.05, target €1.00 → delta = €0.05

  priceVsMinMax: decimal("price_vs_min_max", { precision: 10, scale: 2 }),
  // Percentage from boundary (min for seller, max for buyer)
  // 0% = at boundary, positive = within ZOPA, negative = outside ZOPA

  absoluteDeltaFromMinMax: decimal("absolute_delta_from_min_max", { precision: 15, scale: 4 }),
  // Absolute currency difference from min/max boundary

  withinZopa: boolean("within_zopa").default(true),
  // TRUE if agreed price is within [zielPreis, minMaxPreis] range

  zopaUtilization: decimal("zopa_utilization", { precision: 5, scale: 2 }),
  // Percentage of ZOPA range used (0-100%)
  // Example: ZOPA [1.00, 1.20], agreed 1.05 → 25% utilization
  // Helps understand how much negotiation room was used

  // Deal Value Calculation
  subtotal: decimal("subtotal", { precision: 15, scale: 2 }).notNull(),
  // CALCULATED: agreedPrice × estimatedVolume

  targetSubtotal: decimal("target_subtotal", { precision: 15, scale: 2 }).notNull(),
  // CALCULATED: targetPrice × estimatedVolume (what we aimed for)

  deltaFromTargetSubtotal: decimal("delta_from_target_subtotal", { precision: 15, scale: 2 }),
  // CALCULATED: subtotal - targetSubtotal
  // Shows the monetary impact of negotiation variance
  // Example: agreed €105,000, target €100,000 → delta = €5,000 (overpaid)

  // Performance Score
  performanceScore: decimal("performance_score", { precision: 5, scale: 2 }),
  // 0-100 score: How well did we do on this product?
  // 100 = hit target exactly, <100 = worse than target, >100 = better than target (rare)

  // Meta
  dimensionKey: text("dimension_key"),
  // The key used in dimension_values (e.g., "Oreo Kleinkekse 200g Price")

  negotiationRound: integer("negotiation_round"),
  // Which round was this price agreed in? (useful for round-by-round analysis)

  createdAt: timestamp("created_at").defaultNow(),
  metadata: jsonb("metadata").default({}),
});

// Indexes for performance
export const productResultsSimulationRunIdIdx = index("product_results_simulation_run_id_idx")
  .on(productResults.simulationRunId);

export const productResultsProductIdIdx = index("product_results_product_id_idx")
  .on(productResults.productId);
```

---

### 4. Enhanced `products` Table (Configuration)

**Purpose**: Store product configuration for Phase 2 negotiations

**⚠️ SCOPING**: Products are scoped PER NEGOTIATION. Even if two negotiations have "Oreo Kleinkekse 200g", they are separate product records with different target prices and volumes. No matching needed across negotiations.

```typescript
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),

  negotiationId: uuid("negotiation_id")
    .references(() => negotiations.id, { onDelete: "cascade" })
    .notNull(),
  // ⚠️ Products belong to ONE negotiation - cascade delete when negotiation is deleted

  // Product Info
  produktName: text("produkt_name").notNull(),
  // Name can be duplicated across different negotiations - NO uniqueness constraint

  // Target Pricing (User's Goals)
  zielPreis: decimal("ziel_preis", { precision: 15, scale: 4 }).notNull(),
  // User's target price (ideal outcome)

  minMaxPreis: decimal("min_max_preis", { precision: 15, scale: 4 }).notNull(),
  // User's min (seller) or max (buyer) acceptable price

  // Volume Configuration
  geschätztesVolumen: integer("geschätztes_volumen").notNull(),
  // Estimated/planned volume (FIXED - not negotiated!)

  // Meta
  createdAt: timestamp("created_at").defaultNow(),
  description: text("description"), // Optional product description
  category: text("category"), // Optional category (e.g., "Süßwaren", "Gebäck")
  sku: text("sku"), // Optional SKU/article number
  metadata: jsonb("metadata").default({}),
});
```

**Example**:
- Negotiation A: "Oreo Kleinkekse 200g" with target €1.00, volume 100,000
- Negotiation B: "Oreo Kleinkekse 200g" with target €1.10, volume 50,000
- These are TWO SEPARATE product records, no relationship between them

---

## Data Flow Example

### Configuration Phase:
```typescript
// User creates negotiation with products
negotiation = {
  id: "neg-123",
  title: "Süßwaren Q1 2025",
  userRole: "buyer",
  products: [
    { produktName: "Oreo Kleinkekse 200g", zielPreis: 1.00, minMaxPreis: 1.20, geschätztesVolumen: 100000 },
    { produktName: "Oreo x Milka 100g Tafel", zielPreis: 0.40, minMaxPreis: 0.70, geschätztesVolumen: 50000 }
  ]
}
```

### Execution Phase:
```typescript
// Simulation run executes
simulationRun = {
  id: "run-456",
  negotiationId: "neg-123",
  techniqueId: "tech-1",
  tacticId: "tactic-1",
  status: "running"
}

// Python agent negotiates and returns:
pythonResult = {
  outcome: "DEAL_ACCEPTED",
  totalRounds: 4,
  finalOffer: {
    dimension_values: {
      "Oreo Kleinkekse 200g Price": 1.05,
      "Oreo x Milka 100g Tafel Price": 0.55,
      "Zahlungskonditionen": 30,
      "Vertragslaufzeit": 24
    }
  }
}
```

### Storage Phase:
```typescript
// 1. Update simulationRun with results
UPDATE simulation_runs SET
  outcome = "DEAL_ACCEPTED",
  totalRounds = 4,
  otherDimensions = '{"Zahlungskonditionen": 30, "Vertragslaufzeit": 24}',
  status = "completed";

// 2. Create productResults for each product
INSERT INTO product_results:
[
  {
    simulationRunId: "run-456",
    productId: "prod-1",
    productName: "Oreo Kleinkekse 200g",
    targetPrice: 1.00,
    minMaxPrice: 1.20,
    estimatedVolume: 100000,
    agreedPrice: 1.05,
    priceVsTarget: +5%, // 5% worse than target
    withinZopa: true,
    subtotal: 105000 // 1.05 × 100000
  },
  {
    simulationRunId: "run-456",
    productId: "prod-2",
    productName: "Oreo x Milka 100g Tafel",
    targetPrice: 0.40,
    minMaxPrice: 0.70,
    estimatedVolume: 50000,
    agreedPrice: 0.55,
    priceVsTarget: -37.5%, // 37.5% worse than target
    withinZopa: true,
    subtotal: 27500 // 0.55 × 50000
  }
]

// 3. Calculate and update dealValue
UPDATE simulation_runs SET
  dealValue = 132500, // SUM(105000 + 27500)
  successScore = 82.5, // Weighted average vs targets
  zopaAchieved = true; // Both products within ZOPA
```

### Analysis Phase:

#### Query 1: Best Technique×Tactic Combinations
```sql
-- Find best performing technique×tactic combinations for this negotiation
SELECT
  t.name as technique,
  nt.name as tactic,
  COUNT(*) as total_runs,
  COUNT(CASE WHEN sr.outcome = 'DEAL_ACCEPTED' THEN 1 END) as successful_deals,
  ROUND(AVG(sr.dealValue), 2) as avg_deal_value,
  ROUND(AVG(sr.successScore), 2) as avg_success_score,
  ROUND(AVG(sr.totalRounds), 1) as avg_rounds,
  ROUND(AVG(sr.actualCost), 4) as avg_cost,
  ROUND(AVG(sr.dealValue / NULLIF(sr.actualCost, 0)), 2) as roi
FROM simulation_runs sr
JOIN influencing_techniques t ON sr.techniqueId = t.id
JOIN negotiation_tactics nt ON sr.tacticId = nt.id
WHERE sr.negotiationId = 'neg-123'
GROUP BY t.id, t.name, nt.id, nt.name
ORDER BY avg_deal_value DESC, avg_success_score DESC;
```

#### Query 2: Product Performance Analysis
```sql
-- Analyze performance per product: distance from target
SELECT
  pr.productName,
  pr.targetPrice,
  pr.minMaxPrice,
  COUNT(*) as total_runs,
  ROUND(AVG(pr.agreedPrice), 4) as avg_agreed_price,
  ROUND(MIN(pr.agreedPrice), 4) as best_price,
  ROUND(MAX(pr.agreedPrice), 4) as worst_price,
  ROUND(AVG(pr.absoluteDeltaFromTarget), 4) as avg_delta_from_target,
  ROUND(AVG(pr.priceVsTarget), 2) as avg_pct_vs_target,
  ROUND(AVG(pr.zopaUtilization), 2) as avg_zopa_utilization,
  COUNT(CASE WHEN pr.withinZopa = false THEN 1 END) as zopa_violations,
  ROUND(AVG(pr.performanceScore), 2) as avg_performance_score
FROM product_results pr
JOIN simulation_runs sr ON pr.simulationRunId = sr.id
WHERE sr.negotiationId = 'neg-123' AND sr.outcome = 'DEAL_ACCEPTED'
GROUP BY pr.productId, pr.productName, pr.targetPrice, pr.minMaxPrice
ORDER BY avg_performance_score DESC;
```

#### Query 3: Monetary Impact Summary
```sql
-- Calculate total monetary impact vs targets
SELECT
  n.title as negotiation,
  COUNT(DISTINCT sr.id) as total_runs,
  ROUND(AVG(sr.dealValue), 2) as avg_deal_value,
  ROUND(SUM(pr.targetSubtotal) / COUNT(DISTINCT sr.id), 2) as avg_target_value,
  ROUND(SUM(pr.deltaFromTargetSubtotal) / COUNT(DISTINCT sr.id), 2) as avg_variance_from_target,
  CASE
    WHEN n.userRole = 'buyer' THEN
      CASE WHEN AVG(pr.deltaFromTargetSubtotal) > 0 THEN 'OVERPAID' ELSE 'SAVED' END
    ELSE
      CASE WHEN AVG(pr.deltaFromTargetSubtotal) > 0 THEN 'PREMIUM' ELSE 'DISCOUNT' END
  END as outcome_type
FROM negotiations n
JOIN simulation_runs sr ON n.id = sr.negotiationId
JOIN product_results pr ON sr.id = pr.simulationRunId
WHERE n.id = 'neg-123' AND sr.outcome = 'DEAL_ACCEPTED'
GROUP BY n.id, n.title, n.userRole;
```

#### Query 4: Technique Effectiveness Across All Negotiations
```sql
-- Update static reference data with performance metrics
UPDATE influencing_techniques SET
  totalUsages = (
    SELECT COUNT(*) FROM simulation_runs WHERE techniqueId = influencing_techniques.id
  ),
  successfulUsages = (
    SELECT COUNT(*) FROM simulation_runs
    WHERE techniqueId = influencing_techniques.id AND outcome = 'DEAL_ACCEPTED'
  ),
  averageEffectiveness = (
    SELECT AVG(techniqueEffectivenessScore)
    FROM simulation_runs
    WHERE techniqueId = influencing_techniques.id AND outcome = 'DEAL_ACCEPTED'
  ),
  averageDealValue = (
    SELECT AVG(dealValue)
    FROM simulation_runs
    WHERE techniqueId = influencing_techniques.id AND outcome = 'DEAL_ACCEPTED'
  );

-- Then query best techniques globally:
SELECT
  name,
  category,
  totalUsages,
  successfulUsages,
  ROUND(100.0 * successfulUsages / NULLIF(totalUsages, 0), 2) as success_rate,
  ROUND(averageEffectiveness, 2) as avg_effectiveness,
  ROUND(averageDealValue, 2) as avg_deal_value
FROM influencing_techniques
WHERE isActive = true AND totalUsages > 0
ORDER BY success_rate DESC, avg_effectiveness DESC;
```

---

## Migration Strategy

### ✅ APPROVED APPROACH: Fresh Database Reset

**Decision**: Reset database with new optimized schema. NO backward compatibility or legacy fields.

**What to preserve**:
1. ✅ `influencingTechniques` table - MUST export/reimport all seed data
2. ✅ `negotiationTactics` table - MUST export/reimport all seed data
3. ❌ All other data - discard (test/development data only)

**Migration Steps**:

### Step 1: Backup Seed Data
```bash
# Export techniques and tactics to JSON
npm run export-seed-data
# Creates: server/seed-data/influencing-techniques.json
# Creates: server/seed-data/negotiation-tactics.json
```

### Step 2: Deploy New Schema
```bash
# Drop all tables and recreate with new schema
npm run db:push -- --force

# Or manually:
# 1. Update shared/schema.ts with new schema
# 2. Run: npx drizzle-kit push:pg
```

### Step 3: Restore Seed Data
```bash
# Import techniques and tactics
npm run db:seed

# Or manually run seed script that reads JSON files
```

### Step 4: Verify
```bash
# Check that seed data is restored
psql $DATABASE_URL -c "SELECT COUNT(*) FROM influencing_techniques;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM negotiation_tactics;"
```

---

## Benefits of This Design

### ✅ Clear Separation of Concerns
- **Configuration**: `negotiations.products` table
- **Execution**: `simulationRuns` table
- **Results**: `productResults` + `simulationRuns.otherDimensions`

### ✅ Accurate Deal Value Calculation
```sql
-- Simple, reliable query:
SELECT SUM(subtotal) as dealValue
FROM product_results
WHERE simulationRunId = 'run-456';
```

### ✅ Comprehensive Tactical Analysis
- Track effectiveness of each technique×tactic combination
- Compare performance across products
- Identify optimal strategies per product category

### ✅ Easy Access to All Data
- No JSON parsing required for critical metrics
- Indexed columns for fast queries
- Denormalized key fields for performance

### ✅ Audit Trail
- Full history of what was configured vs achieved
- Track price evolution across simulation runs
- Identify which products are hardest to negotiate

---

## Open Questions / Decisions Needed

1. **Tactical Summary Generation**: Should `tacticalSummary` be AI-generated after each run, or computed on-demand for analysis screen?

2. **Success Score Formula**: How to calculate `successScore`? Options:
   - Weighted average of product performance vs targets?
   - Consider both price and other dimensions?
   - Penalty for going outside ZOPA?

3. **Cost Efficiency**: Should we track `costEfficiencyScore` (dealValue/apiCost) at run level or negotiation level?

4. **Backward Compatibility**: How long to keep deprecated fields (`dimensionResults`, `finalAgreement`)?

5. **Product Matching**: For old negotiations without `products` table, should we:
   - Leave `productResults` empty?
   - Try to parse `dimensionResults` and create synthetic product entries?

6. **Aggregation Triggers**: Should negotiation-level aggregates (`averageDealValue`, `mostEffectiveTechnique`) be:
   - Calculated on-demand via queries?
   - Updated via database triggers?
   - Updated via application code after each run?

---

## Key Design Decisions

### 1. **Denormalization for Performance**
The `productResults` table denormalizes product config data (targetPrice, minMaxPrice, estimatedVolume) for easy access without joins. This trades storage space for query performance.

### 2. **Calculated Fields**
Fields like `priceVsTarget`, `zopaUtilization`, and `performanceScore` are calculated and stored (not computed on-the-fly) to enable fast filtering and sorting in analysis screens.

### 3. **Static Reference Data Tracking**
`influencingTechniques` and `negotiationTactics` track their own performance across ALL negotiations, enabling meta-analysis like "Which technique works best for software negotiations?"

### 4. **Queue-Based Execution**
The `simulationQueue` table manages concurrent execution, cost tracking, and progress monitoring for large N×M simulation batches.

### 5. **Distance Metrics**
Multiple distance metrics (`absoluteDeltaFromTarget`, `priceVsTarget`, `zopaUtilization`) provide different perspectives:
- **Absolute**: €5,000 overpaid (raw impact)
- **Percentage**: +5% over target (relative performance)
- **ZOPA**: 25% of negotiation room used (strategic position)

---

## Implementation Recommendations

### Phase 1: Schema Changes (Week 1)
1. ✅ Add new columns to existing tables (backward compatible)
2. ✅ Create `productResults` table
3. ✅ Add indexes for performance
4. ✅ Keep deprecated fields for transition period

**Files to modify:**
- `shared/schema.ts` - Add all new schema definitions
- `server/storage.ts` - Add CRUD methods for productResults
- Migration script to add columns (no data migration yet)

### Phase 2: Python Service Updates (Week 1)
1. ✅ Modify `run_production_negotiation.py` to return ALL dimensions
2. ✅ Separate product prices from other dimensions in output
3. ✅ Track which round agreement was reached

**Changes needed:**
```python
# Current output:
finalOffer = {
  "dimension_values": {
    "Oreo Mobile Price": 1.05,
    "Oreo x Milka Price": 0.55
  }
}

# New output:
finalOffer = {
  "product_prices": [
    {"productName": "Oreo Mobile", "price": 1.05, "round": 4},
    {"productName": "Oreo x Milka", "price": 0.55, "round": 4}
  ],
  "other_dimensions": {
    "Zahlungskonditionen": 30,
    "Vertragslaufzeit": 24,
    "Lieferzeit": 14
  }
}
```

### Phase 3: TypeScript Service Updates (Week 2)
1. ✅ Update `simulation-queue.ts` to create productResults entries
2. ✅ Calculate all delta metrics (absoluteDeltaFromTarget, etc.)
3. ✅ Update dealValue calculation to SUM productResults.subtotal
4. ✅ Update negotiation aggregates after each run

**New calculation logic:**
```typescript
// For each product in negotiation:
const productResult = {
  agreedPrice: 1.05,
  targetPrice: 1.00,
  minMaxPrice: 1.20,
  estimatedVolume: 100000,

  // Calculate deltas:
  absoluteDeltaFromTarget: 1.05 - 1.00 = 0.05,
  priceVsTarget: ((1.05 - 1.00) / 1.00) * 100 = +5%,
  absoluteDeltaFromMinMax: 1.05 - 1.20 = -0.15,
  priceVsMinMax: ((1.05 - 1.20) / 1.20) * 100 = -12.5%,
  withinZopa: true, // 1.00 <= 1.05 <= 1.20
  zopaUtilization: ((1.05 - 1.00) / (1.20 - 1.00)) * 100 = 25%,

  subtotal: 1.05 * 100000 = 105000,
  targetSubtotal: 1.00 * 100000 = 100000,
  deltaFromTargetSubtotal: 105000 - 100000 = 5000,

  performanceScore: userRole === 'buyer' ?
    Math.max(0, 100 - Math.abs(priceVsTarget)) :
    Math.max(0, 100 + priceVsTarget)
};
```

### Phase 4: Frontend Updates (Week 2-3)
1. ✅ Update ResultsTable to show new metrics
2. ✅ Create ProductResults detail view
3. ✅ Build Analysis Dashboard with technique×tactic heatmaps
4. ✅ Add product performance comparison charts

**New UI components:**
- `ProductPerformanceTable` - show per-product deltas from target
- `TacticalEffectivenessMatrix` - heatmap of technique×tactic performance
- `DealValueDistribution` - histogram of deal values across runs
- `ZopaUtilizationChart` - show how much negotiation room was used

### Phase 5: Data Migration (Week 3)
1. ✅ Migrate historical `dimensionResults` to new structure
2. ✅ Create synthetic `productResults` where possible
3. ✅ Calculate missing metrics for old data
4. ✅ Update static reference data (technique/tactic performance)

---

## Success Metrics

After implementation, we should be able to answer:

1. **Which technique×tactic combination gets the best deal value?**
   - Query 1 in Analysis Phase

2. **For Oreo products, how far from target do we typically land?**
   - Query 2: avg_delta_from_target per product

3. **Which products are hardest to negotiate?**
   - Query 2: highest avg_pct_vs_target or lowest avg_performance_score

4. **Did we overpay or save money vs our targets?**
   - Query 3: deltaFromTargetSubtotal

5. **Which technique works best across ALL negotiations?**
   - Query 4: global technique effectiveness

6. **How much of our ZOPA range do we typically use?**
   - Query 2: avg_zopa_utilization

---

## Next Steps

Please review and provide feedback on:
1. ✅ **Field names and types** - Are the new metrics useful?
2. ✅ **Distance from optimal tracking** - Is this sufficient for analysis?
3. ✅ **Static reference data** - Should techniques/tactics track performance?
4. ✅ **Queue management fields** - Any missing status/tracking needs?
5. ✅ **Migration strategy** - Prefer big-bang or incremental?
6. ⚠️ **Open questions below** - Need decisions

Once approved, I will:
1. Implement schema changes in `shared/schema.ts`
2. Update Python service to separate product prices from other dimensions
3. Create productResults calculation logic in TypeScript
4. Update frontend to display new metrics
5. Build analysis dashboard with tactical insights
