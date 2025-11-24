# Langfuse Prompt Fixes Required

## ⚠️ WICHTIG: Conversation History Optimierung

**Problem:** Die vollständige Conversation History wurde DOPPELT gespeichert:
1. Im SQLiteSession (automatisch vom Agents SDK verwaltet) ✅
2. Im System Prompt via `{{previous_rounds}}` ❌ DUPLIZIERT!

**Lösung:** Wir haben `{{previous_rounds}}` auf eine **kurze Zusammenfassung** reduziert (nur letzte 2 Runden).
Die vollständige Historie ist bereits über die Session verfügbar.

**Token-Einsparung:** Bei 6 Runden ~1200 Tokens pro Request! 🎉

---

## Übersicht der erforderlichen Änderungen

| Prompt | Status | Hauptprobleme |
|--------|--------|---------------|
| `agents/opponent_agent` | ⚠️ Mehrere Fixes | Hardcodierte Werte, fehlende Variablen |
| `agents/self_agent` | ⚠️ Kleinere Fixes | `{{self_last_offer}}` fehlt, Tippfehler |

**Siehe auch:**
- [SELF_AGENT_PROMPT_ANALYSIS.md](SELF_AGENT_PROMPT_ANALYSIS.md) - Detaillierte Analyse des self_agent Prompts

---

## opponent_agent Prompt Änderungen

Die folgenden Variablen werden NICHT korrekt verwendet im Langfuse Prompt `agents/opponent_agent`.
Bitte aktualisieren Sie den Prompt in Langfuse mit den korrekten Variable-Platzhaltern:

### 1. Conversation History Section
**AKTUELL (FALSCH):**
```
<conversation_history>
Vollständiger Verlauf aller bisherigen Angebote und Nachrichten: Noch keine Runden – Start der Simulation.
Letztzer Move des Gegners:
- Die aktuelle Nachricht der Gegenseite: Noch keine Nachricht empfangen.
- Strukturiertes Angebot der Genseite  mit allen Dimensionswerten: {}
- mein letztes Angebot {}
</conversation_history>
```

**SOLLTE SEIN:**
```
<conversation_history>
Vollständiger Verlauf aller bisherigen Angebote und Nachrichten: {{previous_rounds}}
Letzter Move des Gegners:
- Die aktuelle Nachricht der Gegenseite: {{current_round_message}}
- Strukturiertes Angebot der Gegenseite mit allen Dimensionswerten: {{opponent_last_offer}}
- Mein letztes Angebot: {{self_last_offer}}
</conversation_history>
```

### 2. Opponent Analysis Section
**AKTUELL (FALSCH):**
```
<opponent_analysis>
Hypothesen über den Gegner:
- inferrierte Präferenzen und Prioritäten: Noch keine Daten – erste Runde. # Sollte auch ZOPA abschätzen
- Verhalten & Verhandlungsstil: Keine Beobachtungen zu diesem Zeitpunkt.
</opponent_analysis>
```

**SOLLTE SEIN:**
```
<opponent_analysis>
Hypothesen über den Gegner:
- Inferrierte Präferenzen und Prioritäten: {{inferred_preferences}}
- Verhalten & Verhandlungsstil: {{observed_behaviour}}
</opponent_analysis>
```

### 3. Previous Internal State
**AKTUELL (FALSCH):**
```
<previous_internal_state>
{}
</previous_internal_state>
```

**SOLLTE SEIN:**
```
<previous_internal_state>
{{last_round_beliefs_json}}
</previous_internal_state>
```

### 4. Previous Intentions
**AKTUELL (FALSCH):**
```
<previous_intentions>
Noch keine Intentionen – erste Runde.
</previous_intentions>
```

**SOLLTE SEIN:**
```
<previous_intentions>
{{last_round_intentions}}
</previous_intentions>
```

### 5. Counterpart Distance
**AKTUELL (FALSCH):**
```
- Distanz des Opponents in den einzelnen verhandlungsdimensionen{"gesamt": 80}
```

**SOLLTE SEIN:**
```
- Distanz des Opponents in den einzelnen Verhandlungsdimensionen: {{counterpart_distance}}
```

### 6. Power Balance
**AKTUELL (eventuell fehlerhaft - bitte prüfen):**
```
- Powerbalance 70.00
```

**SOLLTE SEIN:**
```
- Powerbalance: {{power_balance}}
```

---

## Vollständige Liste aller verfügbaren Variablen

Für Ihre Referenz, hier sind ALLE Variablen, die vom Python-Service bereitgestellt werden:

### Rollen & Kontext
- `{{agent_role}}` - BUYER oder SELLER
- `{{company}}` - Name des eigenen Unternehmens
- `{{counterpart_company}}` - Name des Gegenübers
- `{{role_objectives}}` - Ziele der Rolle
- `{{role_perspective}}` - Perspektive (gleich wie agent_role)
- `{{primary_success_metric}}` - Primäre Erfolgsmetrik

### Verhandlungs-Meta
- `{{negotiation_title}}` - Titel der Verhandlung
- `{{negotiation_type}}` - Typ (one-shot, multi-round, etc.)
- `{{negotiation_frequency}}` - Frequenz (jährlich, etc.)
- `{{relationship_type}}` - Beziehungstyp
- `{{negotiation_context}}` - Zusammenfassung des Kontexts
- `{{product_description}}` - Produktbeschreibung
- `{{product_market_description}}` - Marktbeschreibung
- `{{intelligence}}` - Marktintelligenz
- `{{additional_comments}}` - Zusätzliche Kommentare

### Runden-Dynamik (werden jede Runde aktualisiert)
- `{{current_round}}` - Aktuelle Rundennummer
- `{{max_rounds}}` - Maximale Rundenzahl
- `{{previous_rounds}}` - **Vollständiger Conversation History**
- `{{current_round_message}}` - **Aktuelle Nachricht des Gegners**
- `{{opponent_last_offer}}` - **Letztes Angebot des Gegners (JSON)**
- `{{self_last_offer}}` - **Eigenes letztes Angebot (JSON)**
- `{{last_round_beliefs_json}}` - **Beliefs aus letzter Runde (JSON)**
- `{{last_round_intentions}}` - **Intentionen aus letzter Runde**

### Gegenüber-Informationen
- `{{counterpart_company}}` - Name
- `{{counterpart_attitude}}` - Verhandlungsstil (z.B. "partnerschaftlich")
- `{{counterpart_description}}` - Vollständige Beschreibung
- `{{counterpart_distance}}` - Distanz in Dimensionen
- `{{counterpart_dominance}}` - Dominanz-Wert
- `{{counterpart_affiliation}}` - Affiliations-Wert
- `{{counterpart_known}}` - Ist Gegenüber bekannt (Ja/Nein)
- `{{company_known}}` - Ist eigene Firma bekannt (Ja/Nein)
- `{{power_balance}}` - Machtverhältnis
- `{{inferred_preferences}}` - **Inferrierte Präferenzen**
- `{{observed_behaviour}}` - **Beobachtetes Verhalten**

### Produkte & Dimensionen
- `{{products_info}}` - Formatierte Produktliste
- `{{product_name}}` - Produktnamen
- `{{zielpreis}}` - Zielpreise
- `{{maxpreis}}` - Max/Min-Preise (rollenabhängig)
- `{{volume}}` - Volumen
- `{{pricing_related_text}}` - **Detaillierte Preis-Informationen**
- `{{product_key_fields}}` - **Product Keys für JSON**

- `{{dimension_name}}` - Dimensionsnamen
- `{{dimension_unit}}` - Einheiten
- `{{min_value}}` - Minimalwerte
- `{{max_value}}` - Maximalwerte
- `{{target_value}}` - Zielwerte
- `{{goal_priorities}}` - Prioritäten
- `{{dimension_related_text}}` - **Detaillierte Dimensions-Informationen**
- `{{dimension_details}}` - Dimensions-Details
- `{{dimension_examples}}` - **Beispielwerte für Dimensionen**
- `{{dimension_schema}}` - **JSON-Schema für Dimensionen**
- `{{zopa_boundaries}}` - ZOPA-Grenzen
- `{{beliefs_schema}}` - **JSON-Schema für Beliefs**

### Technik & Taktik
- `{{technique_name}}` - Name der Verhandlungstechnik
- `{{technique_description}}` - Beschreibung
- `{{technique_application}}` - Anwendung
- `{{technique_key_aspects}}` - Wichtige Aspekte
- `{{technique_key_phrases}}` - Key Phrases
- `{{tactic_name}}` - Name der Taktik
- `{{tactic_description}}` - Beschreibung
- `{{tactic_application}}` - Anwendung
- `{{tactic_key_aspects}}` - Wichtige Aspekte
- `{{tactic_key_phrases}}` - Key Phrases

### Kontext-Details
- `{{context_description}}` - Kontextbeschreibung
- `{{context_market_conditions}}` - Marktbedingungen (JSON)
- `{{context_baseline_values}}` - Baseline-Werte (JSON)
- `{{negotiation_metadata}}` - Metadata (JSON)

---

## Nächste Schritte

1. ✅ Python-Code wurde bereits korrigiert (alle Variablen werden korrekt gesetzt)
2. ⚠️ **TODO**: Langfuse Prompt `agents/opponent_agent` muss aktualisiert werden
3. ⚠️ **TODO**: Langfuse Prompt `agents/self_agent` auf gleiche Probleme prüfen

## Testing

Nach dem Update können Sie testen mit:
```bash
# Check welche Variablen gesendet werden
grep -n "logger.debug.*variables" scripts/run_production_negotiation.py
```

Die Variablen werden jetzt korrekt vom Python-Service bereitgestellt.
Das Problem liegt NUR im Langfuse Prompt-Template.


