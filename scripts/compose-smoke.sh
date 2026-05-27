#!/usr/bin/env bash
# =====================================================================
# Money Management — Docker Compose smoke test
#
# Brings up the full stack (postgres / redis / rabbitmq / ai-service /
# backend), waits for backend & AI service health, and exercises the
# critical end-to-end paths a user actually hits:
#
#   1. Register a fresh test user
#   2. Login (verifies JWT issuance)
#   3. Forward a fake bank SMS
#   4. Confirm a transaction was extracted and persisted
#   5. Smoke-check an AI-proxied endpoint (health-score)
#
# The test uses the host port mappings declared in docker-compose.yml:
#   - backend:    http://localhost:3000
#   - ai-service: http://localhost:8000
#
# Pass --keep-up to leave containers running after the test (useful
# when iterating). The default behaviour stops them on exit so the
# script is safe for CI.
# =====================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"
AI_URL="${AI_URL:-http://localhost:8000}"
KEEP_UP=false
SKIP_BUILD=false

for arg in "$@"; do
  case "$arg" in
    --keep-up) KEEP_UP=true ;;
    --skip-build) SKIP_BUILD=true ;;
    -h|--help)
      sed -n '2,/^# ====/p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
  esac
done

# ---------- helpers ----------
log()   { printf "\033[1;36m[smoke]\033[0m %s\n" "$*"; }
ok()    { printf "\033[1;32m[ ok  ]\033[0m %s\n" "$*"; }
fail()  { printf "\033[1;31m[FAIL]\033[0m %s\n" "$*" >&2; exit 1; }

# Pick a compose CLI: prefer `docker compose` (v2), fall back to the
# legacy `docker-compose` binary if that's all the user has.
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  fail "Neither 'docker compose' nor 'docker-compose' is available."
fi

cleanup() {
  local code=$?
  if [[ "$KEEP_UP" == "false" ]]; then
    log "Tearing down stack..."
    "${COMPOSE[@]}" down --remove-orphans >/dev/null 2>&1 || true
  else
    log "Leaving stack up (--keep-up). Run '${COMPOSE[*]} down' when done."
  fi
  exit $code
}
trap cleanup EXIT INT TERM

require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    fail "This script requires 'jq'. Install via 'apt install jq' or 'brew install jq'."
  fi
}

wait_for() {
  local name="$1" url="$2" timeout="${3:-180}"
  log "Waiting up to ${timeout}s for ${name} (${url})..."
  local start=$SECONDS
  while (( SECONDS - start < timeout )); do
    if curl --fail --silent --max-time 3 -o /dev/null "$url"; then
      ok "${name} reachable after $((SECONDS - start))s"
      return 0
    fi
    sleep 2
  done
  log "----- ${name} failed to come up; recent logs: -----"
  "${COMPOSE[@]}" logs --tail=80 || true
  fail "${name} did not become healthy within ${timeout}s"
}

api_post() {
  # Usage: api_post <url> <json> [auth-header]
  local url="$1" body="$2" auth="${3:-}"
  local args=(--silent --show-error --max-time 30
              --header "Content-Type: application/json"
              --data "$body")
  if [[ -n "$auth" ]]; then
    args+=(--header "Authorization: Bearer $auth")
  fi
  curl "${args[@]}" "$url"
}

api_get() {
  local url="$1" auth="${2:-}"
  local args=(--silent --show-error --max-time 30)
  if [[ -n "$auth" ]]; then
    args+=(--header "Authorization: Bearer $auth")
  fi
  curl "${args[@]}" "$url"
}

# ---------- 0. preflight ----------
require_jq
log "Compose CLI: ${COMPOSE[*]}"

# ---------- 1. bring up the stack ----------
if [[ "$SKIP_BUILD" == "false" ]]; then
  log "Building images..."
  "${COMPOSE[@]}" build backend ai-service
fi

log "Starting services..."
"${COMPOSE[@]}" up -d postgres redis rabbitmq ai-service backend

# ---------- 2. wait for liveness ----------
wait_for "ai-service" "${AI_URL}/health" 240
wait_for "backend"    "${BACKEND_URL}/api/v1/health" 240

# ---------- 3. register + login ----------
EMAIL="smoke+$(date +%s)@moneymind.test"
PASSWORD="Smoke@123456"

log "Registering ${EMAIL}..."
REG_RESPONSE=$(api_post "${BACKEND_URL}/api/v1/auth/register" \
  "$(jq -nc --arg e "$EMAIL" --arg p "$PASSWORD" \
    '{email:$e, password:$p, name:"Smoke Test"}')")

# Backend wraps responses in { success, data, message }. Tokens land
# under .data.accessToken.
ACCESS_TOKEN=$(echo "$REG_RESPONSE" | jq -r '.data.accessToken // .accessToken // empty')
USER_ID=$(echo "$REG_RESPONSE"     | jq -r '.data.user.id      // .user.id      // empty')
[[ -n "$ACCESS_TOKEN" ]] || { echo "$REG_RESPONSE" | jq . >&2; fail "Registration did not return an accessToken"; }
[[ -n "$USER_ID" ]]      || { echo "$REG_RESPONSE" | jq . >&2; fail "Registration did not return a user id"; }
ok "Registered user ${USER_ID}"

log "Logging in..."
LOGIN_RESPONSE=$(api_post "${BACKEND_URL}/api/v1/auth/login" \
  "$(jq -nc --arg e "$EMAIL" --arg p "$PASSWORD" '{email:$e, password:$p}')")
LOGIN_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken // .accessToken // empty')
[[ -n "$LOGIN_TOKEN" ]] || { echo "$LOGIN_RESPONSE" | jq . >&2; fail "Login did not return an accessToken"; }
ok "Login OK"

# Use the login token from here on.
TOKEN="$LOGIN_TOKEN"

# ---------- 4. forward a fake bank SMS ----------
SMS_BODY='Rs. 1499.00 debited from a/c ending 1234 at Netflix. Avl bal: 12,345.00. -HDFCBK'
log "Forwarding SMS through /sms/ingest..."
SMS_RESPONSE=$(api_post "${BACKEND_URL}/api/v1/sms/ingest" \
  "$(jq -nc --arg b "$SMS_BODY" \
    '{body:$b, sender:"HDFCBK", phoneNumber:"+919999999999", timestamp:(now|todate)}')" \
  "$TOKEN")

CREATED=$(echo "$SMS_RESPONSE" | jq -r '.data.transactionCreated // .transactionCreated // false')
TX_ID=$(  echo "$SMS_RESPONSE" | jq -r '.data.transactionId      // .transactionId      // empty')
PARSED_AMOUNT=$(echo "$SMS_RESPONSE" | jq -r '.data.parsed.amount // .parsed.amount // empty')

if [[ "$CREATED" != "true" ]]; then
  echo "$SMS_RESPONSE" | jq . >&2
  fail "SMS ingestion did not create a transaction (transactionCreated=$CREATED)"
fi
ok "SMS → transaction ${TX_ID} created (amount=${PARSED_AMOUNT})"

# ---------- 5. confirm the transaction is queryable ----------
log "Listing transactions to confirm persistence..."
TX_LIST=$(api_get "${BACKEND_URL}/api/v1/transactions" "$TOKEN")
TX_COUNT=$(echo "$TX_LIST" | jq '(.data // .) | length')
if [[ "${TX_COUNT:-0}" -lt 1 ]]; then
  echo "$TX_LIST" | jq . >&2
  fail "Expected at least 1 transaction, got ${TX_COUNT}"
fi
ok "Transactions list returned ${TX_COUNT} row(s)"

# ---------- 6. smoke-check an AI-proxied endpoint ----------
# Best-effort: this exercises the backend → AI service round-trip but
# we treat a 5xx from AI as non-fatal (the LLM key may be unset).
log "Calling /ai/health-score (best-effort)..."
HEALTH_SCORE=$(api_get "${BACKEND_URL}/api/v1/ai/health-score" "$TOKEN" || true)
HEALTH_OK=$(echo "$HEALTH_SCORE" | jq -r '.success // false')
if [[ "$HEALTH_OK" == "true" ]]; then
  ok "AI proxy returned a health-score response"
else
  log "AI proxy did not return success (this is OK if no transactions yet):"
  echo "$HEALTH_SCORE" | jq -c '.' || echo "$HEALTH_SCORE"
fi

ok "Smoke test passed ✅"
