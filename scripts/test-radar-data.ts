/**
 * Test script to verify buildActualValuesRadar function
 */
import { buildActualValuesRadar } from "../client/src/lib/run-comparison";

// Sample data matching what the API returns
const testRuns = [
  {
    id: "548d00e2-d31c-4f16-8c4a-4dbbb2874240",
    techniqueName: "Logisches Überzeugen",
    tacticName: "Fuß-in-der-Tür-Technik",
    dealValue: 160000,
    totalRounds: 4,
    dimensionResults: [
      {
        dimensionName: "Lieferzeit",
        finalValue: "2.0000",
        achievedTarget: true,
      },
    ],
    productResults: [
      {
        productName: "Pombär Chips 100g",
        agreedPrice: "1.10",
        withinZopa: true,
      },
      {
        productName: "Pombär Sticks 200g",
        agreedPrice: "1.00",
        withinZopa: true,
      },
    ],
  },
  {
    id: "abc123-second-run",
    techniqueName: "Emotionale Überzeugung",
    tacticName: "Anker-Technik",
    dealValue: 165000,
    totalRounds: 5,
    dimensionResults: [
      {
        dimensionName: "Lieferzeit",
        finalValue: "3.0000",
        achievedTarget: false,
      },
    ],
    productResults: [
      {
        productName: "Pombär Chips 100g",
        agreedPrice: "1.15",
        withinZopa: true,
      },
      {
        productName: "Pombär Sticks 200g",
        agreedPrice: "1.05",
        withinZopa: true,
      },
    ],
  },
];

console.log("\n=== TESTING buildActualValuesRadar ===\n");

const radarData = buildActualValuesRadar(testRuns);

console.log("Radar Data Points:", radarData.length);
console.log("\nRadar Data:\n");

radarData.forEach((point) => {
  console.log(`Metric: ${point.metric}`);
  testRuns.forEach((run) => {
    console.log(`  ${run.techniqueName}: ${point[run.id]}`);
  });
  console.log();
});

console.log("=== Expected Output ===\n");
console.log("Metric: Deal Value (€)");
console.log("  Logisches Überzeugen: 160000");
console.log("  Emotionale Überzeugung: 165000");
console.log();
console.log("Metric: Lieferzeit");
console.log("  Logisches Überzeugen: 2");
console.log("  Emotionale Überzeugung: 3");
console.log();
console.log("Metric: Pombär Chips 100g (€)");
console.log("  Logisches Überzeugen: 1.1");
console.log("  Emotionale Überzeugung: 1.15");
console.log();
console.log("Metric: Pombär Sticks 200g (€)");
console.log("  Logisches Überzeugen: 1");
console.log("  Emotionale Überzeugung: 1.05");
console.log();

console.log("✅ Test completed!\n");
