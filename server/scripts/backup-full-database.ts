import { db } from '../db';
import * as schema from '@shared/schema';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function backupFullDatabase() {
  console.log('💾 Creating full database backup...\n');

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
          console.log(`⚠️  Table ${tableName} not found in schema, skipping`);
          continue;
        }

        const data = await db.select().from(table);
        backup.tables[tableName] = data;
        console.log(`✅ Backed up ${tableName}: ${data.length} rows`);
      } catch (error) {
        console.log(`⚠️  Could not backup ${tableName}:`, (error as Error).message);
      }
    }

    // Write backup file
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));

    const stats = fs.statSync(backupFile);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log(`\n✅ Full database backup complete!`);
    console.log(`📁 File: ${backupFile}`);
    console.log(`📊 Size: ${fileSizeMB} MB`);
    console.log(`\n🔒 Rollback instructions:`);
    console.log(`   git checkout 3f8da63`);
    console.log(`   npm run db:push`);

  } catch (error) {
    console.error('❌ Error creating backup:', error);
    process.exit(1);
  }
}

backupFullDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
