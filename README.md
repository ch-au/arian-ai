# ARIAN AI Negotiation Platform

> Advanced AI-powered negotiation simulation platform with configurable personalities, tactics, and real-time analytics

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat&logo=openai&logoColor=white)](https://openai.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)](https://postgresql.org/)

## ✨ Key Features

🤖 **AI-Powered Negotiations** - Autonomous agent negotiations using OpenAI GPT-4o
🎭 **Configurable Personalities** - Big Five personality traits for realistic behavior
🎯 **Strategic Techniques** - 10 psychological influence techniques + 44 tactical approaches
📊 **Real-time Analytics** - Live monitoring with comprehensive performance metrics
🔄 **Combinatorial Testing** - Automated testing of technique-tactic combinations
📈 **ZOPA Analysis** - Zone of Possible Agreement validation and optimization
🤖 **AI Evaluation** - Automatic post-simulation evaluation with Langfuse tracing
📊 **Price Evolution Tracking** - Visual analysis of price changes across negotiation rounds

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database (Neon serverless recommended)
- Python 3.11+ with virtual environment
- OpenAI API key
- Langfuse account (optional but recommended for AI observability)

### Installation
```bash
git clone <repository-url>
cd arian-ai
npm install

# Setup Python environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r scripts/requirements.txt
```

### Configuration
Create `.env` file in root directory:
```env
# Database (Required)
DATABASE_URL="postgresql://user:pass@host.neon.tech/db?sslmode=require"

# OpenAI (Required)
OPENAI_API_KEY="sk-..."

# Langfuse AI Observability (Optional but recommended)
LANGFUSE_PUBLIC_KEY="pk-lf-..."
LANGFUSE_SECRET_KEY="sk-lf-..."
LANGFUSE_HOST="https://cloud.langfuse.com"

# Development
NODE_ENV=development
PORT=3000
```

### Setup & Start
```bash
npm run db:push    # Deploy database schema
npm run db:seed    # Add sample data (techniques, tactics, personalities)
npm run dev        # Start full-stack development server
```

> **Tip:** The development toolchain disables Browserslist network lookups by default, so `npm run dev` starts reliably even when offline or behind a firewall.

**Access the application:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- WebSocket: ws://localhost:3000

**If the page is blank:**
- Confirm the dev server is reachable: `curl -I http://localhost:5173/`
- Restart `npm run dev` and ensure port 5173 is free: `lsof -i :5173`
- Hard-reload browser with cache disabled (Cmd+Shift+R / Ctrl+Shift+R)
- Check browser console for errors

## 🏗️ Architecture

**Full-Stack TypeScript** with Python AI microservice:
- **Frontend**: React + Vite + TanStack Query + Shadcn/ui + Tailwind CSS
- **Backend**: Express.js + TypeScript + Drizzle ORM + PostgreSQL
- **AI Engine**: Python + OpenAI Agents SDK + LiteLLM (multi-provider support)
- **Real-time**: WebSocket communication for live negotiation updates
- **Observability**: Langfuse for AI tracing and prompt management

**Key Components:**
- `server/services/simulation-queue.ts` - Background job processor for simulations
- `server/services/negotiation-engine.ts` - Real-time negotiation orchestration
- `scripts/run_production_negotiation.py` - AI agent microservice (Python)
- `scripts/evaluate_simulation.py` - Post-simulation AI evaluation service
- `client/src/pages/negotiation-analysis.tsx` - Performance analysis dashboard
- `shared/schema.ts` - Type-safe database schema with Drizzle ORM

## 📊 System Flow

### 1. Configuration
- Define negotiation context (products, ZOPA dimensions, constraints)
- Select influence techniques and negotiation tactics to test
- Configure AI agent personalities (Big Five traits)

### 2. Simulation Execution
- **Combinatorial Testing**: N techniques × M tactics = N×M simulation runs
- **Background Processing**: Queue-based execution with progress tracking
- **Real-time Updates**: WebSocket events for live monitoring
- **AI Orchestration**: Python microservice manages agent interactions

### 3. AI Evaluation (Automatic)
- **Post-Processing Hook**: Triggers after each completed simulation
- **Langfuse Prompt**: Uses `simulation_eval` prompt for structured analysis
- **Structured Output**: Pydantic model ensures consistent evaluation format
- **Observability**: Full trace in Langfuse with token usage and latency

### 4. Analysis & Insights
- **Performance Matrix**: Heatmap visualization of technique-tactic performance
- **Price Evolution**: Track product price changes across negotiation rounds
- **AI Insights**: Tactical summaries with effectiveness scores (1-10)
- **Conversation Logs**: Full negotiation transcript with buyer/seller exchanges

## 🎯 Core Features

### Simulation Queue System
Background processor that executes multiple simulation runs in parallel:
- Queue-based job management with status tracking
- Concurrent execution with configurable limits
- WebSocket events for real-time progress updates
- Automatic retry on transient failures

### AI Evaluation Service
Automatic post-simulation analysis using GPT-4o-mini:
- **Tactical Summary**: 2-3 sentence analysis of negotiation dynamics
- **Influence Effectiveness**: Score 1-10 for technique effectiveness
- **Tactic Effectiveness**: Score 1-10 for negotiation tactic performance
- **Langfuse Integration**: Full observability and prompt versioning

### Performance Analysis Dashboard
Interactive visualization of simulation results:
- **Technique × Tactic Matrix**: Color-coded heatmap with ranking badges
- **Price Evolution Charts**: Mini-visualizations showing price convergence
- **Detailed Drill-down**: Click any cell to view full simulation details
- **Conversation Protocol**: Complete negotiation transcript with role indicators

### Multi-Model AI Support
Flexible model configuration via Langfuse prompts:
- OpenAI: GPT-4o, GPT-4o-mini
- Anthropic: Claude 3.5 Sonnet, Claude 3 Opus
- Google: Gemini 1.5 Pro/Flash (JSON mode fallback)
- Via LiteLLM: 100+ models supported

## 🛠️ Development

### Commands
```bash
# Development
npm run dev              # Full-stack dev server (frontend + backend)
npm run dev:client       # Frontend only (Vite on :5173)
npm run dev:server       # Backend only (Express on :3000)

# Testing & Quality
npm run test             # Run vitest test suite
npm run check            # TypeScript type checking
npm run build            # Production build

# Database
npm run db:push          # Deploy schema changes
npm run db:seed          # Populate with test data
npm run db:studio        # Open Drizzle Studio GUI

# Python Environment
source .venv/bin/activate           # Activate virtual environment
pip install -r scripts/requirements.txt  # Install dependencies
```

### Project Structure
```
arian-ai/
├── client/                 # React frontend
│   ├── src/
│   │   ├── pages/         # Top-level page components
│   │   ├── components/    # Reusable UI components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utilities and API client
├── server/                 # Express.js backend
│   ├── services/          # Business logic (queue, engine, evaluation)
│   ├── routes/            # API route handlers
│   ├── db.ts              # Database connection
│   └── storage.ts         # Data access layer
├── scripts/                # Python AI microservice
│   ├── run_production_negotiation.py  # Main negotiation engine
│   ├── evaluate_simulation.py         # AI evaluation service
│   ├── negotiation_models.py          # Pydantic data models
│   ├── negotiation_utils.py           # Helper functions
│   └── tests/             # Python unit tests
├── shared/                 # Shared TypeScript code
│   └── schema.ts          # Drizzle ORM schema
├── data/                   # Reference CSV files
└── docs/                   # Technical documentation
```

## 📚 Documentation

### Essential Documentation
- **[CLAUDE.md](CLAUDE.md)** - Complete development guide and architecture reference
- **[scripts/README_NEGOTIATION.md](scripts/README_NEGOTIATION.md)** - Python service documentation
- **[scripts/DEVELOPER_HANDOVER.md](scripts/DEVELOPER_HANDOVER.md)** - Developer onboarding guide

### API Reference
- **REST API**: `http://localhost:3000/api/*`
  - `/negotiations` - CRUD operations for negotiations
  - `/simulations/queue` - Simulation queue management
  - `/analysis` - Performance analytics endpoints
- **WebSocket**: `ws://localhost:3000`
  - Events: `negotiation-started`, `round-completed`, `negotiation-completed`

### Database Schema
Key tables:
- `negotiations` - Master negotiation records
- `simulationRuns` - Individual simulation executions (N×M combinations)
- `productResults` - Per-product outcome details
- `influencingTechniques` - Psychological influence strategies (10 techniques)
- `negotiationTactics` - Tactical approaches (44 tactics)
- `personalityTypes` - Big Five personality configurations

## 🔬 Core Concepts

### Combinatorial Testing System
Automatically tests all technique-tactic combinations:
- **Input**: N techniques, M tactics → **Output**: N×M simulation runs
- Each simulation uses the same negotiation context but different strategies
- Enables data-driven comparison of strategy effectiveness

### ZOPA (Zone of Possible Agreement)
Multi-dimensional negotiation boundaries:
- **Volume**: Min/max product quantities
- **Price**: Target/pain point price ranges per product
- **Duration**: Contract length constraints
- **Payment Terms**: Net payment days

### Langfuse Integration
Complete AI observability:
- **Prompt Management**: Version-controlled prompts (`negotiation`, `simulation_eval`)
- **Trace Logging**: Every LLM call with input/output/tokens/cost
- **Structured Output**: Pydantic models ensure type-safe AI responses
- **Session Tracking**: Link all API calls for a single simulation

### Python-TypeScript Bridge
Seamless integration between services:
- TypeScript spawns Python subprocess with JSON arguments
- Python returns structured JSON via stdout
- Error handling with stderr logging
- Virtual environment isolation

## 🚀 Production Deployment

### Build & Start
```bash
npm run build            # Build frontend and compile TypeScript
npm run start            # Start production server
```

### Environment Setup
Required environment variables for production:
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API credentials
- `LANGFUSE_*` - Langfuse observability (recommended)
- `NODE_ENV=production`

### Infrastructure Recommendations
- **Database**: Neon serverless PostgreSQL (built-in pooling)
- **Hosting**: Vercel, Railway, or any Node.js platform
- **AI Observability**: Langfuse Cloud (free tier available)
- **Monitoring**: Application-level logging + Langfuse AI traces

## 🧪 Testing

### Test Suites
```bash
# TypeScript/React tests
npm run test                    # Run all tests with vitest

# Python tests
source .venv/bin/activate
pytest scripts/tests/           # Run Python unit tests

# Integration tests
./test.sh                       # Combinatorial system validation
```

### Key Test Files
- `client/src/components/dashboard/dashboard.test.tsx` - UI component tests
- `server/services/negotiation-engine.test.ts` - Engine logic tests
- `scripts/tests/test_models.py` - Python model validation

## 🤝 Contributing

### Development Workflow
1. Create feature branch from `main`
2. Make changes and test thoroughly
3. Update `CLAUDE.md` if architecture changes
4. Run `npm run check` and `npm run test`
5. Create pull request with detailed description

### Code Style
- TypeScript: ESLint + Prettier (auto-format on save)
- Python: Black formatter + Ruff linter
- Commits: Descriptive messages with context

### Adding New Features
Key extension points:
- **New Techniques/Tactics**: Add to seed data and database
- **Custom Evaluations**: Create new Langfuse prompts
- **Additional Metrics**: Extend `productResults` schema
- **UI Components**: Use Shadcn/ui for consistency

## 📄 License

This project is private and proprietary.

---

## 🆕 Recent Updates (January 2025)

### AI Evaluation System
- ✅ Automatic evaluation after each simulation run
- ✅ Structured output with Pydantic models
- ✅ Langfuse tracing for all evaluation calls
- ✅ Effectiveness scores (1-10) for techniques and tactics
- ✅ Tactical summaries in German for business context

### Analysis Dashboard Enhancements
- ✅ Price evolution mini-charts per product
- ✅ Effectiveness scores in matrix cells
- ✅ Click-to-view detailed simulation results
- ✅ Full conversation protocol with role indicators
- ✅ AI-generated insights displayed inline

### Developer Experience
- ✅ Consolidated documentation (removed 7 redundant .md files)
- ✅ Updated CLAUDE.md with evaluation system details
- ✅ Python virtual environment setup in docs
- ✅ Clear handover documentation for new developers

---

*Built with TypeScript, React, Python, and OpenAI for advanced negotiation simulation and analysis.*
