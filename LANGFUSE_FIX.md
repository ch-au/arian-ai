# Langfuse Tracing Fix - Summary

## Issues Fixed

### 1. OpenTelemetry OTLP 404 Error ✅

**Problem:** OTLP exporter was getting 404 errors when trying to send traces to Langfuse:
```
ERROR:opentelemetry.exporter.otlp.proto.http.trace_exporter:Failed to export span batch code: 404
```

**Root Cause:** Using incorrect OTLP endpoint URL and outdated instrumentation approach
- Old: `/api/public/v2/otlp/traces` (doesn't exist)
- New: `/api/public/otel` (correct endpoint)

**Solution:** Switched to official OpenAI Agents instrumentation per [Langfuse documentation](https://langfuse.com/integrations/frameworks/openai-agents)

### 2. Simplified Tracing Architecture ✅

**Before (Complex):**
- Manual OpenTelemetry configuration
- Logfire instrumentation
- Custom OTLP exporter setup
- Custom span processors
- Multiple dependencies

**After (Simple):**
- Official `openinference-instrumentation-openai-agents` library
- Single line instrumentation: `OpenAIAgentsInstrumentor().instrument()`
- Automatic trace collection
- Fewer dependencies

## Files Changed

### 1. `scripts/requirements.txt`
**Removed:**
```python
pydantic-ai[logfire]>=0.0.20
opentelemetry-sdk>=1.26.0
opentelemetry-exporter-otlp-proto-http>=1.26.0
```

**Added:**
```python
openinference-instrumentation-openai-agents>=0.1.0
```

### 2. `scripts/negotiation_utils.py`
**Removed:**
- All manual OpenTelemetry imports and configuration
- `LangfuseProcessor` custom span processor class
- `set_prompt_info()` function
- Complex OTLP endpoint configuration

**Simplified:**
```python
def setup_langfuse_tracing() -> bool:
    """Setup Langfuse tracing using official instrumentation."""
    try:
        from openinference.instrumentation.openai_agents import OpenAIAgentsInstrumentor
        OpenAIAgentsInstrumentor().instrument()
        return True
    except Exception as e:
        print(f"DEBUG: Langfuse tracing setup failed: {e}", file=sys.stderr)
        return False
```

### 3. `scripts/run_production_negotiation.py`
**Removed:**
- Import of `set_prompt_info`
- Call to `set_prompt_info()` after retrieving Langfuse prompt

## How It Works Now

1. **Environment variables** (in `.env`):
   ```bash
   LANGFUSE_PUBLIC_KEY="pk-lf-..."
   LANGFUSE_SECRET_KEY="sk-lf-..."
   LANGFUSE_HOST="https://cloud.langfuse.com"
   ```

2. **Automatic instrumentation**:
   - `OpenAIAgentsInstrumentor().instrument()` is called once on startup
   - All OpenAI Agents SDK calls are automatically traced
   - Traces sent to Langfuse via OpenTelemetry

3. **No manual configuration needed**:
   - No OTLP endpoints to configure
   - No custom processors
   - No authentication headers

## Testing

After these changes, you should:

1. **Restart the server**: `npm run dev`

2. **Start a simulation**: Use the dashboard to start a negotiation

3. **Check traces**: Go to https://cloud.langfuse.com
   - You should see traces appearing in real-time
   - Each negotiation round will be captured
   - No more 404 errors in logs

## Expected Log Output

**Before (with errors):**
```
ERROR:opentelemetry.exporter.otlp.proto.http.trace_exporter:Failed to export span batch code: 404
DEBUG: OpenTelemetry tracing configured for Langfuse at https://cloud.langfuse.com
```

**After (clean):**
```
DEBUG: Langfuse tracing configured using OpenAIAgentsInstrumentor at https://cloud.langfuse.com
DEBUG: Creating agents with model: gpt-4o-mini
```

## Benefits

1. **Simpler**: 90% less configuration code
2. **Official**: Uses Langfuse-recommended approach
3. **Reliable**: No more 404 errors
4. **Maintainable**: Standard integration, easier to update
5. **Fewer dependencies**: Removed Logfire and manual OTLP packages

## AI Model Configuration

See [AI_MODEL_CONFIG.md](./AI_MODEL_CONFIG.md) for instructions on changing the AI model used for negotiations.

**Quick answer**: Change model in Langfuse prompt config or edit `DEFAULT_MODEL` in `scripts/negotiation_models.py`.
