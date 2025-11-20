# Implementation Plan: Enhanced Schema & Advanced Prompt System

## Overview

This document outlines the comprehensive plan to migrate from the current schema to the enhanced schema (`new_schema.md`) and implement the advanced prompt system using Langfuse prompts (`self_agent.md` and `opponent_agent.md`).

## Key Changes Summary

### 1. Schema Migration
- **Current**: Simplified schema with `negotiations`, `simulationRuns`, `agents`, `products`
- **New**: Comprehensive schema with `registrations`, `markets`, `counterparts`, `dimensions`, `products`, `product_dimension_values`, `simulations`, `agents`, `events`, `offers`, `concessions`

### 2. Prompt System
- **Current**: Single prompt from Langfuse (`negotiation`) with basic variables
- **New**: Two separate prompts (`agents/self_agent` and `agents/opponent_agent`) with extensive variable mapping

### 3. Data Capture
- **Current**: Basic negotiation setup (title, type, ZOPA, products)
- **New**: Market context, counterpart profiles, registration data, dimension history, BDI state tracking

---

## Backend Cleanup & Prompt TODO Log (2025-11-09)

- ✅ **Python prompt smoke test:** `.venv/bin/python scripts/run_production_negotiation.py --negotiation-id test-neg-001 --simulation-run-id sim-test-001 --max-rounds 1 --negotiation-data $(cat /tmp/negotiation-data.json)`  
  - Langfuse prompt `negotiation` v11 fetched successfully; LiteLLM routed to `gemini-flash-lite-latest`; run finished with `MAX_ROUNDS_REACHED` after a single buyer turn (max rounds intentionally clamped to 1).  
  - Confirms tracing + provider plumbing still work post-schema refactor, but Python layer is **still hard-coded to the legacy `negotiation` prompt**.
- ✅ **Langfuse dual prompt wiring:** Python negotiation service now accepts `--self-agent-prompt` / `--opponent-agent-prompt`, loads the correct template based on the configured role (with fallback to legacy `negotiation`), and TypeScript passes the prompt names when spawning the microservice. Manual run shows the new prompts resolving via Langfuse (see log below).  
- ⏳ **Action:** After dual prompts land, add a lightweight integration harness (mock Langfuse + pytest or Vitest flag) that validates both prompt templates compile with the new variable set.  
- ✅ **Action:** Updated `server/scripts/verify-schema.ts` + docs to drop references to deleted tables (`negotiation_contexts`, `negotiation_dimensions`, etc.) so backend cleanup completes before resuming the broader roadmap.

**Prompt validation note (2025-11-09 22:27 CET):**  
`.venv/bin/python scripts/run_production_negotiation.py --negotiation-id test-neg-003 --simulation-run-id sim-test-003 --max-rounds 1 --self-agent-prompt agents/self_agent --opponent-agent-prompt agents/opponent_agent --negotiation-data $(cat /tmp/negotiation-data.json)`  
→ Langfuse returned `agents/self_agent` v6 and `agents/opponent_agent` v1; LiteLLM routed to `gpt-5`. The OpenAI call exceeded 60 s (run aborted by harness timeout) but confirmed both prompt templates load successfully. Consider switching the prompt config to a lighter model (e.g., `gpt-4o-mini` or `gemini-flash-lite-latest`) for faster smoke tests.

**Prompt validation note (2025-11-09 22:38 CET):**  
Same command with an enriched negotiation payload (registration/market/counterpart data) also compiled successfully. Langfuse resolved the new variables without errors, but the `gpt-5` completion again exceeded ~60 s and the harness timed out. We need to update the Langfuse prompt configuration to a faster model before these runs can complete unattended.

## Frontend Wiring Log (2025-11-10)

- ✅ **Reports Page (`client/src/pages/reports.tsx`)**
  - Pulls data directly from `/api/negotiations` via `useNegotiations`.
  - Filters for status, role, free text and date range; exports hit `/api/analytics/export/:id`.
  - UI fully localized (German) and scenario-aware (company, counterpart, market).
  - Helpers extracted to `client/src/lib/report-helpers.ts` with dedicated unit tests (`tests/report-helpers.test.ts`).
- ✅ **Analysis Routes**
  - `/analysis/:negotiationId` now renders the same component as `/negotiations/:id/analysis` via the shared `NegotiationAnalysisView`.
  - Legacy `analysis-new.tsx` replaced with the wrapper; no duplicate logic remains.
- ✅ **Dashboard Refresh (2025-11-10)**
  - Frontend widgets now consume real negotiation data with German copy (metrics, live runs, simulation history, agent performance, quick actions, KI-evaluations).
  - Added derived helpers for fallback metrics/trends plus RTL coverage; dashboard tests run in jsdom again.
  - Backend exposes `/api/dashboard/evaluation-status` + `/api/dashboard/evaluations/backfill` so the KI card uses real data.
- ✅ **Testing Suite (2025-11-10)**
  - Page zeigt nun pro Verhandlung alle Runs, Filter + Checkboxen; vergelichbare Runs erscheinen im Radar-Chart samt KPI-Kacheln.
  - Vergleichslogik ausgelagert (`client/src/lib/run-comparison.ts`) inkl. Unit Tests.
- ✅ **DB Integration Fix (2025-11-10)**
  - `tests/integration/negotiation-flow.test.ts` now seeds simulation runs with deterministic UUIDs to avoid FK drift on `product_results`.
  - Keeps debug logs + agent metrics aligned with the new identifiers.
- 🔄 **Testing**
  - `npm run test -- tests/report-helpers.test.ts` executed locally (pass).
  - Please rerun `RUN_DB_TESTS=true npm run test -- tests/schema.test.ts tests/integration/negotiation-flow.test.ts --run` once Neon access is available to ensure exports did not affect persistence flows.

---

## Phase 1: Schema Migration

### 1.1 Database Schema Update

**File**: `shared/schema.ts`

**Actions**:
1. Create new schema file `shared/schema-enhanced.ts` based on `new_schema.md`
2. Define all new tables:
   - `markets` (market_id, name, region, country_code, currency_code, meta)
   - `counterparts` (counterpart_id, name, kind, power_balance, style, constraints_meta, notes)
   - `dimensions` (dimension_id, code, name, value_type, unit, spec)
   - `products` (product_id, gtin, name, brand, category_path, attrs)
   - `product_dimension_values` (product_id, dimension_id, value, measured_at, source)
   - `registrations` (registration_id, organization, company, country, market_id, negotiation_type, negotiation_frequency, goals)
   - `simulations` (simulation_id, registration_id, name, settings, num_rounds, seed, started_at, ended_at)
   - `policies` (policy_id, name, kind, config)
   - `agents` (enhanced: agent_id, registration_id, simulation_id, role, agent_kind, model_name, system_prompt, tools, policy_id, hyperparams)
   - `agent_metrics` (agent_metric_id, agent_id, metric_name, metric_value, details, recorded_at)
   - `interactions` (interaction_id, round_id, step_no, agent_id, observation, reward, created_at)
   - `events` (event_id, round_id, event_kind, role, agent_id, name, parameters, observations, reasoning, created_at)
   - `offers` (offer_id, round_id, side, agent_id, price, quantity, currency_code, unit, terms, expires_at, accepted, created_at)
   - `concessions` (concession_id, offer_id, field_path, before_value, after_value)
   - `benchmarks`, `experiments`, `experiment_runs`

3. Update `negotiations` table:
   - Link to `registration_id` instead of direct user context
   - Link to `market_id` and `counterpart_id`
   - Keep existing fields for backward compatibility during migration

4. Update `negotiation_rounds` table:
   - Link to `round_id` from new schema (if using unified event system)
   - Or keep existing structure and add new fields

**Migration Strategy**:
- Option A: **Fresh Start** (Recommended if data can be reset)
  - Drop existing tables
  - Create new schema from scratch
  - Re-seed with new structure
  
- Option B: **Gradual Migration**
  - Create new tables alongside existing
  - Migrate data incrementally
  - Deprecate old tables after migration

**Recommendation**: **Option A (Fresh Start)** - Cleaner, avoids migration complexity

### 1.2 Drizzle Configuration

**File**: `drizzle.config.ts`

**Actions**:
1. Update schema import to use new schema
2. Generate new migrations: `npm run db:push`
3. Verify all tables created correctly

### 1.3 Storage Layer Updates

**File**: `server/storage.ts`

**Actions**:
1. Add methods for new tables:
   ```typescript
   // Markets
   getMarket(id: string): Promise<Market | undefined>
   getAllMarkets(): Promise<Market[]>
   createMarket(market: InsertMarket): Promise<Market>
   
   // Counterparts
   getCounterpart(id: string): Promise<Counterpart | undefined>
   getAllCounterparts(): Promise<Counterpart[]>
   createCounterpart(counterpart: InsertCounterpart): Promise<Counterpart>
   
   // Registrations
   getRegistration(id: string): Promise<Registration | undefined>
   createRegistration(registration: InsertRegistration): Promise<Registration>
   
   // Dimensions
   getDimension(id: string): Promise<Dimension | undefined>
   getDimensionByCode(code: string): Promise<Dimension | undefined>
   getAllDimensions(): Promise<Dimension[]>
   
   // Product Dimension Values
   getProductDimensionValues(productId: string, dimensionId: string): Promise<ProductDimensionValue[]>
   createProductDimensionValue(value: InsertProductDimensionValue): Promise<ProductDimensionValue>
   
   // Events
   createEvent(event: InsertEvent): Promise<Event>
   getEventsByRound(roundId: string): Promise<Event[]>
   
   // Offers
   createOffer(offer: InsertOffer): Promise<Offer>
   getOffersByRound(roundId: string): Promise<Offer[]>
   ```

2. Update existing methods to work with new schema relationships

---

## Phase 2: Frontend Changes

### 2.1 Registration Flow (New)

**File**: `client/src/pages/create-registration.tsx` (NEW)

**Purpose**: Capture organization/company registration data before creating negotiations

**Fields to Capture**:
- Organization name
- Company name
- Country
- Market selection (dropdown from `markets` table)
- Negotiation type (one-shot, multi-year)
- Negotiation frequency (yearly, quarterly, monthly, ongoing)
- Goals (JSONB object)

**Actions**:
1. Create new page component
2. Add form with validation
3. Create API endpoint: `POST /api/registrations`
4. Store registration_id for subsequent negotiations

### 2.2 Enhanced Negotiation Creation Form

**File**: `client/src/components/CreateNegotiationForm.tsx`

**New Fields to Add**:

#### Market & Counterpart Selection
```typescript
marketId: z.string().uuid() // Link to markets table
counterpartId: z.string().uuid() // Link to counterparts table
```

#### Registration Link
```typescript
registrationId: z.string().uuid() // Link to registrations table
```

#### Enhanced Product Configuration
- Replace simple product list with:
  - Product selection (from `products` table with GTIN lookup)
  - Dimension values per product (using `product_dimension_values`)
  - Historical dimension tracking

#### Agent Configuration (Enhanced)
```typescript
agentConfig: z.object({
  role: z.enum(['buyer', 'seller', 'coach', 'observer', 'other']),
  agentKind: z.enum(['llm', 'rule', 'human', 'hybrid']),
  modelName: z.string().optional(),
  systemPrompt: z.string().optional(), // Override default
  tools: z.array(z.string()).optional(),
  policyId: z.string().uuid().optional(),
  hyperparams: z.record(z.any()).optional()
})
```

#### BDI State Tracking (New)
```typescript
initialBeliefs: z.record(z.any()).optional() // Initial beliefs JSON
initialDesires: z.record(z.any()).optional() // Initial desires JSON
initialIntentions: z.string().optional() // Initial intentions text
```

**UI Changes**:
1. Add step for "Market & Counterpart Selection"
2. Add step for "Registration" (if not already registered)
3. Enhance product configuration UI to show dimension history
4. Add agent configuration panel
5. Add BDI state initialization panel (optional, advanced users)

### 2.3 Market Management UI

**File**: `client/src/pages/manage-markets.tsx` (NEW)

**Purpose**: CRUD interface for markets

**Actions**:
1. List all markets
2. Create/edit market
3. Set region, country_code, currency_code
4. Configure meta JSONB

### 2.4 Counterpart Management UI

**File**: `client/src/pages/manage-counterparts.tsx` (NEW)

**Purpose**: CRUD interface for counterparts

**Actions**:
1. List all counterparts
2. Create/edit counterpart
3. Set kind (retailer, manufacturer, distributor, other)
4. Configure power_balance (0-100 slider)
5. Set style (text description)
6. Configure constraints_meta (JSONB editor)

### 2.5 Dimension Management UI

**File**: `client/src/pages/manage-dimensions.tsx` (NEW)

**Purpose**: CRUD interface for dimensions

**Actions**:
1. List all dimensions
2. Create/edit dimension
3. Set code (unique identifier)
4. Set value_type (integer, numeric, text, boolean, json)
5. Set unit (optional)
6. Configure spec JSONB

### 2.6 Product Management UI

**File**: `client/src/pages/manage-products.tsx` (NEW)

**Purpose**: CRUD interface for products

**Actions**:
1. List all products
2. Create/edit product
3. Set GTIN (unique identifier)
4. Set name, brand, category_path
5. Configure attrs JSONB
6. Link to dimensions via `product_dimension_values` table

### 2.7 API Routes Updates

**Files**: `server/routes/registrations.ts`, `server/routes/markets.ts`, `server/routes/counterparts.ts`, `server/routes/dimensions.ts`, `server/routes/products.ts` (NEW)

**Actions**:
1. Create CRUD endpoints for each new entity
2. Add validation using Zod schemas
3. Implement proper error handling

---

## Phase 3: Service Function Changes

### 3.1 Langfuse Prompt Integration

**File**: `server/services/langfuse.ts`

**Current**: Single prompt `negotiation`

**New**: Two prompts:
- `agents/self_agent` - For the user's agent (buyer or seller)
- `agents/opponent_agent` - For the opponent agent

**Actions**:
1. Update `getPrompt()` method to accept prompt name:
   ```typescript
   getPrompt(promptName: string): Promise<LangfusePrompt> {
     return this.langfuse.getPrompt(promptName);
   }
   ```

2. Add helper methods:
   ```typescript
   getSelfAgentPrompt(): Promise<LangfusePrompt> {
     return this.getPrompt('agents/self_agent');
   }
   
   getOpponentAgentPrompt(): Promise<LangfusePrompt> {
     return this.getPrompt('agents/opponent_agent');
   }
   ```

### 3.2 Prompt Variable Mapping

**File**: `scripts/run_production_negotiation.py`

**Current**: `_build_static_prompt_variables()` method builds basic variables

**New**: Comprehensive variable mapping based on `self_agent.md` and `opponent_agent.md`

#### Variables from `self_agent.md`:

**INPUT STATE**:
- `current_round` / `max_rounds` ✅ (already exists)
- `previous_rounds` - Full conversation history
- `current_round_message` - Last message from opponent
- `opponent_last_offer` - Structured last offer with all dimension values

**BELIEFS**:
- `product_market_description` - From `negotiations.productMarketDescription` or `products` + `markets`
- `negotiation_context` - From `negotiations.scenario` JSONB
- `negotiation_frequency` - From `registrations.negotiation_frequency`
- `negotiation_type` - From `registrations.negotiation_type`
- `intelligence` - Market intelligence (from `markets.meta` or external API)
- `counterpart_company` - From `counterparts.name`
- `counterpart_known` - From `negotiations.counterpartKnown`
- `company_known` - From `negotiations.companyKnown`
- `counterpart_attitude` - Derived from `counterparts.style` + `counterparts.power_balance`
- `counterpart_distance` - From `negotiations.counterpartDistance` JSONB
- `power_balance` - From `counterparts.power_balance` or `negotiations.powerBalance`
- `counterpart_description` - From `counterparts` table (name + kind + style)
- `inferred_preferences` - From previous rounds analysis (BDI state)
- `observed_behaviour` - From previous rounds analysis (BDI state)
- `last_round_beliefs_json` - From `events` table (previous round's beliefs)

**DESIRES**:
- `product_name` - From `products.name` (for each product)
- `zielpreis` - From `products.zielPreis` (target price)
- `maxpreis` - From `products.minMaxPreis` (max acceptable price)
- `volume` - From `products.geschätztesVolumen` (estimated volume)
- `dimension_name` - From `negotiationDimensions.name` (for each dimension)
- `dimension_unit` - From `negotiationDimensions.unit`
- `min_value` / `max_value` / `target_value` - From `negotiationDimensions`
- `goal_priorities` - From `negotiationDimensions.priority` (1=critical, 2=important, 3=flexible)

**INTENTIONS**:
- `last_round_intentions` - From `events` table (previous round's intentions text)
- `dimension_examples` - Generated examples from `negotiationDimensions`

**MOVE LIBRARY**:
- `technique_name` - From `influencingTechniques.name`
- `technique_description` - From `influencingTechniques.beschreibung`
- `technique_application` - From `influencingTechniques.anwendung`
- `technique_key_aspects` - From `influencingTechniques.wichtigeAspekte` JSONB
- `technique_key_phrases` - From `influencingTechniques.keyPhrases` JSONB
- `tactic_name` - From `negotiationTactics.name`
- `tactic_description` - From `negotiationTactics.beschreibung`
- `tactic_application` - From `negotiationTactics.anwendung`
- `tactic_key_aspects` - From `negotiationTactics.wichtigeAspekte` JSONB
- `tactic_key_phrases` - From `negotiationTactics.keyPhrases` JSONB

**OUTPUT SCHEMA**:
- `dimension_schema` - Generated from `negotiationDimensions`
- `beliefs_schema` - Structured beliefs JSON schema

**Actions**:
1. Update `_build_static_prompt_variables()` to fetch all new data:
   ```python
   def _build_static_prompt_variables(self, role: str) -> Dict[str, str]:
       negotiation = self.negotiation_data['negotiation']
       registration = self._fetch_registration(negotiation['registration_id'])
       market = self._fetch_market(negotiation['market_id'])
       counterpart = self._fetch_counterpart(negotiation['counterpart_id'])
       products = self.negotiation_data['products']
       dimensions = self.negotiation_data['dimensions']
       
       # Build comprehensive variable dictionary
       variables = {
           'agent_role': role,
           'company': registration['company'],
           'negotiation_title': negotiation['title'],
           'role_objectives': self._get_role_objectives(role),
           # ... all other variables
       }
       
       return variables
   ```

2. Add helper methods:
   ```python
   def _fetch_registration(self, registration_id: str) -> Dict[str, Any]
   def _fetch_market(self, market_id: str) -> Dict[str, Any]
   def _fetch_counterpart(self, counterpart_id: str) -> Dict[str, Any]
   def _get_role_objectives(self, role: str) -> str
   def _build_dimension_schema(self, dimensions: List[Dict]) -> str
   def _build_beliefs_schema(self) -> str
   def _format_previous_rounds(self, conversation_log: List[Dict]) -> str
   def _get_last_round_beliefs(self, simulation_run_id: str, round_number: int) -> Dict[str, Any]
   ```

### 3.3 BDI State Persistence

**File**: `scripts/run_production_negotiation.py`

**New**: Save BDI state after each round to `events` table

**Actions**:
1. After each round, extract BDI state from agent response:
   ```python
   response = await agent.run(message)
   bdi_state = response.get('bdi_state', {})
   beliefs = bdi_state.get('beliefs', {})
   intentions = bdi_state.get('intentions', '')
   ```

2. Create event record:
   ```python
   event = {
       'round_id': current_round_id,
       'event_kind': 'message',
       'role': 'assistant',
       'agent_id': agent_id,
       'name': 'negotiation_response',
       'parameters': {
           'message': response['message'],
           'offer': response['offer']
       },
       'observations': {
           'beliefs': beliefs,
           'intentions': intentions,
           'internal_analysis': response.get('internal_analysis', ''),
           'batna_assessment': response.get('batna_assessment'),
           'walk_away_threshold': response.get('walk_away_threshold')
       },
       'reasoning': response.get('internal_analysis', '')
   }
   ```

3. Save to database via API call or direct DB access

### 3.4 Offer Tracking

**File**: `scripts/run_production_negotiation.py`

**New**: Track offers in `offers` table

**Actions**:
1. After each round, extract offer from response
2. Create offer record:
   ```python
   offer = {
       'round_id': current_round_id,
       'side': role,  # 'buyer' or 'seller'
       'agent_id': agent_id,
       'price': offer_data.get('price'),
       'quantity': offer_data.get('quantity'),
       'currency_code': market['currency_code'],
       'unit': 'EUR',  # or from dimension config
       'terms': offer_data.get('dimension_values', {}),
       'expires_at': None,  # or calculate from negotiation settings
       'accepted': False
   }
   ```

3. Save to database

### 3.5 Concession Tracking

**File**: `scripts/run_production_negotiation.py`

**New**: Track concessions between rounds

**Actions**:
1. Compare current offer with previous offer
2. Identify changed fields
3. Create concession records:
   ```python
   for field_path, (before, after) in concessions.items():
       concession = {
           'offer_id': current_offer_id,
           'field_path': field_path,  # e.g., 'dimension_values.Preis_Oreo_100g'
           'before_value': before,
           'after_value': after
       }
   ```

### 3.6 Python Service Updates

**File**: `server/services/python-negotiation-service.ts`

**Actions**:
1. Update `fetchNegotiationData()` to include:
   - Registration data
   - Market data
   - Counterpart data
   - Enhanced product-dimension relationships

2. Pass prompt names to Python script:
   ```typescript
   scriptArgs.push('--self-agent-prompt', 'agents/self_agent');
   scriptArgs.push('--opponent-agent-prompt', 'agents/opponent_agent');
   ```

3. Update result parsing to handle BDI state:
   ```typescript
   interface PythonNegotiationResult {
     // ... existing fields
     bdiStates?: Array<{
       round: number;
       agent: string;
       beliefs: Record<string, any>;
       intentions: string;
       internal_analysis: string;
     }>;
   }
   ```

---

## Phase 4: Database Reset & Migration

### 4.1 Backup Current Data (Optional)

**Actions**:
1. Export current negotiations to JSON
2. Export simulation runs to JSON
3. Store backups in `backups/` directory

### 4.2 Reset Database

**Actions**:
1. Drop all existing tables:
   ```sql
   DROP TABLE IF EXISTS product_results CASCADE;
   DROP TABLE IF EXISTS dimension_results CASCADE;
   DROP TABLE IF EXISTS negotiation_rounds CASCADE;
   DROP TABLE IF EXISTS simulation_runs CASCADE;
   DROP TABLE IF EXISTS simulation_queue CASCADE;
   DROP TABLE IF EXISTS negotiation_dimensions CASCADE;
   DROP TABLE IF EXISTS products CASCADE;
   DROP TABLE IF EXISTS negotiations CASCADE;
   -- ... etc
   ```

2. Or use Drizzle migration:
   ```bash
   npm run db:push -- --force
   ```

### 4.3 Seed New Data

**File**: `server/seed.ts`

**Actions**:
1. Create seed data for:
   - Markets (e.g., "German Retail Market", "European FMCG Market")
   - Counterparts (e.g., "Retailer A", "Manufacturer B")
   - Dimensions (e.g., "Preis", "Volumen", "Laufzeit", "Zahlungskonditionen")
   - Products (e.g., "Oreo 100g", "Milka 200g")
   - Product-dimension values (link products to dimensions)
   - Registrations (sample organization)

2. Update seed script to use new schema

---

## Phase 5: Testing & Validation

### 5.1 Unit Tests

**Files**: `tests/**/*.test.ts`

**Actions**:
1. Test new storage methods
2. Test prompt variable mapping
3. Test BDI state persistence
4. Test offer/concession tracking

### 5.2 Integration Tests

**File**: `scripts/test.sh`

**Actions**:
1. Create test negotiation with new schema
2. Run simulation
3. Verify:
   - Prompts loaded correctly from Langfuse
   - Variables populated correctly
   - BDI state saved after each round
   - Offers tracked correctly
   - Concessions identified correctly

### 5.3 End-to-End Test

**Actions**:
1. Create registration
2. Create negotiation with market/counterpart
3. Run simulation
4. Verify all data saved correctly
5. Check Langfuse traces

---

## Implementation Order

### Week 1: Schema & Storage
1. ✅ Create `shared/schema-enhanced.ts`
2. ✅ Update `drizzle.config.ts`
3. ✅ Run `npm run db:push`
4. ✅ Update `server/storage.ts` with new methods
5. ✅ Create seed data

### Week 2: Frontend - Data Capture
1. ✅ Create registration page
2. ✅ Create market/counterpart/dimension/product management pages
3. ✅ Update `CreateNegotiationForm.tsx` with new fields (deutscher Multi-Step-Assistent)
4. ✅ Create API routes for new entities

### Week 3: Service Layer - Prompt Integration
1. ✅ Update `langfuse.ts` for dual prompts
2. ✅ Update Python script variable mapping
3. ✅ Implement BDI state persistence
4. ✅ Implement offer/concession tracking

### Week 4: Testing & Refinement
1. ✅ Run integration tests
2. ✅ Fix bugs
3. ✅ Performance optimization
4. ✅ Documentation updates

---

## Critical Considerations

### 1. Backward Compatibility
- **Decision**: Fresh start (no backward compatibility needed)
- **Rationale**: Cleaner implementation, avoids migration complexity

### 2. Langfuse Prompts
- **Requirement**: Prompts must exist in Langfuse before deployment
- **Action**: Create prompts `agents/self_agent` and `agents/opponent_agent` in Langfuse UI
- **Template**: Use content from `self_agent.md` and `opponent_agent.md`

### 3. Variable Mapping Complexity
- **Challenge**: Many variables need to be fetched from multiple tables
- **Solution**: Create comprehensive data fetching layer in Python script
- **Caching**: Consider caching market/counterpart data for performance

### 4. BDI State Schema
- **Challenge**: Beliefs schema is dynamic (depends on negotiation context)
- **Solution**: Store as JSONB, validate structure in application layer

### 5. Performance
- **Concern**: Multiple database queries per round
- **Solution**: Batch queries, use joins where possible, cache static data

---

## Rollback Plan

If issues arise:

1. **Schema Rollback**: Keep old schema file, switch import back
2. **Prompt Rollback**: Use fallback to single prompt if dual prompts fail
3. **Data Rollback**: Restore from backups if data corruption occurs

---

## Success Criteria

1. ✅ All new tables created and seeded
2. ✅ Frontend captures all new fields
3. ✅ Prompts load from Langfuse (`agents/self_agent` and `agents/opponent_agent`)
4. ✅ All variables populated correctly in prompts
5. ✅ BDI state saved after each round
6. ✅ Offers and concessions tracked
7. ✅ End-to-end negotiation runs successfully
8. ✅ All tests pass

---

## Next Steps

1. Review this plan with team
2. Get approval for database reset (if needed)
3. Create Langfuse prompts in UI
4. Begin Phase 1 implementation
5. Regular check-ins during implementation
