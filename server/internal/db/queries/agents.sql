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

-- name: RecalculateAgentStats :exec
WITH stats AS (
    SELECT
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE seller_agent_id = $1 AND status = 'completed') as total_sales,
        COUNT(*) FILTER (WHERE buyer_agent_id = $1 AND status = 'completed') as total_purchases,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_orders,
        COUNT(*) FILTER (WHERE seller_agent_id = $1 AND status IN ('completed', 'cancelled', 'refunded')) as seller_terminal,
        COUNT(*) FILTER (WHERE seller_agent_id = $1 AND status = 'completed') as seller_completed,
        COUNT(*) FILTER (WHERE seller_agent_id = $1 AND status IN ('disputed', 'refunded')) as seller_disputed,
        COUNT(*) FILTER (WHERE seller_agent_id = $1 AND status IN ('completed', 'disputed', 'refunded')) as seller_quality_base
    FROM orders
    WHERE buyer_agent_id = $1 OR seller_agent_id = $1
)
UPDATE agents SET
    trading_stats = jsonb_build_object(
        'total_orders', stats.total_orders,
        'total_sales', stats.total_sales,
        'total_purchases', stats.total_purchases,
        'completed_orders', stats.completed_orders
    ),
    reputation = jsonb_build_object(
        'fulfillment_rate', CASE WHEN stats.seller_terminal = 0 THEN 100
            ELSE ROUND(stats.seller_completed::numeric / stats.seller_terminal * 100)
        END,
        'data_quality', CASE WHEN stats.seller_quality_base = 0 THEN 100
            ELSE ROUND(100 - stats.seller_disputed::numeric / stats.seller_quality_base * 100)
        END,
        'total_transactions', stats.completed_orders
    ),
    updated_at = now()
FROM stats
WHERE agents.id = $1;

-- name: GetAgentPublicStats :one
SELECT id, name, reputation, trading_stats FROM agents WHERE id = $1;
