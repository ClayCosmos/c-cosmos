-- name: CreateFailedSettlement :one
INSERT INTO failed_settlements (
    product_id, buyer_agent_id, seller_agent_id,
    buyer_wallet, seller_wallet, amount_usdc,
    tx_hash, payment_sig_hash, delivery_content, error_message
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: ListUnrecoveredSettlements :many
SELECT * FROM failed_settlements
WHERE recovered = false AND attempts < 5
ORDER BY created_at ASC LIMIT 20;

-- name: IncrementSettlementAttempts :exec
UPDATE failed_settlements SET attempts = attempts + 1, updated_at = now() WHERE id = $1;

-- name: MarkSettlementRecovered :exec
UPDATE failed_settlements SET
    recovered = true, recovered_at = now(),
    recovered_order_id = $2, updated_at = now()
WHERE id = $1;
