# Simulation Execution UI - Design & Implementation Plan

## Overview

Design robust simulation execution interface allowing users to run individual simulations or full queues with comprehensive crash recovery and real-time monitoring.

## UI Architecture

### Screen 3: Simulation Monitor (`/simulation-monitor/:negotiationId`)

#### A. Header Section
```
┌─────────────────────────────────────────────────────────────────┐
│ 📊 "Office Supplies Procurement" Simulation Monitor            │
│ ─────────────────────────────────────────────────────────────── │
│ Status: [🟢 Ready] [⏸️ Paused] [🟡 Running] [🔴 Error]          │
│ Progress: ████████████████████░░░░ 16/25 simulations (64%)     │
│ Estimated: 12 min remaining | Started: 2:30 PM                 │
│                                                                 │
│ [▶️ Run Next] [▶️▶️ Run All] [⏸️ Pause] [⏹️ Stop] [🔄 Resume]    │
└─────────────────────────────────────────────────────────────────┘
```

#### B. Queue Overview
```
┌─────────────────────────────────────────────────────────────────┐
│ 📋 Simulation Queue (25 total)                                 │
│ ─────────────────────────────────────────────────────────────── │
│ ✅ Completed: 16    🟡 Running: 1    ⏳ Pending: 8             │
│ ❌ Failed: 0        ⏸️ Paused: 0                                │
│                                                                 │
│ 📊 Success Rate: 100% | Avg Duration: 45s | Total Cost: $2.40 │
└─────────────────────────────────────────────────────────────────┘
```

#### C. Real-Time Execution View
```
┌─────────────────────────────────────────────────────────────────┐
│ 🚀 Currently Running: Anchoring + Good Cop/Bad Cop             │
│ ─────────────────────────────────────────────────────────────── │
│ Round 3/6 | Duration: 00:32 | Cost: $0.12                     │
│                                                                 │
│ 💬 Latest Exchange:                                             │
│ [BUYER]: "Our budget committee has approved up to $12,000..."   │
│ [SELLER]: "I appreciate your transparency. Let me discuss..."   │
│                                                                 │
│ 📈 Current Offer: Price: $12,500 | Delivery: 10 days          │
└─────────────────────────────────────────────────────────────────┘
```

#### D. Results Table & Visualization
```
┌─────────────────────────────────────────────────────────────────┐
│ 📊 Simulation Results                    [🔍 Filter] [📁 Export] │
│ ─────────────────────────────────────────────────────────────── │
│ # │ Technique   │ Tactic      │ Status │ Outcome │ Price │ Time │
│ 1 │ Anchoring   │ Authority   │ ✅     │ DEAL    │ 12.5K │ 42s  │
│ 2 │ Anchoring   │ Scarcity    │ ✅     │ DEAL    │ 13.0K │ 38s  │
│ 3 │ BATNA       │ Authority   │ ✅     │ DEAL    │ 11.8K │ 51s  │
│ 4 │ Framing     │ Good Cop    │ 🟡     │ Running │ -     │ 32s  │
│ 5 │ Framing     │ Scarcity    │ ⏳     │ Pending │ -     │ -    │
│                                                                 │
│ [📊 Radar Chart] [📈 Performance Trends] [💬 View Conversation] │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema Enhancements

### Enhanced `simulation_runs` Table
```sql
ALTER TABLE simulation_runs ADD COLUMN:
  execution_order INTEGER,           -- Queue position
  started_at TIMESTAMP,             -- Actual start time
  estimated_duration INTEGER,       -- Predicted seconds
  actual_cost DECIMAL(10,4),        -- OpenAI API cost
  crash_recovery_data JSONB,        -- State for recovery
  retry_count INTEGER DEFAULT 0,    -- Failed attempts
  max_retries INTEGER DEFAULT 3;    -- Retry limit
```

### New `simulation_queue` Table
```sql
CREATE TABLE simulation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negotiation_id UUID REFERENCES negotiations(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed', 'paused')) DEFAULT 'pending',
  total_simulations INTEGER NOT NULL,
  completed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  started_at TIMESTAMP,
  paused_at TIMESTAMP,
  completed_at TIMESTAMP,
  estimated_total_cost DECIMAL(10,4),
  actual_total_cost DECIMAL(10,4) DEFAULT 0,
  crash_recovery_checkpoint JSONB,   -- Recovery state
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Crash Recovery Architecture

### 1. State Persistence Strategy

#### A. Checkpoint System
```typescript
interface SimulationCheckpoint {
  negotiationId: string;
  queueId: string;
  currentSimulationId?: string;
  completedSimulations: string[];
  failedSimulations: string[];
  currentRound?: number;
  lastMessage?: string;
  totalCost: number;
  startTime: number;
}
```

#### B. Recovery Data Storage
- Store checkpoint in `crash_recovery_data` after each simulation
- Update checkpoint after each negotiation round
- Persist queue state in `simulation_queue.crash_recovery_checkpoint`

### 2. Recovery Mechanisms

#### A. Browser Crash Recovery
```typescript
// Store in localStorage for browser recovery
class SimulationRecovery {
  static saveCheckpoint(checkpoint: SimulationCheckpoint) {
    localStorage.setItem(`simulation_${checkpoint.queueId}`, JSON.stringify(checkpoint));
    // Also save to database
    this.persistToDatabase(checkpoint);
  }
  
  static recoverFromCrash(negotiationId: string): SimulationCheckpoint | null {
    // Check localStorage first, then database
    const localData = localStorage.getItem(`simulation_${negotiationId}`);
    if (localData) return JSON.parse(localData);
    
    return this.loadFromDatabase(negotiationId);
  }
}
```

#### B. Server Crash Recovery
```typescript
// Background job to detect and recover orphaned simulations
class SimulationOrphanRecovery {
  static async findOrphanedSimulations() {
    return db.select()
      .from(simulationRuns)
      .where(
        and(
          eq(simulationRuns.status, 'running'),
          lt(simulationRuns.startedAt, new Date(Date.now() - 5 * 60 * 1000)) // >5 min ago
        )
      );
  }
  
  static async recoverOrphanedSimulation(simulationId: string) {
    const simulation = await this.loadSimulation(simulationId);
    if (simulation.crash_recovery_data) {
      // Resume from last checkpoint
      await this.resumeFromCheckpoint(simulation);
    } else {
      // Mark as failed and reschedule
      await this.rescheduleSimulation(simulationId);
    }
  }
}
```

### 3. Recovery UI

#### A. Recovery Detection
```
┌─────────────────────────────────────────────────────────────────┐
│ 🔄 Recovery Detected                                            │
│ ─────────────────────────────────────────────────────────────── │
│ We found an interrupted simulation session:                     │
│ • 8 simulations completed                                       │
│ • 1 simulation was running (Round 4/6)                         │
│ • 16 simulations pending                                        │
│                                                                 │
│ [🔄 Resume from checkpoint] [🗑️ Start fresh] [📊 View results]  │
└─────────────────────────────────────────────────────────────────┘
```

## API Endpoints

### 1. Queue Management
```typescript
// POST /api/simulations/queue/:negotiationId
interface CreateQueueRequest {
  techniques: string[];        // Technique IDs
  tactics: string[];          // Tactic IDs  
  personalities: string[];    // Personality type IDs
  zopaDistances: number[];    // Distance multipliers
}

// GET /api/simulations/queue/:negotiationId
interface QueueStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  totalSimulations: number;
  completedCount: number;
  failedCount: number;
  estimatedTimeRemaining: number;
  currentSimulation?: SimulationRun;
}

// POST /api/simulations/queue/:queueId/execute
interface ExecuteRequest {
  mode: 'next' | 'all';
  maxConcurrent?: number;
}

// POST /api/simulations/queue/:queueId/pause
// POST /api/simulations/queue/:queueId/resume
// POST /api/simulations/queue/:queueId/stop
```

### 2. Real-time Updates
```typescript
// WebSocket events
interface SimulationEvents {
  'simulation.started': { simulationId: string; technique: string; tactic: string };
  'simulation.round': { simulationId: string; round: number; message: string };
  'simulation.completed': { simulationId: string; outcome: string; results: any };
  'simulation.failed': { simulationId: string; error: string; retryCount: number };
  'queue.progress': { completedCount: number; totalCount: number; percentage: number };
  'queue.paused': { reason: string };
  'queue.resumed': { checkpoint: SimulationCheckpoint };
}
```

### 3. Recovery
```typescript
// GET /api/simulations/recovery/:negotiationId
interface RecoveryData {
  hasRecoverableSession: boolean;
  checkpoint?: SimulationCheckpoint;
  orphanedSimulations: string[];
  recommendedAction: 'resume' | 'restart' | 'manual';
}

// POST /api/simulations/recovery/:negotiationId/resume
interface ResumeRequest {
  checkpointId: string;
  skipOrphaned?: boolean;
}
```

## Implementation Strategy

### Phase 1: Core Queue System (2 days)
1. **Database Schema**: Add enhanced simulation_runs and simulation_queue tables
2. **Queue API**: Create queue management endpoints  
3. **Basic UI**: Simulation monitor page with queue display
4. **Integration**: Connect with existing archive version of the production negotiation engine (`docs/archive/negotiation-engine-production.ts`)

### Phase 2: Execution Engine (1.5 days)
1. **Queue Processor**: Background job to execute simulations sequentially
2. **Real-time Updates**: WebSocket integration for live progress
3. **Error Handling**: Retry logic and failure management
4. **Cost Tracking**: OpenAI API cost monitoring

### Phase 3: Crash Recovery (1 day)
1. **Checkpoint System**: State persistence at key points
2. **Recovery Detection**: Startup recovery checks
3. **Recovery UI**: User interface for recovery options
4. **Testing**: Simulate crashes and validate recovery

### Phase 4: Visualization & Polish (1.5 days)
1. **Results Table**: Enhanced simulation results display
2. **Real-time Monitoring**: Current execution status
3. **Progress Indicators**: Visual progress tracking
4. **Export Features**: Results export functionality

## Error Scenarios & Solutions

### 1. Browser Crash/Close
- **Detection**: Page load checks localStorage + database
- **Recovery**: Resume from last checkpoint with user confirmation
- **UI**: Recovery modal with progress summary

### 2. Server Crash/Restart
- **Detection**: Background job finds orphaned "running" simulations
- **Recovery**: Resume from crash_recovery_data or mark as failed
- **Notification**: User sees recovery status on next visit

### 3. API Failures (OpenAI/Langfuse)
- **Detection**: HTTP timeouts, rate limits, authentication errors
- **Recovery**: Exponential backoff retry with max attempts
- **UI**: Show error details and retry options

### 4. Database Disconnection
- **Detection**: Database connection monitoring
- **Recovery**: Queue local checkpoints, sync when reconnected
- **Fallback**: Store critical state in localStorage temporarily

### 5. Network Interruption
- **Detection**: WebSocket disconnect, API failures
- **Recovery**: Automatic reconnection with state sync
- **UI**: Offline indicator with manual refresh option

## Success Metrics

### Reliability Metrics
- Recovery success rate: >95% for all crash scenarios
- Data loss incidents: 0 (all progress preserved)
- Recovery time: <30 seconds for typical scenarios

### Performance Metrics
- Queue processing efficiency: <5% overhead for monitoring
- Real-time update latency: <500ms
- UI responsiveness: No blocking during execution

### User Experience
- Recovery clarity: Users understand recovery options
- Progress visibility: Clear status at all times
- Control granularity: Start/stop/pause as needed

## Technical Dependencies

### Required Packages
```json
{
  "ws": "^8.14.0",              // WebSocket server
  "node-cron": "^3.0.2",       // Background recovery jobs  
  "recharts": "^2.8.0",        // Visualization components
  "react-query": "^3.39.0",    // Real-time data fetching
  "@radix-ui/react-progress": "^1.0.3" // Progress components
}
```

### Environment Variables
```bash
SIMULATION_MAX_CONCURRENT=3         # Parallel execution limit
SIMULATION_CHECKPOINT_INTERVAL=30   # Seconds between checkpoints  
SIMULATION_RETRY_DELAY=5000         # MS delay between retries
RECOVERY_JOB_INTERVAL=300           # Seconds between recovery scans
```

This comprehensive plan ensures robust simulation execution with enterprise-grade reliability and recovery mechanisms.
