# Testing Guide

Use this checklist to validate changes before handoff. Keep it updated as new tooling lands.

## Core Commands
```bash
npm run test   # Vitest unit/integration suite
npm run check  # TypeScript + type generation
npm run lint   # (planned) ESLint when enabled
```
- UI tests rely on JSDOM; ensure new components include minimal tests.
- Python workflows can be validated with `scripts/test_negotiation.py`.

## API Smoke Tests
```bash
curl -X POST http://localhost:3000/api/negotiations \
  -H "Content-Type: application/json" \
  -d '{
    "contextId": "550e8400-e29b-41d4-a716-446655440000",
    "buyerAgentId": "550e8400-e29b-41d4-a716-446655440001",
    "sellerAgentId": "550e8400-e29b-41d4-a716-446655440002",
    "userRole": "buyer",
    "maxRounds": 6,
    "selectedTechniques": ["scarcity", "reciprocity"],
    "selectedTactics": ["competitive_pricing", "value_creation"],
    "userZopa": {
      "price": {"min": 10, "max": 100, "target": 50}
    },
    "counterpartDistance": {
      "price": 0
    }
  }'
```
Expected: 4 simulation runs (`2 techniques × 2 tactics`). Verify `simulationRuns` array and `totalCombinations` in the response.

## Queue Validation
1. Create a negotiation via the API or UI.
2. Trigger queue execution (`executeNext` or `executeAll`).
3. Confirm WebSocket events or logs for `simulation_started`/`simulation_completed`.
4. Inspect database tables:
   - `simulation_queue` counts (`completedCount`, `failedCount`).
   - `simulation_runs` status progression.

## Negotiation Service Tests
- Run `scripts/run_production_negotiation.py` against a sample negotiation to ensure the Python agent returns structured responses (`message`, `action`, `offer`, `internal_analysis`).
- Langfuse traces should appear with the negotiation ID; missing traces usually mean env vars are unset.

## Regression Checklist
- No new bare `console` statements (use `createRequestLogger`).
- Database migrations applied and documented.
- Docs updated when request/response payloads change.
- Record skipped tests with rationale in the PR summary.

Iterate on this guide whenever new suites or commands are introduced so contributors know the expectations upfront.
