# Data Model Specification (November 2025)

This document reflects the normalized schema introduced with the **registrations / markets / counterparts** refactor and the enhanced simulation pipeline. Any reference to the legacy tables (`negotiation_contexts`, `negotiation_dimensions`, etc.) has been removed—those objects no longer exist in the database or runtime code.

---

## 1. Master Data & Setup

| Table | Purpose | Key columns |
| --- | --- | --- |
| `registrations` | Tenant-level configuration (organization, cadence, goals) | `organization`, `company`, `negotiation_type`, `negotiation_frequency`, `goals` (JSONB) |
| `markets` | Market definition per registration | `registration_id` FK, `name`, `region`, `country_code`, `currency_code`, `meta` (JSONB – e.g., intelligence) |
| `counterparts` | Buyer/seller counterpart profiles | `registration_id` FK, `name`, `kind`, `power_balance`, `dominance`, `affiliation`, `style`, `constraints_meta` |
| `dimensions` | Catalog of reusable dimensions per registration | `registration_id` FK, `code`, `name`, `value_type`, `unit`, `spec` (JSONB) |
| `products` | Product catalog scoped to a registration | `registration_id` FK, `name`, `gtin`, `brand`, `attrs` (JSONB) |
| `product_dimension_values` | Historical product metrics | Composite PK `(product_id, dimension_id, measured_at)`, `value` (JSONB), `is_current` flag |

**Notes**
- Negotiation-specific dimension targets live inside the `negotiations.scenario` JSON (see section 2). We dropped the separate `negotiation_dimensions` table; all runtime code reads the scenario JSON instead.
- `product_dimension_values` replaces the old ZOPA configuration tables—each product can track rolling measurements for price, volume, etc.

---

## 2. Negotiations & Scenarios

| Table | Key columns / JSON fields |
| --- | --- |
| `negotiations` | `registration_id`, optional `market_id`/`counterpart_id`, `title`, `description`, `status`, `scenario` (JSONB), `metadata` |
| `negotiation_products` | `(negotiation_id, product_id)` junction |
| `negotiation_rounds` | `negotiation_id`, `round_number`, `state` (JSONB), timestamps |
| `round_states` | `round_id`, BDI state JSON (beliefs / intentions / thresholds) |

### Scenario JSON (stored in `negotiations.scenario`)
```jsonc
{
  "userRole": "seller",
  "negotiationType": "annual-review",
  "relationshipType": "strategic",
  "negotiationFrequency": "quarterly",
  "maxRounds": 6,
  "selectedTechniques": ["technique-id"],
  "selectedTactics": ["tactic-id"],
  "counterpartDistance": { "gesamt": 50 },
  "dimensions": [
    {
      "id": "uuid",
      "name": "Preis pro Einheit",
      "minValue": 0.95,
      "maxValue": 1.30,
      "targetValue": 1.10,
      "priority": 1,
      "unit": "EUR"
    }
  ],
  "metadata": {
    "companyKnown": true,
    "counterpartKnown": true
  }
}
```

**Additional Context Fields:**
- `negotiations.description` → General remarks/hints for the negotiation
- `markets.meta.intelligence` → Market-specific insights for prompt context
- `counterparts.dominance` → Interpersonal Circumplex dominance axis (-100 to +100)
- `counterparts.affiliation` → Interpersonal Circumplex affiliation axis (-100 to +100)

All prompt variables are derived from this JSON plus the joined registration/market/counterpart records.

---

## 3. Simulation Queue & Runs

| Table | Purpose |
| --- | --- |
| `simulation_queue` | Tracks aggregate progress for a negotiation run (status, counts, estimated vs. actual API cost, crash recovery checkpoints). |
| `simulation_runs` | One record per technique × tactic × personality × distance combination. Stores status, conversation log, other dimensions, evaluation scores, etc. |
| `dimension_results` | Final dimension-level outcomes per run (`final_value`, `target_value`, `achieved_target`, `priority_score`). |
| `product_results` | Per-product outcomes (`agreed_price`, `subtotal`, `within_zopa`, `performance_score`, etc.). |

### AI Evaluation fields (on `simulation_runs`)
- `technique_effectiveness_score` (DECIMAL)
- `tactic_effectiveness_score`
- `tactical_summary` (TEXT, German summary)

### Result storage
- `conversation_log` (JSONB array) replaces the legacy `negotiation_rounds` text logs.
  - Each entry includes: `round`, `agent`, `message`, `offer`, `action`, `internal_analysis`, `batna_assessment`, `walk_away_threshold`
  - **NEW**: Also includes `bdi_state` with `beliefs` and `intentions` for state continuity
- `other_dimensions` stores non-product terms (payment, delivery, etc.). Product pricing stays in `product_results`.

### BDI State Flow (Belief-Desire-Intention Architecture)
Each agent maintains internal state across rounds:

**Output per round** (in `conversation_log`):
```jsonb
{
  "round": 1,
  "agent": "SELLER",
  "message": "...",
  "offer": {...},
  "action": "continue",
  "bdi_state": {
    "beliefs": {
      "opponent_priorities_inferred": {"Price": "high"},
      "opponent_emotional_state": "cooperative",
      "opponent_urgency": "medium",
      "market_signals": {},
      "risk_flags": []
    },
    "intentions": "Next round strategy..."
  },
  "internal_analysis": "Private reasoning",
  "batna_assessment": 0.75,
  "walk_away_threshold": 0.25
}
```

**Feedback mechanism**:
1. Agent A produces `bdi_state` in round N
2. Round N+1: Python service extracts Agent A's previous `bdi_state.beliefs` and `bdi_state.intentions`
3. These are injected into Agent A's system prompt as `{{last_round_beliefs_json}}` and `{{last_round_intentions}}`
4. Agent A can reference its own previous beliefs to maintain strategic continuity
5. Opponent's actions are analyzed to update `opponent_priorities_inferred` and `observed_behaviour`

This enables:
- **Memory continuity**: Agent remembers what it believed/intended previously
- **Opponent modeling**: Agent builds understanding of opponent's priorities over time
- **Strategic adaptation**: Agent adjusts strategy based on observed concessions

---

## 4. Events, Offers, Metrics

| Table | Purpose |
| --- | --- |
| `offers` | Structured offer payloads per round (`price`, `quantity`, `terms` JSON). |
| `events` | Unified log (messages, tool calls, actions) linked to rounds. |
| `agent_metrics` | Performance metrics (latency, API cost, etc.) per agent. |
| `interactions` | Optional RL-style step/reward logs. |
| `performance_metrics` / `analytics_sessions` | High-level dashboard metrics. |

The new Langfuse prompt system writes BDI state into `round_states` after each round, and the frontend fetches those JSON blobs to display “beliefs / desires / intentions” in the analysis view.

---

## 5. Reference Data (unchanged)

- `influencing_techniques` (seeded from CSV)
- `negotiation_tactics` (seeded from CSV)
- `personality_types`, `agents`, `policies`

---

## 6. Relationships Overview

```
registrations
├── markets
├── counterparts
├── products ─┬─ product_dimension_values
│             └─ negotiation_products ──┐
└── negotiations ───────────────────────┼─ simulation_queue ── simulation_runs
                                        │    ├─ dimension_results
                                        │    └─ product_results
                                        ├─ negotiation_rounds ─ round_states
                                        ├─ offers
                                        └─ events / agent_metrics / interactions
```

---

## 7. Verification Script

`server/scripts/verify-schema.ts` now checks for the normalized table set (registrations, markets, counterparts, etc.) and validates the `product_results` column definitions. Run it after each migration to confirm the target database matches this specification.

```
npm run verify:schema      # custom script, or tsx server/scripts/verify-schema.ts
```

---

## 8. Migration Notes

- The legacy tables (`negotiation_contexts`, `negotiation_dimensions`, `zopa_configurations`, etc.) were dropped in migration `0000_redundant_menace.sql`. Do not reference them in new code.
- Scenario dimensions are stored inline in `negotiations.scenario`. When editing via the API/UI, always read/modify the JSON (storage helpers already normalize IDs).
- Product-level ZOPA and historical metrics should flow through `product_dimension_values` (historical) and `product_results` (simulation outcome).

---

Questions or schema changes? Update this document and re-run the verification script so tooling stays in sync with the database.***
