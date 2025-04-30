#!/bin/bash

# Example request to test Oracle database with no tables access
echo "Testing Oracle connection with your monitx user..."

# Use a longer timeout (120 seconds)
curl --max-time 120 -X POST http://monitdb-dev.ddns.net:3005//ask \
  -H "Content-Type: application/json" \
  -d '{
  "username": "monitx",
  "password": "teste",
  "connectionString": "monitdb-dev.ddns.net:1521/orcl",
  "prompt": "Enlist me all table names"
}' | jq .