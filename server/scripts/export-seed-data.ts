import { db } from '../db';
import { influencingTechniques, negotiationTactics } from '@shared/schema';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequestLogger } from '../services/logger';

const log = createRequestLogger('script:export-seed-data');

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function exportSeedData() {
  log.info('📦 Exporting seed data...');

  try {
    // Export influencing techniques
    const techniques = await db.select().from(influencingTechniques);
    const techniquesPath = path.join(__dirname, '../seed-data/influencing-techniques.json');
    fs.writeFileSync(techniquesPath, JSON.stringify(techniques, null, 2));
    log.info({ count: techniques.length, path: techniquesPath }, `✅ Exported ${techniques.length} influencing techniques`);

    // Export negotiation tactics
    const tactics = await db.select().from(negotiationTactics);
    const tacticsPath = path.join(__dirname, '../seed-data/negotiation-tactics.json');
    fs.writeFileSync(tacticsPath, JSON.stringify(tactics, null, 2));
    log.info({ count: tactics.length, path: tacticsPath }, `✅ Exported ${tactics.length} negotiation tactics`);

    log.info('\n✅ Seed data export complete!');
    log.info('Files created:');
    log.info(`  - ${techniquesPath}`);
    log.info(`  - ${tacticsPath}`);
  } catch (error) {
    log.error({ err: error }, '❌ Error exporting seed data');
    process.exit(1);
  }
}

exportSeedData()
  .then(() => process.exit(0))
  .catch((error) => {
    log.error({ err: error }, 'Fatal error');
    process.exit(1);
  });
