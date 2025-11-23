# Offer Variable Analysis - Bug Fix

## 🐛 Problem gefunden!

Der Agent war verwirrt, weil die **User Message** falsch gelabelt war:

### **Alter Code (FALSCH):**
```python
message = f"""Runde {round_num} - Antwort des Gegenübers:
"{last_counter_message}"

Ihr Angebot: {last_counter_offer}  ❌ FALSCH!
"""
```

**Problem:** `last_counter_offer` ist das **GEGNER-Angebot**, aber die Message sagt "**Ihr** Angebot"!

### **Neuer Code (KORREKT):**
```python
message = f"""Runde {round_num} - Antwort des Gegenübers:
"{last_counter_message}"

Deren Angebot: {last_counter_offer}  ✅ KORREKT!
"""
```

---

## 📊 Variable Mapping - Übersicht

### In `_build_dynamic_prompt_variables()`:

| Variable | Wert | Bedeutung |
|----------|------|-----------|
| `role` | BUYER oder SELLER | **Der Agent, für den wir gerade die Variablen bauen** |
| `my_rounds` | `[r for r if r["agent"] == role]` | **EIGENE** vergangene Runden |
| `opponent_rounds` | `[r for r if r["agent"] != role]` | **GEGNER** vergangene Runden |
| `my_last_offer` | Aus `my_rounds[-1]` | **EIGENES** letztes Angebot |
| `opponent_offer` | Aus `opponent_rounds[-1]` | **GEGNER** letztes Angebot |

### In den Dynamic Variables (für System Prompt):

| Variable im Prompt | Python Variable | Wer? |
|-------------------|-----------------|------|
| `{{self_last_offer}}` | `my_last_offer` | **MEIN** letztes Angebot |
| `{{opponent_last_offer}}` | `opponent_offer` | **GEGNER** letztes Angebot |
| `{{current_round_message}}` | `opponent_msg` | **GEGNER** letzte Nachricht |

**✅ Diese Zuordnung ist KORREKT!**

---

## 🔍 Szenarien - Vorher vs. Nachher

### Szenario: Runde 2, SELLER antwortet auf BUYER

**Kontext:**
- Runde 1: BUYER (USER) bot an: `{Milka100g: 1.12, Milka90g: 1.02}`
- Runde 2: SELLER (OPPONENT) antwortet

#### System Prompt Variablen (KORREKT):
```
{{self_last_offer}} = {}  (SELLER hat noch nichts angeboten)
{{opponent_last_offer}} = {Milka100g: 1.12, Milka90g: 1.02}  (BUYER's Angebot)
{{current_round_message}} = "Guten Tag, hier ist unser Eröffnungsangebot..."
```

#### User Message - VORHER (FALSCH):
```
Runde 2 - Antwort des Gegenübers:
"Guten Tag, hier ist unser Eröffnungsangebot..."

Ihr Angebot: {Milka100g: 1.12, Milka90g: 1.02}  ❌ VERWIRREND!
```

**Problem:** SELLER denkt, ER hätte dieses Angebot gemacht!

#### User Message - NACHHER (KORREKT):
```
Runde 2 - Antwort des Gegenübers:
"Guten Tag, hier ist unser Eröffnungsangebot..."

Deren Angebot: {Milka100g: 1.12, Milka90g: 1.02}  ✅ KLAR!
```

**Jetzt klar:** BUYER hat dieses Angebot gemacht, SELLER muss antworten.

---

### Szenario: Runde 3, BUYER antwortet auf SELLER

**Kontext:**
- Runde 1: BUYER (USER) bot an: `{Milka100g: 1.12, Milka90g: 1.02}`
- Runde 2: SELLER (OPPONENT) bot an: `{Milka100g: 1.20, Milka90g: 1.10}`
- Runde 3: BUYER (USER) antwortet

#### System Prompt Variablen (KORREKT):
```
{{self_last_offer}} = {Milka100g: 1.12, Milka90g: 1.02}  (BUYER's Angebot aus Runde 1)
{{opponent_last_offer}} = {Milka100g: 1.20, Milka90g: 1.10}  (SELLER's Angebot aus Runde 2)
{{current_round_message}} = "Ich schlage folgende Preise vor..."
```

#### User Message - VORHER (FALSCH):
```
Runde 3 - Antwort des Gegenübers:
"Ich schlage folgende Preise vor..."

Ihr Angebot: {Milka100g: 1.20, Milka90g: 1.10}  ❌ FALSCH!
```

**Problem:** BUYER denkt, ER hätte 1.20 vorgeschlagen (aber das war SELLER!)

#### User Message - NACHHER (KORREKT):
```
Runde 3 - Antwort des Gegenübers:
"Ich schlage folgende Preise vor..."

Deren Angebot: {Milka100g: 1.20, Milka90g: 1.10}  ✅ KORREKT!
```

**Jetzt klar:** SELLER schlägt 1.20 vor, BUYER muss reagieren.

---

## 🎯 Warum war das verwirrend?

### Agent's Perspektive in Runde 2 (SELLER):

**Was der Agent sieht:**

**System Prompt:**
```
<conversation_history>
...
Ihr letztes Angebot: {}
Angebot der Gegenseite: {Milka100g: 1.12, ...}
</conversation_history>
```
✅ Klar: Ich habe noch nichts angeboten, Gegner hat 1.12 vorgeschlagen.

**User Message (VORHER - FALSCH):**
```
Runde 2 - Antwort des Gegenübers:
"Hier ist unser Angebot..."

Ihr Angebot: {Milka100g: 1.12, ...}  ❌
```
❌ Verwirrend: Wait, habe ICH 1.12 vorgeschlagen oder der Gegner?!

**User Message (NACHHER - KORREKT):**
```
Runde 2 - Antwort des Gegenübers:
"Hier ist unser Angebot..."

Deren Angebot: {Milka100g: 1.12, ...}  ✅
```
✅ Klar: DER GEGNER hat 1.12 vorgeschlagen, ich muss antworten.

---

## ✅ Fix Implementiert

**Datei:** `scripts/run_production_negotiation.py`
**Methode:** `_build_round_message()`
**Zeile:** ~972

**Änderung:**
```diff
- Ihr Angebot: {json.dumps(last_counter_offer, ...)}
+ Deren Angebot: {json.dumps(last_counter_offer, ...)}
```

---

## 🔍 Zusätzliche Überprüfung: System Prompt Variablen

### Werden die Variablen korrekt zugeordnet?

**In `_build_dynamic_prompt_variables()`:**

```python
# KORREKT: Eigene Runden filtern
my_rounds = [r for r in results if r.get("agent") == role]
my_last_offer = my_rounds[-1].get("offer", {}).get("dimension_values", {})

# KORREKT: Gegner Runden filtern
opponent_rounds = [r for r in results if r.get("agent") != role]
opponent_offer = opponent_rounds[-1].get("offer", {}).get("dimension_values", {})

# KORREKT: Zuordnung zu Variablen
return {
    'self_last_offer': json.dumps(my_last_offer, ...),  ✅
    'opponent_last_offer': json.dumps(opponent_offer, ...),  ✅
    'current_round_message': opponent_msg,  ✅
}
```

**✅ Alles korrekt zugeordnet!**

---

## 📝 Langfuse Prompt Labels

Die **Langfuse Prompts** sollten konsistente Labels verwenden:

### Empfohlen für System Prompt:

```
<conversation_history>
Bisherige Runden (Summary): {{previous_rounds}}

Letzter Move des Gegners:
- Nachricht: {{current_round_message}}
- Angebot: {{opponent_last_offer}}

Ihr letztes Angebot:
- {{self_last_offer}}
</conversation_history>
```

**Labels:**
- "Letzter Move des **Gegners**" → klar, dass es um den Opponent geht
- "**Ihr** letztes Angebot" → klar, dass es um den eigenen Move geht
- "Angebot: {{opponent_last_offer}}" → Variable ist klar benannt

---

## 🎓 Best Practices

### DO:
✅ Verwende klare Labels: "Deren Angebot", "Ihr Angebot"
✅ Konsistente Variablennamen: `opponent_*`, `self_*`
✅ Getrennte Extraktion: `my_rounds` vs `opponent_rounds`
✅ Eindeutige Zuordnung in User Message

### DON'T:
❌ Verwende keine mehrdeutigen Labels wie "Ihr Angebot" für Gegner-Daten
❌ Mische nicht Perspektiven ("Ihr" vs "Deren")
❌ Verwende keine unklaren Variablennamen

---

## 🚀 Impact

**Vorher:**
- Agent war verwirrt über Angebots-Zuordnung
- Dachte manchmal, sein eigenes Angebot sei vom Gegner
- Antwortete inkonsistent: "Ich habe schon 1.12 vorgeschlagen" vs "Sie schlagen 1.12 vor"

**Nachher:**
- ✅ Klare Trennung: "Deren Angebot" vs "Ihr letztes Angebot"
- ✅ Agent weiß genau, wer was vorgeschlagen hat
- ✅ Konsistente Antworten basierend auf korrektem Kontext

---

**Status:** ✅ BEHOBEN in `scripts/run_production_negotiation.py`
