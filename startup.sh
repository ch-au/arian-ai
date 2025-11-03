#!/bin/bash

# Azure App Service Startup Script
# This script sets up Python virtual environment and starts the Node.js application

set -e  # Exit on any error

echo "🚀 Starting ARIAN AI Platform..."

# Load .env file if it exists (for local development)
# Note: In production (Azure), environment variables are set via Azure Configuration
if [ -f ".env" ]; then
    echo "📄 Loading environment variables from .env file..."
    # Use a safer method to load .env (handles values with spaces and special characters)
    set -a
    source .env
    set +a
    echo "✅ Environment variables loaded"
fi

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "⚠️  Python3 not found, skipping Python setup"
else
    echo "🐍 Setting up Python virtual environment..."
    
    # Create virtual environment if it doesn't exist
    if [ ! -d ".venv" ]; then
        python3 -m venv .venv
    fi
    
    # Activate virtual environment
    source .venv/bin/activate
    
    # Install Python dependencies
    # Check both scripts/ and dist/scripts/ for requirements.txt
    if [ -f "scripts/requirements.txt" ]; then
        echo "📦 Installing Python dependencies from scripts/requirements.txt..."
        pip install --quiet --upgrade pip
        pip install --quiet -r scripts/requirements.txt
        echo "✅ Python dependencies installed"
    elif [ -f "dist/scripts/requirements.txt" ]; then
        echo "📦 Installing Python dependencies from dist/scripts/requirements.txt..."
        pip install --quiet --upgrade pip
        pip install --quiet -r dist/scripts/requirements.txt
        echo "✅ Python dependencies installed"
    else
        echo "⚠️  requirements.txt not found in scripts/ or dist/scripts/, skipping Python dependencies"
    fi
    
    # Deactivate virtual environment (Node.js will use it via PATH)
    deactivate
fi

# Check if DATABASE_URL is set
# Note: Node.js will load .env via dotenv/config, but we check here for early feedback
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  Warning: DATABASE_URL is not set in environment"
    echo "   Node.js will try to load it from .env file if available"
else
    echo "✅ DATABASE_URL is set (${DATABASE_URL:0:30}...)"
fi

# Run database migrations (optional - can be done manually or via startup)
# Uncomment the following lines if you want automatic migrations on startup:
# echo "🗄️  Running database migrations..."
# npm run db:push || echo "⚠️  Database migration failed, continuing anyway..."

# Start the Node.js application
echo "🌐 Starting Node.js server..."
exec npm start

