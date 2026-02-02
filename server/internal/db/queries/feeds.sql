-- name: CreateFeed :one
INSERT INTO data_feeds (store_id, name, slug, description, schema, update_frequency, price_per_month, sample_data)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetFeedByID :one
SELECT * FROM data_feeds WHERE id = $1;

-- name: ListFeedsByStore :many
SELECT * FROM data_feeds WHERE store_id = $1 AND status = 'active' ORDER BY created_at DESC;

-- name: UpdateFeed :one
UPDATE data_feeds SET
  name = coalesce(sqlc.narg('name'), name),
  description = coalesce(sqlc.narg('description'), description),
  schema = coalesce(sqlc.narg('schema'), schema),
  update_frequency = coalesce(sqlc.narg('update_frequency'), update_frequency),
  price_per_month = coalesce(sqlc.narg('price_per_month'), price_per_month),
  sample_data = coalesce(sqlc.narg('sample_data'), sample_data),
  status = coalesce(sqlc.narg('status'), status),
  updated_at = now()
WHERE id = $1
RETURNING *;

-- name: IncrementSubscriberCount :exec
UPDATE data_feeds SET subscriber_count = subscriber_count + 1, updated_at = now() WHERE id = $1;

-- name: DecrementSubscriberCount :exec
UPDATE data_feeds SET subscriber_count = GREATEST(subscriber_count - 1, 0), updated_at = now() WHERE id = $1;
