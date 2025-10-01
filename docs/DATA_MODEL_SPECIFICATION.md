# Data Model Specification

This reference describes the canonical PostgreSQL schema that powers ARIAN AI. Update this file whenever tables or key fields change so the data model stays aligned with product requirements.

## Core Tables
### `negotiations`
Stores the negotiation configuration and business context.
- `id` (UUID): primary key.
- `title`, `negotiation_type`, `relationship_type`, `product_market_description`, `additional_comments`.
- `status`: lifecycle state (`pending`, `running`, `completed`, etc.).
- Associations: one-to-many with `simulation_queue`, `simulation_runs`, `negotiation_dimensions`.

### `negotiation_dimensions`
Flexible ZOPA definitions per negotiation.
- Fields: `name`, `min_value`, `max_value`, `target_value`, `priority`, optional `unit`.
- Constraint: `unique (negotiation_id, name)` plus `valid_range` check (`min <= target <= max`).

### `simulation_queue`
Tracks aggregate execution state for a negotiation.
- Counters: `total_simulations`, `completed_count`, `failed_count`.
- Status: `pending`, `running`, `paused`, `completed`, `failed`.
- Cost fields: `estimated_total_cost`, `actual_total_cost`.
- Crash recovery: `crash_recovery_checkpoint` for queue-level state.

### `simulation_runs`
One row per technique/tactic/personality/ZOPA combination.
- Keys: `queue_id`, `negotiation_id`, `run_number`, `technique_id`, `tactic_id`, `personality_id`.
- Status: `pending`, `running`, `completed`, `failed`, `timeout`.
- Payload: `conversation_log` (JSON array) and `dimension_results` (JSON object of final values).
- Analytics: `total_rounds`, `actual_cost`, `zopa_distance`, retry counters.

### `negotiation_rounds`
Optional turn-by-turn transcript for deep analysis.
- Columns: `simulation_run_id`, `round`, `speaker`, `message`, `proposal`, timing metadata.
- Relationship: many-to-one with `simulation_runs`.

## Reference Data
- `influencing_techniques` (10 rows): Psychological levers with descriptions, examples, and best-use guidance.
- `negotiation_tactics` (44 rows): Tactical approaches plus advantages/risks.
- `personality_types`: Big Five derived archetypes informing agent prompts.
- CSV sources in `data/` seed these tables; keep them synchronized with the schema.

## Schema Changes
1. Update `shared/schema.ts` with the new structure.
2. Regenerate migrations/SQL via Drizzle (`npm run db:push` for dev, migrations for shared envs).
3. Document the change here with a short note about how downstream services should react.
4. If payloads change, update `SIMULATION_QUEUE.md` and `TESTING_GUIDE.md` to cover new fields.

## Derived Metrics
- Success rate = `completed` runs ÷ finished runs (`completed` + `failed` + `timeout`).
- Average deal value = mean of `dimension_results.Price` (or equivalent dimension) for completed runs.
- Total cost = sum of `simulation_runs.actual_cost` across a queue.

Refer to `SIMULATION_QUEUE.md` for execution semantics and to `ARCHITECTURE.md` for service boundaries that rely on these tables.
