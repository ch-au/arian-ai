#!/usr/bin/env node
/**
 * Drop all tables for fresh database reset
 * WARNING: This will DELETE ALL DATA - only run with backup in place
 */

import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../db';

async function dropAllTables() {
  console.log('⚠️  WARNING: Dropping all tables...\n');

  try {
    // Drop all tables - use DROP SCHEMA for complete clean
    console.log('Dropping public schema and recreating...');
    await db.execute(sql`DROP SCHEMA public CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);

    console.log('✅ All tables dropped successfully\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error dropping tables:', error);
    process.exit(1);
  }
}

dropAllTables();
