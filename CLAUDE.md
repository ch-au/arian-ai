# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- **AI Integration**: OpenAI GPT-4o with Langfuse observability
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

### Negotiation Creation Flow
Form data binding fixed to match backend schema:
```typescript
// CORRECT field paths (client/src/components/CreateNegotiationForm.tsx)
userZopa: {
  volumen: { min: number, max: number, target: number },
  preis: { min: number, max: number, target: number },
  laufzeit: { min: number, max: number, target: number },
  zahlungskonditionen: { min: number, max: number, target: number }
}
counterpartDistance: {
  volumen: number, // -1 to 1 scale
  preis: number,
  laufzeit: number, 
  zahlungskonditionen: number
}
```

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

# AI Services (Optional for development)
OPENAI_API_KEY="sk-..."
LANGFUSE_SECRET_KEY="sk-lf-..."
LANGFUSE_PUBLIC_KEY="pk-lf-..."
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