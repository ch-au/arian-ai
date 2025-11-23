# Offer Variable Swap Bug - Langfuse Prompt Fix

## 🐛 Problem

Im `agents/self_agent` Prompt in Langfuse sind die Variablen `{{self_last_offer}}` und `{{opponent_last_offer}}` **vertauscht**!

### Aktueller (falscher) Prompt:

```
Letztzer Move des Gegners:
- Die aktuelle Nachricht der Gegenseite: {{current_round_message}}
- Strukturiertes Angebot der Genseite mit allen Dimensionswerten:
{{self_last_offer}}                     ❌ FALSCH - zeigt MEIN Angebot!

- mein letztes Angebot
{{opponent_last_offer}}                 ❌ FALSCH - zeigt DEREN Angebot!
```

### Was passiert:

**User-Bericht:**
```
Strukturiertes Angebot der Genseite: {"milka100g": 1.12, "milka90g": 1.03, "Lieferzeit": 2.0}
mein letztes Angebot: {"milka100g": 1.11, "milka90g": 1.02, "Lieferzeit": 2.0}
```

**Problem:**
- "Angebot der Gegenseite" (sollte höher sein) zeigt niedrigere Werte (1.11, 1.02)
- "Mein letztes Angebot" (sollte niedriger sein) zeigt höhere Werte (1.12, 1.03)
- Die Werte sind **invertiert**!

## ✅ Python Code ist KORREKT

Der Python-Code in `scripts/run_production_negotiation.py` ist bereits **korrekt**:

### Zeilen 1107-1157:

```python
def _build_dynamic_prompt_variables(self, role: str, results: List[Dict[str, Any]], round_num: int) -> Dict[str, str]:
    # Get agent's own previous round data
    my_rounds = [r for r in results if r.get("agent") == role]  # ✅ MEINE Runden

    # Extract last offer from BDI state
    if my_rounds:
        last_response = my_rounds[-1].get("response", {})
        my_last_offer = last_response.get("offer", {}).get("dimension_values", {})  # ✅ MEIN Angebot
    else:
        my_last_offer = {}

    # Get opponent's last offer and message
    opponent_rounds = [r for r in results if r.get("agent") != role]  # ✅ OPPONENT Runden
    if opponent_rounds:
        opponent_last = opponent_rounds[-1].get("response", {})
        opponent_offer = opponent_last.get("offer", {}).get("dimension_values", {})  # ✅ OPPONENT Angebot
    else:
        opponent_offer = {}

    return {
        'opponent_last_offer': json.dumps(opponent_offer, ensure_ascii=False),  # ✅ KORREKT
        'self_last_offer': json.dumps(my_last_offer, ensure_ascii=False),      # ✅ KORREKT
    }
```

**Semantik:**
- `self_last_offer` = **MEIN** letztes Angebot
- `opponent_last_offer` = **DEREN** letztes Angebot

## 🔧 Langfuse Prompt Fix

### `agents/self_agent` - Korrektur erforderlich:

```diff
Letztzer Move des Gegners:
- Die aktuelle Nachricht der Gegenseite: {{current_round_message}}

- Strukturiertes Angebot der Genseite mit allen Dimensionswerten:
- {{self_last_offer}}
+ {{opponent_last_offer}}

- mein letztes Angebot:
- {{opponent_last_offer}}
+ {{self_last_offer}}
```

### Korrigierter Prompt:

```
Letztzer Move des Gegners:
- Die aktuelle Nachricht der Gegenseite: {{current_round_message}}

- Strukturiertes Angebot der Gegenseite mit allen Dimensionswerten:
{{opponent_last_offer}}                 ✅ RICHTIG - zeigt DEREN Angebot

- Mein letztes Angebot:
{{self_last_offer}}                     ✅ RICHTIG - zeigt MEIN Angebot
```

## 🧪 Verifikation

### Erwartetes Verhalten nach Fix:

**Szenario:** User=BUYER macht Angebot (Runde 1: 1.11 EUR), Opponent=SELLER antwortet (Runde 2: 1.12 EUR)

**Runde 3 - User Agent sieht:**
```
Strukturiertes Angebot der Gegenseite: {"milka100g": 1.12, ...}  ✅ Höher (Seller will mehr)
Mein letztes Angebot: {"milka100g": 1.11, ...}                   ✅ Niedriger (Buyer will weniger)
```

Das macht **Sinn**:
- Opponent (SELLER) will 1.12 EUR → höher ✅
- Ich (BUYER) bot 1.11 EUR → niedriger ✅

## 📊 Beispiel-Trace

### VORHER (mit Bug):

```
Round 3 - USER (BUYER) Agent Prompt:
  Angebot der Gegenseite: {"milka100g": 1.11}   ❌ FALSCH (mein eigenes Angebot!)
  Mein letztes Angebot: {"milka100g": 1.12}     ❌ FALSCH (deren Angebot!)
```

→ Agent denkt: "Ich habe 1.12 angeboten, sie wollen 1.11" → **VERWIRRUNG**!

### NACHHER (gefixt):

```
Round 3 - USER (BUYER) Agent Prompt:
  Angebot der Gegenseite: {"milka100g": 1.12}   ✅ RICHTIG (Seller will mehr)
  Mein letztes Angebot: {"milka100g": 1.11}     ✅ RICHTIG (ich bot weniger)
```

→ Agent denkt: "Ich habe 1.11 angeboten, sie wollen 1.12" → **KORREKT**!

## 🔍 Betroffene Prompts

### `agents/self_agent`:
- ✅ **Python Code**: KORREKT (keine Änderung nötig)
- ❌ **Langfuse Prompt**: FALSCH (Fix erforderlich - siehe oben)

### `agents/opponent_agent`:
Muss auch überprüft werden! Gleiche Variable sollten dort verwendet werden.

## ⚠️ Zusätzlicher Bug gefunden

**Tippfehler im Prompt:**
```diff
- Letztzer Move des Gegners:
+ Letzter Move des Gegners:
```

## ✅ Checkliste

### Python Code:
- [x] `_build_dynamic_prompt_variables()` ist korrekt
- [x] `my_last_offer` wird korrekt extrahiert (eigene Runden)
- [x] `opponent_offer` wird korrekt extrahiert (Opponent Runden)
- [x] Variablen korrekt benannt und zugeordnet

### Langfuse Prompts (TODO):
- [ ] `agents/self_agent` - Variablen tauschen
  - [ ] "Angebot der Gegenseite" → `{{opponent_last_offer}}`
  - [ ] "Mein letztes Angebot" → `{{self_last_offer}}`
  - [ ] Tippfehler "Letztzer" → "Letzter" korrigieren
- [ ] `agents/opponent_agent` - Überprüfen ob gleicher Bug existiert

### Testing (TODO):
- [ ] Test-Verhandlung mit mehreren Runden
- [ ] Trace analysieren: Sind Angebote korrekt zugeordnet?
- [ ] Verifikation: Höheres Angebot = Seller, Niedrigeres = Buyer

## 🚀 Impact

**Vor dem Fix:**
- ❌ Agent sieht eigene Angebote als "Gegenseite"
- ❌ Agent sieht Opponent-Angebote als "meine"
- ❌ Strategische Entscheidungen basieren auf falschen Daten
- ❌ Verhandlungslogik invertiert

**Nach dem Fix:**
- ✅ Agent sieht korrekte Angebote der Gegenseite
- ✅ Agent erinnert sich korrekt an eigene Angebote
- ✅ Strategische Entscheidungen basieren auf korrekten Daten
- ✅ Verhandlungslogik funktioniert wie erwartet

---

**Kritischer Bug!** Muss sofort in Langfuse gefixt werden! 🚨
