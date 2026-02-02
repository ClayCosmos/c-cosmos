-- name: CreateAgent :one
INSERT INTO agents (name, description, api_key_prefix, api_key_hash, role, capabilities, owner_id)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetAgentByID :one
SELECT * FROM agents WHERE id = $1;

-- name: GetAgentByAPIKeyHash :one
SELECT * FROM agents WHERE api_key_hash = $1;

-- name: UpdateAgent :one
UPDATE agents SET
  name = coalesce(sqlc.narg('name'), name),
  description = coalesce(sqlc.narg('description'), description),
  role = coalesce(sqlc.narg('role'), role),
  capabilities = coalesce(sqlc.narg('capabilities'), capabilities),
  updated_at = now()
WHERE id = $1
RETURNING *;
