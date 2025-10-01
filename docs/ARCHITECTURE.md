# Architecture Overview

ARIAN AI is a full-stack TypeScript platform that orchestrates multi-agent negotiation simulations with a Python-based LLM service. This document captures how the major pieces fit together so contributors can trace data from the UI to the OpenAI Agents and back.

## System Map
- **React + Vite frontend (`client/`)** – Configures negotiations, monitors queues, and visualizes outcomes. Uses TanStack Query for API data and WebSockets for live updates.
- **Express backend (`server/`)** – REST + WebSocket gateway, queue orchestration, persistence layer, and logging entry point via `createRequestLogger` in `server/services/logger.ts`.
- **Shared models (`shared/`)** – Drizzle ORM schema and TypeScript types reused by both frontend and backend.
- **Python agent service (`scripts/run_production_negotiation.py`)** – Spins up OpenAI Agents workflows, emits Langfuse traces, and returns structured negotiation transcripts.
- **PostgreSQL database** – Stores negotiations, combinatorial simulation runs, queue status, and analytics artifacts (see `DATA_MODEL_SPECIFICATION.md`).

## Execution Flow
1. **Configuration** – Users define negotiation context, choose techniques/tactics, and set ZOPA boundaries from the UI. Payloads map directly to the Drizzle models under `shared/schema.ts`.
2. **Queue Creation** – `SimulationQueueService` builds the Cartesian product of techniques × tactics × personalities × ZOPA distances, persisting runs and queue metadata.
3. **Simulation** – Each run calls the Python agent service. Responses stream back through WebSockets for real-time dashboards while results persist to `simulation_runs`.
4. **Analytics & Audit** – Finished runs feed the dashboard metrics (success rate, deal values, cost). Langfuse trace IDs are attached for deep inspection of LLM calls.

## Key Services
- `server/services/negotiation-engine.ts` – Orchestrates negotiation lifecycle on the Node side.
- `server/services/simulation-queue.ts` – Manages queue state, retries, and WebSocket notifications.
- `server/services/python-negotiation-service.ts` – Bridges Express requests to the Python worker.
- `scripts/negotiation_utils.py` – Shared helpers for prompt construction, structured output validation, and logging inside the Python runtime.

## Data & Messaging Contracts
- **Database** – Core tables: `negotiations`, `simulation_queue`, `simulation_runs`, `negotiation_rounds`, plus reference data for tactics/techniques/personalities. Each schema change must be mirrored in `DATA_MODEL_SPECIFICATION.md`.
- **WebSocket Events** – Queue + run status updates (`simulation_started`, `simulation_completed`, `queue_progress`, etc.) feed the dashboard. Emit through the logger to keep observability consistent.
- **Agent Payloads** – The Python service expects fully expanded negotiation context and returns structured responses: `message`, `action`, `offer`, `internal_analysis`, and metadata such as `totalRounds`.

## Observability & Resilience
- Logging communicates through `createRequestLogger` children. Messages include `scope` to make cross-service tracing easier.
- Langfuse captures every LLM hop; configure via `LANGFUSE_*` env vars in both Node and Python environments.
- Crash recovery resets orphaned runs via the queue service. The recovery logic leans on `simulation_runs.status` and the queue checkpoint fields described in `SIMULATION_QUEUE.md`.

For deeper backlog items, historical architectural explorations now live under `docs/archive/`.
