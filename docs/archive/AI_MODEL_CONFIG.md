# AI Model Configuration Guide

## Where to Change the AI Model

The AI model used for negotiations is configured in the **Langfuse prompt template**, with a fallback to the default model in the code.

**🎉 NEW: Now supports 100+ models via LiteLLM!** See [LITELLM_INTEGRATION.md](LITELLM_INTEGRATION.md) for details.

### Method 1: Via Langfuse Prompt (Recommended)

1. Go to your Langfuse dashboard: https://cloud.langfuse.com
2. Navigate to **Prompts** → find the prompt named `negotiation`
3. Edit the prompt and update the `model` field in the **Config** section

#### OpenAI Models (Native)
- `gpt-4o` - Most capable, higher cost
- `gpt-4o-mini` - Faster, lower cost (recommended for testing)
- `gpt-4-turbo` - Previous generation
- `gpt-3.5-turbo` - Cheapest, less capable
- `o1` - Reasoning model (slower, very capable)

#### Other Providers (via LiteLLM)
**Anthropic:**
- `anthropic/claude-3-5-sonnet-20241022` - Excellent reasoning
- `anthropic/claude-3-5-haiku-20241022` - Fast and cheap

**Google Gemini:**
- `gemini/gemini-2.0-flash-exp` - Very fast, cost-effective
- `gemini/gemini-1.5-pro` - High capability

**Groq (Ultra-fast, free tier):**
- `groq/llama-3.3-70b-versatile` - Fast Llama 3.3
- `groq/mixtral-8x7b-32768` - Fast Mixtral

**Mistral:**
- `mistral/mistral-large-latest` - Excellent quality
- `mistral/mistral-small-latest` - Cost-effective

**See full list:** [LITELLM_INTEGRATION.md](LITELLM_INTEGRATION.md#-supported-providers)

### Method 2: Add API Keys for Other Providers

To use non-OpenAI models, add the appropriate API key to `.env`:

```bash
# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini
GEMINI_API_KEY=AIza...

# Groq (free tier available!)
GROQ_API_KEY=gsk_...

# Mistral
MISTRAL_API_KEY=...

# OpenRouter (access many models with one key)
OPENROUTER_API_KEY=sk-or-...
```

Then restart the server: `npm run dev`

### Method 3: Change Default Model in Code

To change the fallback model, edit `scripts/negotiation_models.py`:

```python
DEFAULT_MODEL = "gpt-4o"  # Change this
```

### Current Model Selection Logic

From `run_production_negotiation.py:198-206`:

```python
# Get model configuration from Langfuse prompt
model_config = getattr(self.langfuse_prompt, 'config', {})
model_name = model_config.get('model', NegotiationConfig.DEFAULT_MODEL)

# Fix invalid model names
if model_name == 'gpt-5-mini':
    model_name = 'gpt-4o-mini'

print(f"DEBUG: Creating agents with model: {model_name}", file=sys.stderr)
```

### How to Verify Current Model

Check the server logs when a simulation starts. You'll see:
```
DEBUG: Creating agents with model: gpt-4o-mini
```

### Model Costs (Approximate)

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|---------------------|----------------------|
| gpt-4o | $2.50 | $10.00 |
| gpt-4o-mini | $0.15 | $0.60 |
| gpt-4-turbo | $10.00 | $30.00 |
| gpt-3.5-turbo | $0.50 | $1.50 |

**Recommendation:** Use `gpt-4o-mini` for development/testing, `gpt-4o` for production.

## Quick Change Instructions

**To change model to gpt-4o:**

1. Open Langfuse: https://cloud.langfuse.com/prompts
2. Edit the `negotiation` prompt
3. In the Config section, set: `"model": "gpt-4o"`
4. Save and create a new version
5. No server restart needed - next simulation will use the new model

**To change model in code (fallback):**

```bash
# Edit the negotiation models file
nano scripts/negotiation_models.py

# Find DEFAULT_MODEL and change it:
DEFAULT_MODEL = "gpt-4o-mini"  # Change this value

# Save and restart server
npm run dev
```
