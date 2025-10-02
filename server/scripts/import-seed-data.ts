#!/usr/bin/env node
/**
 * Import seed data (techniques and tactics) back to the fresh database
 */

import 'dotenv/config';
import { db } from '../db';
import { influencingTechniques, negotiationTactics } from '@shared/schema';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importSeedData() {
  console.log('📥 Importing seed data...\n');

  try {
    // Import influencing techniques
    const techniquesPath = path.join(__dirname, '../seed-data/influencing-techniques.json');
    const techniquesData = JSON.parse(fs.readFileSync(techniquesPath, 'utf-8'));

    console.log(`Importing ${techniquesData.length} influencing techniques...`);
    for (const technique of techniquesData) {
      // Convert timestamp strings to Date objects
      const values = {
        ...technique,
        createdAt: technique.createdAt ? new Date(technique.createdAt) : undefined,
        updatedAt: technique.updatedAt ? new Date(technique.updatedAt) : undefined,
      };
      await db.insert(influencingTechniques).values(values);
    }
    console.log(`✅ Imported ${techniquesData.length} influencing techniques\n`);

    // Import negotiation tactics
    const tacticsPath = path.join(__dirname, '../seed-data/negotiation-tactics.json');
    const tacticsData = JSON.parse(fs.readFileSync(tacticsPath, 'utf-8'));

    console.log(`Importing ${tacticsData.length} negotiation tactics...`);
    for (const tactic of tacticsData) {
      // Convert timestamp strings to Date objects
      const values = {
        ...tactic,
        createdAt: tactic.createdAt ? new Date(tactic.createdAt) : undefined,
        updatedAt: tactic.updatedAt ? new Date(tactic.updatedAt) : undefined,
      };
      await db.insert(negotiationTactics).values(values);
    }
    console.log(`✅ Imported ${tacticsData.length} negotiation tactics\n`);

    console.log('✅ Seed data import complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error importing seed data:', error);
    process.exit(1);
  }
}

importSeedData();
