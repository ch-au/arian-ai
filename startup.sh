#!/bin/bash

# Replit Deployment Startup Script
# This script sets up Python dependencies and starts the Node.js application

echo "🚀 Starting ARIAN AI Platform..."

# Load .env file if it exists (for local development)
if [ -f ".env" ]; then
    echo "📄 Loading environment variables from .env file..."
    set -a
    source .env
    set +a
    echo "✅ Environment variables loaded"
fi

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "⚠️  Python3 not found, skipping Python setup"
else
    echo "🐍 Installing Python dependencies..."
    
    # Install Python dependencies directly (no virtualenv for cloud deployment)
    # Check both scripts/ and dist/scripts/ for requirements.txt
    if [ -f "dist/scripts/requirements.txt" ]; then
        echo "📦 Installing Python dependencies from dist/scripts/requirements.txt..."
        pip3 install --upgrade pip 2>/dev/null || echo "⚠️  pip upgrade skipped"
        pip3 install -r dist/scripts/requirements.txt || {
            echo "⚠️  Python dependencies installation failed, continuing anyway..."
        }
        echo "✅ Python dependencies installed"
    elif [ -f "scripts/requirements.txt" ]; then
        echo "📦 Installing Python dependencies from scripts/requirements.txt..."
        pip3 install --upgrade pip 2>/dev/null || echo "⚠️  pip upgrade skipped"
        pip3 install -r scripts/requirements.txt || {
            echo "⚠️  Python dependencies installation failed, continuing anyway..."
        }
        echo "✅ Python dependencies installed"
    else
        echo "⚠️  requirements.txt not found, skipping Python dependencies"
    fi
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  Warning: DATABASE_URL is not set in environment"
else
    echo "✅ DATABASE_URL is configured"
fi

# Start the Node.js application
echo "🌐 Starting Node.js server..."
exec npm start

