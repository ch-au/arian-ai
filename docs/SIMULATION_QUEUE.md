# Simulation Queue Processing

## Overview

The simulation queue system manages the execution of AI negotiation simulations with comprehensive status tracking, real-time updates, and crash recovery capabilities.

## Core Components

### SimulationQueueService
- **Location**: `server/services/simulation-queue.ts`
- **Purpose**: Orchestrates queue creation, execution, and monitoring
- **Key Methods**:
  - `createQueue()` - Generate combinatorial simulation matrix
  - `executeNext()` - Process next pending simulation
  - `executeAll()` - Process all remaining simulations
  - `getQueueStatus()` - Real-time status and progress
  - `getSimulationResults()` - Results for analytics

### Database Schema

#### `simulation_queue`
- `id` - Unique queue identifier
- `negotiationId` - Parent negotiation reference
- `totalSimulations` - Total count (techniques × tactics × personalities × distances)
- `completedCount` - Successfully finished simulations
- `failedCount` - Failed or timed-out simulations
- `status` - Queue-level status: `pending`, `running`, `completed`, `failed`, `paused`
- `estimatedTotalCost` / `actualTotalCost` - Cost tracking

#### `simulation_runs` 
- `id` - Unique simulation identifier
- `queueId` - Parent queue reference
- `negotiationId` - Parent negotiation reference
- `runNumber` - Execution sequence number
- `techniqueId` - Psychological technique being tested
- `tacticId` - Negotiation tactic being tested
- `personalityId` - Agent personality configuration
- `zopaDistance` - ZOPA distance setting (`close`, `medium`, `far`)
- `status` - Simulation status (see Status Model below)
- `conversationLog` - Complete negotiation transcript (JSON)
- `dimensionResults` - Final deal parameters (JSON)
- `totalRounds` - Number of negotiation rounds
- `actualCost` - Execution cost in USD
- `crashRecoveryData` - Recovery metadata (JSON)

## Status Model

### Simulation Run Statuses
- **`pending`**: Ready for execution, not yet started
- **`running`**: Currently being processed
- **`completed`**: Successfully finished with deal accepted (`DEAL_ACCEPTED`)
- **`failed`**: Finished but no deal reached (`TERMINATED` or rejection)
- **`timeout`**: Finished due to time or round limits

### Queue Statuses
- **`pending`**: Created but no simulations started
- **`running`**: At least one simulation in progress
- **`completed`**: All simulations finished
- **`paused`**: Execution temporarily stopped
- **`failed`**: Critical error occurred

## Analytics Processing

### Key Metrics Calculation

```typescript
// Finished simulations (all non-pending)
const finishedRuns = simulationResults.filter(r => 
  ['completed', 'failed', 'timeout'].includes(r.status)
);

// Success rate (deal acceptance rate)
const successRate = finishedRuns.length > 0 
  ? (successfulRuns.length / finishedRuns.length) * 100 
  : 0;

// Average deal value (successful deals only)
const avgDealValue = successfulRuns.reduce((sum, r) => {
  const dimensionResults = JSON.parse(r.dimensionResults || '{}');
  return sum + (dimensionResults.Price || 0);
}, 0) / successfulRuns.length;

// Total cost (all simulations)
const totalCost = simulationResults.reduce((sum, r) => 
  sum + (parseFloat(r.actualCost) || 0), 0
);
```

### Status Interpretation
- **Success**: Only `completed` status indicates a successful deal
- **Finished**: All `completed`, `failed`, and `timeout` are finished negotiations
- **Active**: Only `running` simulations are currently active
- **Pending**: Only `pending` simulations are waiting to execute

## Execution Flow

### 1. Queue Creation
```typescript
const queueId = await SimulationQueueService.createQueue({
  negotiationId: "nego-123",
  techniques: ["tech-1", "tech-2"],
  tactics: ["tactic-1", "tactic-2"],
  personalities: ["personality-1"],
  zopaDistances: ["medium"]
});
// Creates: 2×2×1×1 = 4 simulation runs
```

### 2. Sequential Execution
- Simulations execute one at a time to avoid API rate limits
- Each execution updates real-time via WebSocket
- Crash recovery data stored during execution
- Failed simulations can be retried with exponential backoff

### 3. Real-time Updates
WebSocket events broadcast to connected clients:
- `simulation_started` - New simulation begins
- `negotiation_round` - Each round of negotiation
- `simulation_completed` - Simulation finishes successfully
- `simulation_failed` - Simulation fails
- `queue_progress` - Overall progress updates
- `queue_completed` - All simulations finished

### 4. Results Storage
Final results stored in `simulation_runs`:
- `conversationLog` - Full negotiation transcript
- `dimensionResults` - Deal parameters (price, volume, etc.)
- `totalRounds` - Conversation length
- `actualCost` - OpenAI API cost

## Crash Recovery

### Recovery Mechanisms
1. **Orphaned Simulation Detection**: Find simulations running >5 minutes
2. **Checkpoint Data**: Store recovery metadata in `crashRecoveryData`
3. **Resume Capability**: Reset orphaned simulations to `pending`
4. **Retry Logic**: Failed simulations retried up to `maxRetries` times

### Recovery Process
```typescript
// Detect orphaned simulations
const orphanedSimulations = await db.select()
  .from(simulationRuns)
  .where(and(
    eq(simulationRuns.status, 'running'),
    lt(simulationRuns.startedAt, new Date(Date.now() - 5 * 60 * 1000))
  ));

// Reset to pending for retry
await SimulationQueueService.recoverOrphanedSimulations(orphanedIds);
```

## Common Issues and Solutions

### Statistics Showing Zeros
**Problem**: Analytics only counting `completed` simulations
**Solution**: Include all finished simulations (`completed`, `failed`, `timeout`)
**Files**: `client/src/components/dashboard/simulation-analytics.tsx`

### Buttons Not Visible
**Problem**: UI hiding controls when queue status is `completed`
**Solution**: Base visibility on actual pending simulation count
**Logic**: `(completedCount + failedCount < totalSimulations)`

### Queue Status Mismatch
**Problem**: Queue marked `completed` with pending simulations
**Solution**: Verify status logic in `executeNext()` method
**Debug**: Check simulation status distribution vs queue counts

## Monitoring and Debugging

### Key Metrics to Monitor
- Queue status transitions
- Simulation status distribution
- Cost accumulation vs estimates
- WebSocket connection health
- Python service availability

### Debug Commands
```bash
# Check queue status
curl http://localhost:3000/api/simulations/queue/{queueId}/status

# Get simulation results
curl http://localhost:3000/api/simulations/queue/{queueId}/results

# Monitor WebSocket events
// Browser console: Watch for simulation events
```

### Logging Points
- Queue creation with simulation count
- Each simulation status change
- WebSocket event broadcasts
- Cost calculations and totals
- Recovery actions and retry attempts