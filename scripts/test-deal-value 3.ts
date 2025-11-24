import { db } from "../server/db";
import { simulationRuns, productResults } from "@shared/schema";
import { eq } from "drizzle-orm";

const negotiationId = "daa3108b-87f4-487c-bfa1-99879ac7017c";

async function main() {
  // Get all simulation runs for this negotiation
  const runs = await db
    .select()
    .from(simulationRuns)
    .where(eq(simulationRuns.negotiationId, negotiationId));

  console.log(`\nFound ${runs.length} simulation runs`);

  for (const run of runs.slice(0, 5)) { // Just check first 5 runs
    console.log(`\n--- Run #${run.runNumber} (${run.id.slice(0, 8)}) ---`);
    console.log(`Status: ${run.status}`);
    console.log(`Deal Value (stored): €${run.dealValue}`);

    // Get product results for this run
    const products = await db
      .select()
      .from(productResults)
      .where(eq(productResults.simulationRunId, run.id));

    console.log(`Product Results: ${products.length} products`);

    let calculatedTotal = 0;
    for (const product of products) {
      console.log(`  - ${product.productName}: €${product.agreedPrice} × ${product.estimatedVolume} = €${product.subtotal}`);
      calculatedTotal += Number(product.subtotal);
    }

    console.log(`Calculated Total (sum of subtotals): €${calculatedTotal.toFixed(2)}`);

    if (run.dealValue && Math.abs(Number(run.dealValue) - calculatedTotal) > 0.01) {
      console.log(`⚠️  MISMATCH! Stored dealValue doesn't match sum of product subtotals!`);
    }
  }

  process.exit(0);
}

main().catch(console.error);
