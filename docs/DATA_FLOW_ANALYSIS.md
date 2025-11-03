# Datenfluss-Analyse: Simulation-Erstellung

## Übersicht

Dieses Dokument analysiert den Datenfluss von der Frontend-Konfiguration bis zur Simulation-Erstellung und identifiziert Synchronisationsprobleme zwischen Frontend, Backend und Datenmodell.

## Aktuelle Architektur

### Drei verschiedene Endpunkte

Das System hat aktuell **drei verschiedene Endpunkte** für die Erstellung von Negotiations:

1. **POST `/api/negotiations`** (Legacy) - Verwendet `userZopa` JSONB
2. **POST `/api/negotiations/enhanced`** - Verwendet `negotiationDimensions` Tabelle
3. **POST `/api/negotiations/phase2`** - Verwendet Produkte + Konditionen

### Frontend-Verwendung

- **`CreateNegotiationForm.tsx`** → Verwendet **POST `/api/negotiations`** (Legacy)
- **`configure.tsx`** → Verwendet **POST `/api/negotiations/phase2`**

---

## Datenfluss: POST `/api/negotiations` (Legacy - Aktuell verwendet)

### 1. Frontend → Backend (Payload)

**Datei**: `client/src/components/CreateNegotiationForm.tsx:98-118`

```typescript
Payload {
  contextId: string (UUID)
  buyerAgentId: string (UUID)
  sellerAgentId: string (UUID)
  maxRounds: number (1-50)
  selectedTechniques: string[] (UUIDs)
  selectedTactics: string[] (UUIDs)
  userRole: "buyer" | "seller"
  userZopa: {
    volumen: { min: number, max: number, target: number }
    preis: { min: number, max: number, target: number }
    laufzeit: { min: number, max: number, target: number }
    zahlungskonditionen: { min: number, max: number, target: number }
  }
  counterpartDistance: {
    volumen: number (-1 to 1)
    preis: number (-1 to 1)
    laufzeit: number (-1 to 1)
    zahlungskonditionen: number (-1 to 1)
  }
  sonderinteressen?: string
}
```

### 2. Backend Validierung

**Datei**: `server/routes/negotiations.ts:323-346`

```typescript
createNegotiationSchema = {
  contextId: z.string().uuid()
  buyerAgentId: z.string().uuid()
  sellerAgentId: z.string().uuid()
  userRole: z.enum(["buyer", "seller"])
  maxRounds: z.number().int().min(1).max(100)  // ⚠️ Unterschied: Frontend max 50, Backend max 100
  selectedTechniques: z.array(z.string())
  selectedTactics: z.array(z.string())
  userZopa: z.object({
    volumen: z.object({ min, max, target })
    preis: z.object({ min, max, target })
    laufzeit: z.object({ min, max, target })
    zahlungskonditionen: z.object({ min, max, target })
  })
  counterpartDistance: z.object({
    volumen: z.number().min(-1).max(1)
    preis: z.number().min(-1).max(1)
    laufzeit: z.number().min(-1).max(1)
    zahlungskonditionen: z.number().min(-1).max(1)
  })
  sonderinteressen: z.string().optional()
}
```

### 3. Backend → Storage

**Datei**: `server/routes/negotiations.ts:350-364`

```typescript
negotiationData = {
  contextId: validatedData.contextId
  buyerAgentId: validatedData.buyerAgentId
  sellerAgentId: validatedData.sellerAgentId
  userRole: validatedData.userRole
  maxRounds: validatedData.maxRounds
  selectedTechniques: validatedData.selectedTechniques  // UUIDs
  selectedTactics: validatedData.selectedTactics       // UUIDs
  userZopa: validatedData.userZopa                     // JSONB
  counterpartDistance: validatedData.counterpartDistance // JSONB
  sonderinteressen: validatedData.sonderinteressen || null
  status: "pending"
}
```

### 4. Storage → Database

**Datei**: `server/storage.ts:305-341`

```typescript
createNegotiationWithSimulationRuns(negotiationData):
  1. INSERT INTO negotiations (alle Felder aus negotiationData)
  2. Generiere Simulation Runs:
     - Für jede technique × tactic Kombination
     - Erstelle simulationRuns Eintrag mit:
       * negotiationId
       * runNumber (sequenziell)
       * techniqueId (UUID)
       * tacticId (UUID)
       * status: "pending"
```

### 5. Database Schema

**Datei**: `shared/schema.ts:46-99`

```typescript
negotiations table {
  id: UUID (PK)
  contextId: UUID (FK)
  buyerAgentId: UUID (FK)
  sellerAgentId: UUID (FK)
  
  // Business context
  title: text (default: "Untitled Negotiation")
  negotiationType: text (default: "one-shot")
  relationshipType: text (default: "first")
  productMarketDescription: text (nullable)
  additionalComments: text (nullable)
  
  // Status
  status: text (default: "pending")
  userRole: text (required)
  maxRounds: integer (default: 10)
  
  // Selected techniques/tactics
  selectedTechniques: UUID[] (default: [])
  selectedTactics: UUID[] (default: [])
  
  // Counterpart configuration
  counterpartPersonality: text (nullable)
  zopaDistance: text (nullable) // "close", "medium", "far"
  
  // DEPRECATED: userZopa (JSONB)
  userZopa: jsonb (nullable) // {volumen: {min,max,target}, ...}
  counterpartDistance: jsonb (nullable) // {volumen: 0, preis: 0, ...}
  
  sonderinteressen: text (nullable)
  
  // Outcome tracking (werden später gesetzt)
  overallStatus: text (default: "pending")
  totalSimulationRuns: integer (default: 0)
  completedRuns: integer (default: 0)
  ...
}
```

**⚠️ WICHTIG**: `userZopa` und `counterpartDistance` sind als **DEPRECATED** markiert, werden aber noch verwendet!

---

## Datenfluss: POST `/api/negotiations/enhanced` (Neue Route)

### 1. Frontend → Backend (Payload)

**Nicht verwendet** - Frontend sendet nicht an diesen Endpunkt

### 2. Backend Validierung

**Datei**: `server/routes/negotiations.ts:170-192`

```typescript
enhancedNegotiationSchema = {
  title: z.string().min(1)
  userRole: z.enum(["buyer", "seller"])
  negotiationType: z.enum(["one-shot", "multi-year"])
  relationshipType: z.enum(["first", "long-standing"])
  productMarketDescription: z.string().optional()
  additionalComments: z.string().optional()
  selectedTechniques: z.array(z.string())
  selectedTactics: z.array(z.string())
  counterpartPersonality: z.string().optional()
  zopaDistance: z.string().optional()
  dimensions: z.array({
    id: string
    name: string
    minValue: number
    maxValue: number
    targetValue: number
    priority: number (1-3)
    unit: string (optional)
  }).min(1)
}
```

### 3. Backend → Storage

**Datei**: `server/routes/negotiations.ts:223-250`

```typescript
negotiationData = {
  title: validatedData.title
  negotiationType: validatedData.negotiationType
  relationshipType: validatedData.relationshipType
  contextId: contexts[0].id  // ⚠️ Nimmt ersten Context
  buyerAgentId: agents[0].id // ⚠️ Logik: userRole === "buyer" ? agents[0] : agents[1]
  sellerAgentId: agents[1].id // ⚠️ Logik: userRole === "buyer" ? agents[1] : agents[0]
  userRole: validatedData.userRole
  productMarketDescription: validatedData.productMarketDescription || null
  additionalComments: validatedData.additionalComments || null
  selectedTechniques: selectedTechniqueUUIDs
  selectedTactics: selectedTacticUUIDs
  counterpartPersonality: validatedData.counterpartPersonality || null
  zopaDistance: validatedData.zopaDistance || null
  status: "configured"  // ⚠️ Unterschied: "configured" statt "pending"
}

// Speichere dimensions in negotiationDimensions Tabelle
storage.createNegotiationWithDimensions(negotiationData, dimensions)
```

### 4. Storage → Database

**Datei**: `server/storage.ts:274-303`

```typescript
createNegotiationWithDimensions(negotiationData, dimensions):
  1. INSERT INTO negotiations (negotiationData)
  2. INSERT INTO negotiationDimensions (für jede dimension)
     - negotiationId (FK)
     - name
     - minValue, maxValue, targetValue (DECIMAL)
     - priority (1-3)
     - unit (optional)
```

### 5. Database Schema

**Datei**: `shared/schema.ts:264-277`

```typescript
negotiationDimensions table {
  id: UUID (PK)
  negotiationId: UUID (FK, cascade delete)
  name: text (required) // e.g. "price", "volume"
  minValue: DECIMAL(15,4)
  maxValue: DECIMAL(15,4)
  targetValue: DECIMAL(15,4)
  priority: integer (1-3)
  unit: text (nullable)
  createdAt: timestamp
  UNIQUE(negotiationId, name) // Eine Dimension pro Name pro Negotiation
}
```

---

## Datenfluss: POST `/api/negotiations/:id/start`

### 1. Frontend → Backend

**Datei**: `client/src/components/CreateNegotiationForm.tsx:123-125`

```typescript
if (autoStart) {
  POST /api/negotiations/${negotiation.id}/start
}
```

### 2. Backend Verarbeitung

**Datei**: `server/routes/negotiations.ts:380-454`

```typescript
POST /:id/start {
  1. Prüfe negotiation.status === "configured" || "pending"
  2. Prüfe selectedTechniques.length > 0 && selectedTactics.length > 0
  3. Bestimme personalities:
     - Wenn counterpartPersonality === "all-personalities" → ["all"]
     - Sonst → [counterpartPersonality]
  4. Bestimme zopaDistances:
     - Wenn zopaDistance === "all-distances" → ["all"]
     - Sonst → [zopaDistance]
  5. SimulationQueueService.createQueue({
     negotiationId
     techniques: selectedTechniques
     tactics: selectedTactics
     personalities
     zopaDistances
   })
  6. storage.updateNegotiationStatus(id, "running")
  7. SimulationQueueService.startQueue(queueId)
}
```

### 3. Queue Creation

**Datei**: `server/services/simulation-queue.ts:97-243`

```typescript
createQueue(request) {
  1. Resolve personalities:
     - Wenn "all" → Hole alle personalityTypes aus DB
  2. Resolve zopaDistances:
     - Wenn "all" → ["close", "medium", "far"]
  3. Berechne totalSimulations = techniques.length × tactics.length × personalities.length × zopaDistances.length
  4. INSERT INTO simulationQueue {
     negotiationId
     totalSimulations
     status: "pending"
   }
  5. Erstelle simulationRuns für alle Kombinationen:
     - techniques × tactics × personalities × zopaDistances
     - Jeder run bekommt:
       * negotiationId
       * queueId
       * techniqueId
       * tacticId
       * personalityId
       * zopaDistance
       * status: "pending"
       * executionOrder (optional)
}
```

---

## Identifizierte Synchronisationsprobleme

### ❌ Problem 1: Frontend verwendet Legacy-Format

**Frontend**: `CreateNegotiationForm.tsx` sendet `userZopa` (JSONB)
**Backend**: `/api/negotiations` akzeptiert `userZopa` (aber als DEPRECATED markiert)
**Schema**: `userZopa` ist als DEPRECATED markiert

**Impact**: Daten werden in veraltetes Format gespeichert, neue `negotiationDimensions` Tabelle wird nicht verwendet.

### ❌ Problem 2: Fehlende Felder im Frontend

**Frontend sendet NICHT**:
- `title` (wird im Schema erwartet, Default: "Untitled Negotiation")
- `negotiationType` (wird im Schema erwartet, Default: "one-shot")
- `relationshipType` (wird im Schema erwartet, Default: "first")
- `productMarketDescription` (optional im Schema)
- `additionalComments` (optional im Schema)
- `counterpartPersonality` (optional im Schema)
- `zopaDistance` (optional im Schema)

**Backend erwartet**:
- Alle oben genannten Felder werden im Schema gespeichert, aber mit Defaults

**Impact**: Verhandlungen haben generische Titel und Default-Werte.

### ❌ Problem 3: maxRounds Limit Inkonsistenz

**Frontend**: `z.number().min(1).max(50)`
**Backend**: `z.number().int().min(1).max(100)`

**Impact**: Frontend blockiert Werte > 50, die Backend akzeptieren würde.

### ❌ Problem 4: Zwei verschiedene Formate parallel

**Route 1**: `/api/negotiations` → `userZopa` (JSONB, DEPRECATED)
**Route 2**: `/api/negotiations/enhanced` → `dimensions` (Tabelle, NEW)
**Route 3**: `/api/negotiations/phase2` → Produkte + Konditionen

**Impact**: Verwirrung, inkonsistente Datenstrukturen, mögliche Migration-Probleme.

### ❌ Problem 5: Agent-Zuordnung in enhanced Route

**Enhanced Route**: 
```typescript
buyerAgentId: userRole === "buyer" ? agents[0].id : agents[1].id
sellerAgentId: userRole === "buyer" ? agents[1].id : agents[0].id
```

**Legacy Route**: Frontend sendet `buyerAgentId` und `sellerAgentId` direkt

**Impact**: Verschiedene Logik, potenzielle Inkonsistenzen.

### ❌ Problem 6: Status Unterschiede

**Legacy Route**: `status: "pending"`
**Enhanced Route**: `status: "configured"`

**Impact**: Unterschiedliche Status-Werte, `/start` Route prüft beide.

### ❌ Problem 7: Fehlende Dimensionen in Legacy Route

**Legacy Route**: Speichert `userZopa` als JSONB
**Enhanced Route**: Speichert `dimensions` in separater Tabelle

**Impact**: 
- Legacy Route kann keine flexiblen Dimensionen verwenden
- Analysen auf Dimensionen funktionieren nur für Enhanced Route
- Migration schwierig

### ❌ Problem 8: Simulation Runs werden nicht erstellt

**Legacy Route**: `createNegotiationWithSimulationRuns()` erstellt Runs direkt
**Enhanced Route**: `createNegotiationWithDimensions()` erstellt KEINE Runs

**Impact**: Enhanced Route erstellt keine Simulation Runs, nur wenn Queue gestartet wird.

---

## Empfohlene Synchronisation

### Option A: Frontend auf Enhanced Route migrieren

**Vorteile**:
- Verwendet neue `negotiationDimensions` Tabelle
- Flexibleres System
- Bessere Normalisierung

**Nachteile**:
- Große Frontend-Änderungen
- Migration bestehender Daten

### Option B: Legacy Route mit fehlenden Feldern erweitern

**Vorteile**:
- Minimaler Frontend-Change
- Rückwärtskompatibel

**Nachteile**:
- Verwendet weiterhin DEPRECATED `userZopa`

### Option C: Einheitliche Route erstellen

**Vorteile**:
- Ein Weg für alles
- Konsistente Datenstruktur

**Nachteile**:
- Umfangreiche Refaktorierung

---

## Feld-Mapping: Frontend ↔ Backend ↔ Schema

### Aktuell gesendet (Frontend → Backend)

| Frontend Feld | Backend Validation | Schema Feld | Status |
|--------------|-------------------|-------------|--------|
| `contextId` | ✅ UUID | `contextId` | ✅ OK |
| `buyerAgentId` | ✅ UUID | `buyerAgentId` | ✅ OK |
| `sellerAgentId` | ✅ UUID | `sellerAgentId` | ✅ OK |
| `maxRounds` | ✅ 1-100 | `maxRounds` | ⚠️ Frontend limitiert auf 50 |
| `selectedTechniques` | ✅ UUID[] | `selectedTechniques` | ✅ OK |
| `selectedTactics` | ✅ UUID[] | `selectedTactics` | ✅ OK |
| `userRole` | ✅ enum | `userRole` | ✅ OK |
| `userZopa` | ✅ object | `userZopa` (JSONB) | ❌ DEPRECATED |
| `counterpartDistance` | ✅ object | `counterpartDistance` (JSONB) | ❌ DEPRECATED |
| `sonderinteressen` | ✅ optional | `sonderinteressen` | ✅ OK |

### Fehlt im Frontend (aber im Schema vorhanden)

| Schema Feld | Default | Frontend sendet | Impact |
|------------|---------|----------------|--------|
| `title` | "Untitled Negotiation" | ❌ | Generische Titel |
| `negotiationType` | "one-shot" | ❌ | Kann nicht geändert werden |
| `relationshipType` | "first" | ❌ | Kann nicht geändert werden |
| `productMarketDescription` | null | ❌ | Fehlt |
| `additionalComments` | null | ❌ | Fehlt |
| `counterpartPersonality` | null | ❌ | Fehlt |
| `zopaDistance` | null | ❌ | Fehlt |

### Enhanced Route (nicht verwendet)

| Enhanced Route Feld | Frontend sendet | Status |
|-------------------|----------------|--------|
| `title` | ❌ | Nicht verwendet |
| `dimensions` | ❌ | Nicht verwendet |
| `negotiationType` | ❌ | Nicht verwendet |
| `relationshipType` | ❌ | Nicht verwendet |

---

## Simulation Run Erstellung

### Aktueller Flow (Legacy Route)

```
1. POST /api/negotiations
   ↓
2. storage.createNegotiationWithSimulationRuns()
   ↓
3. Erstellt N×M simulationRuns direkt:
   - techniques.length × tactics.length
   - OHNE personalities
   - OHNE zopaDistances
   - OHNE queueId
   ↓
4. Runs haben status: "pending"
   - KEIN queueId
   - KEIN executionOrder
```

### Erwarteter Flow (bei Start)

```
1. POST /api/negotiations/:id/start
   ↓
2. SimulationQueueService.createQueue()
   ↓
3. Erstellt Queue + neue Simulation Runs:
   - techniques × tactics × personalities × zopaDistances
   - MIT queueId
   - MIT executionOrder
   ↓
4. ⚠️ PROBLEM: Alte Runs ohne Queue bleiben bestehen!
   → Doppelte Simulation Runs!
   → Alte Runs werden nie verarbeitet
```

**⚠️ KRITISCH**: Legacy Route erstellt Runs direkt, aber `/start` Route erstellt neue Runs über Queue. **Doppelte Runs!**

**Lösung**: Entweder:
- Legacy Route soll KEINE Runs direkt erstellen, oder
- `/start` Route soll bestehende Runs verwenden (nicht neue erstellen)

---

## Nächste Schritte

1. **Sofort**: Frontend `maxRounds` Limit auf 100 erhöhen oder Backend auf 50 reduzieren
2. **Kurzfristig**: Frontend um fehlende Felder erweitern (`title`, `negotiationType`, etc.)
3. **Mittelfristig**: Entscheidung: Legacy Route deprecaten oder Enhanced Route verwenden
4. **Langfristig**: Einheitliche Route, Migration auf `negotiationDimensions`

---

## Zusammenfassung

### Hauptprobleme

1. ❌ **Frontend verwendet DEPRECATED Format** (`userZopa` statt `dimensions`)
2. ❌ **Doppelte Simulation Runs** (Legacy erstellt direkt, Start erstellt über Queue)
3. ❌ **Fehlende Felder** im Frontend (title, negotiationType, etc.)
4. ❌ **Inkonsistente Limits** (maxRounds: 50 vs 100)
5. ❌ **Drei verschiedene Routen** ohne klare Strategie
6. ❌ **Status-Inkonsistenz** ("pending" vs "configured")

### Empfehlung

**Option**: Frontend auf Enhanced Route migrieren UND Legacy Route erweitern um fehlende Felder

1. Frontend erweitern um alle Schema-Felder
2. Frontend auf `/api/negotiations/enhanced` umstellen
3. Legacy Route als Fallback behalten
4. Migration-Tool für bestehende Daten

