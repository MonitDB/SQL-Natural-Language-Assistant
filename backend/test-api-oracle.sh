#!/bin/bash

# Test script for checking the /ask endpoint with Oracle database connection

echo -e "\n=== Testing /ask endpoint with Oracle database ===\n"

# Set variables
API_URL="http://localhost:3000/ask"
DB_HOST="monitdb-dev.ddns.net"
DB_PORT="1521"
DB_SERVICE="orcl"
DB_USER="monitx"
DB_PASSWORD="teste"

# Create the request payload
REQUEST_PAYLOAD=$(cat << EOF
{
  "username": "${DB_USER}",
  "password": "${DB_PASSWORD}",
  "connectionString": "${DB_HOST}:${DB_PORT}/${DB_SERVICE}",
  "prompt": "List the first 5 tables in the database and their owners"
}
EOF
)

echo "Request payload:"
echo "$REQUEST_PAYLOAD" | jq

echo -e "\nSending request to $API_URL...\n"

# Send the request using curl
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "$REQUEST_PAYLOAD" \
  "$API_URL" | jq

echo -e "\n=== Test completed ===\n"