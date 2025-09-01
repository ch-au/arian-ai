import "dotenv/config";
import { db } from "./db";
import { agents, negotiationContexts, influencingTechniques, negotiationTactics } from "@shared/schema";

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  await db.delete(influencingTechniques);
  await db.delete(negotiationTactics);
  await db.delete(agents);
  await db.delete(negotiationContexts);

  // Seed agents
  const createdAgents = await db.insert(agents).values([
    {
      name: "Agent Smith",
      description: "A balanced and fair negotiator.",
      personalityProfile: { openness: 0.5, conscientiousness: 0.7, extraversion: 0.6, agreeableness: 0.8, neuroticism: 0.3 },
      powerLevel: "7.5",
      preferredTactics: [],
    },
    {
      name: "Agent Cooper",
      description: "A highly analytical and data-driven negotiator.",
      personalityProfile: { openness: 0.8, conscientiousness: 0.9, extraversion: 0.4, agreeableness: 0.6, neuroticism: 0.2 },
      powerLevel: "8.5",
      preferredTactics: [],
    },
  ]).returning();

  // Seed negotiation contexts
  const createdContexts = await db.insert(negotiationContexts).values([
    {
      name: "Standard B2B Contract",
      description: "A standard B2B contract negotiation for a SaaS product.",
      productInfo: { productName: "SaaS Platform", features: ["Feature A", "Feature B"] },
      baselineValues: { price: 10000, duration: 12 },
    },
  ]).returning();

  // Seed influencing techniques
  const createdTechniques = await db.insert(influencingTechniques).values([
    { name: "Scarcity", beschreibung: "...", anwendung: "...", wichtigeAspekte: [], keyPhrases: [] },
    { name: "Social Proof", beschreibung: "...", anwendung: "...", wichtigeAspekte: [], keyPhrases: [] },
    { name: "Reciprocity", beschreibung: "...", anwendung: "...", wichtigeAspekte: [], keyPhrases: [] },
  ]).returning();

  // Seed negotiation tactics
  const createdTactics = await db.insert(negotiationTactics).values([
    { name: "Competitive Pricing", beschreibung: "...", anwendung: "...", wichtigeAspekte: [], keyPhrases: [] },
    { name: "Value Creation", beschreibung: "...", anwendung: "...", wichtigeAspekte: [], keyPhrases: [] },
  ]).returning();

  console.log("✅ Database seeded successfully!");
  console.log("🔑 IDs for testing:");
  console.log("   Agent Smith:", createdAgents[0].id);
  console.log("   Agent Cooper:", createdAgents[1].id);
  console.log("   Standard B2B Contract:", createdContexts[0].id);
  console.log("   Scarcity Technique:", createdTechniques[0].id);
  console.log("   Competitive Pricing Tactic:", createdTactics[0].id);
}

main().catch((error) => {
  console.error("❌ Error seeding database:", error);
  process.exit(1);
});
