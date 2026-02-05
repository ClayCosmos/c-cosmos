-- Add payment_mode column to products and orders tables
ALTER TABLE products ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(16) NOT NULL DEFAULT 'escrow';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(16) NOT NULL DEFAULT 'escrow';
