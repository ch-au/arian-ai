# Prompt Alignment with Pydantic Schema

## ✅ What Was Fixed

The prompt instructions now **exactly match** the Pydantic `NegotiationResponse` schema, and agents now have **memory continuity** via `internal_analysis` feedback.

## 🔄 Memory Continuity - Internal Analysis Feedback Loop

### The Problem
Previously, agents didn't receive their own `internal_analysis` from previous rounds. This meant:
- ❌ No strategic continuity between rounds
- ❌ Agents couldn't build on their own thinking
- ❌ Lost context of their own analysis

### The Solution
Agents now receive their **last internal analysis** in each new round:

**Location**: [scripts/run_production_negotiation.py:421-485](scripts/run_production_negotiation.py#L421-L485)

```python
# Get YOUR OWN last internal analysis for continuity
my_rounds = [r for r in results if r.get("agent") == role]
if my_rounds:
    last_my_round = my_rounds[-1]
    my_last_internal = last_my_round.get("response", {}).get("internal_analysis", "")
    my_last_action = last_my_round.get("response", {}).get("action", "continue")
```

### What Agents Now See Each Round

**Round 1 (Buyer)**:
```
Gegenangebot der Gegenseite:
"Dies ist die erste Runde der Verhandlung."

Angebotswerte der Gegenseite: Noch kein konkretes Angebot

Verhandlungsfortschritt: Ihre letzten Aktionen: Erste Runde. Gesamtrunden bisher: 0
```

**Round 3 (Buyer - after Round 1)**:
```
Gegenangebot der Gegenseite:
"[Seller's message from Round 2]"

Angebotswerte der Gegenseite: {"Price": 15000, "Delivery": 20, ...}

Ihre letzte interne Analyse (zur Erinnerung):
"Der Verkäufer startet mit einem hohen Preis. Ich sollte mit einem niedrigen Gegenangebot reagieren,
aber nicht zu aggressiv, um die Beziehung nicht zu gefährden. Mein BATNA ist gut, ich habe Verhandlungsspielraum."

Ihre letzte Aktion: continue

Verhandlungsfortschritt: Ihre letzten Aktionen: continue. Gesamtrunden bisher: 2
```

### Benefits

✅ **Strategic Continuity**: Agents remember their own analysis
✅ **Better Reasoning**: Build on previous thoughts
✅ **Consistent Strategy**: Avoid contradicting previous positions
✅ **Learning**: Adjust based on what worked before

## 📋 Prompt Structure Alignment

### Section 8: Response Format

The prompt now shows the **exact JSON structure** that matches the Pydantic schema:

**Location**: [scripts/run_production_negotiation.py:542-573](scripts/run_production_negotiation.py#L542-L573)

#### Before (Vague)
```
- **internal_analysis**: Ihre private Einschätzung der Verhandlung
```

#### After (Clear with Memory Context)
```json
{
  "message": "Ihre professionelle Nachricht...",
  "action": "continue|accept|terminate|walk_away|pause",
  "offer": {
    "dimension_values": { "Price": 0, "Delivery": 0 },
    "confidence": 0.0-1.0,
    "reasoning": "Kurze Begründung Ihrer Angebotslogik"
  },
  "internal_analysis": "Ihre private strategische Einschätzung - wird in der nächsten Runde an Sie zurückgegeben zur Kontinuität",
  "batna_assessment": 0.0-1.0,
  "walk_away_threshold": 0.0-1.0
}
```

### Field Descriptions Added

The prompt now explains **what each field means and how it's used**:

```
### Wichtige Hinweise:
- **message**: Öffentliche Nachricht, sichtbar für die Gegenseite
- **action**: Ihre strategische Entscheidung für diese Runde
- **offer.dimension_values**: Numerische Werte für alle Dimensionen (innerhalb Min/Max)
- **offer.confidence**: Wie sicher sind Sie bei diesem Angebot?
- **offer.reasoning**: Private Begründung für Ihr Angebot
- **internal_analysis**: KRITISCH - Ihre strategischen Gedanken, die Sie in der nächsten Runde wieder sehen werden
- **batna_assessment**: Wie gut sind Ihre Alternativen außerhalb dieser Verhandlung?
- **walk_away_threshold**: Unter welchem BATNA-Level würden Sie abbrechen?
```

### New Requirement Added

```
- Nutzen Sie internal_analysis als Ihr strategisches Gedächtnis
```

This explicitly tells agents to **use internal_analysis** as a strategic thinking tool.

## 🧠 How Internal Analysis Works

### Example Negotiation Flow

**Round 1 - Buyer's internal_analysis**:
```
"Der Verkäufer fordert 15000€ - deutlich über meinem Target von 12000€.
Ich werde mit 11000€ kontern, um Verhandlungsspielraum zu schaffen.
Meine Priorität ist der Preis (Priorität 1), Lieferzeit ist flexibel."
```

**Round 2 - Seller responds**
(Buyer doesn't see this analysis)

**Round 3 - Buyer receives**:
```
Ihre letzte interne Analyse (zur Erinnerung):
"Der Verkäufer fordert 15000€ - deutlich über meinem Target von 12000€.
Ich werde mit 11000€ kontern, um Verhandlungsspielraum zu schaffen..."

Gegenangebot der Gegenseite:
"Ich kann Ihnen 13500€ anbieten..."
```

**Round 3 - Buyer's new internal_analysis**:
```
"Gut! Der Verkäufer ist von 15000€ auf 13500€ gegangen - zeigt Verhandlungsbereitschaft.
Basierend auf meiner letzten Analyse bleibe ich konsequent: Ich erhöhe auf 11500€.
Das zeigt Bewegung, hält aber Druck aufrecht. Mein BATNA ist stark."
```

### Benefits in Practice

1. **Consistency**: "Basierend auf meiner letzten Analyse..." - explicit continuity
2. **Learning**: Agents see what worked/didn't work
3. **Strategy**: Can plan multi-round strategies
4. **Memory**: Don't forget previous reasoning

## 🔍 Code Changes Summary

### 1. Round Message Builder
**File**: [scripts/run_production_negotiation.py:421-485](scripts/run_production_negotiation.py#L421-L485)

**What Changed**:
- Extracts `internal_analysis` from agent's last round
- Includes it in the next round's context message
- Shows agent their last action for reference

### 2. Static Prompt (Section 8)
**File**: [scripts/run_production_negotiation.py:542-573](scripts/run_production_negotiation.py#L542-L573)

**What Changed**:
- Shows exact JSON structure matching Pydantic
- Explains each field's purpose
- Highlights `internal_analysis` as strategic memory
- Adds explicit instruction to use it

## 📊 Expected Improvements

### Before
```
Round 1 Buyer: "I'll offer 11000€"
Round 3 Buyer: "How about 11500€?" (no reference to previous thinking)
Round 5 Buyer: "Maybe 12000€?" (inconsistent with earlier strategy)
```

### After
```
Round 1 Buyer: "I'll offer 11000€"
internal_analysis: "Starting low but reasonable. Target is 12000€. Will increase by 500€ if they move."

Round 3 Buyer: "Based on their movement, I'll go to 11500€ as planned"
internal_analysis: "My strategy is working - they dropped 1500€. I'll stick to my 500€ increments. Next round: 12000€ if they reach 13000€."

Round 5 Buyer: "As anticipated, I'll meet at 12000€ - my target"
internal_analysis: "Perfect execution of my planned strategy. This is my target, I should accept if they agree."
```

## 🎯 Testing

After restarting, check logs for:

```
DEBUG: Round 3 - BUYER turn
```

Then look for the message content to include:
```
Ihre letzte interne Analyse (zur Erinnerung):
"[previous analysis text]"
```

## ✨ Result

Agents now have:
- ✅ **Memory** - Remember their own thinking
- ✅ **Consistency** - Build on previous analysis
- ✅ **Strategy** - Execute multi-round plans
- ✅ **Learning** - Adapt based on what worked
- ✅ **Clear Schema** - Exact Pydantic structure in prompt

The prompt now perfectly aligns with the code, and agents have true memory continuity!
