# ARIAN AI Negotiation Platform

## Overview

ARIAN AI is a full-stack TypeScript platform that simulates AI-powered negotiations between autonomous agents. The system enables users to configure negotiation scenarios, test different psychological influence techniques and tactical approaches, and analyze outcomes through comprehensive analytics. The platform uses OpenAI Agents SDK with LiteLLM for multi-provider AI support (OpenAI, Anthropic, Google Gemini) and provides real-time monitoring via WebSockets.

**Core Purpose:** Test and optimize negotiation strategies through automated multi-round simulations with configurable AI personalities, techniques, and tactics.

## User Preferences

Preferred communication style: Simple, everyday language.

## Replit Environment Setup

This project is configured to run in the Replit environment with the following setup:

**Recent Changes (November 20, 2025):**
- Synced latest changes from GitHub repository
- Installed all Node.js and Python dependencies
- Created and initialized PostgreSQL database
- Configured Vite for Replit proxy compatibility
- Set up development workflow
- Seeded database with demo data (user: "demo", password: "demo123")

**Development Configuration:**
- Frontend: Vite dev server on port 5000
- Backend: Express server on port 3000
- Database: PostgreSQL (Neon serverless) via DATABASE_URL
- Python: Python 3.11 with pip-installed dependencies (installed in `.pythonlibs/`)

**Python Dependencies Installation:**
Replit uses a Nix-managed Python environment which is read-only. To install Python packages:
```bash
PIP_BREAK_SYSTEM_PACKAGES=1 python3 -m pip install <package-name>
```
This installs packages to the user site-packages directory (`.pythonlibs/lib/python3.11/site-packages`).

**Required Python packages** (from `scripts/requirements.txt`):
- `openai-agents[litellm]==0.3.1` - Core negotiation engine
- `langfuse>=2.47.0` - AI observability
- `nest_asyncio>=1.6.0` - Async support
- `python-dotenv>=1.0.1` - Environment variables
- `openinference-instrumentation-openai-agents>=0.1.0` - Instrumentation
- `google-genai` - Gemini API for market intelligence (installed separately)

**Vite Configuration for Replit:**
- Port 5000 with `strictPort: true`
- `allowedHosts: true` for Replit proxy support
- HMR with `clientPort: 443` for SSL proxy compatibility
- API and WebSocket proxies configured for backend communication
- Cartographer plugin disabled (optional Replit integration)

**Workflow:**
- "Development Server" runs `npm run dev`
- Concurrently starts both frontend (Vite) and backend (Express)
- Output type: webview (browser preview on port 5000)
- WebSocket connections work through Vite proxy at `/ws`

**Environment Variables (Required):**
- `DATABASE_URL` - PostgreSQL connection (auto-configured by Replit)
- `OPENAI_API_KEY` - OpenAI API key for negotiations
- `GEMINI_API_KEY` - Google Gemini API key (optional)
- `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` - AI observability (optional)

**Demo Credentials:**
- Username: `demo`
- Password: `demo123`

## System Architecture

### Technology Stack

**Frontend:**
- React 18 with TypeScript
- Vite for development and build tooling
- TanStack Query for server state management
- Shadcn UI components (Radix UI primitives)
- Tailwind CSS for styling
- WebSocket client for real-time updates

**Backend:**
- Express.js server with TypeScript
- Drizzle ORM for database operations
- Neon serverless PostgreSQL
- WebSocket server for real-time communication
- Pino-based structured logging system

**AI Services (Python):**
- OpenAI Agents SDK for autonomous negotiations
- LiteLLM for multi-provider support (OpenAI, Anthropic, Gemini)
- Langfuse for AI observability and prompt management
- Pydantic models for structured outputs
- Python 3.11 (Nix-managed with user site-packages)

### Database Architecture

**Normalized Schema Approach:**
The system uses a normalized schema centered around registrations (organizations) with related entities:

- **Master Data:** `registrations` (organizations), `markets`, `counterparts`, `dimensions`, `products`
- **Negotiations:** `negotiations` table with JSONB `scenario` field containing configuration
- **Simulation Execution:** `simulation_queue`, `simulation_runs` for combinatorial testing
- **Results:** `dimension_results`, `product_results` for granular outcome tracking
- **Reference Data:** `influencing_techniques`, `negotiation_tactics`, `personality_types`

**Key Design Decision:** Negotiation configuration is stored as JSONB in `negotiations.scenario` rather than normalized tables. This provides flexibility for evolving requirements while maintaining structured reference data in separate tables.

### Request Flow

1. **Configuration:** User creates negotiation via frontend form → POST to `/api/negotiations/phase2`
2. **Queue Creation:** Backend generates N×M combinations (techniques × tactics × personalities) → stored in `simulation_queue` and `simulation_runs`
3. **Execution:** Queue processor spawns Python subprocess for each run → Python service returns structured JSON
4. **Real-time Updates:** WebSocket broadcasts progress events (`simulation_started`, `simulation_completed`, etc.)
5. **Analytics:** Results stored in `simulation_runs`, `dimension_results`, `product_results` → aggregated for dashboard

### AI Agent Architecture

**Python Microservice Pattern:**
- Node.js spawns Python process via `child_process.spawn()`
- Communication via stdin/stdout with JSON payloads
- Python service manages OpenAI Agents workflow
- Structured output using Pydantic models (no JSON parsing)

**Prompt Management:**
- All prompts stored in Langfuse (cloud-based version control)
- Prompts compiled with variables at runtime
- Key prompts: `buyerAgent`, `sellerAgent`, `runEvaluation`

**Multi-Provider Support:**
- LiteLLM provides unified interface for OpenAI, Anthropic, Gemini
- Model selection via environment variables
- Default: OpenAI GPT-4o-mini for negotiations, GPT-4o-mini for evaluation

### WebSocket Architecture

**Real-time Communication:**
- Single WebSocket server attached to Express HTTP server
- Namespaced events for different features (negotiations, queue status)
- Events: `simulation_started`, `negotiation_round`, `simulation_completed`, `queue_progress`, etc.

**Connection Management:**
- Automatic reconnection on frontend
- Event-based architecture (no polling)
- Broadcast pattern for multi-client updates

### Logging & Observability

**Structured Logging:**
- Pino logger with request-scoped context
- `createRequestLogger` factory for service-specific loggers
- Child loggers propagate context automatically
- Logs to stderr (stdout reserved for JSON responses)

**AI Observability:**
- Langfuse integration for all LLM calls
- Automatic tracing of prompts, completions, costs
- Trace IDs attached to simulation runs for debugging

### Authentication & Authorization

**Current State:**
- Basic username/password authentication
- Session-based (no JWT)
- User table with bcrypt password hashing
- Auth routes: `/api/auth/login`, `/api/auth/register`

**Note:** Stack Auth integration is disabled (requires Next.js). Current implementation is temporary.

### Build & Deployment

**Development:**
- Concurrent dev servers: `npm run dev` (Vite + Express)
- Hot module reload for frontend
- TypeScript watch mode for backend

**Production Build:**
- Frontend: Vite build → `dist/public`
- Backend: esbuild bundle → `dist/index.js`
- Python scripts copied to `dist/scripts` (including requirements.txt)

**Azure Deployment:**
- Automatic CI/CD via GitLab CI
- Startup script (`startup.sh`) handles Python venv setup
- Health endpoint at `/health` for Azure monitoring
- Hybrid runtime: Python + Node.js

### Data Flow Patterns

**Combinatorial Testing:**
- Input: Single negotiation with N techniques × M tactics
- Output: N×M simulation runs (e.g., 2 techniques × 3 tactics = 6 runs)
- Each run is independent and can be retried

**Result Processing:**
- Python service returns conversation log + final offers
- Backend extracts deal value and dimension/product results
- Stored in normalized tables for analytics queries

**AI Evaluation:**
- Post-simulation analysis triggered automatically for DEAL_ACCEPTED/WALK_AWAY outcomes
- Python evaluation service analyzes conversation log
- Returns effectiveness scores (1-10) + tactical summary
- Backfill support for historical simulations

## External Dependencies

**AI Providers:**
- OpenAI API (primary) - GPT-4o-mini for negotiations and evaluation
- Anthropic API (optional) - Claude models via LiteLLM
- Google Gemini API (optional) - Gemini Flash for market intelligence

**Database:**
- Neon serverless PostgreSQL - primary data store
- Connection pooling via @neondatabase/serverless

**Observability:**
- Langfuse Cloud - prompt management and AI tracing
- Required for production (prompts stored in Langfuse, not code)

**Infrastructure:**
- Azure App Service (production deployment)
- GitLab CI for automated deployments
- WebSocket support required (Basic B1 tier minimum)

**Frontend Libraries:**
- Radix UI - accessible component primitives
- Recharts - data visualization
- React Hook Form + Zod - form validation
- TanStack Query - server state caching

**Backend Libraries:**
- Drizzle ORM - type-safe database queries
- Drizzle Kit - schema migrations
- ws - WebSocket server implementation
- Pino - structured logging

**Python Libraries:**
- openai-agents[litellm] - core negotiation engine
- langfuse - AI observability
- pydantic - data validation
- google-genai - Gemini integration
- pytest - testing framework