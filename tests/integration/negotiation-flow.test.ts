import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@shared/schema";
import {
  users,
  registrations,
  markets,
  counterparts,
  dimensions,
  products,
  negotiations,
  negotiationProducts,
  simulationQueue,
  simulationRuns,
  productResults,
  dimensionResults,
  influencingTechniques,
  negotiationTactics,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { debugLog, getTableName } from "../helpers/debug";

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const runDbTests = Boolean(connectionString) && process.env.RUN_DB_TESTS === "true";

if (!runDbTests) {
  describe.skip("Negotiation flow integration", () => {
    it("skipped because RUN_DB_TESTS is not enabled", () => {
      expect(true).toBe(true);
    });
  });
} else {
  const sql = neon(connectionString!);
  const db = drizzle(sql, { schema });

  const cleanupTables = [
    dimensionResults,
    productResults,
    simulationRuns,
    simulationQueue,
    negotiationProducts,
    negotiations,
    products,
    dimensions,
    counterparts,
    markets,
    registrations,
    users,
    influencingTechniques,
    negotiationTactics,
  ];

  async function cleanupIntegrationDb() {
    debugLog("integration-test:cleanup:start");
    for (const table of cleanupTables) {
      // eslint-disable-next-line no-await-in-loop
      await db.delete(table);
      debugLog("integration-test:cleanup:table", { table: getTableName(table) });
    }
    debugLog("integration-test:cleanup:complete");
  }

  describe("Negotiation flow integration", () => {
    beforeAll(cleanupIntegrationDb);
    afterAll(cleanupIntegrationDb);

    it("creates a negotiation, schedules a run and stores results", async () => {
      const [user] = await db.insert(users).values({ username: "integration-user", password: "secret" }).returning();

      const [registration] = await db
        .insert(registrations)
        .values({
          organization: "Integration Org",
          company: "Integration Co",
          goals: { targetMargin: 12 },
        })
        .returning();
      debugLog("integration-test:create:registration", { registrationId: registration.id });

      const [market] = await db
        .insert(markets)
        .values({
          registrationId: registration.id,
          name: "Integration Market",
          currencyCode: "EUR",
        })
        .returning();

      const [counterpart] = await db
        .insert(counterparts)
        .values({
          registrationId: registration.id,
          name: "Integration Retailer",
          kind: "retailer",
        })
        .returning();

      const [priceDimension] = await db
        .insert(dimensions)
        .values({
          registrationId: registration.id,
          code: "price_per_unit",
          name: "Price per Unit",
          unit: "EUR",
        })
        .returning();
      debugLog("integration-test:create:dimension", { dimensionId: priceDimension.id, code: "price_per_unit" });

      const [volumeDimension] = await db
        .insert(dimensions)
        .values({
          registrationId: registration.id,
          code: "volume",
          name: "Volume per Month",
          unit: "cases",
        })
        .returning();
      debugLog("integration-test:create:dimension", { dimensionId: volumeDimension.id, code: "volume" });

      const [productA] = await db
        .insert(products)
        .values({
          registrationId: registration.id,
          name: "Integration Product A",
        })
        .returning();

      const [productB] = await db
        .insert(products)
        .values({
          registrationId: registration.id,
          name: "Integration Product B",
        })
        .returning();

      const [technique] = await db
        .insert(influencingTechniques)
        .values({
          name: "Integration Technique",
          beschreibung: "desc",
          anwendung: "apply",
          wichtigeAspekte: {},
          keyPhrases: {},
        })
        .returning();

      const [tactic] = await db
        .insert(negotiationTactics)
        .values({
          name: "Integration Tactic",
          beschreibung: "desc",
          anwendung: "apply",
          wichtigeAspekte: {},
          keyPhrases: {},
        })
        .returning();

      const [negotiation] = await db
        .insert(negotiations)
        .values({
          registrationId: registration.id,
          userId: user.id,
          marketId: market.id,
          counterpartId: counterpart.id,
          title: "Integration Test Negotiation",
          scenario: {
            maxRounds: 6,
            selectedTechniques: [technique.id],
            selectedTactics: [tactic.id],
            dimensions: [
              { id: priceDimension.id, name: "Price per Unit" },
              { id: volumeDimension.id, name: "Volume per Month" },
            ],
          },
        })
        .returning();

      await db.insert(negotiationProducts).values([
        { negotiationId: negotiation.id, productId: productA.id },
        { negotiationId: negotiation.id, productId: productB.id },
      ]);

      const [queue] = await db
        .insert(simulationQueue)
        .values({
          negotiationId: negotiation.id,
          totalSimulations: 1,
        })
        .returning();

      const runId = randomUUID();
      const [run] = await db
        .insert(simulationRuns)
        .values({
          id: runId,
          negotiationId: negotiation.id,
          queueId: queue.id,
          techniqueId: technique.id,
          tacticId: tactic.id,
          status: "completed",
          dealValue: "500000.00",
          totalRounds: 6,
        })
        .returning();

      await db.insert(dimensionResults).values([
        {
          simulationRunId: runId,
          dimensionName: "Price per Unit",
          finalValue: "1.20",
          targetValue: "1.25",
          achievedTarget: false,
          priorityScore: 1,
        },
        {
          simulationRunId: run.id,
          dimensionName: "Volume per Month",
          finalValue: "1800",
          targetValue: "1700",
          achievedTarget: true,
          priorityScore: 2,
        },
      ]);

      const insertedProducts = await db
        .insert(productResults)
        .values([
          {
            simulationRunId: runId,
            productId: productA.id,
            productName: "Integration Product A",
            targetPrice: "1.30",
            minMaxPrice: "0.90",
            estimatedVolume: 1000,
            agreedPrice: "1.20",
            subtotal: "120000.00",
            targetSubtotal: "130000.00",
          },
          {
            simulationRunId: runId,
            productId: productB.id,
            productName: "Integration Product B",
            targetPrice: "2.50",
            minMaxPrice: "2.00",
            estimatedVolume: 900,
            agreedPrice: "2.40",
            subtotal: "216000.00",
            targetSubtotal: "225000.00",
          },
        ])
        .returning({ id: productResults.id });

      const linkedProducts = await db
        .select()
        .from(negotiationProducts)
        .where(eq(negotiationProducts.negotiationId, negotiation.id));
      expect(linkedProducts).toHaveLength(2);
      expect(insertedProducts).toHaveLength(2);
    });
  });
}
