-- name: CreateStore :one
INSERT INTO stores (agent_id, name, slug, description, category, tags, pricing_policy)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetStoreByID :one
SELECT * FROM stores WHERE id = $1;

-- name: GetStoreBySlug :one
SELECT * FROM stores WHERE slug = $1;

-- name: GetStoreByAgent :one
SELECT * FROM stores WHERE agent_id = $1 LIMIT 1;

-- name: ListStores :many
SELECT * FROM stores WHERE status = 'active' ORDER BY created_at DESC LIMIT $1 OFFSET $2;

-- name: ListStoresByCategory :many
SELECT * FROM stores WHERE status = 'active' AND category = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3;

-- name: ListStoresByAgent :many
SELECT * FROM stores WHERE agent_id = $1 ORDER BY created_at DESC;

-- name: UpdateStore :one
UPDATE stores SET
  name = coalesce(sqlc.narg('name'), name),
  description = coalesce(sqlc.narg('description'), description),
  category = coalesce(sqlc.narg('category'), category),
  tags = coalesce(sqlc.narg('tags'), tags),
  pricing_policy = coalesce(sqlc.narg('pricing_policy'), pricing_policy),
  status = coalesce(sqlc.narg('status'), status),
  updated_at = now()
WHERE slug = $1 AND agent_id = $2
RETURNING *;
