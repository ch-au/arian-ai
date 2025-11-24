-- Migration: Schema Cleanup - Remove unused tables and columns
-- Date: 2025-11-18
-- Purpose: Remove legacy tables and fix schema to match current code

-- Step 1: Drop unused tables (in correct order due to FK constraints)
DROP TABLE IF EXISTS concessions CASCADE;
DROP TABLE IF EXISTS offers CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS interactions CASCADE;
DROP TABLE IF EXISTS round_states CASCADE;
DROP TABLE IF EXISTS negotiation_rounds CASCADE;
DROP TABLE IF EXISTS agent_metrics CASCADE;
DROP TABLE IF EXISTS performance_metrics CASCADE;
DROP TABLE IF EXISTS analytics_sessions CASCADE;
DROP TABLE IF EXISTS experiment_runs CASCADE;
DROP TABLE IF EXISTS experiments CASCADE;
DROP TABLE IF EXISTS benchmarks CASCADE;
DROP TABLE IF EXISTS product_dimension_values CASCADE;
DROP TABLE IF EXISTS policies CASCADE;

-- Step 2: Remove unused simulation_id foreign keys and columns
-- From simulation_runs
ALTER TABLE simulation_runs DROP CONSTRAINT IF EXISTS simulation_runs_simulation_id_simulations_id_fk;
ALTER TABLE simulation_runs DROP COLUMN IF EXISTS simulation_id;

-- From simulation_queue
ALTER TABLE simulation_queue DROP CONSTRAINT IF EXISTS simulation_queue_simulation_id_simulations_id_fk;
ALTER TABLE simulation_queue DROP COLUMN IF EXISTS simulation_id;

-- From agents
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_simulation_id_simulations_id_fk;
ALTER TABLE agents DROP COLUMN IF EXISTS simulation_id;

-- Drop the simulations table itself
DROP TABLE IF EXISTS simulations CASCADE;

-- Step 3: Clean up old/inconsistent data
-- Delete simulation_runs without deal_value (old structure before artifact processing)
DELETE FROM simulation_runs WHERE deal_value IS NULL;

-- Delete orphaned simulation_queue entries
DELETE FROM simulation_queue WHERE id NOT IN (
  SELECT DISTINCT queue_id FROM simulation_runs WHERE queue_id IS NOT NULL
);

-- Delete orphaned negotiations (optional - be careful!)
-- Uncomment if you want to delete negotiations without runs:
-- DELETE FROM negotiations WHERE id NOT IN (
--   SELECT DISTINCT negotiation_id FROM simulation_runs WHERE negotiation_id IS NOT NULL
-- );

-- Step 4: Drop unused enums (if any tables using them were removed)
-- Note: These might still be in use, check first
-- DROP TYPE IF EXISTS side CASCADE;
-- DROP TYPE IF EXISTS event_kind CASCADE;
-- DROP TYPE IF EXISTS value_kind CASCADE;

-- Step 5: Verify remaining tables
-- This will list all tables after cleanup
SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
