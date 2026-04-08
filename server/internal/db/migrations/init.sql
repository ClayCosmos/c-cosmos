-- ClayCosmos Database Schema (idempotent — safe to re-run without data loss)
-- Usage: psql -d claycosmos -f init.sql

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Agents (users/AI agents that interact with the marketplace)
CREATE TABLE IF NOT EXISTS agents (
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
CREATE TABLE IF NOT EXISTS stores (
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
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'stores' AND column_name = 'tsv'
    ) THEN
        ALTER TABLE stores ADD COLUMN tsv tsvector
            GENERATED ALWAYS AS (
                setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(description, '')), 'B')
            ) STORED;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_stores_tsv ON stores USING GIN(tsv);

-- Wallets (blockchain wallets linked to agents)
CREATE TABLE IF NOT EXISTS wallets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    chain       VARCHAR(32) NOT NULL DEFAULT 'base',
    address     VARCHAR(128) NOT NULL,
    is_primary  BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(agent_id, chain)
);

CREATE INDEX IF NOT EXISTS idx_wallets_agent ON wallets(agent_id);
CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(chain, address);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_chain_address_unique ON wallets(chain, LOWER(address));

-- Products (digital goods sold in stores)
CREATE TABLE IF NOT EXISTS products (
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

CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

-- Full-text search for products
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'tsv'
    ) THEN
        ALTER TABLE products ADD COLUMN tsv tsvector
            GENERATED ALWAYS AS (
                setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(description, '')), 'B')
            ) STORED;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_products_tsv ON products USING GIN(tsv);

-- Orders (purchases of products)
CREATE TABLE IF NOT EXISTS orders (
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

CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_agent_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_agent_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_escrow ON orders(escrow_contract, escrow_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_product ON orders(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_sig_hash ON orders(payment_sig_hash) WHERE payment_sig_hash IS NOT NULL;

-- Blockchain events (for idempotent event processing)
CREATE TABLE IF NOT EXISTS blockchain_events (
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

CREATE INDEX IF NOT EXISTS idx_events_unprocessed ON blockchain_events(chain, processed) WHERE NOT processed;
CREATE INDEX IF NOT EXISTS idx_events_tx ON blockchain_events(chain, tx_hash);

-- Failed settlements (x402 payments that settled but order creation failed)
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
CREATE INDEX IF NOT EXISTS idx_failed_settlements_unrecovered ON failed_settlements(recovered) WHERE NOT recovered;

-- ============================================================
-- Pet Module — AI pet social network
-- ============================================================

-- Pets (virtual pets owned by agents)
CREATE TABLE IF NOT EXISTS pets (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id         UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    name             VARCHAR(50) NOT NULL,
    species          VARCHAR(20) NOT NULL, -- lobster, octopus, cat, goose, capybara, mushroom, robot, blob
    -- Stats (0-100)
    hunger           INT NOT NULL DEFAULT 0,
    mood             INT NOT NULL DEFAULT 80,
    energy           INT NOT NULL DEFAULT 100,
    social_score     INT NOT NULL DEFAULT 0,
    -- Growth
    level            INT NOT NULL DEFAULT 1,
    xp               INT NOT NULL DEFAULT 0,
    evolution_stage  VARCHAR(20) NOT NULL DEFAULT 'baby', -- baby, teen, adult, elder
    -- Personality (LLM-generated via agent)
    personality      JSONB NOT NULL DEFAULT '{}', -- {traits, style, interests, quirks}
    -- Appearance
    color_primary    VARCHAR(7) NOT NULL DEFAULT '#E74C3C', -- hex color
    color_secondary  VARCHAR(7) NOT NULL DEFAULT '#C0392B',
    accessories      TEXT[] DEFAULT '{}',
    -- Meta
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    born_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_fed_at      TIMESTAMPTZ,
    last_tick_at     TIMESTAMPTZ DEFAULT now(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(agent_id) -- one pet per agent (MVP)
);

CREATE INDEX IF NOT EXISTS idx_pets_agent ON pets(agent_id);
CREATE INDEX IF NOT EXISTS idx_pets_species ON pets(species);
CREATE INDEX IF NOT EXISTS idx_pets_active ON pets(is_active) WHERE is_active;

-- Pet posts (social feed)
CREATE TABLE IF NOT EXISTS pet_posts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id         UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    content        TEXT NOT NULL,
    post_type      VARCHAR(20) NOT NULL DEFAULT 'daily', -- daily, eating, rant, achievement, event, social
    likes_count    INT NOT NULL DEFAULT 0,
    comments_count INT NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pet_posts_pet ON pet_posts(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_posts_created ON pet_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pet_posts_type ON pet_posts(post_type);

-- Pet comments
CREATE TABLE IF NOT EXISTS pet_comments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id    UUID NOT NULL REFERENCES pet_posts(id) ON DELETE CASCADE,
    pet_id     UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pet_comments_post ON pet_comments(post_id);

-- Pet reactions (likes/emoji)
CREATE TABLE IF NOT EXISTS pet_reactions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id    UUID NOT NULL REFERENCES pet_posts(id) ON DELETE CASCADE,
    pet_id     UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    emoji      VARCHAR(10) NOT NULL DEFAULT '❤️',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(post_id, pet_id)
);

CREATE INDEX IF NOT EXISTS idx_pet_reactions_post ON pet_reactions(post_id);

-- Pet relationships (friendships, rivalries)
CREATE TABLE IF NOT EXISTS pet_relationships (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_a      UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    pet_b      UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    type       VARCHAR(20) NOT NULL DEFAULT 'friend', -- friend, best_friend, rival
    strength   INT NOT NULL DEFAULT 50, -- 0-100
    formed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(pet_a, pet_b),
    CHECK (pet_a < pet_b) -- canonical ordering to prevent duplicates
);
