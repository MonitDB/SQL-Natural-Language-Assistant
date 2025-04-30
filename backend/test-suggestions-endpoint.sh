#!/bin/bash

echo "Testing the suggestions endpoint..."
echo "===================================="

# Call the test endpoint
curl -s http://monitdb-dev.ddns.net:3005//ask/test-suggestions | jq '{"result": .result, "suggestedPrompts": .suggestedPrompts}'

echo ""
echo "Test completed!"