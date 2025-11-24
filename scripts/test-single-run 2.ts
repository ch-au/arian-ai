/**
 * Test a single simulation run directly without queue processor
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc, count } from "drizzle-orm";
import { negotiations, influencingTechniques, negotiationTactics, simulationRuns, dimensionResults, productResults } from "../shared/schema";
import { storage } from "../server/storage";
import { PythonNegotiationService } from "../server/services/python-negotiation-service";
import { buildSimulationResultArtifacts } from "../server/services/simulation-result-processor";
import { db } from "../server/db";

async function main() {
  console.log("\n=== TESTING SINGLE SIMULATION RUN ===\n");

  // 1. Get latest negotiation
  console.log("1. Fetching latest negotiation...");
  const [negotiation] = await db
    .select()
    .from(negotiations)
    .orderBy(desc(negotiations.id))
    .limit(1);

  if (!negotiation) {
    console.error("❌ No negotiations found!");
    process.exit(1);
  }

  console.log(`✓ Negotiation: ${negotiation.title} (${negotiation.id.slice(0, 8)})`);

  // 2. Get techniques and tactics
  const [technique] = await db.select().from(influencingTechniques).limit(1);
  const [tactic] = await db.select().from(negotiationTactics).limit(1);

  console.log(`✓ Technique: ${technique.name}`);
  console.log(`✓ Tactic: ${tactic.name}`);

  // 3. Create simulation run
  console.log("\n2. Creating simulation run...");
  const [run] = await db.insert(simulationRuns).values({
    negotiationId: negotiation.id,
    techniqueId: technique.id,
    tacticId: tactic.id,
    status: "pending",
    runNumber: 1,
  }).returning();

  console.log(`✓ Run created: ${run.id.slice(0, 8)}`);

  // 4. Execute negotiation
  console.log("\n3. Executing negotiation with Python service...");
  console.log("   (This may take 30-60 seconds)");

  try {
    const result = await PythonNegotiationService.runNegotiation({
      negotiationId: negotiation.id,
      simulationRunId: run.id,
      techniqueId: technique.id,
      tacticId: tactic.id,
      maxRounds: 6,
    });

    console.log(`\n✓ Negotiation completed!`);
    console.log(`   Outcome: ${result.outcome}`);
    console.log(`   Total Rounds: ${result.totalRounds}`);

    // 5. Get products
    const products = await storage.getProductsByNegotiation(negotiation.id);
    console.log(`   Products: ${products.length}`);

    // 6. Build artifacts
    console.log("\n4. Building artifacts...");
    const artifacts = buildSimulationResultArtifacts({
      runId: run.id,
      negotiation,
      products,
      dimensionValues: result.finalOffer?.dimension_values ?? {},
      conversationLog: result.conversationLog,
    });

    console.log(`✓ Artifacts built:`);
    console.log(`   Deal Value: ${artifacts.dealValue ? `€${artifacts.dealValue}` : "NULL"}`);
    console.log(`   Dimension Rows: ${artifacts.dimensionRows.length}`);
    console.log(`   Product Rows: ${artifacts.productRows.length}`);

    // 7. Write to database
    console.log("\n5. Writing results to database...");

    await db.update(simulationRuns)
      .set({
        status: "completed",
        outcome: result.outcome,
        totalRounds: result.totalRounds,
        dealValue: artifacts.dealValue,
        conversationLog: result.conversationLog,
        otherDimensions: artifacts.otherDimensions,
        completedAt: new Date(),
      })
      .where(eq(simulationRuns.id, run.id));

    console.log("✓ simulation_runs updated");

    // Delete old results
    await db.delete(dimensionResults).where(eq(dimensionResults.simulationRunId, run.id));
    await db.delete(productResults).where(eq(productResults.simulationRunId, run.id));

    // Insert new results
    if (artifacts.dimensionRows.length > 0) {
      await db.insert(dimensionResults).values(artifacts.dimensionRows);
      console.log(`✓ ${artifacts.dimensionRows.length} dimension_results inserted`);
    }

    if (artifacts.productRows.length > 0) {
      await db.insert(productResults).values(artifacts.productRows);
      console.log(`✓ ${artifacts.productRows.length} product_results inserted`);
    }

    // 8. Verify
    console.log("\n6. Verifying final state...");
    const [updatedRun] = await db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.id, run.id));

    const [dimCount] = await db
      .select({ count: count() })
      .from(dimensionResults)
      .where(eq(dimensionResults.simulationRunId, run.id));

    const [prodCount] = await db
      .select({ count: count() })
      .from(productResults)
      .where(eq(productResults.simulationRunId, run.id));

    console.log(`\n   Deal Value: ${updatedRun.dealValue ? `€${updatedRun.dealValue}` : "NULL"} ${updatedRun.dealValue ? "✓" : "❌"}`);
    console.log(`   Dimension Results: ${dimCount.count} ${dimCount.count > 0 ? "✓" : "❌"}`);
    console.log(`   Product Results: ${prodCount.count} ${prodCount.count > 0 ? "✓" : "❌"}`);

    // 9. Success!
    const allGood = updatedRun.dealValue !== null && dimCount.count > 0 && prodCount.count > 0;

    console.log("\n=== TEST RESULT ===\n");
    if (allGood) {
      console.log("✅ ALL CHECKS PASSED!");
      console.log("\n🎉 Simulation result processing works correctly!\n");
    } else {
      console.log("❌ SOME CHECKS FAILED");
      process.exit(1);
    }

  } catch (error: any) {
    console.error("\n❌ Error during execution:");
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n❌ Unhandled error:", err);
  process.exit(1);
});
