/**
 * Run schema cleanup migration
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log("\n=== RUNNING SCHEMA CLEANUP MIGRATION ===\n");

  const migration = readFileSync("migrations/0002_cleanup-schema.sql", "utf8");
  const statements = migration
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--") && s !== "");

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const stmt of statements) {
    const preview = stmt.substring(0, 70).replace(/\s+/g, " ");
    process.stdout.write(`${preview}... `);

    try {
      await sql(stmt);
      console.log("✓");
      successCount++;
    } catch (err: any) {
      if (err.message.includes("does not exist")) {
        console.log("⊘ (already removed)");
        skipCount++;
      } else {
        console.log("❌", err.message);
        errorCount++;
      }
    }
  }

  console.log(`\n=== MIGRATION COMPLETE ===`);
  console.log(`✓ Success: ${successCount}`);
  console.log(`⊘ Skipped: ${skipCount}`);
  console.log(`❌ Errors: ${errorCount}`);

  // Verify remaining tables
  console.log(`\n=== REMAINING TABLES ===\n`);
  const tables = await sql`
    SELECT table_name,
           (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
    FROM information_schema.tables t
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;

  tables.forEach((table: any) => {
    console.log(`  ${table.table_name} (${table.column_count} columns)`);
  });

  console.log(`\nTotal tables: ${tables.length}\n`);
}

main().catch(console.error);
