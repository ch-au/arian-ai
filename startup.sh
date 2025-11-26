#!/bin/bash

# Azure Deployment Startup Script
echo "🚀 Starting ARIAN AI Platform..."

# Install Python dependencies (required for negotiation simulations)
echo "📦 Installing Python dependencies..."
if [ -f "scripts/requirements.txt" ]; then
    pip install --user -r scripts/requirements.txt
    echo "✅ Python dependencies installed"
else
    echo "⚠️ scripts/requirements.txt not found, skipping Python deps"
fi

# Start the Node.js application
echo "🟢 Starting Node.js server..."
exec npm start
