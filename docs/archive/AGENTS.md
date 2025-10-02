# Agents Guide

## Purpose
This guide documents how we operate the LLM agent workflow inside ARIAN AI. Use it to understand what the automation layer can do, how we collaborate with humans, and where to look when something breaks.

## Operating Principles
- **Stay observable** – Always run work through `createRequestLogger` or existing request-scoped loggers. Never introduce naked `console` calls when touching server code.
- **Work in the open** – Document assumptions, unblocked issues, and follow-up tasks in pull requests or the doc set before handing work back to humans.
- **Prefer minimal diffs** – Change only what is needed for the task, keep edits ASCII-only, and leave unrelated formatting untouched.
- **Validate before handoff** – Run targeted checks or tests (`npm run test`, `npm run check`, custom scripts) whenever code paths change. Record what ran and the outcome in the final status update.

## Execution Flow
1. **Kickoff**
   - Confirm task intent and constraints.
   - Inspect existing files with `rg`, `npm run lint`, or other read-only commands.
2. **Planning**
   - Share a short plan for non-trivial work before making edits.
   - Keep the plan updated as tasks progress.
3. **Implementation**
   - Touch only required files. When editing services/routes, wire them into `createRequestLogger` (`server/services/logger.ts`) instead of using `console`.
   - For agent-facing features, coordinate with the Python entry points in `scripts/run_production_negotiation.py` and helpers under `scripts/`.
4. **Validation**
   - Execute the smallest useful test set. If tests are skipped (time, sandbox limits), state what would run next.
5. **Handoff**
   - Summarize intent, impacted files, verification steps, and next suggestions. Link to docs or follow-up tickets as needed.

## Logging & Observability
- TypeScript entry point: `createRequestLogger` from `server/services/logger.ts`.
- Pattern: Instantiate the logger at route/service boundaries and pass it through downstream helpers instead of using `console`.
- For Python agents, stick to the structured logger in `scripts/negotiation_utils.py`, which already emits Langfuse trace metadata.
- If new events are introduced, document them here and add verification steps to `TESTING_GUIDE.md` when validation changes.

## Toolbelt
- `npm run dev` – Combined dev environment for quick smoke tests.
- `npm run test` – Vitest suite (JSDOM-ready, UI coverage lives here).
- `npm run check` – TypeScript correctness.
- `rg <pattern>` – Fast source search; keep usage read-only when auditing.
- `scripts/test_negotiation.py` – Python harness for exercising the negotiation service end-to-end.

## Escalation Path
- Blocked on sandbox or missing credentials? Pause and surface the issue in the task notes.
- Unexpected repository changes that we did not perform should be called out immediately—never overwrite user work without direction.
- Significant architectural or product questions should be captured as follow-up tasks or archived in `docs/archive/ROADMAP.md` before implementation.

Keep this document updated whenever the automation workflow or logging strategy changes. It should remain the fastest reference for anyone monitoring LLM agent activity.
