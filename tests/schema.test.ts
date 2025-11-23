import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@shared/schema";
import {
  registrations,
  markets,
  counterparts,
  dimensions,
  products,
  productDimensionValues,
  negotiations,
  negotiationProducts,
  negotiationRounds,
  roundStates,
  simulations,
  simulationQueue,
  simulationRuns,
  dimensionResults,
  productResults,
  offers,
  events,
  agents,
  policies,
  influencingTechniques,
  negotiationTactics,
  agentMetrics,
  interactions,
  analyticsSessions,
  experimentRuns,
  experiments,
  benchmarks,
  concessions,
  performanceMetrics,
  personalityTypes,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { debugLog, getTableName } from "./helpers/debug";

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const runDbTests = Boolean(connectionString) && process.env.RUN_DB_TESTS === "true";

if (!runDbTests) {
  describe.skip("Enhanced schema", () => {
    it("skipped because RUN_DB_TESTS is not enabled", () => {
      expect(true).toBe(true);
    });
  });
} else {
  const sql = neon(connectionString!);
  const db = drizzle(sql, { schema });

  describe("Enhanced schema", () => {
    let registrationId: string;
    let negotiationId: string;
    let dimensionId: string;
    let productId: string;
    let roundId: string;

    beforeEach(async () => {
      await cleanup();
      await seedCoreEntities();
    });

    afterEach(async () => {
      await cleanup();
    });

    const cleanupOrder = [
      agentMetrics,
      interactions,
      events,
      offers,
      dimensionResults,
      productResults,
      simulationRuns,
      simulationQueue,
      simulations,
      roundStates,
      negotiationRounds,
      negotiationProducts,
      negotiations,
      productDimensionValues,
      products,
      dimensions,
      counterparts,
      markets,
      registrations,
      agents,
      policies,
      influencingTechniques,
      negotiationTactics,
      analyticsSessions,
      experimentRuns,
      experiments,
      benchmarks,
      concessions,
      performanceMetrics,
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
          valueType: "numeric",
          unit: "EUR",
          spec: { min: 1, max: 5 },
        })
        .returning();
      dimensionId = dimension.id;
      debugLog("schema-test:seed:dimension", { dimensionId });

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

      await db.insert(productDimensionValues).values({
        productId,
        dimensionId,
        value: { currency: "EUR", amount: 1.1 },
        source: "list_price",
        isCurrent: true,
      });
      debugLog("schema-test:seed:product-dimension", { productId, dimensionId });

      const [negotiation] = await db
        .insert(negotiations)
        .values({
          registrationId,
          marketId: market.id,
          counterpartId: counterpart.id,
          title: "Q1 Shelf Reset",
          description: "Q1 placement renegotiation",
          scenario: {
            zopa: { price: { min: 1, max: 2 } },
            companyKnown: true,
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

      const [round] = await db
        .insert(negotiationRounds)
        .values({
          negotiationId,
          roundNumber: 1,
          state: { transcript: [] },
        })
        .returning();
      roundId = round.id;
    }

    it("scopes master data to registrations and cascades on delete", async () => {
      const marketsBefore = await db.select().from(markets).where(eq(markets.registrationId, registrationId));
      expect(marketsBefore).toHaveLength(1);

      await db.delete(registrations).where(eq(registrations.id, registrationId));

      const marketsAfter = await db.select().from(markets).where(eq(markets.registrationId, registrationId));
      expect(marketsAfter).toHaveLength(0);
    });

    it("enforces unique dimension code per registration", async () => {
      await expect(
        db.insert(dimensions).values({
          registrationId,
          code: "price",
          name: "Duplicate price",
          valueType: "numeric",
          unit: "EUR",
          spec: {},
        }),
      ).rejects.toThrow();
    });

    it("tracks historical product dimension values", async () => {
      await db.insert(productDimensionValues).values({
        productId,
        dimensionId,
        value: { currency: "EUR", amount: 0.95 },
        source: "promo_price",
        isCurrent: false,
        measuredAt: new Date(Date.now() - 86_400_000),
      });

      const history = await db
        .select()
        .from(productDimensionValues)
        .where(eq(productDimensionValues.productId, productId));

      expect(history).toHaveLength(2);
      const currentEntry = history.find((entry) => entry.isCurrent);
      expect(currentEntry?.value).toMatchObject({ amount: 1.1 });
    });

    it("persists BDI state via round_states", async () => {
      const [state] = await db
        .insert(roundStates)
        .values({
          roundId,
          beliefs: { powerBalance: "even" },
          intentions: "Probe payment terms",
          internalAnalysis: "Opponent cautious",
          batnaAssessment: "0.65",
          walkAwayThreshold: "0.30",
        })
        .returning();

      expect(state.roundId).toBe(roundId);
      await expect(
        db.insert(roundStates).values({
          roundId,
          beliefs: {},
        }),
      ).rejects.toThrow();
    });

    it("stores simulation outputs for dimension and product results", async () => {
      const [simulation] = await db
        .insert(simulations)
        .values({
          registrationId,
          negotiationId,
          name: "Baseline Simulation",
          numRounds: 6,
          settings: { seed: 42 },
        })
        .returning();

      const [queue] = await db
        .insert(simulationQueue)
        .values({
          negotiationId,
          simulationId: simulation.id,
          totalSimulations: 1,
        })
        .returning();

      const [run] = await db
        .insert(simulationRuns)
        .values({
          negotiationId,
          simulationId: simulation.id,
          queueId: queue.id,
          status: "completed",
          runNumber: 1,
          totalRounds: 4,
          dealValue: "125000.00",
          otherDimensions: {},
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
      debugLog("schema-test:product-results:fetched", { runId: run.id, count: results.length });

      expect(results).toHaveLength(1);
      expect(results[0].agreedPrice).toBe("1.20");
    });

    it("records offers and events per round", async () => {
      const [policy] = await db.insert(policies).values({ name: "Default", kind: "llm" }).returning();
      const [agent] = await db
        .insert(agents)
        .values({
          registrationId,
          role: "buyer",
          agentKind: "llm",
          policyId: policy.id,
          modelName: "gpt-4o-mini",
          tools: [],
        })
        .returning();

      const [offer] = await db
        .insert(offers)
        .values({
          roundId,
          side: "buyer",
          agentId: agent.id,
          price: "1.15",
          quantity: "100000",
          currencyCode: "EUR",
          unit: "unit",
          terms: { payment: "Net 45" },
        })
        .returning();

      await db.insert(events).values({
        roundId,
        eventKind: "message",
        role: "assistant",
        agentId: agent.id,
        name: "counter_offer",
        parameters: { offerId: offer.id },
        observations: { sentiment: "neutral" },
      });

      await db.insert(agentMetrics).values({
        agentId: agent.id,
        metricName: "latency_ms",
        metricValue: "1200",
        details: { run: "baseline" },
      });

      const [offerRow] = await db.select().from(offers).where(eq(offers.id, offer.id));
      debugLog("schema-test:offers:fetched", { offerId: offer.id, roundId });
      expect(offerRow?.terms).toMatchObject({ payment: "Net 45" });
    });
  });
}
