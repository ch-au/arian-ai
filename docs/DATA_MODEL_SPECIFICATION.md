# Data Model Specification

This reference describes the canonical PostgreSQL schema that powers ARIAN AI. Update this file whenever tables or key fields change so the data model stays aligned with product requirements.

## Core Tables

### `negotiations`
Master record for a negotiation configuration.

**Key Fields:**
- `id` (UUID): Primary key
- `title`, `negotiation_type`, `relationship_type`: Business context
- `product_market_description`, `additional_comments`: User input
- `status`: Lifecycle state (`pending`, `running`, `completed`, `failed`, `configured`)
- `user_role`: `buyer` or `seller` - which role the user represents
- `max_rounds`: Maximum negotiation rounds (default: 10)
- `selected_techniques`, `selected_tactics`: UUID arrays of selected strategies
- `counterpart_personality`, `zopa_distance`: AI agent configuration

**Phase2 Specific Fields:**
- `company_known` (boolean): Whether the company is known to the counterpart
- `counterpart_known` (boolean): Whether the counterpart is known
- `negotiation_frequency` (text): `yearly` | `quarterly` | `monthly` | `ongoing`
- `power_balance` (integer): 0-100 (0 = seller more powerful, 50 = balanced, 100 = buyer more powerful)
- `verhandlungs_modus` (text): `kooperativ` | `moderat` | `aggressiv` | `sehr-aggressiv`

**DEPRECATED Fields** (will be removed after migration):
- `user_zopa` (JSONB): Legacy ZOPA configuration - use `negotiation_dimensions` table instead
- `counterpart_distance` (JSONB): Legacy counterpart distance - use `negotiation_dimensions` table instead

**Metadata:**
- `metadata` (JSONB): Flexible storage for additional context (e.g., `geschätzteDistanz` for Phase2)
- `sonderinteressen` (text): Special interests or requirements

**Relationships:**
- One-to-many: `simulation_queue`, `simulation_runs`, `products`, `negotiation_dimensions`
- Many-to-one: `negotiation_contexts`, `agents` (buyer/seller)

### `products`
Multiple products per negotiation (Phase 2 enhancement).

**Key Fields:**
- `negotiation_id`: Foreign key to negotiations
- `produkt_name`: Product name/description
- `ziel_preis`: Target price (role-dependent: ideal for buyer, target for seller)
- `min_max_preis`: Min/Max boundary (role-dependent: max for buyer, min for seller)
- `geschätztes_volumen`: Estimated volume/quantity

**Purpose:** Enables multi-product negotiations with individual ZOPA boundaries per product.

### `negotiation_dimensions`
Flexible ZOPA definitions beyond price (e.g., payment terms, delivery time).

**Key Fields:**
- `negotiation_id`: Foreign key to negotiations
- `name`: Dimension name (e.g., "payment_terms", "delivery_time")
- `min_value`, `max_value`, `target_value`: Boundary values
- `priority`: Importance (1=must-have, 2=important, 3=flexible)
- `unit`: Optional unit (e.g., "days", "months")

**Constraint:** `UNIQUE (negotiation_id, name)` ensures no duplicate dimensions per negotiation.

### `simulation_queue`
Aggregate execution tracking for a negotiation's simulation runs.

**Key Fields:**
- `negotiation_id`: Foreign key to negotiations
- `total_simulations`: N techniques × M tactics × P personalities × D distances
- `completed_count`, `failed_count`, `paused_count`: Progress counters
- `status`: `pending`, `running`, `paused`, `completed`, `failed`
- `estimated_total_cost`, `actual_total_cost`: API cost tracking
- `crash_recovery_checkpoint`: Resume point for interrupted queues

**Purpose:** Tracks overall progress for combinatorial simulation runs.

### `simulation_runs`
One record per technique-tactic-personality-distance combination.

**Key Fields:**
- `queue_id`, `negotiation_id`: Foreign keys
- `run_number`, `execution_order`: Sequencing
- `technique_id`, `tactic_id`: Strategy combination being tested
- `personality_id`, `zopa_distance`: AI agent configuration
- `status`: `pending`, `running`, `completed`, `failed`, `timeout`
- `outcome`: `DEAL_ACCEPTED`, `WALK_AWAY`, `TERMINATED`, `MAX_ROUNDS_REACHED`, `ERROR`

**Results:**
- `deal_value`: Sum of all product subtotals (price × volume)
- `conversation_log`: JSONB array of negotiation messages
- `other_dimensions`: JSONB object with non-price terms (payment, delivery, etc.)
- `total_rounds`, `actual_cost`: Process metrics

**AI Evaluation Fields** (Januar 2025):
- `tactical_summary`: 2-3 sentence analysis in German
- `technique_effectiveness_score`: 1-10 rating for influence technique
- `tactic_effectiveness_score`: 1-10 rating for negotiation tactic

**Purpose:** Stores individual simulation execution and results.

### `product_results`
Per-product outcomes for each simulation run.

**Key Fields:**
- `simulation_run_id`, `product_id`: Foreign keys
- `product_name`: Denormalized for easy access
- `target_price`, `min_max_price`, `estimated_volume`: Config (denormalized)

**Results:**
- `agreed_price`: Final negotiated price
- `price_vs_target`: Percentage difference from target (e.g., "+15.3%")
- `absolute_delta_from_target`: Absolute difference
- `within_zopa`: Boolean - is price within ZOPA boundaries?
- `zopa_utilization`: Percentage of ZOPA range used
- `subtotal`: `agreed_price × estimated_volume`
- `performance_score`: 0-100 score based on ZOPA achievement

**Purpose:** Enables per-product analysis in multi-product negotiations.

### `negotiation_rounds`
Turn-by-turn negotiation transcript (optional, for detailed analysis).

**Key Fields:**
- `simulation_run_id`: Foreign key
- `round`: Round number (1, 2, 3...)
- `speaker`: `BUYER` or `SELLER`
- `message`: Negotiation message text
- `proposal`: JSONB with offer details
- `response_time_ms`: AI generation latency

**Purpose:** Detailed conversation flow analysis and debugging.

## Reference Data Tables

### `influencing_techniques`
Psychological influence strategies (10 techniques).

**Key Fields:**
- `name`: Technique name (e.g., "Reziprozität", "Social Proof")
- `beschreibung`: Description
- `anwendung`: How to apply
- `wichtige_aspekte`: JSONB array of key aspects
- `key_phrases`: JSONB array of example phrases

**Source:** `data/influencing_techniques.csv` → Imported via `npm run db:seed`

### `negotiation_tactics`
Tactical approaches (44 tactics).

**Key Fields:**
- `name`: Tactic name (e.g., "Win-Win", "Deadline Pressure")
- `beschreibung`: Description
- `anwendung`: Application guidance
- `wichtige_aspekte`: JSONB array of considerations
- `key_phrases`: JSONB array of tactical phrases

**Source:** `data/negotiation_tactics.csv` → Imported via `npm run db:seed`

### `personality_types`
Big Five personality archetypes.

**Key Fields:**
- `name`: Archetype name (e.g., "Analytical", "Collaborative")
- `beschreibung`: Description
- `big_five_profile`: JSONB with openness, conscientiousness, extraversion, agreeableness, neuroticism

**Source:** `data/personality_types.csv` → Imported via `npm run db:seed`

### `agents`
AI agent definitions with personality profiles.

**Key Fields:**
- `name`, `description`: Agent identification
- `personality_profile`: JSONB with Big Five traits (0.0-1.0)
- `power_level`: Negotiation strength (0-10)
- `preferred_tactics`: UUID array of favored tactics

**Purpose:** Configurable AI negotiators for simulations.

### `negotiation_contexts`
Reusable business scenarios.

**Key Fields:**
- `name`, `description`: Context identification
- `product_info`: JSONB with product details
- `market_conditions`: JSONB with market context
- `baseline_values`: JSONB with reference values

**Purpose:** Template scenarios for consistent testing.

## Key Relationships

```
negotiations (1)
├── products (N) ──────────┐
├── negotiation_dimensions (N)
├── simulation_queue (1)
│   └── simulation_runs (N×M)
│       ├── product_results (N) ─┘
│       └── negotiation_rounds (N)
├── negotiation_contexts (1)
├── buyer_agent (1)
└── seller_agent (1)
```

**Cascade Deletes:**
- Delete negotiation → Deletes all related runs, products, dimensions
- Delete simulation_run → Deletes all product_results, rounds

## Data Flow

### Negotiation Setup
1. User creates `negotiation` with business context
2. System creates `products` (1 or more, if Phase2)
3. Optional: `negotiation_dimensions` for non-price terms (or legacy `user_zopa` JSONB)
4. When negotiation is started (`POST /api/negotiations/:id/start`):
   - System creates `simulation_queue`
   - System generates `simulation_runs` (N×M combinations via queue)
5. **Note:** Legacy route (`POST /api/negotiations`) no longer creates runs directly to avoid duplicates

### Simulation Execution
1. Queue processor picks pending `simulation_run`
2. Python service executes negotiation
3. Results stored in `simulation_run`:
   - `deal_value`, `outcome`, `conversation_log`
4. Per-product results stored in `product_results`
5. Optional: `negotiation_rounds` for detailed transcript
6. **AI Evaluation** (automatic):
   - `tactical_summary` generated
   - `technique_effectiveness_score` calculated
   - `tactic_effectiveness_score` calculated

### Analysis & Display
1. Frontend queries `simulation_runs` with joins
2. Aggregates by technique/tactic for matrix view
3. Displays `product_results` for price breakdown
4. Shows AI evaluation scores and summaries

## Schema Evolution

### Phase 1 (September 2024)
- Initial schema with single `deal_value` field
- Basic ZOPA tracking

### Phase 2 (October 2024)
- **Multi-Product Support:** Added `products` and `product_results` tables
- **Flexible Dimensions:** Added `negotiation_dimensions` for non-price terms
- **Enhanced Tracking:** Per-product ZOPA validation and performance scores

### Phase 3 (Januar 2025)
- **AI Evaluation:** Added 3 fields to `simulation_runs`
  - `tactical_summary` (text)
  - `technique_effectiveness_score` (decimal 5,2)
  - `tactic_effectiveness_score` (decimal 5,2)
- **Automatic Hook:** Evaluation triggers after DEAL_ACCEPTED/WALK_AWAY outcomes

### Phase 4 (Januar 2025) - Schema Synchronization
- **Phase2 Fields:** Added Phase2-specific fields to `negotiations` table
  - `company_known` (boolean)
  - `counterpart_known` (boolean)
  - `negotiation_frequency` (text)
  - `power_balance` (integer)
  - `verhandlungs_modus` (text)
- **Simulation Run Creation:** Fixed duplicate run creation issue
  - Legacy route no longer creates runs directly
  - All runs now created via `simulation_queue` for consistency
- **DEPRECATED Fields:** Marked `user_zopa` and `counterpart_distance` as deprecated
  - Migration path: Use `negotiation_dimensions` table instead
  - Fields retained for backward compatibility during migration period

## Derived Metrics

### Success Rate
```
Success Rate = (zopaAchieved runs) ÷ (completed runs) × 100
```

### Average Deal Value
```
Avg Deal Value = MEAN(deal_value) for completed runs
```

### Total Cost
```
Total Cost = SUM(actual_cost) across all simulation_runs
```

### ZOPA Utilization
Per product:
```
ZOPA Utilization = |agreed_price - min_max_price| ÷ |target_price - min_max_price| × 100
```

### Technique/Tactic Effectiveness
AI-generated scores (1-10):
- Based on conversation flow analysis
- Considers outcome, ZOPA achievement, round efficiency
- Stored per simulation run

## Schema Changes Process

1. **Modify Schema:** Update `shared/schema.ts` with new structure
2. **Push to Database:** Run `npm run db:push` (dev) or create migration (production)
3. **Update Documentation:** 
   - Update this file (DATA_MODEL_SPECIFICATION.md)
   - Update AGENTS.md if affects architecture
   - Document in CHANGELOG.md
4. **Update Dependent Code:**
   - Update `SIMULATION_QUEUE.md` if affects execution
   - Update `TESTING_GUIDE.md` for new test cases
   - Update TypeScript types (auto-generated by Drizzle)

## Data Integrity

### Constraints
- `negotiation_dimensions`: `UNIQUE (negotiation_id, name)`
- `negotiation_dimensions`: `CHECK (min_value <= target_value <= max_value)`
- Foreign keys with cascade deletes ensure referential integrity

### Indexes
Drizzle automatically creates indexes on:
- Primary keys
- Foreign keys
- Unique constraints

For performance-critical queries, consider adding indexes on:
- `simulation_runs.status` (frequent filtering)
- `simulation_runs.outcome` (evaluation eligibility)
- `product_results.within_zopa` (analytics)

---

**Document Version:** 2.1 (Updated Januar 2025)  
**Last Schema Change:** Phase2 Fields & Simulation Run Fix (Januar 2025)  
**Maintainer:** Christian Au

For execution semantics, see `SIMULATION_QUEUE.md`.  
For service boundaries, see `ARCHITECTURE.md`.
