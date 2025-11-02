# Feld-Vergleich: Frontend ↔ Backend ↔ Schema

## Übersicht

Dieses Dokument vergleicht alle Felder zwischen:
- **Schema** (`shared/schema.ts` - `negotiations` table)
- **Frontend CreateNegotiationForm** (Legacy Route)
- **Frontend Configure Page** (Phase2 Route)
- **Backend Legacy Route** (`POST /api/negotiations`)
- **Backend Enhanced Route** (`POST /api/negotiations/enhanced`)
- **Backend Phase2 Route** (`POST /api/negotiations/phase2`)

---

## Kernfelder (Required/Common)

### 1. `id` (UUID, Primary Key)

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ✅ UUID (PK) | ❌ Nicht gesendet | ❌ Nicht gesendet | ❌ Auto-generiert | ❌ Auto-generiert | ❌ Auto-generiert |
| **Status** | ✅ OK (Auto-generiert) | ✅ OK (Auto-generiert) | ✅ OK (Auto-generiert) | ✅ OK (Auto-generiert) | ✅ OK (Auto-generiert) |

### 2. `contextId` (UUID, FK)

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ✅ UUID (FK) | ✅ Gesendet (UUID) | ❌ Nicht gesendet | ✅ Erwartet (UUID) | ⚠️ Nimmt ersten Context | ✅ Erstellt Custom Context |
| **Status** | ✅ OK | ❌ Phase2 erstellt eigenen Context | ✅ OK | ⚠️ Logik: `contexts[0].id` | ✅ OK (Custom Context) |

### 3. `buyerAgentId` (UUID, FK)

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ✅ UUID (FK) | ✅ Gesendet (UUID) | ❌ Nicht gesendet | ✅ Erwartet (UUID) | ⚠️ Logik: `agents[0].id` | ⚠️ Logik: `agents[0].id` |
| **Status** | ✅ OK | ❌ Phase2 bestimmt automatisch | ✅ OK | ⚠️ Unterschiedliche Logik | ⚠️ Unterschiedliche Logik |

### 4. `sellerAgentId` (UUID, FK)

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ✅ UUID (FK) | ✅ Gesendet (UUID) | ❌ Nicht gesendet | ✅ Erwartet (UUID) | ⚠️ Logik: `agents[1].id` | ⚠️ Logik: `agents[1].id` |
| **Status** | ✅ OK | ❌ Phase2 bestimmt automatisch | ✅ OK | ⚠️ Unterschiedliche Logik | ⚠️ Unterschiedliche Logik |

### 5. `userRole` ("buyer" | "seller")

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ✅ text (required) | ✅ Gesendet (enum) | ✅ Gesendet (enum) | ✅ Erwartet (enum) | ✅ Erwartet (enum) | ✅ Erwartet (enum) |
| **Status** | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK |

### 6. `maxRounds` (integer)

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ✅ integer (default: 10) | ✅ Gesendet (1-50) | ✅ Gesendet (1-15) | ✅ Erwartet (1-100) | ❌ Nicht erwartet | ✅ Erwartet (1-15) |
| **Status** | ⚠️ Frontend limitiert auf 50 | ⚠️ Frontend limitiert auf 15 | ⚠️ Backend akzeptiert 1-100 | ❌ Fehlt in Enhanced | ⚠️ Unterschiedliche Limits |

**Problem**: Drei verschiedene Limits (50, 15, 100)

---

## Business Context Felder

### 7. `title` (text)

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ✅ text (default: "Untitled Negotiation") | ❌ Nicht gesendet | ✅ Gesendet | ❌ Nicht erwartet | ✅ Erwartet (required) | ✅ Erwartet (required) |
| **Status** | ❌ Fehlt → Default | ✅ OK | ❌ Fehlt → Default | ✅ OK | ✅ OK |

### 8. `negotiationType` ("one-shot" | "multi-year")

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ✅ text (default: "one-shot") | ❌ Nicht gesendet | ✅ Gesendet | ❌ Nicht erwartet | ✅ Erwartet (enum) | ✅ Erwartet (enum) |
| **Status** | ❌ Fehlt → Default | ✅ OK | ❌ Fehlt → Default | ✅ OK | ✅ OK |

### 9. `relationshipType` ("first" | "long-standing")

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ✅ text (default: "first") | ❌ Nicht gesendet | ⚠️ Abgeleitet von `counterpartKnown` | ❌ Nicht erwartet | ✅ Erwartet (enum) | ⚠️ Abgeleitet: `counterpartKnown ? "long-standing" : "first"` |
| **Status** | ❌ Fehlt → Default | ⚠️ Indirekt | ❌ Fehlt → Default | ✅ OK | ⚠️ Indirekt |

### 10. `productMarketDescription` (text, nullable)

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ✅ text (nullable) | ❌ Nicht gesendet | ✅ Gesendet als `marktProduktKontext` | ❌ Nicht erwartet | ✅ Erwartet (optional) | ✅ Erwartet (optional) |
| **Status** | ❌ Fehlt | ✅ OK | ❌ Fehlt | ✅ OK | ✅ OK |

### 11. `additionalComments` (text, nullable)

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ✅ text (nullable) | ❌ Nicht gesendet | ✅ Gesendet als `wichtigerKontext` | ❌ Nicht erwartet | ✅ Erwartet (optional) | ✅ Erwartet (optional) |
| **Status** | ❌ Fehlt | ✅ OK | ❌ Fehlt | ✅ OK | ✅ OK |

---

## Selection Felder

### 12. `selectedTechniques` (UUID[])

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ✅ UUID[] (default: []) | ✅ Gesendet (UUID[]) | ✅ Gesendet als `selectedTechniqueIds` | ✅ Erwartet (UUID[]) | ⚠️ Akzeptiert Name oder UUID | ✅ Erwartet (UUID[]) |
| **Status** | ✅ OK | ✅ OK | ✅ OK | ⚠️ Konvertiert Name→UUID | ✅ OK |

### 13. `selectedTactics` (UUID[])

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ✅ UUID[] (default: []) | ✅ Gesendet (UUID[]) | ✅ Gesendet als `selectedTacticIds` | ✅ Erwartet (UUID[]) | ⚠️ Akzeptiert Name oder UUID | ✅ Erwartet (UUID[]) |
| **Status** | ✅ OK | ✅ OK | ✅ OK | ⚠️ Konvertiert Name→UUID | ✅ OK |

---

## Counterpart Configuration

### 14. `counterpartPersonality` (text, nullable)

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ✅ text (nullable) | ❌ Nicht gesendet | ✅ Gesendet als `beschreibungGegenseite` | ❌ Nicht erwartet | ✅ Erwartet (optional) | ⚠️ Gespeichert als `beschreibungGegenseite` |
| **Status** | ❌ Fehlt | ✅ OK | ❌ Fehlt | ✅ OK | ⚠️ Feldname-Mismatch |

### 15. `zopaDistance` ("close" | "medium" | "far" | null)

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ✅ text (nullable) | ❌ Nicht gesendet | ⚠️ Gesendet als `verhandlungsModus` | ❌ Nicht erwartet | ✅ Erwartet (optional) | ⚠️ Gespeichert als `verhandlungsModus` |
| **Status** | ❌ Fehlt | ⚠️ Feldname-Mismatch | ❌ Fehlt | ✅ OK | ⚠️ Feldname-Mismatch |

---

## DEPRECATED: ZOPA Felder

### 16. `userZopa` (JSONB, DEPRECATED)

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ⚠️ JSONB (DEPRECATED) | ✅ Gesendet | ⚠️ Default-Werte gesetzt | ✅ Erwartet | ❌ Nicht erwartet | ⚠️ Default-Werte gesetzt |
| **Format** | `{volumen: {min,max,target}, preis: {...}, laufzeit: {...}, zahlungskonditionen: {...}}` | | | | |

**Status**: ❌ DEPRECATED - Sollte durch `negotiationDimensions` ersetzt werden

### 17. `counterpartDistance` (JSONB, DEPRECATED)

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ⚠️ JSONB (DEPRECATED) | ✅ Gesendet | ⚠️ Default-Werte gesetzt | ✅ Erwartet | ❌ Nicht erwartet | ⚠️ Default-Werte gesetzt |
| **Format** | `{volumen: number, preis: number, laufzeit: number, zahlungskonditionen: number}` | | | | |

**Status**: ❌ DEPRECATED - Sollte durch `negotiationDimensions` ersetzt werden

---

## Neue: Dimensions (Enhanced Route)

### 18. `dimensions` → `negotiationDimensions` Tabelle

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ✅ Tabelle `negotiationDimensions` | ❌ Nicht verwendet | ⚠️ Als `konditionen` gesendet | ❌ Nicht verwendet | ✅ Erwartet als Array | ⚠️ Als `konditionen` gesendet |
| **Format** | `{name, minValue, maxValue, targetValue, priority, unit}` | | | | |

**Status**: ✅ Neue Struktur, aber Legacy Frontend verwendet sie nicht

---

## Phase2 Spezifische Felder (Nicht im Schema)

### 19. `companyKnown` (boolean)

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ❌ Nicht im Schema | ❌ Nicht gesendet | ✅ Gesendet | ❌ Nicht erwartet | ❌ Nicht erwartet | ✅ Erwartet (optional) |
| **Status** | ❌ Fehlt im Schema | ❌ Nicht gesendet | ❌ Nicht erwartet | ❌ Nicht erwartet | ✅ Wird verwendet für `relationshipType` |

### 20. `counterpartKnown` (boolean)

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ❌ Nicht im Schema | ❌ Nicht gesendet | ✅ Gesendet | ❌ Nicht erwartet | ❌ Nicht erwartet | ✅ Erwartet (optional) |
| **Status** | ❌ Fehlt im Schema | ❌ Nicht gesendet | ❌ Nicht erwartet | ❌ Nicht erwartet | ✅ Wird verwendet für `relationshipType` |

### 21. `negotiationFrequency` ("yearly" | "quarterly" | "monthly" | "ongoing")

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ❌ Nicht im Schema | ❌ Nicht gesendet | ✅ Gesendet | ❌ Nicht erwartet | ❌ Nicht erwartet | ✅ Erwartet (optional) |
| **Status** | ❌ Fehlt im Schema | ❌ Nicht gesendet | ❌ Nicht erwartet | ❌ Nicht erwartet | ✅ Wird empfangen, aber nicht gespeichert |

### 22. `powerBalance` (integer, 0-100)

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ❌ Nicht im Schema | ❌ Nicht gesendet | ✅ Gesendet | ❌ Nicht erwartet | ❌ Nicht erwartet | ✅ Erwartet (optional) |
| **Status** | ❌ Fehlt im Schema | ❌ Nicht gesendet | ❌ Nicht erwartet | ❌ Nicht erwartet | ✅ Wird empfangen, aber nicht gespeichert |

### 23. `marktProduktKontext` (string)

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ⚠️ Mapped zu `productMarketDescription` | ❌ Nicht gesendet | ✅ Gesendet | ❌ Nicht erwartet | ❌ Nicht erwartet | ✅ Erwartet (optional) |
| **Status** | ✅ Gespeichert als `productMarketDescription` | ❌ Nicht gesendet | ❌ Nicht erwartet | ❌ Nicht erwartet | ✅ OK |

### 24. `wichtigerKontext` (string)

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ⚠️ Mapped zu `additionalComments` | ❌ Nicht gesendet | ✅ Gesendet | ❌ Nicht erwartet | ❌ Nicht erwartet | ✅ Erwartet (optional) |
| **Status** | ✅ Gespeichert als `additionalComments` | ❌ Nicht gesendet | ❌ Nicht erwartet | ❌ Nicht erwartet | ✅ OK |

### 25. `beschreibungGegenseite` (string)

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ⚠️ Mapped zu `counterpartPersonality` | ❌ Nicht gesendet | ✅ Gesendet | ❌ Nicht erwartet | ❌ Nicht erwartet | ✅ Erwartet (optional) |
| **Status** | ✅ Gespeichert als `counterpartPersonality` | ❌ Nicht gesendet | ❌ Nicht erwartet | ❌ Nicht erwartet | ✅ OK |

### 26. `verhandlungsModus` ("kooperativ" | "moderat" | "aggressiv" | "sehr-aggressiv")

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ⚠️ Mapped zu `zopaDistance` | ❌ Nicht gesendet | ✅ Gesendet | ❌ Nicht erwartet | ❌ Nicht erwartet | ✅ Erwartet (optional) |
| **Status** | ⚠️ Gespeichert als `zopaDistance` (aber andere Werte!) | ❌ Nicht gesendet | ❌ Nicht erwartet | ❌ Nicht erwartet | ⚠️ Feldname-Mismatch |

**Problem**: `verhandlungsModus` Werte passen nicht zu `zopaDistance` ("close" | "medium" | "far")

### 27. `geschätzteDistanz` (Record<string, number>)

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ❌ Nicht im Schema | ❌ Nicht gesendet | ✅ Gesendet | ❌ Nicht erwartet | ❌ Nicht erwartet | ✅ Erwartet (optional) |
| **Status** | ❌ Fehlt im Schema | ❌ Nicht gesendet | ❌ Nicht erwartet | ❌ Nicht erwartet | ✅ Wird empfangen, aber nicht gespeichert |

---

## Produkte & Konditionen

### 28. `produkte` → `products` Tabelle

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ✅ Tabelle `products` | ❌ Nicht gesendet | ✅ Gesendet als Array | ❌ Nicht erwartet | ❌ Nicht erwartet | ✅ Erwartet (optional) |
| **Format** | `{produktName, zielPreis, minMaxPreis, geschätztesVolumen}` | | | | |

**Status**: ✅ Phase2 verwendet Produkte, Legacy nicht

### 29. `konditionen` → `negotiationDimensions` Tabelle

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ✅ Tabelle `negotiationDimensions` | ❌ Nicht gesendet | ✅ Gesendet als Array | ❌ Nicht erwartet | ✅ Erwartet als `dimensions` | ✅ Erwartet als `konditionen` |
| **Format** | `{name, einheit, minWert, maxWert, zielWert, priorität}` | | | | |

**Status**: ⚠️ Phase2 verwendet `konditionen`, Enhanced verwendet `dimensions` (gleiche Tabelle, unterschiedliche Feldnamen)

---

## Status Felder

### 30. `status` (text)

| Schema | Legacy Frontend | Phase2 Frontend | Legacy Backend | Enhanced Backend | Phase2 Backend |
|--------|----------------|----------------|----------------|------------------|----------------|
| ✅ text (default: "pending") | ❌ Nicht gesendet | ❌ Nicht gesendet | ✅ Setzt "pending" | ✅ Setzt "configured" | ✅ Setzt "configured" |
| **Status** | ✅ OK | ✅ OK | ✅ OK | ⚠️ Unterschiedlicher Status | ⚠️ Unterschiedlicher Status |

**Problem**: Legacy = "pending", Enhanced/Phase2 = "configured"

---

## Zusammenfassung: Kritische Unterschiede

### ❌ Fehlende Felder im Legacy Frontend

1. `title` → Default: "Untitled Negotiation"
2. `negotiationType` → Default: "one-shot"
3. `relationshipType` → Default: "first"
4. `productMarketDescription` → null
5. `additionalComments` → null
6. `counterpartPersonality` → null
7. `zopaDistance` → null

### ⚠️ Inkonsistenzen

1. **maxRounds Limits**: 50 (Legacy FE) vs 15 (Phase2 FE) vs 100 (Legacy BE)
2. **Status**: "pending" (Legacy) vs "configured" (Enhanced/Phase2)
3. **Agent-Zuordnung**: Direkt (Legacy) vs Automatisch (Enhanced/Phase2)
4. **Context**: Direkt (Legacy) vs Erstellt (Phase2) vs Erster (Enhanced)
5. **ZOPA Format**: JSONB (Legacy) vs Dimensions Tabelle (Enhanced/Phase2)

### ❌ Schema-Probleme

1. `userZopa` und `counterpartDistance` sind DEPRECATED, werden aber noch verwendet
2. Phase2 Felder (`companyKnown`, `powerBalance`, etc.) fehlen im Schema
3. `verhandlungsModus` wird als `zopaDistance` gespeichert, aber Werte passen nicht

---

## Feld-Mapping Matrix

### Legacy Route Flow

```
Frontend → Backend → Schema
─────────────────────────────────────────────────────────
contextId ✅ → ✅ → ✅
buyerAgentId ✅ → ✅ → ✅
sellerAgentId ✅ → ✅ → ✅
maxRounds ✅ (1-50) → ✅ (1-100) → ✅ (default: 10)
selectedTechniques ✅ → ✅ → ✅
selectedTactics ✅ → ✅ → ✅
userRole ✅ → ✅ → ✅
userZopa ✅ → ✅ → ⚠️ DEPRECATED
counterpartDistance ✅ → ✅ → ⚠️ DEPRECATED
sonderinteressen ✅ → ✅ → ✅
─────────────────────────────────────────────────────────
title ❌ → ❌ → ✅ (default)
negotiationType ❌ → ❌ → ✅ (default)
relationshipType ❌ → ❌ → ✅ (default)
productMarketDescription ❌ → ❌ → ✅ (null)
additionalComments ❌ → ❌ → ✅ (null)
counterpartPersonality ❌ → ❌ → ✅ (null)
zopaDistance ❌ → ❌ → ✅ (null)
```

### Enhanced Route Flow

```
Frontend → Backend → Schema
─────────────────────────────────────────────────────────
title ✅ → ✅ → ✅
userRole ✅ → ✅ → ✅
negotiationType ✅ → ✅ → ✅
relationshipType ✅ → ✅ → ✅
productMarketDescription ✅ → ✅ → ✅
additionalComments ✅ → ✅ → ✅
selectedTechniques ✅ → ⚠️ (Name→UUID) → ✅
selectedTactics ✅ → ⚠️ (Name→UUID) → ✅
counterpartPersonality ✅ → ✅ → ✅
zopaDistance ✅ → ✅ → ✅
dimensions ✅ → ✅ → ✅ (negotiationDimensions Tabelle)
─────────────────────────────────────────────────────────
contextId ❌ → ⚠️ (nimmt ersten) → ✅
buyerAgentId ❌ → ⚠️ (agents[0]) → ✅
sellerAgentId ❌ → ⚠️ (agents[1]) → ✅
maxRounds ❌ → ❌ → ✅ (default)
```

### Phase2 Route Flow

```
Frontend → Backend → Schema
─────────────────────────────────────────────────────────
title ✅ → ✅ → ✅
userRole ✅ → ✅ → ✅
negotiationType ✅ → ✅ → ✅
maxRounds ✅ (1-15) → ✅ (1-15) → ✅
selectedTechniqueIds ✅ → ✅ → ✅
selectedTacticIds ✅ → ✅ → ✅
marktProduktKontext ✅ → ✅ → ✅ (productMarketDescription)
wichtigerKontext ✅ → ✅ → ✅ (additionalComments)
beschreibungGegenseite ✅ → ✅ → ✅ (counterpartPersonality)
verhandlungsModus ✅ → ⚠️ → ✅ (zopaDistance, aber Werte passen nicht!)
produkte ✅ → ✅ → ✅ (products Tabelle)
konditionen ✅ → ✅ → ✅ (negotiationDimensions Tabelle)
─────────────────────────────────────────────────────────
contextId ❌ → ✅ (erstellt Custom Context) → ✅
buyerAgentId ❌ → ⚠️ (agents[0]) → ✅
sellerAgentId ❌ → ⚠️ (agents[1]) → ✅
relationshipType ❌ → ⚠️ (abgeleitet von counterpartKnown) → ✅
companyKnown ✅ → ✅ → ❌ (nicht im Schema)
counterpartKnown ✅ → ✅ → ❌ (nicht im Schema)
negotiationFrequency ✅ → ✅ → ❌ (nicht im Schema)
powerBalance ✅ → ✅ → ❌ (nicht im Schema)
geschätzteDistanz ✅ → ✅ → ❌ (nicht im Schema)
```

---

## Vergleich: Simulation Run Erstellung

### Legacy Route

| Schritt | Action | Erstellt Runs? | Mit Queue? |
|---------|--------|---------------|------------|
| POST `/api/negotiations` | `createNegotiationWithSimulationRuns()` | ✅ Ja | ❌ Nein |
| POST `/api/negotiations/:id/start` | `SimulationQueueService.createQueue()` | ✅ Ja (erneut!) | ✅ Ja |

**Problem**: Doppelte Runs!

### Enhanced Route

| Schritt | Action | Erstellt Runs? | Mit Queue? |
|---------|--------|---------------|------------|
| POST `/api/negotiations/enhanced` | `createNegotiationWithDimensions()` | ❌ Nein | ❌ Nein |
| POST `/api/negotiations/:id/start` | `SimulationQueueService.createQueue()` | ✅ Ja | ✅ Ja |

**Status**: ✅ OK (keine doppelten Runs)

### Phase2 Route

| Schritt | Action | Erstellt Runs? | Mit Queue? |
|---------|--------|---------------|------------|
| POST `/api/negotiations/phase2` | `createNegotiation()` | ❌ Nein | ❌ Nein |
| POST `/api/negotiations/:id/start` | `SimulationQueueService.createQueue()` | ✅ Ja | ✅ Ja |

**Status**: ✅ OK (keine doppelten Runs)

---

## Zusammenfassung: Synchronisations-Status

### ✅ Vollständig synchronisiert

- `id` (Auto-generiert)
- `userRole`
- `selectedTechniques` / `selectedTacticIds`
- `selectedTactics` / `selectedTacticIds`
- `sonderinteressen`

### ⚠️ Teilweise synchronisiert

- `maxRounds` (verschiedene Limits)
- `status` (verschiedene Werte)
- `contextId` (verschiedene Logik)
- `buyerAgentId` / `sellerAgentId` (verschiedene Logik)
- ZOPA Daten (JSONB vs Dimensions Tabelle)

### ❌ Nicht synchronisiert

- `title` (fehlt in Legacy)
- `negotiationType` (fehlt in Legacy)
- `relationshipType` (fehlt in Legacy)
- `productMarketDescription` (fehlt in Legacy)
- `additionalComments` (fehlt in Legacy)
- `counterpartPersonality` (fehlt in Legacy)
- `zopaDistance` (fehlt in Legacy)
- Phase2 Felder (fehlen im Schema)

---

## Kritische Probleme

### 1. Doppelte Simulation Runs (Legacy Route)

**Problem**: Legacy Route erstellt Runs direkt, `/start` erstellt neue Runs über Queue.

**Impact**: 
- Doppelte Runs in Datenbank
- Alte Runs werden nie verarbeitet
- Verwirrung in Analytics

### 2. DEPRECATED Felder werden noch verwendet

**Problem**: `userZopa` und `counterpartDistance` sind DEPRECATED, aber Legacy Route verwendet sie noch.

**Impact**:
- Migration wird schwieriger
- Inkonsistente Datenstrukturen
- Neue Features funktionieren nicht mit Legacy-Daten

### 3. Drei verschiedene Routen ohne klare Strategie

**Problem**: Legacy, Enhanced, Phase2 existieren parallel.

**Impact**:
- Verwirrung für Entwickler
- Inkonsistente Datenstrukturen
- Wartungsaufwand erhöht

### 4. Fehlende Felder im Legacy Frontend

**Problem**: Viele Schema-Felder werden nicht gesendet.

**Impact**:
- Generische Titel ("Untitled Negotiation")
- Default-Werte überall
- Keine Flexibilität für Benutzer

### 5. Feldname-Mismatches (Phase2)

**Problem**: Phase2 verwendet deutsche Feldnamen, die auf andere Schema-Felder gemappt werden.

**Impact**:
- `verhandlungsModus` → `zopaDistance` (aber Werte passen nicht!)
- `beschreibungGegenseite` → `counterpartPersonality`
- Verwirrung bei Datenabfrage

