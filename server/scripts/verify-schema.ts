#!/usr/bin/env node
/**
 * Verify that the new schema was deployed correctly
 */

import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../db';

async function verifySchema() {
  console.log('🔍 Verifying schema deployment...\n');

  try {
    // Check that all expected tables exist
    const tablesQuery = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const tables = tablesQuery.rows.map((row: any) => row.table_name);

    console.log(`Found ${tables.length} tables:\n`);
    tables.forEach((table: string) => console.log(`  ✓ ${table}`));

    const expectedTables = [
      'agents',
      'influencing_techniques',
      'negotiation_contexts',
      'negotiation_rounds',
      'negotiation_tactics',
      'negotiations',
      'product_results',
      'products',
      'simulation_queue',
      'simulation_runs'
    ];

    console.log('\n📊 Verification:\n');

    const missingTables = expectedTables.filter(t => !tables.includes(t));
    const extraTables = tables.filter((t: string) => !expectedTables.includes(t));

    if (missingTables.length === 0 && extraTables.length === 0) {
      console.log('✅ All expected tables present');
      console.log('✅ No unexpected tables found');
    } else {
      if (missingTables.length > 0) {
        console.log(`❌ Missing tables: ${missingTables.join(', ')}`);
      }
      if (extraTables.length > 0) {
        console.log(`⚠️  Extra tables: ${extraTables.join(', ')}`);
      }
    }

    // Check productResults table structure
    console.log('\n🔍 Checking productResults table structure...');
    const columnsQuery = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'product_results'
      ORDER BY ordinal_position
    `);

    const columns = columnsQuery.rows;
    console.log(`\n  Found ${columns.length} columns in product_results table`);

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

    console.log('\n  Key columns:');
    keyColumns.forEach(col => {
      const found = columns.find((c: any) => c.column_name === col);
      if (found) {
        console.log(`    ✓ ${col} (${found.data_type})`);
      } else {
        console.log(`    ❌ ${col} NOT FOUND`);
      }
    });

    console.log('\n✅ Schema verification complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error verifying schema:', error);
    process.exit(1);
  }
}

verifySchema();
