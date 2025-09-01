# ARIAN AI - Detailed Implementation Plan

## Executive Summary

The ARIAN AI negotiation platform has solid architectural foundations but critical gaps prevent core functionality from working. This plan addresses the missing combinatorial simulation system, fixes data flow issues, and establishes a proper technique-tactic testing framework.

## Current State Assessment

### ✅ What's Working
- Database schema structure (with minor inconsistencies)
- Basic Express.js API setup
- React frontend architecture
- OpenAI integration foundation
- Langfuse observability setup

### ❌ Critical Issues Blocking Functionality
1. **Missing Combinatorial Simulation Core** - The main value proposition isn't implemented
2. **Broken Frontend Data Binding** - Form doesn't match backend schema
3. **Database Query Mismatches** - Rounds query by wrong foreign key
4. **Hardcoded Technique/Tactic System** - No database integration
5. **Single Negotiation Flow** - No multi-run testing capability

## Critical Design Decisions

### 1. Database Schema Alignment
**Decision**: Implement PROPOSED_SCHEMA.md as authoritative schema
- **Rationale**: Current schema partially implements it but lacks key relationships
- **Action**: Add missing constraints and fix foreign key relationships

### 2. Combinatorial Simulation Architecture
**Decision**: Implement N×M technique-tactic matrix testing system
- **Input**: User selects 3 techniques + 3 tactics
- **Output**: Automatically create 9 simulation runs
- **Tracking**: Each run tests one technique-tactic combination
- **Analytics**: Compare effectiveness across combinations

### 3. Data Flow Pattern
**Decision**: Negotiation → Simulation Runs → Rounds → Performance Metrics
```
Negotiation (1) → Simulation Runs (N×M) → Rounds (per run) → Metrics (per round)
```

### 4. Frontend-Backend Data Contract
**Decision**: Standardize on PROPOSED_SCHEMA.md field names
- Frontend: `userZopa.volumen.min` 
- Backend: `user_zopa` JSONB with same structure
- Fix: Update form field names to match schema

### 5. Technique/Tactic Integration Strategy
**Decision**: Dynamic database-driven system replacing hardcoded mappings
- Store techniques/tactics in database with rich metadata
- OpenAI service queries database for guidance generation
- Allows user customization without code changes

## Implementation Phases

### Phase 1: Critical Foundation Fixes (Priority 1)

#### 1.1 Fix CreateNegotiationForm Data Binding
**Files**: `client/src/components/CreateNegotiationForm.tsx`
- ✅ Fix broken field references (`userZopaVolumen` → `userZopa.volumen`)
- ✅ Align form schema with backend validation
- ✅ Fix counterpart distance field mapping
- ✅ Test form submission end-to-end

#### 1.2 Implement Simulation Run Creation Logic
**Files**: `server/storage.ts`, `server/routes.ts`
- ✅ Add `createNegotiationWithSimulationRuns()` method
- ✅ Implement combinatorial logic: techniques × tactics = runs
- ✅ Update negotiation creation endpoint to generate runs
- ✅ Add transaction support for atomic creation

#### 1.3 Fix Database Query Layer
**Files**: `server/storage.ts`
- ✅ Fix `getNegotiationRounds()` to query by `simulationRunId`
- ✅ Add `getSimulationRuns(negotiationId)` method
- ✅ Implement proper JOIN queries for related data
- ✅ Add missing simulation run CRUD operations

#### 1.4 Remove Duplicate Routes
**Files**: `server/routes.ts`
- ✅ Remove duplicate start/stop negotiation routes
- ✅ Consolidate error handling patterns
- ✅ Clean up validation logic

### Phase 2: Core Simulation System (Priority 1)

#### 2.1 Implement Technique/Tactic Database Integration
**Files**: `server/services/openai.ts`, `server/storage.ts`
- ✅ Replace hardcoded mappings with database queries
- ✅ Add `getTechnique(id)` and `getTactic(id)` methods
- ✅ Generate dynamic guidance from database content
- ⬜️ Cache frequently accessed technique/tactic data

#### 2.2 Build Combinatorial Negotiation Engine
**Files**: `server/services/negotiation-engine.ts`
- ✅ Implement `runSimulationMatrix()` method
- ✅ Execute multiple runs with different technique-tactic combinations
- ✅ Track performance metrics per combination
- ✅ Add proper error handling and rollback

#### 2.3 Add Simulation Run Management
**Files**: `server/routes.ts`, `client/src/pages/simulation-confirmation.tsx`
- ✅ API endpoints for simulation run status/control
- ⬜️ Frontend interface to monitor multiple runs
- ⬜️ Progress tracking and real-time updates
- ⬜️ Individual run control (pause/resume/stop)

### Phase 3: Frontend Integration & UX (Priority 2)

#### 3.1 Build Simulation Confirmation Screen
**Files**: `client/src/pages/simulation-confirmation.tsx`
- ✅ Display technique-tactic combination matrix
- ✅ Show expected number of runs (N×M)
- ✅ Allow user to review before starting
- ✅ Add cost estimation display

#### 3.2 Integrate Real Technique/Tactic Data
**Files**: `client/src/components/CreateNegotiationForm.tsx`
- ✅ Replace hardcoded arrays with API queries
- ✅ Add loading states and error handling
- ✅ Implement search/filter for large datasets
- ✅ Add technique/tactic description tooltips

#### 3.3 Dashboard Enhancement for Multi-Run Display
**Files**: `client/src/pages/dashboard.tsx`, `client/src/components/dashboard/`
- ✅ Show simulation runs vs single negotiations
- ✅ Add combination effectiveness charts
- ✅ Display parallel execution status
- ✅ Add technique/tactic performance comparison

### Phase 4: Performance & Reliability (Priority 2)

#### 4.1 Add Transaction Management
**Files**: `server/db.ts`, `server/storage.ts`
- Implement database transaction wrapper
- Add rollback capability for failed simulation creation
- Ensure data consistency across simulation runs
- Add connection pooling optimization

#### 4.2 Implement Caching Layer
**Files**: `server/services/cache.ts` (new)
- Cache technique/tactic data
- Cache agent personality profiles
- Add Redis integration for distributed caching
- Implement cache invalidation strategies

#### 4.3 Add Comprehensive Error Handling
**Files**: All service files
- Standardize error response format
- Add proper HTTP status codes
- Implement retry logic for OpenAI calls
- Add circuit breaker for external API failures

#### 4.4 WebSocket Enhancement
**Files**: `server/services/negotiation-engine.ts`
- Room-based WebSocket subscriptions
- Real-time simulation run progress updates
- Client reconnection handling
- Message queuing for offline clients

## Technical Implementation Details

### Database Changes Required

```sql
-- Add missing constraints
ALTER TABLE simulation_runs 
ADD CONSTRAINT unique_negotiation_technique_tactic 
UNIQUE(negotiation_id, technique_id, tactic_id);

-- Add missing indexes for performance
CREATE INDEX idx_simulation_runs_negotiation_id ON simulation_runs(negotiation_id);
CREATE INDEX idx_negotiation_rounds_simulation_run_id ON negotiation_rounds(simulation_run_id);
```

### API Contract Changes

#### New Endpoint: Create Negotiation with Simulation Runs
```typescript
POST /api/negotiations
{
  contextId: string,
  buyerAgentId: string,
  sellerAgentId: string,
  selectedTechniques: string[], // UUIDs
  selectedTactics: string[], // UUIDs
  userZopa: {
    volumen: {min, max, target},
    preis: {min, max, target},
    laufzeit: {min, max, target},
    zahlungskonditionen: {min, max, target}
  },
  counterpartDistance: {
    volumen: -1|0|1,
    preis: -1|0|1,
    laufzeit: -1|0|1,
    zahlungskonditionen: -1|0|1
  }
}

Response: {
  negotiation: Negotiation,
  simulationRuns: SimulationRun[],
  totalCombinations: number
}
```

#### New Endpoint: Simulation Run Control
```typescript
POST /api/negotiations/:id/simulation-runs/start
GET /api/negotiations/:id/simulation-runs
GET /api/simulation-runs/:runId/status
POST /api/simulation-runs/:runId/stop
```

### Frontend Component Architecture

#### Simulation Confirmation Component
```typescript
interface SimulationMatrix {
  techniques: InfluencingTechnique[];
  tactics: NegotiationTactic[];
  combinations: Array<{
    technique: InfluencingTechnique;
    tactic: NegotiationTactic;
    estimatedDuration: number;
    estimatedCost: number;
  }>;
  totalRuns: number;
  totalEstimatedCost: number;
}
```

#### Real-time Monitoring Component
```typescript
interface SimulationProgress {
  negotiationId: string;
  totalRuns: number;
  completedRuns: number;
  currentlyRunning: SimulationRun[];
  results: Array<{
    technique: string;
    tactic: string;
    success: boolean;
    score: number;
    duration: number;
  }>;
}
```

### OpenAI Service Enhancement

#### Dynamic Prompt Generation
```typescript
class DynamicPromptService {
  async buildTechniquePrompt(techniqueId: string): Promise<string> {
    const technique = await storage.getInfluencingTechnique(techniqueId);
    return `Apply ${technique.name}: ${technique.anwendung}. 
    Key aspects: ${technique.wichtigeAspekte.join(', ')}.
    Use phrases like: ${technique.keyPhrases.join(', ')}.`;
  }
  
  async buildTacticPrompt(tacticId: string): Promise<string> {
    const tactic = await storage.getNegotiationTactic(tacticId);
    return `Use ${tactic.name} tactic: ${tactic.anwendung}.
    Focus on: ${tactic.wichtigeAspekte.join(', ')}.
    Key phrases: ${tactic.keyPhrases.join(', ')}.`;
  }
}
```

## Risk Mitigation Strategies

### 1. Data Consistency Risks
- **Risk**: Partial simulation run creation on failure
- **Mitigation**: Database transactions with rollback
- **Monitoring**: Add creation status tracking

### 2. OpenAI API Rate Limits
- **Risk**: Failed simulation runs due to rate limiting
- **Mitigation**: Implement exponential backoff and queuing
- **Monitoring**: Track API success rates and costs

### 3. Frontend State Management
- **Risk**: Complex state across multiple simulation runs
- **Mitigation**: Use TanStack Query with proper cache keys
- **Monitoring**: Add client-side error boundaries

### 4. Performance with Large Combinations
- **Risk**: N×M combinations could be expensive (e.g., 10×10 = 100 runs)
- **Mitigation**: Add user limits and cost warnings
- **Monitoring**: Track execution times and costs

## Quality Assurance Plan

### Testing Strategy
1. **Unit Tests**: Core simulation logic, data transformations
2. **Integration Tests**: API endpoints, database operations
3. **E2E Tests**: Complete negotiation flow
4. **Load Tests**: Multiple concurrent simulations

### Validation Checkpoints
1. **Phase 1 Completion**: Single negotiation works end-to-end
2. **Phase 2 Completion**: 2×2 combination matrix executes successfully
3. **Phase 3 Completion**: Frontend displays real-time progress
4. **Phase 4 Completion**: Performance benchmarks met

## Success Metrics

### Functional Success
- [ ] User can create negotiation with technique/tactic selection
- [ ] System automatically generates N×M simulation runs
- [ ] Each run executes with proper technique/tactic application
- [ ] Results show comparative effectiveness

### Performance Success
- [ ] <5s to create simulation matrix
- [ ] <30s per individual simulation run
- [ ] Real-time progress updates (<1s latency)
- [ ] <$1 API cost per 3×3 combination matrix

### Code Quality Success
- [ ] 0 duplicate code blocks
- [ ] All TypeScript strict mode compliance
- [ ] >80% test coverage on core simulation logic
- [ ] All API endpoints have proper error handling

## Next Steps

1. **Immediate**: Fix CreateNegotiationForm data binding (30 min)
2. **Priority**: Implement simulation run creation logic (2-3 hours)
3. **Critical**: Fix storage layer queries (1 hour)
4. **Integration**: Connect technique/tactic database (2 hours)

**Estimated Total Implementation Time**: 8-12 hours for core functionality

Ready to proceed with Phase 1 implementation?
