#!/bin/bash
# Debug and fix stuck queues

echo "🔍 Queue Debugging Tool"
echo "======================="
echo ""

echo "1️⃣  System Status:"
curl -s http://localhost:3000/api/simulations/system/status | jq '.'
echo ""

read -p "Do you see stuck queues? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo ""
    echo "2️⃣  Resetting stuck processing queues..."
    curl -s -X POST http://localhost:3000/api/simulations/system/reset-processing | jq '.'
    echo ""

    echo "3️⃣  Status after reset:"
    curl -s http://localhost:3000/api/simulations/system/status | jq '.'
    echo ""

    echo "✅ Done! The background processor will pick up queues in the next cycle (2s)"
fi

echo ""
echo "💡 Watch your server logs for:"
echo "  [QUEUE xxx] ✅ Added to processing set"
echo "  [QUEUE xxx] 🔄 Iteration 1: Checking for next simulation"
