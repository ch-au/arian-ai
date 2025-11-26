# ARIAN AI - Security Hardening & Production Readiness Plan

**Created:** November 2025
**Priority:** Critical
**Estimated Effort:** 4-5 weeks

---

## Table of Contents

1. [Phase 1: Secrets & Git Hygiene](#phase-1-secrets--git-hygiene-week-1)
2. [Phase 2: API Security](#phase-2-api-security-week-1-2)
3. [Phase 3: Authentication Hardening](#phase-3-authentication-hardening-week-2)
4. [Phase 4: Database Optimization](#phase-4-database-optimization-week-2-3)
5. [Phase 5: LLM Reliability](#phase-5-llm-reliability-week-3)
6. [Phase 6: Architecture Refactoring](#phase-6-architecture-refactoring-week-3-4)
7. [Phase 7: Testing & Monitoring](#phase-7-testing--monitoring-week-4-5)
8. [Package Summary](#package-summary)

---

## Phase 1: Secrets & Git Hygiene (Week 1)

### 1.1 Remove `.env` from Git History

**Problem:** `.env` file with secrets exists in git history (GitHub/GitLab)

**Solution:** Use BFG Repo-Cleaner (faster than `git filter-branch`)

```bash
# Step 1: Install BFG
brew install bfg  # macOS
# or download from https://rtyley.github.io/bfg-repo-cleaner/

# Step 2: Clone a fresh mirror
git clone --mirror git@github.com:ch-au/arian-ai.git arian-ai-mirror

# Step 3: Remove .env from all history
cd arian-ai-mirror
bfg --delete-files .env

# Step 4: Clean up and verify
git reflog expire --expire=now --all && git gc --prune=now --aggressive

# Step 5: Force push (coordinate with team!)
git push --force

# Step 6: All team members must re-clone
# Old clones still contain secrets!
```

**For GitLab:** Same process, but also:
```bash
# Clear GitLab's cache
# Go to: Settings > Repository > Repository cleanup
# Upload the commit-map from BFG output
```

### 1.2 Prevent Future `.env` Commits

**File:** `.gitignore` (verify/update)

```gitignore
# Environment files - NEVER commit
.env
.env.*
.env.local
.env.*.local
!.env.example

# Additional sensitive files
*.pem
*.key
credentials.json
secrets.yaml
```

**File:** `.env.example` (create template)

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Authentication
JWT_SECRET=generate-a-secure-random-string-here

# OpenAI
OPENAI_API_KEY=sk-proj-your-key-here

# Gemini
GEMINI_API_KEY=your-gemini-key

# OpenRouter (optional)
OPENROUTER_API_KEY=sk-or-your-key

# Langfuse Observability
LANGFUSE_SECRET_KEY=sk-lf-your-key
LANGFUSE_PUBLIC_KEY=pk-lf-your-key
LANGFUSE_HOST=https://cloud.langfuse.com

# Stack Auth (optional)
VITE_STACK_PROJECT_ID=your-project-id
STACK_SECRET_SERVER_KEY=ssk_your-key

# Model Configuration
NEGOTIATION_MODEL=gemini/gemini-flash-lite-latest
LITELLM_MODEL=gpt-4o-mini

# Logging
PYTHON_LOG_LEVEL=INFO
```

### 1.3 Add Git Pre-Commit Hook

**File:** `.husky/pre-commit` (or manual `.git/hooks/pre-commit`)

```bash
#!/bin/sh

# Check for .env files being committed
if git diff --cached --name-only | grep -E '^\.env'; then
    echo "ERROR: Attempting to commit .env file!"
    echo "Remove it from staging: git reset HEAD .env"
    exit 1
fi

# Check for potential secrets in staged files
SECRETS_PATTERN='(sk-proj-|sk-or-|AIzaSy|sk-lf-|ssk_|npg_)'
if git diff --cached | grep -E "$SECRETS_PATTERN"; then
    echo "WARNING: Potential secrets detected in staged changes!"
    echo "Please review your changes carefully."
    # Uncomment to block commit:
    # exit 1
fi

exit 0
```

**Setup with Husky:**

```bash
npm install -D husky
npx husky init
# Copy the pre-commit script above to .husky/pre-commit
chmod +x .husky/pre-commit
```

### 1.4 Add Secret Scanning to CI/CD

**File:** `.github/workflows/security.yml`

```yaml
name: Security Checks

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: TruffleHog Secret Scan
        uses: trufflesecurity/trufflehog@main
        with:
          extra_args: --only-verified

      - name: Gitleaks Scan
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Phase 2: API Security (Week 1-2)

### 2.1 Install Security Packages

```bash
npm install helmet cors express-rate-limit
npm install -D @types/cors
```

### 2.2 Implement Security Middleware

**File:** `server/middleware/security.ts` (new file)

```typescript
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Express, Request, Response, NextFunction } from 'express';

// CORS Configuration
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'https://your-production-domain.com',
    ];

    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400, // 24 hours
};

// Rate Limiting - General API
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate Limiting - Auth endpoints (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Rate Limiting - Simulation endpoints (expensive operations)
const simulationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 simulation batches per hour
  message: { error: 'Simulation rate limit exceeded. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Request size limiting
const requestSizeLimiter = (maxSize: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const maxBytes = parseSize(maxSize);

    if (contentLength > maxBytes) {
      return res.status(413).json({ error: 'Request entity too large' });
    }
    next();
  };
};

function parseSize(size: string): number {
  const units: Record<string, number> = { b: 1, kb: 1024, mb: 1024 * 1024 };
  const match = size.toLowerCase().match(/^(\d+)(b|kb|mb)$/);
  if (!match) return 1024 * 1024; // Default 1MB
  return parseInt(match[1], 10) * units[match[2]];
}

// Apply all security middleware
export function applySecurityMiddleware(app: Express): void {
  // Helmet - Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "https://api.openai.com", "https://cloud.langfuse.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false, // May need adjustment for your use case
  }));

  // CORS
  app.use(cors(corsOptions));

  // General rate limiting
  app.use('/api/', generalLimiter);

  // Stricter rate limiting for auth
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);

  // Simulation rate limiting
  app.use('/api/simulations/queue', simulationLimiter);
  app.use('/api/simulations/execute', simulationLimiter);

  // Request size limits
  app.use('/api/', requestSizeLimiter('5mb'));
}

export { authLimiter, simulationLimiter, generalLimiter };
```

### 2.3 Update Server Entry Point

**File:** `server/index.ts` (modify)

```typescript
import express from 'express';
import { applySecurityMiddleware } from './middleware/security';
// ... other imports

const app = express();

// Apply security middleware FIRST (before other middleware)
applySecurityMiddleware(app);

// Then body parsing
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ... rest of your routes
```

### 2.4 WebSocket Authentication

**File:** `server/services/negotiation-engine.ts` (modify)

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from './auth';
import { IncomingMessage } from 'http';
import { parse as parseUrl } from 'url';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  isAuthenticated: boolean;
}

export function setupWebSocket(server: any) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    verifyClient: async (info, callback) => {
      try {
        const url = parseUrl(info.req.url || '', true);
        const token = url.query.token as string;

        if (!token) {
          callback(false, 401, 'Authentication required');
          return;
        }

        const payload = await verifyToken(token);
        if (!payload) {
          callback(false, 401, 'Invalid token');
          return;
        }

        // Attach user info to the request for later use
        (info.req as any).userId = payload.userId;
        callback(true);
      } catch (error) {
        callback(false, 401, 'Authentication failed');
      }
    }
  });

  wss.on('connection', (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
    ws.userId = (req as any).userId;
    ws.isAuthenticated = true;

    // Subscribe to user-specific events only
    // ... rest of connection handling
  });

  return wss;
}
```

---

## Phase 3: Authentication Hardening (Week 2)

### 3.1 Move JWT to HttpOnly Cookies

**File:** `server/services/auth.ts` (modify)

```typescript
import { Response } from 'express';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 4 * 60 * 60 * 1000, // 4 hours (reduced from 7 days)
  path: '/',
};

export function setAuthCookie(res: Response, token: string): void {
  res.cookie('auth_token', token, COOKIE_OPTIONS);
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie('auth_token', COOKIE_OPTIONS);
}

// Update login endpoint to use cookies
export async function login(username: string, password: string, res: Response) {
  // ... existing validation logic

  const token = jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '4h' } // Reduced from 7d
  );

  setAuthCookie(res, token);

  return {
    success: true,
    user: { id: user.id, username: user.username }
    // Don't return token in body anymore
  };
}
```

### 3.2 Implement Refresh Tokens

**File:** `server/services/refresh-token.ts` (new file)

```typescript
import crypto from 'crypto';
import { db } from '../db';

interface RefreshToken {
  token: string;
  userId: number;
  expiresAt: Date;
  createdAt: Date;
}

// Store refresh tokens in database (add table to schema)
export async function createRefreshToken(userId: number): Promise<string> {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Store in database
  await db.insert(refreshTokens).values({
    token: hashToken(token),
    userId,
    expiresAt,
  });

  return token;
}

export async function validateRefreshToken(token: string): Promise<number | null> {
  const hashedToken = hashToken(token);

  const [stored] = await db.select()
    .from(refreshTokens)
    .where(eq(refreshTokens.token, hashedToken));

  if (!stored || stored.expiresAt < new Date()) {
    return null;
  }

  return stored.userId;
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const hashedToken = hashToken(token);
  await db.delete(refreshTokens).where(eq(refreshTokens.token, hashedToken));
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
```

### 3.3 Add Cookie Parser

```bash
npm install cookie-parser
npm install -D @types/cookie-parser
```

**Update `server/index.ts`:**

```typescript
import cookieParser from 'cookie-parser';

app.use(cookieParser());
```

### 3.4 Update Auth Middleware

**File:** `server/middleware/auth.ts` (modify)

```typescript
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Check cookie first, then Authorization header (for API clients)
  const token = req.cookies?.auth_token ||
                req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = await verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    (req as any).user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}
```

---

## Phase 4: Database Optimization (Week 2-3)

### 4.1 Add Missing Indexes

**File:** `migrations/0006_add_performance_indexes.sql` (new migration)

```sql
-- Critical indexes for common query patterns

-- Negotiations: User dashboard queries
CREATE INDEX IF NOT EXISTS idx_negotiations_user_status
ON negotiations(user_id, status);

CREATE INDEX IF NOT EXISTS idx_negotiations_user_started
ON negotiations(user_id, started_at DESC);

-- Simulation Queue: Queue processing
CREATE INDEX IF NOT EXISTS idx_simulation_queue_negotiation_status
ON simulation_queue(negotiation_id, status);

CREATE INDEX IF NOT EXISTS idx_simulation_queue_status_created
ON simulation_queue(status, created_at);

-- Simulation Runs: Run lookups and analytics
CREATE INDEX IF NOT EXISTS idx_simulation_runs_negotiation_status
ON simulation_runs(negotiation_id, status);

CREATE INDEX IF NOT EXISTS idx_simulation_runs_queue_status
ON simulation_runs(queue_id, status);

CREATE INDEX IF NOT EXISTS idx_simulation_runs_completed_at
ON simulation_runs(completed_at DESC)
WHERE completed_at IS NOT NULL;

-- Master data: Registration-scoped queries
CREATE INDEX IF NOT EXISTS idx_counterparts_registration
ON counterparts(registration_id);

CREATE INDEX IF NOT EXISTS idx_markets_registration
ON markets(registration_id);

CREATE INDEX IF NOT EXISTS idx_products_registration
ON products(registration_id);

CREATE INDEX IF NOT EXISTS idx_dimensions_registration
ON dimensions(registration_id);
```

**Run migration:**

```bash
npm run db:push
# Or if using migration files:
npx drizzle-kit generate
npx drizzle-kit migrate
```

### 4.2 Fix N+1 Query in Analytics

**File:** `server/services/analytics.ts` (modify)

```typescript
// BEFORE: 30 queries for 30 days
// async function getSuccessRateTrends(days: number) {
//   for (let i = 0; i < days; i++) { ... }
// }

// AFTER: Single aggregated query
export async function getSuccessRateTrends(days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const results = await db.execute(sql`
    SELECT
      DATE_TRUNC('day', completed_at) as day,
      COUNT(*)::int as total,
      SUM(CASE WHEN deal_accepted = true THEN 1 ELSE 0 END)::int as successful
    FROM simulation_runs
    WHERE completed_at >= ${startDate}
      AND status = 'completed'
    GROUP BY DATE_TRUNC('day', completed_at)
    ORDER BY day ASC
  `);

  // Fill in missing days with zeros
  const trendsMap = new Map(
    results.rows.map((r: any) => [
      new Date(r.day).toISOString().split('T')[0],
      { total: r.total, successful: r.successful }
    ])
  );

  const trends = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];
    const data = trendsMap.get(dateKey) || { total: 0, successful: 0 };
    trends.push({
      date: dateKey,
      total: data.total,
      successful: data.successful,
      rate: data.total > 0 ? (data.successful / data.total) * 100 : 0
    });
  }

  return trends;
}
```

### 4.3 Add Refresh Tokens Table

**File:** `shared/schema.ts` (add to existing)

```typescript
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(), // Hashed token
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_refresh_tokens_user").on(table.userId),
  expiresAtIdx: index("idx_refresh_tokens_expires").on(table.expiresAt),
}));
```

---

## Phase 5: LLM Reliability (Week 3)

### 5.1 Install Retry Package

```bash
npm install p-retry
```

### 5.2 Implement Retry Logic for Python Service

**File:** `server/services/python-negotiation-service.ts` (modify)

```typescript
import pRetry from 'p-retry';

interface RetryOptions {
  retries: number;
  minTimeout: number;
  maxTimeout: number;
  factor: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  retries: 3,
  minTimeout: 1000,    // 1 second
  maxTimeout: 30000,   // 30 seconds
  factor: 2,           // Exponential backoff
};

export async function executeNegotiationWithRetry(
  negotiationId: string,
  runId: string,
  options: Partial<RetryOptions> = {}
): Promise<NegotiationResult> {
  const retryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };

  return pRetry(
    async (attemptNumber) => {
      this.log.info({ negotiationId, runId, attempt: attemptNumber },
        `[NEGOTIATION] Attempt ${attemptNumber}/${retryOptions.retries + 1}`);

      try {
        const result = await this.executeNegotiation(negotiationId, runId);
        return result;
      } catch (error: any) {
        // Don't retry on validation errors
        if (error.message?.includes('validation') ||
            error.message?.includes('not found')) {
          throw new pRetry.AbortError(error);
        }

        // Check for rate limit errors
        if (error.message?.includes('429') ||
            error.message?.includes('rate limit')) {
          this.log.warn({ negotiationId, attempt: attemptNumber },
            '[NEGOTIATION] Rate limited, will retry with backoff');
        }

        throw error;
      }
    },
    {
      ...retryOptions,
      onFailedAttempt: (error) => {
        this.log.warn({
          negotiationId,
          runId,
          attempt: error.attemptNumber,
          retriesLeft: error.retriesLeft,
          error: error.message,
        }, `[NEGOTIATION] Attempt ${error.attemptNumber} failed`);
      },
    }
  );
}
```

### 5.3 Add Circuit Breaker

```bash
npm install cockatiel
```

**File:** `server/services/circuit-breaker.ts` (new file)

```typescript
import {
  circuitBreaker,
  handleAll,
  ConsecutiveBreaker,
  ExponentialBackoff,
  retry,
  wrap
} from 'cockatiel';

// Circuit breaker for LLM API calls
export const llmCircuitBreaker = circuitBreaker(handleAll, {
  halfOpenAfter: 30 * 1000, // Try again after 30 seconds
  breaker: new ConsecutiveBreaker(5), // Open after 5 consecutive failures
});

// Retry policy with exponential backoff
export const llmRetryPolicy = retry(handleAll, {
  maxAttempts: 3,
  backoff: new ExponentialBackoff({
    initialDelay: 1000,
    maxDelay: 30000,
    exponent: 2,
  }),
});

// Combined policy: retry with circuit breaker
export const llmPolicy = wrap(llmRetryPolicy, llmCircuitBreaker);

// Usage example:
// const result = await llmPolicy.execute(() => callLLMAPI(params));

// Event listeners for monitoring
llmCircuitBreaker.onBreak(() => {
  console.warn('[CIRCUIT BREAKER] LLM circuit breaker opened');
  // Alert/notify operations team
});

llmCircuitBreaker.onHalfOpen(() => {
  console.info('[CIRCUIT BREAKER] LLM circuit breaker half-open, testing...');
});

llmCircuitBreaker.onReset(() => {
  console.info('[CIRCUIT BREAKER] LLM circuit breaker reset');
});
```

---

## Phase 6: Architecture Refactoring (Week 3-4)

### 6.1 Split Simulation Queue Service

Create new service files to break down the 2,273-line monolith:

**Directory structure:**

```
server/services/simulation/
├── index.ts              # Re-exports
├── queue-manager.ts      # Queue CRUD operations
├── queue-executor.ts     # Execution logic
├── crash-recovery.ts     # Checkpoint handling
├── broadcaster.ts        # WebSocket events
├── cost-tracker.ts       # Cost calculation
└── types.ts              # Shared types
```

**File:** `server/services/simulation/types.ts`

```typescript
export interface SimulationCheckpoint {
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

export interface QueueStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  totalSimulations: number;
  completedCount: number;
  failedCount: number;
  estimatedTimeRemaining: number;
  currentSimulation?: any;
  progressPercentage: number;
  actualCost: number;
  estimatedCost: number;
}

export interface SimulationEvent {
  type: 'simulation_started' | 'simulation_completed' | 'simulation_failed' |
        'simulation_stopped' | 'queue_progress' | 'queue_completed' | 'negotiation_round';
  queueId: string;
  negotiationId: string;
  data: any;
}

export interface CreateQueueRequest {
  negotiationId: string;
  techniques?: string[];
  tactics?: string[];
  personalities?: string[];
}

export interface ExecuteRequest {
  mode: 'next' | 'all';
  maxConcurrent?: number;
}
```

**File:** `server/services/simulation/queue-manager.ts`

```typescript
import { db } from '../../db';
import { simulationQueue, simulationRuns } from '../../../shared/schema';
import { CreateQueueRequest, QueueStatus } from './types';
import { createRequestLogger } from '../logger';

const log = createRequestLogger('service:queue-manager');

export class QueueManager {
  /**
   * Create a new simulation queue
   */
  static async createQueue(request: CreateQueueRequest): Promise<string> {
    // ... extracted queue creation logic
  }

  /**
   * Get queue status
   */
  static async getQueueStatus(queueId: string): Promise<QueueStatus | null> {
    // ... extracted status logic
  }

  /**
   * Get all queues for a negotiation
   */
  static async getQueuesForNegotiation(negotiationId: string): Promise<QueueStatus[]> {
    // ... extracted query logic
  }

  /**
   * Pause a queue
   */
  static async pauseQueue(queueId: string): Promise<void> {
    // ... extracted pause logic
  }

  /**
   * Resume a queue
   */
  static async resumeQueue(queueId: string): Promise<void> {
    // ... extracted resume logic
  }
}
```

### 6.2 Implement Job Queue with Bull

```bash
npm install bull ioredis
npm install -D @types/bull
```

**File:** `server/services/simulation/job-queue.ts` (new file)

```typescript
import Bull from 'bull';
import Redis from 'ioredis';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

// Create Redis client
const redis = new Redis(redisConfig);

// Simulation job queue
export const simulationQueue = new Bull('simulations', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50,      // Keep last 50 failed jobs
  },
});

// Process simulation jobs
simulationQueue.process('run-simulation', async (job) => {
  const { negotiationId, runId, queueId } = job.data;

  // Execute simulation
  const result = await PythonNegotiationService.execute(negotiationId, runId);

  // Update progress
  await job.progress(100);

  return result;
});

// Event handlers
simulationQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed with result:`, result.success);
});

simulationQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});

// Add a simulation to the queue
export async function queueSimulation(
  negotiationId: string,
  runId: string,
  queueId: string,
  priority: number = 0
): Promise<Bull.Job> {
  return simulationQueue.add('run-simulation', {
    negotiationId,
    runId,
    queueId,
  }, {
    priority,
    jobId: runId, // Use runId as job ID to prevent duplicates
  });
}

// Get queue stats
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> {
  const [waiting, active, completed, failed] = await Promise.all([
    simulationQueue.getWaitingCount(),
    simulationQueue.getActiveCount(),
    simulationQueue.getCompletedCount(),
    simulationQueue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}
```

---

## Phase 7: Testing & Monitoring (Week 4-5)

### 7.1 Enable Integration Tests in CI

**File:** `.github/workflows/test.yml`

```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test -- --run --reporter=verbose

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: arian_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run database migrations
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/arian_test
        run: npm run db:push

      - name: Run integration tests
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/arian_test
          TEST_DATABASE_URL: postgresql://test:test@localhost:5432/arian_test
          RUN_DB_TESTS: 'true'
          JWT_SECRET: test-secret-key-for-ci
        run: npm test -- --run --reporter=verbose
```

### 7.2 Add E2E Tests

```bash
npm install -D playwright @playwright/test
npx playwright install
```

**File:** `e2e/auth.spec.ts` (new file)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'testpass');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard');
  });

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'invalid');
    await page.fill('input[name="password"]', 'invalid');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-message')).toBeVisible();
  });
});
```

### 7.3 Add Monitoring/APM

```bash
npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
```

**File:** `server/instrumentation.ts` (new file)

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'arian-ai',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version,
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
});
```

---

## Package Summary

### New Dependencies

```json
{
  "dependencies": {
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.1.5",
    "cookie-parser": "^1.4.6",
    "p-retry": "^6.2.0",
    "cockatiel": "^3.1.2",
    "bull": "^4.12.2",
    "ioredis": "^5.3.2",
    "@opentelemetry/api": "^1.7.0",
    "@opentelemetry/sdk-node": "^0.48.0",
    "@opentelemetry/auto-instrumentations-node": "^0.43.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/cookie-parser": "^1.4.6",
    "@types/bull": "^4.10.0",
    "husky": "^9.0.11",
    "playwright": "^1.41.2",
    "@playwright/test": "^1.41.2"
  }
}
```

### Installation Command

```bash
# Production dependencies
npm install helmet cors express-rate-limit cookie-parser p-retry cockatiel bull ioredis @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node

# Dev dependencies
npm install -D @types/cors @types/cookie-parser @types/bull husky playwright @playwright/test

# Initialize Husky
npx husky init

# Install Playwright browsers
npx playwright install
```

---

## Implementation Checklist

### Phase 1: Secrets & Git Hygiene
- [ ] Run BFG to remove `.env` from history
- [ ] Force push cleaned history
- [ ] Notify team to re-clone
- [x] Create `.env.example` ✅ (2025-11-26)
- [x] Update `.gitignore` ✅ (2025-11-26)
- [x] Set up pre-commit hook with Husky ✅ (2025-11-26)
- [x] Add secret scanning to CI ✅ (2025-11-26)

### Phase 2: API Security
- [x] Install security packages ✅ (2025-11-26)
- [x] Create security middleware ✅ (2025-11-26)
- [x] Apply to server entry point ✅ (2025-11-26)
- [ ] Implement WebSocket authentication
- [ ] Test CORS and rate limiting

### Phase 3: Authentication Hardening
- [x] Move JWT to httpOnly cookies ✅ (2025-11-26)
- [x] Reduce token TTL to 4 hours ✅ (2025-11-26)
- [x] Implement refresh tokens ✅ (2025-11-26)
- [x] Add refresh token table to schema ✅ (2025-11-26)
- [ ] Update frontend auth handling

### Phase 4: Database Optimization
- [x] Create index migration ✅ (2025-11-26)
- [ ] Run migration
- [x] Fix N+1 query in analytics ✅ (2025-11-26)
- [ ] Add dashboard query caching

### Phase 5: LLM Reliability
- [x] Implement retry logic ✅ (2025-11-26)
- [x] Add circuit breaker ✅ (2025-11-26)
- [x] Configure backoff parameters ✅ (2025-11-26)
- [x] Add monitoring for circuit breaker events ✅ (2025-11-26)

### Phase 6: Architecture Refactoring
- [ ] Create simulation service directory
- [ ] Extract types
- [ ] Extract queue manager
- [ ] Extract executor
- [ ] Set up Bull queue (requires Redis)
- [ ] Migrate to job queue

### Phase 7: Testing & Monitoring
- [x] Enable integration tests in CI ✅ (2025-11-26)
- [ ] Add E2E test suite
- [ ] Configure OpenTelemetry
- [ ] Set up monitoring dashboards

---

## Notes

- **Redis Requirement:** Bull queue requires Redis. For development, use Docker: `docker run -d -p 6379:6379 redis`
- **Rollback Plan:** Each phase can be implemented independently. Maintain feature flags if needed.
- **Performance Testing:** After Phase 4, run load tests to verify index improvements.
- **Coordination:** Phase 1 (git history cleanup) requires team coordination - schedule a maintenance window.

---

**Document Version:** 1.0
**Last Updated:** November 2025
