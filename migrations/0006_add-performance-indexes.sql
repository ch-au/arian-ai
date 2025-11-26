-- Migration: Add performance indexes for common query patterns
-- Date: 2025-11-26
-- Phase 4 Security Hardening: Database Optimization

-- ============================================================================
-- Negotiations: User dashboard queries
-- ============================================================================

-- Index for filtering negotiations by user and status (dashboard view)
CREATE INDEX IF NOT EXISTS idx_negotiations_user_status
ON negotiations(user_id, status);

-- Index for sorting negotiations by start time (recent first)
CREATE INDEX IF NOT EXISTS idx_negotiations_user_started
ON negotiations(user_id, started_at DESC);

-- ============================================================================
-- Simulation Queue: Queue processing
-- ============================================================================

-- Index for finding queues by negotiation and status
CREATE INDEX IF NOT EXISTS idx_simulation_queue_negotiation_status
ON simulation_queue(negotiation_id, status);

-- Index for queue processing (find pending queues ordered by creation)
CREATE INDEX IF NOT EXISTS idx_simulation_queue_status_created
ON simulation_queue(status, created_at);

-- ============================================================================
-- Simulation Runs: Run lookups and analytics
-- ============================================================================

-- Index for finding runs by negotiation and status
CREATE INDEX IF NOT EXISTS idx_simulation_runs_negotiation_status
ON simulation_runs(negotiation_id, status);

-- Index for finding runs by queue and status
CREATE INDEX IF NOT EXISTS idx_simulation_runs_queue_status
ON simulation_runs(queue_id, status);

-- Partial index for completed runs (analytics queries)
CREATE INDEX IF NOT EXISTS idx_simulation_runs_completed_at
ON simulation_runs(completed_at DESC)
WHERE completed_at IS NOT NULL;

-- ============================================================================
-- Master data: Registration-scoped queries
-- ============================================================================

-- Index for counterparts by registration
CREATE INDEX IF NOT EXISTS idx_counterparts_registration
ON counterparts(registration_id);

-- Index for markets by registration
CREATE INDEX IF NOT EXISTS idx_markets_registration
ON markets(registration_id);

-- Index for products by registration
CREATE INDEX IF NOT EXISTS idx_products_registration
ON products(registration_id);

-- Index for dimensions by registration
CREATE INDEX IF NOT EXISTS idx_dimensions_registration
ON dimensions(registration_id);

-- ============================================================================
-- Refresh Tokens: Auth queries
-- ============================================================================
-- Note: Indexes for refresh_tokens are defined in schema.ts

-- ============================================================================
-- Analytics: Success rate trends optimization
-- ============================================================================

-- Composite index for analytics queries on simulation runs
CREATE INDEX IF NOT EXISTS idx_simulation_runs_analytics
ON simulation_runs(status, completed_at, outcome)
WHERE status = 'completed';
