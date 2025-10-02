# Migration Plan - Schema Redesign Implementation

## Overview

This document outlines the complete migration plan for implementing the new schema redesign, including database changes and all code modifications across the stack.

---

## Phase 1: Database Migration

### 1.1 Export Seed Data (CRITICAL - Do First!)

**Script**: `server/scripts/export-seed-data.ts`

```typescript
import { db } from '../db';
import { influencingTechniques, negotiationTactics } from '@shared/schema';
import * as fs from 'fs';
import * as path from 'path';

async function exportSeedData() {
  console.log('📦 Exporting seed data...');

  // Export influencing techniques
  const techniques = await db.select().from(influencingTechniques);
  fs.writeFileSync(
    path.join(__dirname, '../seed-data/influencing-techniques.json'),
    JSON.stringify(techniques, null, 2)
  );
  console.log(`✅ Exported ${techniques.length} influencing techniques`);

  // Export negotiation tactics
  const tactics = await db.select().from(negotiationTactics);
  fs.writeFileSync(
    path.join(__dirname, '../seed-data/negotiation-tactics.json'),
    JSON.stringify(tactics, null, 2)
  );
  console.log(`✅ Exported ${tactics.length} negotiation tactics`);

  console.log('✅ Seed data export complete!');
}

exportSeedData().then(() => process.exit(0));
```

**Run**:
```bash
mkdir -p server/seed-data
npx tsx server/scripts/export-seed-data.ts
```

**Verify files created**:
- `server/seed-data/influencing-techniques.json`
- `server/seed-data/negotiation-tactics.json`

---

### 1.2 Update Schema (`shared/schema.ts`)

**Changes required**:

#### A. Update `negotiations` Table
```typescript
export const negotiations = pgTable("negotiations", {
  // Existing fields (keep)
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  contextId: uuid("context_id").references(() => contexts.id),
  userRole: text("user_role").notNull(),
  negotiationType: text("negotiation_type").notNull(),
  maxRounds: integer("max_rounds").default(10),
  counterpartStrategy: text("counterpart_strategy"),
  productMarketDescription: text("product_market_description"),
  marketIntelligence: jsonb("market_intelligence"),

  // NEW: Overall status and outcomes
  overallStatus: text("overall_status").default("pending"),
  totalSimulationRuns: integer("total_simulation_runs").default(0),
  completedRuns: integer("completed_runs").default(0),
  successfulDeals: integer("successful_deals").default(0),
  averageDealValue: decimal("average_deal_value", { precision: 15, scale: 2 }),
  bestDealValue: decimal("best_deal_value", { precision: 15, scale: 2 }),
  worstDealValue: decimal("worst_deal_value", { precision: 15, scale: 2 }),

  // Tactical insights
  mostEffectiveTechnique: uuid("most_effective_technique").references(() => influencingTechniques.id),
  mostEffectiveTactic: uuid("most_effective_tactic").references(() => negotiationTactics.id),
  averageRoundsToCompletion: decimal("average_rounds_to_completion", { precision: 5, scale: 2 }),

  // Cost
  totalCost: decimal("total_cost", { precision: 10, scale: 4 }),

  // Timing
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),

  notes: text("notes"),
  metadata: jsonb("metadata").default({}),
});
```

#### B. Update `simulationRuns` Table
```typescript
export const simulationRuns = pgTable("simulation_runs", {
  // Existing fields (keep)
  id: uuid("id").primaryKey().defaultRandom(),
  negotiationId: uuid("negotiation_id").references(() => negotiations.id, { onDelete: "cascade" }),
  queueId: uuid("queue_id").references(() => simulationQueue.id, { onDelete: "cascade" }),
  runNumber: integer("run_number").notNull(),
  executionOrder: integer("execution_order"),
  techniqueId: uuid("technique_id").references(() => influencingTechniques.id),
  tacticId: uuid("tactic_id").references(() => negotiationTactics.id),
  personalityId: text("personality_id"),
  zopaDistance: text("zopa_distance"),

  status: text("status").notNull().default("pending"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  estimatedDuration: integer("estimated_duration"),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),

  // NEW: Enhanced outcome fields
  outcome: text("outcome"),
  outcomeReason: text("outcome_reason"),
  totalRounds: integer("total_rounds").default(0),
  avgResponseTimeMs: integer("avg_response_time_ms"),

  // Financial
  dealValue: decimal("deal_value", { precision: 15, scale: 2 }),
  actualCost: decimal("actual_cost", { precision: 10, scale: 4 }),
  costEfficiencyScore: decimal("cost_efficiency_score", { precision: 10, scale: 4 }),

  // Success metrics
  zopaAchieved: boolean("zopa_achieved").default(false),
  successScore: decimal("success_score", { precision: 5, scale: 2 }),
  dealValueVsTarget: decimal("deal_value_vs_target", { precision: 10, scale: 2 }),

  // Tactical effectiveness
  techniqueEffectivenessScore: decimal("technique_effectiveness_score", { precision: 5, scale: 2 }),
  tacticEffectivenessScore: decimal("tactic_effectiveness_score", { precision: 5, scale: 2 }),
  tacticalSummary: text("tactical_summary"),

  // Results storage
  conversationLog: jsonb("conversation_log").default([]).notNull(),
  otherDimensions: jsonb("other_dimensions").default({}).notNull(),

  // REMOVED: dimensionResults, finalAgreement, finalTerms, personalityArchetype

  // Debugging
  crashRecoveryData: jsonb("crash_recovery_data"),
  langfuseTraceId: text("langfuse_trace_id"),
  metadata: jsonb("metadata").default({}),
});
```

#### C. Create `productResults` Table (NEW)
```typescript
export const productResults = pgTable("product_results", {
  id: uuid("id").primaryKey().defaultRandom(),

  simulationRunId: uuid("simulation_run_id")
    .references(() => simulationRuns.id, { onDelete: "cascade" })
    .notNull(),

  productId: uuid("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),

  // Denormalized config (for easy access)
  productName: text("product_name").notNull(),
  targetPrice: decimal("target_price", { precision: 15, scale: 4 }).notNull(),
  minMaxPrice: decimal("min_max_price", { precision: 15, scale: 4 }).notNull(),
  estimatedVolume: integer("estimated_volume").notNull(),

  // Results
  agreedPrice: decimal("agreed_price", { precision: 15, scale: 4 }).notNull(),

  // Distance from optimal
  priceVsTarget: decimal("price_vs_target", { precision: 10, scale: 2 }),
  absoluteDeltaFromTarget: decimal("absolute_delta_from_target", { precision: 15, scale: 4 }),
  priceVsMinMax: decimal("price_vs_min_max", { precision: 10, scale: 2 }),
  absoluteDeltaFromMinMax: decimal("absolute_delta_from_min_max", { precision: 15, scale: 4 }),
  withinZopa: boolean("within_zopa").default(true),
  zopaUtilization: decimal("zopa_utilization", { precision: 5, scale: 2 }),

  // Deal value
  subtotal: decimal("subtotal", { precision: 15, scale: 2 }).notNull(),
  targetSubtotal: decimal("target_subtotal", { precision: 15, scale: 2 }).notNull(),
  deltaFromTargetSubtotal: decimal("delta_from_target_subtotal", { precision: 15, scale: 2 }),

  performanceScore: decimal("performance_score", { precision: 5, scale: 2 }),

  dimensionKey: text("dimension_key"),
  negotiationRound: integer("negotiation_round"),

  createdAt: timestamp("created_at").defaultNow(),
  metadata: jsonb("metadata").default({}),
});

// Indexes
export const productResultsSimulationRunIdIdx = index("product_results_simulation_run_id_idx")
  .on(productResults.simulationRunId);

export const productResultsProductIdIdx = index("product_results_product_id_idx")
  .on(productResults.productId);
```

#### D. Update `simulationQueue` Table
```typescript
export const simulationQueue = pgTable("simulation_queue", {
  // Existing fields (keep)
  id: uuid("id").primaryKey().defaultRandom(),
  negotiationId: uuid("negotiation_id").references(() => negotiations.id, { onDelete: "cascade" }).notNull(),

  totalRuns: integer("total_runs").notNull(),
  priority: integer("priority").default(0),
  status: text("status").notNull().default("pending"),

  // NEW: Progress tracking
  completedRuns: integer("completed_runs").default(0),
  failedRuns: integer("failed_runs").default(0),
  runningRuns: integer("running_runs").default(0),
  pendingRuns: integer("pending_runs").default(0),

  // Timing
  createdAt: timestamp("created_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  estimatedCompletionAt: timestamp("estimated_completion_at"),

  // Resource management
  maxConcurrent: integer("max_concurrent").default(1),
  currentConcurrent: integer("current_concurrent").default(0),

  // Cost
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 4 }),
  actualCost: decimal("actual_cost", { precision: 10, scale: 4 }),

  // Error handling
  errorCount: integer("error_count").default(0),
  lastError: text("last_error"),

  metadata: jsonb("metadata").default({}),
});
```

---

### 1.3 Push New Schema to Database

```bash
# DANGER: This will DROP all tables!
npm run db:push -- --force

# Or use Drizzle Kit directly
npx drizzle-kit push:pg
```

---

### 1.4 Import Seed Data

**Script**: `server/scripts/import-seed-data.ts`

```typescript
import { db } from '../db';
import { influencingTechniques, negotiationTactics } from '@shared/schema';
import * as fs from 'fs';
import * as path from 'path';

async function importSeedData() {
  console.log('📥 Importing seed data...');

  // Import influencing techniques
  const techniquesData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../seed-data/influencing-techniques.json'), 'utf-8')
  );

  for (const technique of techniquesData) {
    await db.insert(influencingTechniques).values(technique);
  }
  console.log(`✅ Imported ${techniquesData.length} influencing techniques`);

  // Import negotiation tactics
  const tacticsData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../seed-data/negotiation-tactics.json'), 'utf-8')
  );

  for (const tactic of tacticsData) {
    await db.insert(negotiationTactics).values(tactic);
  }
  console.log(`✅ Imported ${tacticsData.length} negotiation tactics`);

  console.log('✅ Seed data import complete!');
}

importSeedData().then(() => process.exit(0));
```

**Run**:
```bash
npx tsx server/scripts/import-seed-data.ts
```

---

## Phase 2: Code Changes

### 2.1 Python Service (`scripts/run_production_negotiation.py`)

**Change**: Separate product prices from other dimensions in output

**Current output**:
```python
{
  "outcome": "DEAL_ACCEPTED",
  "totalRounds": 4,
  "finalOffer": {
    "dimension_values": {
      "Oreo Mobile Price": 1.05,
      "Oreo x Milka Price": 0.55,
      "Zahlungskonditionen": 30
    }
  }
}
```

**NEW output**:
```python
{
  "outcome": "DEAL_ACCEPTED",
  "totalRounds": 4,
  "productPrices": [
    {
      "productName": "Oreo Mobile",
      "agreedPrice": 1.05,
      "dimensionKey": "Oreo Mobile Price",
      "negotiationRound": 4
    },
    {
      "productName": "Oreo x Milka",
      "agreedPrice": 0.55,
      "dimensionKey": "Oreo x Milka Price",
      "negotiationRound": 4
    }
  ],
  "otherDimensions": {
    "Zahlungskonditionen": 30,
    "Vertragslaufzeit": 24
  }
}
```

**Implementation** (around line 950):
```python
def _separate_product_prices_and_dimensions(self, final_offer: Dict, products: List[Dict]) -> Tuple[List[Dict], Dict]:
    """
    Separate finalOffer.dimension_values into:
    1. productPrices: list of {productName, agreedPrice, dimensionKey}
    2. otherDimensions: non-price dimensions
    """
    dimension_values = final_offer.get("dimension_values", {})

    product_prices = []
    other_dimensions = {}

    # Extract product prices by matching dimension keys
    for product in products:
        product_name = product.get('produktName', '')

        # Find matching dimension key (e.g., "Oreo Mobile Price")
        for dim_key, dim_value in dimension_values.items():
            dim_key_lower = dim_key.lower()
            product_name_lower = product_name.lower()

            # Match if dimension key contains product name and "price"/"preis"
            if (product_name_lower in dim_key_lower and
                ('price' in dim_key_lower or 'preis' in dim_key_lower)):

                product_prices.append({
                    "productName": product_name,
                    "agreedPrice": float(dim_value),
                    "dimensionKey": dim_key,
                    "negotiationRound": len(self.conversation_history)
                })
                break

    # Everything else is "other dimensions"
    matched_keys = {p["dimensionKey"] for p in product_prices}
    for dim_key, dim_value in dimension_values.items():
        if dim_key not in matched_keys:
            other_dimensions[dim_key] = dim_value

    return product_prices, other_dimensions

# Update return statement:
product_prices, other_dimensions = self._separate_product_prices_and_dimensions(
    final_offer,
    self.negotiation_data.get('products', [])
)

final_result = {
    "outcome": outcome,
    "totalRounds": len(results),
    "productPrices": product_prices,
    "otherDimensions": other_dimensions,
    "conversationLog": conversation_log,
    "langfuseTraceId": getattr(self, '_trace_id', None)
}
```

---

### 2.2 TypeScript Services

#### A. `server/services/python-negotiation-service.ts`

**Change**: Handle new output format from Python

**Update** (around line 470-508):
```typescript
async updateSimulationRunWithResults(
  simulationRunId: string,
  result: {
    outcome: string;
    totalRounds: number;
    productPrices: Array<{ productName: string; agreedPrice: number; dimensionKey: string; negotiationRound: number }>;
    otherDimensions: Record<string, any>;
    conversationLog: any[];
    langfuseTraceId?: string;
  }
) {
  const statusMapping = {
    'DEAL_ACCEPTED': 'completed',
    'WALK_AWAY': 'failed',
    'TERMINATED': 'failed',
    'PAUSED': 'paused',
    'MAX_ROUNDS_REACHED': 'timeout',
    'ERROR': 'failed'
  } as const;

  const normalizedConversationLog = Array.isArray(result.conversationLog)
    ? result.conversationLog
    : [];

  const updateData: any = {
    status: statusMapping[result.outcome] || 'failed',
    conversationLog: normalizedConversationLog,
    totalRounds: result.totalRounds,
    langfuseTraceId: result.langfuseTraceId || null,
    outcome: result.outcome,
    otherDimensions: result.otherDimensions || {}, // NEW: store non-price dimensions
  };

  if (result.outcome !== 'PAUSED') {
    updateData.completedAt = new Date();
  }

  await db
    .update(simulationRuns)
    .set(updateData)
    .where(eq(simulationRuns.id, simulationRunId));

  // NEW: Return productPrices for processing by simulation-queue
  return {
    productPrices: result.productPrices || [],
    otherDimensions: result.otherDimensions || {}
  };
}
```

---

#### B. `server/services/simulation-queue.ts`

**Major changes**: Create productResults entries and calculate metrics

**1. Create `createProductResults` function** (NEW):
```typescript
private async createProductResults(
  simulationRunId: string,
  negotiationId: string,
  productPrices: Array<{ productName: string; agreedPrice: number; dimensionKey: string; negotiationRound: number }>,
  userRole: string
): Promise<number> {
  // Fetch product configuration
  const products = await storage.getProductsByNegotiation(negotiationId);

  if (!products || products.length === 0) {
    this.log.warn(`No products found for negotiation ${negotiationId}`);
    return 0;
  }

  let totalDealValue = 0;
  const productResultsToInsert = [];

  for (const product of products) {
    // Find matching price from productPrices
    const priceMatch = productPrices.find(p => {
      const productNameLower = product.produktName.toLowerCase();
      const priceProductNameLower = p.productName.toLowerCase();
      return productNameLower === priceProductNameLower ||
             productNameLower.includes(priceProductNameLower) ||
             priceProductNameLower.includes(productNameLower);
    });

    if (!priceMatch) {
      this.log.warn(`No price found for product "${product.produktName}"`);
      continue;
    }

    const agreedPrice = priceMatch.agreedPrice;
    const targetPrice = parseFloat(product.zielPreis);
    const minMaxPrice = parseFloat(product.minMaxPreis);
    const volume = product.geschätztesVolumen;

    // Calculate all metrics
    const absoluteDeltaFromTarget = agreedPrice - targetPrice;
    const priceVsTarget = ((agreedPrice - targetPrice) / targetPrice) * 100;

    const absoluteDeltaFromMinMax = agreedPrice - minMaxPrice;
    const priceVsMinMax = ((agreedPrice - minMaxPrice) / minMaxPrice) * 100;

    // ZOPA check (for buyer: target <= agreed <= minMax, for seller: minMax <= agreed <= target)
    const withinZopa = userRole === 'buyer'
      ? (agreedPrice >= targetPrice && agreedPrice <= minMaxPrice)
      : (agreedPrice >= minMaxPrice && agreedPrice <= targetPrice);

    // ZOPA utilization
    const zopaRange = Math.abs(minMaxPrice - targetPrice);
    const zopaUtilization = zopaRange > 0
      ? (Math.abs(agreedPrice - targetPrice) / zopaRange) * 100
      : 0;

    // Subtotals
    const subtotal = agreedPrice * volume;
    const targetSubtotal = targetPrice * volume;
    const deltaFromTargetSubtotal = subtotal - targetSubtotal;

    // Performance score (0-100)
    // For buyer: lower price = better, for seller: higher price = better
    const performanceScore = userRole === 'buyer'
      ? Math.max(0, 100 - Math.abs(priceVsTarget))
      : Math.max(0, 100 + priceVsTarget);

    productResultsToInsert.push({
      simulationRunId,
      productId: product.id,
      productName: product.produktName,
      targetPrice: product.zielPreis,
      minMaxPrice: product.minMaxPreis,
      estimatedVolume: volume,
      agreedPrice: agreedPrice.toString(),
      priceVsTarget: priceVsTarget.toFixed(2),
      absoluteDeltaFromTarget: absoluteDeltaFromTarget.toFixed(4),
      priceVsMinMax: priceVsMinMax.toFixed(2),
      absoluteDeltaFromMinMax: absoluteDeltaFromMinMax.toFixed(4),
      withinZopa,
      zopaUtilization: zopaUtilization.toFixed(2),
      subtotal: subtotal.toFixed(2),
      targetSubtotal: targetSubtotal.toFixed(2),
      deltaFromTargetSubtotal: deltaFromTargetSubtotal.toFixed(2),
      performanceScore: performanceScore.toFixed(2),
      dimensionKey: priceMatch.dimensionKey,
      negotiationRound: priceMatch.negotiationRound,
    });

    totalDealValue += subtotal;

    this.log.info(
      `Product "${product.produktName}": €${agreedPrice} × ${volume} = €${subtotal} ` +
      `(vs target €${targetPrice}, delta: ${priceVsTarget > 0 ? '+' : ''}${priceVsTarget.toFixed(2)}%)`
    );
  }

  // Insert all product results
  if (productResultsToInsert.length > 0) {
    await db.insert(productResults).values(productResultsToInsert);
    this.log.info(`Created ${productResultsToInsert.length} product results, total deal value: €${totalDealValue.toFixed(2)}`);
  }

  return totalDealValue;
}
```

**2. Update `executeNextSimulation` function** (around line 600-750):
```typescript
// After Python negotiation completes:
const { productPrices, otherDimensions } = await pythonService.updateSimulationRunWithResults(
  nextSimulation.id,
  result
);

// NEW: Create product results and calculate deal value
const negotiation = await storage.getNegotiationById(nextSimulation.negotiationId);
const dealValue = await this.createProductResults(
  nextSimulation.id,
  nextSimulation.negotiationId,
  productPrices,
  negotiation.userRole
);

// Calculate success metrics
const successScore = await this.calculateSuccessScore(nextSimulation.id);
const zopaAchieved = await this.checkZopaAchievement(nextSimulation.id);

// Update simulation run with calculated values
await db.update(simulationRuns)
  .set({
    dealValue: dealValue.toString(),
    successScore: successScore.toString(),
    zopaAchieved,
    completedAt: new Date(),
  })
  .where(eq(simulationRuns.id, nextSimulation.id));

// NEW: Update negotiation aggregates
await this.updateNegotiationAggregates(nextSimulation.negotiationId);
```

**3. Add `calculateSuccessScore` function** (NEW):
```typescript
private async calculateSuccessScore(simulationRunId: string): Promise<number> {
  const results = await db
    .select()
    .from(productResults)
    .where(eq(productResults.simulationRunId, simulationRunId));

  if (results.length === 0) return 0;

  // Weighted average of performance scores
  const avgScore = results.reduce((sum, r) => sum + parseFloat(r.performanceScore || '0'), 0) / results.length;
  return avgScore;
}
```

**4. Add `checkZopaAchievement` function** (NEW):
```typescript
private async checkZopaAchievement(simulationRunId: string): Promise<boolean> {
  const results = await db
    .select()
    .from(productResults)
    .where(eq(productResults.simulationRunId, simulationRunId));

  // All products must be within ZOPA
  return results.every(r => r.withinZopa);
}
```

**5. Add `updateNegotiationAggregates` function** (NEW):
```typescript
private async updateNegotiationAggregates(negotiationId: string): Promise<void> {
  const runs = await db
    .select()
    .from(simulationRuns)
    .where(eq(simulationRuns.negotiationId, negotiationId));

  const completedRuns = runs.filter(r => r.status === 'completed');
  const successfulDeals = completedRuns.filter(r => r.outcome === 'DEAL_ACCEPTED');

  const dealValues = completedRuns
    .map(r => parseFloat(r.dealValue || '0'))
    .filter(v => v > 0);

  const avgDealValue = dealValues.length > 0
    ? dealValues.reduce((a, b) => a + b, 0) / dealValues.length
    : null;

  const bestDealValue = dealValues.length > 0 ? Math.max(...dealValues) : null;
  const worstDealValue = dealValues.length > 0 ? Math.min(...dealValues) : null;

  const avgRounds = completedRuns.length > 0
    ? completedRuns.reduce((sum, r) => sum + (r.totalRounds || 0), 0) / completedRuns.length
    : null;

  const totalCost = runs.reduce((sum, r) => sum + parseFloat(r.actualCost || '0'), 0);

  // Determine most effective technique/tactic
  const techniqueScores = new Map<string, number[]>();
  completedRuns.forEach(run => {
    if (run.techniqueId && run.dealValue) {
      if (!techniqueScores.has(run.techniqueId)) {
        techniqueScores.set(run.techniqueId, []);
      }
      techniqueScores.get(run.techniqueId)!.push(parseFloat(run.dealValue));
    }
  });

  let mostEffectiveTechnique = null;
  let maxAvgDealValue = 0;

  for (const [techniqueId, values] of techniqueScores.entries()) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    if (avg > maxAvgDealValue) {
      maxAvgDealValue = avg;
      mostEffectiveTechnique = techniqueId;
    }
  }

  // Update negotiation
  await db.update(negotiations)
    .set({
      totalSimulationRuns: runs.length,
      completedRuns: completedRuns.length,
      successfulDeals: successfulDeals.length,
      averageDealValue: avgDealValue?.toFixed(2) || null,
      bestDealValue: bestDealValue?.toFixed(2) || null,
      worstDealValue: worstDealValue?.toFixed(2) || null,
      averageRoundsToCompletion: avgRounds?.toFixed(2) || null,
      mostEffectiveTechnique,
      totalCost: totalCost.toFixed(4),
      overallStatus: completedRuns.length === runs.length ? 'completed' : 'in_progress',
      completedAt: completedRuns.length === runs.length ? new Date() : null,
    })
    .where(eq(negotiations.id, negotiationId));
}
```

---

#### C. `server/storage.ts`

**Add new CRUD methods**:

```typescript
// Product Results
async createProductResult(data: typeof productResults.$inferInsert) {
  return await db.insert(productResults).values(data).returning();
}

async getProductResultsByRun(simulationRunId: string) {
  return await db
    .select()
    .from(productResults)
    .where(eq(productResults.simulationRunId, simulationRunId));
}

async getProductResultsByNegotiation(negotiationId: string) {
  return await db
    .select({
      productResult: productResults,
      simulationRun: simulationRuns,
    })
    .from(productResults)
    .innerJoin(simulationRuns, eq(productResults.simulationRunId, simulationRuns.id))
    .where(eq(simulationRuns.negotiationId, negotiationId));
}
```

---

### 2.3 Frontend Changes

#### A. Config Screen (`client/src/pages/negotiation-config-phase2.tsx`)

**No changes needed!** Products are already saved correctly.

**Verify**:
- Products are saved with negotiationId
- Fields: produktName, zielPreis, minMaxPreis, geschätztesVolumen

---

#### B. Monitoring Screen (`client/src/pages/simulation-monitor.tsx`)

**Update to show new aggregates**:

```typescript
// Add negotiation summary section
<Card>
  <CardHeader>
    <CardTitle>Negotiation Summary</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-3 gap-4">
      <div>
        <p className="text-sm text-gray-600">Total Runs</p>
        <p className="text-2xl font-bold">{negotiation.totalSimulationRuns}</p>
      </div>
      <div>
        <p className="text-sm text-gray-600">Successful Deals</p>
        <p className="text-2xl font-bold text-green-600">
          {negotiation.successfulDeals}
        </p>
      </div>
      <div>
        <p className="text-sm text-gray-600">Average Deal Value</p>
        <p className="text-2xl font-bold">
          {negotiation.averageDealValue
            ? `€${parseFloat(negotiation.averageDealValue).toLocaleString('de-DE')}`
            : '-'}
        </p>
      </div>
      <div>
        <p className="text-sm text-gray-600">Best Deal</p>
        <p className="text-2xl font-bold text-green-600">
          {negotiation.bestDealValue
            ? `€${parseFloat(negotiation.bestDealValue).toLocaleString('de-DE')}`
            : '-'}
        </p>
      </div>
      <div>
        <p className="text-sm text-gray-600">Worst Deal</p>
        <p className="text-2xl font-bold text-red-600">
          {negotiation.worstDealValue
            ? `€${parseFloat(negotiation.worstDealValue).toLocaleString('de-DE')}`
            : '-'}
        </p>
      </div>
      <div>
        <p className="text-sm text-gray-600">Avg Rounds</p>
        <p className="text-2xl font-bold">
          {negotiation.averageRoundsToCompletion
            ? parseFloat(negotiation.averageRoundsToCompletion).toFixed(1)
            : '-'}
        </p>
      </div>
    </div>
  </CardContent>
</Card>
```

---

#### C. Results Table (`client/src/components/monitor/ResultsTable.tsx`)

**Update to fetch and display product results**:

```typescript
// Add new column for product breakdown
<TableHead>Product Breakdown</TableHead>

// In table body:
<TableCell>
  <ProductBreakdownCell simulationRunId={result.id} />
</TableCell>
```

**Create new component** (`client/src/components/monitor/ProductBreakdownCell.tsx`):

```typescript
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface ProductBreakdownCellProps {
  simulationRunId: string;
}

export function ProductBreakdownCell({ simulationRunId }: ProductBreakdownCellProps) {
  const { data: productResults, isLoading } = useQuery({
    queryKey: [`/api/simulation-runs/${simulationRunId}/product-results`],
  });

  if (isLoading) return <span className="text-xs text-gray-400">Loading...</span>;
  if (!productResults || productResults.length === 0) {
    return <span className="text-xs text-gray-400">-</span>;
  }

  const totalDealValue = productResults.reduce(
    (sum: number, p: any) => sum + parseFloat(p.subtotal || '0'),
    0
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-xs hover:underline cursor-pointer">
          {productResults.length} products
          <div className="font-semibold">€{totalDealValue.toLocaleString('de-DE')}</div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96">
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Product Breakdown</h4>
          {productResults.map((p: any) => (
            <div key={p.id} className="border-b pb-2 last:border-0">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-sm font-medium">{p.productName}</p>
                  <div className="text-xs text-gray-600 space-y-1 mt-1">
                    <div>Agreed: €{p.agreedPrice} × {p.estimatedVolume.toLocaleString()} units</div>
                    <div>Target: €{p.targetPrice}</div>
                    <div className="flex gap-2">
                      <Badge variant={p.withinZopa ? 'default' : 'destructive'}>
                        {p.withinZopa ? 'Within ZOPA' : 'Outside ZOPA'}
                      </Badge>
                      <span className={parseFloat(p.priceVsTarget) > 0 ? 'text-red-600' : 'text-green-600'}>
                        {parseFloat(p.priceVsTarget) > 0 ? '+' : ''}
                        {parseFloat(p.priceVsTarget).toFixed(1)}% vs target
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">€{parseFloat(p.subtotal).toLocaleString('de-DE')}</div>
                  <div className="text-xs text-gray-600">
                    Score: {parseFloat(p.performanceScore).toFixed(0)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

---

#### D. Add API Routes

**`server/routes/simulation-runs.ts`** (NEW):

```typescript
import express from 'express';
import { storage } from '../storage';

const router = express.Router();

// Get product results for a simulation run
router.get('/:runId/product-results', async (req, res) => {
  try {
    const { runId } = req.params;
    const results = await storage.getProductResultsByRun(runId);
    res.json(results);
  } catch (error) {
    console.error('Error fetching product results:', error);
    res.status(500).json({ error: 'Failed to fetch product results' });
  }
});

export default router;
```

**Register in `server/index.ts`**:
```typescript
import simulationRunsRouter from './routes/simulation-runs';
app.use('/api/simulation-runs', simulationRunsRouter);
```

---

## Phase 3: Testing & Verification

### 3.1 Database Verification

```bash
# Check schema is correct
psql $DATABASE_URL -c "\d product_results"
psql $DATABASE_URL -c "\d simulation_runs"
psql $DATABASE_URL -c "\d negotiations"

# Check seed data restored
psql $DATABASE_URL -c "SELECT COUNT(*) FROM influencing_techniques;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM negotiation_tactics;"
```

### 3.2 Create Test Negotiation

1. Navigate to `/negotiations/phase2`
2. Create negotiation with 2 products:
   - Product 1: "Oreo Kleinkekse 200g", target €1.00, max €1.20, volume 100,000
   - Product 2: "Milka Schokolade 100g", target €0.50, max €0.80, volume 50,000
3. Select 2 techniques, 2 tactics = 4 simulation runs
4. Start queue

### 3.3 Verify Results

**Check product_results table**:
```sql
SELECT
  pr.product_name,
  pr.agreed_price,
  pr.target_price,
  pr.price_vs_target,
  pr.subtotal,
  pr.performance_score,
  pr.within_zopa
FROM product_results pr
JOIN simulation_runs sr ON pr.simulation_run_id = sr.id
WHERE sr.negotiation_id = '<your-negotiation-id>'
ORDER BY sr.run_number, pr.product_name;
```

**Check aggregates**:
```sql
SELECT
  title,
  total_simulation_runs,
  successful_deals,
  average_deal_value,
  best_deal_value,
  worst_deal_value
FROM negotiations
WHERE id = '<your-negotiation-id>';
```

**Check frontend**:
- Monitor screen shows aggregates
- Results table shows product breakdown popover
- Deal values are correct sums

---

## Phase 4: Cleanup

### 4.1 Remove Old Code

- Delete references to `dimensionResults` field
- Delete `finalAgreement`, `finalTerms` field references
- Update TypeScript types

### 4.2 Update Documentation

- Update README with new schema
- Update API docs with new endpoints
- Add examples for querying productResults

---

## Rollback Plan

If migration fails:

1. **Restore seed data**:
   ```bash
   npx tsx server/scripts/import-seed-data.ts
   ```

2. **Revert schema changes**:
   ```bash
   git checkout shared/schema.ts
   npm run db:push
   ```

3. **Revert code changes**:
   ```bash
   git checkout .
   ```

---

## Success Criteria

✅ Database schema deployed with all new tables/columns
✅ Seed data (techniques/tactics) preserved
✅ New negotiation creates products correctly
✅ Simulation runs create productResults entries
✅ Deal value = SUM of productResults.subtotal
✅ Aggregates update after each run
✅ Frontend displays product breakdowns
✅ All metrics calculated correctly (priceVsTarget, zopaUtilization, etc.)
✅ No errors in simulation queue processing

---

## Estimated Timeline

- **Phase 1 (DB Migration)**: 1 hour
  - Export seed data: 15 min
  - Update schema: 30 min
  - Deploy & import: 15 min

- **Phase 2 (Code Changes)**: 4-6 hours
  - Python service: 1 hour
  - TypeScript services: 2-3 hours
  - Frontend: 1-2 hours

- **Phase 3 (Testing)**: 1-2 hours
  - Create test negotiation
  - Verify all calculations
  - Check edge cases

**Total: 6-9 hours**

---

## Next Steps

Ready to proceed? Steps:
1. ✅ Export seed data
2. ✅ Update shared/schema.ts
3. ✅ Deploy database
4. ✅ Import seed data
5. ✅ Update Python service
6. ✅ Update TypeScript services
7. ✅ Update frontend
8. ✅ Test end-to-end
