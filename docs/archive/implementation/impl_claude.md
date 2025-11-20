# Implementation Plan: New Schema Migration

**Date:** 2025-11-09
**Version:** 1.0
**Authors:** Christian Au (with AI assistance)

---

## Executive Summary

This document outlines the comprehensive migration plan to implement the new research-oriented negotiation platform schema. The new architecture introduces:

1. **Normalized product/dimension model** (replacing hardcoded JSONB)
2. **Proper separation of markets, counterparts, and registrations**
3. **Agent-centric design** with policies, metrics, and interactions
4. **Event-driven architecture** with unified event log
5. **Experiment/benchmark infrastructure** for A/B testing

---

## Table of Contents

1. [Phase 1: Database Schema Migration](#phase-1-database-schema-migration)
2. [Phase 2: Frontend Changes](#phase-2-frontend-changes)
3. [Phase 3: Service Function Changes](#phase-3-service-function-changes)
4. [Phase 4: Implementation Roadmap](#phase-4-implementation-roadmap)
5. [Critical Issues & Concerns](#critical-issues--concerns)
6. [Risks & Mitigation](#risks--mitigation)
7. [Success Criteria](#success-criteria)

---

## Phase 1: Database Schema Migration

### 1.1 Core Structural Changes

#### New Tables to Create

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `markets` | Market master data | market_id, name, region, currency_code |
| `counterparts` | Counterpart entities | counterpart_id, name, kind, power_balance, style |
| `dimensions` | Master dimension definitions | dimension_id, code, name, value_type, unit |
| `products` | Product master data | product_id, gtin, name, brand, category_path |
| `product_dimension_values` | Product”Dimension values (history-friendly) | product_id, dimension_id, value, measured_at |
| `registrations` | User registration/setup | registration_id, organization, goals, negotiation_type |
| `policies` | Agent policies | policy_id, name, kind, config |
| `agent_metrics` | Agent performance tracking | agent_metric_id, agent_id, metric_name, value |
| `interactions` | Step/reward tracking (RL-style) | interaction_id, round_id, agent_id, observation, reward |
| `events` | Unified event log | event_id, round_id, event_kind, role, parameters |
| `offers` | Structured offers | offer_id, round_id, side, price, terms, accepted |
| `concessions` | Concession tracking | concession_id, offer_id, field_path, before/after values |
| `benchmarks` | Benchmark datasets | benchmark_id, name, dataset |
| `experiments` | Experiment definitions | experiment_id, benchmark_id, hypothesis, design |
| `experiment_runs` | Experiment execution | run_id, experiment_id, simulation_id, metrics |

#### Tables to Modify

| Current Table | Changes Needed |
|---------------|----------------|
| `negotiations` | Map to new `registrations` + `negotiations` split |
| `simulation_runs` | Link to new `agents` table, add `round_id` references |
| `agents` | Restructure: add `policy_id`, `registration_id`, `simulation_id`, remove personality fields |
| `negotiation_rounds` | Rename/restructure to align with new `negotiation_rounds` schema |
| `products` (current) | Migrate to new normalized `products` + `product_dimension_values` |
| `negotiation_dimensions` (current) | Migrate to new `dimensions` + offers system |

#### Tables to Deprecate

- `negotiation_contexts` ’ Replaced by `markets` + `counterparts` + `scenarios` JSONB
- `zopa_configurations` ’ Replaced by `product_dimension_values` + boundaries in offers
- `tactics` (old) ’ Replaced by `negotiation_tactics` with richer schema
- `performance_metrics` ’ Replaced by `agent_metrics` + `interactions`

---

### 1.2 Key Schema Mappings

#### self_agent.md Prompt Variables ’ Database Fields

| Prompt Variable | New Schema Location | Notes |
|-----------------|---------------------|-------|
| `{{agent_role}}` | `agents.role` | ENUM: buyer, seller, coach, observer |
| `{{company}}` | `registrations.organization` | User's company |
| `{{negotiation_title}}` | `negotiations.scenario->>'title'` | JSONB field |
| `{{current_round}}` | `negotiation_rounds.round_no` | Sequential round number |
| `{{max_rounds}}` | `simulations.num_rounds` | Config field |
| `{{previous_rounds}}` | `events` table (filtered by `round_id`) | Event log query |
| `{{current_round_message}}` | Latest `events` record where `event_kind='message'` | Query |
| `{{opponent_last_offer}}` | Latest `offers` record where `round_id=current` | Join offers table |
| `{{product_market_description}}` | `negotiations.scenario->>'context'` + `markets` join | Combined |
| `{{negotiation_context}}` | `negotiations.scenario` JSONB | Flexible field |
| `{{negotiation_frequency}}` | `registrations.negotiation_frequency` | Already exists in current schema |
| `{{negotiation_type}}` | `registrations.negotiation_type` | Already exists |
| `{{intelligence}}` | `markets.meta->>'analysis'` or external API | Market intel |
| `{{counterpart_company}}` | `counterparts.name` | Join via `negotiations.counterpart_id` |
| `{{counterpart_known}}` | `negotiations.scenario->>'counterpart_known'` | Boolean in JSONB |
| `{{company_known}}` | `negotiations.scenario->>'company_known'` | Boolean in JSONB |
| `{{counterpart_attitude}}` | `counterparts.style` | TEXT field |
| `{{counterpart_distance}}` | Calculated from `offers` table | Distance between offers |
| `{{power_balance}}` | `counterparts.power_balance` NUMERIC | 0-100 scale |
| `{{counterpart_description}}` | `counterparts.constraints_meta` + `notes` | JSONB + TEXT |
| `{{inferred_preferences}}` | `interactions.observation->>'inferred_prefs'` | Agent's belief state |
| `{{observed_behaviour}}` | `events` filtered by `agent_id=opponent` | Event analysis |
| `{{last_round_beliefs_json}}` | `interactions.observation` (latest) | JSONB state |
| `{{product_name}}` | `products.name` | Join via `negotiation_products` |
| `{{zielpreis}}` | `product_dimension_values` where `dimension.code='price'` | Value field |
| `{{maxpreis}}` | Same as above (boundary value) | Min/max in value JSONB |
| `{{volume}}` | `product_dimension_values` where `dimension.code='quantity'` | Value field |
| `{{dimension_name}}` | `dimensions.name` | Master table |
| `{{dimension_unit}}` | `dimensions.unit` | Master table |
| `{{min_value}}`, `{{max_value}}`, `{{target_value}}` | `product_dimension_values.value` JSONB | Structured as `{min, max, target}` |
| `{{goal_priorities}}` | `registrations.goals` JSONB | Priority mapping |
| `{{last_round_intentions}}` | `interactions.observation->>'intentions'` | Agent's intention state |
| `{{dimension_examples}}` | Generated from `dimensions.spec` JSONB | Formatting function |
| `{{technique_name}}`, etc. | `influencing_techniques` table (unchanged) | Already exists |
| `{{tactic_name}}`, etc. | `negotiation_tactics` table (unchanged) | Already exists |

---

### 1.3 Migration Strategy

#### Option A: Clean Slate Migration (Recommended)

**Approach:**
- Drop existing database
- Run `new_schema.md` SQL directly
- Seed with fresh master data (markets, dimensions, counterparts)

**Pros:**
- Clean architecture with no legacy issues
- Faster development (1-2 days vs. 1-2 weeks)
- No complex data transformation logic
- Easier to test and validate

**Cons:**
- Lose existing test data (acceptable if non-production)

#### Option B: Incremental Migration

**Approach:**
- Create migration scripts to transform existing data
- Run in transaction with rollback capability
- Map old JSONB fields to new normalized tables

**Pros:**
- Preserve existing data
- Can run migrations incrementally

**Cons:**
- Complex mapping logic (2-3 days additional work)
- Risk of data inconsistencies
- Harder to test all edge cases

#### Recommendation

**Go with Option A (Clean Slate)** because:
1. You mentioned "we can reset the database if we want to completely start from scratch"
2. Faster time-to-production
3. Cleaner codebase
4. Better foundation for future development

---

## Phase 2: Frontend Changes

### 2.1 New Fields to Capture

#### GrundeinstellungenStep.tsx (Basic Settings)

**Current fields:**  Most fields already captured

**NEW additions needed:**

```typescript
export interface GrundeinstellungenData {
  // ... existing fields (title, userRole, negotiationType, etc.) ...

  // NEW: Map to registrations table
  organization: string;        // registrations.organization
  company: string;             // registrations.company
  country: string;             // registrations.country
  marketId: string;            // registrations.market_id (dropdown from markets table)

  // NEW: Goals structure
  goals: {
    primary: string[];         // registrations.goals JSONB
    secondary: string[];
  };
}
```

**UI Changes:**
- Add "Organization" and "Company" input fields
- Add "Country" dropdown (with country list)
- Add "Market Selection" dropdown (populated from `markets` table via API)
- Add multi-select for "Primary Goals" and "Secondary Goals" (e.g., "Best Price", "Fast Delivery", "Long-term Relationship")

---

#### GegenseiteStep.tsx (Counterpart Configuration)

**Current fields:** `beschreibungGegenseite`, `verhandlungsModus`

**NEW additions:**

```typescript
export interface GegenseiteData {
  // ... existing fields ...

  // NEW: Link to counterparts table
  counterpartId?: string;      // Optional: select existing counterpart
  counterpartName: string;     // counterparts.name
  counterpartKind: 'retailer' | 'manufacturer' | 'distributor' | 'other';
  counterpartPowerBalance: number; // 0-100 (merge with existing powerBalance)
  counterpartStyle: string;    // counterparts.style (same as verhandlungsModus)

  // NEW: Scenario context (moved from GrundeinstellungenStep)
  counterpartKnown: boolean;   // negotiations.scenario
  companyKnown: boolean;       // negotiations.scenario
}
```

**UI Changes:**
- Add "Select Existing Counterpart" dropdown (optional, prepopulates fields if selected)
- Add "Counterpart Type" radio buttons (retailer/manufacturer/distributor/other)
- Move `companyKnown`/`counterpartKnown` switches from GrundeinstellungenStep to here (more logical grouping)
- Rename `verhandlungsModus` label to match "Counterpart Style" concept

---

#### DimensionenStep.tsx (Products & Dimensions)

**  MAJOR RESTRUCTURING NEEDED**

**Current:** Hardcoded dimensions (price, volume, delivery, payment)

**NEW:** Support multiple products with arbitrary dimensions

**Data Structure:**

```typescript
export interface DimensionenData {
  products: ProductConfig[];
  dimensions: DimensionConfig[];
}

export interface ProductConfig {
  id: string;                  // Temp ID for UI (generate with uuid())
  productId?: string;          // Optional: link to existing product in products table
  produktName: string;         // products.name
  gtin?: string;              // products.gtin (optional)
  brand?: string;             // products.brand (optional)

  // Dimension values specific to this product
  dimensionValues: {
    [dimensionCode: string]: {
      minValue: number;
      maxValue: number;
      targetValue: number;
      priority: 1 | 2 | 3;    // 1=must-have, 2=important, 3=flexible
    }
  };
}

export interface DimensionConfig {
  id: string;                  // Temp ID for UI
  dimensionId?: string;        // Optional: link to existing dimension
  code: string;                // dimensions.code (e.g., "price", "delivery_days")
  name: string;                // dimensions.name (e.g., "Price per Unit", "Delivery Time")
  valueType: 'integer' | 'numeric' | 'text' | 'boolean' | 'json';
  unit?: string;               // dimensions.unit (e.g., "EUR", "days", "pieces")
  spec?: any;                  // dimensions.spec JSONB (optional, for advanced config)
}
```

**UI Changes:**

1. **Products Section:**
   - "Add Product" button ’ Opens modal/drawer to add product
   - Product cards showing: Name, GTIN (optional), Brand (optional)
   - Option to search and link to existing products in database
   - Each product has its own dimension configuration

2. **Dimensions Section:**
   - "Add Dimension" button ’ Opens modal to define custom dimension
   - Pre-loaded common dimensions: Price, Quantity, Delivery Time, Payment Terms, Quality Score, etc.
   - Users can add custom dimensions (e.g., "Packaging Type", "Sustainability Score")

3. **Matrix View:**
   - Rows = Products
   - Columns = Dimensions
   - Cells = Min/Max/Target value inputs + Priority selector (1/2/3)
   - **Example:**

```
                ,                     ,                     ,                     
 Product         Price (EUR/unit)     Quantity (pieces)    Delivery (days)     
                <                     <                     <                     $
 Widget A        Min: 80, Max: 100    Min: 1000, Max: 5000 Min: 10, Max: 30    
 (GTIN: 12345)   Target: 90           Target: 3000         Target: 14          
                 Priority: 1 P       Priority: 2 PP    Priority: 3 PPP 
                <                     <                     <                     $
 Widget B        Min: 50, Max: 70     Min: 500, Max: 2000  Min: 7, Max: 21     
 (GTIN: 67890)   Target: 60           Target: 1000         Target: 10          
                 Priority: 1 P       Priority: 2 PP    Priority: 3 PPP 
                4                     4                     4                     
```

**Implementation Notes:**
- Use React Hook Form with nested field arrays for complex state management
- Add proper validation (min d target d max)
- Show visual indicators for priority levels
- Allow drag-and-drop reordering of products/dimensions

---

#### TaktikenTechnikenStep.tsx

** No changes needed** - Already captures techniques/tactics correctly

---

#### ReviewStep.tsx

**Changes:**
- Update to display all new fields in review summary
- Show products in a table with all dimensions
- Show counterpart details
- Show market context

---

### 2.2 API Changes

#### New Endpoints Needed

```typescript
// Markets
GET /api/markets
Response: { markets: Array<{ id: string, name: string, region: string, currency_code: string }> }

// Dimensions (master list)
GET /api/dimensions
Response: { dimensions: Array<{ id: string, code: string, name: string, value_type: string, unit: string }> }

// Products (search/autocomplete)
GET /api/products/search?q=widget
Response: { products: Array<{ id: string, gtin: string, name: string, brand: string }> }

// Counterparts
GET /api/counterparts
Response: { counterparts: Array<{ id: string, name: string, kind: string, power_balance: number }> }

// Updated negotiation creation endpoint
POST /api/negotiations
Body: {
  registration: {
    organization: string,
    company: string,
    country: string,
    market_id: string,
    goals: { primary: string[], secondary: string[] },
    negotiation_type: string,
    negotiation_frequency: string
  },
  negotiation: {
    market_id: string,
    counterpart_id: string,
    scenario: {
      title: string,
      context: string,
      company_known: boolean,
      counterpart_known: boolean
    }
  },
  products: Array<{
    produktName: string,
    gtin?: string,
    brand?: string,
    dimensionValues: {
      [dimensionCode: string]: {
        minValue: number,
        maxValue: number,
        targetValue: number,
        priority: 1 | 2 | 3
      }
    }
  }>,
  dimensions: Array<{
    code: string,
    name: string,
    valueType: string,
    unit?: string
  }>,
  simulation: {
    num_rounds: number,
    seed?: string,
    settings: any
  }
}
```

---

## Phase 3: Service Function Changes

### 3.1 Python Script Updates

**File:** `scripts/run_production_negotiation.py`

#### 3.1.1 Input Data Structure

**Current Input:**
```json
{
  "negotiationId": "uuid",
  "simulationRunId": "uuid",
  "userRole": "buyer",
  "userZopa": { "price": { "min": 80, "max": 100, "target": 90 } },
  "counterpartDistance": { "price": -10 }
}
```

**NEW Input (aligned with new schema):**
```json
{
  "negotiationId": "uuid",
  "simulationRunId": "uuid",
  "roundId": "uuid",           // NEW: Link to negotiation_rounds
  "agentId": "uuid",           // NEW: Which agent is acting

  "userRole": "buyer",
  "maxRounds": 10,

  "products": [
    {
      "productId": "uuid",
      "name": "Widget A",
      "gtin": "12345",
      "dimensionValues": {
        "price": { "min": 80, "max": 100, "target": 90, "priority": 1, "unit": "EUR" },
        "quantity": { "min": 1000, "max": 5000, "target": 3000, "priority": 2, "unit": "pieces" }
      }
    }
  ],

  "market": {
    "name": "German Retail",
    "currency": "EUR",
    "intelligence": "Market analysis shows increasing demand..."
  },

  "counterpart": {
    "name": "BigRetailer GmbH",
    "kind": "retailer",
    "powerBalance": 70,
    "style": "aggressive",
    "known": false
  },

  "scenario": {
    "company_known": true,
    "negotiation_frequency": "yearly",
    "negotiation_type": "multi-year",
    "context": "Annual contract renewal..."
  },

  "previousRounds": [
    {
      "round": 1,
      "events": [
        { "kind": "message", "role": "assistant", "content": "...", "agent_id": "..." },
        { "kind": "action", "name": "make_offer", "parameters": { "price": 95 } }
      ]
    }
  ],

  "opponentLastOffer": {
    "price": 85,
    "quantity": 2000,
    "terms": { "payment_days": 30, "delivery_days": 14 }
  },

  "lastBeliefs": {
    "inferred_preferences": "Opponent prioritizes price over volume",
    "opponent_urgency": "medium"
  },
  "lastIntentions": "Push on price, concede on delivery time"
}
```

#### 3.1.2 Prompt Construction

**Updated `_build_prompt()` method:**

```python
def _build_prompt(self, agent_role: str) -> str:
    """Build prompt using Langfuse template with new variables"""

    # Fetch Langfuse prompt
    prompt_name = f"agents/{'self_agent' if agent_role == self.user_role else 'opponent_agent'}"
    langfuse_prompt = self.langfuse.get_prompt(prompt_name)

    # Build variables dict from new schema
    variables = {
        # Agent identity
        "agent_role": agent_role,
        "company": self.negotiation_data["registration"]["organization"],
        "negotiation_title": self.negotiation_data["scenario"]["title"],

        # Round state
        "current_round": self.negotiation_data["currentRound"],
        "max_rounds": self.negotiation_data["maxRounds"],

        # History
        "previous_rounds": self._format_previous_rounds(),
        "current_round_message": self._get_latest_message(),
        "opponent_last_offer": json.dumps(self.negotiation_data["opponentLastOffer"]),

        # Context
        "product_market_description": self.negotiation_data["market"]["description"],
        "negotiation_context": self.negotiation_data["scenario"]["context"],
        "negotiation_frequency": self.negotiation_data["scenario"]["negotiation_frequency"],
        "negotiation_type": self.negotiation_data["scenario"]["negotiation_type"],
        "intelligence": self.negotiation_data["market"]["intelligence"],

        # Opponent model
        "counterpart_company": self.negotiation_data["counterpart"]["name"],
        "counterpart_known": str(self.negotiation_data["scenario"]["counterpart_known"]),
        "company_known": str(self.negotiation_data["scenario"]["company_known"]),
        "counterpart_attitude": self.negotiation_data["counterpart"]["style"],
        "counterpart_distance": self._calculate_distance(),
        "power_balance": str(self.negotiation_data["counterpart"]["powerBalance"]),
        "counterpart_description": self.negotiation_data["counterpart"]["description"],

        # Agent state
        "inferred_preferences": self.negotiation_data.get("lastBeliefs", {}).get("inferred_preferences", ""),
        "observed_behaviour": self._summarize_opponent_behavior(),
        "last_round_beliefs_json": json.dumps(self.negotiation_data.get("lastBeliefs", {})),
        "last_round_intentions": self.negotiation_data.get("lastIntentions", ""),

        # Products and dimensions
        **self._build_dimension_variables(),

        # Techniques and tactics
        **self._build_technique_tactic_variables(),
    }

    return langfuse_prompt.compile(**variables)

def _build_dimension_variables(self) -> dict:
    """Build dimension-related variables for prompt"""
    products = self.negotiation_data["products"]

    # Build product lists
    product_names = [p["name"] for p in products]

    # Build dimension arrays (flatten across all products)
    dimensions = {}
    for product in products:
        for dim_code, dim_config in product["dimensionValues"].items():
            if dim_code not in dimensions:
                dimensions[dim_code] = []
            dimensions[dim_code].append({
                "product": product["name"],
                "min_value": dim_config["min"],
                "max_value": dim_config["max"],
                "target_value": dim_config["target"],
                "priority": dim_config["priority"],
                "unit": dim_config.get("unit", "")
            })

    # Format for prompt
    return {
        "product_name": ", ".join(product_names),
        "dimension_name": ", ".join(dimensions.keys()),
        "dimension_unit": json.dumps({k: v[0].get("unit") for k, v in dimensions.items()}),
        "min_value": json.dumps({k: [d["min_value"] for d in v] for k, v in dimensions.items()}),
        "max_value": json.dumps({k: [d["max_value"] for d in v] for k, v in dimensions.items()}),
        "target_value": json.dumps({k: [d["target_value"] for d in v] for k, v in dimensions.items()}),
        "goal_priorities": json.dumps({k: [d["priority"] for d in v] for k, v in dimensions.items()}),
        "dimension_examples": self._generate_examples(dimensions),
        "dimension_schema": self._generate_schema(dimensions),
        "beliefs_schema": self._generate_beliefs_schema(),
    }
```

#### 3.1.3 Output Processing

**Save agent response to new tables:**

```python
async def _save_round_results(self, round_no: int, agent_response: dict):
    """Save negotiation round results to new schema tables"""

    # 1. Save to events table
    await self._save_event({
        "round_id": self.current_round_id,
        "event_kind": "message",
        "role": "assistant",
        "agent_id": self.current_agent_id,
        "name": "agent_response",
        "parameters": {},
        "observations": agent_response.get("bdi_state", {}).get("beliefs", {}),
        "reasoning": agent_response.get("internal_analysis", "")
    })

    # 2. Save offer to offers table
    if agent_response.get("offer"):
        offer_id = await self._save_offer({
            "round_id": self.current_round_id,
            "side": "buyer" if self.user_role == "buyer" else "seller",
            "agent_id": self.current_agent_id,
            "price": agent_response["offer"]["dimension_values"].get("price"),
            "quantity": agent_response["offer"]["dimension_values"].get("quantity"),
            "terms": {k: v for k, v in agent_response["offer"]["dimension_values"].items()
                     if k not in ["price", "quantity"]},
            "accepted": agent_response.get("action") == "accept"
        })

        # 3. Calculate and save concessions (if previous offer exists)
        if self.previous_offer:
            await self._save_concessions(offer_id, self.previous_offer, agent_response["offer"])

    # 4. Save to interactions table (RL-style step tracking)
    await self._save_interaction({
        "round_id": self.current_round_id,
        "step_no": round_no,
        "agent_id": self.current_agent_id,
        "observation": {
            "beliefs": agent_response.get("bdi_state", {}).get("beliefs", {}),
            "intentions": agent_response.get("bdi_state", {}).get("intentions", "")
        },
        "reward": self._calculate_reward(agent_response)
    })

    # 5. Update agent_metrics table
    await self._update_agent_metrics(agent_response)
```

---

### 3.2 TypeScript Service Updates

**File:** `server/services/simulation-queue.ts`

#### 3.2.1 Data Fetching

**NEW: Multi-table joins to build negotiation context**

```typescript
async function fetchNegotiationData(negotiationId: string, simulationRunId: string) {
  // Join negotiations ’ registrations ’ markets ’ counterparts ’ products ’ dimensions
  const data = await db.query.negotiations.findFirst({
    where: eq(negotiations.id, negotiationId),
    with: {
      registration: {
        with: {
          market: true
        }
      },
      counterpart: true,
      products: {
        with: {
          dimensionValues: {
            with: {
              dimension: true
            }
          }
        }
      },
      rounds: {
        with: {
          events: {
            orderBy: [asc(events.created_at)]
          },
          offers: {
            orderBy: [desc(offers.created_at)],
            limit: 1
          },
          interactions: {
            orderBy: [desc(interactions.created_at)],
            limit: 1
          }
        }
      }
    }
  });

  // Transform to Python input format
  return transformToNegotiationInput(data);
}
```

#### 3.2.2 Result Processing

**NEW: Parse Python output and save to multiple tables**

```typescript
async function saveNegotiationResults(simulationRunId: string, pythonOutput: any) {
  const { round_no, agent_response, outcome } = pythonOutput;

  await db.transaction(async (tx) => {
    // 1. Create/update negotiation_rounds entry
    const [round] = await tx.insert(negotiationRounds).values({
      negotiation_id: negotiationId,
      round_no: round_no,
      state: agent_response.bdi_state || {}
    }).returning();

    // 2. Insert events
    await tx.insert(events).values({
      round_id: round.id,
      event_kind: 'message',
      role: 'assistant',
      agent_id: agentId,
      parameters: agent_response.offer || {},
      observations: agent_response.bdi_state?.beliefs || {},
      reasoning: agent_response.internal_analysis
    });

    // 3. Insert offer
    if (agent_response.offer) {
      const [offer] = await tx.insert(offers).values({
        round_id: round.id,
        side: userRole,
        agent_id: agentId,
        price: agent_response.offer.dimension_values.price,
        quantity: agent_response.offer.dimension_values.quantity,
        terms: extractTerms(agent_response.offer.dimension_values),
        accepted: agent_response.action === 'accept'
      }).returning();

      // 4. Calculate and insert concessions
      if (previousOffer) {
        const concessions = calculateConcessions(previousOffer, offer);
        await tx.insert(concessions).values(concessions.map(c => ({
          offer_id: offer.id,
          ...c
        })));
      }
    }

    // 5. Insert interaction
    await tx.insert(interactions).values({
      round_id: round.id,
      step_no: round_no,
      agent_id: agentId,
      observation: agent_response.bdi_state || {},
      reward: calculateReward(agent_response)
    });

    // 6. Update agent_metrics
    await tx.insert(agentMetrics).values({
      agent_id: agentId,
      metric_name: 'offer_quality',
      metric_value: agent_response.offer?.confidence || 0,
      details: { round: round_no }
    });
  });
}
```

---

## Phase 4: Implementation Roadmap

### Week 1: Database Foundation

#### Day 1-2: Schema Migration
- [ ] Review `new_schema.md` with team
- [ ] Backup existing database (if Option B chosen)
- [ ] Drop and recreate database with new schema (if Option A chosen)
- [ ] Create seed data SQL scripts for:
  - `markets` (e.g., "US Retail", "EU Wholesale", "APAC Manufacturing")
  - `dimensions` (e.g., "price", "quantity", "delivery_time", "payment_terms", "quality_score")
  - `counterparts` (sample retailers, manufacturers, distributors)

#### Day 3: Drizzle Schema Update
- [ ] Update `shared/schema.ts` to match `new_schema.md`
- [ ] Remove deprecated tables/fields
- [ ] Add new tables (markets, counterparts, dimensions, events, offers, etc.)
- [ ] Add proper TypeScript types and Zod schemas
- [ ] Run `npm run db:push` to sync schema

#### Day 4-5: Seed Data & Testing
- [ ] Create CSV import scripts for master data
- [ ] Import sample markets (3-5 markets covering different regions)
- [ ] Import sample dimensions (8-10 common dimensions)
- [ ] Import sample counterparts (5-10 sample counterparts)
- [ ] Test database queries and joins
- [ ] Verify foreign key constraints work correctly

---

### Week 2: Backend API Development

#### Day 1-2: API Endpoints
- [ ] Create `GET /api/markets` (list all markets)
- [ ] Create `GET /api/dimensions` (list master dimensions)
- [ ] Create `GET /api/counterparts` (list counterparts, with filters)
- [ ] Create `GET /api/products/search?q=query` (search products)
- [ ] Update `POST /api/negotiations` to handle new structure
- [ ] Add proper input validation with Zod
- [ ] Add error handling

#### Day 3-4: Service Layer
- [ ] Update `fetchNegotiationData()` with new multi-table joins
- [ ] Update `saveNegotiationResults()` to write to new tables (events, offers, interactions, agent_metrics)
- [ ] Create helper functions for:
  - Event logging
  - Offer/concession tracking
  - Distance calculation
  - Agent metrics updates
- [ ] Add database transaction handling
- [ ] Add error recovery logic

#### Day 5: Python Integration
- [ ] Update `run_production_negotiation.py` input parsing
- [ ] Update `_build_prompt()` with new variable mapping
- [ ] Update `_build_dimension_variables()` for multiple products
- [ ] Update `_save_round_results()` to match new schema
- [ ] Test end-to-end negotiation flow with dummy data
- [ ] Verify Langfuse tracing works with new variables

---

### Week 3: Frontend Rebuild

#### Day 1-2: GrundeinstellungenStep
- [ ] Add Organization/Company/Country fields
- [ ] Add Market selection dropdown (fetch from `GET /api/markets`)
- [ ] Add Goals multi-select (Primary/Secondary)
- [ ] Update form validation
- [ ] Update TypeScript interfaces
- [ ] Test form state management

#### Day 2-3: DimensionenStep (Major Work)
- [ ] Build new product configuration UI
  - [ ] "Add Product" button + modal
  - [ ] Product list/cards view
  - [ ] Product search/autocomplete (link to existing products)
- [ ] Build dimension matrix view
  - [ ] Row = Product, Column = Dimension
  - [ ] Min/Max/Target sliders per cell
  - [ ] Priority selector (1/2/3) per cell
- [ ] Add "Add Dimension" modal
  - [ ] Select from common dimensions
  - [ ] Create custom dimension
- [ ] Implement validation (min d target d max)
- [ ] Add drag-and-drop reordering (optional, nice-to-have)

#### Day 4: GegenseiteStep
- [ ] Add counterpart selection dropdown (fetch from `GET /api/counterparts`)
- [ ] Add counterpart type radio buttons (retailer/manufacturer/distributor/other)
- [ ] Move `company_known`/`counterpart_known` switches from GrundeinstellungenStep
- [ ] Update form state
- [ ] Update TypeScript interfaces

#### Day 5: ReviewStep & Integration
- [ ] Update review page to show all new fields
  - [ ] Display products in table format
  - [ ] Display all dimensions with values
  - [ ] Display counterpart details
  - [ ] Display market context
- [ ] Update form submission to call new `POST /api/negotiations` API
- [ ] Test full wizard flow (all 5 steps)
- [ ] Fix any UI/UX issues

---

### Week 4: Testing & Refinement

#### Day 1-2: Integration Testing
- [ ] Test complete negotiation creation flow
- [ ] Test negotiation execution with new schema
- [ ] Verify all prompt variables are populated correctly
- [ ] Test event logging and offer tracking
- [ ] Test concession calculation
- [ ] Test agent metrics updates
- [ ] Verify Langfuse traces show correct data

#### Day 3: Performance Testing
- [ ] Test database query performance with joins
- [ ] Add indexes where needed:
  - [ ] Index on `events.round_id`
  - [ ] Index on `offers.round_id`
  - [ ] Index on `interactions.round_id`
  - [ ] GIN index on JSONB fields (observations, parameters)
- [ ] Optimize API response times
- [ ] Test with larger datasets (100+ negotiations)

#### Day 4-5: Bug Fixes & Polish
- [ ] Fix any edge cases discovered during testing
- [ ] Update documentation:
  - [ ] API documentation
  - [ ] Database schema documentation
  - [ ] Developer handover documentation
- [ ] Code review and cleanup
- [ ] Prepare for deployment

---

## Critical Issues & Concerns

### =4 High Priority Issues in New Schema

#### 1. **Missing Junction Table Definition**

**Issue:** `negotiation_products` table is referenced in the implementation plan but **NOT defined in `new_schema.md` line 86-90**.

**Impact:** Cannot link products to negotiations. The schema references this table but doesn't create it.

**Current schema (lines 86-90):**
```sql
-- Many products per negotiation
CREATE TABLE negotiation_products (
  negotiation_id BIGINT NOT NULL REFERENCES negotiations(negotiation_id) ON DELETE CASCADE,
  product_id     BIGINT NOT NULL REFERENCES products(product_id),
  PRIMARY KEY (negotiation_id, product_id)
);
```

**Status:**  **Actually DEFINED** - This is correct in the schema!

---

#### 2. **Overlapping Data in `offers` and `product_dimension_values`**

**Issue:**
- `offers` table has columns: `price`, `quantity`, `terms` (JSONB)
- But product-specific values should come from `product_dimension_values`
- **Unclear:** How do multi-product negotiations map to a single offer record?

**Example Problem:**
- Negotiation has 2 products: Widget A and Widget B
- Agent makes offer: Widget A at ¬90, Widget B at ¬60
- How is this stored in `offers` table which only has single `price` field?

**Impact:** Data model confusion - which table is source of truth?

**Recommendation:**

**Option A:** Make `offers` purely structural (just offer_id, round_id, side, accepted), and store all values in a separate `offer_dimension_values` table

```sql
CREATE TABLE offer_values (
  offer_value_id      BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  offer_id            BIGINT NOT NULL REFERENCES offers(offer_id) ON DELETE CASCADE,
  negotiation_product_id BIGINT REFERENCES negotiation_products... -- Need composite key handling
  dimension_code      TEXT NOT NULL,
  proposed_value      NUMERIC NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Option B:** Document that `offers.terms` JSONB contains ALL products/dimensions in structured format:

```json
{
  "products": [
    { "product_id": 123, "price": 90, "quantity": 3000 },
    { "product_id": 456, "price": 60, "quantity": 1500 }
  ],
  "global_terms": {
    "payment_days": 30,
    "delivery_days": 14
  }
}
```

**Recommended:** Option B for simplicity, but document clearly in schema comments.

---

#### 3. **`product_dimension_values` Temporal Design Complexity**

**Issue:** Table uses `measured_at` for temporal tracking (line 54), but:
- How do you query "current" values vs. historical?
- How do you handle updates (insert new row or update existing)?
- No `valid_from`/`valid_to` for proper temporal queries
- Primary key includes `measured_at` - means you can't easily update a value

**Current schema (lines 50-57):**
```sql
CREATE TABLE product_dimension_values (
  product_id     BIGINT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  dimension_id   BIGINT NOT NULL REFERENCES dimensions(dimension_id) ON DELETE CASCADE,
  value          JSONB  NOT NULL,
  measured_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  source         TEXT,
  PRIMARY KEY (product_id, dimension_id, measured_at)
);
```

**Impact:**
- Complex queries to get "current" values
- Potential for inconsistent data (multiple "current" rows)
- Hard to know which row is the "active" one

**Recommendation:**

Add `is_current` boolean flag:

```sql
CREATE TABLE product_dimension_values (
  product_dimension_value_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  product_id     BIGINT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  dimension_id   BIGINT NOT NULL REFERENCES dimensions(dimension_id) ON DELETE CASCADE,
  value          JSONB  NOT NULL,
  is_current     BOOLEAN NOT NULL DEFAULT TRUE,
  valid_from     TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to       TIMESTAMPTZ,
  source         TEXT,
  UNIQUE (product_id, dimension_id, is_current) WHERE is_current = TRUE
);

CREATE INDEX idx_pdv_current ON product_dimension_values(product_id, dimension_id) WHERE is_current = TRUE;
```

This allows:
- Easy querying of current values: `WHERE is_current = TRUE`
- Temporal history: `WHERE valid_from <= ? AND (valid_to IS NULL OR valid_to > ?)`
- Unique constraint ensures only one "current" row per product×dimension

---

#### 4. **Missing Indexes**

**Issue:** No explicit indexes defined beyond foreign keys and primary keys.

**Impact:** Slow queries on:
- Event log filtering by `round_id`, `agent_id`, `event_kind`
- Offers filtering by `round_id`, `side`
- Time-based queries on `created_at` fields
- JSONB field queries

**Recommendation:**

Add indexes:

```sql
-- Event log indexes
CREATE INDEX idx_events_round_id ON events(round_id);
CREATE INDEX idx_events_agent_id ON events(agent_id);
CREATE INDEX idx_events_kind ON events(event_kind);
CREATE INDEX idx_events_created_at ON events(created_at);

-- Offers indexes
CREATE INDEX idx_offers_round_id ON offers(round_id);
CREATE INDEX idx_offers_side ON offers(side);
CREATE INDEX idx_offers_accepted ON offers(accepted);

-- Interactions indexes
CREATE INDEX idx_interactions_round_id ON interactions(round_id);
CREATE INDEX idx_interactions_agent_id ON interactions(agent_id);

-- Product dimension values indexes
CREATE INDEX idx_pdv_product_id ON product_dimension_values(product_id);
CREATE INDEX idx_pdv_dimension_id ON product_dimension_values(dimension_id);

-- GIN indexes for JSONB columns (enables JSONB queries)
CREATE INDEX idx_events_parameters_gin ON events USING GIN(parameters);
CREATE INDEX idx_events_observations_gin ON events USING GIN(observations);
CREATE INDEX idx_offers_terms_gin ON offers USING GIN(terms);
CREATE INDEX idx_interactions_observation_gin ON interactions USING GIN(observation);
```

---

#### 5. **JSONB Schema Validation Missing**

**Issue:** Many JSONB columns (`terms`, `parameters`, `observations`, `config`, `spec`, etc.) have no schema validation.

**Impact:**
- Runtime errors when code expects certain JSONB structure
- Inconsistent data across rows
- Hard to query without knowing structure

**Recommendation:**

**Option A:** Add CHECK constraints with JSON schema validation (PostgreSQL 14+):

```sql
-- Example for offers.terms
ALTER TABLE offers ADD CONSTRAINT chk_offers_terms_schema
  CHECK (
    jsonb_matches_schema(
      '{
        "type": "object",
        "properties": {
          "payment_days": {"type": "number"},
          "delivery_days": {"type": "number"}
        }
      }'::jsonb,
      terms
    )
  );
```

**Option B:** Document expected schemas in table comments (simpler, recommended):

```sql
COMMENT ON COLUMN offers.terms IS '
Expected structure:
{
  "payment_days": <number>,
  "delivery_days": <number>,
  "listing_fee_percent": <number>,
  "rebate_percent": <number>,
  "products": [
    { "product_id": <number>, "price": <number>, "quantity": <number> }
  ]
}
';

COMMENT ON COLUMN events.parameters IS '
Structure depends on event_kind:
- message: { "content": <text> }
- action: { "action_name": <text>, "action_params": <object> }
- tool: { "tool_name": <text>, "tool_input": <object>, "tool_output": <object> }
';
```

**Recommendation:** Start with Option B (documentation), add Option A later if needed.

---

#### 6. **Ambiguous Relationship: `agents` ” `simulations`**

**Issue:** Looking at lines 124-134:

```sql
CREATE TABLE agents (
  agent_id        BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  registration_id BIGINT REFERENCES registrations(registration_id),
  simulation_id   BIGINT REFERENCES simulations(simulation_id) ON DELETE CASCADE,
  ...
);
```

**Questions:**
- Are agents tied to specific simulation runs? (If yes, they can't be reused)
- Or are agents "templates" that can be used across simulations?
- Current schema: agent belongs to ONE simulation ’ Can't reuse agents

**Impact:**
- Data duplication (same agent config created multiple times)
- Can't analyze agent performance across simulations

**Recommendation:**

**Option A:** Keep current design IF agents are simulation-specific (e.g., agents learn/adapt during simulation)

**Option B:** Split into two tables if agents should be reusable:

```sql
-- Reusable agent templates
CREATE TABLE agent_templates (
  agent_template_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name              TEXT NOT NULL,
  role              agent_role,
  agent_kind        agent_kind,
  model_name        TEXT,
  system_prompt     TEXT,
  policy_id         BIGINT REFERENCES policies(policy_id),
  hyperparams       JSONB NOT NULL DEFAULT '{}'
);

-- Agent instances in specific simulations
CREATE TABLE agent_instances (
  agent_id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  agent_template_id BIGINT REFERENCES agent_templates(agent_template_id),
  simulation_id     BIGINT NOT NULL REFERENCES simulations(simulation_id) ON DELETE CASCADE,
  state             JSONB NOT NULL DEFAULT '{}',  -- Agent's evolving state during simulation
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Recommendation:** Clarify with team - does an agent's config change during a simulation, or is it static?

---

### =á Medium Priority Issues

#### 7. **`counterparts.constraints_meta` Too Vague**

**Issue:** JSONB field with no documented structure (line 27).

**Recommendation:**

Document expected schema:

```sql
COMMENT ON COLUMN counterparts.constraints_meta IS '
Expected structure:
{
  "min_order_quantity": <number>,
  "payment_terms_required": <text>,  -- e.g., "NET30", "NET60"
  "preferred_delivery_time": <number>,  -- days
  "quality_requirements": <object>,
  "certification_requirements": [<text>]
}
';
```

---

#### 8. **Experiment/Benchmark Infrastructure Underdeveloped**

**Issue:** `experiments`, `benchmarks`, `experiment_runs` tables exist (lines 195-200+) but:
- No clear workflow for how experiments are created/run
- No link to specific simulation configurations
- `metrics` field in `experiment_runs` is JSONB with no schema

**Recommendation:**

**Defer to Phase 2** - Focus on core negotiation functionality first. Add experiment infrastructure once you have:
- 50+ negotiation runs to analyze
- Clear understanding of what metrics to track
- Clear experimental hypotheses

---

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Complexity of multi-table joins** | Slow DB queries | High | Add indexes (see Issue #4), use query optimization, consider materialized views for reporting |
| **Frontend state management complexity** | Buggy UI, poor UX | Medium | Use React Hook Form with nested field arrays, add proper TypeScript types, comprehensive testing |
| **Python”TypeScript data sync** | Schema mismatch errors at runtime | High | Create shared TypeScript’Python type generator, validate with Zod (TS) and Pydantic (Python) |
| **Langfuse prompt variable explosion** | Hard to maintain prompts | Medium | Use nested objects in JSONB, create helper functions for formatting, version prompts carefully |
| **Event log performance** | Slow queries on large datasets | Medium | Partition events table by `negotiation_id`, add GIN indexes on JSONB (see Issue #4), archive old events |
| **Multi-product offer storage confusion** | Inconsistent data, bugs | High | Clarify design and document `offers.terms` structure (see Issue #2) |
| **Temporal data model complexity** | Complex queries, data inconsistency | Medium | Add `is_current` flag to `product_dimension_values` (see Issue #3) |
| **JSONB schema drift** | Runtime errors, hard to debug | Medium | Document all JSONB schemas in comments (see Issue #5), validate in application layer |
| **Team knowledge transfer** | Only one person understands system | Medium | Document thoroughly, pair programming, code reviews |
| **Scope creep** | Timeline extends beyond 4 weeks | Medium | Defer experiment/benchmark features to Phase 2, focus on MVP |

---

## Success Criteria

### Database 
- [ ] All tables from `new_schema.md` created
- [ ] Critical issues (#1-#6) resolved
- [ ] Master data seeded (markets, dimensions, counterparts)
- [ ] Drizzle ORM schema matches SQL schema
- [ ] All foreign keys and constraints working correctly
- [ ] Indexes added for performance (Issue #4)
- [ ] JSONB schemas documented (Issue #5)

### Backend 
- [ ] All API endpoints return data from new schema
- [ ] Python script successfully builds prompts with all variables
- [ ] Results saved to events/offers/interactions/agent_metrics tables
- [ ] Multi-table joins optimized and tested
- [ ] Error handling and transaction rollback working
- [ ] Offer storage handles multi-product scenarios (Issue #2)

### Frontend 
- [ ] Users can configure negotiations with multiple products
- [ ] Users can add/remove custom dimensions
- [ ] Dimension matrix view works correctly
- [ ] All form data correctly mapped to new schema
- [ ] Form validation prevents invalid inputs
- [ ] Review step shows all configuration clearly

### Integration 
- [ ] End-to-end negotiation runs successfully
- [ ] Langfuse traces show proper variable substitution
- [ ] Results queryable from new schema tables
- [ ] Event log accurately tracks negotiation flow
- [ ] Offer/concession tracking works correctly
- [ ] Agent metrics updated in real-time

### Documentation 
- [ ] Database schema documented (including JSONB structures)
- [ ] API endpoints documented
- [ ] Prompt variable mappings documented
- [ ] Developer handover document updated
- [ ] README updated with new setup instructions

---

## Recommendations Summary

### Before Starting Implementation (CRITICAL)

1. **Fix Critical Schema Issues** (1-2 days)
   -  Junction table exists (Issue #1 - no fix needed)
   -   Clarify multi-product offer storage (Issue #2) - **TEAM DECISION NEEDED**
   -   Add `is_current` flag to `product_dimension_values` (Issue #3)
   -  Add indexes (Issue #4)
   -  Document JSONB schemas (Issue #5)
   -   Clarify agent reusability (Issue #6) - **TEAM DECISION NEEDED**

2. **Team Alignment** (0.5 days)
   - Review this document with PhD student
   - **DECIDE:** Multi-product offer storage approach (Issue #2)
   - **DECIDE:** Agent reusability model (Issue #6)
   - **DECIDE:** Migration strategy (Option A: Clean Slate vs. Option B: Incremental)
   - Prioritize MVP features vs. Phase 2
   - Assign responsibilities

3. **Risk Mitigation Setup** (0.5 days)
   - Set up TypeScript’Python type validation
   - Create database backup strategy
   - Set up development/staging environments

### After Implementation

1. **Monitoring & Observability**
   - Add query performance monitoring (especially multi-table joins)
   - Add error tracking (Sentry or similar)
   - Monitor Langfuse costs and token usage

2. **Phase 2 Features** (Defer to later)
   - Experiment/benchmark infrastructure
   - Advanced analytics and reporting
   - Agent policy optimization
   - Multi-agent tournaments

---

## Appendix: Key Questions for Team Discussion

### =4 CRITICAL DECISIONS NEEDED:

1. **Multi-Product Offers (Issue #2):**
   - Q: How should offers for multiple products be stored?
   - Options:
     - A: Single `offers.terms` JSONB with all products
     - B: Separate `offer_values` table linking offers to products/dimensions
   - **Recommendation:** Option A (JSONB) for simplicity

2. **Agent Reusability (Issue #6):**
   - Q: Should agents be reusable across simulations, or simulation-specific?
   - Impact: Affects whether we split `agents` into `agent_templates` + `agent_instances`
   - **Recommendation:** Clarify if agent learns/adapts during simulation

3. **Migration Strategy:**
   - Q: Clean slate (Option A) or incremental migration (Option B)?
   - **Recommendation:** Option A (clean slate) per your earlier comment

### =á LOWER PRIORITY:

4. **Temporal Data Model (Issue #3):**
   - Q: Do we need full temporal history of product dimension values?
   - **Recommendation:** Add `is_current` flag for now, revisit if complex history needed

5. **MVP Scope:**
   - Q: Include experiments/benchmarks in Phase 1 or defer to Phase 2?
   - **Recommendation:** Defer to Phase 2

6. **Timeline:**
   - Q: Is 4 weeks realistic given critical issues?
   - **Recommendation:** 5-6 weeks more realistic (1 week for schema fixes + 4 weeks implementation)

7. **Resources:**
   - Q: Do we need additional developer help for frontend rebuild?
   - **Recommendation:** DimensionenStep rebuild is ~2-3 days work, assess if bottleneck

---

**End of Document**

_For questions or clarifications, contact Christian Au._

_Generated with assistance from Claude (Anthropic)._
