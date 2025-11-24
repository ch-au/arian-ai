import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { simulationRuns } from "../shared/schema.ts";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);
  const runs = await db
    .select()
    .from(simulationRuns)
    .orderBy(simulationRuns.startedAt ? simulationRuns.startedAt : simulationRuns.id)
    .limit(5);
  console.log(runs);
}

main().catch(console.error);
