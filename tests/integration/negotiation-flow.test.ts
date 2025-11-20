import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
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
  productResults,
  dimensionResults,
  offers,
  events,
  agents,
  policies,
  influencingTechniques,
  negotiationTactics,
  agentMetrics,
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

  describe("Negotiation flow integration", () => {
    const cleanupTables = [
      agentMetrics,
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

    beforeAll(cleanupIntegrationDb);
    afterAll(cleanupIntegrationDb);

    it("creates a full negotiation with simulation outputs", async () => {
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
      debugLog("integration-test:create:market", { marketId: market.id });

      const [counterpart] = await db
        .insert(counterparts)
        .values({
          registrationId: registration.id,
          name: "Integration Retailer",
          kind: "retailer",
        })
        .returning();
      debugLog("integration-test:create:counterpart", { counterpartId: counterpart.id });

      const [priceDimension] = await db
        .insert(dimensions)
        .values({
          registrationId: registration.id,
          code: "price_per_unit",
          name: "Price per Unit",
          valueType: "numeric",
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
          valueType: "integer",
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
      debugLog("integration-test:create:product", { productId: productA.id, label: "A" });

      const [productB] = await db
        .insert(products)
        .values({
          registrationId: registration.id,
          name: "Integration Product B",
        })
        .returning();
      debugLog("integration-test:create:product", { productId: productB.id, label: "B" });

      await db.insert(productDimensionValues).values([
        {
          productId: productA.id,
          dimensionId: priceDimension.id,
          value: { amount: 1.4 },
        },
        {
          productId: productB.id,
          dimensionId: volumeDimension.id,
          value: { units: 2000 },
        },
      ]);
      debugLog("integration-test:create:product-dimensions", { pairs: 2 });

      const [negotiation] = await db
        .insert(negotiations)
        .values({
          registrationId: registration.id,
          marketId: market.id,
          counterpartId: counterpart.id,
          title: "Integration Test Negotiation",
        })
        .returning();
      debugLog("integration-test:create:negotiation", { negotiationId: negotiation.id });

      await db.insert(negotiationProducts).values([
        { negotiationId: negotiation.id, productId: productA.id },
        { negotiationId: negotiation.id, productId: productB.id },
      ]);
      debugLog("integration-test:create:negotiation-products", { negotiationId: negotiation.id, productCount: 2 });

      const [round] = await db
        .insert(negotiationRounds)
        .values({
          negotiationId: negotiation.id,
          roundNumber: 1,
          state: { transcript: [] },
        })
        .returning();
      debugLog("integration-test:create:round", { roundId: round.id });

      await db.insert(roundStates).values({
        roundId: round.id,
        beliefs: { leverage: "balanced" },
        intentions: "Anchor high",
      });
      debugLog("integration-test:create:round-state", { roundId: round.id });

      const [simulation] = await db
        .insert(simulations)
        .values({
          registrationId: registration.id,
          negotiationId: negotiation.id,
          name: "Integration Simulation",
          numRounds: 6,
        })
        .returning();
      debugLog("integration-test:create:simulation", { simulationId: simulation.id });

      const [queue] = await db
        .insert(simulationQueue)
        .values({
          negotiationId: negotiation.id,
          simulationId: simulation.id,
          totalSimulations: 1,
        })
        .returning();
      debugLog("integration-test:create:queue", { queueId: queue.id });

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
      debugLog("integration-test:create:technique", { techniqueId: technique.id });

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
      debugLog("integration-test:create:tactic", { tacticId: tactic.id });

      const runId = randomUUID();
      const [run] = await db
        .insert(simulationRuns)
        .values({
          id: runId,
          negotiationId: negotiation.id,
          simulationId: simulation.id,
          queueId: queue.id,
          techniqueId: technique.id,
          tacticId: tactic.id,
          status: "completed",
          dealValue: "500000.00",
          totalRounds: 6,
        })
        .returning();
      debugLog("integration-test:create:simulation-run", { runId });

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
      debugLog("integration-test:create:dimension-results", { runId, count: 2 });

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
      debugLog("integration-test:create:product-results", { runId, insertedCount: insertedProducts.length });

      expect(insertedProducts).toHaveLength(2);

      const [policy] = await db.insert(policies).values({ name: "Integration Policy" }).returning();
      debugLog("integration-test:create:policy", { policyId: policy.id });
      const [agent] = await db
        .insert(agents)
        .values({
          registrationId: registration.id,
          role: "buyer",
          agentKind: "llm",
          policyId: policy.id,
          tools: [],
        })
        .returning();
      debugLog("integration-test:create:agent", { agentId: agent.id });

      const [offer] = await db
        .insert(offers)
        .values({
          roundId: round.id,
          side: "buyer",
          agentId: agent.id,
          price: "1.18",
          quantity: "1000",
          currencyCode: "EUR",
          terms: { payment: "Net 45" },
        })
        .returning();
      debugLog("integration-test:create:offer", { offerId: offer.id });

      await db.insert(events).values({
        roundId: round.id,
        eventKind: "message",
        agentId: agent.id,
        name: "offer_submitted",
        parameters: { offerId: offer.id },
        observations: { tone: "neutral" },
      });
      debugLog("integration-test:create:event", { roundId: round.id });

      await db.insert(agentMetrics).values({
        agentId: agent.id,
        metricName: "latency_ms",
        metricValue: "800",
        details: { runId },
      });
      debugLog("integration-test:create:agent-metric", { agentId: agent.id });

      const linkedProducts = await db
        .select()
        .from(negotiationProducts)
        .where(eq(negotiationProducts.negotiationId, negotiation.id));
      debugLog("integration-test:query:negotiation-products", { negotiationId: negotiation.id, count: linkedProducts.length });

      expect(linkedProducts).toHaveLength(2);

    });
  });
}
