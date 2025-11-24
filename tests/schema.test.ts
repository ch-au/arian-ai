import { describe, it, expect, beforeEach, afterEach } from "vitest";
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
  dimensionResults,
  productResults,
  influencingTechniques,
  negotiationTactics,
  agents,
  personalityTypes,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { debugLog, getTableName } from "./helpers/debug";

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const runDbTests = Boolean(connectionString) && process.env.RUN_DB_TESTS === "true";

if (!runDbTests) {
  describe.skip("Schema validation", () => {
    it("skipped because RUN_DB_TESTS is not enabled", () => {
      expect(true).toBe(true);
    });
  });
} else {
  const sql = neon(connectionString!);
  const db = drizzle(sql, { schema });

  describe("Schema validation", () => {
    let registrationId: string;
    let negotiationId: string;
    let productId: string;
    let userId: number;
    let techniqueId: string;
    let tacticId: string;

    const cleanupOrder = [
      dimensionResults,
      productResults,
      simulationRuns,
      simulationQueue,
      negotiationProducts,
      negotiations,
      agents,
      products,
      dimensions,
      counterparts,
      markets,
      registrations,
      users,
      influencingTechniques,
      negotiationTactics,
      personalityTypes,
    ];

    async function cleanup() {
      debugLog("schema-test:cleanup:start");
      for (const table of cleanupOrder) {
        // eslint-disable-next-line no-await-in-loop
        await db.delete(table);
        debugLog("schema-test:cleanup:table", { table: getTableName(table) });
      }
      debugLog("schema-test:cleanup:complete");
    }

    async function seedCoreEntities() {
      const [user] = await db
        .insert(users)
        .values({
          username: "schema-user",
          password: "secret",
        })
        .returning();
      userId = user.id;
      debugLog("schema-test:seed:user", { userId });

      const [registration] = await db
        .insert(registrations)
        .values({
          organization: "Schema Test Org",
          company: "TestCo",
          country: "DE",
          negotiationType: "strategic",
          negotiationFrequency: "monthly",
          goals: { margin: "10%" },
        })
        .returning();
      registrationId = registration.id;
      debugLog("schema-test:seed:registration", { registrationId });

      const [market] = await db
        .insert(markets)
        .values({
          registrationId,
          name: "DACH groceries",
          region: "EMEA",
          countryCode: "DE",
          currencyCode: "EUR",
          meta: { size: "large" },
        })
        .returning();
      debugLog("schema-test:seed:market", { marketId: market.id });

      const [counterpart] = await db
        .insert(counterparts)
        .values({
          registrationId,
          name: "Retailer AG",
          kind: "retailer",
          powerBalance: "55.00",
          dominance: "55.00",
          affiliation: "55.00",
          style: "cooperative",
          constraintsMeta: { payment: "Net 30" },
        })
        .returning();
      debugLog("schema-test:seed:counterpart", { counterpartId: counterpart.id });

      const [dimension] = await db
        .insert(dimensions)
        .values({
          registrationId,
          code: "price",
          name: "Price per unit",
          unit: "EUR",
          spec: { min: 1, max: 5 },
        })
        .returning();
      debugLog("schema-test:seed:dimension", { dimensionId: dimension.id });

      const [product] = await db
        .insert(products)
        .values({
          registrationId,
          name: "Chocolate Bar 50g",
          gtin: "1234567890123",
          brand: "SweetCo",
          categoryPath: "Snacks/Chocolate",
          attrs: { shelf: "ambient" },
        })
        .returning();
      productId = product.id;
      debugLog("schema-test:seed:product", { productId });

      const [technique] = await db
        .insert(influencingTechniques)
        .values({
          name: "Anchoring",
          beschreibung: "Setze den ersten Anker",
          anwendung: "Im ersten Angebot",
          wichtigeAspekte: {},
          keyPhrases: {},
        })
        .returning();
      techniqueId = technique.id;

      const [tactic] = await db
        .insert(negotiationTactics)
        .values({
          name: "Direct ask",
          beschreibung: "Direkt nachfragen",
          anwendung: "Im Kickoff",
          wichtigeAspekte: {},
          keyPhrases: {},
        })
        .returning();
      tacticId = tactic.id;

      const [negotiation] = await db
        .insert(negotiations)
        .values({
          registrationId,
          userId,
          marketId: market.id,
          counterpartId: counterpart.id,
          title: "Q1 Shelf Reset",
          description: "Q1 placement renegotiation",
          scenario: {
            zopa: { price: { min: 1, max: 2 } },
            companyKnown: true,
            selectedTechniques: [techniqueId],
            selectedTactics: [tacticId],
          },
          status: "planned",
        })
        .returning();
      negotiationId = negotiation.id;
      debugLog("schema-test:seed:negotiation", { negotiationId });

      await db.insert(negotiationProducts).values({
        negotiationId,
        productId,
      });
      debugLog("schema-test:seed:negotiation-product");
    }

    beforeEach(async () => {
      await cleanup();
      await seedCoreEntities();
    });

    afterEach(async () => {
      await cleanup();
    });

    it("cascades registration deletes to dependents", async () => {
      const marketsBefore = await db.select().from(markets).where(eq(markets.registrationId, registrationId));
      const negotiationsBefore = await db.select().from(negotiations).where(eq(negotiations.registrationId, registrationId));
      expect(marketsBefore).toHaveLength(1);
      expect(negotiationsBefore).toHaveLength(1);

      await db.delete(registrations).where(eq(registrations.id, registrationId));

      const marketsAfter = await db.select().from(markets).where(eq(markets.registrationId, registrationId));
      const negotiationsAfter = await db.select().from(negotiations).where(eq(negotiations.registrationId, registrationId));
      expect(marketsAfter).toHaveLength(0);
      expect(negotiationsAfter).toHaveLength(0);
    });

    it("enforces unique codes and gtins per registration", async () => {
      await expect(
        db.insert(dimensions).values({
          registrationId,
          code: "price",
          name: "Duplicate price",
          unit: "EUR",
          spec: {},
        }),
      ).rejects.toThrow();

      await expect(
        db.insert(products).values({
          registrationId,
          name: "Duplicate GTIN",
          gtin: "1234567890123",
        }),
      ).rejects.toThrow();
    });

    it("stores simulation queue, runs and results linked to a negotiation", async () => {
      const [queue] = await db
        .insert(simulationQueue)
        .values({
          negotiationId,
          totalSimulations: 2,
        })
        .returning();

      const [run] = await db
        .insert(simulationRuns)
        .values({
          negotiationId,
          queueId: queue.id,
          techniqueId,
          tacticId,
          status: "completed",
          runNumber: 1,
          totalRounds: 4,
          dealValue: "125000.00",
          otherDimensions: { payment_terms: "Net 30" },
        })
        .returning();

      await db.insert(dimensionResults).values({
        simulationRunId: run.id,
        dimensionName: "Price per unit",
        finalValue: "1.20",
        targetValue: "1.25",
        achievedTarget: false,
        priorityScore: 1,
      });

      await db.insert(productResults).values({
        simulationRunId: run.id,
        productId,
        productName: "Chocolate Bar 50g",
        targetPrice: "1.30",
        minMaxPrice: "0.90",
        estimatedVolume: 120000,
        agreedPrice: "1.20",
        subtotal: "144000.00",
        targetSubtotal: "156000.00",
      });
      debugLog("schema-test:product-results:inserted", { runId: run.id, productId });

      const results = await db
        .select()
        .from(productResults)
        .where(eq(productResults.simulationRunId, run.id));
      expect(results).toHaveLength(1);
      expect(results[0].agreedPrice).toBe("1.20");
    });
  });
}
