import { describe, expect, it } from "vitest";
import { buildSimulationResultArtifacts } from "../server/services/simulation-result-processor";
import type { NegotiationRecord } from "../server/storage";
import type { Product } from "@shared/schema";

const baseNegotiation: NegotiationRecord = {
  id: "neg-1",
  registrationId: "reg-1",
  marketId: null,
  counterpartId: null,
  title: "Test Negotiation",
  description: null,
  scenario: {
    userRole: "seller",
    negotiationType: "annual",
    negotiationFrequency: "yearly",
    relationshipType: "strategic",
    selectedTechniques: [],
    selectedTactics: [],
    dimensions: [
      {
        id: "dim-price",
        name: "Schoko Riegel Preis",
        minValue: 0.9,
        maxValue: 1.4,
        targetValue: 1.2,
        priority: 1,
        unit: "EUR",
      },
      {
        id: "dim-lead",
        name: "Lieferzeit Tage",
        minValue: 10,
        maxValue: 30,
        targetValue: 14,
        priority: 2,
        unit: "days",
      },
    ],
  },
  status: "planned",
  startedAt: null,
  endedAt: null,
  metadata: {},
};

const baseProduct: Product = {
  id: "prod-1",
  registrationId: "reg-1",
  name: "Schoko Riegel",
  gtin: null,
  brand: null,
  categoryPath: null,
  attrs: {
    targetPrice: 1.1,
    minPrice: 0.95,
    maxPrice: 1.4,
    estimatedVolume: 1000,
  },
};

describe("simulation-result-processor", () => {
  it("derives product and dimension rows with deal value", () => {
    const artifacts = buildSimulationResultArtifacts({
      runId: "run-1",
      negotiation: baseNegotiation,
      products: [baseProduct],
      dimensionValues: {
        "Schoko Riegel Preis": 1.25,
        "Schoko Riegel Volumen": 950,
        "Lieferzeit Tage": 12,
      },
    });

    expect(artifacts.productRows).toHaveLength(1);
    expect(artifacts.dimensionRows).toHaveLength(2);
    expect(artifacts.productRows[0].agreedPrice).toBe("1.25");
    expect(artifacts.productRows[0].estimatedVolume).toBe(950);
    expect(artifacts.dealValue).toBe((1.25 * 950).toFixed(2));
    expect(artifacts.otherDimensions["Lieferzeit Tage"]).toBe(12);
  });

  it("falls back to targets when no agent values are returned", () => {
    const artifacts = buildSimulationResultArtifacts({
      runId: "run-2",
      negotiation: baseNegotiation,
      products: [baseProduct],
      dimensionValues: {},
    });

    expect(artifacts.productRows[0].agreedPrice).toBe("1.10");
    expect(artifacts.productRows[0].estimatedVolume).toBe(1000);
    expect(artifacts.dimensionRows[0].finalValue).toBe("1.2000");
    expect(artifacts.otherDimensions).toEqual({});
  });

  it("matches dimension keys without keywords or ascii-only names", () => {
    const negotiation = {
      ...baseNegotiation,
      scenario: {
        ...baseNegotiation.scenario,
        products: [
          {
            productId: "prod-de",
            name: "Pombär Chips",
            targetPrice: 1.08,
            minPrice: 1.0,
            maxPrice: 1.2,
            estimatedVolume: 50000,
          },
        ],
      },
    } as NegotiationRecord;

    const artifacts = buildSimulationResultArtifacts({
      runId: "run-de",
      negotiation,
      products: [],
      dimensionValues: {
        "Pombär Chips": 1.1,
      },
    });

    expect(artifacts.productRows).toHaveLength(1);
    expect(artifacts.productRows[0].agreedPrice).toBe("1.10");
    expect(artifacts.productRows[0].subtotal).toBe((1.1 * 50000).toFixed(2));
    expect(artifacts.dealValue).toBe((1.1 * 50000).toFixed(2));
  });
});
