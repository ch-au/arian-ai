# Phase 2 Plan - Updates basierend auf Klärung

**Datum:** 2025-10-01

## ✅ Geklärte Punkte

### 1. Market Intelligence - Gemini Flash Grounded Search
**Entscheidung:** Google Gemini Flash mit integrierter Google Search

**Vorteile:**
- ✅ Kostengünstig (Flash Modell)
- ✅ Integrierte Google Search (keine externe API nötig)
- ✅ Strukturierte JSON-Ausgabe mit Quellen
- ✅ Schnelle Antworten

**Python Implementation:**
```python
import google.generativeai as genai
from google.generativeai import types

model = genai.GenerativeModel("gemini-2.0-flash-exp")

prompt = f"""Für eine Verhandlung in der {industry} bin ich als {role_text}
für Produkte im Bereich {products_text} in einer Verhandlung.

Stelle mir bitte auf Grund einer aktuellen Web-Recherche 5-10 kritische
Aspekte zusammen, die meine Verhandlungsposition stärken.

Output als JSON:
[
  {
    "aspekt": "Kurze Beschreibung",
    "quelle": "URL",
    "relevanz": "Warum relevant für meine Position"
  }
]
"""

contents = [types.Content(role="user", parts=[types.Part.from_text(text=prompt)])]
tools = [types.Tool(google_search=types.GoogleSearch())]

response = model.generate_content(
    contents=contents,
    config=types.GenerateContentConfig(tools=tools)
)
```

**Integration:** Python-Service mit Node.js Bridge

---

### 2. Voice Input - Nur Deutsch
**Entscheidung:** Deutsche Spracherkennung, 60 Sekunden max

**Whisper API Configuration:**
```typescript
const transcription = await openai.audio.transcriptions.create({
  file: audioFile.buffer,
  model: 'whisper-1',
  language: 'de',  // Deutsch only
  response_format: 'text'
});
```

---

### 3. Produkt-Tabelle - Max 10 Produkte
**Entscheidung:** Maximal 10 Produkte pro Verhandlung

**Validation:**
```typescript
interface ProduktTabelleProps {
  produkte: Produkt[];  // Max 10
  onChange: (produkte: Produkt[]) => void;
}

const addProdukt = () => {
  if (produkte.length >= 10) {
    toast({
      title: "Limit erreicht",
      description: "Maximal 10 Produkte pro Verhandlung möglich",
      variant: "destructive"
    });
    return;
  }
  // ... add logic
};
```

---

## 📅 Aktualisierter Zeitplan

### Sprint 1: Foundation (Tag 1-2) - UNVERÄNDERT
1. i18n Setup (2-3h)
2. Database Schema (2h)
3. Voice Input Component (3-4h, Deutsch only)

### Sprint 2: Configuration Screens (Tag 3-4) - UNVERÄNDERT
1. Screen 1: Grundeinstellungen (4-6h)
2. Screen 2: Dimensionen + Produkt-Tabelle (6-8h, max 10 Produkte)
3. Screen 3: Taktiken & Techniken (2h)
4. Screen 4: Gegenseite (3-4h, mit Voice)
5. Screen 5: Review (4-6h)

### Sprint 3: Market Intelligence (Tag 5) - AKTUALISIERT
1. ✨ **Gemini Flash Setup** (1-2h)
   - Python Script erstellen
   - Google API Key konfigurieren
   - Node.js Bridge implementieren

2. ✨ **Prompt Engineering** (2-3h)
   - Rollen-spezifische Prompts (Buyer/Seller)
   - JSON Schema validation
   - Error handling

3. **UI Integration** (2-3h)
   - Review Screen component
   - Loading states
   - Aspekte-Anzeige mit Quellen

**Total Sprint 3:** 5-8 Stunden (statt 6-8)

### Sprint 4: Testing & Polish (Tag 6) - UNVERÄNDERT
1. Integration Testing (3-4h)
2. UI/UX Polish (2-3h)
3. Documentation (2h)

---

## 🚀 Nächste Schritte

### Sofort starten mit Sprint 1:

1. **i18n Setup** (2-3h)
   ```bash
   npm install i18next react-i18next i18next-browser-languagedetector
   ```

2. **Database Schema** (2h)
   ```sql
   -- Neue Tabellen für Produkte und Konditionen
   CREATE TABLE products (...)
   CREATE TABLE uebergreifende_konditionen (...)
   ALTER TABLE negotiations ADD COLUMN ...
   ```

3. **Voice Input** (3-4h)
   - Component mit Aufnahme-Funktionalität
   - Whisper API Integration (Deutsch)
   - Backend Endpoint

**Sollen wir mit Sprint 1 starten?** 🚀
