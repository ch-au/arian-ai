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

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- OpenAI API key

### Installation
```bash
git clone <repository-url>
cd arian-ai
npm install
```

### Configuration
Create `.env` file:
```env
DATABASE_URL="postgresql://user:pass@host:port/db"
OPENAI_API_KEY="sk-..."
LANGFUSE_PUBLIC_KEY="pk-lf-..."  # Optional
LANGFUSE_SECRET_KEY="sk-lf-..."  # Optional
```

### Setup & Start
```bash
npm run db:push    # Deploy database schema
npm run db:seed    # Add sample data
npm run dev        # Start development server
```

> **Tip:** The development toolchain now disables Browserslist network lookups by default, so `npm run dev` starts reliably even when you're offline or behind a restrictive firewall. If you want to refresh the Browserslist cache manually, run `npx update-browserslist-db@latest` when you have connectivity.

**If the page is blank:**
- Confirm the dev server is reachable: `curl -I http://localhost:5173/` (or hit the Express proxy at `http://localhost:3000/`).
- If `curl` hangs, restart `npm run dev` and ensure port `5173` is free (`lsof -i :5173`).
- Hard-reload the browser with cache disabled so Vite can deliver the transformed modules (`/@vite/client`, `/src/main.tsx`).
- When in doubt, stop all dev processes and start `npm run dev` fresh—Vite will rebind to the port and inject the React bundle.

**Access the application:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## 🏗️ Architecture

**Full-Stack TypeScript** with modern tooling:
- **Frontend**: React + Vite + TanStack Query + Shadcn/ui
- **Backend**: Express.js + Drizzle ORM + PostgreSQL + WebSocket
- **AI Services**: OpenAI Agents (Python) + Langfuse tracing
- **Real-time**: WebSocket communication for live updates

**Key Components:**
- `server/services/negotiation-engine.ts` - Core orchestration logic
- `scripts/run_production_negotiation.py` - AI agent microservice
- `client/src/pages/dashboard.tsx` - Real-time monitoring interface
- `shared/schema.ts` - Type-safe database schema

## 📊 System Flow

1. **Configure** negotiation parameters, techniques, and agent personalities
2. **Execute** combinatorial simulations testing N×M technique-tactic combinations  
3. **Monitor** real-time progress via WebSocket updates
4. **Analyze** results with comprehensive performance metrics and AI tracing

## 🛠️ Development

```bash
npm run dev              # Full development environment
npm run dev:client       # Frontend only (port 5173)  
npm run dev:server       # Backend only (port 3000)
npm run test             # Run test suite
npm run check            # TypeScript type checking
```

**Project Structure:**
```
arian-ai/
├── client/              # React frontend
├── server/              # Express.js backend  
├── scripts/             # Python AI microservice
├── shared/              # Shared types/schemas
├── tests/               # Test files
├── docs/                # Technical documentation
└── data/                # Reference CSV files
```

## 📚 Documentation

### Essential Documentation
- **[CLAUDE.md](CLAUDE.md)** - Development commands and architecture overview
- **[MIGRATION_STATUS.md](MIGRATION_STATUS.md)** - Current migration status and known issues ⚠️
- **[SCHEMA_REDESIGN.md](SCHEMA_REDESIGN.md)** - ProductResults schema design
- **[MIGRATION_PLAN.md](MIGRATION_PLAN.md)** - Step-by-step migration guide

### Detailed Documentation
- **[docs/README.md](docs/README.md)** - Documentation index and contribution guidelines
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System map and service boundaries
- **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** - Day-to-day development workflow
- **[docs/DATA_MODEL_SPECIFICATION.md](docs/DATA_MODEL_SPECIFICATION.md)** - Database schema reference
- **[docs/SIMULATION_QUEUE.md](docs/SIMULATION_QUEUE.md)** - Queue execution model
- **[docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md)** - Validation checklist and commands

### Archive
- **[docs/archive/](docs/archive/)** - Historical planning and status documents (21 files)

## 🔬 Core Concepts

**Negotiation Engine**: Orchestrates multi-round AI-to-AI negotiations with configurable parameters and real-time monitoring.

**Combinatorial Testing**: Automatically tests multiple technique-tactic combinations to identify optimal negotiation strategies.

**ZOPA Analysis**: Zone of Possible Agreement validation ensures realistic negotiation boundaries and outcome analysis.

**AI Observability**: Complete Langfuse tracing of LLM calls with prompt linking and performance analytics.

## 🚀 Production

```bash
npm run build            # Create production build
npm run start            # Start production server
```

Built for modern deployment with:
- Environment-based configuration
- Database connection pooling
- WebSocket scaling support
- Comprehensive error handling

## 📄 License

This project is private and proprietary.

---

*Built with TypeScript, React, and OpenAI for advanced negotiation simulation and analysis.*
