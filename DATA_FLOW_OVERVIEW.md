# Data Flow Overview: Negotiation Simulation Tool

**Last Updated:** November 2025
**Status:** ✅ Production Ready

This document traces the complete data flow from configuration input through AI processing to analysis output, highlighting how the data model supports each stage.

---

## 1. INPUT: Configuration & Base Data

### 1.1 Frontend Configuration (CreateNegotiationForm.tsx)

The configuration form collects data across 6 steps:

#### Step 1: Company Data
- `organization` (string)
- `company` (optional brand name)
- `country` (string)
- `negotiationType` (e.g., "Jahresgespräch")
- `relationshipType` (e.g., "strategisch")
- `negotiationFrequency` (e.g., "jährlich")

**Stored in DB:**
- `registrations` table → `{organization, company, country, negotiationType, negotiationFrequency}`

#### Step 2: Market Data
- `name` (market name)
- `region` (optional)
- `countryCode` (e.g., "DE")
- `currencyCode` (e.g., "EUR")
- `intelligence` (market insights text)
- `notes` (additional notes)

**Stored in DB:**
- `markets` table → `{name, region, countryCode, currencyCode, registrationId}`
- `markets.meta` → `{intelligence, notes}`

#### Step 3: Counterpart Data
- `name` (partner company)
- `kind` (enum: retailer/manufacturer/distributor/other)
- `powerBalance` (0-100 slider)
- `dominance` (-100 to +100 slider, Interpersonal Circumplex)
- `affiliation` (-100 to +100 slider, Interpersonal Circumplex)
- `style` (negotiation style, e.g., "partnerschaftlich")
- `notes` (optional context)

**Stored in DB:**
- `counterparts` table → `{name, kind, powerBalance, dominance, affiliation, style, notes, registrationId}`

#### Step 4: Products
For each product:
- `name` (product name)
- `brand` (optional)
- `targetPrice` (decimal)
- `minPrice` (decimal - seller's floor)
- `maxPrice` (decimal - buyer's ceiling)
- `estimatedVolume` (integer units)

**Stored in DB:**
- `products` table → `{name, brand, registrationId}` (optional `categoryPath` remains unused)
- `products.attrs` → `{targetPrice, minPrice, maxPrice, estimatedVolume}`

#### Step 5: Dimensions
For each negotiation dimension:
- `name` (e.g., "Preis pro Einheit")
- `unit` (e.g., "EUR")
- `minValue` (minimum acceptable)
- `maxValue` (maximum acceptable)
- `targetValue` (desired outcome)
- `priority` (1=critical, 2=wichtig, 3=flexibel)

**Stored in DB:**
- Embedded in `negotiations.scenario` → `dimensions: [{name, unit, minValue, maxValue, targetValue, priority}]`

#### Step 6: Strategy
- `userRole` (enum: buyer/seller) - moved to Step 1
- `maxRounds` (1-50)
- `selectedTechniques` (array of technique IDs)
- `selectedTactics` (array of tactic IDs)
- `companyKnown` (boolean) - moved to Step 1
- `counterpartKnown` (boolean) - moved to Step 1
- `counterpartDistance` (0-100%) - moved to Step 1

**Stored in DB:**
- `negotiations.scenario` → `{userRole, negotiationType, relationshipType, negotiationFrequency, maxRounds, selectedTechniques, selectedTactics, counterpartDistance: {gesamt: X}, metadata: {companyKnown, counterpartKnown}, dimensions, companyProfile, market, counterpartProfile, products}`
- `negotiations.description` → general remarks/hints (from Step 1)
- `markets.meta.intelligence` → market-specific prompt context (from Step 2)

### 1.2 Base Data (Seeded in Database)

These are pre-loaded reference data used across simulations:

#### Influencing Techniques (`influencing_techniques` table)
Base data loaded from CSV:
- `id` (UUID)
- `name` (technique name)
- `beschreibung` (description in German)
- `anwendung` (application guidance)
- `wichtigeAspekte` (JSONB: key aspects array)
- `keyPhrases` (JSONB: example phrases array)

**Used by:** Selected via `scenario.selectedTechniques[]` → referenced in `simulation_runs.techniqueId`

#### Negotiation Tactics (`negotiation_tactics` table)
Base data loaded from CSV:
- `id` (UUID)
- `name` (tactic name)
- `beschreibung` (description)
- `anwendung` (application)
- `wichtigeAspekte` (JSONB: key aspects)
- `keyPhrases` (JSONB: phrases)

**Used by:** Selected via `scenario.selectedTactics[]` → referenced in `simulation_runs.tacticId`

#### Personality Types (`personality_types` table)
Base data for agent personality variation:
- `archetype` (unique personality type)
- `behaviorDescription` (text)
- `advantages` (text)
- `risks` (text)

**Used by:** Referenced in `simulation_runs.personalityId` for personality variations

---

## 2. AUTHENTICATION: User Access & Data Isolation

### 2.1 JWT Authentication Flow

The system uses **custom JWT-based authentication** (replaced Stack Auth in Q4 2024):

```
User Login
  ↓
POST /api/login {username, password}
  ↓
Server validates credentials (bcrypt compare)
  ↓
JWT token generated (7-day expiry, signed with JWT_SECRET)
  ↓
Token returned to frontend → stored in localStorage ("auth_token")
  ↓
All subsequent API requests include:
  Authorization: Bearer <token>
  ↓
Server middleware validates token → extracts userId (integer)
  ↓
All DB queries filtered: WHERE user_id = req.userId
```

### 2.2 Authentication Middleware

**Server-Side** (`server/middleware/auth.ts`):

#### `requireAuth()` Middleware
- Validates JWT token from `Authorization: Bearer <token>` header
- Extracts `userId` (integer) from token payload
- Sets `req.userId` for downstream handlers
- Returns 401 Unauthorized if token invalid/missing
- Used on all protected routes

#### `optionalAuth()` Middleware
- Same validation logic but doesn't enforce authentication
- Sets `req.userId` if token valid, otherwise continues without
- Used for routes that work differently when authenticated

**Frontend Integration** (`client/src/lib/`):

#### `fetchWithAuth()` Wrapper
- Wraps standard `fetch()` function
- Automatically includes `Authorization: Bearer <token>` header
- Reads token from `localStorage.getItem("auth_token")`
- On 401 response: clears token + redirects to splash screen

#### `queryClient` Configuration
- TanStack Query client with custom `queryFn`
- Automatically injects JWT token in all queries
- Handles 401 responses globally
- Token read from localStorage on every request

#### `useAuth()` Context Hook
- React Context providing `{user, isLoading, login, logout}`
- Manages user state and localStorage sync
- User object: `{id: number, username: string}`

### 2.3 User Isolation & Data Access

**Database Schema:**
```sql
-- Users table (authentication)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,          -- Auto-incrementing integer
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL          -- Bcrypt hashed
);

-- Negotiations table (user ownership)
CREATE TABLE negotiations (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- FK to users
  ...
);
```

**Access Control Pattern:**
```typescript
// Example: Get user's negotiations
app.get('/api/negotiations', requireAuth(), async (req, res) => {
  const userId = req.userId; // Set by middleware

  const negotiations = await db
    .select()
    .from(negotiationsTable)
    .where(eq(negotiationsTable.userId, userId)); // User isolation

  res.json(negotiations);
});
```

**Security Features:**
- ✅ Password hashing with bcrypt (10 rounds)
- ✅ JWT tokens with 7-day expiration
- ✅ Foreign key constraints (ON DELETE CASCADE)
- ✅ User isolation at query level (all reads/writes filtered by userId)
- ✅ Parameterized queries (SQL injection prevention)
- ✅ Automatic token refresh on 401
- ✅ No cross-user data leakage (enforced by FK + WHERE clauses)

**User Data Flow:**
```
User Login → JWT Token → localStorage
  ↓
API Request with Authorization header
  ↓
requireAuth() middleware validates token
  ↓
req.userId extracted (integer)
  ↓
Database query: WHERE user_id = req.userId
  ↓
Only user's own data returned
```

---

## 3. DATA WIRING: Relationships in the Data Model

### 3.1 Core Entity Relationships

```
registrations (1) ──→ (M) markets
                 └──→ (M) counterparts
                 └──→ (M) products
                 └──→ (M) negotiations

negotiations (1) ──→ (M) negotiation_products (junction)
                     └──→ (M) products

negotiations (1) ──→ (M) simulation_queue
                 └──→ (M) simulation_runs

simulation_runs (1) ──→ (M) dimension_results
                    └──→ (M) product_results
```

### 3.2 Key Foreign Key Relationships

**User Ownership:**
- `negotiations.userId` → `users.id` (CASCADE) - All negotiations belong to a user

**Configuration → Negotiation:**
- `negotiations.registrationId` → `registrations.id`
- `negotiations.marketId` → `markets.id`
- `negotiations.counterpartId` → `counterparts.id`
- `negotiation_products.negotiationId` + `productId` → links products to negotiations

**Negotiation → Simulation:**
- `simulation_queue.negotiationId` → `negotiations.id`
- `simulation_runs.negotiationId` → `negotiations.id`
- `simulation_runs.queueId` → `simulation_queue.id`

**Simulation → Tactics/Techniques:**
- `simulation_runs.techniqueId` → `influencing_techniques.id`
- `simulation_runs.tacticId` → `negotiation_tactics.id`

**Simulation → Results:**
- `dimension_results.simulationRunId` → `simulation_runs.id`
- `product_results.simulationRunId` → `simulation_runs.id`
- `product_results.productId` → `products.id`

---

## 4. PROCESS: LLM Input & Output

### 4.1 Data Package Sent to Python Service

**Bridge Service** (`python-negotiation-service.ts:64-94`):
```typescript
{
  negotiation: {...},           // From negotiations table
  registration: {...},          // From registrations table
  market: {...},               // From markets table
  counterpart: {...},          // From counterparts table
  dimensions: [...],           // From negotiation.scenario.dimensions
  products: [...],             // From products table
  context: negotiation.scenario, // Full scenario config
  technique: {...},            // From influencing_techniques table
  tactic: {...}               // From negotiation_tactics table
}
```

### 4.2 LLM Agent System Prompt Construction

**Python Service** (`scripts/run_production_negotiation.py`) builds prompts with:

#### Static Prompt Variables (Sections 1-6):
```python
{
  # Role & Company
  'agent_role': 'BUYER' | 'SELLER',
  'company': registration.company,
  'role_objectives': role-specific goals,
  'primary_success_metric': role-specific KPI,

  # Negotiation Meta
  'negotiation_title': negotiation.title,
  'negotiation_type': context.negotiationType,
  'relationship_type': context.relationshipType,
  'negotiation_frequency': context.negotiationFrequency,
  'product_description': market.meta.intelligence,
  'product_market_description': market.meta.intelligence,
  'additional_comments': negotiation.description,

  # Market & Counterpart
  'counterpart_company': counterpart.name,
  'counterpart_attitude': counterpart.style,
  'counterpart_dominance': counterpart.dominance,
  'counterpart_affiliation': counterpart.affiliation,
  'counterpart_description': formatted personality description,
  'power_balance': counterpart.powerBalance,
  'intelligence': market.meta.intelligence,
  'context_description': formatted negotiation context,

  # Products & Dimensions (formatted as lists)
  'products_info': formatted product details,
  'product_name': list of product names,
  'zielpreis': target prices per product,
  'maxpreis': max/min prices (role-dependent),
  'volume': estimated volumes,
  'dimension_name': dimension names,
  'dimension_unit': dimension units,
  'min_value': dimension minimums,
  'max_value': dimension maximums,
  'target_value': dimension targets,
  'goal_priorities': dimension priorities,
  'dimension_details': formatted dimension text,
  'dimension_examples': example dimension values,
  'dimension_schema': JSON schema for offers,

  # Tactics & Techniques
  'technique_name': technique.name,
  'technique_description': technique.beschreibung,
  'technique_application': technique.anwendung,
  'technique_key_aspects': technique.wichtigeAspekte,
  'technique_key_phrases': technique.keyPhrases,
  'tactic_name': tactic.name,
  'tactic_description': tactic.beschreibung,
  'tactic_application': tactic.anwendung,
  'tactic_key_aspects': tactic.wichtigeAspekte,
  'tactic_key_phrases': tactic.keyPhrases,
}
```

#### Dynamic Per-Round Variables (Updated Each Exchange):
```python
{
  'current_round': exchange number (one buyer + one seller turn),
  'max_rounds': configured max rounds,
  'previous_rounds': formatted summary (total exchanges + last two turns),
  'current_round_message': opponent's last message,
  'opponent_last_offer': opponent's dimension values (JSON),
  'self_last_offer': own previous offer (JSON),
  'last_round_beliefs_json': YOUR previous BDI beliefs (extracted from bdi_state),
  'last_round_intentions': YOUR previous intentions (extracted from bdi_state),
  'inferred_preferences': formatted opponent preferences from beliefs,
  'observed_behaviour': analyzed opponent concession patterns,
}
```

**Prompt Compilation (Per-Exchange):**
- Fetches prompt templates from **Langfuse** (`agents/self_agent`, `agents/opponent_agent`)
- **STATIC variables** compiled once at agent creation (sections 1-6: role, company, products, dimensions, techniques/tactics)
- **DYNAMIC variables** override static placeholders before each exchange (section 7: round state, history, BDI)
- Merged variables recompiled into agent instructions using Langfuse template engine
- Agent instructions updated before each `Runner.run()` call with a concise user message (“Sie sind als ROLE nun in Runde X …”)
- Original instructions restored after execution

### 4.3 LLM Agent Output Structure

**Structured Output Schema** (`NegotiationResponse` Pydantic model):
```python
{
  "message": "Public message to opponent",
  "offer": {
    "dimension_values": {
      "Price per unit": 1.15,
      "Volume per month": 1050,
      "Payment terms": 45
    },
    "confidence": 0.85,
    "reasoning": "Strategic justification"
  },
  "action": "continue" | "accept" | "terminate" | "walk_away" | "pause",
  "bdi_state": {
    "beliefs": {
      "opponent_priorities_inferred": {"Price": "high", "Volume": "medium"},
      "opponent_emotional_state": "cooperative",
      "opponent_urgency": "medium",
      "market_signals": {},
      "risk_flags": []
    },
    "intentions": "Strategy for next round as text"
  },
  "internal_analysis": "Private strategic reasoning (fed back in next round)",
  "batna_assessment": 0.0-1.0,
  "walk_away_threshold": 0.0-1.0
}
```

**BDI State Extraction & Feedback Loop** (`run_production_negotiation.py`):
1. **Output**: LLM returns structured JSON with `bdi_state` containing beliefs/intentions
2. **Parsing**: Response parsed into `NegotiationResponse` Pydantic model
3. **Normalization**: Dimension values normalized to numeric types
4. **Storage**: Complete response stored in `results` array (including BDI state)
5. **Extraction**: Next round calls `_build_dynamic_prompt_variables()`:
   - Filters `results` to get agent's own previous rounds
   - Extracts `response.bdi_state.beliefs` → becomes `last_round_beliefs_json`
   - Extracts `response.bdi_state.intentions` → becomes `last_round_intentions`
   - Extracts `response.internal_analysis` → included in round message
6. **Injection**: Dynamic variables merged with static variables and recompiled into agent instructions
7. **Continuity**: Agent receives its own previous beliefs/intentions in system prompt for next decision

**Key Methods:**
- `_build_dynamic_prompt_variables()` - extracts BDI state from previous round
- `_extract_inferred_preferences()` - formats opponent beliefs for prompt
- `_extract_observed_behavior()` - analyzes opponent concession patterns
- `_format_conversation_history()` - builds complete round history
- `_update_agent_instructions()` - recompiles prompt with dynamic variables

---

## 5. OUTPUT: Database Storage & Metadata Generation

### 5.1 Simulation Run Record (`simulation_runs` table)

**Core Fields:**
- `id` (UUID) - unique run identifier
- `negotiationId` → links to parent negotiation
- `simulationId` → links to batch simulation
- `queueId` → links to simulation queue
- `techniqueId` → which technique was used
- `tacticId` → which tactic was used
- `personalityId` → agent personality variant
- `status` ('pending' → 'running' → 'completed'/'failed'/'timeout'/'paused')

**Result Fields:**
- `outcome` ('DEAL_ACCEPTED', 'TERMINATED', 'WALK_AWAY', 'PAUSED', 'MAX_ROUNDS_REACHED', 'ERROR')
- `outcomeReason` (text explanation)
- `totalRounds` (integer)
- `runNumber` (sequence within batch)

**Deal Value & Dimensions:**
- `dealValue` (decimal 15,2) - **calculated from product results**
- `otherDimensions` (JSONB) - **raw dimension_values from final offer**

**Conversation Log:**
- `conversationLog` (JSONB) - **complete exchange history**
  ```json
  [
    {
      "round": 1,
      "turn": 1,
      "agent": "BUYER",
      "message": "...",
      "offer": {"dimension_values": {...}},
      "action": "continue",
      "internal_analysis": "...",
      "batna_assessment": 0.7,
      "walk_away_threshold": 0.3
    },
    ...
  ]
  ```
- `round` counts full exchanges (buyer + seller), `turn` is the absolute move counter and powers UI visualizations (e.g., price evolution markers).

**Metadata:**
- `langfuseTraceId` (string) - links to Langfuse trace for debugging
- `actualCost` (decimal) - API cost tracking
- `techniqueEffectivenessScore` (decimal)
- `tacticEffectivenessScore` (decimal)
- `tacticalSummary` (text)

### 5.2 Dimension Results (`dimension_results` table)

**Generated by** `simulation-result-processor.ts:73-99`:

For each dimension in `negotiation.scenario.dimensions`:
```typescript
{
  simulationRunId: run.id,
  dimensionName: "Price per unit",
  finalValue: 1.15,              // From offer.dimension_values
  targetValue: 1.10,             // From scenario.dimensions[i].targetValue
  achievedTarget: true,          // finalValue within [minValue, maxValue]
  priorityScore: 1,              // From scenario.dimensions[i].priority
  improvementOverBatna: null     // Optional calculation
}
```

**Matching Logic** (lines 183-190):
1. Normalize dimension names (lowercase, remove spaces/underscores)
2. Exact match first
3. Partial match (contains)
4. Fallback to target value if not found in LLM output

### 5.3 Product Results (`product_results` table)

**Generated by** `simulation-result-processor.ts:102-168`:

For each product in `products` array:
```typescript
{
  simulationRunId: run.id,
  productId: product.id,
  productName: "Chocolate Bar 50g",

  // Price Analysis
  targetPrice: 1.10,             // From product.attrs.targetPrice
  minMaxPrice: 1.30,             // maxPrice for buyers, minPrice for sellers
  agreedPrice: 1.15,             // Extracted from dimension_values
  priceVsTarget: 4.55,           // % delta from target
  absoluteDeltaFromTarget: 0.05, // Absolute difference
  priceVsMinMax: 62.5,           // Position in ZOPA range
  absoluteDeltaFromMinMax: 0.0,  // Distance from bounds

  // Volume Analysis
  estimatedVolume: 100000,       // From product.attrs.estimatedVolume

  // Performance Metrics
  withinZopa: true,              // agreedPrice in [minPrice, maxPrice]
  zopaUtilization: 0.625,        // Position in zone (0.0-1.0)
  subtotal: 115000.00,           // agreedPrice × volume
  targetSubtotal: 110000.00,     // targetPrice × volume
  deltaFromTargetSubtotal: 5000.00,
  performanceScore: 95.45,       // Quality score (0-100)

  // Metadata
  dimensionKey: "price_chocolate_bar_50g", // Link to dimension_values key
  negotiationRound: null,
  metadata: {}
}
```

**Key Extraction Logic** (lines 117-133):
1. Normalize product name
2. Find dimension_values key containing product name AND price keywords
3. Extract numeric value from LLM output
4. Calculate deal value contribution: `agreedPrice × volume`

**Deal Value Calculation** (lines 46-69):
- Sum all `subtotal` values across products
- Stored in `simulation_runs.dealValue`

### 5.4 Metadata Enrichment

**Cost Tracking:**
- `actualCost` - accumulated from LLM API usage
- Stored per run, aggregated for queue/simulation

**Effectiveness Scores:**
- `techniqueEffectivenessScore` - how well technique achieved goals
- `tacticEffectivenessScore` - how well tactic performed
- Calculated by comparing final offer to targets

**Tracing:**
- `langfuseTraceId` - links to full LLM trace in Langfuse
- Enables debugging of prompt/response flow
- Stores prompt versions used

---

## 6. ANALYSIS: Frontend Data Consumption

### 6.1 Analysis Helpers (`analysis-helpers.ts`)

**Dimension Success Analysis:**
```typescript
summarizeDimensions(runs: AnalysisRun[]): DimensionSummary[]
```
Aggregates across runs:
- `name` - dimension name
- `priority` - importance level
- `total` - total attempts
- `achieved` - successful outcomes
- `rate` - success percentage

**Data Source:** `dimension_results` table
- Groups by `dimensionName`
- Counts `achievedTarget === true`
- Calculates success rate per dimension

**Product Performance Analysis:**
```typescript
summarizeProducts(runs: AnalysisRun[]): ProductSummary[]
```
Aggregates across runs:
- `name` - product name
- `avgPrice` - average agreed price
- `avgScore` - average performance score
- `zopaRate` - % within ZOPA

**Data Source:** `product_results` table (+ optional overlays from `conversationLog`)
- Groups by `productName`
- Averages `agreedPrice`, `performanceScore`
- Counts `withinZopa === true`
- Price-evolution charts consume `conversationLog.turn` to position offer markers

### 6.2 Dashboard Helpers (`dashboard-helpers.ts`)

**Metrics Summary:**
```typescript
deriveDashboardMetrics(negotiations: NegotiationListItem[])
```
Calculates:
- `activeNegotiations` - count with status='running'
- `successRate` - % of completed runs
- `avgDuration` - average rounds per negotiation
- `apiCostToday` - aggregated costs

**Data Source:** Negotiation list with joined simulation stats
- From `negotiations` table
- Aggregates `simulation_runs.completedRuns / totalRuns`
- Uses `scenario.maxRounds` for duration

**Success Trends:**
```typescript
deriveSuccessTrends(negotiations, days=30)
```
Produces time-series data:
- Groups negotiations by creation date
- Calculates daily success rates
- Returns `{date, successRate}[]` for charting

**Data Source:** Historical negotiation data
- Buckets by `negotiations.createdAt`
- Aggregates success rates per day

### 6.3 Analysis Page Data Requirements

**Negotiation Detail View:**
- **Source:** `negotiations` table + joined `simulation_runs`
- **Needs:** scenario config, run history, success metrics

**Run Comparison:**
- **Source:** Multiple `simulation_runs` with joined `dimension_results`, `product_results`
- **Needs:** Side-by-side technique/tactic performance

**Technique Effectiveness:**
- **Source:** `simulation_runs` grouped by `techniqueId`
- **Needs:** Success rates, avg scores per technique

**Tactic Effectiveness:**
- **Source:** `simulation_runs` grouped by `tacticId`
- **Needs:** Success rates, avg scores per tactic

**Product Performance:**
- **Source:** `product_results` aggregated plus `simulation_runs.conversationLog`
- **Needs:** Price trends, ZOPA rates, performance scores (UI plots buyer/seller dots per `turn`)

**Dimension Achievement:**
- **Source:** `dimension_results` aggregated
- **Needs:** Success rates by priority, target achievement

---

## 7. DATA MODEL ALIGNMENT CHECK

### ✅ Frontend Config → Database
- **Company Step** → `registrations` table ✓
- **Market Step** → `markets` table + `meta` JSONB ✓
- **Counterpart Step** → `counterparts` table ✓
- **Products Step** → `products` table + `attrs` JSONB ✓
- **Dimensions Step** → `negotiations.scenario.dimensions` ✓
- **Strategy Step** → `negotiations.scenario` (full object) ✓

### ✅ Database → LLM Input
- All config tables joined and sent to Python service ✓
- Technique/tactic details fetched from base data ✓
- Dimensions formatted for prompt variables ✓
- Products formatted with role-specific prices ✓
- Dynamic exchange context built from conversation log ✓

### ✅ LLM Output → Database
- Structured response parsed into `conversationLog` ✓
- `offer.dimension_values` stored in `otherDimensions` ✓
- Final outcome stored in `simulation_runs.outcome` ✓
- Langfuse trace ID captured for debugging ✓

### ✅ Database → Analysis
- `dimension_results` provides dimension-level success tracking ✓
- `product_results` provides product-level performance metrics ✓
- `simulation_runs.dealValue` calculated from product subtotals ✓
- `conversationLog` provides full negotiation replay (round + turn) ✓
- Aggregation helpers correctly query result tables ✓

---

## 8. KEY INSIGHTS & RECOMMENDATIONS

### Current Strengths:
1. **Clean separation** between configuration (scenario), execution (runs), and analysis (results)
2. **Flexible JSONB fields** (`attrs`, `meta`, `scenario`) allow schema evolution
3. **Structured LLM output** ensures reliable parsing and storage
4. **Comprehensive result tables** enable rich analysis across dimensions/products

### Potential Gaps:
1. **Dimension matching** relies on fuzzy name matching - could fail with creative LLM output
   - **Recommendation:** Add explicit dimension ID tracking in prompts

2. **Product price extraction** assumes specific naming patterns in dimension_values
   - **Recommendation:** Use structured product-level offers in LLM response schema

3. **BATNA/walk-away data** not persisted to analysis tables
   - **Recommendation:** Extract from conversationLog for decision quality analysis

4. **Technique/tactic effectiveness scores** calculated but not detailed
   - **Recommendation:** Add `technique_metrics` table for deeper effectiveness tracking

### Data Model Recommendations:
1. **Add `dimension_mappings` table:**
   ```sql
   CREATE TABLE dimension_mappings (
     simulation_run_id UUID REFERENCES simulation_runs(id),
     dimension_name TEXT,
     llm_output_key TEXT,
     confidence_score DECIMAL
   );
   ```
   Track which LLM output keys matched which dimensions for validation.

2. **Enhance `product_results` with offer history:**
   Add `offer_history JSONB` to track how product prices evolved round-by-round.

3. **Add `decision_quality_metrics` table:**
   ```sql
   CREATE TABLE decision_quality_metrics (
     simulation_run_id UUID REFERENCES simulation_runs(id),
     round_number INT,
     batna_assessment DECIMAL,
     walk_away_threshold DECIMAL,
     decision_quality_score DECIMAL
   );
   ```
   Enable analysis of when agents make good walk-away decisions.

---

## Summary

Your data model is **well-aligned** with the frontend configuration and AI processing pipeline. The flow is:

1. **Input:** Form collects hierarchical config → stored in normalized tables + JSONB scenario
2. **Processing:** Full context package sent to Python → LLM agents negotiate using compiled prompts
3. **Output:** Structured responses → parsed into conversational log + analytical result tables
4. **Analysis:** Result tables aggregated → dashboard metrics, success rates, performance scores

The key strength is the **dual storage strategy**: normalized tables for entity relationships + JSONB for flexible context. This allows complex scenarios while maintaining queryable results.

The main area for improvement is **dimension value tracking** - ensuring LLM outputs map reliably to configured dimensions for accurate result calculation.
