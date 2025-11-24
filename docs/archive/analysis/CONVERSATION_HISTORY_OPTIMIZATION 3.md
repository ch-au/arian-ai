# Conversation History Optimization

## 🎯 Problem: Doppelte Conversation History

### Vorher (INEFFIZIENT):

```
┌─────────────────────────────────────────────────────────────┐
│ SQLiteSession (Agents SDK)                                   │
├─────────────────────────────────────────────────────────────┤
│ User: "Bitte beginnen Sie..."                               │
│ Assistant: "Guten Tag, ich biete €1.20 an..."              │
│ User: "Das ist zu teuer..."                                 │
│ Assistant: "Ich kann auf €1.15 gehen..."                   │
│ User: "Akzeptiert bei €1.12"                               │
│ Assistant: {...}                                            │
│                                                              │
│ Token-Kosten: ~1200 Tokens ✅                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ System Prompt ({{previous_rounds}})                          │
├─────────────────────────────────────────────────────────────┤
│ <conversation_history>                                       │
│ Runde 1 - BUYER:                                            │
│   Nachricht: "Guten Tag, ich biete €1.20 an..."           │
│   Angebot: {"milka100g": 1.20, ...}                        │
│ Runde 2 - SELLER:                                           │
│   Nachricht: "Das ist zu teuer..."                         │
│   Angebot: {"milka100g": 1.30, ...}                        │
│ Runde 3 - BUYER:                                            │
│   Nachricht: "Ich kann auf €1.15 gehen..."                │
│   Angebot: {"milka100g": 1.15, ...}                        │
│ ... [vollständige Historie dupliziert!]                     │
│ </conversation_history>                                      │
│                                                              │
│ Token-Kosten: ~1200 Tokens ❌ VERSCHWENDUNG!                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ User Message (per Round)                                     │
├─────────────────────────────────────────────────────────────┤
│ ## AKTUELLE RUNDDYNAMIK (Runde 4)                           │
│                                                              │
│ Gegenangebot der Gegenseite: "..."                         │
│ Angebotswerte: {...}                                        │
│ Ihre letzte Analyse: "..."                                 │
│ Verhandlungsfortschritt: ...                               │
│ Dimension-Schema: ...                                       │
│                                                              │
│ Token-Kosten: ~300 Tokens                                   │
└─────────────────────────────────────────────────────────────┘

GESAMT: 1200 + 1200 + 300 = 2700 Tokens pro Request
```

### Nachher (OPTIMIERT):

```
┌─────────────────────────────────────────────────────────────┐
│ SQLiteSession (Agents SDK)                                   │
├─────────────────────────────────────────────────────────────┤
│ User: "Bitte beginnen Sie..."                               │
│ Assistant: "Guten Tag, ich biete €1.20 an..."              │
│ User: "Das ist zu teuer..."                                 │
│ Assistant: "Ich kann auf €1.15 gehen..."                   │
│ User: "Akzeptiert bei €1.12"                               │
│ Assistant: {...}                                            │
│                                                              │
│ Token-Kosten: ~1200 Tokens ✅                               │
│ (Automatisch vom SDK verwaltet - SINGLE SOURCE OF TRUTH)    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ System Prompt ({{previous_rounds}}) - NUR SUMMARY           │
├─────────────────────────────────────────────────────────────┤
│ <conversation_history>                                       │
│ Bisherige Runden: 5                                         │
│                                                              │
│ Letzte Runden (für Kontext):                                │
│ Runde 4 - BUYER: Aktion=continue                           │
│ Runde 5 - SELLER: Aktion=continue                          │
│                                                              │
│ (Vollständige Gesprächshistorie ist im Session-Kontext     │
│  verfügbar)                                                 │
│ </conversation_history>                                      │
│                                                              │
│ Token-Kosten: ~100 Tokens ✅ GESPART: 1100 Tokens!         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ User Message (per Round) - NUR CURRENT INFO                 │
├─────────────────────────────────────────────────────────────┤
│ Runde 4 - Antwort des Gegenübers:                          │
│                                                              │
│ "Ich kann auf €1.15 gehen..."                             │
│                                                              │
│ Ihr Angebot: {"milka100g": 1.15, ...}                      │
│                                                              │
│ Bitte analysieren und antworten Sie entsprechend           │
│ Ihrer Strategie.                                            │
│                                                              │
│ Token-Kosten: ~100 Tokens ✅ GESPART: 200 Tokens!          │
└─────────────────────────────────────────────────────────────┘

GESAMT: 1200 + 100 + 100 = 1400 Tokens pro Request

🎉 EINSPARUNG: 2700 - 1400 = 1300 Tokens pro Request (48%!)
```

## 📊 Token-Einsparungen

### Pro Request (6 Runden):
- **Vorher**: ~2700 Tokens
- **Nachher**: ~1400 Tokens
- **Einsparung**: ~1300 Tokens (48%)

### Pro Verhandlung (6 Requests):
- **Vorher**: ~16,200 Tokens
- **Nachher**: ~8,400 Tokens
- **Einsparung**: ~7,800 Tokens (48%)

### Bei 100 Verhandlungen pro Tag:
- **Einsparung**: ~780,000 Tokens/Tag
- **Kosten-Einsparung**: ~$1.50 - $15/Tag (je nach Model)
- **Pro Monat**: ~$45 - $450

## 🔧 Implementierte Änderungen

### 1. `_format_conversation_history()` - Reduziert auf Summary
```python
# VORHER: Vollständige Historie (alle Runden)
def _format_conversation_history(results):
    history_lines = []
    for r in results:  # Alle Runden!
        history_lines.append(f"Runde {r['round']}: ...")
    return "\n".join(history_lines)

# NACHHER: Nur Summary (letzte 2 Runden)
def _format_conversation_history(results):
    total_rounds = len(results)
    recent_rounds = results[-2:]  # Nur letzte 2!
    summary = [f"Bisherige Runden: {total_rounds}"]
    for r in recent_rounds:
        summary.append(f"Runde {r['round']} - {r['agent']}: Aktion={r['action']}")
    summary.append("(Vollständige Historie ist im Session-Kontext verfügbar)")
    return "\n".join(summary)
```

### 2. `_build_round_message()` - Nur aktuelle Runde
```python
# VORHER: Viele redundante Informationen
def _build_round_message(role, results, round_num):
    # Gegner-Message
    # Gegner-Offer
    # Eigene letzte Analyse
    # Eigene letzte Aktion
    # Aktions-Summary
    # Schema-Reminder
    # ...viel zu viel!

# NACHHER: Nur neue Information
def _build_round_message(role, results, round_num):
    if round_num == 1:
        return "Bitte beginnen Sie die Verhandlung."
    else:
        last_message = get_opponent_last_message()
        last_offer = get_opponent_last_offer()
        return f"Runde {round_num} - Antwort: {last_message}\nAngebot: {last_offer}"
```

## 🎯 Warum funktioniert das?

### SQLiteSession verwaltet bereits alles:
```python
# Bei jedem Runner.run() wird automatisch:
session = SQLiteSession(session_id)
result = await Runner.run(agent, message, session=session)

# Die Session speichert:
# - Alle User-Messages
# - Alle Assistant-Responses
# - Den vollständigen Conversation Context
# - Automatisches Context-Window Management
```

Der **Agent hat IMMER Zugriff** auf die vollständige Historie über die Session!

### Was brauchen wir wirklich im System Prompt?

**STATIC Context** (ändert sich nie):
- Rolle (BUYER/SELLER)
- Produkte & Dimensionen
- Verhandlungs-Strategie
- Technik & Taktik
- Counterpart Info

**DYNAMIC Summary** (ändert sich jede Runde):
- Aktuelle Rundennummer
- Kurze Summary der letzten 2 Runden
- Letzte Beliefs/Intentions
- Aktuelle Offers

**User Message** (nur neue Info):
- Gegners letzte Nachricht
- Gegners letztes Angebot
- Aufforderung zu antworten

## ✅ Best Practices

### DO:
✅ Nutze SQLiteSession für Conversation History
✅ Halte System Prompt statisch (oder mit minimalem Dynamic Content)
✅ Halte User Message kurz und fokussiert auf aktuelle Runde
✅ Vermeide Duplikation von Informationen

### DON'T:
❌ Kopiere vollständige Conversation History in System Prompt
❌ Dupliziere Informationen die bereits in Session sind
❌ Sende redundante Kontext-Informationen bei jeder Nachricht
❌ Aktualisiere den kompletten System Prompt bei jeder Runde (nur wenn nötig)

## 📝 Empfehlungen für Langfuse Prompts

### opponent_agent & self_agent Prompts sollten haben:

**STATIC Section** (nie ändern):
```
# ROLLE
Sie sind {{agent_role}} bei {{company}}...

# STRATEGIE
Ihre Ziele: {{role_objectives}}...

# PRODUKTE & DIMENSIONEN
{{pricing_related_text}}
{{dimension_related_text}}

# TECHNIK & TAKTIK
{{technique_description}}
{{tactic_description}}
```

**DYNAMIC Section** (jede Runde aktualisiert):
```
# AKTUELLER STATUS
<round_count>{{current_round}}/{{max_rounds}}</round_count>

# RECENT CONTEXT (nicht vollständige Historie!)
{{previous_rounds}}  # Nur Summary der letzten 2 Runden

# BELIEFS & INTENTIONS (aus letzter Runde)
Letzte Beliefs: {{last_round_beliefs_json}}
Letzte Intentions: {{last_round_intentions}}
```

**User Message** (bei jedem Request):
```
Runde X - Antwort des Gegenübers:
"[message]"

Ihr Angebot: {...}

Bitte antworten Sie.
```

## 🚀 Performance Impact

### Response Time:
- Weniger Tokens → Schnellere LLM-Verarbeitung
- Kürzere Prompts → Schnellere API-Requests

### Cost:
- 48% weniger Input-Tokens
- Bei 1M Tokens/Monat: ~$7-70 Einsparung (je nach Model)

### Quality:
- ✅ Gleiche oder bessere Qualität
- ✅ Agent hat weiterhin vollen Kontext via Session
- ✅ Fokussierter auf aktuelle Runde
- ✅ Weniger "Prompt Noise"

## 🔍 Debugging

Um zu überprüfen, dass die Optimierung funktioniert:

```bash
# Check Token-Count im Log
grep "Token" logs/negotiation.log

# Check Session-Kontext
grep "SQLiteSession" logs/negotiation.log

# Verify Conversation History Length
grep "previous_rounds_length" logs/negotiation.log
```

Erwartete Werte:
- `previous_rounds_length` sollte klein sein (<500 chars)
- Session sollte persistent sein (gleiche session_id über alle Runden)
