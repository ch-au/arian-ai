#!/usr/bin/env node
/**
 * Drop all tables for fresh database reset
 * WARNING: This will DELETE ALL DATA - only run with backup in place
 */

import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { createRequestLogger } from '../services/logger';

const log = createRequestLogger('script:drop-all-tables');

async function dropAllTables() {
  log.warn('⚠️  WARNING: Dropping all tables...\n');

  try {
    // Drop all tables - use DROP SCHEMA for complete clean
    log.info('Dropping public schema and recreating...');
    await db.execute(sql`DROP SCHEMA public CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);

    log.info('✅ All tables dropped successfully\n');
    process.exit(0);
  } catch (error) {
    log.error({ err: error }, '❌ Error dropping tables');
    process.exit(1);
  }
}

dropAllTables();
