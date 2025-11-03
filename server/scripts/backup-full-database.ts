import { db } from '../db';
import * as schema from '@shared/schema';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequestLogger } from '../services/logger';

const log = createRequestLogger('script:backup-full-database');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function backupFullDatabase() {
  log.info('💾 Creating full database backup...\n');

  const backupDir = path.join(__dirname, '../seed-data');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `full-backup-${timestamp}.json`);

  try {
    const backup: any = {
      timestamp: new Date().toISOString(),
      tables: {}
    };

    // Export all tables
    const tables = [
      'influencingTechniques',
      'negotiationTactics',
      'negotiations',
      'products',
      'simulationQueue',
      'simulationRuns',
      'negotiationContexts',
      'agents',
    ];

    for (const tableName of tables) {
      try {
        const table = (schema as any)[tableName];
        if (!table) {
          log.warn({ tableName }, `⚠️  Table ${tableName} not found in schema, skipping`);
          continue;
        }

        const data = await db.select().from(table);
        backup.tables[tableName] = data;
        log.info({ tableName, rowCount: data.length }, `✅ Backed up ${tableName}: ${data.length} rows`);
      } catch (error) {
        log.warn({ err: error, tableName }, `⚠️  Could not backup ${tableName}: ${(error as Error).message}`);
      }
    }

    // Write backup file
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));

    const stats = fs.statSync(backupFile);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);

    log.info(`\n✅ Full database backup complete!`);
    log.info(`📁 File: ${backupFile}`);
    log.info(`📊 Size: ${fileSizeMB} MB`);
    log.info(`\n🔒 Rollback instructions:`);
    log.info(`   git checkout 3f8da63`);
    log.info(`   npm run db:push`);

  } catch (error) {
    log.error({ err: error }, '❌ Error creating backup');
    process.exit(1);
  }
}

backupFullDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    log.error({ err: error }, 'Fatal error');
    process.exit(1);
  });
