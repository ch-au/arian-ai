# Problem-Analyse: Fehlende Deal Values und Analyse-Daten

## Status
**PROBLEM IDENTIFIZIERT** ✓

## Symptome
1. ❌ Monitoring-Seite zeigt keine Deal Values
2. ❌ Analyse-Seite kann keine Daten berechnen
3. ❌ Performance Matrix bleibt leer
4. ❌ Run-Vergleich funktioniert nicht

## Root Cause Analysis

### Datenbank-Status
```
simulation_runs Tabelle:
✓ 12 Runs existieren für Negotiation 1601b2c2-b47a-417d-90d0-ea2f09769fb8
✓ Status: completed
✓ conversation_log: vorhanden (8-12 KB pro Run)
✓ other_dimensions: vorhanden (z.B. {"Lieferzeit": 2, "pombar100g": 1.1, "pombarpomme_100g": 1})
❌ deal_value: NULL für ALLE Runs
❌ dimension_results Tabelle: LEER (0 Einträge)
❌ product_results Tabelle: LEER (0 Einträge)
```

### Kernproblem

**Die `buildSimulationResultArtifacts()` Funktion wird NICHT aufgerufen oder deren Ergebnisse werden NICHT in die DB geschrieben.**

#### Beweis aus Debug-Script:
```typescript
// buildSimulationResultArtifacts FUNKTIONIERT korrekt:
✓ Artifacts generated:
  - Deal value: 160000.00 ✓
  - Dimension rows: 1 ✓
  - Product rows: 2 ✓

// ABER in der DB:
  - dimension_results entries: 0 ❌
  - product_results entries: 0 ❌
  - deal_value in simulation_runs: NULL ❌
```

## Datenfluss-Analyse

### Wo die Verarbeitung SEIN SOLLTE:

1. **Python Script** → simulation results
   - ✓ Läuft erfolgreich
   - ✓ Schreibt `other_dimensions` nach `simulation_runs.other_dimensions`
   - ✓ Schreibt `conversation_log` nach `simulation_runs.conversation_log`

2. **simulation-queue.ts:executeNext()** (Zeilen 716-768)
   ```typescript
   // Line 716-723: Artifacts werden GEBAUT
   const artifacts = buildSimulationResultArtifacts({
     runId: nextSimulation.id,
     negotiation: negotiationRecord,
     products,
     dimensionValues,
     conversationLog: normalizedConversationLog,
   });

   // Line 734-749: Artifacts werden in simulation_runs geschrieben
   await db.update(simulationRuns).set({
     status: status,
     dealValue: artifacts.dealValue,  // ✓ Wird geschrieben
     otherDimensions: artifacts.otherDimensions,  // ✓ Wird geschrieben
     // ...
   })

   // Line 752-768: Artifacts werden in separate Tabellen geschrieben
   await db.delete(dimensionResults).where(...);
   if (artifacts.dimensionRows.length) {
     await db.insert(dimensionResults).values(artifacts.dimensionRows);  // ✓ Code existiert
   }

   await db.delete(productResults).where(...);
   if (artifacts.productRows.length) {
     await db.insert(productResults).values(artifacts.productRows);  // ✓ Code existiert
   }
   ```

### Warum es NICHT funktioniert:

**THEORIE 1: Code wurde kürzlich geändert** ⚠️  
Die Runs wurden am 2025-11-18 06:12-06:16 erstellt, BEVOR der Code für die Artifact-Verarbeitung implementiert wurde.

Beweis:
- Die Runs haben `other_dimensions` (alte Struktur)
- Die Runs haben KEINE `dealValue` (neue Struktur)
- Die separaten Tabellen `dimension_results` und `product_results` sind leer

**THEORIE 2: Alte vs. Neue Schema-Struktur** ⚠️  
Es gab eine Schema-Migration, aber alte Daten wurden nicht migriert.

## Betroffene Komponenten

### Backend
1. ✓ `simulation-queue.ts:executeNext()` - Code ist korrekt
2. ✓ `simulation-result-processor.ts` - Funktioniert korrekt
3. ❌ **FEHLENDE MIGRATION**: Alte Runs haben keine deal_value/dimension_results/product_results

### Frontend
1. ❌ `analysis-helpers.ts` - Erwartet `dealValue` in runs
2. ❌ `dashboard-helpers.ts` - Erwartet `dealValue` für Metriken
3. ❌ `report-helpers.ts` - Erwartet `productResults` für Analyse
4. ❌ `run-comparison.ts` - Erwartet `dimensionResults` für Vergleich

## Ungenutzte Tabellen (Legacy)

Diese Tabellen werden NICHT mehr aktiv genutzt:
- ❌ `negotiation_rounds` - Wird nicht mehr befüllt
- ❌ `round_states` - Wird nicht mehr befüllt
- ❌ `offers` - Wird nicht mehr befüllt
- ❌ `events` - Wird nicht mehr befüllt
- ❌ `interactions` - Wird nicht mehr befüllt
- ❌ `concessions` - Wird nicht mehr befüllt
- ❌ `agent_metrics` - Wird nicht mehr befüllt
- ❌ `performance_metrics` - Wird nicht mehr befüllt
- ❌ `analytics_sessions` - Wird nicht mehr befüllt
- ❌ `experiments` - Wird nicht mehr befüllt
- ❌ `experiment_runs` - Wird nicht mehr befüllt
- ❌ `benchmarks` - Wird nicht mehr befüllt

Diese Tabellen sollten entweder entfernt oder aktiv genutzt werden.

## Lösungsvorschläge

### Option 1: Backfill-Migration für alte Runs ✓ EMPFOHLEN
**Erstelle ein Script, das alle alten Runs nachverarbeitet:**

```typescript
// scripts/backfill-simulation-results.ts
for (const run of oldRuns) {
  const artifacts = buildSimulationResultArtifacts({
    runId: run.id,
    negotiation,
    products,
    dimensionValues: run.otherDimensions,
    conversationLog: run.conversationLog,
  });

  // Update simulation_runs
  await db.update(simulationRuns)
    .set({ dealValue: artifacts.dealValue })
    .where(eq(simulationRuns.id, run.id));

  // Insert dimension_results
  if (artifacts.dimensionRows.length) {
    await db.insert(dimensionResults).values(artifacts.dimensionRows);
  }

  // Insert product_results
  if (artifacts.productRows.length) {
    await db.insert(productResults).values(artifacts.productRows);
  }
}
```

### Option 2: Frontend Fallback-Logik
**Frontend sollte mit NULL-Werten umgehen können:**

```typescript
// In analysis-helpers.ts
const dealValue = run.dealValue ?? calculateDealValueFromOtherDimensions(run);
```

### Option 3: Schema-Cleanup
**Entferne ungenutzte Tabellen:**

1. Migration erstellen zum Löschen ungenutzter Tabellen
2. Dokumentation aktualisieren
3. Storage-Layer bereinigen

## Empfohlene Vorgehensweise

1. **SOFORT**: Backfill-Script erstellen und ausführen (Option 1)
2. **PARALLEL**: Frontend robust gegen NULL-Werte machen (Option 2)
3. **SPÄTER**: Schema-Cleanup durchführen (Option 3)

## Erwartete Ergebnisse nach Backfill

```sql
-- Vorher:
SELECT deal_value FROM simulation_runs WHERE negotiation_id = '...';
-- 12 rows with NULL

-- Nachher:
SELECT deal_value FROM simulation_runs WHERE negotiation_id = '...';
-- 12 rows with actual values (e.g., 160000.00)

-- Vorher:
SELECT COUNT(*) FROM dimension_results;
-- 0

-- Nachher:
SELECT COUNT(*) FROM dimension_results;
-- 12 (1 per run)

-- Vorher:
SELECT COUNT(*) FROM product_results;
-- 0

-- Nachher:
SELECT COUNT(*) FROM product_results;
-- 24 (2 per run)
```

## Next Steps

1. ✅ Erstelle Backfill-Script
2. ✅ Teste Backfill mit 1-2 Runs
3. ✅ Führe Backfill für alle Runs aus
4. ✅ Verifiziere, dass Monitoring/Analyse funktioniert
5. ⏳ Erstelle Schema-Cleanup Migration

