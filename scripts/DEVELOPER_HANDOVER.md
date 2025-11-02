# 🎯 Developer Handover - Negotiation Microservice

## ✅ What's Been Completed

The Python negotiation microservice has been completely refactored and is now **production-ready** with:
- ✅ **Structured output** (Pydantic models, no JSON parsing)
- ✅ **Structured logging** (professional logging to stderr)
- ✅ **Comprehensive test suite** (41 unit tests with pytest)
- ✅ **Resource management** (proper cleanup with try-finally)
- ✅ **Multi-provider support** (OpenAI, Anthropic, Gemini via LiteLLM)
- ✅ **Langfuse integration** (prompts & tracing centralized)
- ✅ **Type safety** (complete Pydantic models)


## 📁 Your New File Structure

```
scripts/
├── run_production_negotiation.py     # 🚀 MAIN - Start here (~880 lines)
├── negotiation_models.py             # 📊 Data structures (Pydantic models)
├── negotiation_utils.py              # 🔧 Helper functions 
├── pytest.ini                        # 🧪 Test configuration
├── tests/
│   ├── __init__.py
│   ├── test_negotiation_utils.py    # Utility tests
│   ├── test_negotiation_models.py   # Model tests
│   └── README.md                     # Test guide
├── README.md                          # 📖 Setup & flow guide
├── DEVELOPER_HANDOVER.md              # 👨‍💻 This guide
```

## 🎓 What You Need to Know

### **File Navigation (30 seconds)**
1. **Need to understand the flow?** → `run_production_negotiation.py` or `README.md` (flow diagram)
2. **Need to see data structures?** → `negotiation_models.py`
3. **Need helper functions?** → `negotiation_utils.py`
4. **Need to change prompts?** → Langfuse Dashboard (not code!)
5. **Need to test changes?** → `pytest tests/`

### **Common Tasks (Step-by-Step)**

---

#### 🎛️ **Task: How to Adjust Settings**

**File:** `negotiation_models.py` → `NegotiationConfig` class

**Available Settings:**
```python
class NegotiationConfig:
    # Round limits
    DEFAULT_MAX_ROUNDS: int = 6
    DEFAULT_MIN_ROUNDS: int = 2

    # AI model selection
    DEFAULT_MODEL: str = "gpt-4o"
    DEFAULT_BUYER_MODEL: str = "gpt-4o-mini"

    # Convergence detection
    CONVERGENCE_THRESHOLD: float = 0.05  # 5% change = convergence
    CONVERGENCE_CHECK_WINDOW: int = 2    # Check last 2 rounds

    # Logging
    ENABLE_DEBUG_LOGGING: bool = True
    LOG_CONVERSATION_DETAILS: bool = True
```

**Example: Increase max rounds**
```python
# In negotiation_models.py, line ~30
DEFAULT_MAX_ROUNDS: int = 10  # Changed from 6
```

**Example: Use different AI model**
```python
# BETTER: Set model in Langfuse prompt config (preferred)
# OR in negotiation_models.py, line ~68
DEFAULT_MODEL: str = "claude-3-5-sonnet-20241022"  # Use Anthropic instead
```

---

#### 💬 **Task: How to Modify the Prompt**

**⚠️ CRITICAL: ALL prompts are in Langfuse - NO static prompts in code!**

The prompt is managed in **Langfuse Dashboard**. This allows prompt changes without code deployments.

**Step-by-step:**

1. **Go to Langfuse Dashboard**
   - URL: https://cloud.langfuse.com (or your self-hosted instance)
   - Login with your credentials

2. **Find the Prompt**
   - Navigate to: **Prompts** section
   - Search for: `negotiation` (single unified prompt)

3. **Edit the Prompt**
   - Click **Edit** button
   - Modify the prompt text
   - Set model in config section (e.g., `gpt-4o`, `claude-3-5-sonnet-20241022`)
   - Use variables like `{{user_zopa}}`, `{{counterpart_zopa}}`, etc.
   - **Save as new version** (creates version history)

4. **Deploy the Prompt**
   - Click **Set as Production**
   - The service will automatically use the new version

5. **Test the Prompt**
   - Run a test negotiation
   - Check the trace in Langfuse to see the actual prompt used

**Fallback Behavior:**
If Langfuse is unavailable, the service uses a hardcoded fallback prompt in `run_production_negotiation.py` (search for `FALLBACK_BUYER_PROMPT`).

**Variables Available in Prompts:**
- `{{user_zopa}}` - Your negotiation boundaries
- `{{counterpart_zopa}}` - Other party's boundaries
- `{{round_number}}` - Current negotiation round
- `{{conversation_history}}` - Previous messages
- `{{technique_name}}` - Influencing technique being tested
- `{{tactic_name}}` - Negotiation tactic being tested

---

#### 🔄 **Task: How to Adjust Interactions**

**File:** `run_production_negotiation.py` → `NegotiationService` class

**Common Interaction Adjustments:**

**1. Change who goes first:**
```python
# In run_production_negotiation.py, line ~400
async def run_negotiation(self) -> Dict[str, Any]:
    # ...
    current_agent = "SELLER"  # Change to "BUYER" to let buyer go first
```

**2. Change turn order:**
```python
# In _execute_round(), line ~600
def _get_next_agent(self, current_agent: str) -> str:
    """Switch between BUYER and SELLER."""
    return "SELLER" if current_agent == "BUYER" else "BUYER"
    # Modify this logic for custom turn orders
```

**3. Add automated intervention:**
```python
# In _execute_round(), after line ~650
response = await self._get_agent_response(current_agent, round_number)

# Add intervention here
if round_number == 3:
    logger.info("Injecting mediator message at round 3")
    # Inject custom logic
```

**4. Change convergence detection:**
```python
# In negotiation_utils.py, line ~150
def analyze_convergence(
    history: List[NegotiationResponse],
    threshold: float = 0.05  # Change this value
) -> Dict[str, Any]:
    # ...
```

---

#### 🧪 **Task: Debug a Failing Negotiation**

**Step 1: Check Logs**
```bash
# Run with debug logging
python run_production_negotiation.py \
  --negotiation-id=debug-123 \
  --simulation-run-id=debug-sim \
  --max-rounds=3 \
  2>&1 | tee debug.log

# Look for ERROR or WARNING lines
grep "ERROR" debug.log
grep "WARNING" debug.log
```

**Step 2: Check Langfuse Trace**
- Every negotiation logs a trace URL to stderr
- Example: `DEBUG - Langfuse trace: https://cloud.langfuse.com/trace/abc123`
- Open this URL to see:
  - Full conversation history
  - Latency per round
  - Token usage
  - Model responses

**Step 3: Run Unit Tests**
```bash
cd scripts
pytest tests/ -v

# Run specific test file
pytest tests/test_negotiation_utils.py -v

# Run with coverage
pytest tests/ --cov=. --cov-report=html
```

**Step 4: Test with Minimal Data**
```bash
# Test basic functionality
python run_production_negotiation.py \
  --negotiation-id=minimal \
  --simulation-run-id=minimal \
  --max-rounds=2
```

## 🧪 Testing Your Changes

**Always run tests before committing:**

### **Run Full Test Suite**
```bash
cd scripts
pytest tests/ -v

# With coverage report
pytest tests/ --cov=. --cov-report=term-missing --cov-report=html

# View HTML coverage report
open htmlcov/index.html
```

### **Run Specific Tests**
```bash
# Test utility functions only
pytest tests/test_negotiation_utils.py -v

# Test data models only
pytest tests/test_negotiation_models.py -v

# Run single test by name
pytest tests/test_negotiation_models.py::test_negotiation_config -v
```

### **Expected Output**
```
============================= test session starts ==============================
collected 41+ items

tests/test_negotiation_utils.py::test_analyze_convergence PASSED          [  2%]
tests/test_negotiation_utils.py::test_format_dimensions PASSED            [  4%]
...
tests/test_negotiation_models.py::test_negotiation_response_validation PASSED [100%]

============================== 41+ passed in 2.34s ===============================
```

## 🔧 Code Quality Standards

### **1. Logging (NOT print statements)**
```python
import logging

logger = logging.getLogger(__name__)

# Use structured logging levels
logger.debug("Detailed diagnostic info")
logger.info("Normal operation updates")
logger.warning("Something unexpected happened")
logger.error("Operation failed")
logger.critical("System failure")

# ❌ DON'T DO THIS:
print(f"DEBUG: Something happened", file=sys.stderr)

# ✅ DO THIS:
logger.debug("Something happened")
```

### **2. Resource Management**
```python
# Always use try-finally for cleanup
session = None
try:
    session = create_session()
    result = session.do_work()
    return result
finally:
    if session:
        session.cleanup()
        logger.info("Session cleaned up successfully")
```

### **3. Function Documentation**
```python
def function_name(param: str) -> dict:
    """
    Clear description of what this function does.

    Args:
        param: Description of parameter

    Returns:
        Description of return value

    Raises:
        ValueError: When param is invalid

    Example:
        >>> result = function_name("test")
        >>> print(result)
        {'status': 'success'}
    """
```

### **4. Error Handling**
```python
try:
    result = risky_operation()
    return result
except SpecificException as e:
    logger.error(f"Operation failed: {e}", exc_info=True)
    return safe_fallback_value
```

### **5. Type Hints**
```python
from typing import Dict, List, Any, Optional

def process_data(
    input_data: Dict[str, Any],
    max_items: Optional[int] = None
) -> List[str]:
    """Function body with complete type hints."""
    pass
```

## 🚨 Important Rules

### **DO:**
- ✅ Use `logger` for all logging (NOT print statements)
- ✅ Add type hints to all new functions
- ✅ Write docstrings with examples
- ✅ Use try-finally for resource cleanup
- ✅ Return JSON to stdout only
- ✅ Run `pytest tests/` before committing
- ✅ Follow existing error handling patterns
- ✅ Use LiteLLM for all AI model creation
- ✅ Write unit tests for new features

### **DON'T:**
- ❌ Print debug info to stdout (breaks Node.js integration)
- ❌ Use print() for logging (use logger instead)
- ❌ Add dependencies without updating requirements
- ❌ Create new files unless absolutely necessary
- ❌ Change the main flow in `NegotiationService.run_negotiation()` without tests
- ❌ Remove error handling or fallbacks
- ❌ Edit prompts in code (use Langfuse dashboard instead)
- ❌ Skip resource cleanup (Langfuse.flush(), session cleanup, etc.)

## 🏭 Using LiteLLM for AI Models

**All AI providers are handled via LiteLLM:**

```python
from agents.extensions.models.litellm_model import LitellmModel

# Create model (LiteLLM auto-detects provider)
model = LitellmModel(model="gpt-4o")                              # OpenAI
model = LitellmModel(model="claude-3-5-sonnet-20241022")         # Anthropic
model = LitellmModel(model="gemini/gemini-2.0-flash-exp")        # Google
model = LitellmModel(model="command-r-plus")                     # Cohere

# All LiteLLM-supported providers work automatically!
```

**Environment variables are auto-detected:**
- `OPENAI_API_KEY` for OpenAI models
- `ANTHROPIC_API_KEY` for Anthropic models
- `GEMINI_API_KEY` for Google Gemini
- `COHERE_API_KEY` for Cohere (optional)
- etc.

**Structured output support:**
- ✅ OpenAI, Anthropic, most providers: Native structured output
- ⚠️ Gemini: JSON parsing fallback (stricter schema validation)

## 📞 Getting Immediate Help

### **Something Not Working?**
1. **Run the tests**: `pytest tests/ -v`
2. **Check structured logs**: Look for ERROR/WARNING in stderr
3. **Check Langfuse trace**: URL logged in DEBUG output
4. **Check the README**: `README.md`
5. **Check function docstrings**: Every function explains itself

### **Need to Understand the Flow?**
Read [run_production_negotiation.py](run_production_negotiation.py) → `NegotiationService.run_negotiation()` method (line ~400).

**Main Flow:**
1. Initialize Langfuse tracing
2. Load prompts from Langfuse (with fallback)
3. Create AI agents using ModelProviderFactory
4. Run negotiation rounds (buyer ↔ seller)
5. Determine outcome (deal/no-deal/timeout)
6. Cleanup resources (Langfuse flush, session cleanup)

### **Need Examples?**
Every function has usage examples in its docstring.

## 🎯 Your Mission

**Primary Goal:** Maintain **production-quality** code that is:
- **Reliable** - Comprehensive error handling and resource cleanup
- **Observable** - Structured logging and Langfuse tracing
- **Testable** - High test coverage with pytest
- **Maintainable** - Clear documentation and type safety

**Secondary Goals:**
- Fix bugs with failing tests first
- Add features with tests
- Improve performance with benchmarks
- Keep documentation updated

**Remember:** This service is production-ready. Changes should improve quality, not just add features!

---

## 📚 Quick Reference

### **File Responsibilities**
- `run_production_negotiation.py` - Main orchestration
- `negotiation_models.py` - Data structures & config
- `negotiation_utils.py` - Helper functions (no JSON parsing!)
- `tests/` - Unit tests (41 passing)

### **Key Concepts**
- **Langfuse Prompts** - ALL prompts in dashboard, NONE in code
- **Structured Output** - Pydantic models enforced via `output_type`
- **Structured Logging** - Use logger to stderr, JSON to stdout
- **Resource Cleanup** - Always use try-finally
- **Type Safety** - Pydantic models for all data
- **Multi-Provider** - All LiteLLM providers supported

### **Before You Deploy**
```bash
# 1. Run tests
pytest tests/ -v

# 2. Test negotiation
python scripts/run_production_negotiation.py \
  --negotiation-id=test \
  --simulation-run-id=test \
  --max-rounds=2

# 3. Test with real negotiation
python run_production_negotiation.py \
  --negotiation-id=pre-deploy-test \
  --simulation-run-id=test-sim \
  --max-rounds=2

# 4. Check Langfuse trace for errors
```

---

**Welcome to the team! The negotiation microservice is production-ready and well-documented. Happy coding! 🚀**
