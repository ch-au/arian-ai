# Developer Handover Summary

**Project Status:** ✅ Production-Ready  
**Last Updated:** October 2025  
**Purpose:** Comprehensive onboarding guide for new developers

---

## Overview

ARIAN AI is a full-stack negotiation simulation platform that uses AI agents to test different influence techniques and negotiation tactics in automated multi-round negotiations. The system provides data-driven insights into strategy effectiveness through combinatorial testing and automatic AI evaluation.

**For quick start and installation, see [README.md](README.md).**

---

## What's Been Delivered

### Core Platform
- ✅ Full-stack TypeScript platform (React + Express + PostgreSQL)
- ✅ Python AI microservice with OpenAI Agents SDK
- ✅ Real-time WebSocket monitoring
- ✅ Combinatorial testing system (N×M technique-tactic combinations)
- ✅ Langfuse AI observability integration

### Major Features (Januar 2025)

#### AI Evaluation System
- **Automatic Evaluation**: Every completed simulation receives AI-powered analysis
- **Structured Output**: GPT-4o-mini with Pydantic models ensures consistent format
- **Effectiveness Scores**: 1-10 ratings for techniques and tactics
- **Tactical Summaries**: 2-3 sentence analysis in German
- **Full Tracing**: Langfuse integration for cost and performance tracking
- **Backfill Support**: Retroactive evaluation of historical simulations

#### Enhanced Analysis Dashboard
- **Performance Matrix**: Color-coded heatmap with ranking badges (🥇🥈🥉)
- **Price Evolution Charts**: Mini-visualizations showing convergence patterns
- **Interactive Drill-Down**: Click any cell for detailed simulation results
- **Conversation Protocol**: Full negotiation transcript with role indicators
- **Real-time Statistics**: Live evaluation coverage tracking

#### Production Deployment
- **Azure App Service Integration**: Automatic CI/CD with GitHub Actions
- **Structured Logging**: 100% migration to Pino logger (30+ files)
- **Health Monitoring**: Built-in `/health` endpoint for Azure
- **Hybrid Runtime**: Python venv + Node.js startup automation

---

## Architecture Deep-Dive

### System Layers

```
┌─────────────────────────────────────────┐
│  Frontend (React + Vite)                │
│  - TanStack Query for state             │
│  - Shadcn/ui components                 │
│  - WebSocket for real-time updates     │
└────────────┬────────────────────────────┘
             │ HTTP + WebSocket
┌────────────▼────────────────────────────┐
│  Backend (Express + TypeScript)         │
│  - REST API routes                      │
│  - WebSocket server                     │
│  - Simulation queue processor           │
│  - Drizzle ORM ↔ PostgreSQL            │
└────────────┬────────────────────────────┘
             │ Subprocess spawn
┌────────────▼────────────────────────────┐
│  Python AI Services                     │
│  - run_production_negotiation.py        │
│  - evaluate_simulation.py               │
│  - OpenAI Agents SDK                    │
└────────────┬────────────────────────────┘
             │ API Calls
┌────────────▼────────────────────────────┐
│  External Services                      │
│  - OpenAI GPT-4.1-mini         │
│  - Langfuse (observability)            │
│  - Neon PostgreSQL (database)          │
└─────────────────────────────────────────┘
```

### Data Flow: Simulation Execution

1. **User Configuration**
   - Define negotiation context (products, ZOPA, constraints)
   - Select N influence techniques, M negotiation tactics
   - Configure AI agent personalities

2. **Queue Creation**
   - System generates N×M×P×D simulation runs
   - P = personalities, D = ZOPA distances
   - Each run = unique technique-tactic-personality-distance combination

3. **Background Processing**
   - Queue processor picks pending runs sequentially
   - Spawns Python subprocess per simulation
   - Python manages multi-round negotiation with OpenAI
   - Results stored in database

4. **Automatic Evaluation** (NEW)
   - Hook triggers after DEAL_ACCEPTED/WALK_AWAY
   - Python evaluation service analyzes conversation
   - Stores tactical summary + effectiveness scores
   - Full Langfuse trace for cost tracking

5. **Analysis & Visualization**
   - Frontend displays performance matrix
   - Shows price evolution charts per product
   - Provides AI-generated insights
   - Enables strategy comparison

### Key Files by Layer

**Frontend:**
- `client/src/pages/negotiation-analysis.tsx` - Analysis dashboard
- `client/src/pages/negotiations.tsx` - Negotiation configuration
- `client/src/pages/simulation-monitor.tsx` - Real-time monitoring
- `client/src/components/dashboard/` - Reusable dashboard widgets

**Backend Services:**
- `server/services/simulation-queue.ts` - Queue processor + evaluation hook
- `server/services/simulation-evaluation.ts` - TypeScript ↔ Python bridge
- `server/services/negotiation-engine.ts` - WebSocket orchestration
- `server/services/logger.ts` - Structured logging (Pino)

**Backend Routes:**
- `server/routes/negotiations.ts` - Negotiation CRUD + evaluation endpoints
- `server/api/simulation-queue.ts` - Queue management API
- `server/routes/dashboard.ts` - Analytics endpoints

**Python Services:**
- `scripts/run_production_negotiation.py` - Main AI negotiation engine
- `scripts/evaluate_simulation.py` - Post-simulation evaluation
- `scripts/negotiation_models.py` - Pydantic data models
- `scripts/negotiation_utils.py` - Helper functions

**Database:**
- `shared/schema.ts` - Drizzle ORM schema (single source of truth)
- `server/storage.ts` - Data access layer

---

## How AI Evaluation Works

### Automatic Flow

1. **Simulation completes** with DEAL_ACCEPTED or WALK_AWAY outcome
2. **Hook triggers** in `simulation-queue.ts:885-891`
3. **Python service spawned** - `evaluate_simulation.py`
4. **Langfuse prompt used** - `simulation_eval` (version-controlled)
5. **GPT-4o-mini generates** structured evaluation:
   - Tactical summary (German, 2-3 sentences)
   - Technique effectiveness score (1-10)
   - Tactic effectiveness score (1-10)
6. **Database updated** - Fields added to `simulation_runs` table
7. **Frontend displays** - Scores in matrix, summary in dialog

### Manual Evaluation

- **Global Backfill**: Dashboard → "AI Evaluation Status" card → "Generate AI Summaries"
- **Per-Negotiation**: Analysis page → "KI-Bewertung generieren" button
- **Idempotent**: Only evaluates runs without existing evaluations

### Langfuse Integration

All OpenAI calls automatically traced:
- View in Langfuse dashboard: https://cloud.langfuse.com
- Filter by tag: "evaluation", "structured_output"
- Includes: input, output, tokens, cost, latency

---

## Common Development Tasks

### Adding New Technique or Tactic

1. Insert into database:
   ```bash
   # Via Drizzle Studio
   npm run db:studio
   
   # Or via SQL
   INSERT INTO influencing_techniques (name, beschreibung, anwendung, ...)
   VALUES ('New Technique', 'Description', 'How to use', ...);
   ```

2. Frontend automatically loads via API

3. Update seed data in `server/seed.ts` for persistence

### Modifying AI Evaluation Prompt

1. Login to Langfuse: https://cloud.langfuse.com
2. Navigate to **Prompts** → **"simulation_eval"**
3. Create new version with changes
4. Test with manual evaluation
5. Promote to production when validated

**Prompt format:** System message with structured output schema

### Running Simulations

1. **Via UI**: Navigate to Negotiations → Create → Configure → Start Queue
2. **Via API**:
   ```bash
   curl -X POST http://localhost:3000/api/simulation-queue/create \
     -H "Content-Type: application/json" \
     -d '{"negotiationId": "...", "techniques": [...], "tactics": [...]}'
   ```

### Database Schema Changes

1. Modify `shared/schema.ts`
2. Deploy changes: `npm run db:push`
3. Update `docs/DATA_MODEL_SPECIFICATION.md`
4. TypeScript types auto-generated by Drizzle

---

## Important Notes

### Environment Requirements

- **Node.js**: 18+ required (tested with 20 LTS)
- **Python**: 3.11+ required (for OpenAI Agents SDK compatibility)
- **PostgreSQL**: 14+ recommended (Neon serverless works great)
- **Langfuse**: Cloud account recommended for full observability

### Known Limitations

- **Old Simulations**: Runs before Januar 2025 don't have AI evaluations
  - Use "KI-Bewertung generieren" button for retroactive evaluation
- **Multi-Model**: Gemini models require JSON mode fallback (no strict schema)
- **WebSocket Scaling**: In-memory session management (consider Redis for scale)

### Performance Considerations

- **Evaluation Cost**: ~$0.01-0.02 per simulation (GPT-4o-mini)
- **Queue Processing**: Max 3 concurrent simulations (configurable in code)
- **Database**: Proper indexing on foreign keys essential for large datasets
- **API Rate Limiting**: 1-second delay between evaluations prevents throttling

---

## Troubleshooting

### Development Server Issues

**Page is blank:**
```bash
# 1. Check server status
curl -I http://localhost:5173/

# 2. Ensure ports are free
lsof -i :5173
lsof -i :3000

# 3. Hard reload browser
# Chrome/Edge: Cmd+Shift+R / Ctrl+Shift+R
```

**Port already in use:**
```bash
# Kill process on port
lsof -ti :5173 | xargs kill -9
lsof -ti :3000 | xargs kill -9
```

### Python Service Issues

**Subprocess failed:**
```bash
# 1. Verify virtual environment
source .venv/bin/activate
which python3  # Should show .venv/bin/python3

# 2. Reinstall dependencies
pip install -r scripts/requirements.txt

# 3. Test script directly
python scripts/evaluate_simulation.py --help
```

**Module not found:**
```bash
# Ensure in virtual environment
source .venv/bin/activate

# Verify packages installed
pip list | grep -E "openai|langfuse|pydantic"
```

### Database Issues

**Connection failed:**
```bash
# Test connection string
psql $DATABASE_URL

# Check Neon dashboard for IP restrictions
# Verify DATABASE_URL in .env is correct
```

**Schema out of sync:**
```bash
# Reset and re-deploy schema
npm run db:push

# Or reset completely (WARNING: deletes data)
tsx server/scripts/drop-all-tables.ts
npm run db:push
npm run db:seed
```

### AI Evaluation Issues

**Evaluations not appearing:**
1. Check `OPENAI_API_KEY` in `.env`
2. Verify Langfuse prompt `simulation_eval` exists
3. Check server logs for Python errors
4. Ensure simulation outcome is DEAL_ACCEPTED or WALK_AWAY

**Python evaluation fails:**
```bash
# Test evaluation directly
source .venv/bin/activate
python scripts/evaluate_simulation.py \
  --simulation-run-id "test-id" \
  --conversation-log '[...]'
```

### WebSocket Issues

**WebSocket not connecting:**
1. Backend running on port 3000?
2. Check browser console for errors
3. Verify proxy in `vite.config.ts`:
   ```typescript
   proxy: {
     '/api': 'http://localhost:3000',
     '/ws': { target: 'ws://localhost:3000', ws: true }
   }
   ```

---

## Project Statistics

### Codebase
- **TypeScript**: ~18,000 lines
- **Python**: ~3,500 lines
- **React Components**: 25+ pages/components
- **Database Tables**: 15 tables
- **Test Files**: 13 test suites

### Reference Data
- **Influence Techniques**: 10
- **Negotiation Tactics**: 44
- **Personality Types**: 5 archetypes

### Documentation
- **Root Docs**: 5 essential files
- **Technical Docs**: 7 specialized guides
- **Archive**: 27 historical documents

---

## Onboarding Timeline

### Week 1: Environment Setup & Exploration

**Day 1:**
- Read [README.md](README.md) for project overview
- Clone repository and run setup
- Configure `.env` with credentials
- Start dev server and explore UI

**Day 2:**
- Read [AGENTS.md](AGENTS.md) for technical details
- Review database schema in [docs/DATA_MODEL_SPECIFICATION.md](docs/DATA_MODEL_SPECIFICATION.md)
- Explore codebase structure
- Run first simulation in UI

**Day 3:**
- Study simulation queue system: [docs/SIMULATION_QUEUE.md](docs/SIMULATION_QUEUE.md)
- Review Python service: [scripts/README_NEGOTIATION.md](scripts/README_NEGOTIATION.md)
- Examine Langfuse traces for completed simulation
- Read [CHANGELOG.md](CHANGELOG.md) for recent changes

**Day 4:**
- Make small UI change (e.g., add column to table)
- Run tests: `npm run test`
- Review testing guide: [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md)
- Understand build process: `npm run build`

**Day 5:**
- Create test negotiation with custom ZOPA
- Monitor queue execution in real-time
- Review AI evaluation results
- Explore Langfuse dashboard

### Week 2: Implementation Practice

**Goals:**
- Implement small feature (e.g., new metric in analysis)
- Add test coverage for your changes
- Update relevant documentation
- Create pull request with description

**Learning Resources:**
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - Service boundaries
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) - Coding conventions
- Code comments in implementation files
- Langfuse traces for AI behavior debugging

---

## Key Concepts to Understand

### Combinatorial Testing System

**Problem:** How to test effectiveness of different strategy combinations?

**Solution:** Generate N×M simulation runs for each negotiation:
- N techniques × M tactics = N×M unique simulations
- Optionally multiply by personalities (P) and ZOPA distances (D)
- Example: 3 techniques × 5 tactics × 2 personalities = 30 simulations

**Implementation:** `server/services/simulation-queue.ts:101-187`

**Benefits:**
- Data-driven strategy comparison
- Isolate technique vs tactic effectiveness
- Statistical significance with multiple runs

### ZOPA (Zone of Possible Agreement)

**Multi-dimensional negotiation boundaries:**
- **Products**: Each with target price, min/max price, volume
- **Dimensions**: Payment terms, delivery time, contract duration, etc.
- **Role-dependent**: Buyer max = Seller min (ZOPA overlap)

**Database:**
- `products` table: Per-product price boundaries
- Negotiation dimensions now live inside `negotiations.scenario.dimensions` (array). No standalone `negotiation_dimensions` table.
- `product_results` table: Per-product outcomes with ZOPA validation

**Analysis:** System calculates ZOPA achievement, utilization percentage, price vs target.

### Python-TypeScript Bridge

**Challenge:** Integrate Python AI service with TypeScript backend.

**Solution:** Subprocess spawn with JSON communication:
1. TypeScript spawns Python with JSON arguments via `child_process.spawn()`
2. Python reads stdin, executes negotiation, writes JSON to stdout
3. TypeScript parses stdout, stores results in database

**Error Handling:**
- stderr captured for debugging
- Exit codes checked
- Timeouts configured
- Graceful failure with logging

**Files:**
- TypeScript: `server/services/python-negotiation-service.ts`
- Python: `scripts/run_production_negotiation.py`

### Structured Logging

**Pattern:** `createRequestLogger('module:name')`

**Usage:**
```typescript
import { createRequestLogger } from '../services/logger';

const log = createRequestLogger('routes:negotiations');

// Structured logging with context
log.info({ negotiationId, status }, 'Negotiation created');
log.error({ err: error, userId }, 'Failed to process request');
```

**Benefits:**
- JSON-formatted logs for Azure Application Insights
- Filterable by module, level, context
- Searchable structured fields
- Automatic request correlation

**Migrated:** 100% of server code (30+ files)

---

## Testing Strategy

### TypeScript Tests (Vitest)
```bash
npm run test                    # Run all tests
npm run test -- --ui           # Interactive UI
npm run test -- --coverage     # Coverage report
```

**Key Test Files:**
- `client/src/components/dashboard/dashboard.test.tsx` - UI components
- `server/services/negotiation-engine.test.ts` - Engine logic
- `tests/routes/*.ts` - API route tests

### Python Tests (pytest)
```bash
source .venv/bin/activate
pytest scripts/tests/           # All tests
pytest scripts/tests/ -v        # Verbose
pytest scripts/tests/ -k "test_model"  # Specific test
```

**Test Files:**
- `scripts/tests/test_negotiation_models.py` - Pydantic model validation
- `scripts/tests/test_negotiation_utils.py` - Helper function tests

### Integration Tests

Test combinatorial system:
```bash
./test.sh  # Validates N×M generation
```

### Manual Testing Checklist

See [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md) for comprehensive testing procedures.

---

## Deployment Guide

### Local Development
```bash
npm run dev              # Full-stack dev server
# Frontend: http://localhost:5173
# Backend: http://localhost:3000
```

### Production Build
```bash
npm run build            # Builds frontend + backend + copies Python
npm run start            # Starts production server
```

### Azure App Service

**Complete guide:** [AZURE_DEPLOYMENT.md](AZURE_DEPLOYMENT.md)

**Quick deployment:**
1. Configure GitHub secrets (AZURE_WEBAPP_NAME, publish profile)
2. Set environment variables in Azure Portal
3. Push to `main` branch
4. GitHub Actions automatically deploys

**Files:**
- `.github/workflows/azure-deploy.yml` - CI/CD pipeline
- `startup.sh` - Azure startup script
- `scripts/copy-python.js` - Build helper

---

## Handover Checklist

### Code Quality
- [x] All tests passing (`npm run test`)
- [x] TypeScript type-checking clean (`npm run check`)
- [x] No linter errors
- [x] Structured logging 100% migrated
- [x] Python code follows Black formatting

### Documentation
- [x] README.md - concise project overview
- [x] AGENTS.md - complete technical reference
- [x] CHANGELOG.md - all recent changes documented
- [x] AZURE_DEPLOYMENT.md - deployment guide
- [x] docs/ - technical specifications current
- [x] Code comments comprehensive

### Features
- [x] AI Evaluation system functional
- [x] Backfill endpoint working
- [x] Price evolution charts displayed
- [x] Performance matrix interactive
- [x] WebSocket real-time updates
- [x] Database schema stable

### Deployment
- [x] Azure deployment configured
- [x] GitHub Actions workflow tested
- [x] Health check endpoint operational
- [x] Environment variables documented
- [x] Startup script validated

---

## Recommended Next Steps

### For New Developers

**Immediate (Week 1):**
1. Complete setup and run first simulation
2. Understand data model and relationships
3. Review key service files
4. Explore Langfuse dashboard

**Short-term (Week 2-4):**
1. Implement small feature or fix
2. Add test coverage
3. Review pull request process
4. Understand deployment workflow

**Long-term (Month 2+):**
1. Design and implement larger feature
2. Optimize existing functionality
3. Contribute to architecture decisions
4. Mentor other new developers

### For Product Development

**Potential Enhancements:**
- Multi-language UI support (English translations)
- Advanced filtering (by effectiveness score ranges)
- CSV/PDF export of analysis results
- Email notifications on simulation completion
- Custom performance metrics
- Batch processing for faster execution
- Redis-based WebSocket scaling

**Technical Improvements:**
- Unit test coverage expansion
- Performance optimization for large datasets
- Advanced caching strategies
- Monitoring dashboards (Grafana/DataDog)

---

## Support & Resources

### Internal Documentation

**Essential:**
- [README.md](README.md) - Quick start and overview
- [AGENTS.md](AGENTS.md) - Technical deep-dive
- [CHANGELOG.md](CHANGELOG.md) - Version history

**Technical:**
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - System design
- [docs/DATA_MODEL_SPECIFICATION.md](docs/DATA_MODEL_SPECIFICATION.md) - Database schema
- [docs/SIMULATION_QUEUE.md](docs/SIMULATION_QUEUE.md) - Queue system
- [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md) - Testing procedures

**Features:**
- [docs/AI_EVALUATION_BACKFILL.md](docs/AI_EVALUATION_BACKFILL.md) - Evaluation system
- [AZURE_DEPLOYMENT.md](AZURE_DEPLOYMENT.md) - Azure deployment

### External Documentation

- [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) - AI orchestration
- [Langfuse Docs](https://langfuse.com/docs) - AI observability
- [Drizzle ORM](https://orm.drizzle.team/) - Database toolkit
- [Shadcn/ui](https://ui.shadcn.com/) - UI components
- [TanStack Query](https://tanstack.com/query) - Data fetching

### Getting Help

**Code Questions:**
1. Check [AGENTS.md](AGENTS.md) first
2. Search codebase for similar patterns
3. Review Langfuse traces for AI behavior
4. Check [CHANGELOG.md](CHANGELOG.md) for recent changes

**System Issues:**
1. Review troubleshooting section above
2. Check server logs (`npm run dev` output)
3. Verify environment variables
4. Test components in isolation

---

## Final Notes

This platform is **production-ready** with comprehensive documentation, clean architecture, and full observability. The codebase follows TypeScript and Python best practices with extensive type safety and error handling.

**Key Strengths:**
- Single source of truth for all data (DATABASE → SCHEMA → TYPES)
- Automatic AI evaluation workflow (zero manual work)
- Full observability with Langfuse
- Clean separation of concerns
- Comprehensive documentation

**Architecture Principles:**
- Type-safe end-to-end (TypeScript + Pydantic)
- Single responsibility (focused services)
- Dependency injection (testable code)
- Error boundaries (graceful failures)
- Structured logging (searchable logs)

---

**Document Version:** 2.0 (Refactored Januar 2025)  
**Last Updated:** Januar 2025  
**Maintainer:** Christian Au

**Good luck, and happy coding! 🚀**
