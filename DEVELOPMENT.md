# Development Guide

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** 
- **PostgreSQL database** (or Neon account)
- **OpenAI API key**
- **Python 3.11+** (for AI microservice)

### Environment Setup

1. **Clone and Install**
```bash
git clone <repository-url>
cd arian-ai
npm install
```

2. **Environment Configuration**
Create `.env` file:
```env
# Database (Required)
DATABASE_URL="postgresql://user:pass@host:port/db?sslmode=require"

# OpenAI (Required for AI features)
OPENAI_API_KEY="sk-..."

# Langfuse (Optional - for AI tracing)
LANGFUSE_PUBLIC_KEY="pk-lf-..."
LANGFUSE_SECRET_KEY="sk-lf-..."
LANGFUSE_HOST="https://cloud.langfuse.com"

# Development
NODE_ENV=development
PORT=3000
```

3. **Database Setup**
```bash
npm run db:push      # Deploy schema
npm run db:seed      # Add sample data
```

4. **Python Dependencies** (for AI microservice)
```bash
pip install agents langfuse python-dotenv logfire pydantic
```

### Development Commands

```bash
# Full development (recommended)
npm run dev              # Both frontend (5173) + backend (3000)

# Individual services
npm run dev:client       # Frontend only
npm run dev:server       # Backend only  

# Database operations
npm run db:push          # Deploy schema changes
npm run db:seed          # Populate test data

# Quality assurance
npm run test             # Run test suite
npm run check            # TypeScript type checking

# Production build
npm run build            # Build for deployment
npm run start            # Start production server
```

## 🏗️ Development Workflow

### 1. Feature Development
1. **Database Changes**: Update `shared/schema.ts` if needed
2. **Backend Logic**: Add services in `server/services/`
3. **API Routes**: Update `server/routes.ts`
4. **Frontend Components**: Add to `client/src/components/`
5. **Pages**: Create routes in `client/src/pages/`

### 2. Testing Strategy
- **Unit Tests**: Place in `tests/` directory
- **Integration Tests**: Use `scripts/test.sh`
- **Manual Testing**: Use dashboard at `http://localhost:5173`

### 3. Code Quality
- **TypeScript**: Strict type checking enabled
- **ESLint/Prettier**: Follow established patterns
- **Database**: Use Drizzle ORM, no raw SQL
- **Error Handling**: Comprehensive try-catch blocks

## 🔧 Architecture Patterns

### Frontend Patterns

#### Component Structure
```typescript
// client/src/components/example.tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface ExampleProps {
  title: string
  onAction: () => void
}

export function Example({ title, onAction }: ExampleProps) {
  const [loading, setLoading] = useState(false)
  
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      <Button onClick={onAction} disabled={loading}>
        {loading ? 'Processing...' : 'Action'}
      </Button>
    </div>
  )
}
```

#### API Integration
```typescript
// client/src/hooks/use-negotiations.ts
import { useQuery } from '@tanstack/react-query'

export function useNegotiations() {
  return useQuery({
    queryKey: ['negotiations'],
    queryFn: async () => {
      const response = await fetch('/api/negotiations')
      if (!response.ok) throw new Error('Failed to fetch')
      return response.json()
    }
  })
}
```

### Backend Patterns

#### Service Layer
```typescript
// server/services/example-service.ts
import { db } from '../db.js'
import { negotiations } from '../../shared/schema.js'

export class ExampleService {
  static async createNegotiation(data: CreateNegotiationData) {
    try {
      const [negotiation] = await db
        .insert(negotiations)
        .values(data)
        .returning()
      
      return negotiation
    } catch (error) {
      throw new Error(`Failed to create negotiation: ${error.message}`)
    }
  }
}
```

#### Route Handlers
```typescript
// server/routes.ts
app.post('/api/negotiations', async (req, res) => {
  try {
    const negotiation = await ExampleService.createNegotiation(req.body)
    res.json(negotiation)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
```

### Database Patterns

#### Schema Definition
```typescript
// shared/schema.ts
export const negotiations = pgTable('negotiations', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  status: text('status').notNull().default('configured'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})
```

#### Query Examples
```typescript
// Complex queries with relations
const negotiationWithRuns = await db
  .select()
  .from(negotiations)
  .leftJoin(simulationRuns, eq(negotiations.id, simulationRuns.negotiationId))
  .where(eq(negotiations.id, negotiationId))
```

## 🤖 AI Integration

### Python Microservice

The AI negotiation engine is implemented in Python using OpenAI Agents:

```python
# scripts/run_production_negotiation.py
from agents import Agent, Runner, SQLiteSession
from langfuse import Langfuse

# Agent configuration with Langfuse tracing
agent = Agent(
    name="Negotiation Agent",
    instructions=system_prompt,
    model="gpt-4o"
)

# Execution with tracing
result = await Runner.run(agent, user_message, session=session)
```

### Langfuse Integration

All AI calls are traced with full observability:

```python
# Trace creation with prompt linking
trace = langfuse.trace(
    name="negotiation_execution",
    metadata={"negotiation_id": nego_id}
)

# Generation with prompt linking
generation = trace.generation(
    name="agent_response",
    model="gpt-4o",
    input=messages,
    prompt=langfuse_prompt,  # Links to managed prompt
    output=response
)
```

## 🔄 WebSocket Implementation

### Server Side
```typescript
// server/index.ts
import { WebSocketServer } from 'ws'

const wss = new WebSocketServer({ port: 8080 })

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    // Handle incoming messages
  })
  
  // Broadcast updates
  wss.clients.forEach(client => {
    client.send(JSON.stringify(update))
  })
})
```

### Client Side
```typescript
// client/src/hooks/use-websocket.ts
export function useWebSocket() {
  const [socket, setSocket] = useState<WebSocket | null>(null)
  
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080')
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      // Handle real-time updates
    }
    setSocket(ws)
    
    return () => ws.close()
  }, [])
}
```

## 📊 Performance Considerations

### Database Optimization
- **Indexes**: Critical foreign keys and query columns
- **Connection Pooling**: Managed by Drizzle
- **Query Optimization**: Use joins instead of N+1 queries
- **Pagination**: Implement for large result sets

### Frontend Optimization
- **Code Splitting**: Use React.lazy for routes
- **Caching**: TanStack Query handles server state
- **Bundle Size**: Monitor with build analyzer
- **WebSocket Cleanup**: Proper connection management

### AI Service Optimization
- **Token Management**: Track and optimize prompt sizes
- **Cost Monitoring**: Langfuse provides usage analytics
- **Error Recovery**: Graceful degradation patterns
- **Rate Limiting**: Respect OpenAI API limits

## 🐛 Debugging Guide

### Common Issues

1. **Database Connection Errors**
   - Check `DATABASE_URL` format
   - Verify network connectivity
   - Confirm schema is pushed

2. **WebSocket Connection Failures**
   - Check port availability
   - Verify CORS settings
   - Monitor network requests

3. **AI Service Errors**
   - Validate OpenAI API key
   - Check Python dependencies
   - Review Langfuse configuration

4. **Simulation Statistics Showing Zeros**
   - **Root Cause**: Analytics counting only `'completed'` status, missing `'failed'`/`'timeout'`
   - **Fix**: Include all finished simulations in analytics calculations
   - **Debug**: Check `simulationResults` array in browser console for status distribution
   - **Files**: `client/src/components/dashboard/simulation-analytics.tsx`

5. **"Run Next" Buttons Not Visible**
   - **Root Cause**: Button visibility based on `queueStatus.status === 'completed'`
   - **Fix**: Base visibility on actual pending simulations count
   - **Logic**: `(queueStatus.completedCount + queueStatus.failedCount < queueStatus.totalSimulations)`
   - **Files**: `client/src/pages/simulation-monitor.tsx`

6. **Queue Status vs Actual Progress Mismatch**
   - **Root Cause**: Queue marked 'completed' when no pending simulations found
   - **Debug**: Check actual simulation counts vs queue status
   - **Monitor**: Queue status transitions and simulation run statuses
   - **Files**: `server/services/simulation-queue.ts`

### Logging Patterns

```typescript
// Structured logging
console.log(`[${service}] ${operation}:`, {
  userId,
  negotiationId,
  status,
  timestamp: new Date().toISOString()
})

// Simulation Queue Debugging
console.log('📊 Queue status received:', {
  status: data.data.status,
  total: data.data.totalSimulations,
  completed: data.data.completedCount,
  failed: data.data.failedCount,
  pending: data.data.totalSimulations - data.data.completedCount - data.data.failedCount
});

// Simulation Results Debugging  
console.log('📈 Simulation results received:', {
  count: data.data.length,
  statuses: data.data.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {})
});
```

### Data Model Validation

```typescript
// Verify simulation status consistency
const validateSimulationData = (results) => {
  const statusCounts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  
  console.log('Status distribution:', statusCounts);
  console.log('Finished simulations:', results.filter(r => 
    ['completed', 'failed', 'timeout'].includes(r.status)
  ).length);
};
```

### Debug Tools
- **Database**: Drizzle Studio at `npm run db:studio`
- **API Testing**: Use REST client or curl
- **WebSocket Testing**: Browser developer tools
- **AI Tracing**: Langfuse dashboard

## 🚀 Deployment

### Environment Preparation
1. **Production Database**: Set up PostgreSQL instance
2. **Environment Variables**: Configure all required vars
3. **Dependencies**: Install production dependencies

### Build Process
```bash
npm run build        # Creates optimized build
npm run start        # Starts production server
```

### Health Checks
- **API Endpoint**: `GET /api/system/status`
- **Database**: Connection pool status
- **WebSocket**: Connection count
- **AI Service**: Python process health

This guide provides the foundation for effective development on the ARIAN platform. Follow these patterns and practices for consistent, maintainable code.