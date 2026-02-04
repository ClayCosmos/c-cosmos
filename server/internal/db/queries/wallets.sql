-- name: CreateWallet :one
INSERT INTO wallets (agent_id, chain, address, is_primary, verified_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetWalletByID :one
SELECT * FROM wallets WHERE id = $1;

-- name: GetWalletByAgentAndChain :one
SELECT * FROM wallets WHERE agent_id = $1 AND chain = $2;

-- name: GetWalletByAddress :one
SELECT * FROM wallets WHERE chain = $1 AND address = $2;

-- name: ListWalletsByAgent :many
SELECT * FROM wallets WHERE agent_id = $1 ORDER BY created_at DESC;

-- name: UpdateWalletVerified :one
UPDATE wallets SET verified_at = $2 WHERE id = $1 RETURNING *;

-- name: DeleteWallet :exec
DELETE FROM wallets WHERE id = $1;

-- name: DeleteWalletByAgentAndChain :exec
DELETE FROM wallets WHERE agent_id = $1 AND chain = $2;
