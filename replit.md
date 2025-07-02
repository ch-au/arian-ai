# ARIAN Platform - AI Negotiation Platform

## Overview

ARIAN is a sophisticated AI negotiation platform that enables automated negotiations between AI agents with configurable personalities, tactics, and ZOPA (Zone of Possible Agreement) boundaries. The platform provides real-time monitoring, analytics, and testing capabilities for AI-driven negotiation scenarios.

## System Architecture

The application follows a modern full-stack architecture:

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state management
- **UI Components**: Shadcn/ui with Radix UI primitives and Tailwind CSS
- **Real-time Communication**: WebSocket integration for live negotiation updates

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon serverless PostgreSQL
- **AI Integration**: OpenAI API for negotiation agent intelligence
- **Real-time**: WebSocket server for live negotiation monitoring

## Key Components

### 1. Agent Configuration System
- Configurable AI personality profiles based on Big Five traits
- Tactic assignment and preference management
- Power level configuration for negotiation dynamics
- Agent performance tracking and analytics

### 2. Negotiation Engine
- WebSocket-based real-time negotiation processing
- ZOPA boundary validation and overlap analysis
- Multi-round negotiation support with configurable limits
- Automated negotiation flow with human intervention capabilities

### 3. Analytics and Reporting
- Dashboard with key performance metrics
- Success rate trend analysis
- Agent performance comparisons
- Cost tracking and optimization insights
- Exportable reports in multiple formats

### 4. Testing Suite
- Multi-scenario testing capabilities
- Parallel negotiation execution
- Performance benchmarking
- Automated validation and regression testing

## Data Flow

1. **Agent Configuration**: Users configure AI agents with personalities, tactics, and constraints
2. **Negotiation Setup**: Define negotiation contexts with product info, market conditions, and ZOPA boundaries
3. **Negotiation Execution**: Engine processes negotiations using OpenAI API with real-time WebSocket updates
4. **Analytics Processing**: System captures negotiation rounds, performance metrics, and outcomes
5. **Reporting**: Analytics service aggregates data for dashboard metrics and exportable reports

## External Dependencies

### Database
- **Neon PostgreSQL**: Serverless PostgreSQL database
- **Connection**: Pool-based connections with environment variable configuration

### AI Service
- **OpenAI API**: GPT-4o model for negotiation intelligence
- **Usage Tracking**: Token consumption and cost monitoring
- **Rate Limiting**: Built-in handling for API constraints

### UI Libraries
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first styling framework
- **Recharts**: Data visualization components
- **React Hook Form**: Form state management with Zod validation

## Deployment Strategy

### Development Environment
- **Vite Dev Server**: Hot module replacement and development tooling
- **TypeScript Compilation**: Real-time type checking
- **Database Migrations**: Drizzle Kit for schema management

### Production Build
- **Frontend**: Vite build with static asset optimization
- **Backend**: ESBuild bundling for Node.js deployment
- **Database**: Environment-based connection string configuration
- **Environment Variables**: Secure configuration for API keys and database credentials

### Replit Integration
- **Cartographer Plugin**: Development environment mapping
- **Runtime Error Overlay**: Enhanced debugging capabilities
- **WebSocket Support**: Real-time communication in hosted environment

## Changelog
- July 02, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.