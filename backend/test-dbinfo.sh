#!/bin/bash

# Set test parameters
HOST="localhost:3005"
USERNAME="monitx"
PASSWORD="teste"
CONNSTRING="monitdb-dev.ddns.net:1521/orcl"

# Create a very simple test request
echo "====================================="
echo "Testing simplified database structure scan"
echo "====================================="

# Run the API request
curl -s -X POST "http://$HOST/ask" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "'$USERNAME'",
    "password": "'$PASSWORD'",
    "connectionString": "'$CONNSTRING'",
    "port": 1521,
    "prompt": "Show me the structure of this database"
  }' | jq '.result'
  
echo ""
echo "====================================="