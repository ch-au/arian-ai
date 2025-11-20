import { describe, it, expect } from "vitest";
import { summarizeDimensions, summarizeProducts } from "@/lib/analysis-helpers";

describe("analysis helpers", () => {
  it("summarizes dimensions", () => {
    const summary = summarizeDimensions([
      {
        dimensionResults: [
          { dimensionName: "Preis", achievedTarget: true, priorityScore: 1 },
          { dimensionName: "Preis", achievedTarget: false, priorityScore: 1 },
        ],
      },
      {
        dimensionResults: [{ dimensionName: "Lieferzeit", achievedTarget: true, priorityScore: 2 }],
      },
    ]);

    expect(summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Preis", total: 2, achieved: 1, rate: 50 }),
        expect.objectContaining({ name: "Lieferzeit", total: 1, achieved: 1, rate: 100 }),
      ]),
    );
  });

  it("summarizes products", () => {
    const summary = summarizeProducts([
      {
        productResults: [
          { productName: "A", agreedPrice: "1.10", performanceScore: "90", withinZopa: true },
          { productName: "A", agreedPrice: "1.30", performanceScore: "80", withinZopa: false },
        ],
      },
    ]);

    const product = summary.find((s) => s.name === "A");
    expect(product).toBeDefined();
    expect(product?.zopaRate).toBe(50);
    expect(product?.avgPrice).toBeCloseTo(1.2, 5);
  });
});
