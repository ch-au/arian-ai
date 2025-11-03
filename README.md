# ARIAN AI Negotiation Platform

> Advanced AI-powered negotiation simulation platform with configurable personalities, tactics, and real-time analytics

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![LiteLLM](https://img.shields.io/badge/LiteLLM-Multi--Provider-FF6B6B?style=flat)](https://docs.litellm.ai/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat&logo=openai&logoColor=white)](https://openai.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)](https://postgresql.org/)

## Features

- **AI-Powered Negotiations** - Autonomous agent negotiations using LiteLLM (OpenAI, Anthropic, Google Gemini)
- **Configurable Personalities** - Big Five personality traits for realistic behavior
- **Strategic Techniques** - 10+ psychological influence techniques, 44+ tactical approaches
- **Combinatorial Testing** - Automated N×M technique-tactic combination testing
- **Real-time Analytics** - Live monitoring with comprehensive performance metrics
- **AI Evaluation** - Automatic post-simulation analysis with effectiveness scoring
- **Multi-Product Support** - Handle complex negotiations with multiple products
- **Full Observability** - Langfuse integration for AI tracing and cost tracking

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database (Neon serverless recommended)
- Python 3.11+
- AI Provider API keys (OpenAI, Anthropic, or Gemini)

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

Create `.env` file in root:

```env
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

For detailed architecture, see [AGENTS.md](AGENTS.md).

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

For complete development guide, see [AGENTS.md](AGENTS.md).

## Documentation

### Getting Started
- **[AGENTS.md](AGENTS.md)** - Complete development guide and technical reference
- **[HANDOVER_SUMMARY.md](HANDOVER_SUMMARY.md)** - Developer onboarding guide
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and recent changes

### Technical Documentation
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Platform architecture
- **[docs/DATA_MODEL_SPECIFICATION.md](docs/DATA_MODEL_SPECIFICATION.md)** - Database schema
- **[docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md)** - Testing strategy
- **[docs/](docs/)** - All technical docs with navigation index

### Deployment
- **[AZURE_DEPLOYMENT.md](AZURE_DEPLOYMENT.md)** - Azure App Service deployment guide

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

For coding conventions and architecture patterns, see [AGENTS.md](AGENTS.md).

## License

This project is private and proprietary.

---

**For detailed documentation, onboarding, and troubleshooting, see [HANDOVER_SUMMARY.md](HANDOVER_SUMMARY.md).**
