# ARIAN AI Negotiation Platform

> Advanced AI-powered negotiation simulation platform with configurable personalities, tactics, and real-time analytics

**Status:** ✅ Production Ready | **Version:** 1.0.0 | **Last Updated:** November 2025

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![OpenAI Agents](https://img.shields.io/badge/OpenAI_Agents-412991?style=flat&logo=openai&logoColor=white)](https://platform.openai.com/docs/agents)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)](https://postgresql.org/)

## Features

### Core Capabilities
- **AI-Powered Negotiations** - Autonomous multi-round agent negotiations using OpenAI Agents SDK
- **Configurable Personalities** - Interpersonal Circumplex (dominance/affiliation) for realistic counterpart behavior
- **Strategic Techniques** - 10+ psychological influence techniques based on Cialdini principles
- **Tactical Approaches** - 44+ negotiation tactics from academic research
- **Combinatorial Testing** - Automated N×M×P×D matrix testing (techniques × tactics × personalities × ZOPA distances)
- **Multi-Product Support** - Complex negotiations with multiple products, dimensions, and constraints

### Analysis & Insights
- **Real-time Monitoring** - Live WebSocket updates with queue status and progress tracking
- **AI Evaluation** - Automatic LLM powered effectiveness scoring and tactical analysis
- **Interactive Analysis** - Performance matrix heatmaps with drill-down to individual simulations
- **Price Evolution Charts** - Visualize negotiation convergence patterns per product
- **Conversation Playback** - Full negotiation transcripts with role indicators and offers
- **Cost Tracking** - Complete API cost visibility via Langfuse integration

### Security & Deployment
- **JWT Authentication** - HttpOnly cookies with refresh tokens, 4-hour access token TTL
- **API Security** - Helmet headers, CORS, rate limiting (100 req/15min general, 10 req/15min auth)
- **User Isolation** - Complete data isolation via foreign keys and middleware
- **LLM Reliability** - Circuit breaker pattern with exponential backoff retry
- **Secret Scanning** - Pre-commit hooks and CI/CD secret detection (TruffleHog, Gitleaks)
- **Azure Ready** - CI/CD with GitHub Actions, health monitoring, hybrid Python+Node runtime
- **Full Observability** - Langfuse integration for AI tracing and debugging

## Quick Start

### Prerequisites

- **Node.js 18+** - JavaScript runtime
- **Python 3.11+** - For AI negotiation microservice
- **PostgreSQL** - Database (Neon serverless recommended)
- **OpenAI API Key** - Required for AI agents (GPT-4o/GPT-4o-mini)
- **Langfuse Account** - Optional but recommended for observability

### Installation

```bash
git clone <repository-url>
cd arian-ai
npm install

# Setup Python environment
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r scripts/requirements.txt
```

### Configuration

Create `.env` file in root directory:

```env
# Database (Required)
DATABASE_URL="postgresql://user:pass@host.neon.tech/db?sslmode=require"

# Authentication (Required)
JWT_SECRET="your-secret-key-here"  # Generate with: openssl rand -base64 32

# AI Provider (Required)
OPENAI_API_KEY="sk-..."

# Langfuse Observability (Optional but recommended)
LANGFUSE_PUBLIC_KEY="pk-lf-..."
LANGFUSE_SECRET_KEY="sk-lf-..."
LANGFUSE_HOST="https://cloud.langfuse.com"

# Environment
NODE_ENV="development"
```

### Start Development

```bash
npm run db:push    # Deploy database schema
npm run db:seed    # Add sample data
npm run dev        # Start development server
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## Architecture

**Full-Stack TypeScript** with Python AI microservice:

- **Frontend**: React + Vite + TanStack Query + Shadcn/ui
- **Backend**: Express.js + TypeScript + Drizzle ORM + PostgreSQL
- **AI Engine**: Python + OpenAI Agents SDK + LiteLLM
- **Real-time**: WebSocket for live updates
- **Observability**: Langfuse for AI tracing

**Key Services:**
- `server/services/simulation-queue.ts` - Background job processor
- `server/services/negotiation-engine.ts` - Real-time orchestration
- `scripts/run_production_negotiation.py` - AI negotiation service
- `scripts/evaluate_simulation.py` - AI evaluation service

For detailed architecture, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [HANDOVER_SUMMARY.md](HANDOVER_SUMMARY.md).

## Development

### Essential Commands

```bash
# Development
npm run dev              # Full-stack dev server
npm run dev:client       # Frontend only (:5173)
npm run dev:server       # Backend only (:3000)

# Testing & Quality
npm run test             # Run test suite
npm run check            # TypeScript type checking
npm run build            # Production build

# Database
npm run db:push          # Deploy schema
npm run db:seed          # Seed sample data
```

### Project Structure

```
arian-ai/
├── client/          # React frontend
├── server/          # Express backend
├── scripts/         # Python AI services
├── shared/          # Shared TypeScript types
├── docs/            # Technical documentation
└── data/            # Reference CSV files
```

For complete development guide, see [HANDOVER_SUMMARY.md](HANDOVER_SUMMARY.md).

## Documentation

### 📚 Getting Started
- **[README.md](README.md)** (this file) - Quick start and overview
- **[BENUTZERHANDBUCH.md](BENUTZERHANDBUCH.md)** - 🇩🇪 **Deutsches Benutzerhandbuch** (User Guide)
- **[HANDOVER_SUMMARY.md](HANDOVER_SUMMARY.md)** - Developer onboarding guide
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and recent changes

### 🏗️ Architecture & Data Model
- **[FINAL_SCHEMA_DOCUMENTATION.md](FINAL_SCHEMA_DOCUMENTATION.md)** - Complete database schema reference
- **[DATA_FLOW_OVERVIEW.md](DATA_FLOW_OVERVIEW.md)** - End-to-end data flow documentation
- **[docs/DATA_MODEL_SPECIFICATION.md](docs/DATA_MODEL_SPECIFICATION.md)** - In-depth schema specification
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture details

### 🚀 Deployment & Operations
- **[AZURE_DEPLOYMENT.md](AZURE_DEPLOYMENT.md)** - Azure App Service deployment guide
- **[SECURITY_HARDENING_PLAN.md](SECURITY_HARDENING_PLAN.md)** - Security implementation checklist
- **[docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md)** - Testing strategy and test suite

### 📦 Legacy Documentation
Historical analyses and migration docs are archived in [`docs/archive/`](docs/archive/).

## Testing

```bash
# TypeScript/React tests
npm run test

# Python tests
source .venv/bin/activate
pytest scripts/tests/

# Integration tests
./test.sh  # (if available)
```

## Production Deployment

### Build & Start

```bash
npm run build    # Build frontend + backend
npm run start    # Start production server
```

### Azure App Service

For automated Azure deployment with GitHub Actions, see **[AZURE_DEPLOYMENT.md](AZURE_DEPLOYMENT.md)**.

**Quick Overview:**
- Automatic CI/CD via GitHub Actions
- Python + Node.js hybrid support
- WebSocket support included

## Contributing

1. Create feature branch from `main`
2. Make changes and test (`npm run check`, `npm run test`)
3. Update documentation if needed
4. Create pull request

For coding conventions and architecture patterns, see [HANDOVER_SUMMARY.md](HANDOVER_SUMMARY.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License

This project is private and proprietary.

---

**For detailed documentation, onboarding, and troubleshooting, see [HANDOVER_SUMMARY.md](HANDOVER_SUMMARY.md).**
