# Phase 2: Konfiguration-Enhancement Plan

**Basis:** Nutzer-Feedback aus Interviews (Updates Config.md)
**Datum:** 2025-10-01
**Priorität:** CRITICAL - Direkte Nutzeranforderungen

---

## 🎯 Kernziele

1. **Komplett deutsche UI** - Alle Screens auf Deutsch
2. **Verbesserte Benutzerführung** - 5 optimierte Konfigurations-Screens
3. **Produktfokus** - Mehrere Produkte in Tabellenform verhandeln
4. **Erweiterte Kontext-Eingabe** - Voice Input & Market Intelligence
5. **Power-Balance Modeling** - Machtverteilung konfigurierbar

---

## 📋 Implementierungs-Übersicht

### Screen 1: Grundeinstellungen & Kontext ✨ NEU
**Bisher:** Basic Context (title, role, type, relationship)
**Jetzt:** Erweitert um Macht-Balance & Verhandlungsfrequenz

**Neue Felder:**
```typescript
interface GrundeinstellungenStep {
  // Bestehend
  title: string;                    // Verhandlungstitel
  userRole: "buyer" | "seller";     // Ihre Rolle
  negotiationType: "one-shot" | "multi-year";

  // NEU: Unternehmensbekanntheit
  companyKnown: boolean;            // Ist das Unternehmen bekannt?
  counterpartKnown: boolean;        // Ist der Verhandlungspartner bekannt?

  // NEU: Verhandlungsfrequenz
  negotiationFrequency: "yearly" | "quarterly" | "monthly" | "ongoing";

  // NEU: Macht-Balance (Slider 0-100)
  powerBalance: number;             // 0 = Verkäufer mächtiger, 50 = balanced, 100 = Käufer mächtiger

  // NEU: Max Runden (Slider 1-15)
  maxRounds: number;                // Default: 6, Range: 1-15

  // NEU: Wichtiger Kontext (mit Voice Input)
  importantContext: string;         // Freitext + Whisper Transkription

  // ENTFERNT: additionalComments (nicht mehr benötigt)
}
```

**UI-Komponenten:**
- Toggle: "Unternehmen bekannt / unbekannt"
- Toggle: "Verhandlungspartner im Unternehmen bekannt"
- Dropdown: Verhandlungsfrequenz
- **Slider:** Macht-Balance (Buyer ←→ Seller Power)
- **Slider:** Max. Verhandlungsrunden (1-15)
- **Voice Input Button** für "Wichtiger Kontext" (Whisper API)

---

### Screen 2: Verhandlungsdimensionen ⚡ ÜBERARBEITET
**Bisher:** 4 fixe Dimensionen (Volumen, Preis, Laufzeit, Zahlungskonditionen)
**Jetzt:** Flexible Konditionen + Produkt-Tabelle

#### Teil A: Übergreifende Konditionen
Frei konfigurierbare Dimensionen (z.B. Lieferzeit, Zahlungsziel, etc.)

```typescript
interface ÜbergreifendeKondition {
  id: string;
  name: string;                      // "Lieferzeit", "Zahlungsziel"
  einheit: string;                   // "Tage", "Monate", "%"

  // Rollenabhängige Min/Max
  minWert?: number;                  // Nur für Verkäufer bei Preis, etc.
  maxWert?: number;                  // Nur für Käufer bei Preis, etc.
  zielWert: number;                  // Immer vorhanden

  priorität: 1 | 2 | 3;             // 1 = Must-have, 3 = Nice-to-have
}
```

**Beispiel:**
| Kondition | Einheit | Min (Rolle) | Ziel | Max (Rolle) | Priorität |
|-----------|---------|-------------|------|-------------|-----------|
| Lieferzeit | Tage | 30 | 45 | 60 | 1 |
| Zahlungsziel | Tage | - (Käufer) | 30 | 45 (Käufer) | 2 |

#### Teil B: Produkt-Tabelle ✨ KOMPLETT NEU
Mehrere Produkte verhandelbar, erweiterbare Zeilen

```typescript
interface Produkt {
  id: string;
  produktName: string;               // "Milka Schokolade 100g"
  zielPreis: number;                 // 1.50 EUR
  minMaxPreis: number;               // Role-dependent: Min für Seller, Max für Buyer
  geschätztesVolumen: number;        // 10000 Stück
}
```

**UI:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Produkte                                          [+ Hinzufügen]│
├────────────┬──────────┬─────────────┬─────────────────────────────┤
│ Produktname│ Zielpreis│ Min/Max*    │ Geschätztes Volumen        │
├────────────┼──────────┼─────────────┼─────────────────────────────┤
│ Milka 100g │ 1.50 €   │ 1.20 € (min)│ 10.000 Stück               │
│ Oreo 176g  │ 2.30 €   │ 2.00 € (min)│ 5.000 Stück                │
│ [Neu]      │          │             │                            │
└────────────┴──────────┴─────────────┴─────────────────────────────┘

* Min/Max abhängig von Ihrer Rolle (Käufer: Max Preis, Verkäufer: Min Preis)
```

**Logik:**
- **Käufer:** Sieht "Max. Preis" (den sie maximal zahlen wollen)
- **Verkäufer:** Sieht "Min. Preis" (den sie mindestens verlangen)
- Dynamisch erweiterbar (+ Button)
- Zeilen löschbar (X Icon)

---

### Screen 3: Taktiken & Techniken (Kombiniert) ✅ VEREINFACHT
**Bisher:** 2 separate Screens (Step 3 & 4)
**Jetzt:** 1 kombinierter Screen

```typescript
interface TaktikenTechnikenStep {
  selectedTechniques: string[];      // IDs der Beeinflussung-Techniken
  selectedTactics: string[];         // IDs der Verhandlungstaktiken
}
```

**UI:**
```
┌──────────────────────────────────────────────────────────────┐
│  Beeinflussung-Techniken                                     │
├──────────────────────────────────────────────────────────────┤
│  ☑ Appell an Werte                                          │
│  ☑ Logisches Überzeugen                                     │
│  ☐ Konsultieren                                             │
│  ☐ Tauschhandel                                             │
│  ... (alle 10 Techniken)                                    │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Verhandlungstaktiken                                        │
├──────────────────────────────────────────────────────────────┤
│  ☑ Extremes Erstangebot                                     │
│  ☑ Framing-Effekt                                           │
│  ☐ Guter-Kerl/Böser-Kerl                                    │
│  ... (alle Taktiken)                                        │
└──────────────────────────────────────────────────────────────┘
```

**Vorteil:** Schnellere Navigation, weniger Klicks

---

### Screen 4: Gegenseite Konfigurieren ✨ ÜBERARBEITET
**Bisher:** Personality + ZOPA Distance
**Jetzt:** Erweitert mit Freitext & Verhandlungsmodus

```typescript
interface GegenseiteStep {
  // NEU: Freitext-Beschreibung (mit Voice Input)
  beschreibungGegenseite: string;    // "Großer Einzelhändler, sehr preissensitiv..."

  // ÜBERARBEITET: Verhandlungsmodus
  verhandlungsModus: "kooperativ" | "moderat" | "aggressiv" | "sehr-aggressiv";

  // Bestehend
  vermuteteDistanz: "close" | "medium" | "far" | "all-distances";

  // Optional: Personality Selection (falls gewünscht)
  counterpartPersonality?: string;
}
```

**UI:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Beschreibung der Gegenseite                      [🎤 Voice]    │
├─────────────────────────────────────────────────────────────────┤
│  [Großer Einzelhändler mit 500 Filialen. Bekannt für harte    ]│
│  [Preisverhandlungen. Langjährige Partnerschaft (5 Jahre).    ]│
│  [Jährliche Verträge, hohes Volumen.]                          │
└─────────────────────────────────────────────────────────────────┘

Verhandlungsmodus der Gegenseite:
  ○ Kooperativ      (Win-Win fokussiert)
  ● Moderat         (Ausgewogen)
  ○ Aggressiv       (Competitive)
  ○ Sehr Aggressiv  (Zero-sum mindset)

Vermutete Distanz zur eigenen Position:
  ○ Nah    (ZOPA Überschneidung wahrscheinlich)
  ● Mittel (Einigung möglich aber schwierig)
  ○ Weit   (Großer Verhandlungsspielraum nötig)
```

---

### Screen 5: Review & Market Intelligence ⚡ ERWEITERT
**Bisher:** Simple Review
**Jetzt:** Review + AI-generierte Marktinformationen

```typescript
interface ReviewStep {
  // Zusammenfassung aller Einstellungen
  summary: {
    grundeinstellungen: GrundeinstellungenStep;
    dimensionen: { konditionen: Kondition[], produkte: Produkt[] };
    taktikenTechniken: { techniques: string[], tactics: string[] };
    gegenseite: GegenseiteStep;
  };

  // NEU: Market Intelligence
  marketIntelligence: {
    loading: boolean;
    data?: {
      rohstoffPreise: string;        // "Kakao: +15% YoY"
      kundenBedarfe: string;         // "Trend: Bio-Produkte +30%"
      wettbewerberAktionen: string;  // "Competitor X senkte Preise um 10%"
      regulatorisches: string;       // "Neue EU-Verpackungsrichtlinie ab Q2"
      marktStimmung: string;         // "Nachfrage stabil, Angebot knapp"
    };
    error?: string;
  };

  // Berechnete Simulationsläufe
  calculatedSimulations: number;     // techniques.length × tactics.length
}
```

**UI:**
```
┌─────────────────────────────────────────────────────────────────┐
│  📊 Ihre Konfiguration                                          │
├─────────────────────────────────────────────────────────────────┤
│  Verhandlung: Milka Schokolade Jahresvertrag 2025              │
│  Rolle: Verkäufer | Macht-Balance: Ausgeglichen (50/50)        │
│  Max Runden: 10 | Frequenz: Jährlich                           │
│                                                                 │
│  Produkte: 2 Produkte (Milka 100g, Oreo 176g)                  │
│  Konditionen: 2 (Lieferzeit, Zahlungsziel)                     │
│  Techniken: 3 | Taktiken: 4                                    │
│  → Simulationsläufe: 12 (3×4)                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  🌍 KI-Marktanalyse                           [🔄 Neu laden]    │
├─────────────────────────────────────────────────────────────────┤
│  ✓ Rohstoffpreise: Kakao +15% YoY (Lieferengpässe Westafrika) │
│  ✓ Kundentrends: Bio-Produkte +30%, Preissensitivität hoch    │
│  ✓ Wettbewerb: Competitor X senkte Preise um 10% (Q3 Aktion)  │
│  ✓ Regulatorisches: Neue EU-Verpackungsrichtlinie ab Q2/25    │
│  ✓ Marktstimmung: Nachfrage stabil, Rohstoffangebot knapp     │
│                                                                 │
│  💡 Empfehlung: Betonen Sie Liefersicherheit und Qualität      │
│     anstelle von Preissenkungen aufgrund Rohstoffkosten.       │
└─────────────────────────────────────────────────────────────────┘

[Zurück]  [Simulation Starten →]
```

**Market Intelligence Implementation:**
```typescript
// API Call on Review Screen Mount
async function fetchMarketIntelligence(
  produkte: Produkt[],
  kontext: string
): Promise<MarketIntelligenceData> {
  // 1. Web Search (Tavily API or similar)
  const searchResults = await searchWeb({
    query: `market analysis ${produkte.map(p => p.produktName).join(', ')} prices trends`,
    maxResults: 5
  });

  // 2. LLM Summarization (GPT-4o)
  const summary = await llm.summarize({
    context: kontext,
    products: produkte,
    webResults: searchResults,
    prompt: `Fasse die 5 wichtigsten Marktinformationen zusammen für eine
             Verhandlung über ${produkte.map(p => p.produktName).join(', ')}.
             Kategorien: Rohstoffpreise, Kundenbedarfe, Wettbewerb, Regulatorisches, Marktstimmung`
  });

  return summary;
}
```

---

## 🔧 Technische Implementierung

### 1. Internationalisierung (i18n) 🌍
**Priorität:** CRITICAL
**Aufwand:** Medium (2-3 Stunden)

**Bibliothek:** `react-i18next`

```bash
npm install i18next react-i18next i18next-browser-languagedetector
```

**Struktur:**
```
client/src/
├── i18n/
│   ├── index.ts              # i18n Config
│   ├── de/
│   │   ├── common.json       # Buttons, Labels
│   │   ├── configure.json    # Configuration Wizard
│   │   ├── negotiations.json # Negotiations Page
│   │   └── analytics.json    # Analytics Dashboard
│   └── en/                   # (Optional) English fallback
│       └── ...
```

**Beispiel `de/configure.json`:**
```json
{
  "steps": {
    "grundeinstellungen": "Grundeinstellungen",
    "dimensionen": "Verhandlungsdimensionen",
    "taktiken": "Taktiken & Techniken",
    "gegenseite": "Gegenseite",
    "review": "Überprüfen"
  },
  "grundeinstellungen": {
    "title": {
      "label": "Verhandlungstitel",
      "placeholder": "z.B. Milka Schokolade Jahresvertrag 2025"
    },
    "userRole": {
      "label": "Ihre Rolle",
      "buyer": "Käufer",
      "seller": "Verkäufer"
    },
    "companyKnown": {
      "label": "Ist das Unternehmen bekannt?",
      "yes": "Ja, bekanntes Unternehmen",
      "no": "Nein, erstmaliger Kontakt"
    },
    "powerBalance": {
      "label": "Macht-Balance",
      "sellerPower": "Verkäufer mächtiger",
      "balanced": "Ausgeglichen",
      "buyerPower": "Käufer mächtiger"
    }
  }
}
```

**Integration:**
```typescript
import { useTranslation } from 'react-i18next';

function GrundeinstellungenStep() {
  const { t } = useTranslation('configure');

  return (
    <div>
      <h2>{t('grundeinstellungen.title.label')}</h2>
      <Input placeholder={t('grundeinstellungen.title.placeholder')} />
    </div>
  );
}
```

---

### 2. Voice Input Integration 🎤
**Priorität:** HIGH
**Aufwand:** Medium (3-4 Stunden)

**API:** OpenAI Whisper (bereits im Projekt verfügbar)

**Komponente:**
```typescript
// client/src/components/VoiceInput.tsx
import { useState } from 'react';
import { Mic, MicOff, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  language?: string;
}

export function VoiceInput({ onTranscript, language = 'de' }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const startRecording = async () => {
    setIsRecording(true);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(chunks, { type: 'audio/webm' });
      await transcribeAudio(audioBlob);
      stream.getTracks().forEach(track => track.stop());
    };

    mediaRecorder.start();

    // Auto-stop after 60 seconds
    setTimeout(() => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        setIsRecording(false);
      }
    }, 60000);
  };

  const stopRecording = () => {
    setIsRecording(false);
    // mediaRecorder.stop() called automatically
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('language', language);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData
      });

      const { text } = await response.json();
      onTranscript(text);
    } catch (error) {
      console.error('Transcription failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Button
      type="button"
      variant={isRecording ? 'destructive' : 'outline'}
      size="icon"
      onClick={isRecording ? stopRecording : startRecording}
      disabled={isProcessing}
    >
      {isProcessing ? (
        <Loader className="h-4 w-4 animate-spin" />
      ) : isRecording ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}
```

**Backend Endpoint:**
```typescript
// server/routes/transcribe.ts
import { Router } from 'express';
import multer from 'multer';
import { openai } from '../services/openai.js';

const upload = multer({ storage: multer.memoryStorage() });

export function createTranscribeRouter(): Router {
  const router = Router();

  router.post('/', upload.single('file'), async (req, res) => {
    try {
      const audioFile = req.file;
      const language = req.body.language || 'de';

      if (!audioFile) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile.buffer,
        model: 'whisper-1',
        language: language
      });

      res.json({ text: transcription.text });
    } catch (error) {
      console.error('Transcription error:', error);
      res.status(500).json({ error: 'Transcription failed' });
    }
  });

  return router;
}
```

---

### 3. Produkt-Tabelle Komponente 📦
**Priorität:** CRITICAL
**Aufwand:** Medium (2-3 Stunden)

```typescript
// client/src/components/configure/ProduktTabelle.tsx
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Produkt {
  id: string;
  produktName: string;
  zielPreis: number;
  minMaxPreis: number;
  geschätztesVolumen: number;
}

interface ProduktTabelleProps {
  produkte: Produkt[];
  onChange: (produkte: Produkt[]) => void;
  userRole: 'buyer' | 'seller';
}

export function ProduktTabelle({ produkte, onChange, userRole }: ProduktTabelleProps) {
  const minMaxLabel = userRole === 'buyer' ? 'Max. Preis' : 'Min. Preis';

  const addProdukt = () => {
    onChange([
      ...produkte,
      {
        id: crypto.randomUUID(),
        produktName: '',
        zielPreis: 0,
        minMaxPreis: 0,
        geschätztesVolumen: 0
      }
    ]);
  };

  const removeProdukt = (id: string) => {
    onChange(produkte.filter(p => p.id !== id));
  };

  const updateProdukt = (id: string, field: keyof Produkt, value: any) => {
    onChange(produkte.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Produkte</h3>
        <Button onClick={addProdukt} variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Hinzufügen
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produktname</TableHead>
            <TableHead>Zielpreis (€)</TableHead>
            <TableHead>{minMaxLabel} (€)</TableHead>
            <TableHead>Geschätztes Volumen</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {produkte.map((produkt) => (
            <TableRow key={produkt.id}>
              <TableCell>
                <Input
                  value={produkt.produktName}
                  onChange={(e) => updateProdukt(produkt.id, 'produktName', e.target.value)}
                  placeholder="z.B. Milka 100g"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  value={produkt.zielPreis}
                  onChange={(e) => updateProdukt(produkt.id, 'zielPreis', parseFloat(e.target.value))}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  value={produkt.minMaxPreis}
                  onChange={(e) => updateProdukt(produkt.id, 'minMaxPreis', parseFloat(e.target.value))}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={produkt.geschätztesVolumen}
                  onChange={(e) => updateProdukt(produkt.id, 'geschätztesVolumen', parseInt(e.target.value))}
                  placeholder="Stück"
                />
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeProdukt(produkt.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

---

### 4. Market Intelligence Feature 🌍
**Priorität:** MEDIUM (kann Phase 2.5 werden)
**Aufwand:** High (6-8 Stunden)

**Dependencies:**
- Web Search API (Tavily, Serper, or Exa)
- LLM Summarization (bereits vorhanden - OpenAI)

```bash
npm install tavily  # oder exa-js
```

**Implementation:**
```typescript
// server/services/market-intelligence.ts
import { TavilySearchAPI } from 'tavily';
import { openai } from './openai.js';

const tavily = new TavilySearchAPI(process.env.TAVILY_API_KEY);

export interface MarketIntelligenceData {
  rohstoffPreise: string;
  kundenBedarfe: string;
  wettbewerberAktionen: string;
  regulatorisches: string;
  marktStimmung: string;
  empfehlung: string;
}

export async function generateMarketIntelligence(
  produkte: Array<{ produktName: string }>,
  kontext: string
): Promise<MarketIntelligenceData> {
  // 1. Web Search
  const searchQuery = `${produkte.map(p => p.produktName).join(' ')} market trends prices analysis ${new Date().getFullYear()}`;

  const searchResults = await tavily.search(searchQuery, {
    maxResults: 5,
    searchDepth: 'advanced'
  });

  // 2. LLM Analysis
  const prompt = `
Du bist ein Marktanalyst. Analysiere folgende Informationen für eine Verhandlung:

Produkte: ${produkte.map(p => p.produktName).join(', ')}
Kontext: ${kontext}

Web-Recherche Ergebnisse:
${searchResults.results.map(r => `- ${r.title}: ${r.content}`).join('\n')}

Erstelle eine strukturierte Zusammenfassung mit folgenden Kategorien:
1. Rohstoffpreise (aktuelle Entwicklung, YoY Veränderung)
2. Kundenbedarfe (Trends, Nachfrageentwicklung)
3. Wettbewerber-Aktionen (Preisänderungen, Marketingkampagnen)
4. Regulatorisches (neue Gesetze, Vorschriften)
5. Marktstimmung (allgemeine Lage, Prognose)
6. Empfehlung (strategische Hinweise für die Verhandlung)

Format: JSON mit Keys: rohstoffPreise, kundenBedarfe, wettbewerberAktionen, regulatorisches, marktStimmung, empfehlung
Jeder Wert sollte ein prägnanter deutscher Satz sein (max 150 Zeichen).
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'Du bist ein Marktanalyst.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' }
  });

  const data = JSON.parse(response.choices[0].message.content || '{}');

  return {
    rohstoffPreise: data.rohstoffPreise || 'Keine Daten verfügbar',
    kundenBedarfe: data.kundenBedarfe || 'Keine Daten verfügbar',
    wettbewerberAktionen: data.wettbewerberAktionen || 'Keine Daten verfügbar',
    regulatorisches: data.regulatorisches || 'Keine Daten verfügbar',
    marktStimmung: data.marktStimmung || 'Keine Daten verfügbar',
    empfehlung: data.empfehlung || 'Keine Empfehlung verfügbar'
  };
}
```

**API Endpoint:**
```typescript
// server/routes/market-intelligence.ts
router.post('/market-intelligence', async (req, res) => {
  const { produkte, kontext } = req.body;

  try {
    const intelligence = await generateMarketIntelligence(produkte, kontext);
    res.json(intelligence);
  } catch (error) {
    console.error('Market intelligence error:', error);
    res.status(500).json({ error: 'Failed to generate market intelligence' });
  }
});
```

---

## 📅 Implementierungs-Reihenfolge

### Sprint 1: Foundation (Tag 1-2) 🏗️
**Priorität:** CRITICAL
**Aufwand:** 1-2 Tage

1. ✅ **Internationalisierung Setup**
   - Install i18next
   - Create translation files (de/configure.json)
   - Integrate into existing components
   - **Aufwand:** 2-3 Stunden

2. ✅ **Database Schema Updates**
   - Extend negotiations table with new fields
   - Create products table
   - Create übergreifende_konditionen table
   - **Aufwand:** 2 Stunden

```sql
-- New tables
CREATE TABLE products (
  id UUID PRIMARY KEY,
  negotiation_id UUID REFERENCES negotiations(id) ON DELETE CASCADE,
  produkt_name TEXT NOT NULL,
  ziel_preis DECIMAL(15,4) NOT NULL,
  min_max_preis DECIMAL(15,4) NOT NULL,
  geschätztes_volumen INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE uebergreifende_konditionen (
  id UUID PRIMARY KEY,
  negotiation_id UUID REFERENCES negotiations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  einheit TEXT,
  min_wert DECIMAL(15,4),
  max_wert DECIMAL(15,4),
  ziel_wert DECIMAL(15,4) NOT NULL,
  priorität INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Extend negotiations table
ALTER TABLE negotiations ADD COLUMN company_known BOOLEAN DEFAULT false;
ALTER TABLE negotiations ADD COLUMN counterpart_known BOOLEAN DEFAULT false;
ALTER TABLE negotiations ADD COLUMN negotiation_frequency TEXT;
ALTER TABLE negotiations ADD COLUMN power_balance INTEGER DEFAULT 50;
ALTER TABLE negotiations ADD COLUMN verhandlungs_modus TEXT DEFAULT 'moderat';
ALTER TABLE negotiations ADD COLUMN beschreibung_gegenseite TEXT;
```

3. ✅ **Voice Input Component**
   - Create VoiceInput.tsx
   - Backend transcription endpoint
   - Test with German audio
   - **Aufwand:** 3-4 Stunden

---

### Sprint 2: Configuration Screens (Tag 3-4) 🎨
**Priorität:** CRITICAL
**Aufwand:** 2-3 Tage

1. **Screen 1: Grundeinstellungen**
   - Rebuild with new fields
   - Add power balance slider
   - Add max rounds slider
   - Integrate voice input
   - **Aufwand:** 4-6 Stunden

2. **Screen 2: Dimensionen**
   - Build Produkt-Tabelle component
   - Build Übergreifende Konditionen form
   - Role-dependent min/max logic
   - **Aufwand:** 6-8 Stunden

3. **Screen 3: Taktiken & Techniken**
   - Combine existing screens
   - German translations
   - **Aufwand:** 2 Stunden

4. **Screen 4: Gegenseite**
   - Add beschreibung field with voice
   - Add verhandlungsmodus selector
   - **Aufwand:** 3-4 Stunden

5. **Screen 5: Review**
   - Summary display
   - Market Intelligence integration (optional)
   - **Aufwand:** 4-6 Stunden

---

### Sprint 3: Market Intelligence (Tag 5) 🌍
**Priorität:** MEDIUM (kann verschoben werden)
**Aufwand:** 1 Tag

1. **Web Search Integration**
   - Setup Tavily/Exa API
   - Create market intelligence service
   - **Aufwand:** 3-4 Stunden

2. **LLM Summarization**
   - Prompt engineering
   - Response formatting
   - **Aufwand:** 2-3 Stunden

3. **UI Integration**
   - Review screen component
   - Loading states
   - Error handling
   - **Aufwand:** 2 Stunden

---

### Sprint 4: Testing & Polish (Tag 6) ✨
**Priorität:** HIGH
**Aufwand:** 1 Tag

1. **Integration Testing**
   - Test complete flow
   - Test voice input
   - Test product table
   - **Aufwand:** 3-4 Stunden

2. **UI/UX Polish**
   - Responsive design
   - Loading states
   - Error messages
   - **Aufwand:** 2-3 Stunden

3. **Documentation**
   - Update README
   - User guide
   - **Aufwand:** 2 Stunden

---

## 📊 Zusammenfassung

### Total Aufwand:
- **Sprint 1 (Foundation):** 1-2 Tage
- **Sprint 2 (Screens):** 2-3 Tage
- **Sprint 3 (Market Intelligence):** 1 Tag (optional)
- **Sprint 4 (Testing):** 1 Tag

**Gesamt: 5-7 Tage** (ohne Market Intelligence: 4-6 Tage)

### Prioritäten:
1. 🔴 **CRITICAL:** i18n, Database Schema, Screens 1-4
2. 🟡 **HIGH:** Voice Input, Screen 5 (ohne Market Intelligence)
3. 🟢 **MEDIUM:** Market Intelligence Feature

### Deliverables:
- ✅ Komplett deutsche UI
- ✅ 5 optimierte Configuration Screens
- ✅ Produkt-Tabelle mit mehreren Produkten
- ✅ Voice Input für Freitext-Felder
- ✅ Power-Balance & Max Rounds Configuration
- ✅ Verhandlungsmodus Selection
- 🟡 Market Intelligence (optional)

---

## ❓ Offene Fragen

1. **Market Intelligence Priority:**
   - Soll die Market Intelligence sofort implementiert werden oder können wir das in Phase 2.5 verschieben?
   - Tavily API Kosten: ~$4-6 per 1000 searches - Budget OK?

2. **Voice Input Details:**
   - Soll die Spracherkennung nur Deutsch unterstützen oder auch Englisch?
   - Max Aufnahmezeit: 60 Sekunden OK?

3. **Produkt-Tabelle:**
   - Maximale Anzahl Produkte pro Verhandlung? (z.B. 20)
   - CSV Import für Produkt-Bulk-Upload gewünscht?

4. **Database Migration:**
   - Sollen bestehende Verhandlungen migriert werden oder nur neue?

---

Möchtest du mit Sprint 1 (Foundation) starten? Das wäre:
1. ✅ i18n Setup (2-3h)
2. ✅ Database Schema (2h)
3. ✅ Voice Input Component (3-4h)

Dann können wir sofort zu den Configuration Screens übergehen.
