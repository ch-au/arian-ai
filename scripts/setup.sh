#!/bin/bash

echo "🚀 ARIAN AI - Setup & Test Script"
echo "=================================="
echo

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the arian-ai directory"
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo
echo "🔧 Setting up environment..."

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating template..."
    cat > .env << EOL
# Database Configuration (Required)
DATABASE_URL="postgresql://username:password@ep-example.neon.tech/database?sslmode=require"

# AI Providers (at least one required)
OPENAI_API_KEY="sk-your-openai-api-key-here"
ANTHROPIC_API_KEY="sk-ant-your-anthropic-api-key-here"  # Optional
GEMINI_API_KEY="your-gemini-api-key-here"               # Optional

# Langfuse Configuration (Optional but recommended)
LANGFUSE_SECRET_KEY="sk-lf-your-secret-key"
LANGFUSE_PUBLIC_KEY="pk-lf-your-public-key"
LANGFUSE_HOST="https://cloud.langfuse.com"

# Development
NODE_ENV=development
PORT=3000
EOL
    echo "✏️  Please edit .env file with your actual database URL"
    echo "   💡 Get a free database at: https://neon.tech"
    echo
else
    echo "✅ .env file already exists"
fi

# Check if DATABASE_URL is set
if grep -q "postgresql://" .env 2>/dev/null; then
    echo "✅ Database URL found in .env"
    echo
    echo "🗄️  Setting up database schema..."
    npm run db:push 2>/dev/null || echo "⚠️  Database setup skipped (check your DATABASE_URL)"
else
    echo "⚠️  Please set a valid DATABASE_URL in .env file"
    echo "   Example: DATABASE_URL=\"postgresql://user:pass@host.neon.tech/dbname\""
fi

echo
echo "🎯 Setup complete! Next steps:"
echo "   1. Edit .env file with your database URL (if needed)"
echo "   2. Run: ./start.sh   (to start the application)"
echo "   3. Run: ./test.sh    (to test the improvements)"
echo
