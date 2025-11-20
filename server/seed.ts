import "dotenv/config";
import { db } from "./db";
import { storage } from "./storage";
import { importAllCSVData } from "./csv-import";
import { createRequestLogger } from "./services/logger";
import { influencingTechniques, negotiations, negotiationProducts } from "@shared/schema";
import { count } from "drizzle-orm";

const log = createRequestLogger("script:seed");

async function main() {
  log.info("🌱 Seeding database with normalized schema...");

  try {
    const [techniquesResult] = await db.select({ count: count() }).from(influencingTechniques);
    if (techniquesResult.count === 0) {
      log.info("📊 Importing CSV data (techniques, tactics, personalities)...");
      await importAllCSVData();
    }

    log.info("🧹 Clearing demo negotiations...");
    await db.delete(negotiationProducts);
    await db.delete(negotiations);

    log.info("🏢 Creating sample registration + market + counterpart...");
    const registration = await storage.createRegistration({
      organization: "Demo Foods GmbH",
      company: "Demo Foods",
      country: "DE",
      negotiationType: "strategic",
      negotiationFrequency: "quarterly",
      goals: { margin: "12%" },
    });

    const market = await storage.createMarket({
      registrationId: registration.id,
      name: "DACH Grocery Retail",
      currencyCode: "EUR",
      region: "EMEA",
      meta: { category: "CPG" },
    });

    const counterpart = await storage.createCounterpart({
      registrationId: registration.id,
      name: "Retailer AG",
      kind: "retailer",
      powerBalance: "55.00",
      style: "partnership",
    });

    log.info("📦 Creating sample products...");
    const productA = await storage.createProduct({
      registrationId: registration.id,
      name: "Chocolate Bar 50g",
      brand: "SweetCo",
      attrs: { segment: "Impulse" },
    });

    const productB = await storage.createProduct({
      registrationId: registration.id,
      name: "Protein Biscuit 80g",
      brand: "PowerBite",
      attrs: { segment: "Better-for-you" },
    });

    log.info("🤝 Creating demonstration negotiation...");
    const negotiation = await storage.createNegotiation({
      registrationId: registration.id,
      marketId: market.id,
      counterpartId: counterpart.id,
      title: "Q2 Listing Review",
      description: "Demo negotiation seeded for development/testing",
      scenario: {
        userRole: "seller",
        negotiationType: "multi-year",
        relationshipType: "long-standing",
        negotiationFrequency: "quarterly",
        productMarketDescription: "Seasonal confectionary assortment review",
        maxRounds: 6,
        selectedTechniques: [],
        selectedTactics: [],
        dimensions: [
          {
            id: undefined,
            name: "Price per unit",
            minValue: 0.85,
            maxValue: 1.40,
            targetValue: 1.10,
            priority: 1,
            unit: "EUR",
          },
          {
            id: undefined,
            name: "Volume per month",
            minValue: 800,
            maxValue: 1500,
            targetValue: 1100,
            priority: 2,
            unit: "cases",
          },
          {
            id: undefined,
            name: "Payment terms",
            minValue: 30,
            maxValue: 60,
            targetValue: 45,
            priority: 2,
            unit: "days",
          },
        ],
      },
      productIds: [productA.id, productB.id],
      status: "planned",
    });

    log.info({ negotiationId: negotiation.id }, "✅ Seed completed");
  } catch (error) {
    log.error({ err: error }, "Seed failed");
    process.exit(1);
  }
}

main().then(() => process.exit(0));
