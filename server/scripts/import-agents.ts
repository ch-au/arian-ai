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
import { createRequestLogger } from '../services/logger';

const log = createRequestLogger('script:import-agents');

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importAgents() {
  log.info('📥 Importing agents...\n');

  try {
    const agentsPath = path.join(__dirname, '../seed-data/agents.json');
    const agentsData = JSON.parse(fs.readFileSync(agentsPath, 'utf-8'));

    log.info(`Importing ${agentsData.length} agents...`);
    for (const agent of agentsData) {
      // Convert timestamp strings to Date objects and remove updatedAt (not in schema)
      const { updatedAt, ...agentData } = agent;
      const values = {
        ...agentData,
        createdAt: agentData.createdAt ? new Date(agentData.createdAt) : undefined,
      };
      await db.insert(agents).values(values);
    }
    log.info(`✅ Imported ${agentsData.length} agents\n`);

    log.info('✅ Agents import complete!\n');
    process.exit(0);
  } catch (error) {
    log.error({ err: error }, '❌ Error importing agents');
    process.exit(1);
  }
}

importAgents();
