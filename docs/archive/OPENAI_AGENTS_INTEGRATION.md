# OpenAI Agents Integration Guide (Legacy Reference)

> **Note:** This document references the pre-2025 schema (tables such as `negotiation_dimensions`, `negotiation_contexts`). It is kept for historical context only; do not rely on it for current implementation details.

## Overview

This document outlines the production-ready integration of OpenAI Agents with Langfuse for structured multi-turn negotiation simulations.

## Architecture

### Core Components

1. **ProductionNegotiationEngine** - Main orchestrator
2. **Langfuse Integration** - Prompt management and observability
3. **Structured Outputs** - Guaranteed JSON parsing
4. **Clean Message Filtering** - Prevents internal reasoning leakage

### Key Files

- `docs/archive/negotiation-engine-production.ts` - Production engine reference
- `test_langfuse_fixed.py` - Working implementation example
- `.env` - Required environment variables

## Environment Configuration

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-...

# Langfuse Configuration  
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com
```

## Langfuse Template Setup

### Template Name: `negotiation`

The Langfuse template must be configured as a **chat template** with the following structure:

```json
[
  {
    "role": "system",
    "content": "# ROLE\nyou are an expert negotiation agent representing the {{role_perspective}}...\n\n[FULL TEMPLATE WITH 42 VARIABLES]"
  }
]
```

### Required Template Variables (42 total)

**Core Context:**
- `role_perspective` - BUYER/SELLER
- `agent_role` - Agent role identifier  
- `negotiation_title` - Negotiation name
- `negotiation_type` - one-shot/multi-year
- `relationship_type` - first-time/long-standing
- `product_description` - What's being negotiated
- `additional_comments` - Extra context

**Personality (7 variables):**
- `personality_traits` - Big 5 scores
- `personality_type_name` - Type identifier
- `personality_type_description` - Detailed description
- `personality_instructions` - Behavioral guidance
- `personality_characteristics` - Core traits

**Negotiation Technique (6 variables):**
- `technique_name` - Technique identifier
- `technique_description` - Full description
- `technique_aspects` - Key implementation aspects
- `technique_examples` - Practical examples
- `technique_psychological_basis` - Why it works
- `technique_effectiveness_conditions` - When to use

**Negotiation Tactic (7 variables):**
- `tactic_name` - Tactic identifier
- `tactic_category` - Classification
- `tactic_description` - Full description
- `tactic_when_to_use` - Timing guidance
- `tactic_key_phrases` - Language patterns
- `tactic_advantages` - Benefits
- `tactic_risks` - Potential downsides

**ZOPA & Strategy (5 variables):**
- `zopa_boundaries` - Negotiation boundaries
- `reservation_point` - Walk-away point
- `preferred_range` - Optimal outcome zone
- `concession_strategy` - How to make concessions

**Objectives (3 variables):**
- `role_objectives` - Primary goals
- `primary_success_metric` - Main KPI
- `secondary_success_metrics` - Additional KPIs

**Strategic Analysis (4 variables):**
- `dimension_priority_matrix` - Priority rankings
- `market_position` - Competitive context
- `counterpart_analysis` - Opponent assessment
- `batna_assessment` - Alternative options

## Usage Pattern

### 1. Basic Integration

```typescript
import { runProductionNegotiation } from './server/services/negotiation-engine-production';

const result = await runProductionNegotiation(
  negotiationId,
  simulationRunId,
  {
    maxRounds: 6,
    langfuseConfig: {
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
      host: process.env.LANGFUSE_HOST
    }
  }
);
```

### 2. Result Structure

```typescript
interface NegotiationResult {
  outcome: 'DEAL_ACCEPTED' | 'TERMINATED' | 'MAX_ROUNDS_REACHED';
  totalRounds: number;
  finalOffer?: NegotiationOffer;
  conversationLog: Array<{
    round: number;
    agent: string;
    response: NegotiationResponse;
  }>;
  langfuseTraceId?: string;
}
```

### 3. Structured Response Format

Every agent response follows this exact schema:

```typescript
interface NegotiationResponse {
  message: string;                    // Public message to counterpart
  action: 'continue' | 'accept' | 'terminate';
  offer: {
    dimension_values: Record<string, any>;  // Actual offer values
    confidence: number;               // 0.0 to 1.0
    reasoning: string;                // Brief explanation
  };
  internal_analysis: string;          // Private strategic thinking
}
```

## Key Implementation Patterns

### 1. Agent Creation

```typescript
const agent = new Agent({
  name: 'Production Buyer Agent',
  instructions: completeInstructions  // FULL Langfuse template with ALL variables substituted
});
```

### 2. Memory Management

```typescript
const session = new SQLiteSession(`production_${negotiationId}`);
const result = await Runner.run(agent, message, { session });
```

### 3. Clean Message Filtering

```typescript
// Extract ONLY public information for next agent
const publicMessage = response.message;
const offerInfo = response.offer?.dimension_values;

// NEVER pass internal_analysis, confidence, or reasoning
const nextMessage = `Round ${round + 1} - You are the ${nextRole}.

The ${role} just said: "${publicMessage}"

${offerInfo ? `Their offer: ${JSON.stringify(offerInfo)}` : 'No specific offer made.'}

Make your negotiation response using your complete strategy.`;
```

### 4. Structured Output Parsing

```typescript
let response: NegotiationResponse;
try {
  if (result.final_output.trim().startsWith('{')) {
    response = JSON.parse(result.final_output.trim());
  } else {
    // Handle markdown code blocks
    const jsonMatch = result.final_output.match(/```(?:json)?\s*(\{.*?\})\s*```/s);
    if (jsonMatch) {
      response = JSON.parse(jsonMatch[1]);
    } else {
      // Fallback for parse errors
      response = fallbackResponse;
    }
  }
} catch (parseError) {
  response = fallbackResponse;
}
```

## Database Integration

### Required Tables

- `negotiations` - Core negotiation data
- `negotiation_dimensions` - Flexible dimension system
- `simulation_runs` - Individual simulation tracking
- `influencing_techniques` - Available techniques
- `negotiation_tactics` - Available tactics
- `personality_types` - Personality configurations

### Data Flow

1. Fetch negotiation data with dimensions
2. Load technique/tactic from simulation run
3. Inject all variables into Langfuse template  
4. Create agents with complete instructions
5. Run multi-turn negotiation
6. Store results in simulation_runs table

## Langfuse Observability

### Trace Structure

```
negotiation_trace
├── round_1_buyer
├── round_2_seller  
├── round_3_buyer
└── final_outcome
```

### Metadata Tracking

- Complete template usage verification
- Structured output success rates
- Clean message filtering confirmation
- Performance metrics

## Testing

### Verification Test

```bash
# Test complete integration (working example)
python test_langfuse_fixed.py
```

This single test file demonstrates all key functionality:
- Complete Langfuse template integration
- Structured JSON outputs with clean message filtering  
- Multi-turn negotiation with proper agent alternation
- Database integration patterns

### Key Validation Points

- ✅ Agents use complete Langfuse template (7400+ chars)
- ✅ All 42 template variables properly substituted
- ✅ Structured JSON responses parse correctly
- ✅ Internal analysis hidden from counterpart
- ✅ Langfuse traces capture complete interaction

## Performance Considerations

### Memory Usage
- SQLiteSession handles conversation memory automatically
- No manual memory injection required
- Session cleanup after negotiation completion

### API Costs
- Average 4-6 rounds per negotiation
- ~2000 tokens per agent response
- Estimate ~$0.10-0.50 per negotiation (GPT-4)

### Concurrency
- Each negotiation uses separate SQLiteSession
- Multiple negotiations can run in parallel
- Database transactions ensure consistency

## Common Issues & Solutions

### Issue 1: Template Variables Not Substituted
**Problem:** Agents behave generically, not using specific techniques/tactics
**Solution:** Verify all 42 variables are mapped and {{placeholders}} replaced

### Issue 2: Internal Analysis Leakage  
**Problem:** Agents see each other's private reasoning
**Solution:** Only pass `message` and `offer.dimension_values` to next agent

### Issue 3: JSON Parsing Failures
**Problem:** Agents return markdown-wrapped JSON
**Solution:** Use structured output parsing with fallback handling

### Issue 4: Langfuse Traces Missing Data
**Problem:** System instructions not visible in traces
**Solution:** Normal behavior - instructions set once during Agent creation

## Next Steps Integration

For **Task 2.3** (Agent Selection UI), implement:

1. Technique/tactic selection interface
2. Personality configuration UI  
3. Preview of total simulation runs
4. Integration with `ProductionNegotiationEngine`

The engine is ready for production use with the main application.
