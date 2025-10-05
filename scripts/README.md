# Python AI Microservices

> AI negotiation engine and evaluation services using OpenAI Agents SDK

## 📁 Directory Structure

```
scripts/
├── README.md                          # This file - start here!
├── README_NEGOTIATION.md              # Detailed negotiation engine docs
├── DEVELOPER_HANDOVER.md              # Architecture deep-dive
│
├── run_production_negotiation.py      # Main negotiation engine (1,000+ lines)
├── evaluate_simulation.py             # AI evaluation service (NEW)
├── negotiation_models.py              # Pydantic data models
├── negotiation_utils.py               # Helper functions
├── gemini_market_intelligence.py      # Market data fetcher
│
├── requirements.txt                   # Python dependencies
├── pytest.ini                         # Test configuration
└── tests/                             # Unit tests
    ├── test_negotiation_models.py
    ├── test_negotiation_utils.py
    └── README.md
```

## 🚀 Quick Start

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
OPENAI_API_KEY="sk-..."
LANGFUSE_PUBLIC_KEY="pk-lf-..."
LANGFUSE_SECRET_KEY="sk-lf-..."
LANGFUSE_HOST="https://cloud.langfuse.com"
```

### 3. Test Python Service
```bash
# Activate virtual environment
source .venv/bin/activate

# Run tests
pytest scripts/tests/

# Test negotiation engine (dry run)
python scripts/run_production_negotiation.py --help
```

## 📚 Core Services

### 1. Negotiation Engine (`run_production_negotiation.py`)
**Purpose**: Autonomous AI-to-AI negotiations using OpenAI Agents SDK

**Key Features:**
- Multi-round buyer-seller negotiations
- Configurable AI personalities (Big Five traits)
- Influence techniques + negotiation tactics
- ZOPA-based constraints
- Real-time WebSocket updates
- Full Langfuse tracing

**Called by**: TypeScript backend via subprocess
**Input**: JSON negotiation parameters
**Output**: JSON results with conversation log

**Documentation**: See [README_NEGOTIATION.md](README_NEGOTIATION.md)

### 2. Evaluation Service (`evaluate_simulation.py`) 🆕
**Purpose**: Post-simulation AI evaluation with structured output

**Key Features:**
- Uses Langfuse prompt `simulation_eval`
- Structured output with Pydantic models
- Automatic Langfuse tracing
- GPT-4o-mini for cost efficiency

**Called by**: TypeScript backend after simulation completion
**Input**: Conversation log + negotiation metadata
**Output**: JSON evaluation with effectiveness scores

**Model**: `SimulationEvaluation` (see negotiation_models.py)
```python
class SimulationEvaluation(BaseModel):
    tactical_summary: str                    # 2-3 sentences in German
    influencing_effectiveness_score: int     # 1-10
    tactic_effectiveness_score: int          # 1-10
```

### 3. Data Models (`negotiation_models.py`)
**Purpose**: Pydantic models for type-safe data exchange

**Key Models:**
- `NegotiationConfig` - Configuration and environment validation
- `NegotiationResponse` - Structured AI output (buyer/seller offers)
- `NegotiationOffer` - Product offers with dimensions
- `SimulationEvaluation` - Evaluation results 🆕

**Usage**: Imported by both negotiation and evaluation services

### 4. Utilities (`negotiation_utils.py`)
**Purpose**: Helper functions for negotiation logic

**Key Functions:**
- `setup_langfuse_tracing()` - Configure OpenAI Agents instrumentation
- `analyze_convergence()` - Check if negotiation is converging
- `format_dimensions_for_prompt()` - Convert dimensions to AI-readable format
- `calculate_dynamic_max_rounds()` - Determine optimal round count
- `emit_round_update()` - Send WebSocket updates to frontend

### 5. Market Intelligence (`gemini_market_intelligence.py`)
**Purpose**: Fetch market data using Gemini Flash (cost-effective)

**Usage**: Called by negotiation engine for market context
**Note**: Optional service for enhanced realism

## 🔧 Development Workflow

### Adding New Features

#### 1. New Negotiation Strategy
```python
# 1. Add to negotiation_models.py if needed
# 2. Update negotiation_utils.py with helper functions
# 3. Modify run_production_negotiation.py prompt generation
# 4. Test with pytest
# 5. Update Langfuse prompt if needed
```

#### 2. New Evaluation Criteria
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

# Run with sample data (check TypeScript backend for JSON structure)
python scripts/run_production_negotiation.py \
  --negotiation-data '{"negotiation": {...}, "context": {...}}'
```

#### Check Langfuse Traces
1. Login to https://cloud.langfuse.com
2. Navigate to "Traces"
3. Filter by tag: "negotiation" or "evaluation"
4. Inspect input/output/tokens/cost

## 📦 Dependencies Explained

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

### Installing Additional Packages
```bash
# Add to requirements.txt
echo "new-package>=1.0.0" >> scripts/requirements.txt

# Install
pip install -r scripts/requirements.txt

# Freeze exact versions (optional)
pip freeze > scripts/requirements-lock.txt
```

## 🏗️ Architecture

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
                  │ API Calls
                  ↓
┌─────────────────────────────────────────┐
│ External Services                        │
│  ├→ OpenAI (GPT-4o, GPT-4o-mini)        │
│  ├→ Anthropic (Claude)                  │
│  ├→ Google (Gemini)                     │
│  └→ Langfuse (Observability)            │
└─────────────────────────────────────────┘
```

### Data Flow

1. **Negotiation Request**:
   ```
   TypeScript → spawn Python → run_production_negotiation.py
   → OpenAI Agents SDK → GPT-4o (multiple rounds)
   → Returns JSON with conversation log
   → TypeScript stores in database
   ```

2. **Evaluation Request**:
   ```
   TypeScript → spawn Python → evaluate_simulation.py
   → Langfuse prompt "simulation_eval"
   → GPT-4o-mini with structured output
   → Returns SimulationEvaluation JSON
   → TypeScript stores in database
   ```

## 🧪 Testing Strategy

### Unit Tests (`scripts/tests/`)

**test_negotiation_models.py**:
- Pydantic model validation
- Configuration validation
- Data serialization/deserialization

**test_negotiation_utils.py**:
- Convergence detection
- Dimension formatting
- Prompt compilation
- WebSocket event emission

### Integration Testing
Run from TypeScript:
```bash
npm run test  # Includes Python subprocess tests
```

### Manual Testing
```bash
# Test evaluation service
python scripts/evaluate_simulation.py \
  --simulation-run-id "test-123" \
  --conversation-log '[...]' \
  --role "BUYER" \
  --influence-technique "Reziprozität" \
  --negotiation-tactic "Anchoring" \
  --counterpart-attitude "Kooperativ"
```

## 🐛 Common Issues & Solutions

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

## 📊 Performance Optimization

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

## 🔐 Security Best Practices

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

## 📚 Further Reading

### Essential Documentation
1. **[README_NEGOTIATION.md](README_NEGOTIATION.md)** - Complete negotiation engine guide
2. **[DEVELOPER_HANDOVER.md](DEVELOPER_HANDOVER.md)** - Architecture deep-dive
3. **[tests/README.md](tests/README.md)** - Testing guide

### External Documentation
- [OpenAI Agents SDK](https://github.com/openai/openai-agents-python)
- [Langfuse Documentation](https://langfuse.com/docs)
- [Pydantic Documentation](https://docs.pydantic.dev/)
- [LiteLLM Models](https://docs.litellm.ai/docs/providers)

### Langfuse Prompts
Login to Langfuse to view/edit prompts:
- `negotiation` - Main negotiation prompt (buyer/seller)
- `simulation_eval` - Evaluation prompt 🆕

---

## 🎯 Quick Reference

### File Purposes
| File | Purpose | Called By | Output |
|------|---------|-----------|--------|
| `run_production_negotiation.py` | Main negotiation engine | TypeScript | Conversation log |
| `evaluate_simulation.py` | AI evaluation | TypeScript | Effectiveness scores |
| `negotiation_models.py` | Data models | All services | - |
| `negotiation_utils.py` | Helper functions | Negotiation engine | - |
| `gemini_market_intelligence.py` | Market data | Negotiation engine | Market context |

### Command Cheat Sheet
```bash
# Setup
python3 -m venv .venv
source .venv/bin/activate
pip install -r scripts/requirements.txt

# Testing
pytest scripts/tests/
pytest -v scripts/tests/
pytest --cov=scripts scripts/tests/

# Debugging
python scripts/run_production_negotiation.py --help
python scripts/evaluate_simulation.py --help

# Linting (optional)
pip install ruff black
ruff check scripts/
black scripts/
```

---

## ✅ Developer Checklist

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
- [ ] README_NEGOTIATION.md updated if architecture changed
- [ ] CHANGELOG.md updated with changes

---

**Happy coding! 🐍🤖**

*For questions, refer to [DEVELOPER_HANDOVER.md](DEVELOPER_HANDOVER.md) or TypeScript integration docs in repository root.*
