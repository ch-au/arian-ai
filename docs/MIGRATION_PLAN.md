# Migrationsplan: Frontend ↔ Backend ↔ Schema Synchronisation

## Ziel

Alle drei Routen (Legacy, Enhanced, Phase2) sollen auf ein einheitliches Schema migriert werden, das:
- Alle Felder unterstützt
- Keine DEPRECATED Felder verwendet
- Konsistente Datenstrukturen hat
- Doppelte Simulation Runs vermeidet

---

## Phase 1: Schema-Erweiterung (Kritisch)

### 1.1 Phase2 Felder zum Schema hinzufügen

**Problem**: Phase2 Felder fehlen im Schema

**Lösung**: Erweitere `shared/schema.ts`:

```typescript
// Neue Felder zur negotiations Tabelle hinzufügen:
companyKnown: boolean("company_known").default(false),
counterpartKnown: boolean("counterpart_known").default(false),
negotiationFrequency: text("negotiation_frequency"), // "yearly" | "quarterly" | "monthly" | "ongoing"
powerBalance: integer("power_balance").default(50), // 0-100
```

**Migration**: SQL Migration erstellen:
```sql
ALTER TABLE negotiations 
  ADD COLUMN IF NOT EXISTS company_known BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS counterpart_known BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS negotiation_frequency TEXT,
  ADD COLUMN IF NOT EXISTS power_balance INTEGER DEFAULT 50;
```

**Priorität**: 🔴 Hoch
**Aufwand**: 2 Stunden
**Risiko**: Niedrig (neue Felder, keine Breaking Changes)

### 1.2 `geschätzteDistanz` speichern

**Problem**: `geschätzteDistanz` wird empfangen, aber nicht gespeichert

**Lösung Optionen**:
- **Option A**: Als JSONB in `metadata` speichern
- **Option B**: Als separate Tabelle `negotiation_distance_config`

**Empfehlung**: Option A (JSONB in metadata) - einfacher, flexibel

**Migration**: 
```typescript
// Im Phase2 Backend:
metadata: {
  geschätzteDistanz: validatedData.geschätzteDistanz || {}
}
```

**Priorität**: 🟡 Mittel
**Aufwand**: 1 Stunde
**Risiko**: Niedrig

---

## Phase 2: Legacy Route Fixes (Kritisch)

### 2.1 Fehlende Felder zum Frontend hinzufügen

**Problem**: Legacy Frontend sendet keine `title`, `negotiationType`, etc.

**Lösung**: Erweitere `CreateNegotiationForm.tsx`:

```typescript
// Schema erweitern:
const createNegotiationSchema = z.object({
  // ... bestehende Felder ...
  title: z.string().min(1, "Title is required").default("Untitled Negotiation"),
  negotiationType: z.enum(["one-shot", "multi-year"]).default("one-shot"),
  relationshipType: z.enum(["first", "long-standing"]).default("first"),
  productMarketDescription: z.string().optional(),
  additionalComments: z.string().optional(),
  counterpartPersonality: z.string().optional(),
  zopaDistance: z.enum(["close", "medium", "far"]).optional(),
});
```

**UI Änderungen**:
- Schritt 1: Titel-Feld hinzufügen
- Schritt 1: Negotiation Type Dropdown
- Schritt 1: Relationship Type Dropdown
- Schritt 4: Zusätzliche Felder für Context/Comments

**Priorität**: 🔴 Hoch
**Aufwand**: 4 Stunden
**Risiko**: Mittel (UI-Änderungen)

### 2.2 maxRounds Limit harmonisieren

**Problem**: Frontend limitiert auf 50, Backend auf 100

**Lösung**: Frontend auf 100 erhöhen ODER Backend auf 50 reduzieren

**Empfehlung**: Frontend auf 100 erhöhen (mehr Flexibilität)

```typescript
// CreateNegotiationForm.tsx
<Input
  type="number"
  min={1}
  max={100}  // ← Ändern von 50 auf 100
  {...field}
/>
```

**Priorität**: 🟡 Mittel
**Aufwand**: 5 Minuten
**Risiko**: Niedrig

### 2.3 Doppelte Simulation Runs beheben

**Problem**: Legacy Route erstellt Runs direkt, `/start` erstellt neue Runs

**Lösung Optionen**:
- **Option A**: Legacy Route soll KEINE Runs direkt erstellen (wie Enhanced)
- **Option B**: `/start` Route soll bestehende Runs verwenden (nicht neue erstellen)

**Empfehlung**: Option A (wie Enhanced Route)

**Änderungen**:

1. **Storage ändern**: `createNegotiationWithSimulationRuns` → `createNegotiation`
   ```typescript
   // server/storage.ts
   // Entferne createNegotiationWithSimulationRuns()
   // Verwende createNegotiation() stattdessen
   ```

2. **Backend Route ändern**: 
   ```typescript
   // server/routes/negotiations.ts
   router.post("/", async (req, res) => {
     // ... validation ...
     const negotiation = await storage.createNegotiation(negotiationData);
     // KEINE Simulation Runs hier!
     res.status(201).json({ negotiation });
   });
   ```

3. **Response anpassen**:
   ```typescript
   // Entferne simulationRuns aus Response
   res.status(201).json({
     negotiation,
     message: "Negotiation created. Use /start to begin simulations."
   });
   ```

**Priorität**: 🔴 Hoch
**Aufwand**: 2 Stunden
**Risiko**: Mittel (Breaking Change für Frontend, das simulationRuns erwartet)

**Migration**: Frontend muss angepasst werden, um `simulationRuns` nicht mehr zu erwarten.

---

## Phase 3: Enhanced Route Synchronisation

### 3.1 maxRounds zur Enhanced Route hinzufügen

**Problem**: Enhanced Route erwartet kein `maxRounds`

**Lösung**: Erweitere Schema in Enhanced Route:

```typescript
// server/routes/negotiations.ts
const enhancedNegotiationSchema = z.object({
  // ... bestehende Felder ...
  maxRounds: z.number().int().min(1).max(100).optional().default(10),
});
```

**Priorität**: 🟡 Mittel
**Aufwand**: 15 Minuten
**Risiko**: Niedrig

### 3.2 Agent-Zuordnung vereinheitlichen

**Problem**: Enhanced Route bestimmt Agents automatisch, Legacy nicht

**Lösung**: Enhanced Route soll auch `buyerAgentId` und `sellerAgentId` akzeptieren

```typescript
const enhancedNegotiationSchema = z.object({
  // ... bestehende Felder ...
  buyerAgentId: z.string().uuid().optional(),
  sellerAgentId: z.string().uuid().optional(),
});

// Logik:
const buyerAgentId = validatedData.buyerAgentId || 
  (validatedData.userRole === "buyer" ? agents[0].id : agents[1].id);
const sellerAgentId = validatedData.sellerAgentId || 
  (validatedData.userRole === "buyer" ? agents[1].id : agents[0].id);
```

**Priorität**: 🟡 Mittel
**Aufwand**: 1 Stunde
**Risiko**: Niedrig

---

## Phase 4: Phase2 Route Verbesserungen

### 4.1 `verhandlungsModus` → `zopaDistance` Mapping korrigieren

**Problem**: `verhandlungsModus` Werte passen nicht zu `zopaDistance`

**Lösung Optionen**:
- **Option A**: Neue Feld `verhandlungsModus` im Schema hinzufügen
- **Option B**: Mapping-Tabelle: `verhandlungsModus` → `zopaDistance`

**Empfehlung**: Option A (neues Feld)

```typescript
// Schema erweitern:
verhandlungsModus: text("verhandlungs_modus"), // "kooperativ" | "moderat" | "aggressiv" | "sehr-aggressiv"
```

**Migration**:
```sql
ALTER TABLE negotiations 
  ADD COLUMN IF NOT EXISTS verhandlungs_modus TEXT;
```

**Priorität**: 🟡 Mittel
**Aufwand**: 1 Stunde
**Risiko**: Niedrig

### 4.2 `geschätzteDistanz` speichern

**Problem**: Wird empfangen, aber nicht gespeichert

**Lösung**: In `metadata` JSONB speichern:

```typescript
metadata: {
  geschätzteDistanz: validatedData.geschätzteDistanz || {},
  // ... andere metadata ...
}
```

**Priorität**: 🟡 Mittel
**Aufwand**: 30 Minuten
**Risiko**: Niedrig

---

## Phase 5: Migration von DEPRECATED Feldern

### 5.1 Migration Script: `userZopa` → `negotiationDimensions`

**Problem**: Legacy Daten verwenden `userZopa` (JSONB), neue Daten verwenden `negotiationDimensions` (Tabelle)

**Lösung**: Migration Script erstellen:

```typescript
// server/scripts/migrate-userzopa-to-dimensions.ts

async function migrateUserZopaToDimensions() {
  const negotiations = await db.select().from(negotiations).where(
    and(
      isNotNull(negotiations.userZopa),
      not(eq(negotiations.userZopa, null))
    )
  );

  for (const negotiation of negotiations) {
    const userZopa = negotiation.userZopa as any;
    
    // Prüfe ob bereits Dimensions existieren
    const existingDimensions = await db.select()
      .from(negotiationDimensions)
      .where(eq(negotiationDimensions.negotiationId, negotiation.id));
    
    if (existingDimensions.length > 0) {
      continue; // Bereits migriert
    }

    // Konvertiere userZopa zu dimensions
    const dimensions = [
      {
        negotiationId: negotiation.id,
        name: "volumen",
        minValue: userZopa.volumen?.min?.toString() || "0",
        maxValue: userZopa.volumen?.max?.toString() || "0",
        targetValue: userZopa.volumen?.target?.toString() || "0",
        priority: 2, // Default priority
        unit: null,
      },
      {
        negotiationId: negotiation.id,
        name: "preis",
        minValue: userZopa.preis?.min?.toString() || "0",
        maxValue: userZopa.preis?.max?.toString() || "0",
        targetValue: userZopa.preis?.target?.toString() || "0",
        priority: 1, // Preis ist meist wichtig
        unit: "EUR",
      },
      // ... ähnlich für laufzeit, zahlungskonditionen ...
    ];

    await db.insert(negotiationDimensions).values(dimensions);
  }
}
```

**Priorität**: 🟡 Mittel
**Aufwand**: 4 Stunden
**Risiko**: Mittel (Daten-Migration)

### 5.2 Legacy Route auf `negotiationDimensions` umstellen

**Problem**: Legacy Route verwendet noch `userZopa`

**Lösung**: Legacy Route umstellen:

```typescript
// Frontend: userZopa → dimensions konvertieren
const dimensions = [
  {
    id: uuid(),
    name: "volumen",
    minValue: data.userZopa.volumen.min,
    maxValue: data.userZopa.volumen.max,
    targetValue: data.userZopa.volumen.target,
    priority: 2,
    unit: null,
  },
  // ... ähnlich für andere Dimensionen ...
];

// Backend: Verwende Enhanced Route Logik
const negotiation = await storage.createNegotiationWithDimensions(
  negotiationData,
  dimensions
);
```

**Priorität**: 🔴 Hoch
**Aufwand**: 6 Stunden
**Risiko**: Hoch (Breaking Change)

**Migration**: 
1. Migration Script ausführen (5.1)
2. Frontend umstellen
3. Backend umstellen
4. `userZopa` als DEPRECATED markieren, aber nicht entfernen (für Rückwärtskompatibilität)

---

## Phase 6: Einheitliche Route (Langfristig)

### 6.1 Neue einheitliche Route erstellen

**Problem**: Drei verschiedene Routen ohne klare Strategie

**Lösung**: Neue Route `/api/negotiations/v2` erstellen, die:
- Alle Felder unterstützt
- Flexible Dimensions verwendet
- Keine DEPRECATED Felder verwendet
- Konsistente Logik hat

**Priorität**: 🟢 Niedrig (Langfristig)
**Aufwand**: 2 Tage
**Risiko**: Mittel

### 6.2 Legacy Routen deprecaten

**Schritte**:
1. Neue Route `/api/negotiations/v2` implementieren
2. Frontend migrieren
3. Legacy Routen als DEPRECATED markieren
4. Nach 3 Monaten: Legacy Routen entfernen

**Priorität**: 🟢 Niedrig (Langfristig)
**Aufwand**: 1 Tag
**Risiko**: Niedrig

---

## Implementierungsreihenfolge

### Sprint 1: Kritische Fixes (1 Woche)

1. ✅ **Phase 1.1**: Phase2 Felder zum Schema hinzufügen
2. ✅ **Phase 2.3**: Doppelte Simulation Runs beheben
3. ✅ **Phase 2.2**: maxRounds Limit harmonisieren

**Ergebnis**: Keine doppelten Runs mehr, Schema erweitert

### Sprint 2: Frontend Verbesserungen (1 Woche)

4. ✅ **Phase 2.1**: Fehlende Felder zum Legacy Frontend hinzufügen
5. ✅ **Phase 3.1**: maxRounds zur Enhanced Route hinzufügen
6. ✅ **Phase 3.2**: Agent-Zuordnung vereinheitlichen

**Ergebnis**: Legacy Frontend kann alle Felder senden

### Sprint 3: Phase2 Verbesserungen (1 Woche)

7. ✅ **Phase 4.1**: `verhandlungsModus` Feld hinzufügen
8. ✅ **Phase 4.2**: `geschätzteDistanz` speichern
9. ✅ **Phase 1.2**: `geschätzteDistanz` im Schema speichern

**Ergebnis**: Phase2 Daten werden vollständig gespeichert

### Sprint 4: Migration (1 Woche)

10. ✅ **Phase 5.1**: Migration Script erstellen und testen
11. ✅ **Phase 5.2**: Legacy Route auf `negotiationDimensions` umstellen (Frontend + Backend)

**Ergebnis**: Keine DEPRECATED Felder mehr in neuen Daten

---

## Risiken & Mitigation

### Risiko 1: Breaking Changes für Frontend

**Mitigation**: 
- Schrittweise Migration
- Beide Routen parallel betreiben
- Feature Flags für neue Funktionalität

### Risiko 2: Daten-Migration Fehler

**Mitigation**:
- Migration Scripts gründlich testen
- Backup vor Migration
- Rollback-Plan

### Risiko 3: Performance-Probleme bei großer Datenmenge

**Mitigation**:
- Migration in Batches
- Indizes prüfen
- Performance-Tests

---

## Success Criteria

- ✅ Keine doppelten Simulation Runs mehr
- ✅ Alle Schema-Felder können vom Frontend gesetzt werden
- ✅ Keine DEPRECATED Felder in neuen Daten
- ✅ Konsistente Datenstrukturen über alle Routen
- ✅ Migration Scripts erfolgreich ausgeführt
- ✅ Alle Tests bestehen

---

## Testing Checklist

### Unit Tests
- [ ] Schema-Validierung für alle Routen
- [ ] Storage-Methoden für neue Felder
- [ ] Migration Scripts

### Integration Tests
- [ ] Legacy Route erstellt keine Runs direkt
- [ ] `/start` Route erstellt Runs korrekt
- [ ] Enhanced Route unterstützt alle Felder
- [ ] Phase2 Route speichert alle Felder

### E2E Tests
- [ ] Legacy Frontend kann alle Felder senden
- [ ] Phase2 Frontend erstellt Negotiation korrekt
- [ ] Simulation Runs werden korrekt erstellt (keine Duplikate)

---

## Rollback Plan

Falls Probleme auftreten:

1. **Schema-Änderungen**: Migration rückgängig machen
   ```sql
   ALTER TABLE negotiations DROP COLUMN IF EXISTS company_known;
   ```

2. **Code-Änderungen**: Git revert zu vorheriger Version

3. **Daten-Migration**: Backup wiederherstellen

4. **Frontend**: Feature Flag auf Legacy Route setzen

---

## Notizen

- Alle Änderungen sollten backwards-compatible sein wo möglich
- DEPRECATED Felder nicht sofort entfernen, sondern nur markieren
- Migration Scripts sollten idempotent sein (mehrfach ausführbar)
- Dokumentation aktualisieren nach jeder Phase

