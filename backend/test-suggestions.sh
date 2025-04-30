#!/bin/bash

# Set test parameters
HOST="backend:3005"
USERNAME="monitx"
PASSWORD="teste"
CONNSTRING="monitdb-dev.ddns.net:1521/orcl"
PORT=1521

# Test prompt with a simple query to test suggestions feature
run_test() {
  local prompt="$1"
  local testname="$2"
  
  echo "====================================="
  echo "Running test: $testname"
  echo "Prompt: $prompt"
  echo "====================================="
  
  # Run the API request and save the full response to a variable
  response=$(curl -s -X POST "http://$HOST/ask" \
    -H "Content-Type: application/json" \
    -d '{
      "username": "'"$USERNAME"'",
      "password": "'"$PASSWORD"'",
      "connectionString": "'"$CONNSTRING"'",
      "port": '$PORT',
      "prompt": "'"$prompt"'"
    }')
  
  # Display the result summary
  echo "-------- RESULT SUMMARY --------"
  echo "$response" | jq -r '.result' 
  
  # Check if suggestedPrompts exists and is not null
  if echo "$response" | jq -e '.suggestedPrompts' > /dev/null; then
    echo ""
    echo "-------- SUGGESTED PROMPTS --------"
    suggestions=$(echo "$response" | jq -r '.suggestedPrompts[]')
    if [ -n "$suggestions" ]; then
      echo "$suggestions" | nl
    else
      echo "No suggested prompts returned."
    fi
  else
    echo ""
    echo "No suggestedPrompts field in the response!"
  fi
  
  # Show executed queries if available
  echo ""
  echo "-------- EXECUTED QUERIES --------"
  queries=$(echo "$response" | jq -r '.executedQueries[]')
  if [ -n "$queries" ]; then
    echo "$queries"
  else 
    echo "No queries executed."
  fi
}

# Test with a simple query to get table information
run_test "List the tables in this database and their row counts" "Test Suggested Prompts Feature"

echo ""
echo "Test completed!"