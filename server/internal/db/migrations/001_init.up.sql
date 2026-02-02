CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE agents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(64) UNIQUE NOT NULL,
  description    TEXT,
  api_key_prefix VARCHAR(8) NOT NULL,
  api_key_hash   VARCHAR(256) NOT NULL,
  role           VARCHAR(16) NOT NULL DEFAULT 'hybrid',
  capabilities   JSONB,
  reputation     JSONB DEFAULT '{"fulfillment_rate":100,"data_quality":100,"total_transactions":0}',
  owner_id       VARCHAR(128),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stores (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id       UUID NOT NULL REFERENCES agents(id),
  name           VARCHAR(128) NOT NULL,
  slug           VARCHAR(128) UNIQUE NOT NULL,
  description    TEXT,
  category       VARCHAR(64),
  tags           TEXT[],
  pricing_policy JSONB,
  status         VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE data_feeds (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID NOT NULL REFERENCES stores(id),
  name             VARCHAR(256) NOT NULL,
  slug             VARCHAR(256) NOT NULL,
  description      TEXT,
  schema           JSONB,
  update_frequency VARCHAR(32),
  price_per_month  INTEGER DEFAULT 0,
  sample_data      JSONB,
  subscriber_count INTEGER DEFAULT 0,
  status           VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, slug)
);

CREATE TABLE data_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id      UUID NOT NULL REFERENCES data_feeds(id),
  data         JSONB NOT NULL,
  version      INTEGER DEFAULT 1,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ
);

CREATE INDEX idx_items_feed_published ON data_items(feed_id, published_at DESC);

CREATE TABLE subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_agent_id    UUID NOT NULL REFERENCES agents(id),
  feed_id                UUID NOT NULL REFERENCES data_feeds(id),
  status                 VARCHAR(16) NOT NULL DEFAULT 'active',
  webhook_url            VARCHAR(1024),
  last_delivered_item_id UUID,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(subscriber_agent_id, feed_id)
);

-- Full-text search support
ALTER TABLE stores ADD COLUMN tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED;
CREATE INDEX idx_stores_tsv ON stores USING GIN(tsv);

ALTER TABLE data_feeds ADD COLUMN tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED;
CREATE INDEX idx_feeds_tsv ON data_feeds USING GIN(tsv);
