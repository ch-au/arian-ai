# Drizzle-Kit Push Workaround

## Problem

`npm run db:push` hängt bei "Pulling schema from database..." wegen esbuild-Architektur-Konflikt (ARM64 vs x64).

## Lösung

### Option 1: Schema ist bereits synchronisiert ✅

Wenn `drizzle-kit check` "Everything's fine" meldet, ist das Schema bereits synchronisiert. Die neuen Felder wurden bereits via SQL Migration hinzugefügt:
- `company_known`, `counterpart_known`, `negotiation_frequency`, `power_balance`, `verhandlungs_modus`

**Verifizierung:**
```bash
npm run db:check  # Sollte "Everything's fine" zeigen
```

### Option 2: Esbuild neu installieren

Falls doch Änderungen nötig sind:

```bash
# Node.js Architektur prüfen
node -p "process.arch"  # Sollte "arm64" sein

# Esbuild für richtige Architektur installieren
rm -rf node_modules/@esbuild*
npm install esbuild --save-dev

# Dann erneut versuchen
npm run db:push
```

### Option 3: Manuelle SQL Migration (wenn nötig)

Falls neue Felder fehlen, verwende die SQL Migration:
```bash
# Migration ausführen
node -e "import('dotenv/config').then(() => { const { Pool } = require('@neondatabase/serverless'); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); const fs = require('fs'); const sql = fs.readFileSync('server/migrations/add-phase2-fields.sql', 'utf8'); pool.query(sql).then(() => { console.log('✅ Migration successful'); process.exit(0); }); })"
```

## Status

✅ **Schema synchronisiert** - Alle Phase2 Felder existieren in der Datenbank
✅ **DATABASE_URL wird korrekt geladen** - `.env` wird von `dotenv/config` geladen
⚠️ **Esbuild-Problem** - `drizzle-kit push` hängt wegen Architektur-Konflikt, aber nicht kritisch da Schema bereits synchronisiert

## Workaround

Da das Schema bereits synchronisiert ist, kann `db:push` ignoriert werden. Für zukünftige Schema-Änderungen:
1. SQL Migration erstellen (`server/migrations/`)
2. Migration manuell ausführen
3. Oder esbuild-Problem beheben und dann `db:push` verwenden

