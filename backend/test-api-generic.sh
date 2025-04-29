#!/bin/bash

# Set test parameters
HOST="localhost:3005"
USERNAME="monitx"
PASSWORD="teste"
CONNSTRING="monitdb-dev.ddns.net:1521/orcl"
PORT=1521

# Test prompt 1 - Basic data exploration
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

# Test 1: Simple schema exploration
run_test "What tables are available in the database and what data do they contain?" "Schema Exploration"

# Test 2: Employee statistics
run_test "Show me employee statistics grouped by department with average salary" "Employee Statistics"

# Test 3: Flexible query with joins
run_test "Find all employees who work in the IT department along with their job titles and salaries" "Department Employees"

# Test 4: Complex conditions
run_test "Who are the managers in the company and how many employees report to each of them?" "Manager Hierarchy"

# Test 5: Generic pattern not assuming HR schema
run_test "What are the relationships between the main tables in this database?" "Table Relationships"