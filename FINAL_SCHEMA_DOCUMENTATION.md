# Arian AI Platform - Final Schema Documentation

**Version**: 2.1 (Clean Schema)
**Datum**: 2025-11-19
**Status**: ✅ Production Ready

> 🧭 **Quelle der Wahrheit**  
> Der produktive Datenbankzustand wird durch das Drizzle-Schema in `shared/schema.ts` plus die Migrationsdateien im Ordner `drizzle/` definiert. Diese Dokumentation spiegelt exakt den aktuellen Stand wider und verweist bei Detailfragen direkt auf die TypeScript-Definitionen.

## Übersicht

Das Datenbank-Schema wurde bereinigt und optimiert. **14 ungenutzte Tabellen** wurden entfernt.

### Vorher vs. Nachher

- **Vorher**: 29 Tabellen (viele ungenutzt/legacy)
- **Nachher**: 16 Tabellen (alle aktiv genutzt)
- **Entfernt**: 14 Tabellen + unnötige Foreign Keys

## Aktive Tabellen (16)

### 1. Core Tables - Authentication & Organization (3)

#### `users`
Benutzer für das System.

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);
```

#### `registrations`
Organisationen/Kunden die das System nutzen.

```sql
CREATE TABLE registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization TEXT NOT NULL,
  company TEXT,
  country TEXT,
  negotiation_type TEXT,
  negotiation_frequency TEXT,
  goals JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `markets`
Märkte für Verhandlungen.

```sql
CREATE TABLE markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  region TEXT,
  country_code TEXT,
  currency_code TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'
);
```

### 2. Master Data (4)

#### `counterparts`
Verhandlungspartner (Retailer, Manufacturer, etc.). Enthält neben dem generellen Stil auch optionale Big-Five-artige Werte (`dominance`, `affiliation`) für KI-Analysen.

```sql
CREATE TABLE counterparts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind counterpart_kind NOT NULL, -- 'retailer' | 'manufacturer' | 'distributor' | 'other'
  power_balance DECIMAL(5,2),
  dominance DECIMAL(5,2),
  affiliation DECIMAL(5,2),
  style TEXT,
  constraints_meta JSONB NOT NULL DEFAULT '{}',
  notes TEXT
);
```

#### `dimensions`
Verhandlungsdimensionen (Master-Daten).

```sql
CREATE TABLE dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT,
  spec JSONB NOT NULL DEFAULT '{}',
  UNIQUE(registration_id, code)
);
```

#### `products`
Produkte (Master-Daten).

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gtin TEXT,
  brand TEXT,
  category_path TEXT,
  attrs JSONB NOT NULL DEFAULT '{}', -- targetPrice, minPrice, maxPrice, estimatedVolume
  UNIQUE(registration_id, gtin)
);
```

#### `negotiation_products`
n:n Relation zwischen Negotiations und Products.

```sql
CREATE TABLE negotiation_products (
  negotiation_id UUID NOT NULL REFERENCES negotiations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  PRIMARY KEY (negotiation_id, product_id)
);
```

### 3. Negotiation Configuration (5)

#### `negotiations`
**Haupt-Tabelle** für Verhandlungen.

```sql
CREATE TABLE negotiations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- JWT Auth User ID (integer FK)
  market_id UUID REFERENCES markets(id),
  counterpart_id UUID REFERENCES counterparts(id),
  title TEXT DEFAULT 'Untitled Negotiation',
  description TEXT,
  scenario JSONB NOT NULL DEFAULT '{}', -- userRole, dimensions, products, techniques, tactics, etc.
  status negotiation_status NOT NULL DEFAULT 'planned', -- 'planned' | 'running' | 'completed' | 'aborted'
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  playbook TEXT, -- Generated playbook markdown (cached)
  playbook_generated_at TIMESTAMPTZ -- Timestamp of playbook generation
);
```

#### `influencing_techniques`
Beeinflussungstechniken (z.B. "Reziprozität", "Anker setzen").

```sql
CREATE TABLE influencing_techniques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  beschreibung TEXT NOT NULL,
  anwendung TEXT NOT NULL,
  wichtige_aspekte JSONB NOT NULL,
  key_phrases JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `negotiation_tactics`
Verhandlungstaktiken (z.B. "Direktes Fordern", "Legitimieren").

```sql
CREATE TABLE negotiation_tactics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  beschreibung TEXT NOT NULL,
  anwendung TEXT NOT NULL,
  wichtige_aspekte JSONB NOT NULL,
  key_phrases JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `personality_types`
Persönlichkeitstypen für Gegenspieler.

```sql
CREATE TABLE personality_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archetype TEXT NOT NULL UNIQUE,
  behavior_description TEXT NOT NULL,
  advantages TEXT NOT NULL,
  risks TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `agents`
AI Agents (Konfiguration). `registration_id`, `role`, `agent_kind` und `model_name` sind optional, damit auch globale Templates möglich bleiben.

```sql
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID REFERENCES registrations(id) ON DELETE CASCADE,
  role agent_role,
  agent_kind agent_kind,
  model_name TEXT,
  system_prompt TEXT,
  tools JSONB NOT NULL DEFAULT '[]',
  hyperparams JSONB NOT NULL DEFAULT '{}',
  personality_profile JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. Simulation Execution (2)

#### `simulation_queue`
Queue für Batch-Simulation-Runs.

```sql
CREATE TABLE simulation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negotiation_id UUID NOT NULL REFERENCES negotiations(id) ON DELETE CASCADE,
  total_simulations INTEGER NOT NULL,
  priority INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'running' | 'completed' | 'failed' | 'paused'
  completed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  running_count INTEGER DEFAULT 0,
  pending_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_completion_at TIMESTAMPTZ,
  max_concurrent INTEGER DEFAULT 1,
  current_concurrent INTEGER DEFAULT 0,
  estimated_total_cost DECIMAL(10,4),
  actual_total_cost DECIMAL(10,4) DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  crash_recovery_checkpoint JSONB,
  metadata JSONB DEFAULT '{}'
);
```

#### `simulation_runs`
**Haupt-Ergebnis-Tabelle** - Einzelne Simulation-Runs mit allen Ergebnissen.

```sql
CREATE TABLE simulation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negotiation_id UUID REFERENCES negotiations(id) ON DELETE CASCADE,
  queue_id UUID REFERENCES simulation_queue(id) ON DELETE CASCADE,
  technique_id UUID REFERENCES influencing_techniques(id),
  tactic_id UUID REFERENCES negotiation_tactics(id),
  personality_id TEXT,
  zopa_distance TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'aborted' | 'paused'
  outcome TEXT, -- 'DEAL_ACCEPTED' | 'TERMINATED' | 'WALK_AWAY' | 'PAUSED' | 'MAX_ROUNDS_REACHED' | 'ERROR'
  outcome_reason TEXT,
  total_rounds INTEGER,
  run_number INTEGER,
  execution_order INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- RESULTS
  deal_value DECIMAL(15,2), -- ⭐ WICHTIG: Gesamtwert des Deals
  other_dimensions JSONB NOT NULL DEFAULT '{}', -- Weitere Dimensionen (z.B. Lieferzeit)
  conversation_log JSONB NOT NULL DEFAULT '[]', -- Vollständiger Gesprächsverlauf

  -- COSTS & EVALUATION
  actual_cost DECIMAL(10,4),
  cost_efficiency_score DECIMAL(10,4),
  technique_effectiveness_score DECIMAL(5,2),
  tactic_effectiveness_score DECIMAL(5,2),
  tactical_summary TEXT,

  -- TRACING
  langfuse_trace_id TEXT,
  metadata JSONB DEFAULT '{}'
);
```

### 5. Results & Analytics (2)

#### `dimension_results`
Detaillierte Ergebnisse pro Dimension.

```sql
CREATE TABLE dimension_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_run_id UUID NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
  dimension_name TEXT NOT NULL,
  final_value DECIMAL(15,4) NOT NULL,
  target_value DECIMAL(15,4) NOT NULL,
  achieved_target BOOLEAN NOT NULL,
  priority_score INTEGER NOT NULL,
  improvement_over_batna DECIMAL(15,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(simulation_run_id, dimension_name)
);
```

#### `product_results`
Detaillierte Ergebnisse pro Produkt.

```sql
CREATE TABLE product_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_run_id UUID NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,

  -- PRICES
  target_price DECIMAL(15,2) NOT NULL,
  min_max_price DECIMAL(15,2) NOT NULL,
  estimated_volume INTEGER NOT NULL,
  agreed_price DECIMAL(15,2) NOT NULL,

  -- DELTAS
  price_vs_target DECIMAL(10,2),
  absolute_delta_from_target DECIMAL(15,4),
  price_vs_min_max DECIMAL(10,2),
  absolute_delta_from_min_max DECIMAL(15,4),

  -- ZOPA
  within_zopa BOOLEAN DEFAULT TRUE,
  zopa_utilization DECIMAL(5,2),

  -- TOTALS
  subtotal DECIMAL(15,2) NOT NULL,
  target_subtotal DECIMAL(15,2) NOT NULL,
  delta_from_target_subtotal DECIMAL(15,2),

  -- PERFORMANCE
  performance_score DECIMAL(5,2),
  dimension_key TEXT,
  negotiation_round INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX product_results_simulation_run_idx ON product_results(simulation_run_id);
CREATE INDEX product_results_product_idx ON product_results(product_id);
```

## Entfernte Tabellen (15)

Diese Tabellen wurden gelöscht, da sie **nie genutzt** wurden oder durch neue Strukturen ersetzt sind:

1. ❌ `negotiation_rounds` - War für Round-by-Round Tracking gedacht
2. ❌ `round_states` - Intern Agent States pro Runde
3. ❌ `offers` - Angebote pro Runde
4. ❌ `concessions` - Zugeständnisse tracking
5. ❌ `events` - Event-Log
6. ❌ `interactions` - Agent Interactions
7. ❌ `agent_metrics` - Agent Performance Metrics
8. ❌ `performance_metrics` - Performance Tracking
9. ❌ `analytics_sessions` - Analytics Sessions
10. ❌ `benchmarks` - Benchmark Datasets
11. ❌ `experiments` - A/B Testing
12. ❌ `experiment_runs` - Experiment Runs
13. ❌ `product_dimension_values` - Time-series Product Data
14. ❌ `policies` - Policy Configuration
15. ❌ `simulations` - War duplicate von simulation_queue

## Datenfluss

### 1. Negotiation Setup & Authentication
```
JWT Auth User (integer ID) → negotiations (userId filtert Zugriff)
     ↓
negotiations (scenario mit products, dimensions, techniques, tactics)
     → negotiation_products (Link zu products)
```

### 2. Simulation Execution
```
negotiations → simulation_queue → simulation_runs (status: pending → running → completed)
```

### 3. Result Processing
```
Python Simulation Result
  ↓
simulation_runs (deal_value, conversation_log, other_dimensions)
  ↓
buildSimulationResultArtifacts()
  ↓
dimension_results + product_results
```

### 4. Analysis & Reporting
```
simulation_runs + dimension_results + product_results
  ↓
Frontend Analysis Helpers
  ↓
Dashboard, Reports, Comparisons
```

## Wichtige Felder

### `simulation_runs.deal_value` ⭐
**DAS** Hauptfeld für Analyse!
- Typ: `DECIMAL(15,2)`
- Berechnet aus allen `product_results.subtotal`
- **MUSS** gesetzt sein für erfolgreiche Analysen

### `product_results` vs. `dimension_results`
- **product_results**: Detaillierte Produkt-Preise und Volumen
- **dimension_results**: Andere Dimensionen (z.B. Lieferzeit, Zahlungsziel)

### `simulation_runs.conversation_log`
- Vollständiger Gesprächsverlauf
- Format: Array von `{ round, turn, agent, message, offer, action, ... }`
- `round` bezeichnet einen vollständigen Austausch (Buyer ↔ Seller), `turn` die absolute Zugnummer.
- Wird für AI-Evaluation, Replay und Preisverlauf genutzt

### `negotiations.playbook` & `negotiations.playbook_generated_at` 📖
- **playbook**: TEXT - Vollständiges generiertes Playbook im Markdown-Format
- **playbook_generated_at**: TIMESTAMPTZ - Zeitstempel wann das Playbook generiert wurde
- Wird gecacht um wiederholte LLM-Calls zu vermeiden
- GET `/api/negotiations/:id/playbook` gibt gecachte Version zurück falls vorhanden
- POST `/api/negotiations/:id/playbook` erzwingt Neu-Generierung
- Sidebar zeigt Playbook-Link als aktiv wenn `playbook` Feld gesetzt ist

## Authentication & Authorization 🔐

### JWT-Based Authentication System
Das System verwendet eine **selbst-gehostete JWT-basierte Authentifizierung** (ersetzt Stack Auth):

#### User Table
- **`users.id`**: SERIAL (INTEGER) - Auto-incrementing primary key
- **`users.username`**: TEXT NOT NULL UNIQUE - Login-Benutzername
- **`users.password`**: TEXT NOT NULL - Bcrypt-gehashtes Passwort

#### JWT Token Flow
```
Login → POST /api/login
  ↓
  username + password Validierung
  ↓
  JWT Token generiert (7 Tage gültig)
  ↓
  Token gespeichert in localStorage (auth_token)
  ↓
  Alle API Requests senden Authorization: Bearer <token>
  ↓
  Server validiert Token und extrahiert userId
```

#### Middleware & User Isolation
- **`requireAuth()`**: Express Middleware - validiert JWT Token, setzt `req.userId`
- **`optionalAuth()`**: Express Middleware - validiert JWT optional, setzt `req.userId` falls vorhanden
- **User Isolation**: Alle Queries filtern automatisch mit `WHERE user_id = req.userId`
- **Foreign Key**: `negotiations.user_id` → `users.id` (ON DELETE CASCADE)

#### Frontend Integration
- **`fetchWithAuth()`**: Wrapper um `fetch()` der automatisch JWT Token in Headers einfügt
- **`queryClient`**: TanStack Query Client mit automatischer JWT-Injection in allen Queries
- **`useAuth()`**: React Context Hook für User State und Login/Logout
- **401 Handling**: Bei 401 Unauthorized wird Token gelöscht und User zu Splash-Screen weitergeleitet

#### Security Features
- ✅ Bcrypt Password Hashing
- ✅ JWT Token mit 7-Tagen Expiry
- ✅ Bearer Token Authentication
- ✅ Automatic Token Refresh on 401
- ✅ User Isolation via Foreign Keys
- ✅ SQL Injection Prevention (Parameterized Queries)

## Enums

```sql
CREATE TYPE negotiation_status AS ENUM ('planned', 'running', 'completed', 'aborted');
CREATE TYPE agent_role AS ENUM ('buyer', 'seller', 'coach', 'observer', 'other');
CREATE TYPE agent_kind AS ENUM ('llm', 'rule', 'human', 'hybrid');
CREATE TYPE counterpart_kind AS ENUM ('retailer', 'manufacturer', 'distributor', 'other');
```

## Migration History

### 0000_redundant_menace.sql
Initial schema mit allen Tabellen.

### 0001_adjust-product-results-scale.sql
Anpassung der Decimal-Scale für product_results.

### 0002_cleanup-schema.sql
- Entfernung aller ungenutzten Tabellen
- Bereinigung der Foreign Keys
- Löschung alter Daten ohne deal_value

### 0003_add-counterpart-personality.sql
- Hinzufügung von `dominance` und `affiliation` Spalten zu `counterparts`

### 0004_add-playbook-to-negotiations.sql ✅ AKTUELL
- Hinzufügung von `playbook` (TEXT) zu `negotiations` - speichert generiertes Playbook Markdown
- Hinzufügung von `playbook_generated_at` (TIMESTAMPTZ) zu `negotiations` - Zeitstempel der Generierung

## Nächste Schritte

1. ✅ Schema bereinigt
2. ✅ Migration ausgeführt
3. ✅ Alte Daten gelöscht
4. ⏳ TypeScript-Typen synchronisieren (falls neue Felder ergänzt werden)
5. ⏳ Neue Test-Simulation durchführen
6. ⏳ Verifizieren, dass Monitoring/Analyse (inkl. Preisverlauf & Evaluations) funktioniert
