import "dotenv/config";

type HttpMethod = "GET" | "POST";

const BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";
const POLL_INTERVAL_MS = Number(process.env.SIM_QUEUE_POLL_MS ?? 5000);

function formatConnectionHint(error: unknown, method: HttpMethod, path: string): string {
  const url = `${BASE_URL}${path}`;
  const errorMessage = error instanceof Error ? error.message : String(error);
  if (errorMessage.includes("ECONNREFUSED")) {
    return `Failed to reach ${url}. Is the backend running and accessible from this machine? (expected e.g. npm run dev:server)`;
  }
  return `${method} ${url} failed: ${errorMessage}`;
}

async function api<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${method} ${path} failed (${res.status}): ${text}`);
    }
    return (await res.json()) as T;
  } catch (error) {
    throw new Error(formatConnectionHint(error, method, path));
  }
}

type Technique = { id: string; name: string };
type Tactic = { id: string; name: string };

async function pickTechniqueAndTactic(): Promise<{ technique: Technique; tactic: Tactic }> {
  const [techniques, tactics] = await Promise.all([
    api<Technique[]>("GET", "/api/influencing-techniques"),
    api<Tactic[]>("GET", "/api/negotiation-tactics"),
  ]);

  if (!techniques.length || !tactics.length) {
    throw new Error("Seed data missing. Please ensure techniques and tactics exist via /api/influencing-techniques and /api/negotiation-tactics.");
  }

  return { technique: techniques[0], tactic: tactics[0] };
}

async function createNegotiation(): Promise<{ negotiationId: string }> {
  const { technique, tactic } = await pickTechniqueAndTactic();

  const registration = await api<{ id: string }>("POST", "/api/registrations", {
    organization: "CLI GmbH",
    company: "CLI Foods",
    country: "Deutschland",
    negotiationType: "Jahresgespräch",
    negotiationFrequency: "jährlich",
    goals: { margin: 0.12 },
  });

  const market = await api<{ id: string }>(
    "POST",
    `/api/registrations/${registration.id}/markets`,
    {
      name: "DACH Grocery",
      region: "DACH",
      countryCode: "DE",
      currencyCode: "EUR",
      meta: {
        intelligence: "Hoher Preisdruck, Fokus auf Promotions.",
      },
    },
  );

  const counterpart = await api<{ id: string }>(
    "POST",
    `/api/registrations/${registration.id}/counterparts`,
    {
      name: "Retailer AG",
      kind: "retailer",
      powerBalance: "50",
      style: "datengetrieben",
      notes: "Langjährige Partnerschaft",
    },
  );

  const productPayloads = [
    {
      name: "Schoko Riegel 50g",
      brand: "CLI Snacks",
      categoryPath: "Süßwaren/Riegel",
      attrs: {
        targetPrice: 1.15,
        minPrice: 0.95,
        maxPrice: 1.35,
        estimatedVolume: 120000,
      },
    },
    {
      name: "Protein Biscuit 80g",
      brand: "CLI Snacks",
      categoryPath: "Functional/Biscuit",
      attrs: {
        targetPrice: 2.2,
        minPrice: 1.9,
        maxPrice: 2.6,
        estimatedVolume: 80000,
      },
    },
  ];

  const products: Array<{ id: string }> = [];
  for (const payload of productPayloads) {
    const product = await api<{ id: string }>(
      "POST",
      `/api/registrations/${registration.id}/products`,
      payload,
    );
    products.push(product);
  }

  const scenario = {
    userRole: "seller" as const,
    negotiationType: "Jahresgespräch",
    relationshipType: "strategisch",
    negotiationFrequency: "jährlich",
    productMarketDescription: "Aktualisierung des Aktionsprogramms Q4 mit Fokus auf Impuls-Sortimente.",
    additionalComments: "Via CLI erzeugt",
    sonderinteressen: "Listung neuer Protein-Snacks",
    maxRounds: 6,
    selectedTechniques: [technique.id],
    selectedTactics: [tactic.id],
    counterpartDistance: { preis: 30, innovation: 70 },
    metadata: {
      companyKnown: true,
      counterpartKnown: true,
    },
    dimensions: [
      {
        name: "Preis pro Einheit",
        unit: "EUR",
        minValue: 0.95,
        maxValue: 1.35,
        targetValue: 1.15,
        priority: 1,
      },
      {
        name: "Volumen pro Monat",
        unit: "Einheiten",
        minValue: 80000,
        maxValue: 150000,
        targetValue: 110000,
        priority: 2,
      },
      {
        name: "Zahlungsziel",
        unit: "Tage",
        minValue: 30,
        maxValue: 60,
        targetValue: 45,
        priority: 3,
      },
    ],
    companyProfile: {
      organization: "CLI GmbH",
      company: "CLI Foods",
      country: "Deutschland",
      negotiationType: "Jahresgespräch",
      negotiationFrequency: "jährlich",
      goals: { margin: 0.12 },
    },
    market: {
      name: "DACH Grocery",
      region: "DACH",
      countryCode: "DE",
      currencyCode: "EUR",
      intelligence: "Hoher Preisdruck, Fokus auf Promotions.",
      notes: "Testlauf via Skript",
    },
    counterpartProfile: {
      name: "Retailer AG",
      kind: "retailer",
      powerBalance: "ausgeglichen",
      style: "datengetrieben",
      notes: "Langjährige Partnerschaft",
    },
    products: productPayloads.map((product, index) => ({
      ...product,
      productId: products[index].id,
    })),
  };

  const negotiation = await api<{ id: string }>("POST", "/api/negotiations", {
    registrationId: registration.id,
    marketId: market.id,
    counterpartId: counterpart.id,
    productIds: products.map((p) => p.id),
    title: "CLI Queue Smoke Test",
    description: "Automatisierter Durchstich zur Validierung der Ergebnis-Logs",
    scenario,
  });

  return { negotiationId: negotiation.id };
}

async function pollQueue(queueId: string) {
  /* eslint-disable no-constant-condition */
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const status = await api<{ success: boolean; data: any }>("GET", `/api/simulations/queue/${queueId}/status`);
    if (!status.success) {
      console.warn("[queue] status request returned success=false");
      continue;
    }
    const data = status.data;
    console.log(
      `[queue] status=${data.status} completed=${data.completedCount}/${data.totalSimulations} failed=${data.failedCount} progress=${data.progressPercentage}% cost=${data.actualCost}`,
    );
    if (data.completedCount + data.failedCount >= data.totalSimulations) {
      console.log("[queue] queue reached terminal state, stopping poller");
      break;
    }
  }
}

async function triggerQueue(negotiationId: string) {
  console.log(`[queue] starting simulation queue for negotiation ${negotiationId}`);
  const start = await api<{ negotiationId: string; queueId: string }>(
    "POST",
    `/api/negotiations/${negotiationId}/start`,
  );
  console.log(`[queue] queue created: ${start.queueId}`);
  console.log(`[queue] watch your server logs for [RESULTS] entries and Langfuse traces tied to simulation ${start.queueId}`);
  await pollQueue(start.queueId);
}

async function main() {
  const [, , maybeNegotiationId] = process.argv;
  if (maybeNegotiationId) {
    await triggerQueue(maybeNegotiationId);
    return;
  }

  console.log("[cli] no negotiation id passed – creating sample negotiation first");
  const { negotiationId } = await createNegotiation();
  console.log(`[cli] negotiation created: ${negotiationId}`);
  await triggerQueue(negotiationId);
}

main().catch((error) => {
  console.error("[cli] run failed:", error);
  process.exit(1);
});
