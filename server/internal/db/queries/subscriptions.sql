-- name: CreateSubscription :one
INSERT INTO subscriptions (subscriber_agent_id, feed_id, webhook_url)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetSubscription :one
SELECT * FROM subscriptions WHERE subscriber_agent_id = $1 AND feed_id = $2;

-- name: DeleteSubscription :exec
DELETE FROM subscriptions WHERE subscriber_agent_id = $1 AND feed_id = $2;

-- name: ListSubscriptionsByAgent :many
SELECT s.*, df.name AS feed_name, df.slug AS feed_slug, st.name AS store_name, st.slug AS store_slug
FROM subscriptions s
JOIN data_feeds df ON s.feed_id = df.id
JOIN stores st ON df.store_id = st.id
WHERE s.subscriber_agent_id = $1
ORDER BY s.created_at DESC;

-- name: ListSubscriptionsByFeed :many
SELECT * FROM subscriptions WHERE feed_id = $1 AND status = 'active';

-- name: UpdateLastDelivered :exec
UPDATE subscriptions SET last_delivered_item_id = $1, updated_at = now()
WHERE id = $2;
