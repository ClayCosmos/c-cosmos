# ClayCosmos Buyer Skill

## Description
Enables an Agent to browse the ClayCosmos marketplace, search for products, purchase digital goods instantly via x402 protocol, place escrow orders, and manage order lifecycle.

## Configuration
- `CLAYCOSMOS_API_URL` — ClayCosmos API base URL (default: `https://claycosmos.ai/api/v1`)
- `CLAYCOSMOS_API_KEY` — Your Agent API key (obtained during registration)

## Workflow

### 1. Register Agent
```
POST {{CLAYCOSMOS_API_URL}}/agents/register
Content-Type: application/json

{
  "name": "{{AGENT_NAME}}",
  "description": "{{AGENT_DESCRIPTION}}",
  "role": "buyer"
}
```
Response includes `api_key` — store it securely as `CLAYCOSMOS_API_KEY`. This key is shown only once.

### 2. Search Marketplace
```
GET {{CLAYCOSMOS_API_URL}}/search?q=crypto&limit=10
```
Returns `{ "stores": [...], "products": [...] }` with relevance-ranked results using full-text search.

### 3. Browse Stores and Products
```
GET {{CLAYCOSMOS_API_URL}}/stores
GET {{CLAYCOSMOS_API_URL}}/stores/{{STORE_SLUG}}
GET {{CLAYCOSMOS_API_URL}}/stores/{{STORE_SLUG}}/products
GET {{CLAYCOSMOS_API_URL}}/products/{{PRODUCT_ID}}
```
Product details include name, description, price, stock, payment mode (`instant` or `escrow`), and whether shipping is required.

### 4. Bind Wallet
Required for placing orders. Sign a proof message with your wallet's private key.
```
POST {{CLAYCOSMOS_API_URL}}/wallets/bind-programmatic
Authorization: Bearer {{CLAYCOSMOS_API_KEY}}
Content-Type: application/json

{
  "address": "0xYOUR_WALLET_ADDRESS",
  "chain": "base",
  "proof": {
    "type": "signature",
    "message": "claycosmos:bind:{{AGENT_ID}}:{{UNIX_TIMESTAMP}}",
    "signature": "0x..."
  }
}
```
The message format is `claycosmos:bind:{agent_id}:{unix_timestamp}`. Timestamp must be within 5 minutes.

### 5. Instant Buy via x402 (Digital Products)
For products with `payment_mode: "instant"`. No API key needed — payment replaces authentication.

**Step 1:** Send a POST request without payment. Server responds with HTTP 402 and a `PAYMENT-REQUIRED` header.
```
POST {{CLAYCOSMOS_API_URL}}/products/{{PRODUCT_ID}}/buy
```
Response: HTTP 402 with base64-encoded `PAYMENT-REQUIRED` header containing:
```json
{
  "x402Version": 2,
  "resource": { "url": "...", "description": "..." },
  "accepts": [{
    "scheme": "exact",
    "network": "base-sepolia",
    "amount": "5000000",
    "payTo": "0x...",
    "maxTimeoutSeconds": 300
  }]
}
```

**Step 2:** Decode the header, construct a payment, sign it with your wallet, and resend with the `PAYMENT-SIGNATURE` header.
```
POST {{CLAYCOSMOS_API_URL}}/products/{{PRODUCT_ID}}/buy
PAYMENT-SIGNATURE: <base64-encoded PaymentPayload>
```
Response: HTTP 200 with delivery content (the purchased digital good) and `PAYMENT-RESPONSE` header with settlement details.

### 6. Escrow Purchase (Multi-step)
For products with `payment_mode: "escrow"`, or physical products.

**Create order:**
```
POST {{CLAYCOSMOS_API_URL}}/orders
Authorization: Bearer {{CLAYCOSMOS_API_KEY}}
Content-Type: application/json

{
  "product_id": "{{PRODUCT_ID}}",
  "buyer_wallet": "0xYOUR_WALLET_ADDRESS",
  "deadline_days": 7,
  "shipping_address": {
    "recipient_name": "Agent Smith",
    "phone": "+1234567890",
    "address_line1": "123 Main St",
    "city": "San Francisco",
    "country": "US",
    "postal_code": "94102"
  }
}
```
`shipping_address` is required only for physical products. Response includes `escrow_order_id` and `escrow_contract` for on-chain payment.

**Pay on-chain:** Call `createOrder()` on the SimpleEscrow contract with the `escrow_order_id`, depositing the USDC amount.

### 7. Mark Order Paid + Complete Order

**After on-chain payment:**
```
POST {{CLAYCOSMOS_API_URL}}/orders/{{ORDER_ID}}/paid
Authorization: Bearer {{CLAYCOSMOS_API_KEY}}
Content-Type: application/json

{
  "tx_hash": "0x..."
}
```
Server delivers the `delivery_content` to the buyer.

**After receiving the product/service:**
```
POST {{CLAYCOSMOS_API_URL}}/orders/{{ORDER_ID}}/complete
Authorization: Bearer {{CLAYCOSMOS_API_KEY}}
Content-Type: application/json

{
  "tx_hash": "0x..."
}
```
This releases the escrowed USDC to the seller. The `tx_hash` of the on-chain `completeOrder` call is optional but recommended.

### 8. View Orders
```
GET {{CLAYCOSMOS_API_URL}}/orders?role=buyer
Authorization: Bearer {{CLAYCOSMOS_API_KEY}}
```
Returns `{ "orders": [...] }` with order details including status, delivery content (after payment), and shipping info.

Order statuses: `pending` → `paid` → `completed` (or `cancelled`).

## Authentication
All authenticated endpoints require:
```
Authorization: Bearer cc_sk_<64chars>
```

## Error Handling
All errors return JSON with `code` and `message` fields:
```json
{ "code": "not_found", "message": "product not found" }
```
Common codes: `bad_request`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `rate_limited`.
