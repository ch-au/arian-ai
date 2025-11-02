# Python AI Microservices

> AI negotiation engine and evaluation services using OpenAI Agents SDK with LiteLLM multi-provider support

## Overview

This directory contains Python microservices for AI-powered negotiations:

- **Multi-provider AI support** via LiteLLM (OpenAI, Anthropic, Google Gemini)
- **Autonomous negotiations** using OpenAI Agents SDK
- **AI evaluation** with structured output
- **Market intelligence** with Gemini Flash

## Scripts

| File | Purpose | Called By |
|------|---------|-----------|
| `run_production_negotiation.py` | Main negotiation engine | TypeScript backend |
| `evaluate_simulation.py` | Post-negotiation analysis | TypeScript backend |
| `gemini_market_intelligence.py` | Market data fetcher | Negotiation engine |
| `negotiation_models.py` | Pydantic data models | All services |
| `negotiation_utils.py` | Helper functions | Negotiation engine |

## Quick Start

### 1. Setup Virtual Environment

```bash
# From repository root
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r scripts/requirements.txt
```

### 2. Configure Environment

Create `.env` file in repository root:

```env
# AI Providers (at least one required)
OPENAI_API_KEY="sk-..."          # For OpenAI models
ANTHROPIC_API_KEY="sk-ant-..."   # For Claude models (optional)
GEMINI_API_KEY="..."             # For Google Gemini (optional)

# Langfuse (Required for prompt management)
LANGFUSE_PUBLIC_KEY="pk-lf-..."
LANGFUSE_SECRET_KEY="sk-lf-..."
LANGFUSE_HOST="https://cloud.langfuse.com"
```

### 3. Test Installation

```bash
# Activate virtual environment
source .venv/bin/activate

# Run tests
pytest scripts/tests/

# Test negotiation engine
python scripts/run_production_negotiation.py --help
```

## Core Services

### 1. Negotiation Engine (`run_production_negotiation.py`)

**Purpose**: Autonomous AI-to-AI negotiations using OpenAI Agents SDK

**Key Features:**
- Multi-round buyer-seller negotiations
- Configurable AI personalities (Big Five traits)
- Influence techniques + negotiation tactics
- ZOPA-based constraints
- Real-time WebSocket updates
- Full Langfuse tracing
- Multi-provider support via LiteLLM

**Usage:**
```bash
python scripts/run_production_negotiation.py \
  --negotiation-id=123 \
  --simulation-run-id=456 \
  --max-rounds=6
```

**Output**: JSON with conversation log, outcome, and final offer

### 2. Evaluation Service (`evaluate_simulation.py`)

**Purpose**: Post-simulation AI evaluation with structured output

**Key Features:**
- Uses Langfuse prompt `simulation_eval`
- Structured output with Pydantic models
- Automatic Langfuse tracing
- GPT-4o-mini for cost efficiency

**Data Model:**
```python
class SimulationEvaluation(BaseModel):
    tactical_summary: str                    # 2-3 sentences in German
    influencing_effectiveness_score: int     # 1-10
    tactic_effectiveness_score: int          # 1-10
```

### 3. Market Intelligence (`gemini_market_intelligence.py`)

**Purpose**: Fetch market data using Gemini Flash with Google Search

**Usage**: Called by negotiation engine for market context (optional)

### 4. Data Models (`negotiation_models.py`)

**Purpose**: Pydantic models for type-safe data exchange

**Key Models:**
- `NegotiationConfig` - Configuration and environment validation
- `NegotiationResponse` - Structured AI output (buyer/seller offers)
- `NegotiationOffer` - Product offers with dimensions
- `SimulationEvaluation` - Evaluation results

### 5. Utilities (`negotiation_utils.py`)

**Purpose**: Helper functions for negotiation logic

**Key Functions:**
- `setup_langfuse_tracing()` - Configure OpenAI Agents instrumentation
- `analyze_convergence()` - Check if negotiation is converging
- `format_dimensions_for_prompt()` - Convert dimensions to AI-readable format
- `normalize_model_output()` - Validate and normalize structured output
- `emit_round_update()` - Send WebSocket updates to frontend

## Architecture

### TypeScript ↔ Python Integration

```
┌─────────────────────────────────────────┐
│ TypeScript Backend                       │
│ (server/services/)                       │
└─────────────────┬───────────────────────┘
                  │
                  │ Subprocess spawn
                  │ JSON via stdin/stdout
                  ↓
┌─────────────────────────────────────────┐
│ Python Microservices                     │
│                                          │
│  run_production_negotiation.py          │
│    ├→ Negotiation orchestration         │
│    ├→ Multi-round AI conversations      │
│    └→ Langfuse tracing                  │
│                                          │
│  evaluate_simulation.py                 │
│    ├→ Post-simulation analysis          │
│    ├→ Structured output evaluation      │
│    └→ Langfuse tracing                  │
└─────────────────┬───────────────────────┘
                  │
                  │ API Calls via LiteLLM
                  ↓
┌─────────────────────────────────────────┐
│ External Services                        │
│  ├→ OpenAI (GPT-4o, GPT-4o-mini)        │
│  ├→ Anthropic (Claude)                  │
│  ├→ Google (Gemini)                     │
│  └→ Langfuse (Observability)            │
└─────────────────────────────────────────┘
```

### Multi-Provider Support via LiteLLM

All AI models use LiteLLM for unified interface:

```python
from agents.extensions.models.litellm_model import LitellmModel

# OpenAI
model = LitellmModel(model="gpt-4o")

# Anthropic
model = LitellmModel(model="claude-3-5-sonnet-20241022")

# Google Gemini
model = LitellmModel(model="gemini/gemini-2.0-flash-exp")
```

**Model Selection:**
- Configure in Langfuse prompt (no code changes needed)
- Set `model` in prompt config section
- Service automatically uses specified model

**Environment Variables:**
- `OPENAI_API_KEY` for OpenAI models
- `ANTHROPIC_API_KEY` for Claude models
- `GEMINI_API_KEY` for Google Gemini

**Structured Output:**
- ✅ OpenAI, Anthropic: Native structured output
- ⚠️ Gemini: JSON parsing fallback (stricter schema validation)

## Development

### Adding New Features

#### New Negotiation Strategy
```python
# 1. Add to negotiation_models.py if needed
# 2. Update negotiation_utils.py with helper functions
# 3. Modify run_production_negotiation.py prompt generation
# 4. Test with pytest
# 5. Update Langfuse prompt if needed
```

#### New Evaluation Criteria
```python
# 1. Extend SimulationEvaluation in negotiation_models.py
# 2. Update evaluate_simulation.py to handle new fields
# 3. Modify Langfuse prompt "simulation_eval"
# 4. Update TypeScript backend to store new fields
# 5. Update frontend to display new data
```

### Running Tests

```bash
# Activate virtual environment
source .venv/bin/activate

# Run all tests
pytest scripts/tests/

# Run specific test file
pytest scripts/tests/test_negotiation_models.py

# Run with verbose output
pytest -v scripts/tests/

# Run with coverage
pytest --cov=scripts scripts/tests/
```

### Debugging

#### Enable Detailed Logging
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

#### Test Negotiation Engine Directly
```bash
# Activate virtual environment
source .venv/bin/activate

# Run with sample data
python scripts/run_production_negotiation.py \
  --negotiation-id=test-123 \
  --simulation-run-id=sim-456 \
  --max-rounds=3
```

#### Check Langfuse Traces
1. Login to https://cloud.langfuse.com
2. Navigate to "Traces"
3. Filter by tag: "negotiation" or "evaluation"
4. Inspect input/output/tokens/cost

## Dependencies

From `requirements.txt`:

```python
# Core AI Framework
openai-agents[litellm]==0.3.1
# - OpenAI Agents SDK for orchestrating multi-agent conversations
# - Includes LiteLLM for multi-model support (OpenAI, Anthropic, Google)

# AI Observability
langfuse>=2.47.0
# - Prompt management and versioning
# - Trace logging for every LLM call
# - Token usage and cost tracking

# Instrumentation
openinference-instrumentation-openai-agents>=0.1.0
# - Automatic Langfuse integration for OpenAI Agents SDK
# - Traces all agent interactions without manual logging

# Utilities
nest_asyncio>=1.6.0       # Async event loop support
python-dotenv>=1.0.1      # Environment variable loading
```

## Common Issues & Solutions

### Issue: `ModuleNotFoundError`
```bash
# Solution: Ensure virtual environment is activated
source .venv/bin/activate
which python3  # Should show .venv/bin/python3

# Reinstall dependencies
pip install -r scripts/requirements.txt
```

### Issue: `Langfuse authentication failed`
```bash
# Solution: Check .env file has correct credentials
cat .env | grep LANGFUSE

# Test Langfuse connection
python -c "from langfuse import Langfuse; Langfuse().auth_check()"
```

### Issue: `OpenAI API error`
```bash
# Solution: Verify API key
python -c "import os; print(os.getenv('OPENAI_API_KEY'))"

# Test OpenAI connection
python -c "from openai import OpenAI; OpenAI().models.list()"
```

### Issue: `Structured output parsing failed`
```python
# Solution: Check Pydantic model matches AI output
# Enable debug logging in evaluate_simulation.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Performance Optimization

### Cost Optimization
- **Negotiation**: Use GPT-4o (balanced cost/quality)
- **Evaluation**: Use GPT-4o-mini (cheaper, sufficient for analysis)
- **Market Intel**: Use Gemini Flash (most cost-effective)

### Speed Optimization
- Parallel simulations handled by TypeScript queue
- Python services are stateless (fast startup)
- Virtual environment cached by TypeScript

### Token Optimization
- Structured output reduces parsing overhead
- Langfuse prompts enable version testing without code changes
- Conversation history pruned after max rounds

## Security Best Practices

### API Keys
- Never commit API keys to git
- Use `.env` files (gitignored)
- Rotate keys periodically

### Input Validation
- All inputs validated with Pydantic models
- TypeScript validates before calling Python
- Python validates again defensively

### Error Handling
- All exceptions caught and logged
- Errors returned as JSON (not printed to stdout)
- TypeScript monitors stderr for issues

## Important Notes

1. **stdout vs stderr**
   - JSON results → stdout (for Node.js consumption)
   - Structured logs → stderr (for debugging)
   - Never mix them!

2. **Environment variables**
   - `.env` file loaded from project root
   - Service validates all required vars on startup
   - Fails fast with clear error messages

3. **Prompt management**
   - **ALL prompts managed in Langfuse Dashboard**
   - No static prompts in code
   - Service requires Langfuse connection (no fallback)

4. **Structured output**
   - Pydantic models enforced via `output_type`
   - Gemini models use JSON parsing (stricter schema validation)
   - OpenAI/Anthropic support native structured output

5. **Multi-provider support via LiteLLM**
   - All models use `LitellmModel(model=name)`
   - Set model in Langfuse prompt config
   - Environment variables auto-detected per provider

## Further Reading

### Essential Documentation
1. **[DEVELOPER_HANDOVER.md](DEVELOPER_HANDOVER.md)** - Architecture deep-dive
2. **[tests/README.md](tests/README.md)** - Testing guide
3. **[Root README.md](../README.md)** - Project overview

### External Documentation
- [OpenAI Agents SDK](https://github.com/openai/openai-agents-python)
- [Langfuse Documentation](https://langfuse.com/docs)
- [Pydantic Documentation](https://docs.pydantic.dev/)
- [LiteLLM Models](https://docs.litellm.ai/docs/providers)

### Langfuse Prompts
Login to Langfuse to view/edit prompts:
- `negotiation` - Main negotiation prompt (buyer/seller)
- `simulation_eval` - Evaluation prompt

---

## Developer Checklist

Before modifying Python services:
- [ ] Virtual environment activated (`source .venv/bin/activate`)
- [ ] Dependencies installed (`pip install -r scripts/requirements.txt`)
- [ ] Environment variables set (`.env` file)
- [ ] Tests passing (`pytest scripts/tests/`)
- [ ] Langfuse prompts reviewed (https://cloud.langfuse.com)
- [ ] TypeScript integration tested (`npm run test`)

After changes:
- [ ] New tests added for new features
- [ ] Type hints added to new functions
- [ ] Docstrings updated
- [ ] CHANGELOG.md updated with changes

---

**Happy coding! 🐍🤖**

*For questions, refer to [DEVELOPER_HANDOVER.md](DEVELOPER_HANDOVER.md) or TypeScript integration docs in repository root.*
