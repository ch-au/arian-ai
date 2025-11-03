# Development Guide

This guide expands on the root `README.md` with the details contributors need once the project is running locally.

## Environment Checklist
- Install prerequisites from the root README (`Node 18+`, `PostgreSQL`/Neon, `Python 3.11+`).
- Copy `.env.example` (if available) or recreate the fields documented in the README.
- Apply database schema with `npm run db:push`; seed demo content with `npm run db:seed`.
- For the Python negotiation service, create a virtualenv and install `agents`, `langfuse`, `python-dotenv`, `logfire`, and `pydantic`.

## Daily Commands
```bash
npm run dev        # Full stack dev loop (Vite + Express proxy)
npm run dev:client # Frontend only	npm run dev:server # Backend only
npm run test       # Vitest suite
npm run check      # TypeScript + typegen verification
```
- Use `npm run lint` once it lands; until then, rely on `npm run check` and formatter defaults.
- For Python validation, use `scripts/test_negotiation.py` or the Langfuse-backed harness in `run_production_negotiation.py`.

## Workflow Expectations
1. **Discussion** – Clarify requirements and edge cases before coding.
2. **Branching** – Create feature branches; keep commits scoped and descriptive.
3. **Testing** – Run targeted tests locally. Record anything skipped (e.g., e2e flows) in the PR description.
4. **Review Readiness** – Ensure new services or routes instantiate `createRequestLogger` and propagate the logger downstream.
5. **Documentation** – Update the relevant doc in this folder when behavior or tooling changes.

## Coding Standards
- **TypeScript** – Strict mode is enforced. Avoid `any`; prefer derived types from Drizzle schema (`shared/schema.ts`).
- **Logging** – Use `createRequestLogger` from `server/services/logger.ts` for request-scoped logging. Plain `console` usage is reserved for throwaway scripts.
- **Error Handling** – Normalize API errors through helpers in `server/services`. Bubble domain-specific errors rather than string comparisons.
- **React** – Keep components pure, co-locate hooks, and gate network calls through TanStack Query.
- **Python** – Follow `scripts/negotiation_utils.py` patterns for structured outputs and Langfuse traces.

## Database & Migrations
- Schema lives in `shared/schema.ts`; Drizzle generates SQL migrations automatically.
- When altering tables, update the schema, regenerate types, and document the change in `DATA_MODEL_SPECIFICATION.md`.
- Seed scripts rely on the CSV data under `data/`; keep them synchronized when adding new reference data.

## Troubleshooting
- **Vite fails to start** – Free ports `5173`/`3000`, clear `node_modules/.vite` cache, rerun `npm run dev`.
- **OpenAI requests fail** – Confirm API key, rate limits, and Python service health (`scripts/run_production_negotiation.py`).
- **Langfuse missing traces** – Ensure `LANGFUSE_*` env vars are populated in both Node and Python environments.
- **Database drift** – Re-run `npm run db:push` and inspect the generated SQL before applying in shared environments.

Keep this doc succinct. When new patterns solidify (CI commands, lint setup, etc.), update the relevant section instead of layering new documents.
