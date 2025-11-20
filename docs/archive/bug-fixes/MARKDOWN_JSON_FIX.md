# Markdown JSON Code Block Fix

## 🐛 Problem

LLMs (besonders Gemini) geben manchmal **Markdown-formatiertes JSON** zurück statt reinem JSON:

### **Erwartete Ausgabe:**
```json
{
  "message": "Guten Tag...",
  "action": "continue",
  "offer": {...}
}
```

### **Tatsächliche Ausgabe:**
````markdown
```json
{
  "message": "Guten Tag...",
  "action": "continue",
  "offer": {...}
}
```
````

## ❌ Fehler

```python
ValueError: Could not parse response: ```json
{
  "message": "Guten Tag..."
  ...
} - Error: Expecting value: line 1 column 1 (char 0)
```

**Problem:** Der JSON-Parser versucht `\`\`\`json` zu parsen, was kein gültiges JSON ist!

## ✅ Lösung

Wir haben eine **Markdown-Cleanup-Funktion** hinzugefügt:

```python
# Clean up markdown code blocks (common issue with LLMs)
response_str = response_str.strip()
if response_str.startswith('```'):
    # Remove opening ```json or ```
    lines = response_str.split('\n')
    if lines[0].startswith('```'):
        lines = lines[1:]  # Remove first line
    # Remove closing ```
    if lines and lines[-1].strip() == '```':
        lines = lines[:-1]  # Remove last line
    response_str = '\n'.join(lines).strip()
    logger.debug(f"Cleaned markdown code block from response")
```

## 🔄 Ablauf

### Vorher:
```
1. Agent gibt zurück: "```json\n{...}\n```"
2. json.loads() versucht zu parsen: "```json\n{...}\n```"
3. ❌ JSONDecodeError: Expecting value
4. ❌ Round failed
```

### Nachher:
```
1. Agent gibt zurück: "```json\n{...}\n```"
2. Cleanup entfernt Markdown: "{...}"
3. json.loads() parst: "{...}"
4. ✅ Erfolgreich geparst
5. ✅ Round completed
```

## 📊 Unterstützte Formate

Die Funktion unterstützt jetzt:

### Format 1: Reines JSON ✅
```json
{"message": "...", "action": "continue"}
```
→ Direkt geparst

### Format 2: Markdown mit Language Tag ✅
````markdown
```json
{"message": "...", "action": "continue"}
```
````
→ Cleanup → Parse

### Format 3: Markdown ohne Language Tag ✅
````markdown
```
{"message": "...", "action": "continue"}
```
````
→ Cleanup → Parse

### Format 4: Pydantic Model ✅
```python
NegotiationResponse(message="...", action="continue", ...)
```
→ `.model_dump()` → Dict

### Format 5: Dict ✅
```python
{"message": "...", "action": "continue"}
```
→ Direkt verwendet

## 🎯 Warum passiert das?

### LLMs sind trainiert auf Markdown
- **Training Data:** Viele Beispiele mit Markdown-Code-Blöcken
- **Chat-Kontext:** LLMs denken, sie sind in einem Chat (→ Markdown)
- **Instruktionen:** Manchmal sagen Prompts "gib JSON zurück" → LLM denkt "Markdown-Code-Block"

### Besonders betroffen:
- ✅ **Gemini** (sehr häufig)
- ⚠️ **Claude** (manchmal)
- ⚠️ **GPT-4** (selten, aber möglich)

## 🔧 Implementierung

**Datei:** `scripts/run_production_negotiation.py`
**Methode:** `_execute_single_round()`
**Zeilen:** ~1380-1392

### Logik:
1. **Check:** Beginnt Response mit ``` \`\`\` ```?
2. **Split:** In Zeilen aufteilen
3. **Remove First:** Erste Zeile entfernen (``` \`\`\`json ```)
4. **Remove Last:** Letzte Zeile entfernen (``` \`\`\` ```)
5. **Join:** Verbleibende Zeilen zusammenfügen
6. **Parse:** JSON parsen

### Robust:
- ✅ Funktioniert mit `\`\`\`json` und `\`\`\``
- ✅ Funktioniert ohne Markdown (wird nicht verändert)
- ✅ Keine false positives (nur wenn Response wirklich mit ``` \`\`\` ``` startet)

## 🚀 Alternative Lösungen

### 1. Regex-basiert (komplizierter):
```python
import re
response_str = re.sub(r'^```(?:json)?\n(.*)\n```$', r'\1', response_str, flags=re.DOTALL)
```

### 2. Structured Output erzwingen (besser):
```python
# Use strict_json_schema=True for OpenAI/Anthropic
output_schema = AgentOutputSchema(NegotiationResponse, strict_json_schema=True)
```

**Aber:** Gemini unterstützt kein `strict_json_schema`, daher ist der Cleanup nötig!

## 📝 Langfuse Prompt Update

Um das Problem zu minimieren, sollten die Prompts betonen:

### **Aktuell:**
```
WICHTIG: Antworten Sie NUR mit gültigem JSON, keine zusätzlichen Texte oder Markdown-Codeblöcke.
```

### **Besser (expliziter):**
```
CRITICAL: Your response MUST be valid JSON only!

✅ CORRECT:
{"message": "...", "action": "continue"}

❌ WRONG - No markdown formatting:
```json
{"message": "...", "action": "continue"}
```

❌ WRONG - No explanations before/after JSON
```

## ✅ Status

- ✅ **Cleanup-Funktion implementiert** in `_execute_single_round()`
- ✅ **Syntax validiert**
- ✅ **Dokumentiert**
- ⚠️ **Langfuse Prompts** sollten aktualisiert werden (expliziter)

## 🎓 Best Practices

### DO:
✅ Cleanup Markdown-Code-Blöcke vor JSON-Parsing
✅ Log wenn Cleanup durchgeführt wurde (Debug)
✅ Verwende structured output wenn möglich
✅ Explizite Instruktionen in Prompts

### DON'T:
❌ Assume LLM gibt immer reines JSON zurück
❌ Fail hard bei Markdown (cleanup first!)
❌ Rely nur auf `strict_json_schema` (Gemini support fehlt)

---

**Impact:** Verhandlungen funktionieren jetzt auch mit Gemini und anderen Modellen, die Markdown-Code-Blöcke zurückgeben! 🎉
