# Proposed Database Schema for ARIAN Platform

## Current Issues Identified
1. **Negotiations table** has duplicate/conflicting columns
2. **Simulation Results** table structure is confusing 
3. Missing clear relationships between entities
4. ZOPA data scattered across multiple fields

## Proposed Clean Schema

### 1. Core Entity: negotiations
```sql
CREATE TABLE negotiations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id UUID REFERENCES negotiation_contexts(id),
  buyer_agent_id UUID REFERENCES agents(id),
  seller_agent_id UUID REFERENCES agents(id),
  
  -- Configuration
  user_role TEXT NOT NULL CHECK (user_role IN ('buyer', 'seller')),
  max_rounds INTEGER DEFAULT 10,
  simulation_runs INTEGER DEFAULT 1,
  
  -- Selected techniques and tactics for this negotiation
  selected_techniques TEXT[] DEFAULT '{}',
  selected_tactics TEXT[] DEFAULT '{}',
  
  -- User's ZOPA configuration (what the user wants to achieve)
  user_zopa JSONB NOT NULL, -- {volumen: {min,max,target}, preis: {min,max,target}, laufzeit: {min,max,target}, zahlungskonditionen: {min,max,target}}
  
  -- Counterpart positioning relative to user (-1: far, 0: neutral, 1: close)
  counterpart_distance JSONB DEFAULT '{}', -- {volumen: 0, preis: 0, laufzeit: 0, zahlungskonditionen: 0}
  
  -- Special requirements
  sonderinteressen TEXT,
  
  -- Status and timing
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);
```

### 2. Individual Runs: simulation_runs
```sql
CREATE TABLE simulation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negotiation_id UUID REFERENCES negotiations(id) ON DELETE CASCADE,
  run_number INTEGER NOT NULL, -- 1, 2, 3... for multiple simulation runs
  
  -- Status and timing
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Results
  total_rounds INTEGER DEFAULT 0,
  final_agreement JSONB, -- The final negotiated terms
  zopa_achieved BOOLEAN DEFAULT FALSE, -- Whether user's ZOPA was met
  success_score DECIMAL(5,2), -- 0-100 score
  
  -- Final negotiated values
  final_terms JSONB, -- {volumen: X, preis: Y, laufzeit: Z, zahlungskonditionen: W}
  
  -- Performance metrics
  avg_response_time_ms INTEGER,
  technique_effectiveness JSONB, -- {technique_id: score, ...}
  tactic_effectiveness JSONB, -- {tactic_id: score, ...}
  
  -- Constraints
  UNIQUE(negotiation_id, run_number)
);
```

### 3. Communication: negotiation_rounds
```sql
CREATE TABLE negotiation_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_run_id UUID REFERENCES simulation_runs(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  agent_id UUID REFERENCES agents(id),
  
  -- Content
  message TEXT NOT NULL,
  proposal JSONB, -- Current proposal/offer
  
  -- Performance
  response_time_ms INTEGER,
  timestamp TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(simulation_run_id, round_number, agent_id)
);
```

### 4. Configuration Tables (Keep as-is)
- `users` ✓
- `agents` ✓
- `negotiation_contexts` ✓
- `zopa_configurations` ✓
- `tactics` ✓
- `analytics_sessions` ✓
- `performance_metrics` ✓
- `influencing_techniques` ✓
- `negotiation_tactics` ✓

## Key Changes Summary

### 1. Simplified ZOPA Storage
- **Before**: 4 separate JSONB columns (userZopaVolumen, userZopaPreis, etc.)
- **After**: Single `user_zopa` JSONB with all dimensions
- **Before**: 4 separate integer columns for counterpart distance
- **After**: Single `counterpart_distance` JSONB

### 2. Clear Run Separation
- **Before**: `simulation_results` table with confusing relationship
- **After**: `simulation_runs` table with clear 1:many relationship to negotiations
- Each simulation run has its own results and performance metrics

### 3. Proper Round Tracking
- **Before**: `negotiation_rounds` tied directly to negotiations
- **After**: `negotiation_rounds` tied to specific simulation runs
- This allows proper tracking of multiple simulation runs

### 4. Cleaner Data Structure
```json
// Example user_zopa structure:
{
  "volumen": {"min": 100, "max": 1000, "target": 500},
  "preis": {"min": 10, "max": 100, "target": 50},
  "laufzeit": {"min": 12, "max": 36, "target": 24},
  "zahlungskonditionen": {"min": 30, "max": 90, "target": 60}
}

// Example counterpart_distance structure:
{
  "volumen": 0,
  "preis": -1,
  "laufzeit": 1,
  "zahlungskonditionen": 0
}

// Example final_terms structure:
{
  "volumen": 750,
  "preis": 65,
  "laufzeit": 30,
  "zahlungskonditionen": 45
}
```

## Benefits
1. **No duplicate columns** - Clean, normalized structure
2. **Clear relationships** - Easy to understand data flow
3. **Multiple simulation support** - Proper tracking of multiple runs
4. **Simplified ZOPA** - Single JSON objects instead of multiple columns
5. **Performance tracking** - Clear metrics per simulation run
6. **Scalable** - Easy to add new dimensions or features

## Migration Strategy
1. Create new tables with proposed structure
2. Migrate existing data to new format
3. Update application code to use new schema
4. Drop old tables

---

**Please review this proposed schema before I implement it. Does this structure make sense for your needs?**