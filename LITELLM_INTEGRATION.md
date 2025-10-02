# LiteLLM Integration Guide

## Overview

The negotiation system now supports **100+ AI models** from different providers through LiteLLM integration. You can use models from OpenAI, Anthropic, Google, Groq, Mistral, and many more.

## ✅ What Was Added

1. **LiteLLM v1.77.5** installed and integrated with OpenAI Agents SDK
2. **Automatic provider detection** based on model naming format
3. **Smart API key management** with provider mapping
4. **Backward compatibility** with existing OpenAI-only setup

## 🚀 How to Use Different Models

### Model Naming Format

Use the format: `provider/model-name`

**Examples:**
```
anthropic/claude-3-5-sonnet-20241022
gemini/gemini-2.0-flash-exp
groq/llama-3.3-70b-versatile
mistral/mistral-large-latest
openrouter/meta-llama/llama-3.3-70b-instruct
```

### OpenAI Models (Native)

For OpenAI models, you can use either format:
- `gpt-4o` (backward compatible)
- `openai/gpt-4o` (explicit)

Both use the native OpenAI client for best performance.

## 🔑 API Key Configuration

Add the appropriate API key to your `.env` file:

```bash
# OpenAI (required for default models)
OPENAI_API_KEY=sk-proj-...

# Anthropic / Claude
ANTHROPIC_API_KEY=sk-ant-...

# Google / Gemini
GEMINI_API_KEY=AIza...

# Groq
GROQ_API_KEY=gsk_...

# Cohere
COHERE_API_KEY=...

# Mistral
MISTRAL_API_KEY=...

# OpenRouter (access to many models)
OPENROUTER_API_KEY=sk-or-...

# Together AI
TOGETHER_API_KEY=...

# Replicate
REPLICATE_API_KEY=...

# AWS Bedrock
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Google Vertex AI
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
```

## 📝 Changing Models in Langfuse

1. Go to https://cloud.langfuse.com/prompts
2. Find the `negotiation` prompt
3. Edit the Config section
4. Set the `model` field to your desired model:

**Examples:**

For **Claude 3.5 Sonnet**:
```json
{
  "model": "anthropic/claude-3-5-sonnet-20241022"
}
```

For **Gemini 2.0 Flash**:
```json
{
  "model": "gemini/gemini-2.0-flash-exp"
}
```

For **Llama via Groq**:
```json
{
  "model": "groq/llama-3.3-70b-versatile"
}
```

## 🔍 How It Works

### Model Detection Logic

**Location**: [scripts/run_production_negotiation.py:234-297](scripts/run_production_negotiation.py#L234-L297)

1. **Check for "/" in model name**:
   - If present → Parse as `provider/model`
   - If absent → Assume OpenAI model

2. **Provider-specific handling**:
   - `openai/*` → Use native OpenAI client
   - Any other provider → Use LiteLLM

3. **API key lookup**:
   - Map provider to environment variable
   - Load from `.env` automatically

### Code Example

```python
def _get_model_object(self, model_name: str):
    if "/" in model_name:
        provider, model = model_name.split("/", 1)

        if provider.lower() == "openai":
            return model  # Native OpenAI

        api_key = self._get_provider_api_key(provider)
        return LitellmModel(model=model_name, api_key=api_key)

    return model_name  # Backward compatibility
```

## 🎯 Supported Providers

| Provider | Model Example | Env Variable |
|----------|---------------|--------------|
| **OpenAI** | `gpt-4o` or `openai/gpt-4o` | `OPENAI_API_KEY` |
| **Anthropic** | `anthropic/claude-3-5-sonnet-20241022` | `ANTHROPIC_API_KEY` |
| **Google Gemini** | `gemini/gemini-2.0-flash-exp` | `GEMINI_API_KEY` |
| **Groq** | `groq/llama-3.3-70b-versatile` | `GROQ_API_KEY` |
| **Mistral** | `mistral/mistral-large-latest` | `MISTRAL_API_KEY` |
| **Cohere** | `cohere/command-r-plus` | `COHERE_API_KEY` |
| **OpenRouter** | `openrouter/meta-llama/llama-3.3-70b-instruct` | `OPENROUTER_API_KEY` |
| **Together AI** | `together/meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo` | `TOGETHER_API_KEY` |
| **Replicate** | `replicate/meta/llama-3.3-70b-instruct` | `REPLICATE_API_KEY` |

For the complete list of 100+ supported models, see: https://docs.litellm.ai/docs/providers

## 🧪 Testing Different Models

### Example 1: Using Claude 3.5 Sonnet

```bash
# 1. Add API key to .env
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env

# 2. Update Langfuse prompt config to:
# { "model": "anthropic/claude-3-5-sonnet-20241022" }

# 3. Restart server
npm run dev

# 4. Check logs for:
# DEBUG: Creating agents with model from Langfuse: anthropic/claude-3-5-sonnet-20241022
# DEBUG: Using LiteLLM for anthropic/claude-3-5-sonnet-20241022
# DEBUG: Found API key for anthropic in ANTHROPIC_API_KEY
```

### Example 2: Using Gemini 2.0 Flash

```bash
# 1. Add API key to .env
echo 'GEMINI_API_KEY=AIza...' >> .env

# 2. Update Langfuse prompt config to:
# { "model": "gemini/gemini-2.0-flash-exp" }

# 3. Restart and run simulation
```

### Example 3: Using Groq (Fast & Free Tier Available)

```bash
# 1. Get free API key from console.groq.com
echo 'GROQ_API_KEY=gsk_...' >> .env

# 2. Update Langfuse prompt config to:
# { "model": "groq/llama-3.3-70b-versatile" }

# 3. Enjoy super-fast inference!
```

## 📊 Model Comparison

### Cost Efficiency

| Model | Provider | Speed | Cost | Quality |
|-------|----------|-------|------|---------|
| `gpt-4o-mini` | OpenAI | Fast | $$ | Good |
| `gpt-4o` | OpenAI | Medium | $$$$ | Excellent |
| `claude-3-5-sonnet` | Anthropic | Medium | $$$ | Excellent |
| `gemini-2.0-flash-exp` | Google | Very Fast | $ | Very Good |
| `llama-3.3-70b` (Groq) | Meta | Ultra Fast | $ | Very Good |
| `mistral-large` | Mistral | Fast | $$$ | Excellent |

### Recommended Models

**For Development/Testing:**
- `gemini/gemini-2.0-flash-exp` - Fast and cheap
- `groq/llama-3.3-70b-versatile` - Ultra-fast, generous free tier

**For Production:**
- `gpt-4o` - Reliable, well-tested
- `anthropic/claude-3-5-sonnet-20241022` - Excellent reasoning
- `gemini/gemini-2.0-flash-exp` - Cost-effective at scale

**For Experimentation:**
- `openrouter/*` - Access to many models with one API key
- Mix and match different providers

## 🔧 Troubleshooting

### Issue: "No API key found for provider"

**Symptom**:
```
WARNING: No API key found for anthropic, will try without key
```

**Solution**:
1. Check `.env` has the correct key: `ANTHROPIC_API_KEY=...`
2. Restart server to reload environment variables
3. Verify key name matches provider mapping

### Issue: "Model not supported"

**Symptom**:
```
ERROR: Agent creation failed: Model not found
```

**Solution**:
1. Check model name format: `provider/model-name`
2. Verify provider is supported: https://docs.litellm.ai/docs/providers
3. Ensure API key is valid and has access to that model

### Issue: Rate limits or quotas

**Solution**:
- Use Groq for free high-speed inference
- Use OpenRouter for pay-as-you-go access
- Switch to alternative providers when hitting limits

## 🚦 Log Messages to Look For

**Successful OpenAI (native)**:
```
DEBUG: Creating agents with model from Langfuse: gpt-4o
DEBUG: Using native OpenAI client for gpt-4o
```

**Successful LiteLLM**:
```
DEBUG: Creating agents with model from Langfuse: anthropic/claude-3-5-sonnet-20241022
DEBUG: Using LiteLLM for anthropic/claude-3-5-sonnet-20241022
DEBUG: Found API key for anthropic in ANTHROPIC_API_KEY
```

**Missing API Key**:
```
DEBUG: No API key found in ANTHROPIC_API_KEY for anthropic
WARNING: No API key found for anthropic, will try without key
```

## 📚 Additional Resources

- **LiteLLM Docs**: https://docs.litellm.ai/
- **Supported Models**: https://docs.litellm.ai/docs/providers
- **OpenAI Agents + LiteLLM**: https://openai.github.io/openai-agents-python/models/litellm/
- **Rate Limits**: https://docs.litellm.ai/docs/proxy/users#rate-limiting

## ⚡ Quick Start

1. **Choose a model** from https://docs.litellm.ai/docs/providers
2. **Get API key** for that provider
3. **Add to .env**: `PROVIDER_API_KEY=...`
4. **Update Langfuse**: Set `model` to `provider/model-name`
5. **Restart**: `npm run dev`
6. **Run simulation** and check logs

The system will automatically detect and use the correct provider!
