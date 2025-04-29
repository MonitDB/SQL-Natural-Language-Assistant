#!/bin/bash

# Set test parameters 
HOST="localhost:3000"
USERNAME="monitx"
PASSWORD="teste"
CONNSTRING="monitdb-dev.ddns.net:1521/orcl"

# Run a single specific test
echo "====================================="
echo "Testing schema-agnostic implementation"
echo "Prompt: What schemas and tables are available in this database?"
echo "====================================="

# Run the API request
curl -s --max-time 10 -X POST "http://$HOST/ask" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "'$USERNAME'",
    "password": "'$PASSWORD'",
    "connectionString": "'$CONNSTRING'",
    "port": 1521,
    "prompt": "List the first 5 tables you can find in this database"
  }' | jq
  
echo ""
echo "====================================="