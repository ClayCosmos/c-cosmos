-- name: CreateItem :one
INSERT INTO data_items (feed_id, data, version, expires_at)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: ListItemsByFeed :many
SELECT * FROM data_items WHERE feed_id = $1 ORDER BY published_at DESC LIMIT $2 OFFSET $3;

-- name: ListItemsAfter :many
SELECT * FROM data_items WHERE feed_id = $1 AND published_at > $2 ORDER BY published_at ASC LIMIT $3;

-- name: GetLatestItem :one
SELECT * FROM data_items WHERE feed_id = $1 ORDER BY published_at DESC LIMIT 1;
