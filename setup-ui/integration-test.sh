#!/bin/bash
# Integration test for Setup UI
# This script starts the server and verifies it responds to health checks

set -e

echo "=== Eden Viewer Setup UI - Integration Test ==="
echo ""

# Configuration
PORT=8888
TIMEOUT=10
TEST_DIR="/tmp/eden-setup-ui-test-$$"

# Cleanup function
cleanup() {
  echo ""
  echo "Cleaning up..."
  if [ ! -z "$SERVER_PID" ]; then
    kill $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
  fi
  rm -rf "$TEST_DIR"
  echo "Done."
}

trap cleanup EXIT

# Verify server.js exists
if [ ! -f "server.js" ]; then
  echo "ERROR: server.js not found in current directory"
  echo "Please run this script from the setup-ui directory"
  exit 1
fi

# Create test environment
echo "1/5 Setting up test environment..."
mkdir -p "$TEST_DIR"
export CONFIG_PATH="$TEST_DIR/config.json"
export SETUP_UI_PORT=$PORT
export SETUP_UI_FIRST_RUN=true

# Start server
echo "2/5 Starting Setup UI server on port $PORT..."
node server.js > "$TEST_DIR/server.log" 2>&1 &
SERVER_PID=$!

# Verify server process is running
sleep 2
if ! kill -0 $SERVER_PID 2>/dev/null; then
  echo "   ERROR: Server process died shortly after starting"
  echo "   Server log:"
  cat "$TEST_DIR/server.log"
  exit 1
fi

# Wait for server to start
echo "3/5 Waiting for server to be ready..."
WAIT_TIME=0
while [ $WAIT_TIME -lt $TIMEOUT ]; do
  if curl -s "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
    echo "   Server is ready!"
    break
  fi
  sleep 1
  WAIT_TIME=$((WAIT_TIME + 1))
done

if [ $WAIT_TIME -eq $TIMEOUT ]; then
  echo "   ERROR: Server failed to start within ${TIMEOUT}s"
  echo "   Server log:"
  cat "$TEST_DIR/server.log"
  exit 1
fi

# Test health endpoint
echo "4/5 Testing /api/health endpoint..."
HEALTH_RESPONSE=$(curl -s "http://localhost:$PORT/api/health")
if echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"'; then
  echo "   ✓ Health check passed"
else
  echo "   ✗ Health check failed"
  echo "   Response: $HEALTH_RESPONSE"
  exit 1
fi

# Test status endpoint
echo "5/5 Testing /api/status endpoint..."
STATUS_RESPONSE=$(curl -s "http://localhost:$PORT/api/status")
if echo "$STATUS_RESPONSE" | grep -q '"firstRun":true'; then
  echo "   ✓ Status check passed"
else
  echo "   ✗ Status check failed"
  echo "   Response: $STATUS_RESPONSE"
  exit 1
fi

echo ""
echo "=== All integration tests passed! ==="
exit 0
