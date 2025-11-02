import "dotenv/config";
import { db } from "./db";
import { agents, negotiationContexts, negotiationDimensions, negotiations, influencingTechniques } from "@shared/schema";
import { importAllCSVData } from "./csv-import";
import { createRequestLogger } from "./services/logger";

const log = createRequestLogger("script:seed");

async function main() {
  log.info("🌱 Seeding database with enhanced schema...");

  try {
    // Step 1: Import CSV data (techniques, tactics, personality types) - only if not already imported
    const techniquesCount = await db.$count(influencingTechniques);
    if (techniquesCount === 0) {
      log.info("📊 Importing CSV data...");
      await importAllCSVData();
    } else {
      log.info("📊 CSV data already imported, skipping...");
    }

    // Step 2: Clear existing test data (preserve CSV imports)
    log.info("🧹 Clearing existing test data...");
    await db.delete(negotiationDimensions);
    await db.delete(agents);
    await db.delete(negotiationContexts);

    // Step 3: Seed test agents with enhanced data
    log.info("👥 Creating test agents...");
    const createdAgents = await db.insert(agents).values([
      {
        name: "Analytical Alex",
        description: "A highly analytical negotiator focused on data-driven decisions with high conscientiousness.",
        personalityProfile: { 
          openness: 0.7, 
          conscientiousness: 0.9, 
          extraversion: 0.4, 
          agreeableness: 0.6, 
          neuroticism: 0.2 
        },
        powerLevel: "8.5",
        preferredTactics: [], // Will be populated with actual tactic IDs later
      },
      {
        name: "Collaborative Casey",
        description: "A relationship-focused negotiator with high agreeableness who seeks win-win solutions.",
        personalityProfile: { 
          openness: 0.6, 
          conscientiousness: 0.7, 
          extraversion: 0.8, 
          agreeableness: 0.9, 
          neuroticism: 0.3 
        },
        powerLevel: "7.0",
        preferredTactics: [],
      },
      {
        name: "Assertive Aaron",
        description: "A dominant negotiator with high extraversion who prefers direct approaches.",
        personalityProfile: { 
          openness: 0.5, 
          conscientiousness: 0.6, 
          extraversion: 0.9, 
          agreeableness: 0.4, 
          neuroticism: 0.3 
        },
        powerLevel: "8.0",
        preferredTactics: [],
      },
      {
        name: "Creative Chris", 
        description: "An innovative negotiator with high openness who brings creative solutions to complex deals.",
        personalityProfile: { 
          openness: 0.9, 
          conscientiousness: 0.5, 
          extraversion: 0.7, 
          agreeableness: 0.7, 
          neuroticism: 0.4 
        },
        powerLevel: "7.5",
        preferredTactics: [],
      }
    ]).returning();

    // Step 4: Seed negotiation contexts with realistic scenarios
    log.info("🏢 Creating negotiation contexts...");
    const createdContexts = await db.insert(negotiationContexts).values([
      {
        name: "Enterprise Software License",
        description: "Negotiating a multi-year enterprise software license agreement for a Fortune 500 company.",
        productInfo: { 
          productName: "Enterprise Analytics Platform", 
          features: ["Real-time dashboards", "Advanced reporting", "API access", "24/7 support", "Custom integrations"],
          industry: "Technology",
          complexity: "High"
        },
        marketConditions: {
          competitorCount: 3,
          marketMaturity: "Growing",
          urgency: "Medium",
          budgetConstraints: "Moderate"
        },
        baselineValues: { 
          annualValue: 250000, 
          contractDuration: 36, 
          implementationTime: 6,
          supportLevel: "Premium"
        },
      },
      {
        name: "Manufacturing Equipment Purchase",
        description: "Bulk purchase negotiation for manufacturing equipment including delivery and installation.",
        productInfo: { 
          productName: "Industrial Assembly Line Equipment", 
          features: ["Automated assembly", "Quality control sensors", "Remote monitoring", "Maintenance packages"],
          industry: "Manufacturing",
          complexity: "High"
        },
        marketConditions: {
          competitorCount: 2,
          marketMaturity: "Mature",
          urgency: "High",
          budgetConstraints: "Strict"
        },
        baselineValues: { 
          totalValue: 1200000, 
          deliveryWeeks: 16, 
          warrantyMonths: 24,
          paymentTerms: 60
        },
      },
      {
        name: "Consulting Services Agreement",
        description: "Professional consulting services for digital transformation project.",
        productInfo: { 
          productName: "Digital Transformation Consulting", 
          features: ["Strategy development", "Implementation support", "Change management", "Training"],
          industry: "Consulting",
          complexity: "Medium"
        },
        marketConditions: {
          competitorCount: 5,
          marketMaturity: "Competitive",
          urgency: "Low",
          budgetConstraints: "Flexible"
        },
        baselineValues: { 
          monthlyRate: 75000, 
          projectDuration: 12, 
          resourceCount: 4,
          deliverableCount: 8
        },
      }
    ]).returning();

    // Step 5: Create sample negotiation with dimensions (demo purposes)
    log.info("📐 Creating sample negotiation with dimensions...");
    const [sampleNegotiation] = await db.insert(negotiations).values({
      title: "Sample Enterprise Software License",
      negotiationType: "multi-year",
      relationshipType: "first", 
      contextId: createdContexts[0].id,
      buyerAgentId: createdAgents[0].id,
      sellerAgentId: createdAgents[1].id,
      userRole: "buyer",
      productMarketDescription: "Sample negotiation for testing dimensions",
      additionalComments: "This is a sample negotiation created during seeding"
    }).returning();

    await db.insert(negotiationDimensions).values([
      {
        negotiationId: sampleNegotiation.id, // Use the actual negotiation ID
        name: "annual_price",
        minValue: "200000",
        maxValue: "300000", 
        targetValue: "250000",
        priority: 1, // Must have
        unit: "USD"
      },
      {
        negotiationId: sampleNegotiation.id,
        name: "contract_duration",
        minValue: "24",
        maxValue: "48",
        targetValue: "36", 
        priority: 1, // Must have
        unit: "months"
      },
      {
        negotiationId: sampleNegotiation.id,
        name: "implementation_time",
        minValue: "3",
        maxValue: "9",
        targetValue: "6",
        priority: 2, // Important
        unit: "months"
      },
      {
        negotiationId: sampleNegotiation.id,
        name: "training_hours",
        minValue: "40",
        maxValue: "120",
        targetValue: "80",
        priority: 3, // Flexible
        unit: "hours"
      }
    ]);

    log.info("✅ Database seeded successfully with enhanced schema!");
    log.info("🔑 Created test data:");
    log.info("   📊 CSV Data: 11 techniques, 45 tactics, 5 personality types");
    log.info(`   👥 Agents: ${createdAgents.length}`);
    log.info(`   🏢 Contexts: ${createdContexts.length}`);
    log.info("   📐 Sample dimensions: 4 for Enterprise Software License");
    log.info("");
    log.info("🔗 Key IDs for testing:");
    createdAgents.forEach((agent) => {
      log.info(`   ${agent.name}: ${agent.id}`);
    });
    createdContexts.forEach((context) => {
      log.info(`   ${context.name}: ${context.id}`);
    });

  } catch (error) {
    log.error({ err: error }, "❌ Error during database seeding");
    throw error;
  }
}

main().catch((error) => {
  log.error({ err: error }, "❌ Error seeding database");
  process.exit(1);
});
