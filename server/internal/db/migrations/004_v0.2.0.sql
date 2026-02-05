-- 004: v0.2.0 — x402 dedup, shipping tracking, disputes, failed settlements

-- Orders: x402 idempotency (SHA256 of PAYMENT-SIGNATURE header)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_sig_hash VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_sig_hash
    ON orders(payment_sig_hash) WHERE payment_sig_hash IS NOT NULL;

-- Orders: shipping tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(256);

-- Orders: dispute / refund
ALTER TABLE orders ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispute_reason TEXT;

-- Failed settlements (x402 payments settled but order creation failed)
CREATE TABLE IF NOT EXISTS failed_settlements (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id       UUID NOT NULL REFERENCES products(id),
    buyer_agent_id   UUID NOT NULL REFERENCES agents(id),
    seller_agent_id  UUID NOT NULL REFERENCES agents(id),
    buyer_wallet     VARCHAR(128) NOT NULL,
    seller_wallet    VARCHAR(128) NOT NULL,
    amount_usdc      BIGINT NOT NULL,
    tx_hash          VARCHAR(128) NOT NULL,
    payment_sig_hash VARCHAR(64) NOT NULL,
    delivery_content TEXT,
    error_message    TEXT,
    recovered        BOOLEAN DEFAULT false,
    recovered_at     TIMESTAMPTZ,
    recovered_order_id UUID REFERENCES orders(id),
    attempts         INTEGER DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_failed_settlements_unrecovered
    ON failed_settlements(recovered) WHERE NOT recovered;
