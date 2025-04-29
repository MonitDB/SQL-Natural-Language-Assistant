#!/bin/bash

# Set test parameters
HOST="localhost:3000"
USERNAME="monitx"
PASSWORD="teste"
CONNSTRING="monitdb-dev.ddns.net:1521/orcl"
PORT=1521

# Test prompt with a generic prompt
run_test() {
  local prompt="$1"
  local testname="$2"
  
  echo "====================================="
  echo "Running test: $testname"
  echo "Prompt: $prompt"
  echo "====================================="
  
  # Run the API request
  curl -s -X POST "http://$HOST/ask" \
    -H "Content-Type: application/json" \
    -d '{
      "username": "'"$USERNAME"'",
      "password": "'"$PASSWORD"'",
      "connectionString": "'"$CONNSTRING"'",
      "port": '$PORT',
      "prompt": "'"$prompt"'"
    }' | jq .
    
  echo ""
  echo "Test complete: $testname"
  echo "====================================="
  echo ""
}

# Test 1: Completely generic schema exploration
run_test "What schemas are available and what tables are in each schema?" "Schema Discovery"

# Test 2: Generic primary/foreign key analysis
run_test "Show me all the tables with their primary keys and any foreign key relationships" "Key Relationships"

# Test 3: Generic data sampling
run_test "Show me sample rows from the most important tables in this database" "Data Sampling"

# Test 4: Generic analytics without assuming schema
run_test "Find tables with numeric columns and calculate their average values" "Generic Analytics"

# Test 5: Schema-agnostic query
run_test "Identify tables that appear to store user or customer information and show example data" "Entity Discovery"