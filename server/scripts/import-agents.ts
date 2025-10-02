#!/usr/bin/env node
/**
 * Import agents from backup
 */

import 'dotenv/config';
import { db } from '../db';
import { agents } from '@shared/schema';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importAgents() {
  console.log('📥 Importing agents...\n');

  try {
    const agentsPath = path.join(__dirname, '../seed-data/agents.json');
    const agentsData = JSON.parse(fs.readFileSync(agentsPath, 'utf-8'));

    console.log(`Importing ${agentsData.length} agents...`);
    for (const agent of agentsData) {
      // Convert timestamp strings to Date objects and remove updatedAt (not in schema)
      const { updatedAt, ...agentData } = agent;
      const values = {
        ...agentData,
        createdAt: agentData.createdAt ? new Date(agentData.createdAt) : undefined,
      };
      await db.insert(agents).values(values);
    }
    console.log(`✅ Imported ${agentsData.length} agents\n`);

    console.log('✅ Agents import complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error importing agents:', error);
    process.exit(1);
  }
}

importAgents();
