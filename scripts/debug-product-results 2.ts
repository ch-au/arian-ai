import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import {
  registrations,
  markets,
  counterparts,
  dimensions,
  products,
  productDimensionValues,
  negotiations,
  negotiationProducts,
  simulations,
  simulationQueue,
  simulationRuns,
  productResults,
} from "@shared/schema";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL not set");
  }

  const sql = neon(connectionString);
  const db = drizzle(sql);

  console.log("creating records...");
  const [registration] = await db
    .insert(registrations)
    .values({ organization: "Debug Org" })
    .returning();

  const [market] = await db
    .insert(markets)
    .values({ registrationId: registration.id, name: "Debug Market", currencyCode: "EUR" })
    .returning();
  const [counterpart] = await db
    .insert(counterparts)
    .values({ registrationId: registration.id, name: "Debug Retailer", kind: "retailer" })
    .returning();

  const [dimension] = await db
    .insert(dimensions)
    .values({ registrationId: registration.id, code: "debug", name: "Debug Dimension", valueType: "numeric" })
    .returning();

  const [product] = await db
    .insert(products)
    .values({ registrationId: registration.id, name: "Debug Product" })
    .returning();

  await db.insert(productDimensionValues).values({ productId: product.id, dimensionId: dimension.id, value: { amount: 1 } });

  const [negotiation] = await db
    .insert(negotiations)
    .values({ registrationId: registration.id, marketId: market.id, counterpartId: counterpart.id })
    .returning();

  await db.insert(negotiationProducts).values({ negotiationId: negotiation.id, productId: product.id });

  const [simulation] = await db
    .insert(simulations)
    .values({ registrationId: registration.id, negotiationId: negotiation.id, name: "Debug Sim" })
    .returning();

  const [queue] = await db.insert(simulationQueue).values({ negotiationId: negotiation.id, simulationId: simulation.id, totalSimulations: 1 }).returning();

  const [run] = await db
    .insert(simulationRuns)
    .values({ negotiationId: negotiation.id, simulationId: simulation.id, queueId: queue.id, status: "completed" })
    .returning();

  const inserted = await db
    .insert(productResults)
    .values({
      simulationRunId: run.id,
      productId: product.id,
      productName: "Debug Product",
      targetPrice: "1.30",
      minMaxPrice: "0.90",
      estimatedVolume: 100,
      agreedPrice: "1.20",
      subtotal: "120.00",
      targetSubtotal: "130.00",
    })
    .returning();

  console.log({ inserted });

  const rows = await db.select().from(productResults).where(eq(productResults.simulationRunId, run.id));
  console.log({ rows });

  // cleanup
  await db.delete(productResults).where(eq(productResults.simulationRunId, run.id));
  await db.delete(simulationRuns).where(eq(simulationRuns.id, run.id));
  await db.delete(simulationQueue).where(eq(simulationQueue.id, queue.id));
  await db.delete(simulations).where(eq(simulations.id, simulation.id));
  await db.delete(negotiationProducts).where(eq(negotiationProducts.negotiationId, negotiation.id));
  await db.delete(negotiations).where(eq(negotiations.id, negotiation.id));
  await db.delete(productDimensionValues).where(eq(productDimensionValues.productId, product.id));
  await db.delete(products).where(eq(products.id, product.id));
  await db.delete(dimensions).where(eq(dimensions.id, dimension.id));
  await db.delete(counterparts).where(eq(counterparts.id, counterpart.id));
  await db.delete(markets).where(eq(markets.id, market.id));
  await db.delete(registrations).where(eq(registrations.id, registration.id));
  console.log("cleanup done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
