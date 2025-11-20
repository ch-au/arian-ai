# Implementation Plan - Quick Reference

## Overview
Migration from current schema to enhanced schema with advanced prompt system using Langfuse.

## Key Changes

### 1. Schema (Major Overhaul)
- **New Tables**: `markets`, `counterparts`, `registrations`, `dimensions`, `product_dimension_values`, `events`, `offers`, `concessions`
- **Enhanced Tables**: `agents` (now includes role, agent_kind, model_name, system_prompt, tools, policy_id, hyperparams)
- **Strategy**: Fresh start (reset database) recommended

### 2. Prompts (Dual System)
- **Current**: Single prompt `negotiation` from Langfuse
- **New**: 
  - `agents/self_agent` - For user's agent
  - `agents/opponent_agent` - For opponent agent
- **Location**: Langfuse UI (must be created before deployment)

### 3. Frontend (New Fields)
**Registration Flow** (NEW):
- Organization, company, country
- Market selection
- Negotiation type/frequency
- Goals

**Negotiation Form** (ENHANCED):
- Market & counterpart selection
- Registration link
- Enhanced product-dimension configuration
- Agent configuration (role, kind, model, tools, policy)
- BDI state initialization

**New Management Pages**:
- Markets CRUD
- Counterparts CRUD
- Dimensions CRUD
- Products CRUD

### 4. Service Layer (Variable Mapping)

#### Variables from `self_agent.md`:

**INPUT STATE**:
- `current_round`, `max_rounds` ✅
- `previous_rounds` - Conversation history
- `current_round_message` - Last opponent message
- `opponent_last_offer` - Structured offer

**BELIEFS**:
- `product_market_description` - From products + markets
- `negotiation_context` - From negotiations.scenario
- `negotiation_frequency` - From registrations
- `negotiation_type` - From registrations
- `intelligence` - Market intelligence
- `counterpart_company` - From counterparts.name
- `counterpart_known`, `company_known` - From negotiations
- `counterpart_attitude` - Derived from counterpart style + power_balance
- `counterpart_distance` - From negotiations.counterpartDistance
- `power_balance` - From counterparts or negotiations
- `counterpart_description` - From counterparts table
- `inferred_preferences` - From BDI state analysis
- `observed_behaviour` - From BDI state analysis
- `last_round_beliefs_json` - From events table

**DESIRES**:
- `product_name` - From products.name
- `zielpreis` - From products.zielPreis
- `maxpreis` - From products.minMaxPreis
- `volume` - From products.geschätztesVolumen
- `dimension_name`, `dimension_unit` - From negotiationDimensions
- `min_value`, `max_value`, `target_value` - From negotiationDimensions
- `goal_priorities` - From negotiationDimensions.priority

**INTENTIONS**:
- `last_round_intentions` - From events table
- `dimension_examples` - Generated from dimensions

**MOVE LIBRARY**:
- `technique_name`, `technique_description`, `technique_application`, `technique_key_aspects`, `technique_key_phrases` - From influencingTechniques
- `tactic_name`, `tactic_description`, `tactic_application`, `tactic_key_aspects`, `tactic_key_phrases` - From negotiationTactics

**OUTPUT**:
- `dimension_schema` - Generated from negotiationDimensions
- `beliefs_schema` - Structured beliefs JSON

### 5. BDI State Persistence (NEW)
- Save after each round to `events` table
- Fields: `beliefs` (JSONB), `intentions` (text), `internal_analysis` (text), `batna_assessment` (numeric), `walk_away_threshold` (numeric)
- Used in next round as `last_round_beliefs_json` and `last_round_intentions`

### 6. Offer & Concession Tracking (NEW)
- **Offers**: Track each offer in `offers` table with price, quantity, terms, accepted status
- **Concessions**: Track changes between rounds in `concessions` table

## Implementation Phases

### Phase 1: Schema Migration (Week 1)
1. Create `shared/schema-enhanced.ts`
2. Update Drizzle config
3. Run `npm run db:push`
4. Update storage layer
5. Create seed data

### Phase 2: Frontend (Week 2)
1. Registration page
2. Market/counterpart/dimension/product management
3. Enhanced negotiation form
4. API routes

### Phase 3: Service Layer (Week 3)
1. Langfuse dual prompt integration
2. Python variable mapping
3. BDI state persistence
4. Offer/concession tracking

### Phase 4: Testing (Week 4)
1. Unit tests
2. Integration tests
3. End-to-end tests
4. Bug fixes

## Critical Prerequisites

1. **Langfuse Prompts**: Must create `agents/self_agent` and `agents/opponent_agent` in Langfuse UI before deployment
2. **Database Reset**: Approval needed for fresh start approach
3. **Variable Mapping**: Comprehensive data fetching required (multiple tables per negotiation)

## Files to Modify

### Schema
- `shared/schema.ts` → `shared/schema-enhanced.ts` (new)
- `drizzle.config.ts` (update import)

### Frontend
- `client/src/pages/create-registration.tsx` (NEW)
- `client/src/pages/manage-markets.tsx` (NEW)
- `client/src/pages/manage-counterparts.tsx` (NEW)
- `client/src/pages/manage-dimensions.tsx` (NEW)
- `client/src/pages/manage-products.tsx` (NEW)
- `client/src/components/CreateNegotiationForm.tsx` (ENHANCED)

### Backend
- `server/storage.ts` (add new methods)
- `server/routes/registrations.ts` (NEW)
- `server/routes/markets.ts` (NEW)
- `server/routes/counterparts.ts` (NEW)
- `server/routes/dimensions.ts` (NEW)
- `server/routes/products.ts` (NEW)
- `server/services/langfuse.ts` (dual prompt support)
- `server/services/python-negotiation-service.ts` (enhanced data fetching)
- `scripts/run_production_negotiation.py` (variable mapping, BDI persistence)

### Database
- `server/seed.ts` (new seed data)

## Testing Checklist

- [ ] All new tables created
- [ ] Seed data loaded
- [ ] Registration flow works
- [ ] Market/counterpart selection works
- [ ] Negotiation creation with new fields works
- [ ] Prompts load from Langfuse (`agents/self_agent`, `agents/opponent_agent`)
- [ ] All variables populated correctly
- [ ] BDI state saved after each round
- [ ] Offers tracked correctly
- [ ] Concessions identified correctly
- [ ] End-to-end negotiation runs successfully

## Risk Mitigation

1. **Schema Complexity**: Start with core tables, add others incrementally
2. **Variable Mapping**: Create comprehensive test cases for each variable
3. **Performance**: Batch queries, use joins, cache static data
4. **Rollback**: Keep old schema file, can switch back if needed

## Questions to Resolve

1. Should we support gradual migration or only fresh start?
2. How to handle existing negotiations during migration?
3. What's the fallback if Langfuse prompts don't exist?
4. Performance requirements for BDI state queries?




