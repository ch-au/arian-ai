#!/bin/bash
# Test simulation execution manually

echo "=== Testing Simulation Queue ==="
echo ""

# Get system status
echo "1. Checking system status..."
curl -s http://localhost:3000/api/simulations/system/status | jq '.'
echo ""

# Get all negotiations
echo "2. Getting negotiations..."
NEGOTIATION_ID=$(curl -s http://localhost:3000/api/negotiations | jq -r '.[0].id')
echo "Found negotiation: $NEGOTIATION_ID"
echo ""

# Get queue for negotiation
echo "3. Getting queue for negotiation..."
QUEUE_DATA=$(curl -s "http://localhost:3000/api/simulations/queue/by-negotiation/$NEGOTIATION_ID")
echo "$QUEUE_DATA" | jq '.'
QUEUE_ID=$(echo "$QUEUE_DATA" | jq -r '.queueId')
echo "Queue ID: $QUEUE_ID"
echo ""

if [ "$QUEUE_ID" = "null" ] || [ -z "$QUEUE_ID" ]; then
  echo "No queue found! Need to start negotiation first."
  exit 1
fi

# Get queue status
echo "4. Getting queue status..."
curl -s "http://localhost:3000/api/simulations/queue/$QUEUE_ID/status" | jq '.'
echo ""

# Get queue runs
echo "5. Getting queue runs..."
curl -s "http://localhost:3000/api/simulations/queue/$QUEUE_ID/runs" | jq '.data | length'
echo ""

# Try to start queue
echo "6. Starting queue..."
START_RESULT=$(curl -s -X POST "http://localhost:3000/api/simulations/queue/$QUEUE_ID/start")
echo "$START_RESULT" | jq '.'
echo ""

# Wait a bit
echo "7. Waiting 5 seconds..."
sleep 5

# Check status again
echo "8. Checking queue status after start..."
curl -s "http://localhost:3000/api/simulations/queue/$QUEUE_ID/status" | jq '.'
echo ""

# Check for any running simulations
echo "9. Checking for running simulations..."
curl -s "http://localhost:3000/api/simulations/queue/$QUEUE_ID/runs" | jq '.data | map(select(.status == "running" or .status == "completed")) | length'
echo ""

echo "=== Test Complete ==="