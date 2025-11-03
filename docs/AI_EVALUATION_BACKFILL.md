# AI Evaluation Backfill System

**Status:** ✅ Production-Ready  
**Last Updated:** Oktober 2025  
**Purpose:** Automatic and manual AI evaluation of negotiation simulation runs

---

## Overview

The AI Evaluation Backfill System provides automatic and on-demand evaluation of negotiation simulations using OpenAI GPT-4o-mini. Every completed simulation receives a tactical analysis with effectiveness scores, enabling data-driven insights into negotiation strategy performance.

**Key Capabilities:**
- Automatic evaluation for all new simulations
- Backfill historical simulations without evaluations
- Per-negotiation targeted evaluation
- Real-time progress tracking
- Full Langfuse observability

---

## User Guide

### Automatic Evaluation (Default)

All new simulations automatically receive AI evaluation when they complete with:
- `DEAL_ACCEPTED` outcome
- `WALK_AWAY` outcome

**No user action required** - evaluations appear automatically in the analysis dashboard.

### Manual Backfill (Historical Data)

#### Global Backfill

Evaluate all unevaluated simulations across all negotiations:

1. Navigate to **Dashboard**
2. Locate **"AI Evaluation Status"** card (monitoring section)
3. Review statistics:
   - Total eligible simulations
   - Already evaluated count
   - Pending evaluation count
   - Completion percentage
4. Click **"Generate AI Summaries"** button
5. Monitor progress (auto-refresh every 5 seconds)

#### Per-Negotiation Backfill

Evaluate simulations for a specific negotiation:

1. Navigate to **Negotiation Analysis** page
2. Click **"KI-Bewertung generieren"** button (top-right)
3. System evaluates only runs missing evaluations for this negotiation
4. Results appear automatically in matrix

### Viewing Results

**Dashboard:**
- **Simulation Run History**: Shows badges indicating evaluation status
  - ✅ "AI Evaluated" (green) - All runs evaluated
  - 🧠 "X/Y evaluated" (gray) - Partial coverage

**Analysis Page:**
- **Matrix Cells**: Display effectiveness scores (📊 7/10 | 🎯 6/10)
- **Info Icon (ℹ️)**: Indicates evaluation available
- **Click Cell**: Opens dialog with full tactical summary

---

## Technical Implementation

### Architecture

```
Simulation Completes (DEAL_ACCEPTED/WALK_AWAY)
    ↓
Hook Triggers (simulation-queue.ts:885-891)
    ↓
TypeScript Service (simulation-evaluation.ts)
    ↓ Subprocess
Python Service (evaluate_simulation.py)
    ↓ API Call
OpenAI GPT-4o-mini + Langfuse
    ↓ Structured Output
Database Update (simulationRuns table)
    ↓
Frontend Display (Analysis Dashboard)
```

### API Endpoints

#### `POST /api/negotiations/backfill-evaluations`
Triggers global backfill for all unevaluated runs.

**Request:** No body required

**Response:**
```json
{
  "success": true,
  "message": "Started backfill process for 25 simulation runs",
  "totalRuns": 25
}
```

**Behavior:** Asynchronous processing (doesn't block)

#### `GET /api/negotiations/evaluation-status`
Returns real-time evaluation coverage statistics.

**Response:**
```json
{
  "total": 100,
  "evaluated": 75,
  "needingEvaluation": 25,
  "evaluationRate": 75.0
}
```

#### `POST /api/negotiations/:id/analysis/evaluate`
Triggers evaluation for specific negotiation's unevaluated runs.

**Request:** No body required

**Response:**
```json
{
  "success": true,
  "message": "Started evaluation for 3 simulation runs",
  "totalRuns": 3
}
```

### Service Methods

All in `SimulationQueueService` class (`server/services/simulation-queue.ts`):

#### `getSimulationRunsNeedingEvaluation()`
**Location:** Lines 1528-1542

**Purpose:** Query simulation runs without evaluations

**Criteria:**
- Outcome: `DEAL_ACCEPTED` or `WALK_AWAY`
- `tacticalSummary`: NULL

**Returns:** Array of simulation run records

#### `backfillEvaluations(runs: any[])`
**Location:** Lines 1547-1597

**Purpose:** Process evaluation queue

**Features:**
- Sequential processing with 1-second delay
- Error handling per simulation
- Progress logging
- Success/failure tracking

**Returns:** Success/failure counts

#### `getEvaluationStats()`
**Location:** Lines 1602-1629

**Purpose:** Calculate coverage statistics

**Returns:** Object with total, evaluated, pending, rate

#### `backfillEvaluationsForNegotiation(negotiationId: string)`
**Location:** Lines 1599-1649

**Purpose:** Backfill specific negotiation

**Returns:** Success/failure counts for that negotiation

### Database Schema

#### `simulation_runs` Table Fields

```sql
tactical_summary TEXT                     -- AI-generated summary (2-3 sentences, German)
technique_effectiveness_score DECIMAL(5,2) -- Score 1-10 for influence technique
tactic_effectiveness_score DECIMAL(5,2)    -- Score 1-10 for negotiation tactic
```

**Eligibility Query:**
```typescript
const runs = await db.select()
  .from(simulationRuns)
  .where(
    and(
      or(
        eq(simulationRuns.outcome, 'DEAL_ACCEPTED'),
        eq(simulationRuns.outcome, 'WALK_AWAY')
      ),
      isNull(simulationRuns.tacticalSummary)
    )
  );
```

### Python Service

#### `evaluate_simulation.py`

**Purpose:** AI evaluation microservice

**Input (JSON):**
```python
{
  "simulation_run_id": "uuid",
  "conversation_log": [...],
  "role": "BUYER",
  "influence_technique": "Reziprozität",
  "negotiation_tactic": "Win-Win",
  "counterpart_attitude": "Analytical"
}
```

**Output (JSON):**
```python
{
  "tactical_summary": "Der Käufer nutzte Reziprozität effektiv...",
  "technique_effectiveness_score": 7.5,
  "tactic_effectiveness_score": 6.0
}
```

**Features:**
- Langfuse prompt: `simulation_eval`
- OpenAI GPT-4o-mini for cost efficiency
- Structured output via Pydantic models
- Full tracing with `langfuse.openai` wrapper

### Frontend Components

#### `EvaluationBackfillCard.tsx`
**Location:** `client/src/components/dashboard/evaluation-backfill-card.tsx`

**Features:**
- Real-time statistics display
- Progress bar with percentage
- One-click backfill trigger
- Auto-refresh during processing
- Status badges

#### Enhanced `SimulationRunHistory.tsx`
**Location:** `client/src/components/dashboard/simulation-run-history.tsx:28-103`

**Additions:**
- Per-negotiation evaluation statistics
- Dynamic badge display
- Accurate real-time counts

---

## Testing Guide

### Prerequisites

1. Development server running (`npm run dev`)
2. Database connection active
3. Python virtual environment set up (`.venv`)
4. Environment variables configured:
   - `OPENAI_API_KEY` (required)
   - `LANGFUSE_SECRET_KEY` (optional)
   - `LANGFUSE_PUBLIC_KEY` (optional)

### Backend API Testing

#### Test Evaluation Status
```bash
curl http://localhost:3000/api/negotiations/evaluation-status
```

**Expected:**
- Status code: 200
- Fields: `total`, `evaluated`, `needingEvaluation`, `evaluationRate`

#### Trigger Global Backfill
```bash
curl -X POST http://localhost:3000/api/negotiations/backfill-evaluations
```

**Expected:**
- Status code: 200
- Response shows count of runs to process
- Server logs show evaluation progress

#### Monitor Progress
```bash
# Wait 30 seconds
sleep 30
curl http://localhost:3000/api/negotiations/evaluation-status
```

**Expected:**
- `evaluated` count increases
- `needingEvaluation` count decreases

### Frontend UI Testing

#### Dashboard Display
1. Navigate to http://localhost:5173
2. Locate "AI Evaluation Status" card
3. Verify statistics displayed correctly
4. Check progress bar shows correct percentage

#### Trigger Backfill
1. Click "Generate AI Summaries"
2. Button shows "Evaluating..." with spinner
3. Stats auto-refresh every 5 seconds
4. Progress bar fills over time

#### View Results
1. Go to Negotiation Analysis page
2. Click matrix cell with evaluation
3. Dialog shows:
   - Tactical summary (German)
   - Effectiveness scores (1-10)
   - Full conversation log

### Database Verification

```sql
SELECT 
  id,
  outcome,
  tactical_summary IS NOT NULL as has_evaluation,
  technique_effectiveness_score,
  tactic_effectiveness_score
FROM simulation_runs
WHERE outcome IN ('DEAL_ACCEPTED', 'WALK_AWAY')
LIMIT 10;
```

**Expected:**
- `tactical_summary`: Populated with German text
- Scores: Between 1.0 and 10.0

---

## Performance & Cost

### Speed
- **Per Evaluation:** ~1-2 seconds
- **100 Simulations:** ~2-3 minutes
- **Rate Limiting:** 1-second delay between calls

### Cost
- **Per Evaluation:** ~$0.01-0.02 (GPT-4o-mini)
- **100 Simulations:** ~$1-2
- **Tracked via:** Langfuse dashboard

### Scalability
- Asynchronous processing (non-blocking)
- Can handle large backlogs
- Safe to interrupt and resume (idempotent)
- No duplicate evaluations

---

## Error Handling

### Backend Errors

**Missing Negotiation Data:**
- Logs warning with run ID
- Skips run, continues to next
- Doesn't fail entire backfill

**Python Service Failure:**
- Logs error with details
- Increments failure counter
- Continues processing

**API Throttling:**
- 1-second delay prevents throttling
- If occurs: Logged and retried

### Frontend Errors

**Network Failure:**
- Shows error message
- Retry button available
- Graceful degradation

**Stale Data:**
- Manual refresh button
- Auto-refresh on backfill trigger

---

## Troubleshooting

### No Simulations Found
**Cause:** No eligible simulations exist

**Verify:**
- Simulations with `DEAL_ACCEPTED` or `WALK_AWAY` outcomes exist
- Database connection active
- Check server logs

### Backfill Stuck
**Symptoms:** Progress not updating

**Solutions:**
1. Check Python service running: `which python3` (should show `.venv`)
2. Verify environment variables set
3. Review server logs for errors
4. Click refresh button to reload status

### Evaluations Failing
**Check:**
- `OPENAI_API_KEY` configured
- Python dependencies installed: `pip list | grep openai`
- Langfuse credentials (if using)
- Server logs for specific errors

### Incomplete Results
**Expected Behavior:**
- Some runs may fail (network, API errors)
- Re-run backfill only processes unevaluated runs
- Check individual run logs for details

---

## Code References

### Backend
- **Endpoints:** `server/routes/negotiations.ts:893-991`
- **Service Methods:** `server/services/simulation-queue.ts:1524-1649`
- **Evaluation Service:** `server/services/simulation-evaluation.ts`
- **Python Script:** `scripts/evaluate_simulation.py`

### Frontend
- **Backfill Card:** `client/src/components/dashboard/evaluation-backfill-card.tsx`
- **History Badges:** `client/src/components/dashboard/simulation-run-history.tsx:28-103`
- **Dashboard Integration:** `client/src/pages/Dashboard.tsx:41-50`
- **Analysis Page:** `client/src/pages/negotiation-analysis.tsx:94-115`

### Data Models
- **Pydantic Model:** `scripts/negotiation_models.py:SimulationEvaluation`
- **Database Schema:** `shared/schema.ts:simulationRuns`

---

## Future Enhancements

### Potential Improvements
1. **Batch Parallel Processing:** Evaluate 5-10 runs simultaneously
2. **Priority Queue:** Recent/important runs first
3. **Selective Backfill:** Filter by date, negotiation, technique
4. **Scheduled Jobs:** Automatic nightly backfill
5. **Email Notifications:** Alert on completion
6. **WebSocket Progress:** Real-time updates during backfill
7. **Cost Budget Limiting:** Stop after spending limit
8. **Quality Metrics:** Track evaluation quality scores

### Refactoring Opportunities
1. Extract evaluation logic to dedicated service
2. Add unit tests for service methods
3. Create reusable progress tracking component
4. Implement retry logic with exponential backoff

---

## Deployment Considerations

### Environment Requirements
- Python 3.11+ with virtual environment
- OpenAI API key configured
- Langfuse credentials (optional but recommended for cost tracking)

### Database Migration
No schema changes required - uses existing fields in `simulation_runs` table.

### Post-Deployment Steps
1. Verify API endpoints accessible
2. Run initial backfill for historical data
3. Monitor server logs for errors
4. Check Langfuse for cost tracking

### Production Checklist
- [ ] Environment variables configured
- [ ] Python dependencies installed
- [ ] Database schema up to date
- [ ] Health check endpoint responding
- [ ] Test backfill on small dataset first

---

**Document Version:** 2.0 (Consolidated)  
**Maintainer:** Christian Au
