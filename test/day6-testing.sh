#!/usr/bin/env bash
# Day 6 - Data Intelligence Stack - test simulation
# Mirrors the PASS/FAIL/INFO conventions used by day4-testing.sh and
# stack5-integration-test.sh in this repo.

set -uo pipefail

DAY6_URL="${DAY6_URL:-http://localhost:4408}"
PASS=0
FAIL=0

section() {
  echo ""
  echo "============================================================"
  echo "$1"
  echo "============================================================"
}

pass() { echo "[PASS] $1"; PASS=$((PASS+1)); }
fail() { echo "[FAIL] $1"; FAIL=$((FAIL+1)); }
info() { echo "[INFO] $1"; }

req() {
  # req METHOD PATH BODY_JSON_OR_EMPTY
  local method="$1"; local path="$2"; local body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -X "$method" "$DAY6_URL$path" -H 'Content-Type: application/json' -d "$body" -w '\n%{http_code}'
  else
    curl -sS -X "$method" "$DAY6_URL$path" -w '\n%{http_code}'
  fi
}

section "1. CLIENT DEPENDENCIES"
for bin in curl jq uuidgen; do
  if command -v "$bin" >/dev/null 2>&1; then pass "$bin available"; else fail "$bin available"; fi
done

section "2. HEALTH / READY / DEPENDENCIES / HELP / METRICS"

resp=$(req GET /health); code=$(echo "$resp" | tail -1); body=$(echo "$resp" | sed '$d')
[ "$code" = "200" ] && pass "/health HTTP 200" || fail "/health HTTP 200 (got $code)"
echo "$body" | jq . 2>/dev/null || echo "$body"

resp=$(req GET /ready); code=$(echo "$resp" | tail -1); body=$(echo "$resp" | sed '$d')
[ "$code" = "200" ] && pass "/ready HTTP 200" || fail "/ready HTTP 200 (got $code)"
echo "$body" | jq . 2>/dev/null || echo "$body"

resp=$(req GET /dependencies); code=$(echo "$resp" | tail -1); body=$(echo "$resp" | sed '$d')
[ "$code" = "200" ] && pass "/dependencies HTTP 200" || fail "/dependencies HTTP 200 (got $code)"
echo "$body" | jq . 2>/dev/null || echo "$body"

resp=$(req GET /help); code=$(echo "$resp" | tail -1); body=$(echo "$resp" | sed '$d')
[ "$code" = "200" ] && pass "/help HTTP 200" || fail "/help HTTP 200 (got $code)"
echo "$body" | jq -e '.endpoints | length > 0' >/dev/null 2>&1 && pass "/help advertises endpoints" || fail "/help advertises endpoints"

resp=$(req GET /metrics); code=$(echo "$resp" | tail -1); body=$(echo "$resp" | sed '$d')
[ "$code" = "200" ] && pass "/metrics HTTP 200" || fail "/metrics HTTP 200 (got $code)"
echo "$body" | grep -q "day6_requests_total" && pass "day6_requests_total metric present" || fail "day6_requests_total metric present"

section "3. LEVEL 1 - DETERMINISTIC SANITIZATION"
REQ_ID=$(uuidgen 2>/dev/null || echo "test-$$")
MESSY='Here you go:\n```json\n{"title": "Cool", "tags": [1,2,3,],}\n```\nEnjoy!'
BODY=$(jq -n --arg id "$REQ_ID" --arg data "$MESSY" '{request:{request_id:$id}, source:{stack:"test", operation:"structure"}, input:{type:"string", data:$data}}')
resp=$(req POST /v1/structure "$BODY"); code=$(echo "$resp" | tail -1); body=$(echo "$resp" | sed '$d')
[ "$code" = "200" ] && pass "/v1/structure recovers code-fenced + trailing comma JSON" || fail "/v1/structure recovers code-fenced + trailing comma JSON (got $code)"
echo "$body" | jq . 2>/dev/null || echo "$body"
echo "$body" | jq -e '.recovery.attempted == true' >/dev/null 2>&1 && pass "recovery.attempted true" || fail "recovery.attempted true"

section "4. LEVEL 2/4 - SCHEMA-GUIDED RECONSTRUCTION (no hallucination)"
REQ_ID=$(uuidgen 2>/dev/null || echo "test-$$-2")
BODY=$(jq -n --arg id "$REQ_ID" '{request:{request_id:$id}, source:{stack:"test", operation:"structure"}, input:{type:"json", data:{title:"hi", prompt:"draw a cat", extra_field:"oops"}}, schema:{key:"image_prompt"}}')
resp=$(req POST /v1/structure "$BODY"); code=$(echo "$resp" | tail -1); body=$(echo "$resp" | sed '$d')
[ "$code" = "200" ] && pass "/v1/structure maps onto image_prompt skeleton" || fail "/v1/structure maps onto image_prompt skeleton (got $code)"
echo "$body" | jq -e '.result.data.negative_prompt == null' >/dev/null 2>&1 && pass "missing field stayed null, not invented" || fail "missing field stayed null, not invented"
echo "$body" | jq -e '.result.data.title == "hi"' >/dev/null 2>&1 && pass "known field preserved" || fail "known field preserved"

section "5. LEVEL 3 - CHUNKING"
BIGARR=$(node -e "console.log(JSON.stringify(Array.from({length:400},(_,i)=>({id:i, text:'x'.repeat(60)}))))" 2>/dev/null || echo '[]')
REQ_ID=$(uuidgen 2>/dev/null || echo "test-$$-3")
BODY=$(jq -n --arg id "$REQ_ID" --argjson data "$BIGARR" '{request:{request_id:$id}, source:{stack:"test", operation:"structure"}, input:{type:"json", data:$data}, options:{max_size:2000}}')
resp=$(req POST /v1/structure "$BODY"); code=$(echo "$resp" | tail -1); body=$(echo "$resp" | sed '$d')
[ "$code" = "200" ] && pass "/v1/structure handles oversized array" || fail "/v1/structure handles oversized array (got $code)"
echo "$body" | jq -e '.chunking.enabled == true' >/dev/null 2>&1 && pass "chunking enabled for oversized payload" || fail "chunking enabled for oversized payload"

section "6. LEVEL 6 - CONTROLLED FAILURE (no AI recovery, still malformed)"
REQ_ID=$(uuidgen 2>/dev/null || echo "test-$$-4")
BODY=$(jq -n --arg id "$REQ_ID" '{request:{request_id:$id}, source:{stack:"test", operation:"structure"}, input:{type:"string", data:"this is just prose, not JSON at all, no braces"}, options:{allow_ai_recovery:false}}')
resp=$(req POST /v1/structure "$BODY"); code=$(echo "$resp" | tail -1); body=$(echo "$resp" | sed '$d')
[ "$code" = "422" ] && pass "/v1/structure returns controlled failure (422)" || fail "/v1/structure returns controlled failure (got $code)"
echo "$body" | jq -e '.error.code == "JSON_RECOVERY_FAILED"' >/dev/null 2>&1 && pass "error_code JSON_RECOVERY_FAILED" || fail "error_code JSON_RECOVERY_FAILED"
echo "$body" | jq -e '.result.data == null' >/dev/null 2>&1 && pass "never returns fake valid JSON" || fail "never returns fake valid JSON"

section "7. SCHEMA REGISTRY"
resp=$(req GET /v1/schemas); code=$(echo "$resp" | tail -1); body=$(echo "$resp" | sed '$d')
[ "$code" = "200" ] && pass "/v1/schemas HTTP 200" || fail "/v1/schemas HTTP 200 (got $code)"
echo "$body" | jq -e '.schemas | length >= 4' >/dev/null 2>&1 && pass "seeded schemas present" || fail "seeded schemas present"

resp=$(req GET /v1/schemas/image_prompt); code=$(echo "$resp" | tail -1); body=$(echo "$resp" | sed '$d')
[ "$code" = "200" ] && pass "/v1/schemas/image_prompt HTTP 200" || fail "/v1/schemas/image_prompt HTTP 200 (got $code)"

section "8. EVENTS / ANOMALIES"
resp=$(req GET /v1/events); code=$(echo "$resp" | tail -1)
[ "$code" = "200" ] && pass "/v1/events HTTP 200" || fail "/v1/events HTTP 200 (got $code)"
resp=$(req GET /v1/anomalies); code=$(echo "$resp" | tail -1)
[ "$code" = "200" ] && pass "/v1/anomalies HTTP 200" || fail "/v1/anomalies HTTP 200 (got $code)"

section "9. ASYNC JOB QUEUE"
REQ_ID=$(uuidgen 2>/dev/null || echo "test-$$-5")
BODY=$(jq -n --arg id "$REQ_ID" '{request:{request_id:$id}, source:{stack:"test", operation:"structure"}, input:{type:"json", data:{title:"async"}}, schema:{key:"generic_ai_response"}}')
resp=$(req POST /v1/jobs "$BODY"); code=$(echo "$resp" | tail -1); body=$(echo "$resp" | sed '$d')
[ "$code" = "202" ] && pass "/v1/jobs enqueue HTTP 202" || fail "/v1/jobs enqueue HTTP 202 (got $code)"
JOB_ID=$(echo "$body" | jq -r '.job.id' 2>/dev/null)
sleep 1
resp=$(req GET "/v1/jobs/$JOB_ID"); code=$(echo "$resp" | tail -1)
[ "$code" = "200" ] && pass "/v1/jobs/:id status HTTP 200" || fail "/v1/jobs/:id status HTTP 200 (got $code)"

section "DAY 6 TEST SUMMARY"
echo "Passed : $PASS"
echo "Failed : $FAIL"
if [ "$FAIL" -eq 0 ]; then
  echo "RESULT: DAY 6 DATA INTELLIGENCE PASSED"
  exit 0
else
  echo "RESULT: DAY 6 DATA INTELLIGENCE FAILED"
  exit 1
fi
