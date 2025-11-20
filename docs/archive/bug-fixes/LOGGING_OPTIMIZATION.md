# Logging Optimization - Python Negotiation Service

## Overview
Optimized logging structure in `scripts/run_production_negotiation.py` for better clarity and production use.

## Log Levels

### INFO (Default for Production)
Shows high-level workflow and progress:
- Service initialization steps
- Agent role assignments
- Round-by-round progress (`Round X/Y: BUYER (USER) turn`)
- Negotiation outcomes and completion
- Extensions and terminations

**Example INFO output:**
```
10:30:15 [INFO] === Starting Negotiation Service ===
10:30:15 [INFO] Initializing services (Langfuse, prompts)
10:30:16 [INFO] Services initialized successfully
10:30:16 [INFO] Creating AI agents
10:30:16 [INFO] Agent roles: USER=SELLER, OPPONENT=BUYER (counterpart=buyer)
10:30:16 [INFO] Starting negotiation rounds
10:30:16 [INFO] Max rounds: 6, Session: production_123
10:30:17 [INFO] Round 1/6: SELLER (USER) turn
10:30:20 [INFO] Round 2/6: BUYER (OPPONENT) turn
10:30:23 [INFO] Round 3/6: SELLER (USER) turn
10:30:26 [INFO] Negotiation ended: DEAL_ACCEPTED (action=accept)
10:30:26 [INFO] Outcome: DEAL_ACCEPTED, Total rounds: 3
10:30:26 [INFO] === Negotiation Complete ===
```

### DEBUG (For Troubleshooting)
Shows detailed internal operations:
- Langfuse prompt loading and compilation
- Model configuration selection
- Static/dynamic variable building
- Price adjustment calculations
- Response parsing and normalization
- Instruction updates per round
- Response times

**Example DEBUG output:**
```
10:30:16 [DEBUG] Loaded self prompt: agents/self_agent v12
10:30:16 [DEBUG] Loaded opponent prompt: agents/opponent_agent v8
10:30:16 [DEBUG] Using model from Langfuse config: gemini/gemini-flash-lite-latest
10:30:16 [DEBUG] Using JSON mode for Gemini model: gemini/gemini-flash-lite-latest
10:30:16 [DEBUG] Building static variables: role=SELLER, use_self_prompt=True
10:30:16 [DEBUG] Applying opponent price adjustment (distance=60)
10:30:16 [DEBUG] Price adjusted: 100.00 → 82.00 (dist=60, dev=18.0%, BUYER)
10:30:17 [DEBUG] SELLER response time: 3.24s
```

## Configuration

### Via Environment Variable
Set `PYTHON_LOG_LEVEL` in your `.env` file:
```bash
# Production (default)
PYTHON_LOG_LEVEL=INFO

# Development/Debugging
PYTHON_LOG_LEVEL=DEBUG
```

### Via npm Scripts
```bash
# Normal development (INFO level)
npm run dev

# Debug mode with detailed logs
npm run dev:debug
```

## Key Improvements

1. **Structured Format**: Simplified timestamp format (`HH:MM:SS`) and consistent message structure
2. **Clear Hierarchy**: INFO shows workflow, DEBUG shows implementation details
3. **Round Progress**: Clear visibility of current round, max rounds, and turn order
4. **Role Clarity**: Explicit USER vs OPPONENT labeling in round logs
5. **Outcome Tracking**: Clear start/end markers and outcome reporting
6. **Performance**: Response times visible at DEBUG level
7. **Configurable**: Easy to switch between INFO and DEBUG via environment variable

## What's Logged at Each Level

### INFO Logs
- ✓ Service initialization stages
- ✓ Role assignments (USER/OPPONENT)
- ✓ Round progress (Round X/Y: ROLE turn)
- ✓ Negotiation outcomes and termination
- ✓ Round extensions
- ✓ Final results

### DEBUG Logs (Additional)
- ✓ Prompt loading (name, version)
- ✓ Model selection logic
- ✓ Variable compilation details
- ✓ Price adjustment calculations
- ✓ Response parsing steps
- ✓ Instruction updates per round
- ✓ Response times
- ✓ Langfuse tracing status

## Production Best Practices

1. **Use INFO in production** - Shows essential progress without noise
2. **Use DEBUG for troubleshooting** - When investigating specific issues
3. **Monitor stderr** - All logs go to stderr, stdout is reserved for JSON results
4. **Check .env** - Ensure `PYTHON_LOG_LEVEL` is set appropriately for your environment
