# Changelog

All notable changes to the ARIAN AI Negotiation Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - Oktober 2025

#### AI Evaluation System
- **Automatic Post-Simulation Evaluation**: Every completed simulation now automatically receives an AI-powered evaluation
  - Triggers after DEAL_ACCEPTED or WALK_AWAY outcomes
  - Uses Langfuse prompt `simulation_eval` for version-controlled analysis
  - Implemented in `server/services/simulation-queue.ts` lines 885-891 (hook) and 1460-1522 (logic)
- **Python Evaluation Service**: New `scripts/evaluate_simulation.py` microservice
  - Uses OpenAI GPT-4o-mini for cost-effective analysis
  - Structured output via Pydantic `SimulationEvaluation` model
  - Full Langfuse tracing with `langfuse.openai` wrapper
  - Generates 3 evaluation fields:
    - `tacticalSummary`: 2-3 sentence analysis in German
    - `techniqueEffectivenessScore`: 1-10 rating for influence technique
    - `tacticEffectivenessScore`: 1-10 rating for negotiation tactic
- **Database Schema Extension**: Added evaluation fields to `simulationRuns` table
  - `tacticalSummary` (text)
  - `techniqueEffectivenessScore` (decimal)
  - `tacticEffectivenessScore` (decimal)
- **TypeScript Evaluation Service**: `server/services/simulation-evaluation.ts`
  - Wraps Python subprocess call
  - Handles JSON serialization/deserialization
  - Error handling and logging

#### Analysis Dashboard Enhancements
- **Performance Matrix Improvements** (`client/src/pages/negotiation-analysis.tsx`)
  - Effectiveness scores displayed in matrix cells: 📊 7/10 | 🎯 6/10
  - Info icon (ℹ️) indicates when AI evaluation is available
  - Color-coded ranking badges (🥇🥈🥉)
  - Click any cell to view detailed simulation results
- **Price Evolution Visualization**
  - Mini-charts showing product price changes across negotiation rounds
  - Buyer offers (blue) vs Seller offers (green) differentiation
  - Visual range indicator with min/max prices
  - Hover tooltips with exact round and price
- **Detailed Simulation Dialog**
  - Full AI evaluation display with tactical summary
  - Effectiveness scores with visual emphasis
  - Complete conversation protocol with role indicators
  - Deal value, rounds, efficiency metrics
  - Manual "KI-Bewertung generieren" button for on-demand evaluation

#### Documentation & Developer Experience
- **Comprehensive README Update**
  - Added AI Evaluation and Price Evolution features
  - Expanded Quick Start with Python setup
  - Detailed architecture section with all key components
  - API Reference section
  - Production deployment guidelines
  - "Recent Updates" section documenting January 2025 changes
- **CLAUDE.md Enhancement**
  - New "AI Evaluation System" section with architecture details
  - Code references to implementation files
  - Langfuse integration documentation
  - Frontend display patterns
- **Repository Cleanup**
  - Removed 7 outdated documentation files:
    - MIGRATION_PLAN.md
    - MIGRATION_STATUS.md
    - PYTHON_SERVICE_IMPROVEMENTS_SUMMARY.md
    - PYTHON_SERVICE_PHASE1_COMPLETE.md
    - PYTHON_SERVICE_REVIEW.md
    - RECENT_FIXES.md
    - SCHEMA_REDESIGN.md
  - Removed obsolete test scripts:
    - test_config_flow.js
    - scripts/debug-queue.sh
    - scripts/fix-python-env.sh
    - scripts/setup.sh
    - scripts/start.sh
    - scripts/test-simulation.sh
    - scripts/test.sh
    - scripts/test_negotiation.py
  - Consolidated all essential docs in README.md and CLAUDE.md

### Changed

#### Backend Services
- **Simulation Queue Service** (`server/services/simulation-queue.ts`)
  - Added automatic evaluation hook after simulation completion
  - Extended `getSimulationResultsByNegotiation()` to return evaluation fields
  - Added `triggerEvaluation()` private method for async evaluation
- **Negotiations API** (`server/routes/negotiations.ts`)
  - Added POST `/api/negotiations/:id/analysis/evaluate` endpoint for manual evaluation
  - Enhanced analysis endpoint to include conversation logs
  - Added AI evaluation fields to response payloads

#### Python Services
- **Negotiation Models** (`scripts/negotiation_models.py`)
  - Added `SimulationEvaluation` Pydantic model for structured output
  - Comprehensive field descriptions for AI prompt context

#### Frontend Components
- **Negotiation Analysis Page** (`client/src/pages/negotiation-analysis.tsx`)
  - Major UI/UX overhaul with evaluation integration
  - Price evolution charts
  - Interactive matrix with drill-down dialogs
  - Responsive design improvements

### Fixed
- **Import Error**: Fixed `@db` import path to `../db` in simulation-evaluation.ts
- **Langfuse Prompt Handling**: Added support for list-type prompt compilation from Langfuse
- **OpenAI API Compatibility**: Removed invalid parameters from structured output calls
- **Background Evaluation**: Proper async/await error handling for non-blocking evaluation

### Technical Debt Addressed
- Removed redundant migration documentation (completed migrations, no longer needed)
- Cleaned up temporary developer scripts
- Consolidated documentation into single sources of truth

## [Previous Versions]

### Database Schema Migration (October 2024)
- Migrated from single `simulationRuns.dealValue` to multi-product `productResults` table
- Added per-product tracking: price, volume, subtotal, performance scores
- Enhanced ZOPA validation with product-level granularity

### Initial Release (September 2024)
- Full-stack TypeScript platform with React frontend
- Python AI microservice with OpenAI Agents SDK
- Combinatorial testing system (N×M technique-tactic combinations)
- Real-time WebSocket updates
- Langfuse AI observability integration
- ZOPA-based negotiation boundaries
- Big Five personality configuration

---

## Migration Guide for Developers

### Getting Started
If you're new to this codebase:
1. Read [README.md](README.md) for quick start and architecture overview
2. Review [CLAUDE.md](CLAUDE.md) for detailed development commands
3. Check [scripts/DEVELOPER_HANDOVER.md](scripts/DEVELOPER_HANDOVER.md) for Python service specifics

### Recent Changes Impact
The AI Evaluation system is **fully automatic** - no developer action needed:
- All new simulations automatically get evaluated
- Old simulations (before January 2025) won't have evaluations
- Use "KI-Bewertung generieren" button in UI for manual evaluation of specific runs

### Environment Setup
Ensure your `.env` includes Langfuse credentials for full functionality:
```env
LANGFUSE_PUBLIC_KEY="pk-lf-..."
LANGFUSE_SECRET_KEY="sk-lf-..."
LANGFUSE_HOST="https://cloud.langfuse.com"
```

### Breaking Changes
None - all changes are backward compatible.

---

## Contributors
- Christian Au (Primary Developer) - January 2025 AI Evaluation System

---

## License
This project is private and proprietary.
