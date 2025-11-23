/**
 * Debug script to test simulation result processing
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, count } from "drizzle-orm";
import { simulationRuns, negotiations, products, negotiationProducts, dimensionResults, productResults } from "../shared/schema";
import { storage } from "../server/storage";
import { buildSimulationResultArtifacts } from "../server/services/simulation-result-processor";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  const negotiationId = "1601b2c2-b47a-417d-90d0-ea2f09769fb8";

  console.log("\n=== DEBUGGING SIMULATION RESULT PROCESSING ===\n");

  // 1. Get negotiation
  console.log("1. Fetching negotiation...");
  const negotiation = await storage.getNegotiation(negotiationId);
  if (!negotiation) {
    console.error("❌ Negotiation not found!");
    return;
  }
  console.log(`✓ Negotiation found: ${negotiation.title}`);
  console.log(`  - Scenario products:`, negotiation.scenario?.products?.length || 0);
  console.log(`  - Scenario dimensions:`, negotiation.scenario?.dimensions?.length || 0);

  // 2. Get products
  console.log("\n2. Fetching products...");
  const negotiationProducts = await storage.getProductsByNegotiation(negotiationId);
  console.log(`✓ Found ${negotiationProducts.length} products`);
  negotiationProducts.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name} (ID: ${p.id?.slice(0, 8)})`);
    console.log(`     attrs:`, p.attrs);
  });

  // 3. Get first simulation run
  console.log("\n3. Fetching simulation runs...");
  const [run] = await db
    .select()
    .from(simulationRuns)
    .where(eq(simulationRuns.negotiationId, negotiationId))
    .limit(1);

  if (!run) {
    console.error("❌ No simulation runs found!");
    return;
  }

  console.log(`✓ Run found: ${run.id.slice(0, 8)}`);
  console.log(`  - Status: ${run.status}`);
  console.log(`  - Total rounds: ${run.totalRounds}`);
  console.log(`  - Deal value (current): ${run.dealValue}`);
  console.log(`  - Other dimensions:`, run.otherDimensions);
  console.log(`  - Conversation log entries:`, Array.isArray(run.conversationLog) ? run.conversationLog.length : 0);

  // 4. Test buildSimulationResultArtifacts
  console.log("\n4. Testing buildSimulationResultArtifacts...");
  try {
    const artifacts = buildSimulationResultArtifacts({
      runId: run.id,
      negotiation,
      products: negotiationProducts,
      dimensionValues: run.otherDimensions as any,
      conversationLog: run.conversationLog as any,
    });

    console.log("✓ Artifacts generated:");
    console.log(`  - Deal value: ${artifacts.dealValue}`);
    console.log(`  - Dimension rows: ${artifacts.dimensionRows.length}`);
    console.log(`  - Product rows: ${artifacts.productRows.length}`);
    console.log(`  - Other dimensions: ${Object.keys(artifacts.otherDimensions).length} entries`);

    if (artifacts.dimensionRows.length > 0) {
      console.log("\n  Dimension rows:");
      artifacts.dimensionRows.forEach(d => {
        console.log(`    - ${d.dimensionName}: ${d.finalValue} (target: ${d.targetValue}, achieved: ${d.achievedTarget})`);
      });
    }

    if (artifacts.productRows.length > 0) {
      console.log("\n  Product rows:");
      artifacts.productRows.forEach(p => {
        console.log(`    - ${p.productName}: agreed=${p.agreedPrice}, target=${p.targetPrice}, vol=${p.estimatedVolume}, subtotal=${p.subtotal}`);
      });
    } else {
      console.log("\n  ⚠️ No product rows generated!");
    }

    // 5. Check current DB state
    console.log("\n5. Checking current DB state...");
    const [dimCount] = await db
      .select({ count: count() })
      .from(dimensionResults)
      .where(eq(dimensionResults.simulationRunId, run.id));

    const [prodCount] = await db
      .select({ count: count() })
      .from(productResults)
      .where(eq(productResults.simulationRunId, run.id));

    console.log(`  - dimension_results entries: ${dimCount.count}`);
    console.log(`  - product_results entries: ${prodCount.count}`);

    // 6. Check why products might not match
    console.log("\n6. Analyzing product matching...");
    const dimensionValues = run.otherDimensions as Record<string, any>;
    console.log("  Available dimension keys:", Object.keys(dimensionValues || {}));

    if (negotiationProducts.length > 0) {
      negotiationProducts.forEach(product => {
        console.log(`\n  Product: ${product.name}`);
        const productKey = product.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        console.log(`    Normalized key: ${productKey}`);

        // Look for matching keys
        const matchingKeys = Object.keys(dimensionValues || {}).filter(key =>
          key.toLowerCase().replace(/[^a-z0-9]/g, '').includes(productKey) ||
          productKey.includes(key.toLowerCase().replace(/[^a-z0-9]/g, ''))
        );
        console.log(`    Matching dimension keys:`, matchingKeys);
      });
    }

    console.log("\n=== ANALYSIS COMPLETE ===\n");

  } catch (error) {
    console.error("❌ Error building artifacts:", error);
  }
}

main().catch(console.error);
