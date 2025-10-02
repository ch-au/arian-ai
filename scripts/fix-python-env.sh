#!/bin/bash
# Fix corrupted Python virtual environment

set -e

echo "🔧 Fixing Python Virtual Environment"
echo "======================================"
echo ""

# 1. Backup old venv
if [ -d ".venv" ]; then
    echo "📦 Backing up old .venv to .venv.backup..."
    rm -rf .venv.backup 2>/dev/null || true
    mv .venv .venv.backup
    echo "✅ Backup complete"
else
    echo "ℹ️  No existing .venv found"
fi

echo ""

# 2. Create fresh venv
echo "🆕 Creating fresh virtual environment..."
python3 -m venv .venv
echo "✅ Virtual environment created"

echo ""

# 3. Upgrade pip
echo "⬆️  Upgrading pip..."
./.venv/bin/pip install --upgrade pip --quiet
echo "✅ pip upgraded"

echo ""

# 4. Install requirements
echo "📚 Installing requirements from scripts/requirements.txt..."
./.venv/bin/pip install -r scripts/requirements.txt
echo "✅ Requirements installed"

echo ""

# 5. Verify installation
echo "🔍 Verifying installation..."
echo ""
echo "Installed packages:"
./.venv/bin/pip list | grep -E "openai|langfuse|nest"

echo ""
echo "✅ Testing Python imports..."
timeout 5 ./.venv/bin/python -c "
from agents import Agent
from langfuse import Langfuse
import nest_asyncio
print('✅ All imports successful!')
" || echo "❌ Import test failed"

echo ""
echo "🎉 Python environment fixed!"
echo ""
echo "Next steps:"
echo "1. Restart your dev server: npm run dev"
echo "2. Start a simulation from the dashboard"
echo "3. Check server logs for [PYTHON-EXEC] messages"
