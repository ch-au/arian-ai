# ARIAN - AI Negotiation Platform

An advanced AI-powered negotiation simulation platform that enables automated negotiations between AI agents with configurable personalities, tactics, and ZOPA (Zone of Possible Agreement) boundaries.

## 🚀 Features

- **AI-to-AI Negotiations**: Automated negotiations using OpenAI GPT-4o models
- **Configurable AI Personalities**: Big Five personality traits configuration for realistic agent behavior
- **Influencing Techniques & Tactics**: Database-driven technique and tactic selection for negotiations
- **Real-time Monitoring**: WebSocket-based live negotiation updates
- **Combinatorial Testing**: Test multiple technique-tactic combinations automatically
- **ZOPA Analysis**: Zone of Possible Agreement boundary validation and overlap analysis
- **Performance Analytics**: Comprehensive metrics tracking and reporting
- **Multi-round Negotiations**: Support for extended negotiation sessions

## 🛠 Technology Stack

### Frontend
- **React** with TypeScript
- **Vite** for build tooling
- **Wouter** for routing
- **TanStack Query** for state management
- **Shadcn/ui** with Radix UI components
- **Tailwind CSS** for styling
- **WebSocket** for real-time updates

### Backend
- **Express.js** with TypeScript
- **PostgreSQL** with Drizzle ORM
- **Neon** serverless PostgreSQL
- **OpenAI API** for AI agent intelligence
- **Langfuse** for AI observability and tracing
- **WebSocket** server for real-time communication

## 📊 System Architecture

The platform follows a modern full-stack architecture with separated concerns:

1. **Agent Configuration**: Configure AI personalities, tactics, and boundaries
2. **Negotiation Setup**: Define contexts, products, and market conditions
3. **Negotiation Engine**: Process negotiations with OpenAI integration
4. **Real-time Updates**: WebSocket-based live monitoring
5. **Analytics**: Performance tracking and reporting

## 🔧 Setup & Installation

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- OpenAI API key

### Environment Variables
Create a `.env` file with:
```env
DATABASE_URL=your_postgresql_connection_string
OPENAI_API_KEY=your_openai_api_key
LANGFUSE_PUBLIC_KEY=your_langfuse_public_key (optional)
LANGFUSE_SECRET_KEY=your_langfuse_secret_key (optional)
```

### Installation
```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Start development server
npm run dev
```

The application will be available at `http://localhost:5000`

## 🎯 Key Components

### Negotiation Engine
- **Location**: `server/services/negotiation-engine.ts`
- **Features**: AI agent orchestration, ZOPA validation, real-time processing
- **Integration**: OpenAI API with custom prompts incorporating techniques and tactics

### AI Service
- **Location**: `server/services/openai.ts`
- **Features**: GPT-4o integration, token tracking, cost calculation
- **Prompts**: YAML-based prompt management with technique/tactic integration

### Database Schema
- **Agents**: AI personality configurations
- **Negotiations**: Session management and status tracking
- **Simulation Runs**: Individual technique-tactic combination tests
- **Performance Metrics**: Detailed analytics and cost tracking

### Frontend Components
- **Dashboard**: Real-time metrics and active negotiations
- **Agent Configuration**: Personality trait management
- **Negotiation Creation**: 3-step wizard for setting up negotiations
- **Analytics**: Performance reports and success rate trends

## 🔄 Negotiation Flow

1. **Setup**: Configure agents with personalities and select techniques/tactics
2. **Initialization**: Create negotiation context with ZOPA boundaries
3. **Execution**: AI agents negotiate autonomously using OpenAI
4. **Monitoring**: Real-time updates via WebSocket
5. **Analysis**: Performance metrics and success evaluation

## 📈 Analytics & Reporting

- **Dashboard Metrics**: Active negotiations, success rates, API costs
- **Agent Performance**: Individual agent effectiveness tracking
- **Technique Analysis**: Effectiveness of different negotiation techniques
- **Cost Optimization**: Token usage and API cost monitoring

## 🛡 Security & Best Practices

- Environment-based configuration
- Secure API key management
- Database connection pooling
- Type-safe development with TypeScript
- Comprehensive error handling

## 📝 Development Guidelines

- Follow TypeScript best practices
- Use Drizzle ORM for database operations
- Implement proper error handling
- Maintain comprehensive logging
- Follow the existing code structure

## 🚀 Deployment

The application is optimized for deployment on Replit with:
- Automatic workflow configuration
- Environment variable management
- Database connection handling
- WebSocket support in hosted environment

## 📄 License

This project is private and proprietary.

## 🤝 Contributing

This is a private project. Please follow the established patterns and maintain code quality.