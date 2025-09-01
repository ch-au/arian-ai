# ARIAN Platform Architecture

## 🏗️ System Overview

ARIAN is a comprehensive AI-powered negotiation simulation platform built with modern full-stack technologies. The system enables automated negotiations between AI agents with configurable personalities, tactics, and ZOPA boundaries.

## 📁 Project Structure

```
arian-ai/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Route components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utility functions
│   └── index.html
├── server/                # Express.js backend
│   ├── services/          # Business logic services
│   ├── config/           # Configuration files
│   ├── api/              # API route handlers
│   ├── routes.ts         # Main routing
│   └── index.ts          # Server entry point
├── shared/               # Shared types and schemas
├── scripts/              # Utility scripts and microservices
│   ├── run_production_negotiation.py  # Python AI service
│   ├── setup.sh          # Environment setup
│   ├── start.sh          # Quick start script
│   └── test.sh           # Test runner
├── tests/                # Test files
├── docs/                 # Technical documentation
├── data/                 # CSV data files
└── attached_assets/      # Media files
```

## 🔧 Technology Stack

### Frontend (client/)
- **React 18** with TypeScript
- **Vite** - Fast build tool and dev server
- **Wouter** - Lightweight router (3kB vs React Router 70kB)
- **TanStack Query** - Server state management
- **Shadcn/ui + Radix UI** - Component library
- **Tailwind CSS** - Utility-first styling
- **WebSocket** - Real-time communication

### Backend (server/)
- **Express.js** with TypeScript
- **PostgreSQL + Drizzle ORM** - Database layer
- **Neon** - Serverless PostgreSQL hosting
- **WebSocket Server** - Real-time updates
- **Session Management** - Express sessions

### AI Services (scripts/)
- **Python Microservice** - OpenAI Agents integration
- **OpenAI API** - GPT-4o for agent intelligence
- **Langfuse** - AI observability and tracing
- **Logfire** - OpenTelemetry instrumentation

## 🗄️ Database Schema

### Core Entities

#### negotiations
Master records for negotiation configurations
- Metadata: title, type, relationship context
- Configuration: selected techniques, tactics, personalities
- ZOPA settings and dimension boundaries
- Status tracking and execution control

#### simulation_runs
Individual negotiation executions testing technique-tactic combinations
- Links to parent negotiation via `queueId` and `negotiationId`
- Specific technique/tactic pair being tested (`techniqueId`, `tacticId`)
- Agent personality configurations (`personalityId`, `zopaDistance`)
- Execution results and metrics (`dimensionResults`, `totalRounds`, `actualCost`)
- Complete conversation logs (`conversationLog` as JSON)
- **Status Model**:
  - `pending`: Ready to execute
  - `running`: Currently executing
  - `completed`: Successfully finished with deal accepted
  - `failed`: Finished but no deal reached (negotiation terminated/rejected)
  - `timeout`: Finished due to time/round limits
- **Analytics Processing**: All non-pending statuses are considered "finished" simulations

#### negotiation_rounds
Turn-by-turn conversation tracking
- Individual messages and proposals
- Token usage and timing
- Agent decision context

#### negotiation_dimensions
Flexible parameter system for negotiations
- Dynamic dimension definitions (price, timeline, etc.)
- Min/max/target boundaries per dimension
- Priority weighting (1=critical, 2=important, 3=flexible)

### Reference Data

#### influencing_techniques (10 techniques)
Psychological influence methods like Social Proof, Authority, Reciprocity

#### negotiation_tactics (44 tactics)  
Strategic approaches like Anchoring, Good Cop/Bad Cop, Deadline Pressure

#### personality_types
Big Five personality trait configurations for realistic agent behavior

## 🔄 System Flow

### 1. Configuration Phase
1. **Basic Setup**: User defines negotiation context and parameters
2. **Dimension Config**: Set negotiable parameters with boundaries and priorities
3. **Strategy Selection**: Choose psychological techniques and tactical approaches
4. **Agent Setup**: Configure counterpart personality and ZOPA distance

### 2. Execution Phase
1. **Combinatorial Generation**: Create N×M simulation runs for each technique-tactic combination
2. **AI Agent Orchestration**: Initialize GPT-4o agents with configured personalities and prompts
3. **Real-time Negotiation**: Agents negotiate autonomously with live WebSocket updates
4. **Langfuse Tracing**: Complete observability of LLM calls, prompts, and responses

### 3. Analysis Phase
1. **Results Aggregation**: Collect outcomes across all simulation runs
2. **Performance Metrics**: Calculate success rates, cost analysis, technique effectiveness
3. **Pattern Recognition**: Identify winning combinations and optimization opportunities
4. **Status-Based Analytics**: 
   - **Success Rate**: `completed` simulations / total finished simulations
   - **Completion Rate**: All finished simulations / total simulations
   - **Cost Analysis**: Aggregate `actualCost` across all simulations
   - **Deal Analysis**: Average deal values from `dimensionResults.Price` (completed only)
   - **Performance Tracking**: Round counts, duration, and efficiency metrics

## 🚀 Microservice Architecture

### TypeScript Services (server/services/)
- **negotiation-engine.ts** - Core orchestration logic
- **python-negotiation-service.ts** - Python microservice integration
- **simulation-queue.ts** - Execution queue management and status tracking
  - Queue creation with combinatorial simulation generation
  - Sequential execution with crash recovery
  - Real-time WebSocket broadcasting
  - Status management (`pending` → `running` → `completed/failed/timeout`)
  - Results aggregation and cost tracking
- **openai.ts** - Direct OpenAI integration (legacy)
- **langfuse.ts** - Tracing and observability

### Python Microservice (scripts/)
- **run_production_negotiation.py** - OpenAI Agents implementation
- Langfuse integration with prompt linking
- Structured output handling and error recovery
- Token usage tracking and cost calculation

## 🔌 Integration Patterns

### WebSocket Communication
Real-time bidirectional communication for:
- Live negotiation progress updates
- Simulation queue status
- System performance metrics
- Error notifications and recovery

### Database Transaction Management
- Atomic simulation run creation
- Consistent ZOPA validation
- Proper foreign key relationships
- Cascade delete handling

### AI Service Integration
- Hybrid TypeScript/Python architecture
- Structured JSON communication
- Comprehensive error handling
- Graceful degradation with mock data

## 🛡️ Security & Performance

### Security Measures
- Environment-based configuration
- Secure API key management
- Input validation and sanitization
- SQL injection prevention via ORM

### Performance Optimizations
- Database connection pooling
- WebSocket connection management
- Efficient query patterns
- Background job processing

### Monitoring & Observability
- Langfuse AI call tracing
- Application performance monitoring
- Error tracking and alerting
- Cost optimization tracking

## 🔧 Development Workflow

### Local Development
```bash
npm run dev           # Start both frontend and backend
npm run dev:client    # Frontend only (port 5173)  
npm run dev:server    # Backend only (port 3000)
```

### Testing
```bash
npm run test         # Run test suite
npm run check        # TypeScript type checking
./scripts/test.sh    # Integration tests
```

### Database Management
```bash
npm run db:push      # Deploy schema changes
npm run db:seed      # Populate test data
```

This architecture provides a scalable, maintainable foundation for AI-powered negotiation simulation with clear separation of concerns and modern development practices.