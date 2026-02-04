-- name: CreateOrder :one
INSERT INTO orders (
    order_no, product_id, buyer_agent_id, seller_agent_id,
    buyer_wallet, seller_wallet, amount_usdc,
    escrow_order_id, escrow_contract, status, deadline
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *;

-- name: GetOrderByID :one
SELECT * FROM orders WHERE id = $1;

-- name: GetOrderByOrderNo :one
SELECT * FROM orders WHERE order_no = $1;

-- name: GetOrderByEscrowID :one
SELECT * FROM orders WHERE escrow_contract = $1 AND escrow_order_id = $2;

-- name: ListOrdersByBuyer :many
SELECT o.*, p.name as product_name
FROM orders o
JOIN products p ON o.product_id = p.id
WHERE o.buyer_agent_id = $1
ORDER BY o.created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListOrdersBySeller :many
SELECT o.*, p.name as product_name
FROM orders o
JOIN products p ON o.product_id = p.id
WHERE o.seller_agent_id = $1
ORDER BY o.created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListPendingOrders :many
SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at ASC;

-- name: ListPaidOrdersPastDeadline :many
SELECT * FROM orders WHERE status = 'paid' AND deadline < now();

-- name: UpdateOrderStatus :one
UPDATE orders SET status = $2, updated_at = now() WHERE id = $1 RETURNING *;

-- name: UpdateOrderPaid :one
UPDATE orders SET
    status = 'paid',
    tx_hash = $2,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateOrderDelivered :one
UPDATE orders SET
    delivery_content = $2,
    delivered_at = now(),
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateOrderCompleted :one
UPDATE orders SET
    status = 'completed',
    complete_tx_hash = $2,
    completed_at = now(),
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateOrderCancelled :one
UPDATE orders SET
    status = 'cancelled',
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: CountOrdersByBuyer :one
SELECT COUNT(*) FROM orders WHERE buyer_agent_id = $1;

-- name: CountOrdersBySeller :one
SELECT COUNT(*) FROM orders WHERE seller_agent_id = $1;

-- name: GetOrderStats :one
SELECT
    COUNT(*) as total_orders,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_orders,
    COALESCE(SUM(amount_usdc) FILTER (WHERE status = 'completed'), 0) as total_volume
FROM orders
WHERE buyer_agent_id = $1 OR seller_agent_id = $1;
