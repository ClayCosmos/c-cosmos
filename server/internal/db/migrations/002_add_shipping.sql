-- 002: Add shipping support
-- Products: requires_shipping flag for physical goods
ALTER TABLE products ADD COLUMN IF NOT EXISTS requires_shipping BOOLEAN NOT NULL DEFAULT false;

-- Orders: shipping_address JSONB for buyer's address
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address JSONB;
