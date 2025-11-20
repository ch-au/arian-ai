# Schema Cleanup Plan

## Code-Analyse: Tatsächlich genutzte Tabellen

### Aktiv genutzte Tabellen (behalten)
| Tabelle | Nutzung | Zweck |
|---------|---------|-------|
| `users` | 2x | Authentifizierung |
| `registrations` | 2x | Kunden/Organisation |
| `markets` | 2x | Märkte/Regionen |
| `counterparts` | 2x | Verhandlungspartner |
| `dimensions` | 1x | Verhandlungsdimensionen |
| `products` | 1x | Produkte |
| `negotiation_products` | 1x | n:n Relation |
| `negotiations` | 5x | Kern: Verhandlungen |
| `influencing_techniques` | 4x | Techniken |
| `negotiation_tactics` | 4x | Taktiken |
| `personality_types` | 2x | Persönlichkeitstypen |
| `agents` | 3x | AI Agents |
| `simulations` | 0x | ⚠️ Wird nicht mehr genutzt |
| `simulation_queue` | 7x | Queue-Management |
| `simulation_runs` | 28x | **Haupt-Tabelle** |
| `dimension_results` | 1x | Analyse-Ergebnisse |
| `product_results` | 1x | Analyse-Ergebnisse |

### Ungenutzte Tabellen (löschen)
| Tabelle | Status | Aktion |
|---------|--------|--------|
| `negotiation_rounds` | 1x nur SELECT, nie INSERT | ❌ LÖSCHEN |
| `round_states` | 0x | ❌ LÖSCHEN |
| `offers` | 1x nur SELECT, nie INSERT | ❌ LÖSCHEN |
| `concessions` | 0x | ❌ LÖSCHEN |
| `events` | 1x nur SELECT, nie INSERT | ❌ LÖSCHEN |
| `interactions` | 0x | ❌ LÖSCHEN |
| `agent_metrics` | 0x | ❌ LÖSCHEN |
| `performance_metrics` | 2x nur SELECT, nie INSERT | ❌ LÖSCHEN |
| `analytics_sessions` | 0x | ❌ LÖSCHEN |
| `benchmarks` | 0x | ❌ LÖSCHEN |
| `experiments` | 0x | ❌ LÖSCHEN |
| `experiment_runs` | 0x | ❌ LÖSCHEN |
| `product_dimension_values` | 0x | ❌ LÖSCHEN |
| `policies` | 0x | ❌ LÖSCHEN |
| `simulations` | 0x (Referenced in FK) | ❌ LÖSCHEN + FK entfernen |

## Problematische Foreign Keys

### `simulation_runs` Tabelle
```typescript
simulationId: uuid("simulation_id").references(() => simulations.id, { onDelete: "cascade" }),
```
**Problem**: Die `simulations` Tabelle wird nicht mehr genutzt, aber die FK existiert noch.

**Lösung**:
1. `simulationId` Spalte auf NULL setzen
2. FK constraint entfernen
3. `simulations` Tabelle löschen
4. Alternativ: `simulationId` Spalte komplett entfernen

### `simulation_queue` Tabelle
```typescript
simulationId: uuid("simulation_id").references(() => simulations.id, { onDelete: "cascade" }),
```
**Gleiches Problem wie oben**

## Migration Plan

### Migration 1: Entferne ungenutzte Tabellen
```sql
-- Drop ungenutzte Tabellen (kaskadierend)
DROP TABLE IF EXISTS concessions CASCADE;
DROP TABLE IF EXISTS offers CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS interactions CASCADE;
DROP TABLE IF EXISTS round_states CASCADE;
DROP TABLE IF EXISTS negotiation_rounds CASCADE;
DROP TABLE IF EXISTS agent_metrics CASCADE;
DROP TABLE IF EXISTS performance_metrics CASCADE;
DROP TABLE IF EXISTS analytics_sessions CASCADE;
DROP TABLE IF EXISTS experiment_runs CASCADE;
DROP TABLE IF EXISTS experiments CASCADE;
DROP TABLE IF EXISTS benchmarks CASCADE;
DROP TABLE IF EXISTS product_dimension_values CASCADE;
DROP TABLE IF EXISTS policies CASCADE;
```

### Migration 2: Bereinige simulations FK
```sql
-- Entferne simulationId aus simulation_runs (ungenutzt)
ALTER TABLE simulation_runs DROP CONSTRAINT IF EXISTS simulation_runs_simulation_id_simulations_id_fk;
ALTER TABLE simulation_runs DROP COLUMN IF EXISTS simulation_id;

-- Entferne simulationId aus simulation_queue (ungenutzt)
ALTER TABLE simulation_queue DROP CONSTRAINT IF EXISTS simulation_queue_simulation_id_simulations_id_fk;
ALTER TABLE simulation_queue DROP COLUMN IF EXISTS simulation_id;

-- Entferne simulationId aus agents (ungenutzt)
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_simulation_id_simulations_id_fk;
ALTER TABLE agents DROP COLUMN IF EXISTS simulation_id;

-- Lösche simulations Tabelle
DROP TABLE IF EXISTS simulations CASCADE;
```

### Migration 3: Lösche alte/inkonsistente Daten
```sql
-- Lösche alle simulation_runs ohne deal_value (alte Struktur)
DELETE FROM simulation_runs WHERE deal_value IS NULL;

-- Lösche zugehörige queues
DELETE FROM simulation_queue WHERE id NOT IN (
  SELECT DISTINCT queue_id FROM simulation_runs WHERE queue_id IS NOT NULL
);

-- Lösche verwaiste negotiations
DELETE FROM negotiations WHERE id NOT IN (
  SELECT DISTINCT negotiation_id FROM simulation_runs WHERE negotiation_id IS NOT NULL
);
```

## Finale Tabellenstruktur

### Core Tables (Business Logic)
- `users` - Benutzer
- `registrations` - Organisationen/Kunden
- `markets` - Märkte
- `counterparts` - Verhandlungspartner
- `dimensions` - Dimensionen (Master-Daten)
- `products` - Produkte (Master-Daten)
- `negotiation_products` - n:n Relation

### Negotiation Configuration
- `negotiations` - Verhandlungen
- `influencing_techniques` - Techniken
- `negotiation_tactics` - Taktiken
- `personality_types` - Persönlichkeitstypen
- `agents` - AI Agents

### Simulation Execution
- `simulation_queue` - Queue für Batch-Runs
- `simulation_runs` - Einzelne Simulation-Runs

### Results & Analytics
- `dimension_results` - Ergebnisse pro Dimension
- `product_results` - Ergebnisse pro Produkt

**Total: 15 Tabellen** (vorher: 29 Tabellen)

## Validierung nach Migration

```sql
-- Prüfe dass alle Tabellen existieren
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Prüfe dass keine verwaisten FKs existieren
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
```
