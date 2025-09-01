#!/bin/bash

echo "🚀 Starting ARIAN AI Application"
echo "==============================="
echo

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the arian-ai directory"
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ No .env file found. Please run ./setup.sh first"
    exit 1
fi

# Check if DATABASE_URL is configured
if ! grep -q "postgresql://" .env 2>/dev/null; then
    echo "⚠️  DATABASE_URL not configured in .env"
    echo "   Get a free database at: https://neon.tech"
    echo "   Then update your .env file"
    echo
    echo "🔄 Starting application anyway (some features may not work)..."
    echo
fi

echo "📦 Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

echo
echo "🗄️  Database status:"
npm run db:push 2>/dev/null && echo "✅ Database connected & schema updated" || echo "⚠️  Database connection failed"

echo
echo "🌐 Starting development server..."
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:3000"
echo
echo "📝 To test the combinatorial simulation system:"
echo "   1. Navigate to http://localhost:5173"
echo "   2. Go to Create Negotiation"
echo "   3. Select 3 techniques and 2 tactics"
echo "   4. Expect: 6 simulation runs created (3×2)"
echo
echo "🛑 Press Ctrl+C to stop the application"
echo

# Start the development server
npm run dev
