# Negotiation Microservice - Developer Guide

## 🎯 What This Service Does

This Python microservice runs AI-powered negotiations between buyer and seller agents. It's called by the Node.js backend and returns negotiation results as JSON.

**Main Services:**
1. **`run_production_negotiation.py`** - Negotiation engine (buyer/seller AI agents)
2. **`evaluate_simulation.py`** 🆕 - Post-simulation AI evaluation with effectiveness scores

**Key Features:**
- ✅ Multi-provider AI support (OpenAI, Anthropic, Gemini, etc.) via LiteLLM
- ✅ Langfuse prompt management & tracing
- ✅ Structured output with Pydantic models (no JSON parsing!)
- ✅ Automatic post-simulation evaluation 🆕
- ✅ Structured logging with Python logging module
- ✅ Comprehensive test suite (40+ tests with pytest)
- ✅ Type-safe with Pydantic models
- ✅ Proper resource management

## 📊 How It Works - Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Node.js Backend                              │
│                                                                       │
│  Calls: python run_production_negotiation.py --negotiation-id=123   │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Python Negotiation Service (Main Entry)                 │
│                                                                       │
│  1. Validate environment (API keys, config)                          │
│  2. Initialize Langfuse tracing                                      │
│  3. Load prompts from Langfuse (with fallback)                       │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Create AI Agents (LiteLLM)                        │
│                                                                       │
│  Buyer Agent                          Seller Agent                   │
│  ┌─────────────────┐                 ┌─────────────────┐            │
│  │ Model: gpt-4o   │                 │ Model: gpt-4o   │            │
│  │ Role: BUYER     │                 │ Role: SELLER    │            │
│  │ Output: Pydantic│                 │ Output: Pydantic│            │
│  └─────────────────┘                 └─────────────────┘            │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Negotiation Rounds (Alternating)                    │
│                                                                       │
│  Round 1: SELLER → Pydantic NegotiationResponse                      │
│           ├─ message: "I propose 5000 EUR for 500 units"            │
│           ├─ action: "continue"                                      │
│           └─ offer: {Price: 5000, Volume: 500}                       │
│                                                                       │
│  Round 2: BUYER → Pydantic NegotiationResponse                       │
│           ├─ message: "Too high, I offer 3000 EUR"                   │
│           ├─ action: "continue"                                      │
│           └─ offer: {Price: 3000, Volume: 500}                       │
│                                                                       │
│  Round 3: SELLER → Pydantic NegotiationResponse                      │
│           ├─ message: "Let's meet at 4000 EUR"                       │
│           ├─ action: "accept"                                        │
│           └─ offer: {Price: 4000, Volume: 500}                       │
│                                                                       │
│  ✅ Deal accepted! (action == "accept")                              │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Cleanup & Return Results                          │
│                                                                       │
│  1. Flush Langfuse trace                                             │
│  2. Close agent sessions                                             │
│  3. Return JSON to stdout                                            │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         JSON Output (stdout)                         │
│                                                                       │
│  {                                                                    │
│    "outcome": "DEAL_ACCEPTED",                                       │
│    "totalRounds": 3,                                                 │
│    "finalOffer": {"dimension_values": {Price: 4000, Volume: 500}},   │
│    "conversationLog": [...],                                         │
│    "langfuseTraceId": "trace_abc123"                                 │
│  }                                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Points:**
- 🔄 **No JSON parsing** - Agents return Pydantic `NegotiationResponse` objects directly
- 🔌 **LiteLLM** - Single interface for all AI providers (OpenAI, Anthropic, Gemini, etc.)
- 📝 **Structured output** - Type-safe responses enforced by Pydantic models
- 🔍 **Langfuse tracing** - Full observability of every conversation
- 📊 **Logs to stderr, JSON to stdout** - Clean separation for Node.js consumption

## 📁 Complete File Structure

```
scripts/
├── run_production_negotiation.py     # 🚀 MAIN FILE - Start here (800+ lines)
├── negotiation_models.py             # 📊 Data structures and config (200+ lines)
├── negotiation_utils.py              # 🔧 Helper functions (200+ lines, no JSON parsing!)
├── pytest.ini                        # 🧪 Test configuration
├── tests/
│   ├── __init__.py
│   ├── test_negotiation_utils.py    # Utility function tests
│   ├── test_negotiation_models.py   # Data model tests
│   └── README.md                     # Test documentation
├── README_NEGOTIATION.md            # 📖 This guide
└── DEVELOPER_HANDOVER.md            # 👨‍💻 Task-based guide
```

## 🚀 Quick Start

### 1. Prerequisites
```bash
# Install Python dependencies (required)
pip install openai-agents langfuse python-dotenv pydantic pydantic-settings litellm

# Install testing dependencies (optional)
pip install pytest pytest-asyncio

# Environment variables (set in .env file in project root):
OPENAI_API_KEY=sk-...                    # Required for OpenAI models
LANGFUSE_PUBLIC_KEY=pk-lf-...            # Required - prompts loaded from Langfuse
LANGFUSE_SECRET_KEY=sk-lf-...            # Required - tracing to Langfuse
LANGFUSE_HOST=https://cloud.langfuse.com # Optional, defaults to cloud

# Optional: For other AI providers (via LiteLLM)
ANTHROPIC_API_KEY=sk-ant-...             # For Claude models
GEMINI_API_KEY=...                       # For Google Gemini
COHERE_API_KEY=...                       # For Cohere models
```

### 2. Run Tests
```bash
# Navigate to the scripts directory
cd scripts

# Run test suite
pytest tests/ -v

# Expected output: 41 tests passing
```

### 3. Test the Service
```bash
# Run from project root (so .env is loaded)
cd /path/to/arian-ai

# Simple test (uses prompt from Langfuse)
python scripts/run_production_negotiation.py \
  --negotiation-id=test-123 \
  --simulation-run-id=sim-456 \
  --max-rounds=3
```

### 4. Expected Output
**stdout (JSON only):**
```json
{
  "outcome": "DEAL_ACCEPTED",
  "totalRounds": 2,
  "finalOffer": {
    "dimension_values": {...}
  },
  "conversationLog": [...],
  "langfuseTraceId": "trace_id_123"
}
```

**stderr (structured logs):**
```
2025-10-05 10:15:30 - __main__ - INFO - Starting negotiation service
2025-10-05 10:15:30 - __main__ - INFO - Retrieved Langfuse prompt: negotiation v11
2025-10-05 10:15:31 - __main__ - INFO - Created agents with model from Langfuse
2025-10-05 10:15:32 - __main__ - INFO - Round 1/3: SELLER's turn
2025-10-05 10:15:35 - __main__ - INFO - Round 2/3: BUYER's turn
2025-10-05 10:15:38 - __main__ - INFO - Deal accepted at round 2
2025-10-05 10:15:38 - __main__ - INFO - Langfuse trace ID: trace_abc123
```

## 🔍 Understanding the Code

### Main Flow (run_production_negotiation.py)

The `NegotiationService` class orchestrates the entire negotiation:

```python
class NegotiationService:
    async def run_negotiation(self) -> Dict[str, Any]:
        """
        Main negotiation flow (6 steps):

        1. Initialize Langfuse tracing
        2. Load prompts from Langfuse dashboard (with fallback)
        3. Create AI agents using ModelProviderFactory
        4. Run negotiation rounds (alternating BUYER/SELLER turns)
        5. Determine outcome (DEAL_ACCEPTED/NO_DEAL/TIMEOUT)
        6. Cleanup resources (Langfuse.flush(), session cleanup)
        """
```

**Key Methods:**
- `_validate_environment()` - Check required API keys exist
- `_initialize_langfuse()` - Setup tracing and load prompts from Langfuse
- `_create_agents()` - Create buyer/seller AI agents with LiteLLM
- `_execute_negotiation_rounds()` - Run all negotiation rounds
- `_determine_outcome()` - Analyze if deal was reached
- `_cleanup()` - Resource cleanup (Langfuse flush, session cleanup)

### Data Models (negotiation_models.py)

**Pydantic models for type safety:**

```python
class NegotiationResponse(BaseModel):
    """Agent's response in a negotiation round."""
    agent: str                      # "BUYER" or "SELLER"
    round: int                      # Round number
    message: str                    # Agent's message
    offer: Optional[NegotiationOffer]
    acceptDeal: bool = False
    rejectDeal: bool = False
    confidence: float = 0.5         # 0.0 to 1.0

class NegotiationOffer(BaseModel):
    """Structured offer with dimension values."""
    dimension_values: Dict[str, Any]  # e.g., {"Preis": 100, "Volumen": 1000}

class NegotiationConfig:
    """All service configuration in one place."""
    DEFAULT_MAX_ROUNDS: int = 6
    DEFAULT_MODEL: str = "gpt-4o"
    DEFAULT_BUYER_MODEL: str = "gpt-4o-mini"
    CONVERGENCE_THRESHOLD: float = 0.05
    # ... more settings
```

### Helper Functions (negotiation_utils.py)

**Core utility functions:**

```python
def analyze_convergence(history: List[NegotiationResponse]) -> Dict:
    """
    Detect if parties are converging on a deal.
    Returns convergence metrics and trends.
    """

def format_dimensions_for_prompt(dimensions: List[Dict]) -> str:
    """
    Convert dimension data into readable format for AI prompts.
    """

def normalize_model_output(response_data: Dict, dimensions: List[Dict]) -> Dict:
    """
    Normalize and validate structured output from Pydantic models.
    Ensures numeric values, clamps to min/max, etc.
    """

def generate_dimension_examples(dimensions: List[Dict]) -> str:
    """
    Generate example offer JSON for AI prompts.
    """
```

### AI Model Configuration

**LiteLLM handles all providers:**

```python
from agents.extensions.models.litellm_model import LitellmModel

# OpenAI
model = LitellmModel(model="gpt-4o")

# Anthropic
model = LitellmModel(model="claude-3-5-sonnet-20241022")

# Google Gemini
model = LitellmModel(model="gemini/gemini-2.0-flash-exp")

# Any LiteLLM-supported provider works!
```

## 🐛 Common Issues & Solutions

### Issue: "Missing environment variables"
**Error:** `ValueError: Missing required environment variable: OPENAI_API_KEY`

**Solution:**
```bash
# Check .env file exists
ls -la .env

# Add missing keys to .env
echo "OPENAI_API_KEY=sk-..." >> .env
echo "LANGFUSE_PUBLIC_KEY=pk-lf-..." >> .env
echo "LANGFUSE_SECRET_KEY=sk-lf-..." >> .env
```

### Issue: "Structured output validation error"
**Error:** `Expected NegotiationResponse, got dict`

**Solution:** This means the agent didn't return structured output. Check:
1. Verify `output_type=AgentOutputSchema(NegotiationResponse, ...)` is set
2. Check model supports structured output (most LiteLLM models do)
3. Review Langfuse trace to see actual agent response

### Issue: "Agent creation failed"
**Error:** `ERROR - Failed to create buyer agent: Authentication failed`

**Solutions:**
1. **Check API key validity:**
   ```bash
   # Test OpenAI API key
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```

2. **Check API credits:**
   - Visit https://platform.openai.com/usage
   - Ensure you have available credits

3. **Check model name:**
   ```python
   # In negotiation_models.py
   DEFAULT_MODEL: str = "gpt-4o"  # Make sure this model exists
   ```

### Issue: "Tests failing"
**Error:** `pytest: command not found` or `ModuleNotFoundError: No module named 'pytest'`

**Solution:**
```bash
# Install test dependencies
pip install pytest pytest-cov pytest-asyncio

# Verify installation
pytest --version
```

### Issue: "Langfuse connection timeout"
**Error:** `WARNING - Failed to load prompt from Langfuse: timeout`

**Solution:** Service automatically falls back to hardcoded prompts. To fix permanently:
1. Check `LANGFUSE_HOST` is correct in `.env`
2. Check network connection to Langfuse
3. Verify API keys are valid

**Verify connection:**
```bash
curl -I https://cloud.langfuse.com
```

## ✏️ Making Changes

### 🎛️ How to Adjust Settings

**File:** `negotiation_models.py` → `NegotiationConfig` class

```python
class NegotiationConfig:
    # Change round limits
    DEFAULT_MAX_ROUNDS: int = 6         # Increase for longer negotiations
    DEFAULT_MIN_ROUNDS: int = 2         # Minimum rounds before deal

    # Change AI models
    DEFAULT_MODEL: str = "gpt-4o"       # Seller model
    DEFAULT_BUYER_MODEL: str = "gpt-4o-mini"  # Buyer model

    # Use different provider
    # DEFAULT_MODEL: str = "anthropic/claude-3-5-sonnet-20241022"
    # DEFAULT_BUYER_MODEL: str = "anthropic/claude-3-5-sonnet-20241022"

    # Adjust convergence detection
    CONVERGENCE_THRESHOLD: float = 0.05  # 5% change = convergence
    CONVERGENCE_CHECK_WINDOW: int = 2    # Check last N rounds

    # Logging settings
    ENABLE_DEBUG_LOGGING: bool = True
    LOG_CONVERSATION_DETAILS: bool = True
```

### 💬 How to Modify the Prompt

**⚠️ IMPORTANT: All prompts are managed in Langfuse - no code changes needed!**

**Step-by-step:**

1. **Login to Langfuse**
   - Go to https://cloud.langfuse.com (or your instance)
   - Use your credentials from `.env`

2. **Navigate to Prompts**
   - Click **Prompts** in sidebar
   - Search for `negotiation` prompt

3. **Edit Prompt**
   - Click **Edit** button
   - Modify the prompt text
   - Available template variables:
     - `{{agent_role}}` - BUYER or SELLER
     - `{{technique_name}}` - Influencing technique
     - `{{tactic_name}}` - Negotiation tactic
     - `{{dimension_details}}` - ZOPA boundaries
     - `{{product_description}}` - Products being negotiated
     - And many more (see prompt template)

4. **Configure Model**
   - Set `model` in prompt config (e.g., `gpt-4o`, `claude-3-5-sonnet-20241022`)
   - LiteLLM will handle provider routing automatically

5. **Save & Deploy**
   - Click **Save as new version**
   - Click **Set as Production**
   - Service uses new version immediately (no restart needed!)

**Note:** There is no fallback prompt - Langfuse is required.

### 🔄 How to Adjust Interactions

**Change who goes first:**
```python
# In run_production_negotiation.py, line ~400
async def run_negotiation(self) -> Dict[str, Any]:
    current_agent = "SELLER"  # Change to "BUYER"
```

**Change turn order:**
```python
# In run_production_negotiation.py, line ~600
def _get_next_agent(self, current_agent: str) -> str:
    """Custom turn order logic here."""
    return "SELLER" if current_agent == "BUYER" else "BUYER"
```

**Add intervention logic:**
```python
# After getting agent response
if round_number == 3:
    logger.info("Injecting mediator intervention")
    # Add custom logic
```

### 🆕 Adding New Features

**1. Add new data fields:**
```python
# In negotiation_models.py
class NegotiationOffer(BaseModel):
    dimension_values: Dict[str, Any]
    risk_score: Optional[float] = None  # New field
```

**2. Add new helper functions:**
```python
# In negotiation_utils.py
def calculate_risk_score(offer: Dict) -> float:
    """Calculate risk score for an offer."""
    # Implementation
    return 0.5
```

**3. Add new business logic:**
```python
# In run_production_negotiation.py
def _assess_risk(self, offer: Dict) -> float:
    """Assess risk of current offer."""
    # Implementation
    return calculate_risk_score(offer)
```

**4. Write tests:**
```python
# In tests/test_negotiation_utils.py
def test_calculate_risk_score():
    """Test risk score calculation."""
    offer = {"Preis": 100}
    score = calculate_risk_score(offer)
    assert 0 <= score <= 1
```

### 🐛 Debugging Issues

**1. Enable verbose logging:**
```bash
# Run with all debug output
python run_production_negotiation.py \
  --negotiation-id=debug \
  --simulation-run-id=debug \
  --max-rounds=2 \
  2>&1 | tee debug.log
```

**2. Check Langfuse trace:**
```bash
# Trace URL is logged to stderr
grep "Langfuse trace:" debug.log
# Open URL in browser to see full conversation
```

**3. Run tests:**
```bash
# Run all tests
pytest tests/ -v

# Run with verbose output
pytest tests/ -vv -s

# Run single test
pytest tests/test_negotiation_utils.py::test_safe_json_parse -v
```

**4. Test with minimal data:**
```bash
# Simplest possible test
python run_production_negotiation.py \
  --negotiation-id=minimal \
  --simulation-run-id=minimal \
  --max-rounds=2
```

## 🧪 Testing Your Changes

### Run Full Test Suite
```bash
cd scripts

# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=. --cov-report=term-missing --cov-report=html

# View coverage report
open htmlcov/index.html

# Expected: 50+ tests passing with >80% coverage
```

### Run Specific Tests
```bash
# Test specific file
pytest tests/test_negotiation_utils.py -v

# Test specific function
pytest tests/test_negotiation_utils.py::test_safe_json_parse -v

# Test with verbose output
pytest tests/test_negotiation_models.py -vv -s
```

### Integration Test
```bash
# Quick integration test (2 rounds)
python run_production_negotiation.py \
  --negotiation-id=integration-test \
  --simulation-run-id=test-sim \
  --max-rounds=2

# Full integration test (realistic data)
python run_production_negotiation.py \
  --negotiation-id=full-test \
  --simulation-run-id=full-sim \
  --max-rounds=4 \
  --negotiation-data='{
    "negotiation": {
      "title": "Software License Deal",
      "negotiationType": "one-shot",
      "productMarketDescription": "Enterprise software licenses"
    },
    "dimensions": [
      {"name": "Preis", "minValue": 1000, "maxValue": 5000, "priority": 1},
      {"name": "Volumen", "minValue": 100, "maxValue": 1000, "priority": 2}
    ]
  }'
```

### Test Different AI Providers
```bash
# Test with Claude
DEFAULT_MODEL="anthropic/claude-3-5-sonnet-20241022" \
python run_production_negotiation.py \
  --negotiation-id=claude-test \
  --simulation-run-id=test \
  --max-rounds=2

# Test with Gemini
DEFAULT_MODEL="gemini/gemini-1.5-pro" \
python run_production_negotiation.py \
  --negotiation-id=gemini-test \
  --simulation-run-id=test \
  --max-rounds=2
```

## 🆕 AI Evaluation Service (evaluate_simulation.py)

### Overview
Post-simulation AI evaluation service that analyzes negotiation effectiveness using structured output.

**Key Features:**
- Automatic triggering after successful simulations (DEAL_ACCEPTED/WALK_AWAY)
- Langfuse prompt `simulation_eval` for version-controlled analysis
- Structured output via Pydantic `SimulationEvaluation` model
- Full Langfuse tracing with token usage tracking
- Cost-effective using GPT-4o-mini

### How It Works

```
┌────────────────────────────────────────────┐
│  TypeScript Backend (after simulation)     │
│  Calls: python evaluate_simulation.py     │
│    --simulation-run-id="abc-123"          │
│    --conversation-log='[{...}]'           │
│    --role="BUYER"                         │
│    --influence-technique="Reziprozität"   │
│    --negotiation-tactic="Anchoring"       │
│    --counterpart-attitude="Kooperativ"    │
└───────────────┬────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────┐
│  evaluate_simulation.py                    │
│                                            │
│  1. Load Langfuse prompt "simulation_eval"│
│  2. Format conversation log               │
│  3. Compile prompt with variables         │
│  4. Call OpenAI with structured output    │
│  5. Parse response into Pydantic model    │
│  6. Return JSON with effectiveness scores │
└───────────────┬────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────┐
│  Output (stdout as JSON)                   │
│  {                                         │
│    "simulationRunId": "abc-123",           │
│    "evaluation": {                         │
│      "tactical_summary": "2-3 Sätze...",   │
│      "influencing_effectiveness_score": 7, │
│      "tactic_effectiveness_score": 6       │
│    }                                       │
│  }                                         │
└────────────────────────────────────────────┘
```

### Data Model

```python
class SimulationEvaluation(BaseModel):
    """
    AI-generated evaluation of a completed simulation run.
    """
    tactical_summary: str = Field(
        description="2-3 Sätze zu den Haupterkenntnissen"
    )
    influencing_effectiveness_score: int = Field(
        ge=1, le=10,
        description="Bewertung der Influence Technique (1-10)"
    )
    tactic_effectiveness_score: int = Field(
        ge=1, le=10,
        description="Bewertung der Verhandlungstaktik (1-10)"
    )
```

### Usage Example

```bash
# Activate virtual environment
source .venv/bin/activate

# Run evaluation
python scripts/evaluate_simulation.py \
  --simulation-run-id="abc-123" \
  --conversation-log='[{"round":1,"agent":"BUYER","message":"..."}]' \
  --role="BUYER" \
  --influence-technique="Reziprozität" \
  --negotiation-tactic="Anchoring" \
  --counterpart-attitude="Kooperativ"
```

### Langfuse Prompt Structure

The `simulation_eval` prompt in Langfuse uses these variables:
- `{{ROLLE}}` - User role (BUYER/SELLER)
- `{{Verhandlung}}` - Formatted conversation log
- `{{influence}}` - Influence technique name
- `{{tactic}}` - Negotiation tactic name
- `{{attitute_counterpart}}` - Counterpart personality

### Integration with TypeScript

Called by `server/services/simulation-queue.ts` after simulation:

```typescript
// Automatic hook (lines 885-891)
if (result.outcome === 'DEAL_ACCEPTED' || result.outcome === 'WALK_AWAY') {
  this.triggerEvaluation(simulationId, negotiationId);
}

// Calls Python service (lines 1460-1522)
await SimulationEvaluationService.evaluateAndSave(
  simulationRunId,
  conversationLog,
  role,
  techniqueName,
  tacticName,
  counterpartAttitude
);
```

### Cost Analysis

**Per Evaluation:**
- Model: GPT-4o-mini
- Input tokens: ~1,500 (conversation + prompt)
- Output tokens: ~200 (structured evaluation)
- **Cost: ~$0.001 per evaluation** (0.1 cents)

**For 100 simulations:**
- Total cost: ~$0.10
- With Langfuse observability included

### Debugging

```bash
# Enable debug logging
export PYTHONVERBOSE=1

# Run evaluation with verbose output
python -u scripts/evaluate_simulation.py \
  --simulation-run-id="test-123" \
  --conversation-log='[...]' \
  --role="BUYER" \
  --influence-technique="Test" \
  --negotiation-tactic="Test" \
  --counterpart-attitude="Test"

# Check Langfuse traces
# Login to https://cloud.langfuse.com
# Filter by tag: "evaluation"
```

## 📝 Code Style Guidelines

### 1. Use Structured Logging
```python
import logging

logger = logging.getLogger(__name__)

# ❌ DON'T DO THIS:
print(f"DEBUG: Starting negotiation", file=sys.stderr)

# ✅ DO THIS:
logger.debug("Starting negotiation")
logger.info("Negotiation completed successfully")
logger.warning("Convergence not detected")
logger.error("Failed to parse response", exc_info=True)
```

### 2. Resource Management
```python
# Always use try-finally for cleanup
session = None
try:
    session = create_session()
    result = session.negotiate()
    return result
finally:
    if session:
        session.cleanup()
        logger.info("Session cleaned up")
```

### 3. Function Documentation
```python
def process_negotiation(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process negotiation data and return results.

    Args:
        data: Negotiation configuration with dimensions and ZOPA

    Returns:
        Dictionary with outcome, rounds, and conversation log

    Raises:
        ValueError: If required fields are missing

    Example:
        >>> result = process_negotiation({"negotiation": {...}})
        >>> print(result["outcome"])
        'DEAL_ACCEPTED'
    """
```

### 4. Type Hints
```python
from typing import Dict, List, Any, Optional

def analyze_offers(
    offers: List[Dict[str, Any]],
    threshold: Optional[float] = None
) -> Dict[str, float]:
    """Complete type hints for all parameters."""
    pass
```

### 5. Error Handling
```python
try:
    result = risky_operation()
    return result
except SpecificException as e:
    logger.error(f"Operation failed: {e}", exc_info=True)
    return safe_fallback_value
```

## 🚨 Important Notes

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

6. **Testing**
   - 41 tests covering models, utils, and integration
   - Run `pytest tests/ -v` before commits
   - No JSON parsing tests (uses structured output)

## 📞 Getting Help

### **Quick Debugging Checklist**
1. ✅ Run `pytest tests/ -v` - Do all tests pass?
2. ✅ Check stderr logs - Any ERROR or WARNING?
3. ✅ Check Langfuse trace - What does the conversation look like?
4. ✅ Test with minimal data - Does basic functionality work?
5. ✅ Check environment variables - Are all required keys set?

### **Resources**
- **Code comments** - Every function has clear documentation
- **Langfuse traces** - Full observability of every negotiation
- **Test suite** - 50+ examples of expected behavior
- **DEVELOPER_HANDOVER.md** - Step-by-step task guides

### **Common Commands**
```bash
# Run tests
pytest tests/ -v

# Check test coverage
pytest tests/ --cov=. --cov-report=html

# Test integration
python run_production_negotiation.py --negotiation-id=test --max-rounds=2

# View logs
python run_production_negotiation.py [...] 2>&1 | tee debug.log

# Check Langfuse trace
grep "Langfuse trace:" debug.log
```

---

**Remember:** This service is production-ready with comprehensive error handling, logging, and testing. Focus on maintaining quality over adding features!
