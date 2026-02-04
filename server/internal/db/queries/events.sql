-- name: CreateBlockchainEvent :one
INSERT INTO blockchain_events (chain, tx_hash, log_index, block_number, event_name, event_data)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (chain, tx_hash, log_index) DO NOTHING
RETURNING *;

-- name: GetBlockchainEvent :one
SELECT * FROM blockchain_events WHERE chain = $1 AND tx_hash = $2 AND log_index = $3;

-- name: CheckEventExists :one
SELECT EXISTS(SELECT 1 FROM blockchain_events WHERE chain = $1 AND tx_hash = $2 AND log_index = $3);

-- name: ListUnprocessedEvents :many
SELECT * FROM blockchain_events
WHERE chain = $1 AND processed = false
ORDER BY block_number ASC, log_index ASC
LIMIT $2;

-- name: MarkEventProcessed :one
UPDATE blockchain_events SET processed = true, processed_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteOldProcessedEvents :exec
DELETE FROM blockchain_events WHERE processed = true AND processed_at < $1;
