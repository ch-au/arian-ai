# Changelog

All notable changes to the ARIAN AI Negotiation Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed - Januar 2025

#### Critical Bug Fixes (January 2, 2025)
- **Negotiation Start Button**: Fixed `queueId is not defined` error when starting negotiations
  - Bug: `createQueue()` logged `queueId` before it was defined in `simulation-queue.ts:173`
  - Fix: Changed `queueId` to `queue.id` in log statement
  - Impact: Users can now successfully start negotiations without server errors
  - Files: `server/services/simulation-queue.ts:173`

- **Market Intelligence Button**: Added validation and better error handling
  - Bug: Missing validation for required fields (`title`, `marktProduktKontext`) before API call
  - Fix: Added frontend validation in `configure.tsx` and `ReviewStep.tsx`
  - Added: Better error messages when API returns HTML instead of JSON
  - Added: Toast notifications for user feedback
  - Impact: Users now get clear error messages instead of cryptic JSON parsing errors
  - Files: 
    - `client/src/pages/configure.tsx:99-149`
    - `client/src/components/configure/ReviewStep.tsx:52-65`

- **Backend Build Fix**: Fixed TypeScript syntax error in negotiations route
  - Bug: Invalid log statement syntax in `negotiations.ts:792-798`
  - Fix: Corrected log.debug call structure
  - Impact: Backend builds successfully without errors
  - Files: `server/routes/negotiations.ts:792-798`

- **Production Startup Script**: Fixed `.env` file loading
  - Bug: `DATABASE_URL` not loaded from `.env` file in `startup.sh`
  - Fix: Added `.env` file loading before Python setup
  - Impact: Production server correctly loads environment variables
  - Files: `startup.sh:10-19`

- **Product Table Visibility**: Improved empty state for product configuration
  - Enhancement: Added clear message when no products are configured
  - Impact: Users can now clearly see where to add products in configuration
  - Files: `client/src/components/configure/DimensionenStep.tsx:175-180`

### Added - Januar 2025

#### Azure App Service Deployment (Januar 2025)
- **Production Deployment Setup**: Vollständige Azure App Service Integration für einfache Wartung und Updates
  - **Startup Script** (`startup.sh`): Automatisierte Python venv Setup + Node.js Start
    - Erstellt/aktiviert Python virtual environment
    - Installiert Python dependencies aus `requirements.txt`
    - Startet Node.js Anwendung mit `npm start`
  - **GitHub Actions CI/CD** (`.github/workflows/azure-deploy.yml`): Automatische Deployment-Pipeline
    - Trigger: Push zu `main` Branch
    - Tests: TypeScript type checking + vitest Test-Suite
    - Build: Frontend (Vite) + Backend (esbuild) + Python Scripts
    - Deploy: Azure Web App mit Publish Profile
    - Health Check: Automatische Verifikation nach Deployment
  - **Health Check Endpoint** (`GET /health`): Azure Monitoring Integration
    - Status: healthy/unhealthy
    - Uptime, Timestamp, Environment
    - Registriert vor Auth-Middleware für Azure Health Probes
  - **Python Build Integration** (`scripts/copy-python.js`): Kopiert Python Scripts zu `dist/`
    - Sichert alle `.py` Dateien im Build
    - Kopiert `requirements.txt` und `tests/` Verzeichnis
    - Ermöglicht Python Execution in Production
  - **Azure Oryx Configuration** (`.deployment`): Custom Build Steps
    - Multi-Runtime Support: Node.js 20 + Python 3.11
    - Custom Deployment Script
  - **WebSocket Support**: Konfiguriert für Real-time Updates
    - Always On + ARR Affinity aktiviert
    - Web Sockets enabled in Azure Portal
  - **Umfassende Dokumentation** (`AZURE_DEPLOYMENT.md`): Step-by-step Deployment Guide
    - Detaillierte Azure Portal Setup-Anleitung
    - GitHub Secrets Konfiguration
    - Environment Variables Referenz
    - Troubleshooting Guide
    - Cost Estimation (~€11-30/Monat)
    - Monitoring & Maintenance Best Practices
  - **Zero Local Impact**: Alle Azure-Änderungen sind additiv
    - `npm run dev` funktioniert unverändert
    - `.env` Datei lokal verwendet
    - Keine Änderungen am Development Workflow

#### Structured Logging Migration (Januar 2025)
- **Vollständige Migration zu Pino Logger**: Alle `console.log/warn/error` zu strukturiertem Logger migriert
  - **100% Server-Code migriert**: Routes, Services, Scripts, Seed-Dateien
    - Routes: `server/routes/*.ts` (10 Dateien) - alle console.error → log.error mit Context
    - Services: `server/services/*.ts` (8 Dateien) - strukturierte Logs mit IDs, Fehlerdetails
    - Scripts: `server/scripts/*.ts` (6 Dateien) - konsistente CLI-Ausgabe via Logger
    - Build Tools: `server/vite.ts`, `server/seed.ts`, `server/csv-import.ts`
  - **Konsistente Log-Levels**: error, warn, info, debug mit klarer Semantik
  - **Strukturierte Kontext-Informationen**: 
    - Request IDs, User IDs, Negotiation IDs
    - Error Objects mit Stack Traces (`{ err: error }`)
    - Request-spezifische Metadaten
  - **Production-ready für Azure Application Insights**:
    - JSON-formatierte Logs für einfaches Parsing
    - Filterbare Log-Streams nach Modul/Service
    - Searchable structured fields
  - **Logger-Instanzen**: `createRequestLogger('module:name')` Pattern
    - Beispiele: `routes:negotiations`, `service:simulation-queue`, `script:seed`
  - **Migrated Files** (30+ Dateien):
    - API Routes: negotiations.ts, simulation-queue.ts
    - Business Logic: simulation-evaluation.ts, gemini-market-intelligence.ts, simulation-queue.ts, python-negotiation-service.ts, openai.ts, langfuse.ts
    - CRUD Routes: agents.ts, dashboard.ts, strategies.ts, zopa.ts, contexts.ts, system.ts, analytics.ts, analytics-export.ts, transcribe.ts, market-intelligence.ts
    - Maintenance Scripts: import-agents.ts, import-seed-data.ts, verify-schema.ts, drop-all-tables.ts, backup-full-database.ts, export-seed-data.ts
    - Setup: seed.ts, csv-import.ts, vite.ts

### Added - Oktober 2025

#### AI Evaluation Backfill Feature (October 25, 2025)
- **Per-Negotiation Evaluation Endpoint** (October 28, 2025): New API endpoint for targeted evaluation backfill
  - `POST /api/negotiations/:id/analysis/evaluate` - Triggers evaluation for missing runs in a specific negotiation
  - Only evaluates runs that lack tactical summaries (non-destructive)
  - Asynchronous processing with 1-second rate limiting
  - Implemented in `server/routes/negotiations.ts:942-991`
  - Service method: `SimulationQueueService.backfillEvaluationsForNegotiation()` in `server/services/simulation-queue.ts:1599-1649`
  - Frontend integration already exists in `client/src/pages/negotiation-analysis.tsx:94-115`
- **Backfill Endpoint**: New API endpoint to retroactively evaluate historical simulation runs
  - `POST /api/negotiations/backfill-evaluations` - Triggers evaluation for all unevaluated runs
  - `GET /api/negotiations/evaluation-status` - Returns evaluation coverage statistics
  - Implemented in `server/routes/negotiations.ts:893-939`
- **Backfill Service Methods**: Enhanced `SimulationQueueService` with evaluation management
  - `getSimulationRunsNeedingEvaluation()` - Finds runs without evaluations
  - `backfillEvaluations()` - Processes evaluation queue with rate limiting
  - `getEvaluationStats()` - Calculates evaluation coverage metrics
  - Implemented in `server/services/simulation-queue.ts:1524-1629`
- **Dashboard Evaluation Card**: New UI component for managing evaluations
  - Real-time statistics (total, evaluated, pending)
  - Visual progress bar showing completion percentage
  - One-click backfill trigger with auto-refresh
  - Status badges indicating completion state
  - Component: `client/src/components/dashboard/evaluation-backfill-card.tsx`
  - Integrated into dashboard: `client/src/pages/Dashboard.tsx:41-50`
- **Enhanced Simulation History**: Evaluation status badges for each negotiation
  - ✅ "AI Evaluated" badge for fully evaluated negotiations
  - 🧠 "X/Y evaluated" badge showing partial progress
  - Per-negotiation evaluation statistics
  - Updated: `client/src/components/dashboard/simulation-run-history.tsx`
- **Comprehensive Documentation**: Added detailed feature guide
  - User workflow and usage instructions
  - Technical implementation details
  - API reference and error handling
  - Performance considerations and troubleshooting
  - Documentation: `docs/AI_EVALUATION_BACKFILL.md`

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
- **AGENTS.md Enhancement**
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
  - Consolidated all essential docs in README.md and AGENTS.md

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
2. Review [AGENTS.md](AGENTS.md) for detailed development commands
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
