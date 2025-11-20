/**
 * Test script to run a single simulation and verify result processing
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc, count } from "drizzle-orm";
import { negotiations, influencingTechniques, negotiationTactics, simulationQueue, simulationRuns, dimensionResults, productResults } from "../shared/schema";
import { SimulationQueueService } from "../server/services/simulation-queue";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  console.log("\n=== TESTING SIMULATION RESULT PROCESSING ===\n");

  // 1. Get latest negotiation
  console.log("1. Fetching latest negotiation...");
  const [negotiation] = await db
    .select()
    .from(negotiations)
    .orderBy(desc(negotiations.id))
    .limit(1);

  if (!negotiation) {
    console.error("❌ No negotiations found! Run npm run db:seed first.");
    process.exit(1);
  }

  console.log(`✓ Found negotiation: ${negotiation.title} (${negotiation.id.slice(0, 8)})`);

  // 2. Get techniques and tactics
  console.log("\n2. Fetching techniques and tactics...");
  const [technique] = await db.select().from(influencingTechniques).limit(1);
  const [tactic] = await db.select().from(negotiationTactics).limit(1);

  if (!technique || !tactic) {
    console.error("❌ No techniques/tactics found! Run CSV import first.");
    process.exit(1);
  }

  console.log(`✓ Technique: ${technique.name}`);
  console.log(`✓ Tactic: ${tactic.name}`);

  // 3. Update negotiation scenario with techniques/tactics
  console.log("\n3. Updating negotiation scenario...");
  await db.update(negotiations)
    .set({
      scenario: {
        ...negotiation.scenario,
        selectedTechniques: [technique.id],
        selectedTactics: [tactic.id],
        counterpartPersonality: "default",
        zopaDistance: "medium",
      },
    })
    .where(eq(negotiations.id, negotiation.id));

  console.log("✓ Scenario updated");

  // 4. Create simulation queue (1 simulation for testing)
  console.log("\n4. Creating simulation queue...");
  const queueId = await SimulationQueueService.createQueue({
    negotiationId: negotiation.id,
    techniques: [technique.id],
    tactics: [tactic.id],
    personalities: ["default"],
    // zopaDistances removed - distance is now modeled explicitly via counterpartDistance
  });

  console.log(`✓ Queue created: ${queueId.slice(0, 8)}`);

  // 5. Start queue execution
  console.log("\n5. Starting queue execution...");
  await SimulationQueueService.startQueue(queueId);

  // 6. Wait for completion (poll every 2 seconds)
  console.log("\n6. Waiting for simulation to complete...");
  let attempts = 0;
  const maxAttempts = 60; // 2 minutes max

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    attempts++;

    const status = await SimulationQueueService.getQueueStatus(queueId);
    process.stdout.write(`\r   Progress: ${status.progressPercentage}% (${status.completedCount}/${status.totalSimulations}) `);

    if (status.status === "completed") {
      console.log("\n✓ Queue completed!");
      break;
    }

    if (status.status === "failed") {
      console.log("\n❌ Queue failed!");
      process.exit(1);
    }
  }

  if (attempts >= maxAttempts) {
    console.log("\n❌ Timeout waiting for queue completion");
    process.exit(1);
  }

  // 7. Verify results
  console.log("\n7. Verifying results...");

  const [run] = await db
    .select()
    .from(simulationRuns)
    .where(eq(simulationRuns.queueId, queueId))
    .limit(1);

  if (!run) {
    console.error("❌ No simulation run found!");
    process.exit(1);
  }

  console.log(`\n   Run ID: ${run.id.slice(0, 8)}`);
  console.log(`   Status: ${run.status}`);
  console.log(`   Outcome: ${run.outcome}`);
  console.log(`   Total Rounds: ${run.totalRounds}`);
  console.log(`   Deal Value: ${run.dealValue ? `€${run.dealValue}` : "NULL ❌"}`);

  // Check dimension_results
  const [dimCount] = await db
    .select({ count: count() })
    .from(dimensionResults)
    .where(eq(dimensionResults.simulationRunId, run.id));

  console.log(`   Dimension Results: ${dimCount.count} ${dimCount.count > 0 ? "✓" : "❌"}`);

  // Check product_results
  const [prodCount] = await db
    .select({ count: count() })
    .from(productResults)
    .where(eq(productResults.simulationRunId, run.id));

  console.log(`   Product Results: ${prodCount.count} ${prodCount.count > 0 ? "✓" : "❌"}`);

  // 8. Summary
  console.log("\n=== TEST SUMMARY ===\n");

  const allGood = run.dealValue !== null && dimCount.count > 0 && prodCount.count > 0;

  if (allGood) {
    console.log("✅ ALL CHECKS PASSED!");
    console.log("   - deal_value is set");
    console.log("   - dimension_results are populated");
    console.log("   - product_results are populated");
    console.log("\n🎉 Simulation result processing works correctly!\n");
  } else {
    console.log("❌ SOME CHECKS FAILED:");
    if (run.dealValue === null) console.log("   - deal_value is NULL");
    if (dimCount.count === 0) console.log("   - dimension_results are empty");
    if (prodCount.count === 0) console.log("   - product_results are empty");
    console.log("\n⚠️ Result processing needs debugging!\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n❌ Error:", err);
  process.exit(1);
});
