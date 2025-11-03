# Simulation Queue

The simulation queue coordinates every negotiation run created from a negotiation configuration. Use this document when you need to trace execution, add metrics, or debug stuck runs.

## Responsibilities
- Expand technique × tactic × personality × ZOPA combinations into queued runs.
- Execute runs sequentially (rate-limit friendly) while broadcasting progress via WebSocket.
- Persist results (`conversation_log`, `dimension_results`, cost, status) for analytics.
- Guard against crashes by detecting and resetting orphaned runs.

## Key Implementation Points
- Service: `SimulationQueueService` in `server/services/simulation-queue.ts`.
- Primary methods:
  - `createQueue` – builds the run matrix and persists `simulation_queue` + `simulation_runs` rows.
  - `executeNext` / `executeAll` – pops the next pending run, invokes the Python service, and updates status.
  - `getQueueStatus` – aggregates counts for dashboards.
  - `recoverOrphanedSimulations` – resets long-running jobs (>5 minutes) to `pending`.
- Events: `simulation_started`, `negotiation_round`, `simulation_completed`, `simulation_failed`, `queue_progress`, `queue_completed`.

## Status Model
```text
simulation_runs.status: pending → running → completed | failed | timeout
simulation_queue.status: pending | running | paused | completed | failed
```
- Finished runs = `completed`, `failed`, `timeout`.
- Success rate = `completed ÷ finished`.
- Queue cost = sum of `simulation_runs.actual_cost`.

## Analytics Helpers
Use filters like:
```ts
const finished = runs.filter(r => ['completed', 'failed', 'timeout'].includes(r.status));
const successRate = finished.length ? completed.length / finished.length : 0;
const totalCost = runs.reduce((sum, r) => sum + Number(r.actualCost || 0), 0);
```
Keep analytic transforms in shared utilities so the dashboard and API stay in sync.

## Crash Recovery
1. **Detection** – Query for runs stuck in `running` longer than 5 minutes.
2. **Reset** – Set them back to `pending` and decrement queue counters as needed.
3. **Resume** – `executeNext` will pick up the reset runs; surface the incident in logs for observability.

## When Extending the Queue
- Add any new fields to both the Drizzle schema and this document.
- Emit structured logs via `createRequestLogger` so traces show queue IDs and run IDs.
- Update `TESTING_GUIDE.md` with new validation steps whenever queue behavior changes.
