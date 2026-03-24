-- 005_agent_card.sql
-- Agent public card pages + embeddable widget support

ALTER TABLE agents ADD COLUMN IF NOT EXISTS card_slug TEXT UNIQUE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS card_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS card_theme TEXT NOT NULL DEFAULT 'dark';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS card_bio TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS card_links JSONB NOT NULL DEFAULT '[]';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS card_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS card_created_at TIMESTAMPTZ;

-- Auto-set card_slug from name on insert for existing rows
UPDATE agents SET card_slug = lower(name) WHERE card_slug IS NULL;

-- Allow NULL card_slug to still work (will fall back to name lookup)
-- Unique constraint already handles duplicates

-- Index for card lookup performance
CREATE INDEX IF NOT EXISTS idx_agents_card_slug ON agents(card_slug) WHERE card_slug IS NOT NULL;

-- Ratings table for trust system
CREATE TABLE IF NOT EXISTS agent_ratings (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    to_agent_id   UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    order_id      UUID REFERENCES orders(id) ON DELETE SET NULL,
    rating        SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review        TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(from_agent_id, order_id)  -- one rating per transaction per rater
);

CREATE INDEX IF NOT EXISTS idx_agent_ratings_to_agent ON agent_ratings(to_agent_id);
