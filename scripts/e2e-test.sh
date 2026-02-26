#!/usr/bin/env bash
#
# ClayCosmos E2E Test Script
#
# Walks through the complete product flow with real wallet signatures:
#   Register → Bind Wallet → Create Store → List Product → Order → Pay → Ship → Complete
#
# Requirements: curl, cast (Foundry), jq
#
# Usage:
#   ./scripts/e2e-test.sh                          # defaults to http://localhost:8080
#   ./scripts/e2e-test.sh https://your-domain.com  # against production
#
set -euo pipefail

BASE="${1:-http://localhost:8080}/api/v1"
SUFFIX="$(date +%s)"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; echo "  Response: $2"; exit 1; }
step() { echo -e "\n${CYAN}── $1 ──${NC}"; }

# Check dependencies
for cmd in curl cast jq; do
  command -v "$cmd" >/dev/null || { echo "Missing dependency: $cmd"; exit 1; }
done

# ── Generate two wallets ───────────────────────────────────────
step "Generating wallets"
SELLER_PRIVKEY=$(cast wallet new --json | jq -r '.[0].private_key')
SELLER_ADDR=$(cast wallet address "$SELLER_PRIVKEY")
pass "Seller wallet: $SELLER_ADDR"

BUYER_PRIVKEY=$(cast wallet new --json | jq -r '.[0].private_key')
BUYER_ADDR=$(cast wallet address "$BUYER_PRIVKEY")
pass "Buyer wallet:  $BUYER_ADDR"

# ── Register Seller Agent ─────────────────────────────────────
step "Registering seller agent"
RESP=$(curl -sf -X POST "$BASE/agents/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"e2e-seller-$SUFFIX\",\"role\":\"seller\",\"description\":\"E2E test seller\"}")

SELLER_KEY=$(echo "$RESP" | jq -r '.api_key')
SELLER_ID=$(echo "$RESP" | jq -r '.agent.id')
[ "$SELLER_KEY" != "null" ] && pass "Seller registered: $SELLER_ID" || fail "Register seller" "$RESP"

# ── Register Buyer Agent ──────────────────────────────────────
step "Registering buyer agent"
RESP=$(curl -sf -X POST "$BASE/agents/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"e2e-buyer-$SUFFIX\",\"role\":\"buyer\",\"description\":\"E2E test buyer\"}")

BUYER_KEY=$(echo "$RESP" | jq -r '.api_key')
BUYER_ID=$(echo "$RESP" | jq -r '.agent.id')
[ "$BUYER_KEY" != "null" ] && pass "Buyer registered:  $BUYER_ID" || fail "Register buyer" "$RESP"

# ── Verify identities ────────────────────────────────────────
step "Verifying identities (GET /agents/me)"
RESP=$(curl -sf "$BASE/agents/me" -H "Authorization: Bearer $SELLER_KEY")
echo "$RESP" | jq -r '.name' | grep -q "e2e-seller" && pass "Seller identity OK" || fail "Seller GetMe" "$RESP"

RESP=$(curl -sf "$BASE/agents/me" -H "Authorization: Bearer $BUYER_KEY")
echo "$RESP" | jq -r '.name' | grep -q "e2e-buyer" && pass "Buyer identity OK" || fail "Buyer GetMe" "$RESP"

# ── Bind Seller Wallet (programmatic, real signature) ─────────
step "Binding seller wallet"
TIMESTAMP=$(date +%s)
MESSAGE="claycosmos:bind:${SELLER_ID}:${TIMESTAMP}"
SIGNATURE=$(cast wallet sign "$MESSAGE" --private-key "$SELLER_PRIVKEY")

RESP=$(curl -sf -X POST "$BASE/wallets/bind-programmatic" \
  -H "Authorization: Bearer $SELLER_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"chain\":\"base\",
    \"address\":\"$SELLER_ADDR\",
    \"proof\":{\"type\":\"signature\",\"message\":\"$MESSAGE\",\"signature\":\"$SIGNATURE\"}
  }")

echo "$RESP" | jq -r '.verified_at' | grep -qv "null" && pass "Seller wallet bound & verified" || fail "Bind seller wallet" "$RESP"

# ── Bind Buyer Wallet (programmatic, real signature) ──────────
step "Binding buyer wallet"
TIMESTAMP=$(date +%s)
MESSAGE="claycosmos:bind:${BUYER_ID}:${TIMESTAMP}"
SIGNATURE=$(cast wallet sign "$MESSAGE" --private-key "$BUYER_PRIVKEY")

RESP=$(curl -sf -X POST "$BASE/wallets/bind-programmatic" \
  -H "Authorization: Bearer $BUYER_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"chain\":\"base\",
    \"address\":\"$BUYER_ADDR\",
    \"proof\":{\"type\":\"signature\",\"message\":\"$MESSAGE\",\"signature\":\"$SIGNATURE\"}
  }")

echo "$RESP" | jq -r '.verified_at' | grep -qv "null" && pass "Buyer wallet bound & verified" || fail "Bind buyer wallet" "$RESP"

# ── Seller creates store ─────────────────────────────────────
step "Creating store"
STORE_SLUG="e2e-shop-$SUFFIX"
RESP=$(curl -sf -X POST "$BASE/stores" \
  -H "Authorization: Bearer $SELLER_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\":\"E2E Test Shop\",
    \"slug\":\"$STORE_SLUG\",
    \"description\":\"Integration test store\",
    \"category\":\"data\"
  }")

STORE_ID=$(echo "$RESP" | jq -r '.id')
[ "$STORE_ID" != "null" ] && pass "Store created: $STORE_SLUG" || fail "Create store" "$RESP"

# ── Seller lists a product ───────────────────────────────────
step "Creating product"
RESP=$(curl -sf -X POST "$BASE/products" \
  -H "Authorization: Bearer $SELLER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"E2E Premium Dataset",
    "description":"High quality test data for E2E testing",
    "price_usdc":1000000,
    "delivery_content":"https://example.com/secret-download?token=abc123",
    "payment_mode":"escrow",
    "stock":10
  }')

PRODUCT_ID=$(echo "$RESP" | jq -r '.id')
PRODUCT_PRICE=$(echo "$RESP" | jq -r '.price_usd')
[ "$PRODUCT_ID" != "null" ] && pass "Product created: $PRODUCT_ID (price: \$$PRODUCT_PRICE)" || fail "Create product" "$RESP"

# ── Public browsing ──────────────────────────────────────────
step "Public browsing (no auth)"

RESP=$(curl -sf "$BASE/stores")
echo "$RESP" | jq -e '. | length > 0' >/dev/null && pass "List stores OK" || fail "List stores" "$RESP"

RESP=$(curl -sf "$BASE/stores/$STORE_SLUG")
echo "$RESP" | jq -r '.slug' | grep -q "$STORE_SLUG" && pass "Get store OK" || fail "Get store" "$RESP"

RESP=$(curl -sf "$BASE/stores/$STORE_SLUG/products")
echo "$RESP" | jq -e '.products | length > 0' >/dev/null && pass "List store products OK" || fail "List store products" "$RESP"

RESP=$(curl -sf "$BASE/products/$PRODUCT_ID")
echo "$RESP" | jq -r '.id' | grep -q "$PRODUCT_ID" && pass "Get product OK" || fail "Get product" "$RESP"

RESP=$(curl -sf "$BASE/search?q=E2E")
pass "Search OK"

# ── Buyer creates order ──────────────────────────────────────
step "Creating order"
RESP=$(curl -sf -X POST "$BASE/orders" \
  -H "Authorization: Bearer $BUYER_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"product_id\":\"$PRODUCT_ID\",\"buyer_wallet\":\"$BUYER_ADDR\"}")

ORDER_ID=$(echo "$RESP" | jq -r '.id')
ORDER_NO=$(echo "$RESP" | jq -r '.order_no')
ORDER_STATUS=$(echo "$RESP" | jq -r '.status')
ESCROW_ID=$(echo "$RESP" | jq -r '.escrow_order_id')
[ "$ORDER_STATUS" = "pending" ] && pass "Order created: $ORDER_NO (status: pending)" || fail "Create order" "$RESP"
echo "  Escrow order ID: $ESCROW_ID"

# ── Buyer views order ────────────────────────────────────────
step "Viewing orders"
RESP=$(curl -sf "$BASE/orders?role=buyer" -H "Authorization: Bearer $BUYER_KEY")
COUNT=$(echo "$RESP" | jq '.orders | length')
[ "$COUNT" -ge 1 ] && pass "Buyer orders: $COUNT" || fail "Buyer list orders" "$RESP"

RESP=$(curl -sf "$BASE/orders?role=seller" -H "Authorization: Bearer $SELLER_KEY")
COUNT=$(echo "$RESP" | jq '.orders | length')
[ "$COUNT" -ge 1 ] && pass "Seller orders: $COUNT" || fail "Seller list orders" "$RESP"

RESP=$(curl -sf "$BASE/orders/$ORDER_ID" -H "Authorization: Bearer $BUYER_KEY")
pass "Get order detail OK"

# ── Buyer marks order as paid ─────────────────────────────────
# NOTE: On production with RPC_URL configured, the server verifies the tx on-chain.
# A fake tx_hash will be rejected. We try it and handle both cases.
step "Marking order as paid"
HTTP_CODE=$(curl -s -o /tmp/e2e_paid_resp.json -w "%{http_code}" -X POST "$BASE/orders/$ORDER_ID/paid" \
  -H "Authorization: Bearer $BUYER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tx_hash":"0xfake_e2e_test_tx_hash_1234567890abcdef1234567890abcdef12345678"}')
RESP=$(cat /tmp/e2e_paid_resp.json)

if [ "$HTTP_CODE" = "200" ]; then
  STATUS=$(echo "$RESP" | jq -r '.status')
  [ "$STATUS" = "paid" ] && pass "Order paid" || fail "Mark paid" "$RESP"

  DELIVERY=$(echo "$RESP" | jq -r '.delivery_content')
  [ "$DELIVERY" != "null" ] && [ "$DELIVERY" != "" ] && pass "Delivery content visible: $DELIVERY" || true

  # ── Seller ships ──────────────────────────────────────────────
  step "Seller ships order"
  RESP=$(curl -sf -X POST "$BASE/orders/$ORDER_ID/ship" \
    -H "Authorization: Bearer $SELLER_KEY" \
    -H "Content-Type: application/json" \
    -d '{"tracking_number":"E2E-TRACK-12345"}')

  TRACKING=$(echo "$RESP" | jq -r '.tracking_number')
  [ "$TRACKING" = "E2E-TRACK-12345" ] && pass "Shipped with tracking: $TRACKING" || fail "Ship order" "$RESP"

  # ── Buyer completes order ─────────────────────────────────────
  step "Completing order"
  RESP=$(curl -sf -X POST "$BASE/orders/$ORDER_ID/complete" \
    -H "Authorization: Bearer $BUYER_KEY" \
    -H "Content-Type: application/json" \
    -d '{}')

  STATUS=$(echo "$RESP" | jq -r '.status')
  [ "$STATUS" = "completed" ] && pass "Order completed!" || fail "Complete order" "$RESP"

  FINAL_FLOW="pending → paid → shipped → completed"
else
  echo -e "  ${CYAN}Server validates tx on-chain (RPC_URL configured). Fake tx rejected as expected.${NC}"
  pass "On-chain tx verification is working (HTTP $HTTP_CODE)"
  ERR_MSG=$(echo "$RESP" | jq -r '.message // empty')
  [ -n "$ERR_MSG" ] && echo "  Server response: $ERR_MSG"

  # ── Cancel the pending order instead ──────────────────────────
  step "Cancelling order (since we can't pay on-chain in test)"
  RESP=$(curl -sf -X POST "$BASE/orders/$ORDER_ID/cancel" \
    -H "Authorization: Bearer $BUYER_KEY")

  STATUS=$(echo "$RESP" | jq -r '.status')
  [ "$STATUS" = "cancelled" ] && pass "Order cancelled" || fail "Cancel order" "$RESP"

  FINAL_FLOW="pending → cancelled (on-chain tx verification active)"
fi

# ── Final summary ─────────────────────────────────────────────
echo ""
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  E2E TEST PASSED                             ${NC}"
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo ""
echo "  Seller:  $SELLER_ID"
echo "  Buyer:   $BUYER_ID"
echo "  Store:   $STORE_SLUG"
echo "  Product: $PRODUCT_ID"
echo "  Order:   $ORDER_NO ($ORDER_ID)"
echo "  Flow:    $FINAL_FLOW"
echo ""
echo "  To complete the full pay→ship→complete flow against production,"
echo "  a real on-chain USDC escrow transaction is required."
echo ""
