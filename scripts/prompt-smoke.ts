import { spawn } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type SmokeResult = {
  outcome: string;
  totalRounds: number;
  langfuseTraceId?: string;
};

const rootDir = path.resolve(__dirname, "..");

const sampleNegotiation = {
  negotiation: {
    id: "smoke-negotiation",
    title: "Prompt Validation Negotiation",
    registrationId: "reg-smoke",
    marketId: "market-smoke",
    counterpartId: "counterpart-smoke",
    status: "planned",
    scenario: {
      userRole: "seller",
      negotiationType: "annual-review",
      relationshipType: "strategic",
      negotiationFrequency: "quarterly",
      productMarketDescription: "Confectionery assortment renewal for Q4 promotions",
      companyKnown: true,
      counterpartKnown: true,
      counterpartDistance: { price: "mittel" },
      marketIntelligence: "Lebensmittelhandel erwartet +4% Wachstum im Q4.",
      additionalComments: "Prompt smoke test payload",
      maxRounds: 6,
    },
  },
  registration: {
    id: "reg-smoke",
    organization: "Demo Foods GmbH",
    company: "Demo Foods",
    negotiationType: "strategic",
    negotiationFrequency: "quarterly",
    goals: { margin: "12%" },
  },
  market: {
    id: "market-smoke",
    name: "DACH Grocery",
    countryCode: "DE",
    meta: {
      analysis: "Hoher Wettbewerbsdruck, Fokus auf Promotions.",
      intelligence: "Discounter erhöhen Aktionsanteil.",
    },
  },
  counterpart: {
    id: "counterpart-smoke",
    name: "Retailer AG",
    kind: "retailer",
    style: "data-driven",
    powerBalance: "55.00",
    notes: "Langjährige Partnerschaft",
  },
  context: {
    userRole: "seller",
    negotiationType: "annual-review",
    relationshipType: "strategic",
    negotiationFrequency: "quarterly",
    productMarketDescription: "Confectionery assortment renewal for Q4 promotions",
    companyKnown: true,
    counterpartKnown: true,
    marketIntelligence: "Lebensmittelhandel erwartet +4% Wachstum im Q4.",
    additionalComments: "Prompt smoke test payload",
  },
  dimensions: [
    {
      name: "Preis pro Einheit",
      minValue: 0.95,
      maxValue: 1.3,
      targetValue: 1.1,
      priority: 1,
      unit: "EUR",
    },
    {
      name: "Volumen pro Monat",
      minValue: 80000,
      maxValue: 140000,
      targetValue: 110000,
      priority: 2,
      unit: "Einheiten",
    },
    {
      name: "Zahlungsziele",
      minValue: 30,
      maxValue: 60,
      targetValue: 45,
      priority: 3,
      unit: "Tage",
    },
  ],
  products: [
    {
      id: "prod-a",
      name: "Chocolate Bar 50g",
      attrs: {
        targetPrice: 1.15,
        maxPrice: 1.3,
        minPrice: 1.0,
        estimatedVolume: 120000,
      },
    },
    {
      id: "prod-b",
      name: "Protein Biscuit 80g",
      attrs: {
        targetPrice: 1.95,
        minPrice: 1.6,
        estimatedVolume: 80000,
      },
    },
  ],
  technique: {
    id: "technique-smoke",
    name: "Scarcity Anchoring",
    beschreibung: "Nutze künstliche Knappheit, um Druck aufzubauen.",
    anwendung: "Setze hohe Startanker und verknappe Slots.",
    wichtigeAspekte: { focus: "availability" },
    keyPhrases: { de: ["Wir haben nur begrenzte Kapazitäten im Aktionskalender."] },
  },
  tactic: {
    id: "tactic-smoke",
    name: "Tiered Concessions",
    beschreibung: "Kopple jedes Zugeständnis an Gegenleistung.",
    anwendung: "Gib nur nach, wenn Gegenwert entsteht.",
    wichtigeAspekte: { cadence: "slow" },
    keyPhrases: { de: ["Wenn ihr zusätzliche Regalfläche öffnet, können wir beim SKU-Mix entgegenkommen."] },
  },
};

const pythonExec = (() => {
  const venv = path.join(rootDir, ".venv", "bin", "python");
  if (existsSync(venv)) return venv;
  if (existsSync("/usr/bin/python3")) return "python3";
  return "python";
})();

async function runScenario(simulationRunId: string, maxRounds: number): Promise<SmokeResult> {
  return new Promise((resolve, reject) => {
    const args = [
      path.join("scripts", "run_production_negotiation.py"),
      "--negotiation-id",
      `${simulationRunId}-neg`,
      "--simulation-run-id",
      simulationRunId,
      "--max-rounds",
      String(maxRounds),
      "--self-agent-prompt",
      "agents/self_agent",
      "--opponent-agent-prompt",
      "agents/opponent_agent",
      "--negotiation-data",
      JSON.stringify(sampleNegotiation),
    ];

    const child = spawn(pythonExec, args, {
      cwd: rootDir,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(`[prompt-smoke] ${text}`);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(`[prompt-smoke:err] ${text}`);
    });

    child.on("error", (error) => reject(error));

    child.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`Prompt smoke run failed (code ${code}): ${stderr}`));
      }
      const parsed = extractJson(stdout);
      if (!parsed) {
        return reject(new Error("Could not parse final JSON result from prompt run"));
      }
      resolve(parsed);
    });
  });
}

function extractJson(output: string): SmokeResult | null {
  const lines = output
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .reverse();

  for (const line of lines) {
    if (line.startsWith("{") && line.endsWith("}")) {
      try {
        const parsed = JSON.parse(line);
        return {
          outcome: parsed.outcome ?? "UNKNOWN",
          totalRounds: parsed.totalRounds ?? 0,
          langfuseTraceId: parsed.langfuseTraceId,
        };
      } catch {
        continue;
      }
    }
  }
  return null;
}

(async () => {
  console.log("🚀 Running Langfuse prompt smoke tests (real LLM)...");

  const scenarios = [
    { id: "sim-smoke-001", rounds: 1 },
    { id: "sim-smoke-002", rounds: 4 },
  ];

  for (const scenario of scenarios) {
    console.log(`\n▶️  Scenario ${scenario.id} (${scenario.rounds} rounds)`);
    const result = await runScenario(scenario.id, scenario.rounds);
    console.log(
      `✅ outcome=${result.outcome}, rounds=${result.totalRounds}, langfuseTraceId=${result.langfuseTraceId ?? "n/a"}`
    );
  }

  console.log("\n✨ Prompt smoke tests completed successfully.");
})().catch((error) => {
  console.error("❌ Prompt smoke tests failed:", error);
  process.exit(1);
});
