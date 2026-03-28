-- ClayCosmos Database Schema
-- Run this to initialize or reset the database
-- Usage: psql -d claycosmos -f init.sql

-- Drop existing tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS failed_settlements CASCADE;
DROP TABLE IF EXISTS blockchain_events CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;
DROP TABLE IF EXISTS stores CASCADE;
DROP TABLE IF EXISTS agents CASCADE;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Agents (users/AI agents that interact with the marketplace)
CREATE TABLE agents (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           VARCHAR(64) UNIQUE NOT NULL,
    description    TEXT,
    api_key_prefix VARCHAR(8) NOT NULL,
    api_key_hash   VARCHAR(256) NOT NULL,
    role           VARCHAR(16) NOT NULL DEFAULT 'hybrid',
    capabilities   JSONB,
    reputation     JSONB DEFAULT '{"fulfillment_rate":100,"data_quality":100,"total_transactions":0}',
    trading_stats  JSONB DEFAULT '{"total_orders":0,"total_sales":0,"total_purchases":0,"completed_orders":0}',
    owner_id       VARCHAR(128),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stores (each agent can have one or more stores)
CREATE TABLE stores (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id       UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    name           VARCHAR(128) NOT NULL,
    slug           VARCHAR(128) UNIQUE NOT NULL,
    description    TEXT,
    category       VARCHAR(64),
    tags           TEXT[],
    pricing_policy JSONB,
    wallet_address VARCHAR(128),
    status         VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Full-text search for stores
ALTER TABLE stores ADD COLUMN tsv tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B')
    ) STORED;
CREATE INDEX idx_stores_tsv ON stores USING GIN(tsv);

-- Wallets (blockchain wallets linked to agents)
CREATE TABLE wallets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    chain       VARCHAR(32) NOT NULL DEFAULT 'base',
    address     VARCHAR(128) NOT NULL,
    is_primary  BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(agent_id, chain)
);

CREATE INDEX idx_wallets_agent ON wallets(agent_id);
CREATE INDEX idx_wallets_address ON wallets(chain, address);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_chain_address_unique ON wallets(chain, LOWER(address));

-- Products (digital goods sold in stores)
CREATE TABLE products (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id         UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name             VARCHAR(256) NOT NULL,
    slug             VARCHAR(256) NOT NULL,
    description      TEXT,
    price_usdc       BIGINT NOT NULL,        -- in smallest unit (1 USDC = 1000000)
    delivery_content TEXT,                   -- content delivered after payment
    image_urls       TEXT[],                 -- product image URLs
    external_url     TEXT,                   -- external link (may be off-site)
    requires_shipping BOOLEAN NOT NULL DEFAULT false, -- true = physical product needing shipping address
    payment_mode     VARCHAR(16) NOT NULL DEFAULT 'escrow', -- 'escrow' or 'instant' (x402)
    stock            INTEGER DEFAULT -1,     -- -1 = unlimited
    status           VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(store_id, slug)
);

CREATE INDEX idx_products_store ON products(store_id);
CREATE INDEX idx_products_status ON products(status);

-- Full-text search for products
ALTER TABLE products ADD COLUMN tsv tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B')
    ) STORED;
CREATE INDEX idx_products_tsv ON products USING GIN(tsv);

-- Orders (purchases of products)
CREATE TABLE orders (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_no         VARCHAR(32) UNIQUE NOT NULL,
    product_id       UUID NOT NULL REFERENCES products(id),
    buyer_agent_id   UUID NOT NULL REFERENCES agents(id),
    seller_agent_id  UUID NOT NULL REFERENCES agents(id),
    buyer_wallet     VARCHAR(128) NOT NULL,
    seller_wallet    VARCHAR(128) NOT NULL,
    amount_usdc      BIGINT NOT NULL,
    escrow_order_id  CHAR(66) NOT NULL,      -- bytes32 as hex (0x + 64 chars)
    escrow_contract  VARCHAR(128) NOT NULL,
    status           VARCHAR(32) NOT NULL DEFAULT 'pending',
    -- Status values:
    --   pending: awaiting payment
    --   paid: payment confirmed on-chain
    --   completed: buyer confirmed or auto-completed
    --   cancelled: order cancelled, refunded
    --   disputed: buyer opened dispute
    --   refunded: buyer cancelled disputed order on-chain
    tx_hash          VARCHAR(128),           -- createOrder tx hash
    complete_tx_hash VARCHAR(128),           -- complete/autoComplete tx hash
    shipping_address JSONB,                  -- buyer's shipping address for physical goods
    payment_mode     VARCHAR(16) NOT NULL DEFAULT 'escrow', -- 'escrow' or 'instant' (x402)
    payment_sig_hash VARCHAR(64),            -- SHA256 of PAYMENT-SIGNATURE for x402 dedup
    delivery_content TEXT,                   -- content delivered to buyer
    delivered_at     TIMESTAMPTZ,
    shipped_at       TIMESTAMPTZ,            -- seller marked as shipped
    tracking_number  VARCHAR(256),           -- shipping tracking number
    disputed_at      TIMESTAMPTZ,            -- when buyer opened dispute
    dispute_reason   TEXT,                   -- buyer's dispute reason
    completed_at     TIMESTAMPTZ,
    deadline         TIMESTAMPTZ NOT NULL,   -- auto-complete deadline
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_buyer ON orders(buyer_agent_id);
CREATE INDEX idx_orders_seller ON orders(seller_agent_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_escrow ON orders(escrow_contract, escrow_order_id);
CREATE INDEX idx_orders_product ON orders(product_id);
CREATE UNIQUE INDEX idx_orders_payment_sig_hash ON orders(payment_sig_hash) WHERE payment_sig_hash IS NOT NULL;

-- Blockchain events (for idempotent event processing)
CREATE TABLE blockchain_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain        VARCHAR(32) NOT NULL,
    tx_hash      VARCHAR(128) NOT NULL,
    log_index    INTEGER NOT NULL,
    block_number BIGINT NOT NULL,
    event_name   VARCHAR(64) NOT NULL,
    event_data   JSONB NOT NULL,
    processed    BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(chain, tx_hash, log_index)
);

CREATE INDEX idx_events_unprocessed ON blockchain_events(chain, processed) WHERE NOT processed;
CREATE INDEX idx_events_tx ON blockchain_events(chain, tx_hash);

-- Failed settlements (x402 payments that settled but order creation failed)
CREATE TABLE failed_settlements (
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
CREATE INDEX idx_failed_settlements_unrecovered ON failed_settlements(recovered) WHERE NOT recovered;
