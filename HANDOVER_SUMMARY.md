# Developer Handover Summary

## 🎯 Project Status: Ready for Handover

**Last Updated**: January 2025
**Status**: ✅ Production-ready with comprehensive AI evaluation system

---

## 📦 What's Been Delivered

### Core Platform
- ✅ Full-stack TypeScript negotiation simulation platform
- ✅ Python AI microservice with OpenAI Agents SDK
- ✅ Real-time WebSocket monitoring
- ✅ PostgreSQL database with Drizzle ORM
- ✅ Langfuse AI observability integration

### New Features (January 2025)
- ✅ **Automatic AI Evaluation System**
  - Post-simulation analysis using GPT-4o-mini
  - Structured output with effectiveness scores (1-10)
  - Full Langfuse tracing
  - Automatic hook after every simulation

- ✅ **Enhanced Analysis Dashboard**
  - Performance matrix with ranking badges
  - Price evolution mini-charts
  - Click-to-view detailed results
  - AI-generated tactical summaries
  - Full conversation protocol display

- ✅ **Developer Experience**
  - Comprehensive documentation (README, CLAUDE.md, CHANGELOG)
  - Removed 7 redundant documentation files
  - Removed obsolete test scripts
  - Clear setup instructions for Python + TypeScript

---

## 🚀 Quick Start for New Developers

### 1. Clone & Install
```bash
git clone <repository-url>
cd arian-ai
npm install

# Setup Python environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r scripts/requirements.txt
```

### 2. Configure Environment
Create `.env` file:
```env
DATABASE_URL="postgresql://user:pass@host.neon.tech/db?sslmode=require"
OPENAI_API_KEY="sk-..."
LANGFUSE_PUBLIC_KEY="pk-lf-..."
LANGFUSE_SECRET_KEY="sk-lf-..."
LANGFUSE_HOST="https://cloud.langfuse.com"
```

### 3. Setup Database
```bash
npm run db:push    # Deploy schema
npm run db:seed    # Add sample data
```

### 4. Start Development Server
```bash
npm run dev        # Starts both frontend (5173) and backend (3000)
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

---

## 📚 Essential Documentation

### Must-Read (in order)
1. **[README.md](README.md)** - Start here! Complete overview, architecture, features
2. **[CLAUDE.md](CLAUDE.md)** - Development commands, technical details, critical data structures
3. **[CHANGELOG.md](CHANGELOG.md)** - Recent changes and migration guide
4. **[scripts/DEVELOPER_HANDOVER.md](scripts/DEVELOPER_HANDOVER.md)** - Python service specifics

### Key Sections
- **Quick Start**: README.md lines 21-79
- **Architecture**: README.md lines 81-96
- **System Flow**: README.md lines 98-121
- **AI Evaluation**: CLAUDE.md lines 116-143
- **Development Commands**: CLAUDE.md lines 7-28

---

## 🏗️ Architecture at a Glance

```
Frontend (React + Vite)
    ↓ HTTP/WebSocket
Backend (Express.js + TypeScript)
    ↓ Subprocess
Python AI Service (OpenAI Agents)
    ↓ API Calls
OpenAI GPT-4o + Langfuse
    ↓ Traces
Langfuse Cloud (Observability)
```

### Key Files to Know
```
client/src/pages/
├── negotiation-analysis.tsx    # NEW: Performance analysis dashboard
├── negotiations.tsx            # Negotiation configuration
└── simulation-monitor.tsx      # Real-time monitoring

server/services/
├── simulation-queue.ts         # Background job processor + evaluation hook
├── simulation-evaluation.ts    # NEW: TypeScript wrapper for Python eval
└── negotiation-engine.ts       # Real-time negotiation orchestration

scripts/
├── run_production_negotiation.py   # Main AI negotiation engine
├── evaluate_simulation.py          # NEW: AI evaluation microservice
├── negotiation_models.py           # Pydantic data models
└── negotiation_utils.py            # Helper functions
```

---

## 🎯 How AI Evaluation Works

### Automatic Flow
1. **Simulation completes** (status: DEAL_ACCEPTED or WALK_AWAY)
2. **Hook triggers** in `simulation-queue.ts:885-891`
3. **Python service called** - `evaluate_simulation.py`
4. **Langfuse prompt** "simulation_eval" used for structured output
5. **OpenAI GPT-4o-mini** generates evaluation
6. **Database updated** with 3 fields:
   - `tacticalSummary` (German analysis, 2-3 sentences)
   - `techniqueEffectivenessScore` (1-10)
   - `tacticEffectivenessScore` (1-10)
7. **Frontend displays** scores in matrix, summary in dialog

### Manual Trigger
- Click "KI-Bewertung generieren" button in analysis dashboard
- Calls POST `/api/negotiations/:id/analysis/evaluate`
- Same flow as automatic, but user-initiated

### Langfuse Tracing
- All OpenAI calls automatically traced
- View in Langfuse dashboard: https://cloud.langfuse.com
- Filter by tag: "evaluation", "structured_output"
- Includes: input messages, output, tokens, cost, latency

---

## 🔧 Common Development Tasks

### Adding a New Technique or Tactic
1. Insert record into database table:
   - `influencingTechniques` for techniques
   - `negotiationTactics` for tactics
2. Update seed data in `server/seed.ts`
3. Frontend automatically loads via API

### Modifying AI Evaluation Prompt
1. Login to Langfuse: https://cloud.langfuse.com
2. Navigate to Prompts → "simulation_eval"
3. Create new version with changes
4. Test with manual evaluation
5. Promote to production when validated

### Running Tests
```bash
# TypeScript tests
npm run test

# Python tests
source .venv/bin/activate
pytest scripts/tests/

# Type checking
npm run check
```

### Database Changes
```bash
# 1. Modify schema in shared/schema.ts
# 2. Push changes to database
npm run db:push

# 3. Types are automatically generated by Drizzle
```

---

## ⚠️ Important Notes

### Environment Requirements
- **Node.js**: 18+ required
- **Python**: 3.11+ required (for OpenAI Agents SDK)
- **PostgreSQL**: Neon serverless recommended (free tier available)
- **Langfuse**: Cloud account recommended for full observability

### Known Limitations
- **Old Simulations**: Runs created before January 2025 don't have AI evaluations (expected)
  - Use "KI-Bewertung generieren" button for retroactive evaluation
- **Multi-Model Support**: Gemini models require JSON mode fallback (no strict schema support)
- **WebSocket Scaling**: Current implementation uses in-memory session management
  - For production scale, consider Redis adapter

### Performance Considerations
- **Evaluation Cost**: ~$0.001 per simulation (GPT-4o-mini)
- **Queue Processing**: Max 3 concurrent simulations (configurable)
- **Database**: Proper indexing on foreign keys essential for large datasets

---

## 🐛 Troubleshooting

### "Page is blank"
```bash
# 1. Check dev server
curl -I http://localhost:5173/

# 2. Ensure ports are free
lsof -i :5173
lsof -i :3000

# 3. Restart dev server
npm run dev

# 4. Hard reload browser (Cmd+Shift+R)
```

### "Python subprocess failed"
```bash
# 1. Verify virtual environment
source .venv/bin/activate
which python3  # Should show .venv path

# 2. Reinstall dependencies
pip install -r scripts/requirements.txt

# 3. Test Python script directly
python scripts/evaluate_simulation.py --help
```

### "Evaluation not appearing"
```bash
# 1. Check Langfuse credentials in .env
# 2. Verify prompt exists in Langfuse: "simulation_eval"
# 3. Check server logs for errors
# 4. Ensure simulation status is DEAL_ACCEPTED or WALK_AWAY
```

### "WebSocket not connecting"
```bash
# 1. Ensure backend is running on port 3000
# 2. Check browser console for errors
# 3. Verify proxy configuration in vite.config.ts
```

---

## 📊 Project Statistics

### Codebase Size
- **TypeScript**: ~15,000 lines
- **Python**: ~3,000 lines
- **React Components**: 25+ pages/components
- **Database Tables**: 10 main tables

### Test Coverage
- **TypeScript**: 9 test files
- **Python**: 4 test modules
- **Integration Tests**: Shell script validation

### Dependencies
- **npm packages**: 60+ (production + dev)
- **Python packages**: 15+ (AI/ML focused)

---

## 🎓 Learning Resources

### Internal Documentation
- [CLAUDE.md](CLAUDE.md) - Complete technical reference
- [scripts/README_NEGOTIATION.md](scripts/README_NEGOTIATION.md) - Python service deep dive
- [CHANGELOG.md](CHANGELOG.md) - Feature history and migration guide

### External Documentation
- [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) - AI orchestration
- [Langfuse Docs](https://langfuse.com/docs) - AI observability
- [Drizzle ORM](https://orm.drizzle.team/) - Database toolkit
- [Shadcn/ui](https://ui.shadcn.com/) - UI components
- [TanStack Query](https://tanstack.com/query) - Server state management

---

## 🤝 Getting Help

### Code Questions
1. Check [CLAUDE.md](CLAUDE.md) for technical details
2. Review [CHANGELOG.md](CHANGELOG.md) for recent changes
3. Search codebase for similar patterns
4. Check Langfuse traces for AI behavior debugging

### System Issues
1. Review troubleshooting section above
2. Check server logs (`npm run dev` output)
3. Verify all environment variables set
4. Ensure database schema is up to date (`npm run db:push`)

---

## ✅ Handover Checklist

- [x] All documentation updated (README, CLAUDE.md, CHANGELOG)
- [x] Redundant files removed (7 old .md files, test scripts)
- [x] Code cleaned up and well-commented
- [x] AI Evaluation system fully functional
- [x] Price Evolution visualization working
- [x] All tests passing
- [x] TypeScript type-checking clean
- [x] Python linting clean
- [x] Database schema stable
- [x] Langfuse integration validated
- [x] Development server starts reliably
- [x] Feature complete and production-ready

---

## 🎯 Recommended Next Steps

### For New Developers
1. **Day 1**: Read README.md, setup environment, run `npm run dev`
2. **Day 2**: Review CLAUDE.md, explore codebase structure
3. **Day 3**: Run test simulations, examine Langfuse traces
4. **Day 4**: Make small UI change to understand workflow
5. **Week 2**: Implement a new feature using existing patterns

### For Product Development
Potential enhancements:
- **Multi-Language Support**: Add English UI translations
- **Export Functionality**: CSV/PDF export of analysis results
- **Custom Metrics**: User-defined performance indicators
- **Advanced Filtering**: Filter matrix by effectiveness score ranges
- **Batch Evaluation**: Retroactive evaluation of all historical runs
- **Email Notifications**: Alert on simulation completion
- **API Authentication**: Add user authentication for multi-tenant use

---

## 📝 Final Notes

This platform is **production-ready** and well-documented. The codebase is clean, tested, and follows TypeScript/Python best practices. The AI Evaluation system is a powerful addition that provides actionable insights into negotiation strategy effectiveness.

**Key Strengths:**
- Comprehensive documentation
- Type-safe end-to-end
- Full AI observability
- Automatic evaluation workflow
- Clean architecture with clear separation of concerns

**For questions or support**, refer to the documentation hierarchy:
1. README.md (high-level overview)
2. CLAUDE.md (technical deep-dive)
3. CHANGELOG.md (recent changes)
4. Code comments (implementation details)

---

**Good luck, and happy coding! 🚀**

---

*Document created: January 2025*
*Last updated: January 2025*
*Maintainer: Christian Au*
