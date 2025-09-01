# Negotiation Microservice - Junior Developer Guide

## 🎯 What This Service Does

This Python microservice runs AI-powered negotiations between buyer and seller agents. It's called by the Node.js backend and returns negotiation results as JSON.

## 📁 Simple File Structure

**Only 4 files to understand:**

```
scripts/
├── run_production_negotiation.py     # 🚀 MAIN FILE - Start here
├── negotiation_models.py             # 📊 Data structures and config
├── negotiation_utils.py              # 🔧 Helper functions  
└── README_NEGOTIATION.md            # 📖 This guide
```

## 🚀 Quick Start

### 1. Prerequisites
```bash
# Install Python dependencies
pip install agents langfuse python-dotenv logfire pydantic

# Make sure these environment variables are set in your .env file:
OPENAI_API_KEY=sk-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
```

### 2. Test the Service
```bash
# Navigate to the scripts directory
cd scripts

# Run a simple test negotiation
python run_production_negotiation.py \
  --negotiation-id=test-123 \
  --simulation-run-id=sim-456 \
  --max-rounds=3 \
  --negotiation-data='{"negotiation":{"title":"Test Deal"}}'
```

### 3. Expected Output
The script outputs JSON to stdout:
```json
{
  "outcome": "DEAL_ACCEPTED", 
  "totalRounds": 2,
  "finalOffer": {...},
  "conversationLog": [...],
  "langfuseTraceId": "trace_id_123"
}
```

## 🔍 Understanding the Code

### Main Flow (run_production_negotiation.py)
```python
async def run_negotiation():
    # 1. Validate environment (check API keys)
    # 2. Parse input data (JSON from Node.js)  
    # 3. Initialize services (Langfuse, OpenAI)
    # 4. Create AI agents (buyer & seller)
    # 5. Run negotiation rounds
    # 6. Return results
```

### Data Models (negotiation_models.py)
- **NegotiationResponse**: What agents return each round
- **NegotiationOffer**: Agent's offer (price, terms, etc.)
- **NegotiationConfig**: All settings in one place
- **NegotiationOutcome**: Possible negotiation endings

### Helper Functions (negotiation_utils.py)
- **safe_json_parse()**: Parse agent responses (handles errors)
- **analyze_convergence()**: Check if parties are getting closer
- **format_dimensions_for_prompt()**: Convert data for AI prompts

## 🐛 Common Issues & Solutions

### Issue: "Missing environment variables"
**Solution:** Check your `.env` file has all required API keys.

### Issue: "JSON parse error"
**Problem:** Agent returned malformed JSON
**Solution:** The `safe_json_parse()` function handles this automatically with fallbacks.

### Issue: "Agent creation failed"
**Solution:** Check your OpenAI API key is valid and has credits.

### Issue: "Import errors when running script"
**Solution:** The imports are set up to work both ways - should auto-resolve.

## ✏️ Making Changes

### To modify negotiation behavior:
1. **Change agent prompts**: Edit the Langfuse prompt template (not the code)
2. **Change termination logic**: Look at `_determine_outcome()` method
3. **Change round limits**: Modify `NegotiationConfig.DEFAULT_MAX_ROUNDS`

### To add new features:
1. **New data fields**: Add to models in `negotiation_models.py`
2. **New helper functions**: Add to `negotiation_utils.py`
3. **New business logic**: Add methods to the `NegotiationService` class

### To debug issues:
1. **Check stderr output**: All debug info goes to stderr (not stdout)
2. **Check Langfuse traces**: Every negotiation creates a trace for monitoring
3. **Test with simple data**: Use minimal JSON to isolate issues

## 🧪 Testing Your Changes

### Quick Test Command
```bash
# Test basic functionality
python run_production_negotiation.py \
  --negotiation-id=test \
  --simulation-run-id=test \
  --max-rounds=2

# Expected: Should work without negotiation data
```

### Full Test Command  
```bash
# Test with realistic data
python run_production_negotiation.py \
  --negotiation-id=full-test \
  --simulation-run-id=full-sim \
  --max-rounds=4 \
  --negotiation-data='{
    "negotiation": {
      "title": "Test Deal",
      "negotiationType": "one-shot",
      "productMarketDescription": "Software licenses"
    },
    "dimensions": [
      {"name": "Price", "minValue": 1000, "maxValue": 5000, "priority": 1}
    ]
  }'
```

## 📝 Code Style Guidelines

### Function Names
- Use descriptive names: `parse_agent_response()` not `parse()`
- Private functions start with `_`: `_validate_environment()`

### Error Handling
```python
# Always use this pattern:
try:
    result = risky_operation()
    return result
except SpecificException as e:
    print(f"ERROR: Clear description: {e}", file=sys.stderr)
    return safe_fallback_value
```

### Type Hints
```python
# Always specify types:
def process_data(input_data: Dict[str, Any]) -> List[str]:
    # Function body
```

## 🚨 Important Notes

1. **stdout vs stderr**: JSON results go to stdout, debug info goes to stderr
2. **Environment variables**: Service fails fast if required vars are missing
3. **Error recovery**: Service tries to continue gracefully when possible
4. **Tracing**: All negotiations are traced in Langfuse for monitoring

## 📞 Getting Help

1. **Read the code comments** - Every function explains what it does
2. **Check stderr output** - Contains detailed debug information  
3. **Look at Langfuse traces** - Shows exactly what happened during negotiation
4. **Test with simple inputs** - Start with minimal data to isolate issues

Remember: This service is designed to be simple and reliable. Don't overthink it!
