#!/bin/bash
# Integration tests for the Labbed deploy/destroy flow.
# Requires: platform (port 8080), worker (port 8081), postgres running.
# Usage: bash tests/integration_test.sh

set -euo pipefail

PLATFORM="http://localhost:8080"
WORKER="http://localhost:8081"
PASS=0
FAIL=0
TOTAL=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

log() { echo -e "${YELLOW}[TEST]${NC} $1"; }
pass() { echo -e "${GREEN}[PASS]${NC} $1"; PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); }
fail() { echo -e "${RED}[FAIL]${NC} $1"; FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); }

# --- Helper: login and get token ---
login() {
    local resp
    resp=$(curl -s -X POST "$PLATFORM/api/v1/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@labbed.local","password":"admin"}')
    echo "$resp" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4
}

# --- Helper: get org UUID ---
get_org() {
    local token=$1
    local resp
    resp=$(curl -s "$PLATFORM/api/v1/organizations" \
        -H "Authorization: Bearer $token")
    echo "$resp" | grep -o '"uuid":"[^"]*"' | head -1 | cut -d'"' -f4
}

# --- Pre-flight checks ---
log "Checking services..."

if ! curl -sf "$PLATFORM/api/v1/auth/config" > /dev/null 2>&1; then
    echo -e "${RED}Platform not running on port 8080${NC}"
    exit 1
fi

if ! curl -sf "$WORKER/health" > /dev/null 2>&1; then
    echo -e "${RED}Worker not running on port 8081${NC}"
    exit 1
fi

echo ""
log "=== Starting Integration Tests ==="
echo ""

# --- Test 1: Worker health ---
log "Test: Worker health endpoint"
HEALTH=$(curl -s "$WORKER/health")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
    pass "Worker health returns ok"
else
    fail "Worker health unexpected: $HEALTH"
fi

# --- Test 2: Platform auth ---
log "Test: Platform login"
TOKEN=$(login)
if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    pass "Login successful, got token"
else
    fail "Login failed"
    echo "Cannot continue without auth token"
    exit 1
fi

# --- Test 3: Get org ---
log "Test: Get organization"
ORG_UUID=$(get_org "$TOKEN")
if [ -n "$ORG_UUID" ] && [ "$ORG_UUID" != "null" ]; then
    pass "Got org UUID: $ORG_UUID"
else
    fail "Could not get org UUID"
    exit 1
fi

# --- Test 4: List topologies ---
log "Test: List topologies"
TOPOS=$(curl -s "$PLATFORM/api/v1/topologies" \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Org-ID: $ORG_UUID")
TOPO_COUNT=$(echo "$TOPOS" | grep -o '"uuid"' | wc -l)
if [ "$TOPO_COUNT" -gt 0 ]; then
    pass "Found $TOPO_COUNT topologies"
    TOPO_UUID=$(echo "$TOPOS" | grep -o '"uuid":"[^"]*"' | head -1 | cut -d'"' -f4)
else
    fail "No topologies found"
    exit 1
fi

# --- Test 5: Create a lab ---
log "Test: Create lab"
LAB_RESP=$(curl -s -X POST "$PLATFORM/api/v1/labs" \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Org-ID: $ORG_UUID" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"integration-test-lab\",\"topologyId\":\"$TOPO_UUID\"}")
LAB_UUID=$(echo "$LAB_RESP" | grep -o '"uuid":"[^"]*"' | head -1 | cut -d'"' -f4)
LAB_STATE=$(echo "$LAB_RESP" | grep -o '"state":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$LAB_UUID" ] && [ "$LAB_STATE" = "scheduled" ]; then
    pass "Lab created: $LAB_UUID (state: $LAB_STATE)"
else
    fail "Lab creation failed: $LAB_RESP"
    exit 1
fi

# --- Test 6: Deploy the lab ---
log "Test: Deploy lab"
DEPLOY_RESP=$(curl -s -X POST "$PLATFORM/api/v1/labs/$LAB_UUID/deploy" \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Org-ID: $ORG_UUID" \
    -H "Content-Type: application/json" \
    -d '{}')

# Check state transitions to deploying
sleep 2
LAB_CHECK=$(curl -s "$PLATFORM/api/v1/labs/$LAB_UUID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Org-ID: $ORG_UUID")
DEPLOY_STATE=$(echo "$LAB_CHECK" | grep -o '"state":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ "$DEPLOY_STATE" = "deploying" ] || [ "$DEPLOY_STATE" = "running" ]; then
    pass "Lab state after deploy: $DEPLOY_STATE"
else
    fail "Unexpected state after deploy: $DEPLOY_STATE (response: $LAB_CHECK)"
fi

# --- Test 7: Wait for running state ---
log "Test: Wait for lab to reach running state (max 120s)"
TIMEOUT=120
ELAPSED=0
FINAL_STATE="unknown"
while [ $ELAPSED -lt $TIMEOUT ]; do
    LAB_CHECK=$(curl -s "$PLATFORM/api/v1/labs/$LAB_UUID" \
        -H "Authorization: Bearer $TOKEN" \
        -H "X-Org-ID: $ORG_UUID")
    FINAL_STATE=$(echo "$LAB_CHECK" | grep -o '"state":"[^"]*"' | head -1 | cut -d'"' -f4)

    if [ "$FINAL_STATE" = "running" ]; then
        break
    elif [ "$FINAL_STATE" = "failed" ]; then
        ERROR=$(echo "$LAB_CHECK" | grep -o '"errorMessage":"[^"]*"' | cut -d'"' -f4)
        fail "Lab failed during deploy: $ERROR"
        break
    fi

    sleep 5
    ELAPSED=$((ELAPSED + 5))
    echo -n "."
done
echo ""

if [ "$FINAL_STATE" = "running" ]; then
    pass "Lab reached running state in ${ELAPSED}s"
else
    fail "Lab did not reach running state (final: $FINAL_STATE) after ${ELAPSED}s"
fi

# --- Test 8: Check nodes ---
log "Test: Lab has nodes"
NODE_COUNT=$(echo "$LAB_CHECK" | grep -o '"name"' | wc -l)
if [ "$NODE_COUNT" -gt 1 ]; then
    pass "Lab has $((NODE_COUNT - 1)) nodes (minus lab name field)"
else
    fail "Lab has no nodes: $LAB_CHECK"
fi

# --- Test 9: Worker internal callbacks ---
log "Test: Worker status callback endpoint"
STATUS_RESP=$(curl -s -w "\n%{http_code}" -X POST "$PLATFORM/api/internal/labs/status" \
    -H "Content-Type: application/json" \
    -H "X-Worker-Secret: change-me-in-production" \
    -d "{\"labUuid\":\"$LAB_UUID\",\"state\":\"running\"}")
STATUS_CODE=$(echo "$STATUS_RESP" | tail -1)
if [ "$STATUS_CODE" = "200" ]; then
    pass "Status callback endpoint works (HTTP $STATUS_CODE)"
else
    fail "Status callback returned HTTP $STATUS_CODE"
fi

# --- Test 10: Worker node callback endpoint ---
log "Test: Worker node callback endpoint"
NODE_RESP=$(curl -s -w "\n%{http_code}" -X POST "$PLATFORM/api/internal/labs/nodes" \
    -H "Content-Type: application/json" \
    -H "X-Worker-Secret: change-me-in-production" \
    -d "{\"labUuid\":\"$LAB_UUID\",\"nodes\":[{\"name\":\"test-node\",\"kind\":\"linux\",\"image\":\"alpine\",\"state\":\"running\"}]}")
NODE_CODE=$(echo "$NODE_RESP" | tail -1)
if [ "$NODE_CODE" = "200" ]; then
    pass "Node callback endpoint works (HTTP $NODE_CODE)"
else
    fail "Node callback returned HTTP $NODE_CODE"
fi

# --- Test 11: Worker auth - bad secret ---
log "Test: Worker auth rejects bad secret"
AUTH_RESP=$(curl -s -w "\n%{http_code}" -X POST "$PLATFORM/api/internal/labs/status" \
    -H "Content-Type: application/json" \
    -H "X-Worker-Secret: wrong-secret" \
    -d "{\"labUuid\":\"$LAB_UUID\",\"state\":\"running\"}")
AUTH_CODE=$(echo "$AUTH_RESP" | tail -1)
if [ "$AUTH_CODE" = "401" ]; then
    pass "Bad worker secret rejected (HTTP 401)"
else
    fail "Bad worker secret not rejected (HTTP $AUTH_CODE)"
fi

# --- Test 12: Destroy the lab ---
if [ "$FINAL_STATE" = "running" ]; then
    log "Test: Destroy lab"
    DESTROY_RESP=$(curl -s -X POST "$PLATFORM/api/v1/labs/$LAB_UUID/destroy" \
        -H "Authorization: Bearer $TOKEN" \
        -H "X-Org-ID: $ORG_UUID" \
        -H "Content-Type: application/json" \
        -d '{}')

    # Wait for stopped
    sleep 5
    DESTROY_TIMEOUT=60
    DESTROY_ELAPSED=0
    DESTROY_STATE="unknown"
    while [ $DESTROY_ELAPSED -lt $DESTROY_TIMEOUT ]; do
        LAB_CHECK=$(curl -s "$PLATFORM/api/v1/labs/$LAB_UUID" \
            -H "Authorization: Bearer $TOKEN" \
            -H "X-Org-ID: $ORG_UUID")
        DESTROY_STATE=$(echo "$LAB_CHECK" | grep -o '"state":"[^"]*"' | head -1 | cut -d'"' -f4)

        if [ "$DESTROY_STATE" = "stopped" ]; then
            break
        elif [ "$DESTROY_STATE" = "failed" ]; then
            break
        fi

        sleep 3
        DESTROY_ELAPSED=$((DESTROY_ELAPSED + 3))
        echo -n "."
    done
    echo ""

    if [ "$DESTROY_STATE" = "stopped" ]; then
        pass "Lab destroyed successfully"
    else
        fail "Lab destroy did not reach stopped (final: $DESTROY_STATE)"
    fi
fi

# --- Test 13: Delete lab ---
log "Test: Delete lab"
DELETE_RESP=$(curl -s -w "\n%{http_code}" -X DELETE "$PLATFORM/api/v1/labs/$LAB_UUID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Org-ID: $ORG_UUID")
DELETE_CODE=$(echo "$DELETE_RESP" | tail -1)
if [ "$DELETE_CODE" = "200" ] || [ "$DELETE_CODE" = "204" ]; then
    pass "Lab deleted (HTTP $DELETE_CODE)"
else
    fail "Lab delete failed (HTTP $DELETE_CODE)"
fi

# --- Test 14: Verify deleted ---
log "Test: Verify lab is deleted"
GET_RESP=$(curl -s -w "\n%{http_code}" "$PLATFORM/api/v1/labs/$LAB_UUID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Org-ID: $ORG_UUID")
GET_CODE=$(echo "$GET_RESP" | tail -1)
if [ "$GET_CODE" = "404" ] || [ "$GET_CODE" = "500" ]; then
    pass "Deleted lab returns not found"
else
    fail "Deleted lab still accessible (HTTP $GET_CODE)"
fi

# --- Test 15: Worker inspect endpoint ---
log "Test: Worker inspect endpoint"
# Check if any clab containers exist
INSPECT_RESP=$(curl -s -w "\n%{http_code}" -X POST "$WORKER/api/v1/labs/inspect" \
    -H "Content-Type: application/json" \
    -H "X-Worker-Secret: change-me-in-production" \
    -d '{"clabName":"nonexistent-lab"}')
INSPECT_CODE=$(echo "$INSPECT_RESP" | tail -1)
# Should return 200 with empty nodes or 500 — either is fine as long as worker doesn't crash
WORKER_ALIVE=$(curl -s "$WORKER/health" 2>/dev/null | grep -c '"status":"ok"')
if [ "$WORKER_ALIVE" = "1" ]; then
    pass "Worker survived inspect of nonexistent lab (HTTP $INSPECT_CODE)"
else
    fail "Worker crashed during inspect"
fi

# --- Summary ---
echo ""
echo "========================================="
echo -e "  Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC} / $TOTAL total"
echo "========================================="

if [ $FAIL -gt 0 ]; then
    exit 1
fi
