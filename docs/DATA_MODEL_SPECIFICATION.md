# ARIAN AI - Data Model Specification

## Overview
This document defines the complete data model for the ARIAN AI negotiation simulation platform, aligned with the workflow requirements and CSV data sources.

## Current State Analysis
- ✅ **Existing Tables**: 13 tables already defined with proper relationships
- ✅ **CSV Data Sources**: 3 files ready for import (techniques, tactics, personalities)
- ❌ **Missing Fields**: New workflow requirements not yet implemented
- ❌ **Flexible Dimensions**: Currently hardcoded ZOPA structure

## Required Schema Changes

### 1. Enhanced Negotiations Table
**Purpose**: Support new workflow requirements for business context and flexible dimensions

**Current Issues**:
- Missing title, negotiation type, relationship context
- Hardcoded 4-dimension ZOPA structure (volumen, preis, laufzeit, zahlungskonditionen)
- No support for user-defined dimensions

**Required Additions**:
```sql
ALTER TABLE negotiations ADD COLUMN:
- title TEXT NOT NULL DEFAULT 'Untitled Negotiation'
- negotiation_type TEXT CHECK (negotiation_type IN ('one-shot', 'multi-year')) NOT NULL DEFAULT 'one-shot'  
- relationship_type TEXT CHECK (relationship_type IN ('first', 'long-standing')) NOT NULL DEFAULT 'first'
- product_market_description TEXT
- additional_comments TEXT
```

**Migration Strategy**:
- Add columns with defaults to avoid breaking existing data
- Update existing records with placeholder values
- Remove hardcoded userZopa JSONB (replace with flexible dimensions table)

### 2. New Negotiation Dimensions Table
**Purpose**: Replace fixed ZOPA structure with flexible, user-defined dimensions

**Rationale**: 
- Workflow.md specifically mentions "add dimension with a click / remove them if necessary"
- Different negotiations may need different dimensions beyond the default 4
- Priority system (1-3) not supported in current JSONB structure

**Schema**:
```sql
CREATE TABLE negotiation_dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negotiation_id UUID NOT NULL REFERENCES negotiations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g. "price", "volume", "delivery_time", "quality_standard"
  min_value DECIMAL(15,4) NOT NULL,
  max_value DECIMAL(15,4) NOT NULL,  
  target_value DECIMAL(15,4) NOT NULL,
  priority INTEGER NOT NULL CHECK (priority IN (1,2,3)), -- 1=must have, 2=important, 3=flexible
  unit TEXT, -- e.g. "EUR", "pieces", "days", "%" (optional for display)
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_range CHECK (min_value <= target_value AND target_value <= max_value),
  CONSTRAINT unique_dimension_per_negotiation UNIQUE (negotiation_id, name)
);

-- Indexes for performance
CREATE INDEX idx_negotiation_dimensions_negotiation_id ON negotiation_dimensions(negotiation_id);
CREATE INDEX idx_negotiation_dimensions_priority ON negotiation_dimensions(priority);
```

**Default Dimensions**: When creating a new negotiation, auto-create these 4 dimensions:
1. `price` (unit: "EUR", priority: 1)
2. `volume` (unit: "pieces", priority: 1) 
3. `payment_terms` (unit: "days", priority: 2)
4. `contract_duration` (unit: "months", priority: 2)

### 3. Enhanced Simulation Runs Table
**Purpose**: Support conversation logs and dimension-specific results

**Required Additions**:
```sql
ALTER TABLE simulation_runs ADD COLUMN:
- conversation_log JSONB DEFAULT '[]' NOT NULL
- dimension_results JSONB DEFAULT '{}' NOT NULL
- personality_archetype TEXT -- Link to personality_types data
```

**Data Formats**:
```typescript
// conversation_log format
type ConversationLog = Array<{
  round: number;
  agentId: string;
  agentRole: 'buyer' | 'seller';
  message: string;
  proposal?: {
    [dimensionName: string]: number;
  };
  timestamp: string;
}>;

// dimension_results format  
type DimensionResults = {
  [dimensionName: string]: {
    finalValue: number;
    achievedTarget: boolean; // Did this run achieve the target for this dimension?
    priorityScore: number; // How well did this address the priority (1-3 scale)?
  };
};
```

### 4. New Personality Types Table
**Purpose**: Store personality archetypes from personality_types.csv for agent configuration

**Schema**:
```sql
CREATE TABLE personality_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archetype TEXT NOT NULL UNIQUE, -- "Offenheit für Erfahrungen", "Gewissenhaftigkeit", etc.
  behavior_description TEXT NOT NULL, -- "verhalten_in_verhandlungen" column  
  advantages TEXT NOT NULL, -- "vorteile" column
  risks TEXT NOT NULL, -- "risiken" column
  created_at TIMESTAMP DEFAULT NOW()
);
```

## CSV Import Specifications

### 1. Influencing Techniques (11 records)
**Source**: `data/influencing_techniques.csv`
**Target**: `influencing_techniques` table (already exists)
**Key Processing**:
- Split `wichtige_aspekte` by commas → JSON array
- Split `key_phrases` by ` | ` → JSON array  
- Handle German characters (ä, ö, ü) properly

**Sample Mapping**:
```csv
Legitimieren;Einflussnahme durch...;Verweis auf...;Wirkt nicht...;Unsere Unternehmensrichtlinien...
```
```json
{
  "name": "Legitimieren",
  "beschreibung": "Einflussnahme durch...",
  "anwendung": "Verweis auf...", 
  "wichtigeAspekte": ["Wirkt nicht bei Personen, die Autorität ablehnen", "übermäßiger Einsatz löst leicht Widerstand aus"],
  "keyPhrases": ["Unsere Unternehmensrichtlinien lassen hier leider keinen weiteren Spielraum", "Ich muss mich an die Vorgaben halten"]
}
```

### 2. Negotiation Tactics (45 records)  
**Source**: `data/negotiation_tactics.csv`
**Target**: `negotiation_tactics` table (already exists)
**Processing**: Same as techniques (wichtige_aspekte → JSON, key_phrases split by |)

### 3. Personality Types (5 records)
**Source**: `data/personality_types.csv`  
**Target**: New `personality_types` table
**Processing**: Direct mapping, no JSON conversion needed

## Data Relationships & Integrity

### Core Entity Relationships
```
Negotiation (1) → (N) NegotiationDimensions
Negotiation (1) → (N) SimulationRuns  
SimulationRun (1) → (N) NegotiationRounds
SimulationRun (N) → (1) InfluencingTechnique
SimulationRun (N) → (1) NegotiationTactic
SimulationRun (N) → (1) PersonalityType (new)
```

### Cascade Delete Rules
- Delete Negotiation → Delete all Dimensions, SimulationRuns, Rounds
- Delete SimulationRun → Delete all Rounds
- Techniques/Tactics/Personalities → RESTRICT (don't allow delete if referenced)

## Migration Strategy

### Phase 1: Schema Updates (Safe)
1. Add new columns to existing tables with defaults
2. Create new `negotiation_dimensions` table
3. Create new `personality_types` table
4. Create all indexes

### Phase 2: Data Migration
1. For existing negotiations:
   - Extract current `userZopa` JSONB data
   - Create 4 default dimensions with extracted min/max/target values
   - Set default priorities (price=1, volume=1, payment=2, duration=2)
2. Import CSV data into respective tables
3. Validate data integrity

### Phase 3: Schema Cleanup
1. Remove old `userZopa` column from negotiations table
2. Remove old `counterpartDistance` column (replace with dimension-level distance)
3. Update TypeScript types and validation schemas

## API Impact Analysis

### New Endpoints Required
- `GET /api/negotiations/:id/dimensions` - Get flexible dimensions
- `POST /api/negotiations/:id/dimensions` - Add new dimension
- `PUT /api/negotiations/:id/dimensions/:dimensionId` - Update dimension
- `DELETE /api/negotiations/:id/dimensions/:dimensionId` - Remove dimension
- `GET /api/personality-types` - List available personality archetypes

### Modified Endpoints
- `POST /api/negotiations` - Accept title, type, relationship fields + dimensions array
- `GET /api/negotiations/:id` - Include dimensions in response
- `GET /api/simulation-runs/:id` - Include conversation_log and dimension_results

## Critical Query Patterns for Dimension Analysis

### Primary Use Case: Dimension-Specific Result Comparison
**Requirement**: "Easily get all results for a specific dimension in a simulation"

**Query Example**: 
```sql
-- Get all "price" results across simulation runs for comparison
SELECT 
  sr.id as simulation_run_id,
  sr.run_number,
  t.name as technique,
  nt.name as tactic,
  (sr.dimension_results->'price'->>'finalValue')::decimal as price_result,
  (sr.dimension_results->'price'->>'achievedTarget')::boolean as achieved_target,
  sr.success_score
FROM simulation_runs sr
JOIN influencing_techniques t ON sr.technique_id = t.id  
JOIN negotiation_tactics nt ON sr.tactic_id = nt.id
WHERE sr.negotiation_id = $1 
  AND sr.dimension_results ? 'price' -- JSONB key exists
ORDER BY (sr.dimension_results->'price'->>'finalValue')::decimal DESC;
```

### Enhanced Data Structure for Efficient Dimension Queries

**Problem**: Current JSONB approach requires JSON parsing for every query
**Solution**: Add normalized dimension result table for complex queries

### 4.1. New Dimension Results Table (Optional Optimization)
```sql
CREATE TABLE dimension_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_run_id UUID NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
  dimension_name TEXT NOT NULL, -- Links to negotiation_dimensions.name
  final_value DECIMAL(15,4) NOT NULL,
  target_value DECIMAL(15,4) NOT NULL, -- Denormalized from negotiation_dimensions
  achieved_target BOOLEAN NOT NULL,
  priority_score INTEGER NOT NULL, -- How well this addressed the priority level
  improvement_over_batna DECIMAL(15,4), -- Improvement vs Best Alternative
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Performance indexes
  CONSTRAINT unique_dimension_per_run UNIQUE (simulation_run_id, dimension_name)
);

-- Critical indexes for dimension queries
CREATE INDEX idx_dimension_results_dimension_name ON dimension_results(dimension_name);
CREATE INDEX idx_dimension_results_final_value ON dimension_results(dimension_name, final_value);
CREATE INDEX idx_dimension_results_achieved ON dimension_results(dimension_name, achieved_target);
CREATE INDEX idx_dimension_results_composite ON dimension_results(simulation_run_id, dimension_name, final_value);
```

### Optimized Query Patterns

#### 1. Dimension Distribution Analysis
```sql
-- Get distribution of results for "price" dimension across all negotiations
SELECT 
  n.title,
  n.negotiation_type,
  dr.final_value,
  dr.achieved_target,
  sr.technique_id,
  sr.tactic_id
FROM dimension_results dr
JOIN simulation_runs sr ON dr.simulation_run_id = sr.id
JOIN negotiations n ON sr.negotiation_id = n.id  
WHERE dr.dimension_name = 'price'
  AND sr.status = 'completed'
ORDER BY dr.final_value;
```

#### 2. Best Technique-Tactic Combinations per Dimension
```sql
-- Find best performing technique-tactic combos for specific dimension
SELECT 
  t.name as technique,
  nt.name as tactic,
  AVG(dr.final_value) as avg_result,
  COUNT(*) as run_count,
  (COUNT(*) FILTER (WHERE dr.achieved_target = true))::float / COUNT(*) as success_rate
FROM dimension_results dr
JOIN simulation_runs sr ON dr.simulation_run_id = sr.id
JOIN influencing_techniques t ON sr.technique_id = t.id
JOIN negotiation_tactics nt ON sr.tactic_id = nt.id  
WHERE dr.dimension_name = $1 -- e.g. 'price'
  AND sr.status = 'completed'
GROUP BY sr.technique_id, sr.tactic_id, t.name, nt.name
HAVING COUNT(*) >= 3 -- Minimum runs for statistical relevance
ORDER BY success_rate DESC, avg_result DESC;
```

#### 3. Cross-Dimension Priority Analysis
```sql
-- Analyze how well different combinations achieve high-priority dimensions
SELECT 
  sr.technique_id,
  sr.tactic_id,
  nd.priority,
  AVG(dr.final_value) as avg_achievement,
  COUNT(*) FILTER (WHERE dr.achieved_target = true) as targets_hit
FROM dimension_results dr
JOIN simulation_runs sr ON dr.simulation_run_id = sr.id
JOIN negotiation_dimensions nd ON (sr.negotiation_id = nd.negotiation_id AND dr.dimension_name = nd.name)
WHERE nd.priority = 1 -- Must-have dimensions only
GROUP BY sr.technique_id, sr.tactic_id, nd.priority
ORDER BY avg_achievement DESC;
```

### Performance Optimization Strategy

#### Dual Storage Approach
1. **JSONB in simulation_runs**: Fast writes, complete data in single row
2. **Normalized dimension_results**: Fast analytical queries, optimized reads

#### Write Strategy
```typescript
// When simulation completes, write to both:
async function saveSimulationResults(runId: string, results: DimensionResults) {
  await db.transaction(async (tx) => {
    // 1. Update JSONB for fast single-run queries  
    await tx.update(simulationRuns)
      .set({ dimension_results: results })
      .where(eq(simulationRuns.id, runId));
    
    // 2. Insert normalized records for analytical queries
    const dimensionRecords = Object.entries(results).map(([dimName, dimResult]) => ({
      simulation_run_id: runId,
      dimension_name: dimName,
      final_value: dimResult.finalValue,
      target_value: dimResult.targetValue, // From negotiation_dimensions
      achieved_target: dimResult.achievedTarget,
      priority_score: dimResult.priorityScore
    }));
    
    await tx.insert(dimensionResults).values(dimensionRecords);
  });
}
```

#### Index Strategy
```sql
-- Essential indexes for dimension analysis
CREATE INDEX idx_simulation_runs_negotiation_technique ON simulation_runs(negotiation_id, technique_id);
CREATE INDEX idx_simulation_runs_negotiation_tactic ON simulation_runs(negotiation_id, tactic_id);  
CREATE INDEX idx_simulation_runs_status ON simulation_runs(status) WHERE status = 'completed';

-- Composite indexes for common query patterns
CREATE INDEX idx_dimension_results_analysis ON dimension_results(dimension_name, achieved_target, final_value);
CREATE INDEX idx_dimension_results_simulation_join ON dimension_results(simulation_run_id, dimension_name);

-- JSONB specific indexes for fallback queries
CREATE INDEX idx_simulation_runs_dimension_results_gin ON simulation_runs USING GIN (dimension_results);
```

### Query Performance Benchmarks (Target)
- **Single dimension, all runs**: < 50ms for 1000+ simulation runs
- **Cross-dimension analysis**: < 200ms for 10,000+ dimension results  
- **Technique effectiveness**: < 100ms with proper indexing
- **Radar chart data**: < 25ms (single negotiation, all dimensions)

### Alternative Architecture: Event Sourcing Approach
**For future consideration**: Store each negotiation round as an event, enable time-series analysis of dimension values throughout negotiation process.

```sql
-- Future: negotiation_events table
CREATE TABLE negotiation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_run_id UUID NOT NULL REFERENCES simulation_runs(id),
  round_number INTEGER NOT NULL,
  event_type TEXT NOT NULL, -- 'proposal', 'counteroffer', 'agreement'
  dimension_values JSONB NOT NULL, -- Dimension values at this point
  timestamp TIMESTAMP DEFAULT NOW()
);
```

This would enable queries like "Show how price negotiations evolved over rounds" for deeper analysis.

## Validation Rules

### Business Logic Constraints
1. **Dimension Values**: min ≤ target ≤ max (database constraint)
2. **Dimension Names**: Unique per negotiation (database constraint)  
3. **Priority Distribution**: At least one dimension must have priority=1
4. **Required Dimensions**: Price and Volume required for all negotiations
5. **Simulation Limits**: Max 1000 simulation runs per negotiation

### Data Quality Rules
1. **Conversation Logs**: Must have sequential round numbers
2. **Dimension Results**: Must include results for all negotiation dimensions
3. **Technique/Tactic References**: Must exist in respective tables
4. **Personality References**: Must exist in personality_types table

## Risk Assessment

### High Risk Changes
- ❌ **Removing userZopa column**: Breaking change for existing API clients
- ❌ **Changing simulation run structure**: May break existing analysis code

### Medium Risk Changes  
- ⚠️ **Adding required columns**: Need careful default handling
- ⚠️ **New table relationships**: Foreign key constraints may cause issues

### Low Risk Changes
- ✅ **Adding optional columns**: Backward compatible
- ✅ **Creating new tables**: No impact on existing functionality
- ✅ **CSV imports**: Read-only data addition

## Next Steps

1. **Review & Approve**: Confirm this data model meets requirements
2. **Create Migration Scripts**: Write safe database migration SQL
3. **Update TypeScript Types**: Modify shared/schema.ts
4. **Write Import Scripts**: Create CSV processing utilities
5. **Test Migration**: Run on copy of production data

**Status**: ✅ **Specification Complete** - Ready for implementation approval