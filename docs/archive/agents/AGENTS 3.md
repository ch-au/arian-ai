# AGENTS.md

This file provides guidance to AI agents (like Claude Code) when working with code in this repository.

## Development Commands

### Essential Commands
```bash
# Install dependencies
npm install

# Database setup
npm run db:push          # Deploy schema to database
npm run db:seed          # Populate with test data

# Development
npm run dev              # Start full-stack dev server (frontend + backend)
npm run dev:client       # Client only (Vite dev server on :5173)  
npm run dev:server       # Server only (Express on :3000)

# Testing & Quality
npm run test             # Run vitest test suite
npm run check            # TypeScript type checking

# Production
npm run build            # Build for production
npm run start            # Start production server
```

### Quick Setup Scripts
```bash
./setup.sh               # Full environment setup with .env template
./start.sh               # Start development server with checks
./test.sh                # Run integration tests for combinatorial system
```

## Architecture Overview

### Full-Stack TypeScript Application
- **Frontend**: React + Vite + TypeScript with Wouter routing
- **Backend**: Express + TypeScript with WebSocket support  
- **Database**: PostgreSQL with Drizzle ORM and Neon serverless
- **AI Integration**: LiteLLM with multi-provider support (OpenAI, Anthropic, Google Gemini) + Langfuse observability
- **UI**: Shadcn/ui + Radix components with Tailwind CSS

### Core Domain: AI Negotiation Simulation Platform
The system enables automated negotiations between AI agents with configurable personalities and strategies. Key architectural patterns:

#### 1. Combinatorial Testing System
- **Problem**: Test multiple technique-tactic combinations efficiently
- **Solution**: N×M matrix generation for each negotiation
- **Implementation**: `server/storage.ts:248` - `createNegotiationWithSimulationRuns()`
- Each negotiation spawns multiple simulation runs testing different combinations

#### 2. Multi-Layer Data Model
```
Negotiation (master record)
├── SimulationRuns (N×M combinations) 
│   ├── techniqueId + tacticId pairs
│   └── NegotiationRounds (conversation turns)
└── PerformanceMetrics (analytics)
```

#### 3. Real-Time Negotiation Engine
- **WebSocket**: Live updates during negotiations (`client/src/lib/websocket.ts`)
- **AI Orchestration**: `server/services/negotiation-engine.ts`
- **Prompt Management**: YAML-based prompts in `server/config/prompts.yaml`

### Key Implementation Details

#### Database Layer (Drizzle ORM)
- **Schema**: `shared/schema.ts` - comprehensive type-safe schema
- **Storage**: `server/storage.ts` - data access layer with business logic
- **Relations**: Proper foreign key relationships with cascade deletes

#### AI Agent System
- **Personalities**: Big Five traits configuration (`agents` table)
- **Techniques**: Influencing strategies (`influencingTechniques` table)
- **Tactics**: Negotiation approaches (`negotiationTactics` table)
- **ZOPA**: Zone of Possible Agreement with 4 dimensions (volume, price, duration, payment terms)

#### Frontend Architecture
- **State Management**: TanStack Query for server state
- **Routing**: Wouter for SPA navigation
- **Components**: 
  - `client/src/pages/` - top-level page components
  - `client/src/components/dashboard/` - dashboard widgets  
  - `client/src/components/ui/` - reusable UI components

## Critical Data Structures

### Simulation Results Schema (Updated October 2025)
```typescript
// simulationRuns table stores high-level results
{
  dealValue: Decimal,              // SUM(price × volume) for all products
  otherDimensions: JSONB,          // Non-price terms (payment, delivery, etc.)
  conversationLog: JSONB,          // Full negotiation transcript
  outcome: Text,                   // DEAL_ACCEPTED, WALK_AWAY, TERMINATED, etc.
  actualCost: Decimal,             // API cost for this simulation
  totalRounds: Integer             // Number of negotiation rounds
}

// productResults table stores individual product details
{
  productName: Text,
  agreedPrice: Decimal,
  estimatedVolume: Integer,
  subtotal: Decimal,               // price × volume for THIS product
  priceVsTarget: Text,             // Percentage vs target price
  withinZopa: Boolean,             // Whether price is in ZOPA
  performanceScore: Decimal        // 0-100 score
}
```

### AI Evaluation System (NEW - January 2025)
Automatic post-simulation evaluation using Langfuse prompts and structured output:

**Architecture:**
- **Trigger**: Automatic hook after simulation completion (DEAL_ACCEPTED/WALK_AWAY)
- **Implementation**: [server/services/simulation-queue.ts:885-891](server/services/simulation-queue.ts:885-891) (hook), [server/services/simulation-queue.ts:1460-1522](server/services/simulation-queue.ts:1460-1522) (evaluation logic)
- **Python Service**: [scripts/evaluate_simulation.py](scripts/evaluate_simulation.py)
- **Data Model**: [scripts/negotiation_models.py:SimulationEvaluation](scripts/negotiation_models.py)

**Evaluation Fields (stored in simulationRuns table):**
```typescript
{
  tacticalSummary: Text,                    // 2-3 sentence analysis in German
  techniqueEffectivenessScore: Decimal,     // 1-10 score for influence technique
  tacticEffectivenessScore: Decimal,        // 1-10 score for negotiation tactic
}
```

**Langfuse Integration:**
- **Prompt**: `simulation_eval` (version-controlled in Langfuse)
- **Tracing**: Automatic via `langfuse.openai` wrapper
- **Structured Output**: OpenAI `beta.chat.completions.parse()` with Pydantic model
- **Model**: gpt-4o-mini (cost-effective for analysis)

**Frontend Display:**
- Matrix cells show scores: 📊 7/10 (technique) | 🎯 6/10 (tactic)
- Info icon (ℹ️) indicates evaluation available
- Click cell → Dialog shows tactical summary + full conversation log

### Dimension Matching Logic
Product prices are matched using **normalized comparison** (spaces and underscores removed):
- Handles formats: `Oreo_100g_Price`, `Preis_Oreo_100g`, `Oreo Keks 100g_Price`
- Implementation: [server/services/simulation-queue.ts:702-724](server/services/simulation-queue.ts:702-724)

### WebSocket Event System
```typescript
// Real-time events (client/src/hooks/use-websocket.ts)
'negotiation-started' | 'negotiation-completed' | 'round-completed' | 'error'
```

## Environment Configuration

Required environment variables:
```bash
# Database (Required)
DATABASE_URL="postgresql://user:pass@host.neon.tech/db?sslmode=require"

# AI Providers (at least one required)
OPENAI_API_KEY="sk-..."          # For OpenAI models
ANTHROPIC_API_KEY="sk-ant-..."   # For Claude models (optional)
GEMINI_API_KEY="..."             # For Google Gemini (optional)

# Langfuse (Optional but recommended)
LANGFUSE_PUBLIC_KEY="pk-lf-..."
LANGFUSE_SECRET_KEY="sk-lf-..."
LANGFUSE_HOST="https://cloud.langfuse.com"

# Development
NODE_ENV=development
PORT=3000
```

## Testing Strategy

### Integration Tests
- **Location**: `test.sh` script + `server/services/negotiation-engine.test.ts`
- **Focus**: Combinatorial simulation system validation
- **Key Test**: N techniques × M tactics = N×M simulation runs

### UI Testing  
- **Location**: `client/src/components/dashboard/dashboard.test.tsx`
- **Framework**: Vitest + React Testing Library
- **Coverage**: Component rendering and user interactions

## Performance Considerations

### Database Optimization
- Proper indexing on foreign keys
- Cascade deletes for data consistency
- JSONB fields for flexible schemas

### AI API Management
- Token usage tracking via Langfuse
- Cost calculation per negotiation
- Configurable model selection

### WebSocket Scaling
- Session management for multiple concurrent negotiations
- Message queuing for reliable delivery

## Development Patterns

### Type Safety
- Drizzle generates types from schema automatically
- Zod schemas for runtime validation  
- Shared types between client/server via `@shared/schema`

### Error Handling
- Structured error responses with validation details
- Client-side error boundaries for graceful failures
- WebSocket reconnection logic

### Code Organization
- Feature-based folder structure
- Separation of concerns: storage, services, routes
- Component composition with compound patterns

## Common Tasks

### Adding New Technique/Tactic
1. Insert record into `influencingTechniques` or `negotiationTactics` table
2. Update seed data in `server/seed.ts`
3. Frontend will automatically load via API calls

### Modifying Negotiation Engine
1. Update prompt templates in `server/config/prompts.yaml`
2. Modify orchestration logic in `server/services/negotiation-engine.ts`
3. Test with different agent personality combinations

### Database Schema Changes
1. Modify `shared/schema.ts`
2. Run `npm run db:push` to deploy changes
3. Update TypeScript types automatically generated

## Azure App Service Deployment

For complete Azure deployment guide, see **[AZURE_DEPLOYMENT.md](../AZURE_DEPLOYMENT.md)**.

**Quick Reference:**
- Automatic CI/CD via GitHub Actions (`.github/workflows/azure-deploy.yml`)
- Startup script: `startup.sh` (Python venv + Node.js)
- Health endpoint: `GET /health`
- Configuration: `.deployment` file for Azure Oryx
- Python build: `scripts/copy-python.js` copies scripts to `dist/`

**Local development is unchanged** - all Azure changes are additive.