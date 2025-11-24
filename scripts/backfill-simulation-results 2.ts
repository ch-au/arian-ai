/**
 * Backfill script to process existing simulation runs
 * that don't have deal_value, dimension_results, or product_results
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, isNull, count } from "drizzle-orm";
import { simulationRuns, dimensionResults, productResults } from "../shared/schema";
import { storage } from "../server/storage";
import { buildSimulationResultArtifacts } from "../server/services/simulation-result-processor";
import { db } from "../server/db";

async function main() {
  console.log("\n=== BACKFILLING SIMULATION RESULTS ===\n");

  // 1. Find all completed runs without deal_value
  console.log("1. Finding runs without deal_value...");
  const runsToBackfill = await db
    .select()
    .from(simulationRuns)
    .where(isNull(simulationRuns.dealValue));

  console.log(`✓ Found ${runsToBackfill.length} runs to backfill`);

  if (runsToBackfill.length === 0) {
    console.log("\n✓ No runs need backfilling!\n");
    return;
  }

  // 2. Process each run
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const run of runsToBackfill) {
    const shortId = run.id.slice(0, 8);
    process.stdout.write(`\n[${successCount + skipCount + errorCount + 1}/${runsToBackfill.length}] Run ${shortId}... `);

    try {
      // Skip if no negotiationId
      if (!run.negotiationId) {
        console.log("⊘ (no negotiationId)");
        skipCount++;
        continue;
      }

      // Skip if no conversation log
      const conversationLog = run.conversationLog as any[];
      if (!conversationLog || conversationLog.length === 0) {
        console.log("⊘ (no conversation_log)");
        skipCount++;
        continue;
      }

      // Get negotiation and products
      const negotiation = await storage.getNegotiation(run.negotiationId);
      if (!negotiation) {
        console.log("⊘ (negotiation not found)");
        skipCount++;
        continue;
      }

      const products = await storage.getProductsByNegotiation(run.negotiationId);

      // Build artifacts
      const artifacts = buildSimulationResultArtifacts({
        runId: run.id,
        negotiation,
        products,
        dimensionValues: (run.otherDimensions as any) || {},
        conversationLog,
      });

      // Update simulation_runs
      await db.update(simulationRuns)
        .set({
          dealValue: artifacts.dealValue,
          otherDimensions: artifacts.otherDimensions,
        })
        .where(eq(simulationRuns.id, run.id));

      // Delete old results (if any)
      await db.delete(dimensionResults).where(eq(dimensionResults.simulationRunId, run.id));
      await db.delete(productResults).where(eq(productResults.simulationRunId, run.id));

      // Insert new results
      if (artifacts.dimensionRows.length > 0) {
        await db.insert(dimensionResults).values(artifacts.dimensionRows);
      }

      if (artifacts.productRows.length > 0) {
        await db.insert(productResults).values(artifacts.productRows);
      }

      console.log(`✓ (deal_value=${artifacts.dealValue}, dims=${artifacts.dimensionRows.length}, prods=${artifacts.productRows.length})`);
      successCount++;

    } catch (error: any) {
      console.log(`❌ (${error.message})`);
      errorCount++;
    }
  }

  // 3. Summary
  console.log("\n=== BACKFILL SUMMARY ===\n");
  console.log(`✓ Success: ${successCount}`);
  console.log(`⊘ Skipped: ${skipCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`\nTotal processed: ${successCount + skipCount + errorCount}/${runsToBackfill.length}\n`);

  // 4. Verify
  console.log("=== VERIFICATION ===\n");
  const [remainingNulls] = await db
    .select({ count: count() })
    .from(simulationRuns)
    .where(isNull(simulationRuns.dealValue));

  const [totalDims] = await db
    .select({ count: count() })
    .from(dimensionResults);

  const [totalProds] = await db
    .select({ count: count() })
    .from(productResults);

  console.log(`Runs without deal_value: ${remainingNulls.count}`);
  console.log(`Total dimension_results: ${totalDims.count}`);
  console.log(`Total product_results: ${totalProds.count}`);

  if (remainingNulls.count === 0 && totalDims.count > 0 && totalProds.count > 0) {
    console.log("\n🎉 Backfill complete! All runs processed.\n");
  } else {
    console.log("\n⚠️ Some runs still need processing.\n");
  }
}

main().catch((err) => {
  console.error("\n❌ Error:", err);
  process.exit(1);
});
