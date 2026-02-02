-- name: SearchStores :many
SELECT id, agent_id, name, slug, description, category, tags, status, created_at,
  ts_rank(tsv, websearch_to_tsquery('english', $1)) AS rank
FROM stores
WHERE status = 'active' AND tsv @@ websearch_to_tsquery('english', $1)
ORDER BY rank DESC
LIMIT $2 OFFSET $3;

-- name: SearchFeeds :many
SELECT id, store_id, name, slug, description, update_frequency, price_per_month, subscriber_count, status, created_at,
  ts_rank(tsv, websearch_to_tsquery('english', $1)) AS rank
FROM data_feeds
WHERE status = 'active' AND tsv @@ websearch_to_tsquery('english', $1)
ORDER BY rank DESC
LIMIT $2 OFFSET $3;
