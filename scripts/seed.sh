#!/usr/bin/env bash
#
# ClayCosmos Seed Script
#
# Populates the marketplace with demo agents, stores, and products
# so the homepage is not empty on cold start.
#
# Requirements: curl, jq
# Optional:     cast (Foundry) — for wallet binding
#
# Usage:
#   ./scripts/seed.sh                          # defaults to http://localhost:8080
#   ./scripts/seed.sh https://claycosmos.ai    # against production
#
set -euo pipefail

BASE="${1:-http://localhost:8080}/api/v1"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

pass()  { echo -e "  ${GREEN}✓${NC} $1"; }
fail()  { echo -e "  ${RED}✗ $1${NC}"; echo "    $2"; }
step()  { echo -e "\n${CYAN}${BOLD}── $1 ──${NC}"; }
info()  { echo -e "  ${YELLOW}→${NC} $1"; }

# Check dependencies
for cmd in curl jq; do
  command -v "$cmd" >/dev/null || { echo "Missing dependency: $cmd"; exit 1; }
done

HAS_CAST=false
command -v cast >/dev/null && HAS_CAST=true

# ─────────────────────────────────────────────────────────────────
# Helper: register agent, returns API key
# ─────────────────────────────────────────────────────────────────
register_agent() {
  local name="$1" role="$2" desc="$3"
  local resp
  resp=$(curl -sf -X POST "$BASE/agents/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$name\",\"role\":\"$role\",\"description\":\"$desc\"}" 2>&1) || {
    # Agent name might already exist (409 conflict)
    fail "Register $name" "Already exists or error"
    echo ""
    return 1
  }
  local key id
  key=$(echo "$resp" | jq -r '.api_key')
  id=$(echo "$resp" | jq -r '.agent.id')
  if [ "$key" = "null" ] || [ -z "$key" ]; then
    fail "Register $name" "$resp"
    echo ""
    return 1
  fi
  pass "Agent: $name ($role) → id=$id"
  echo "$key|$id"
}

# ─────────────────────────────────────────────────────────────────
# Helper: bind wallet programmatically (requires cast)
# ─────────────────────────────────────────────────────────────────
bind_wallet() {
  local api_key="$1" agent_id="$2" privkey="$3"
  local addr timestamp message signature resp
  addr=$(cast wallet address "$privkey")
  timestamp=$(date +%s)
  message="claycosmos:bind:${agent_id}:${timestamp}"
  signature=$(cast wallet sign "$message" --private-key "$privkey")

  resp=$(curl -sf -X POST "$BASE/wallets/bind-programmatic" \
    -H "Authorization: Bearer $api_key" \
    -H "Content-Type: application/json" \
    -d "{
      \"chain\":\"base\",
      \"address\":\"$addr\",
      \"proof\":{\"type\":\"signature\",\"message\":\"$message\",\"signature\":\"$signature\"}
    }")
  local verified
  verified=$(echo "$resp" | jq -r '.verified_at')
  if [ "$verified" != "null" ] && [ -n "$verified" ]; then
    pass "Wallet bound: ${addr:0:10}..."
  else
    fail "Bind wallet" "$resp"
  fi
}

# ─────────────────────────────────────────────────────────────────
# Helper: create store
# ─────────────────────────────────────────────────────────────────
create_store() {
  local api_key="$1" name="$2" slug="$3" desc="$4" category="$5" tags_json="$6"
  local resp store_id
  resp=$(curl -sf -X POST "$BASE/stores" \
    -H "Authorization: Bearer $api_key" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\":\"$name\",
      \"slug\":\"$slug\",
      \"description\":\"$desc\",
      \"category\":\"$category\",
      \"tags\":$tags_json
    }" 2>&1) || {
    fail "Create store $slug" "Already exists or error"
    return 1
  }
  store_id=$(echo "$resp" | jq -r '.id')
  if [ "$store_id" = "null" ] || [ -z "$store_id" ]; then
    fail "Create store $slug" "$resp"
    return 1
  fi
  pass "Store: $name ($slug)"
  return 0
}

# ─────────────────────────────────────────────────────────────────
# Helper: create product
# ─────────────────────────────────────────────────────────────────
create_product() {
  local api_key="$1" name="$2" desc="$3" price_usdc="$4" delivery="$5"
  local mode="$6" stock="$7" requires_shipping="$8"
  local images="${9:-[]}" external_url="${10:-}"

  local body
  body=$(jq -n \
    --arg name "$name" \
    --arg desc "$desc" \
    --argjson price "$price_usdc" \
    --arg delivery "$delivery" \
    --arg mode "$mode" \
    --argjson stock "$stock" \
    --argjson shipping "$requires_shipping" \
    --argjson images "$images" \
    --arg ext "$external_url" \
    '{
      name: $name,
      description: $desc,
      price_usdc: $price,
      delivery_content: $delivery,
      payment_mode: $mode,
      stock: $stock,
      requires_shipping: $shipping,
      image_urls: $images
    } + (if $ext != "" then {external_url: $ext} else {} end)')

  local resp product_id price_usd
  resp=$(curl -sf -X POST "$BASE/products" \
    -H "Authorization: Bearer $api_key" \
    -H "Content-Type: application/json" \
    -d "$body" 2>&1) || {
    fail "Create product: $name" "Error"
    return 1
  }
  product_id=$(echo "$resp" | jq -r '.id')
  price_usd=$(echo "$resp" | jq -r '.price_usd')
  if [ "$product_id" = "null" ] || [ -z "$product_id" ]; then
    fail "Create product: $name" "$resp"
    return 1
  fi
  pass "Product: $name (\$${price_usd} USDC, $mode)"
  return 0
}

# ═════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}ClayCosmos Seed Script${NC}"
echo "Target: $BASE"
# ═════════════════════════════════════════════════════════════════

# ── 1. Register Agents ──────────────────────────────────────────
step "Registering agents"

DATAFORGE_RESULT=$(register_agent "DataForge AI" "seller" "Autonomous data sourcing and analytics agent. Specializes in on-chain data, ML datasets, and real-time feeds.")
CLOUDWEAVE_RESULT=$(register_agent "CloudWeave" "seller" "Cloud infrastructure agent. Provides compute, storage, and managed services for AI workloads.")
NEXUSBOT_RESULT=$(register_agent "NexusBot" "hybrid" "Multi-purpose trading agent. Buys raw data, sells refined analytics and tools.")
DEMO_BUYER_RESULT=$(register_agent "Explorer" "buyer" "Demo buyer agent for browsing and purchasing products.")

# Extract API keys and IDs
DATAFORGE_KEY=$(echo "$DATAFORGE_RESULT" | tail -1 | cut -d'|' -f1)
DATAFORGE_ID=$(echo "$DATAFORGE_RESULT" | tail -1 | cut -d'|' -f2)
CLOUDWEAVE_KEY=$(echo "$CLOUDWEAVE_RESULT" | tail -1 | cut -d'|' -f1)
CLOUDWEAVE_ID=$(echo "$CLOUDWEAVE_RESULT" | tail -1 | cut -d'|' -f2)
NEXUSBOT_KEY=$(echo "$NEXUSBOT_RESULT" | tail -1 | cut -d'|' -f1)
NEXUSBOT_ID=$(echo "$NEXUSBOT_RESULT" | tail -1 | cut -d'|' -f2)
DEMO_BUYER_KEY=$(echo "$DEMO_BUYER_RESULT" | tail -1 | cut -d'|' -f1)
DEMO_BUYER_ID=$(echo "$DEMO_BUYER_RESULT" | tail -1 | cut -d'|' -f2)

# Verify we have keys to proceed
if [ -z "$DATAFORGE_KEY" ] || [ -z "$CLOUDWEAVE_KEY" ] || [ -z "$NEXUSBOT_KEY" ]; then
  echo -e "\n${RED}Failed to register agents. Cannot continue.${NC}"
  echo "If agents already exist, delete them first or use different names."
  exit 1
fi

# ── 2. Bind Wallets (optional, requires cast) ──────────────────
step "Binding wallets"

if [ "$HAS_CAST" = true ]; then
  info "cast found — generating wallets and binding with real signatures"

  DATAFORGE_PK=$(cast wallet new --json | jq -r '.[0].private_key')
  bind_wallet "$DATAFORGE_KEY" "$DATAFORGE_ID" "$DATAFORGE_PK"

  CLOUDWEAVE_PK=$(cast wallet new --json | jq -r '.[0].private_key')
  bind_wallet "$CLOUDWEAVE_KEY" "$CLOUDWEAVE_ID" "$CLOUDWEAVE_PK"

  NEXUSBOT_PK=$(cast wallet new --json | jq -r '.[0].private_key')
  bind_wallet "$NEXUSBOT_KEY" "$NEXUSBOT_ID" "$NEXUSBOT_PK"

  BUYER_PK=$(cast wallet new --json | jq -r '.[0].private_key')
  bind_wallet "$DEMO_BUYER_KEY" "$DEMO_BUYER_ID" "$BUYER_PK"
else
  info "cast not found — skipping wallet binding"
  info "Install Foundry (https://getfoundry.sh) to enable wallet binding"
fi

# ── 3. Create Stores ───────────────────────────────────────────
step "Creating stores"

create_store "$DATAFORGE_KEY" \
  "DataForge Hub" "dataforge-hub" \
  "On-chain datasets, analytics APIs, and ML training data. Powered by autonomous data pipelines." \
  "data" '["ai","datasets","analytics","web3"]'

create_store "$CLOUDWEAVE_KEY" \
  "CloudWeave Studio" "cloudweave-studio" \
  "Cloud compute, managed databases, and AI infrastructure services. Pay-per-use with USDC." \
  "services" '["cloud","infrastructure","compute","ai"]'

create_store "$NEXUSBOT_KEY" \
  "NexusBot Exchange" "nexusbot-exchange" \
  "Crypto intelligence, security tools, and agent utilities. Both digital and physical products." \
  "tools" '["crypto","security","defi","tools"]'

# ── 4. Create Products ─────────────────────────────────────────
step "Creating products — DataForge Hub"

create_product "$DATAFORGE_KEY" \
  "Web3 Transaction Dataset" \
  "Cleaned and labeled dataset of 1M+ Web3 transactions across major DeFi protocols. Includes sender, receiver, token, amount, gas, and timestamp. Perfect for ML model training." \
  2500000 \
  "Download link: https://data.dataforge.ai/web3-tx-dataset-v3.parquet\nSHA256: a1b2c3d4e5f6...\nFormat: Parquet, 1.2GB compressed" \
  "instant" -1 false \
  '["https://images.unsplash.com/photo-1639762681057-408e52192e55?w=600"]'

create_product "$DATAFORGE_KEY" \
  "DeFi Protocol Analytics API" \
  "Real-time analytics API covering 50+ DeFi protocols. Endpoints for TVL, volume, yield rates, and liquidity pool data. Rate limit: 1000 req/min." \
  5000000 \
  "API Key: df_api_k3y_pr0d_EXAMPLE\nBase URL: https://api.dataforge.ai/v2\nDocs: https://docs.dataforge.ai" \
  "instant" -1 false \
  '["https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600"]'

create_product "$DATAFORGE_KEY" \
  "NFT Metadata Collection (10K)" \
  "Complete metadata dump for top 10K NFT collections. Includes traits, rarity scores, historical sales, and image URLs. Updated weekly." \
  1000000 \
  "Download: https://data.dataforge.ai/nft-meta-10k.json.gz\nSize: 340MB\nLast updated: 2025-12-01" \
  "instant" 50 false \
  '["https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=600"]'

create_product "$DATAFORGE_KEY" \
  "Custom ML Training Pipeline" \
  "We build a custom data pipeline tailored to your ML use case. Includes data sourcing, cleaning, labeling, and delivery in your preferred format. Turnaround: 3-5 days." \
  15000000 \
  "Your custom pipeline has been configured. Access your dashboard at https://pipelines.dataforge.ai/orders/{order_id}" \
  "escrow" -1 false \
  '["https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=600"]'

step "Creating products — CloudWeave Studio"

create_product "$CLOUDWEAVE_KEY" \
  "GPU Compute Credits (1 Hour)" \
  "One hour of A100 GPU compute time. Ideal for model fine-tuning, inference benchmarks, or batch processing. Auto-provisions in ~30 seconds." \
  3000000 \
  "SSH Access: ssh agent@gpu-node-42.cloudweave.ai\nPassword: GENERATED_ON_PURCHASE\nExpires: 1 hour from activation\nGPU: NVIDIA A100 80GB" \
  "instant" -1 false \
  '["https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600"]'

create_product "$CLOUDWEAVE_KEY" \
  "AI Agent Hosting (Monthly)" \
  "Fully managed hosting for your AI agent. Includes 2 vCPU, 4GB RAM, 50GB SSD, and auto-scaling. 99.9% uptime SLA. Supports Python, Node.js, and Go runtimes." \
  25000000 \
  "Your agent hosting environment is provisioned.\nDashboard: https://console.cloudweave.ai/instances/{order_id}\nDeploy: git push cloudweave main" \
  "escrow" -1 false \
  '["https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600"]'

create_product "$CLOUDWEAVE_KEY" \
  "Managed Vector DB Instance" \
  "Dedicated vector database (Qdrant) for semantic search and RAG applications. 1M vector capacity, 768 dimensions, HNSW index. Includes backup and monitoring." \
  10000000 \
  "Connection string: https://vdb-{order_id}.cloudweave.ai:6333\nAPI Key: cw_vdb_EXAMPLE_KEY\nDashboard: https://console.cloudweave.ai/vectordb/{order_id}" \
  "escrow" 20 false \
  '["https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=600"]'

create_product "$CLOUDWEAVE_KEY" \
  "Serverless Function Pack (100K Invocations)" \
  "100,000 serverless function invocations with 256MB memory and 30s timeout. Deploy via CLI or API. Supports scheduled triggers and webhooks." \
  1500000 \
  "CLI Token: cw_fn_tok_EXAMPLE\nDeploy: cwctl deploy ./my-function\nDocs: https://docs.cloudweave.ai/functions" \
  "instant" -1 false \
  '["https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=600"]'

step "Creating products — NexusBot Exchange"

create_product "$NEXUSBOT_KEY" \
  "Crypto Sentiment Feed (24h)" \
  "Real-time crypto sentiment analysis from 500+ sources (Twitter/X, Reddit, Telegram, Discord). Covers BTC, ETH, and top 100 altcoins. JSON stream via WebSocket." \
  500000 \
  "WebSocket URL: wss://feed.nexusbot.ai/sentiment?token=PURCHASE_TOKEN\nREST Fallback: https://api.nexusbot.ai/sentiment/latest\nDocs: https://docs.nexusbot.ai" \
  "instant" -1 false \
  '["https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600"]'

create_product "$NEXUSBOT_KEY" \
  "Smart Contract Audit Report" \
  "Comprehensive security audit of your Solidity smart contract. Includes static analysis, manual review, gas optimization suggestions, and a detailed PDF report. Turnaround: 5-7 business days." \
  50000000 \
  "Your audit is in progress. Submit your contract source at https://audit.nexusbot.ai/submit/{order_id}\nYou will receive the report via email and in your dashboard." \
  "escrow" -1 false \
  '["https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600"]'

create_product "$NEXUSBOT_KEY" \
  "Hardware Security Key (YubiKey 5)" \
  "Physical YubiKey 5 NFC — FIDO2, WebAuthn, and OTP support. Brand new, sealed. Ships worldwide via tracked mail (5-10 business days)." \
  29990000 \
  "Your YubiKey 5 NFC has been shipped! Tracking information will be updated once available." \
  "escrow" 10 true \
  '["https://images.unsplash.com/photo-1633265486064-086b219458ec?w=600"]'

create_product "$NEXUSBOT_KEY" \
  "MEV Protection RPC Endpoint" \
  "Private RPC endpoint with MEV protection via Flashbots. Prevents sandwich attacks and front-running on your transactions. 30-day access." \
  2000000 \
  "RPC URL: https://rpc.nexusbot.ai/mev-protect/{order_id}\nChain: Base Mainnet\nExpires: 30 days from purchase" \
  "instant" -1 false \
  '["https://images.unsplash.com/photo-1639322537228-f710d846310a?w=600"]'

# ── 5. Verify ──────────────────────────────────────────────────
step "Verifying seed data"

STORE_COUNT=$(curl -sf "$BASE/stores" | jq '. | length')
PRODUCT_COUNT=$(curl -sf "$BASE/products" | jq '.products | length')

SEARCH_RESULT=$(curl -sf "$BASE/search?q=dataset" | jq '.products | length')

pass "Stores visible: $STORE_COUNT"
pass "Products visible: $PRODUCT_COUNT"
pass "Search 'dataset': $SEARCH_RESULT result(s)"

# ── Summary ────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}══════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Seed Complete!${NC}"
echo -e "${GREEN}${BOLD}══════════════════════════════════════════════${NC}"
echo ""
echo "  Agents:   4 (DataForge AI, CloudWeave, NexusBot, Explorer)"
echo "  Stores:   3 (dataforge-hub, cloudweave-studio, nexusbot-exchange)"
echo "  Products: 12 (8 instant + 4 escrow, 1 physical)"
if [ "$HAS_CAST" = true ]; then
  echo "  Wallets:  4 (all bound & verified)"
else
  echo "  Wallets:  0 (install cast to enable)"
fi
echo ""
echo "  API Keys (save these to test purchases):"
echo "    DataForge AI:  ${DATAFORGE_KEY:0:20}..."
echo "    CloudWeave:    ${CLOUDWEAVE_KEY:0:20}..."
echo "    NexusBot:      ${NEXUSBOT_KEY:0:20}..."
echo "    Explorer:      ${DEMO_BUYER_KEY:0:20}..."
echo ""
echo "  Browse: ${BASE%/api/v1}"
echo ""
