#!/usr/bin/env node
/**
 * Verify that the new schema was deployed correctly
 */

import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { createRequestLogger } from '../services/logger';

const log = createRequestLogger('script:verify-schema');

async function verifySchema() {
  log.info('🔍 Verifying schema deployment...\n');

  try {
    // Check that all expected tables exist
    const tablesQuery = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const tables = tablesQuery.rows.map((row: any) => row.table_name);

    log.info(`Found ${tables.length} tables:\n`);
    tables.forEach((table: string) => log.info(`  ✓ ${table}`));

    const expectedTables = [
      'agents',
      'agent_metrics',
      'analytics_sessions',
      'benchmarks',
      'concessions',
      'counterparts',
      'dimension_results',
      'dimensions',
      'events',
      'experiment_runs',
      'experiments',
      'influencing_techniques',
      'interactions',
      'markets',
      'negotiation_products',
      'negotiation_rounds',
      'negotiation_tactics',
      'negotiations',
      'offers',
      'performance_metrics',
      'personality_types',
      'policies',
      'product_dimension_values',
      'product_results',
      'products',
      'registrations',
      'round_states',
      'simulation_queue',
      'simulation_runs',
      'simulations',
    ];

    log.info('\n📊 Verification:\n');

    const missingTables = expectedTables.filter(t => !tables.includes(t));
    const extraTables = tables.filter((t: string) => !expectedTables.includes(t));

    if (missingTables.length === 0 && extraTables.length === 0) {
      log.info('✅ All expected tables present');
      log.info('✅ No unexpected tables found');
    } else {
      if (missingTables.length > 0) {
        log.warn({ missingTables }, `❌ Missing tables: ${missingTables.join(', ')}`);
      }
      if (extraTables.length > 0) {
        log.warn({ extraTables }, `⚠️  Extra tables: ${extraTables.join(', ')}`);
      }
    }

    // Check productResults table structure
    log.info('\n🔍 Checking productResults table structure...');
    const columnsQuery = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'product_results'
      ORDER BY ordinal_position
    `);

    const columns = columnsQuery.rows;
    log.info(`\n  Found ${columns.length} columns in product_results table`);

    const keyColumns = [
      'simulation_run_id',
      'product_id',
      'agreed_price',
      'price_vs_target',
      'absolute_delta_from_target',
      'within_zopa',
      'zopa_utilization',
      'subtotal',
      'performance_score'
    ];

    log.info('\n  Key columns:');
    keyColumns.forEach(col => {
      const found = columns.find((c: any) => c.column_name === col);
      if (found) {
        log.info(`    ✓ ${col} (${found.data_type})`);
      } else {
        log.error({ column: col }, `    ❌ ${col} NOT FOUND`);
      }
    });

    log.info('\n✅ Schema verification complete!\n');
    process.exit(0);
  } catch (error) {
    log.error({ err: error }, '❌ Error verifying schema');
    process.exit(1);
  }
}

verifySchema();
