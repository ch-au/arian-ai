import { db } from "../server/db";
import { simulationRuns, influencingTechniques, negotiationTactics } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const negotiationId = "daa3108b-87f4-487c-bfa1-99879ac7017c";

async function main() {
  // Get all techniques and tactics
  const techniques = await db.select().from(influencingTechniques);
  const tactics = await db.select().from(negotiationTactics);

  const techniqueMap = new Map(techniques.map(t => [t.id, t.name]));
  const tacticMap = new Map(tactics.map(t => [t.id, t.name]));

  // Get all completed runs
  const runs = await db
    .select()
    .from(simulationRuns)
    .where(eq(simulationRuns.negotiationId, negotiationId));

  const completedRuns = runs.filter(r => r.status === 'completed' && r.dealValue);

  // Group by technique × tactic
  const groups = new Map<string, typeof completedRuns>();

  for (const run of completedRuns) {
    const techniqueName = techniqueMap.get(run.techniqueId!) ?? 'Unknown';
    const tacticName = tacticMap.get(run.tacticId!) ?? 'Unknown';
    const key = `${techniqueName} × ${tacticName}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(run);
  }

  // Calculate averages for each group
  console.log('\n=== Average Deal Values by Technique × Tactic ===\n');

  for (const [key, groupRuns] of groups.entries()) {
    const dealValues = groupRuns.map(r => Number(r.dealValue));
    const avg = dealValues.reduce((sum, v) => sum + v, 0) / dealValues.length;

    console.log(`${key}:`);
    console.log(`  Runs: ${groupRuns.length}`);
    console.log(`  Individual values: ${dealValues.map(v => '€' + v.toFixed(0)).join(', ')}`);
    console.log(`  Average: €${avg.toFixed(2)}`);
    console.log();
  }

  process.exit(0);
}

main().catch(console.error);
