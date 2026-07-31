#!/usr/bin/env bash
# =============================================================================
# Samyoj Webhook Test Script
# =============================================================================
# Simulates Meta WhatsApp webhook events against a local or ngrok endpoint.
#
# Usage:
#   bash scripts/test-webhook.sh
#   WEBHOOK_URL=https://samyoj-dev.ngrok-free.app/api/whatsapp/webhook bash scripts/test-webhook.sh
#   bash scripts/test-webhook.sh --ngrok     # auto-detect ngrok URL
#
# Prerequisites:
#   - Server running on localhost:8000 (or ngrok tunnel active)
#   - A connected WhatsApp number with phone_number_id in the system
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

WEBHOOK_URL="${WEBHOOK_URL:-http://localhost:8000/api/whatsapp/webhook}"
HEALTH_URL="${HEALTH_URL:-http://localhost:8000/api/whatsapp/webhook/health}"

# Parse args
for arg in "$@"; do
  case "$arg" in
    --ngrok)
      WEBHOOK_URL="https://samyoj-dev.ngrok-free.app/api/whatsapp/webhook"
      HEALTH_URL="https://samyoj-dev.ngrok-free.app/api/whatsapp/webhook/health"
      ;;
  esac
done

echo ""
echo -e "${CYAN}  Samyoj Webhook Test Suite${NC}"
echo "  ─────────────────────────"
echo -e "  Webhook URL : ${YELLOW}$WEBHOOK_URL${NC}"
echo -e "  Health URL  : ${YELLOW}$HEALTH_URL${NC}"
echo ""

# ---- Test helpers -----------------------------------------------------------
pass() {
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}✓ PASS${NC}  $1"
}

fail() {
  FAIL=$((FAIL + 1))
  echo -e "  ${RED}✗ FAIL${NC}  $1 — $2"
}

http_get() {
  curl -s -o /dev/null -w "%{http_code}" "$1" 2>/dev/null || echo "000"
}

http_post() {
  curl -s -o /dev/null -w "%{http_code}" \
    -H "Content-Type: application/json" \
    -d "$2" \
    "$1" 2>/dev/null || echo "000"
}

# ---- Test 1: Webhook Health Endpoint ----------------------------------------
echo -e "${CYAN}[Test 1]${NC} Health endpoint responds"
STATUS=$(http_get "$HEALTH_URL")
if [[ "$STATUS" -ge 200 && "$STATUS" -lt 300 ]]; then
  pass "Health endpoint returned HTTP $STATUS"
else
  fail "Health endpoint returned HTTP $STATUS" "Server may not be running"
fi

# ---- Test 2: GET webhook verification ---------------------------------------
echo -e "${CYAN}[Test 2]${NC} GET webhook verification with wrong token"
STATUS=$(http_get "${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=challenge123")
if [[ "$STATUS" == "403" ]]; then
  pass "Wrong verify_token correctly returns 403"
else
  fail "Wrong verify_token should return 403, got $STATUS" "Check META_VERIFY_TOKEN"
fi

# ---- Test 3: GET webhook missing params -------------------------------------
echo -e "${CYAN}[Test 3]${NC} GET webhook missing params"
STATUS=$(http_get "$WEBHOOK_URL")
if [[ "$STATUS" == "400" ]]; then
  pass "Missing params returns 400"
else
  fail "Missing params should return 400, got $STATUS" "GET handler validation"
fi

# ---- Test 4: POST simulated text message ------------------------------------
echo -e "${CYAN}[Test 4]${NC} POST simulated inbound text message"
PHONE_NUMBER_ID="${META_PHONE_NUMBER_ID:-1232697013259378}"
SENDER="${TEST_SENDER:-917489739171}"

PAYLOAD='{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "1092831843405093",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15551977746",
          "phone_number_id": "'"$PHONE_NUMBER_ID"'"
        },
        "contacts": [{
          "profile": { "name": "Test User" },
          "wa_id": "'"$SENDER"'"
        }],
        "messages": [{
          "from": "'"$SENDER"'",
          "id": "wamid.test_'$(date +%s)'_'$$'",
          "timestamp": "'$(date +%s)'",
          "type": "text",
          "text": { "body": "Hello from Samyoj webhook test! ('"$(date '+%H:%M:%S')"')" }
        }]
      },
      "field": "messages"
    }]
  }]
}'

STATUS=$(http_post "$WEBHOOK_URL" "$PAYLOAD")
if [[ "$STATUS" == "200" ]]; then
  pass "Inbound text message accepted (HTTP 200)"
else
  fail "Inbound text message returned $STATUS" "Expected 200 EVENT_RECEIVED"
fi

# ---- Test 5: POST simulated image message -----------------------------------
echo -e "${CYAN}[Test 5]${NC} POST simulated inbound image message"
IMAGE_PAYLOAD='{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "1092831843405093",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15551977746",
          "phone_number_id": "'"$PHONE_NUMBER_ID"'"
        },
        "contacts": [{
          "profile": { "name": "Test User" },
          "wa_id": "'"$SENDER"'"
        }],
        "messages": [{
          "from": "'"$SENDER"'",
          "id": "wamid.test_img_'$(date +%s)'_'$$'",
          "timestamp": "'$(date +%s)'",
          "type": "image",
          "image": {
            "mime_type": "image/jpeg",
            "sha256": "abc123",
            "id": "123456"
          }
        }]
      },
      "field": "messages"
    }]
  }]
}'

STATUS=$(http_post "$WEBHOOK_URL" "$IMAGE_PAYLOAD")
if [[ "$STATUS" == "200" ]]; then
  pass "Inbound image message accepted (HTTP 200)"
else
  fail "Inbound image message returned $STATUS" "Expected 200"
fi

# ---- Test 6: POST non-WABA payload (should still 200) -----------------------
echo -e "${CYAN}[Test 6]${NC} POST non-WABA payload (should silently accept)"
STATUS=$(http_post "$WEBHOOK_URL" '{"object":"page","entry":[]}')
if [[ "$STATUS" == "200" ]]; then
  pass "Non-WABA payload returns 200 (no retry)"
else
  fail "Non-WABA payload returned $STATUS" "Should return 200 so Meta doesn't retry"
fi

# ---- Test 7: POST empty JSON object (edge case) ------------------------------
echo -e "${CYAN}[Test 7]${NC} POST empty JSON object"
STATUS=$(http_post "$WEBHOOK_URL" '{}')
if [[ "$STATUS" == "200" ]]; then
  pass "Empty JSON object returns 200 (harmless, no WABA marker)"
else
  fail "Empty JSON object returned $STATUS" "Expected 200 — non-WABA payload"
fi

# ---- Test 8: POST button reply message --------------------------------------
echo -e "${CYAN}[Test 8]${NC} POST simulated button reply"
BUTTON_PAYLOAD='{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "1092831843405093",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15551977746",
          "phone_number_id": "'"$PHONE_NUMBER_ID"'"
        },
        "contacts": [{
          "profile": { "name": "Test User" },
          "wa_id": "'"$SENDER"'"
        }],
        "messages": [{
          "from": "'"$SENDER"'",
          "id": "wamid.test_btn_'$(date +%s)'_'$$'",
          "timestamp": "'$(date +%s)'",
          "type": "button",
          "button": { "payload": "yes_btn", "text": "Yes" }
        }]
      },
      "field": "messages"
    }]
  }]
}'

STATUS=$(http_post "$WEBHOOK_URL" "$BUTTON_PAYLOAD")
if [[ "$STATUS" == "200" ]]; then
  pass "Button reply message accepted (HTTP 200)"
else
  fail "Button reply returned $STATUS" "Expected 200"
fi

# ---- Test 9: POST message status update -------------------------------------
echo -e "${CYAN}[Test 9]${NC} POST simulated message status update"
STATUS_PAYLOAD='{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "1092831843405093",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15551977746",
          "phone_number_id": "'"$PHONE_NUMBER_ID"'"
        },
        "statuses": [{
          "id": "wamid.test_status_'$(date +%s)'_'$$'",
          "status": "read",
          "timestamp": "'$(date +%s)'",
          "recipient_id": "'"$SENDER"'"
        }]
      },
      "field": "messages"
    }]
  }]
}'

STATUS=$(http_post "$WEBHOOK_URL" "$STATUS_PAYLOAD")
if [[ "$STATUS" == "200" ]]; then
  pass "Status update accepted (HTTP 200)"
else
  fail "Status update returned $STATUS" "Expected 200"
fi

# ---- Test 10: Webhook Health after tests ------------------------------------
echo -e "${CYAN}[Test 10]${NC} Health endpoint shows received webhooks"
sleep 1  # Give BullMQ a moment to process
HEALTH_DATA=$(curl -s "$HEALTH_URL" 2>/dev/null || echo '{}')
RECEIVED=$(echo "$HEALTH_DATA" | grep -o '"totalReceived":[0-9]*' | grep -o '[0-9]*' || echo "0")
if [[ "$RECEIVED" -gt 0 ]]; then
  pass "Health shows $RECEIVED webhooks received"
else
  fail "Health shows 0 webhooks received" "Webhook POST may not be tracking or Redis is down"
fi

# ---- Test 11: GET webhook with correct verify_token --------------------------
echo -e "${CYAN}[Test 11]${NC} GET webhook verification with correct token"
VERIFY_TOKEN="${META_VERIFY_TOKEN:-wa_ce10dbd95d0978d23b06f86a702887c258d6d3fd6a2e44e9}"
RESPONSE=$(curl -s "${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=TEST_CHALLENGE_123" 2>/dev/null)
if [[ "$RESPONSE" == "TEST_CHALLENGE_123" ]]; then
  pass "Correct verify_token returns challenge string"
else
  fail "Correct verify_token should return challenge, got: $RESPONSE" "Verify META_VERIFY_TOKEN in .env"
fi

# ---- Summary ----------------------------------------------------------------
echo ""
echo -e "${CYAN}  ──────────────────────────────${NC}"
echo -e "  ${GREEN}Passed: $PASS${NC}  |  ${RED}Failed: $FAIL${NC}  |  Total: $((PASS + FAIL))"
echo ""

if [[ "$FAIL" -eq 0 ]]; then
  echo -e "  ${GREEN}All webhook tests passed!${NC}"
  echo ""
  exit 0
else
  echo -e "  ${RED}Some tests failed. Check the server logs for details.${NC}"
  echo ""
  exit 1
fi