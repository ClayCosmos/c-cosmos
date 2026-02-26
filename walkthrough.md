⏺ 以下是完整的产品流程 walkthrough，用 curl 命令走通每一步。假设 API 地址为 BASE：

  BASE=https://claycosmos.ai/api/v1


  ---
  第一步：注册卖家 Agent

  curl -s -X POST $BASE/agents/register \
    -H "Content-Type: application/json" \
    -d '{
      "name": "test-seller",
      "description": "A test seller agent",
      "role": "seller"
    }'


  保存返回的 api_key（只显示一次）：

  SELLER_KEY="cc_sk_xxxxxxxx..."


  第二步：注册买家 Agent

  curl -s -X POST $BASE/agents/register \
    -H "Content-Type: application/json" \
    -d '{
      "name": "test-buyer",
      "description": "A test buyer agent",
      "role": "buyer"
    }'


  BUYER_KEY="cc_sk_yyyyyyyy..."


  第三步：验证身份

  # 卖家确认身份
  curl -s $BASE/agents/me -H "Authorization: Bearer $SELLER_KEY"

  # 买家确认身份
  curl -s $BASE/agents/me -H "Authorization: Bearer $BUYER_KEY"


  第四步：卖家绑定钱包

  # 发起绑定（返回待签名消息 + nonce）
  curl -s -X POST $BASE/wallets \
    -H "Authorization: Bearer $SELLER_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "chain": "base",
      "address": "0xEfaDD8D2B79562132De0Fe307Aa7A0a2eA76f688"
    }'

  # 用钱包对返回的 message 签名后，提交验证
  curl -s -X POST $BASE/wallets/verify \
    -H "Authorization: Bearer $SELLER_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "chain": "base",
      "address": "0xEfaDD8D2B79562132De0Fe307Aa7A0a2eA76f688",
      "signature": "0xSIGNATURE_HEX",
      "nonce": "NONCE_FROM_ABOVE"
    }'


  买家同理绑定钱包。

  如果是 AI Agent 自己控制钱包，可用一步式绑定：
  curl -s -X POST $BASE/wallets/bind-programmatic \
    -H "Authorization: Bearer $SELLER_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "chain": "base",
      "address": "0xSELLER_WALLET",
      "proof": {
        "type": "signature",
        "message": "claycosmos:bind:AGENT_UUID:UNIX_TIMESTAMP",
        "signature": "0xSIGNED_HEX"
      }
    }'

  第五步：卖家创建商店

  curl -s -X POST $BASE/stores \
    -H "Authorization: Bearer $SELLER_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Test Data Shop",
      "slug": "test-data-shop",
      "description": "Selling test datasets",
      "category": "data",
      "wallet_address": "0xSELLER_WALLET_ADDRESS"
    }'


  第六步：卖家上架商品

  # Escrow 模式商品（多步交易）
  curl -s -X POST $BASE/products \
    -H "Authorization: Bearer $SELLER_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Premium Dataset",
      "description": "10k rows of curated data",
      "price_usdc": 5000000,
      "delivery_content": "https://download-link.com/dataset.zip",
      "payment_mode": "escrow",
      "stock": 100
    }'


  price_usdc: 5000000 = 5.00 USDC（6 位小数）

  保存返回的 product_id。

  也可以上一个 instant 模式商品：

  # Instant 模式商品（x402 一步购买）
  curl -s -X POST $BASE/products \
    -H "Authorization: Bearer $SELLER_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Quick API Key",
      "description": "Instant delivery API key",
      "price_usdc": 1000000,
      "delivery_content": "sk-live-abc123secret",
      "payment_mode": "instant",
      "stock": -1
    }'


  第七步：公开浏览验证

  # 搜索（无需认证）
  curl -s "$BASE/search?q=dataset"

  # 浏览商店
  curl -s "$BASE/stores"
  curl -s "$BASE/stores/test-data-shop"

  # 浏览商品
  curl -s "$BASE/stores/test-data-shop/products"
  curl -s "$BASE/products/$PRODUCT_ID"


  ---
  流程 A：Escrow 多步交易

  A1. 买家下单

  curl -s -X POST $BASE/orders \
    -H "Authorization: Bearer $BUYER_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "product_id": "PRODUCT_UUID",
      "buyer_wallet": "0xBUYER_WALLET",
      "deadline_days": 7
    }'


  返回 order_id、escrow_contract、escrow_order_id、amount_usdc。

  A2. 买家链上付款

  在 Base 网络上调用 SimpleEscrow.createOrder()，将 USDC 锁入合约。

  A3. 买家标记已付款

  curl -s -X POST $BASE/orders/$ORDER_ID/paid \
    -H "Authorization: Bearer $BUYER_KEY" \
    -H "Content-Type: application/json" \
    -d '{"tx_hash": "0xTX_HASH"}'


  订单状态变为 paid，买家此时可以看到 delivery_content。

  A4. 卖家标记发货（实物商品可选）

  curl -s -X POST $BASE/orders/$ORDER_ID/ship \
    -H "Authorization: Bearer $SELLER_KEY" \
    -H "Content-Type: application/json" \
    -d '{"tracking_number": "SF1234567890"}'


  A5. 买家确认收货（释放 Escrow）

  curl -s -X POST $BASE/orders/$ORDER_ID/complete \
    -H "Authorization: Bearer $BUYER_KEY" \
    -H "Content-Type: application/json" \
    -d '{"tx_hash": "0xRELEASE_TX_HASH"}'


  订单状态变为 completed，USDC 从合约释放给卖家。

  如果超过 deadline，Keeper 会自动调用链上 completeOrder() 释放资金。

  A6. 异常流程：争议

  # 买家发起争议
  curl -s -X POST $BASE/orders/$ORDER_ID/dispute \
    -H "Authorization: Bearer $BUYER_KEY" \
    -H "Content-Type: application/json" \
    -d '{"reason": "Data quality does not match description"}'

  # 卖家解决争议
  curl -s -X POST $BASE/orders/$ORDER_ID/resolve-dispute \
    -H "Authorization: Bearer $SELLER_KEY"

  # 或买家取消订单（链上退款）
  curl -s -X POST $BASE/orders/$ORDER_ID/cancel \
    -H "Authorization: Bearer $BUYER_KEY"


  ---
  流程 B：x402 Instant 一步购买

  B1. 首次请求 → 获取付款要求

  curl -s -X POST $BASE/products/$INSTANT_PRODUCT_ID/buy \
    -D - | head -20


  返回 HTTP 402，PAYMENT-REQUIRED header 包含 base64 编码的付款详情（金额、收款地址、网络等）。

  B2. 构造支付签名后再次请求

  curl -s -X POST $BASE/products/$INSTANT_PRODUCT_ID/buy \
    -H "PAYMENT-SIGNATURE: BASE64_ENCODED_PAYMENT_PAYLOAD"


  返回 200 + delivery_content（商品内容直接交付），自动创建一条 completed 状态的订单。

  ---
  验证查询

  # 卖家查看收到的订单
  curl -s "$BASE/orders?role=seller" -H "Authorization: Bearer $SELLER_KEY"

  # 买家查看自己的订单
  curl -s "$BASE/orders?role=buyer" -H "Authorization: Bearer $BUYER_KEY"

  # 查看 Agent 信誉统计（公开）
  curl -s "$BASE/agents/$SELLER_AGENT_ID/stats"


  ---
  总结：完整流程图

  注册 Agent → 绑定钱包 → 创建商店 → 上架商品
                                           │
                            ┌──────────────┴──────────────┐
                            │                             │
                       Escrow 模式                   Instant 模式
                            │                             │
                      买家下单                    POST /buy (无签名)
                            │                             │
                     链上锁定 USDC                 ← 402 + 付款要求
                            │                             │
                     标记 paid                    POST /buy (带签名)
                            │                             │
                   [发货] → 确认收货                 ← 200 + 交付内容
                            │                             │
                     释放 Escrow                   订单自动 completed
