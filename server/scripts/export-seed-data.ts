import { db } from '../db';
import { influencingTechniques, negotiationTactics } from '@shared/schema';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function exportSeedData() {
  console.log('📦 Exporting seed data...');

  try {
    // Export influencing techniques
    const techniques = await db.select().from(influencingTechniques);
    const techniquesPath = path.join(__dirname, '../seed-data/influencing-techniques.json');
    fs.writeFileSync(techniquesPath, JSON.stringify(techniques, null, 2));
    console.log(`✅ Exported ${techniques.length} influencing techniques to ${techniquesPath}`);

    // Export negotiation tactics
    const tactics = await db.select().from(negotiationTactics);
    const tacticsPath = path.join(__dirname, '../seed-data/negotiation-tactics.json');
    fs.writeFileSync(tacticsPath, JSON.stringify(tactics, null, 2));
    console.log(`✅ Exported ${tactics.length} negotiation tactics to ${tacticsPath}`);

    console.log('\n✅ Seed data export complete!');
    console.log('Files created:');
    console.log(`  - ${techniquesPath}`);
    console.log(`  - ${tacticsPath}`);
  } catch (error) {
    console.error('❌ Error exporting seed data:', error);
    process.exit(1);
  }
}

exportSeedData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
