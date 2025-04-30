#!/bin/bash

# Define colors for better output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Testing Oracle Natural Language Query API${NC}"
echo "----------------------------------------------"

# Test health endpoint
echo -e "\n${YELLOW}1. Testing health endpoint:${NC}"
HEALTH_RESPONSE=$(curl -s http://backend:3005/health | jq .)
echo "$HEALTH_RESPONSE"
if [[ $(echo "$HEALTH_RESPONSE" | jq -r '.status') == "healthy" ]]; then
  echo -e "${GREEN}✓ Health check passed${NC}"
else
  echo -e "${RED}✗ Health check failed${NC}"
fi

# Create a sample request for the /ask endpoint
echo -e "\n${YELLOW}2. Creating sample request for /ask endpoint:${NC}"
cat << EOF > /tmp/sample-request.json
{
  "username": "your_oracle_username", 
  "password": "your_oracle_password", 
  "connectionString": "your_oracle_host/your_service_name", 
  "port": 1521, 
  "prompt": "Show me a list of all tables in the database"
}
EOF

echo "Sample request created at /tmp/sample-request.json"
echo "Content of the sample request:"
cat /tmp/sample-request.json | jq .

echo -e "\n${YELLOW}3. To test the /ask endpoint with your Oracle credentials:${NC}"
echo 'Edit the sample request and then run:'
echo '$ curl -X POST -H "Content-Type: application/json" -d @/tmp/sample-request.json http://backend:3005/ask | jq .'
echo ""
echo "Note: You'll need to update the sample request with valid Oracle credentials."
echo "The API is now ready for use at http://backend:3005"