# Prompt System Fix - Implementation Summary

**Date**: November 18, 2025
**Status**: ✅ IMPLEMENTED

---

## Problems Identified

### 1. Missing Opponent Agent Prompt
- **Issue**: `opponent_agent.md` file was empty (0 bytes)
- **Impact**: Both self and opponent agents used identical prompts (`agents/self_agent`)
- **Result**: No differentiation between your company's strategy and opponent's behavior

### 2. Static Variables Never Updated
- **Issue**: System prompt variables initialized at agent creation with placeholders:
  ```python
  'current_round': "0"
  'previous_rounds': "Noch keine Runden – Start der Simulation."
  'last_round_beliefs_json': "{}"
  ```
- **Impact**: These stayed at round 0 values throughout entire negotiation
- **Result**: Agents had no awareness of:
  - Current round number
  - Conversation history
  - Their own previous beliefs/intentions
  - Opponent's concession patterns

### 3. BDI State Not Fed Back
- **Issue**: Agents produced `bdi_state` with beliefs/intentions but these were never injected back into prompts
- **Impact**: No memory continuity between rounds
- **Result**: Agents couldn't build on their previous strategic thinking or opponent modeling

### 4. Same Message History for Both Agents
- **Issue**: Both agents saw the same conversation but from different perspectives
- **Impact**: No role-specific context (e.g., "your last offer" vs "opponent's last offer")
- **Result**: Confusion about who said what and strategic positioning

---

## Solution Implemented: Dynamic Prompt Reconstruction (Option A)

### Architecture Changes

#### Before (Broken):
```
Agent Creation → Compile Static Prompt → Use Forever
                 (Round 0 placeholders)
```

#### After (Fixed):
```
Agent Creation → Compile Static Prompt (sections 1-6: role, products, dimensions)
                          ↓
Each Round → Extract BDI State → Build Dynamic Variables → Merge → Recompile
            (from previous)      (round N, history)      ↓
                                                    Update Agent Instructions
                                                          ↓
                                                    Execute Round
                                                          ↓
                                                    Restore Original
```

---

## Code Changes

### File: `scripts/run_production_negotiation.py`

#### 1. New Method: `_build_dynamic_prompt_variables()`
**Location**: Line 908-955
**Purpose**: Extract and format per-round state

```python
def _build_dynamic_prompt_variables(self, role: str, results: List, round_num: int):
    """Build DYNAMIC variables that change each round."""
    # Get agent's own previous round data
    my_rounds = [r for r in results if r.get("agent") == role]

    # Extract BDI state from last round
    bdi_state = last_response.get("bdi_state", {})
    last_beliefs = bdi_state.get("beliefs", {})
    last_intentions = bdi_state.get("intentions", "")

    # Build conversation history
    conversation_history = self._format_conversation_history(results)

    # Get opponent's last offer
    opponent_rounds = [r for r in results if r.get("agent") != role]
    opponent_offer = opponent_last.get("offer", {}).get("dimension_values", {})

    return {
        'current_round': str(round_num),
        'previous_rounds': conversation_history,
        'opponent_last_offer': json.dumps(opponent_offer),
        'last_round_beliefs_json': json.dumps(last_beliefs),
        'last_round_intentions': last_intentions,
        'inferred_preferences': self._extract_inferred_preferences(last_beliefs),
        'observed_behaviour': self._extract_observed_behavior(opponent_rounds),
    }
```

**Key Features**:
- ✅ Filters results to get ONLY the agent's own rounds (role-specific)
- ✅ Extracts BDI state (beliefs/intentions) from previous round
- ✅ Formats complete conversation history
- ✅ Analyzes opponent's concession patterns
- ✅ Formats opponent priorities from beliefs

#### 2. New Method: `_format_conversation_history()`
**Location**: Line 957-978
**Purpose**: Build readable history of all past rounds

```python
def _format_conversation_history(self, results: List):
    """Format all past rounds into readable history."""
    history_lines = []
    for r in results:
        round_num = r.get("round", 0)
        agent_role = r.get("agent", "")
        message = response.get("message", "")
        offer = response.get("offer", {}).get("dimension_values", {})

        history_lines.append(f"""
Runde {round_num} - {agent_role}:
  Nachricht: "{message}"
  Angebot: {json.dumps(offer, ensure_ascii=False)}
  Aktion: {action}
""")
```

#### 3. New Method: `_extract_inferred_preferences()`
**Location**: Line 980-994
**Purpose**: Format opponent priorities from belief state

```python
def _extract_inferred_preferences(self, beliefs: Dict):
    """Extract opponent preferences from belief state."""
    opponent_prefs = beliefs.get("opponent_priorities_inferred", {})

    prefs_text = []
    for dim, priority in opponent_prefs.items():
        prefs_text.append(f"- {dim}: {priority}")

    return "\n".join(prefs_text)
```

#### 4. New Method: `_extract_observed_behavior()`
**Location**: Line 996-1027
**Purpose**: Analyze opponent's concession patterns

```python
def _extract_observed_behavior(self, opponent_rounds: List):
    """Extract observed negotiation behavior from opponent's actions."""
    # Check for concessions
    if len(opponent_rounds) >= 2:
        last_offer = opponent_rounds[-1].get("offer", {}).get("dimension_values", {})
        prev_offer = opponent_rounds[-2].get("offer", {}).get("dimension_values", {})

        concessions = []
        for key in last_offer:
            if key in prev_offer and last_val != prev_val:
                concessions.append(f"{key}: {prev_val} → {last_val}")

        if concessions:
            return f"Konzessionen beobachtet: {', '.join(concessions)}"
```

#### 5. New Method: `_update_agent_instructions()`
**Location**: Line 1029-1058
**Purpose**: Recompile prompt with dynamic variables

```python
def _update_agent_instructions(self, role: str, dynamic_vars: Dict):
    """Recompile agent instructions with dynamic variables."""
    # Get static variables
    static_vars = self._build_static_prompt_variables(role)

    # Override with dynamic variables
    merged_vars = {**static_vars, **dynamic_vars}

    # Get the appropriate prompt (self or opponent)
    prompt = self.self_agent_prompt if self._is_self_role(role) else self.opponent_agent_prompt

    # Recompile with merged variables
    compiled_prompt = prompt.compile(**merged_vars)

    return compiled_prompt
```

#### 6. Modified: `_execute_single_round()`
**Location**: Line 1084-1144
**Changes**: Added dynamic prompt update before execution

```python
async def _execute_single_round(self, agent, role, message, round_num, max_rounds,
                                session, results):  # ← Added results parameter
    """Execute a single negotiation round with dynamic prompt update."""
    # DYNAMIC PROMPT UPDATE
    original_instructions = agent.instructions
    try:
        # Build dynamic variables for this round
        dynamic_vars = self._build_dynamic_prompt_variables(role, results, round_num)

        # Update agent instructions with current round context
        updated_instructions = self._update_agent_instructions(role, dynamic_vars)
        agent.instructions = updated_instructions

        logger.debug(f"Updated {role} agent instructions with round {round_num} context")
    except Exception as e:
        logger.warning(f"Failed to update agent instructions: {e}. Using original.")

    # Execute agent
    result = await Runner.run(agent, message, session=session)

    # Restore original instructions
    agent.instructions = original_instructions
```

#### 7. Modified: Call to `_execute_single_round()`
**Location**: Line 978-980
**Changes**: Pass `results` parameter

```python
response_data = await self._execute_single_round(
    agent, role, round_message, round_num, max_rounds, session, results  # ← Added results
)
```

---

## Data Flow (Fixed)

### Round N Flow:

```
1. EXTRACTION (from previous rounds)
   ↓
   _build_dynamic_prompt_variables(role="SELLER", results, round_num=3)
   ├─ Filter results → get SELLER's rounds only
   ├─ Extract round 2 SELLER bdi_state.beliefs → last_round_beliefs_json
   ├─ Extract round 2 SELLER bdi_state.intentions → last_round_intentions
   ├─ Format rounds 1-2 → previous_rounds (conversation history)
   ├─ Get round 2 BUYER message → current_round_message
   ├─ Get round 2 BUYER offer → opponent_last_offer
   ├─ Analyze BUYER rounds 1-2 → observed_behaviour (concessions)
   └─ Format beliefs.opponent_priorities_inferred → inferred_preferences

2. COMPILATION
   ↓
   _update_agent_instructions(role="SELLER", dynamic_vars)
   ├─ Get static_vars (products, dimensions, techniques/tactics)
   ├─ Merge: {**static_vars, **dynamic_vars}
   ├─ Get Langfuse prompt: self_agent_prompt
   └─ Recompile → updated system prompt with round 3 context

3. EXECUTION
   ↓
   agent.instructions = updated_instructions
   result = Runner.run(agent, message, session)
   agent.instructions = original_instructions (restore)

4. OUTPUT
   ↓
   response_data = {
       "message": "...",
       "offer": {"dimension_values": {...}},
       "bdi_state": {
           "beliefs": {"opponent_priorities_inferred": {...}},
           "intentions": "Next round strategy..."
       },
       "internal_analysis": "..."
   }

5. STORAGE
   ↓
   results.append({"round": 3, "agent": "SELLER", "response": response_data})
   ↓
   [Round 4 will extract this bdi_state and inject it back]
```

---

## Prompt Template Variables (Now Correctly Populated)

### Static Variables (Set once at agent creation):
- ✅ `agent_role`, `company`, `role_objectives`
- ✅ `negotiation_title`, `negotiation_type`, `relationship_type`
- ✅ `products_info`, `dimension_details`, `dimension_schema`
- ✅ `technique_name`, `technique_description`, `technique_application`
- ✅ `tactic_name`, `tactic_description`, `tactic_application`
- ✅ `counterpart_company`, `counterpart_attitude`, `power_balance`

### Dynamic Variables (Updated each round):
- ✅ `current_round` - NOW shows 1, 2, 3... instead of always 0
- ✅ `max_rounds` - Correctly shows configured max
- ✅ `previous_rounds` - NOW contains full formatted conversation history
- ✅ `current_round_message` - Opponent's actual last message
- ✅ `opponent_last_offer` - Opponent's actual dimension values
- ✅ `last_round_beliefs_json` - YOUR previous beliefs (extracted from bdi_state)
- ✅ `last_round_intentions` - YOUR previous intentions (extracted from bdi_state)
- ✅ `inferred_preferences` - Formatted opponent priorities
- ✅ `observed_behaviour` - Analyzed concession patterns

---

## Agent Differentiation (Self vs Opponent)

### Self Agent (`agents/self_agent` in Langfuse):
- ✅ Full access to your company's techniques and tactics
- ✅ Detailed BDI model with beliefs/desires/intentions
- ✅ Complete market intelligence
- ✅ Sophisticated move library (10+ techniques)
- ✅ Deep strategic analysis and internal reasoning

### Opponent Agent (`agents/opponent_agent` in Langfuse):
- ✅ Uses existing Langfuse prompt (already configured)
- ✅ Limited to counterpart's personality (dominance/affiliation)
- ✅ Generic negotiation principles
- ✅ Simplified behavior model
- ✅ Information limited to "known" flags

**Note**: The opponent agent prompt already exists in Langfuse. The code now correctly loads it via:
```python
self.opponent_agent_prompt = self.langfuse.get_prompt('agents/opponent_agent')
```

---

## Testing Checklist

### ✅ Verify Round Numbers Update
1. Run a negotiation
2. Check Langfuse trace for round 2+
3. Confirm `<round_count>2/6</round_count>` (not `0/6`)

### ✅ Verify Conversation History Accumulates
1. Check Langfuse trace for round 3
2. Confirm `<previous_rounds>` contains rounds 1-2 formatted text
3. Verify both BUYER and SELLER messages are included

### ✅ Verify BDI State Feeds Back
1. Check round 1 output: `bdi_state.beliefs` contains opponent_priorities_inferred
2. Check round 2 system prompt: `<previous_internal_state>` contains round 1 beliefs JSON
3. Confirm agent can reference its own previous beliefs

### ✅ Verify Opponent Modeling
1. Check round 2+ traces
2. Confirm `<opponent_analysis>` → `inferred_preferences` shows extracted priorities
3. Confirm `observed_behaviour` shows concession analysis (e.g., "Price: 1.20 → 1.15")

### ✅ Verify Agent Differentiation
1. Check SELLER rounds use `agents/self_agent` prompt
2. Check BUYER rounds use `agents/opponent_agent` prompt
3. Confirm technique/tactic only in self agent's prompt

---

## Expected Langfuse Trace (Round 2 Example)

```
System Prompt (SELLER, Round 2):

# ROLE
Sie sind ein professioneller Verhandlungsführer mit über 20 Jahren Erfahrung...

## INPUT STATE
### OBSERVATIONS AND CONVERSATION HISTORY
<round_count>2/6</round_count>  ✅ NOW SHOWS CORRECT ROUND

<conversation_history>
Vollständiger Verlauf aller bisherigen Angebote und Nachrichten:
Runde 1 - BUYER:  ✅ NOW SHOWS HISTORY
  Nachricht: "Ich würde gerne mit einem ersten Angebot beginnen..."
  Angebot: {"pombar100g": 1.05, "Lieferzeit": 2.5}
  Aktion: continue

Letztzer Move des Gegners:
- Die aktuelle Nachricht der Gegenseite: "Ich würde gerne mit einem ersten..."  ✅ ACTUAL MESSAGE
- Strukturiertes letztes Angebot: {"pombar100g": 1.05, "Lieferzeit": 2.5}  ✅ ACTUAL OFFER
</conversation_history>

<previous_internal_state>
{"opponent_priorities_inferred": {"pombar100g": "high", "Lieferzeit": "medium"}, ...}  ✅ YOUR ROUND 1 BELIEFS
</previous_internal_state>

<opponent_analysis>
Hypothesen über den Gegner:
- inferrierte Präferenzen:
  - pombar100g: high  ✅ EXTRACTED FROM BELIEFS
  - Lieferzeit: medium
- Verhalten & Verhandlungsstil: Konzessionen beobachtet: pombar100g: 1.10 → 1.05  ✅ CONCESSION ANALYSIS
</opponent_analysis>
```

---

## Benefits of This Implementation

### 1. Memory Continuity
- ✅ Agent remembers what it believed and intended in previous rounds
- ✅ Can build on previous strategic thinking
- ✅ Avoids contradicting itself

### 2. Opponent Modeling
- ✅ Agent builds understanding of opponent's priorities over time
- ✅ Tracks concession patterns
- ✅ Infers emotional state and urgency

### 3. Strategic Adaptation
- ✅ Agent can adjust strategy based on observed behavior
- ✅ Recognizes when opponent is approaching limits
- ✅ Makes more informed walk-away decisions

### 4. Context Awareness
- ✅ Agent knows what round it's in
- ✅ Can reference previous offers and messages
- ✅ Understands negotiation history and momentum

### 5. Role Differentiation
- ✅ Self agent uses detailed techniques/tactics
- ✅ Opponent agent uses personality-based behavior
- ✅ Proper information asymmetry

---

## Maintenance Notes

### Langfuse Prompts
Both prompts must be maintained in Langfuse:
- `agents/self_agent` - Your company's agent
- `agents/opponent_agent` - Counterpart's agent

**Key variable names** (must match in both prompts):
- `{{current_round}}`, `{{max_rounds}}`
- `{{previous_rounds}}`, `{{current_round_message}}`
- `{{opponent_last_offer}}`
- `{{last_round_beliefs_json}}`, `{{last_round_intentions}}`
- `{{inferred_preferences}}`, `{{observed_behaviour}}`

### Adding New Dynamic Variables
To add a new per-round variable:

1. Add to `_build_dynamic_prompt_variables()` return dict
2. Update prompt templates in Langfuse with `{{new_variable}}`
3. Test in Langfuse trace to verify injection

### Performance Considerations
- Prompt recompilation happens once per round (negligible overhead)
- Original instructions restored after each round (clean state)
- BDI extraction uses dict operations (fast)
- Conversation history formatted as string (O(n) where n = rounds)

---

## Files Modified

1. ✅ `scripts/run_production_negotiation.py`
   - Added 5 new methods
   - Modified 2 existing methods
   - ~150 lines of new code

2. ✅ `DATA_FLOW_OVERVIEW.md`
   - Updated section 3.2 (Dynamic Per-Round Variables)
   - Updated section 3.3 (BDI State Extraction)
   - Added flow diagram

3. ✅ `docs/DATA_MODEL_SPECIFICATION.md`
   - Added "BDI State Flow" section
   - Documented feedback mechanism
   - Added conversation_log schema with bdi_state

4. 📄 `PROMPT_FIX_SUMMARY.md` (this file)
   - Complete implementation documentation

---

## Next Steps

### Immediate:
1. ✅ Code implementation complete
2. ✅ Documentation updated
3. ⏳ Run test negotiation to verify
4. ⏳ Check Langfuse traces for correct variable injection

### Future Enhancements:
- Add more sophisticated opponent modeling metrics
- Track belief accuracy over time
- Add ZOPA estimation to beliefs
- Implement learning from past negotiations
- Add personality adaptation based on observed style

---

## Questions or Issues?

If you encounter issues:
1. Check Langfuse trace for the specific round
2. Verify variable values in system prompt
3. Check Python logs for "Updated {role} agent instructions with round X context"
4. Ensure both `agents/self_agent` and `agents/opponent_agent` prompts exist in Langfuse
5. Verify prompt templates have correct variable names (match the return dict keys)

---

**Status**: Implementation complete. Ready for testing.
