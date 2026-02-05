-- name: CreateProduct :one
INSERT INTO products (store_id, name, slug, description, price_usdc, delivery_content, image_urls, external_url, requires_shipping, payment_mode, stock, status)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING *;

-- name: GetProductByID :one
SELECT * FROM products WHERE id = $1;

-- name: GetProductBySlug :one
SELECT * FROM products WHERE store_id = $1 AND slug = $2;

-- name: ListProductsByStore :many
SELECT * FROM products
WHERE store_id = $1 AND status = 'active'
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListAllProducts :many
SELECT p.*, s.name as store_name, s.slug as store_slug
FROM products p
JOIN stores s ON p.store_id = s.id
WHERE p.status = 'active'
ORDER BY p.created_at DESC
LIMIT $1 OFFSET $2;

-- name: UpdateProduct :one
UPDATE products SET
    name = COALESCE(sqlc.narg('name'), name),
    description = COALESCE(sqlc.narg('description'), description),
    price_usdc = COALESCE(sqlc.narg('price_usdc'), price_usdc),
    delivery_content = COALESCE(sqlc.narg('delivery_content'), delivery_content),
    image_urls = COALESCE(sqlc.narg('image_urls'), image_urls),
    external_url = COALESCE(sqlc.narg('external_url'), external_url),
    requires_shipping = COALESCE(sqlc.narg('requires_shipping'), requires_shipping),
    payment_mode = COALESCE(sqlc.narg('payment_mode'), payment_mode),
    stock = COALESCE(sqlc.narg('stock'), stock),
    updated_at = now()
WHERE id = @id
RETURNING *;

-- name: UpdateProductStatus :one
UPDATE products SET status = $2, updated_at = now() WHERE id = $1 RETURNING *;

-- name: DeleteProduct :exec
DELETE FROM products WHERE id = $1;

-- name: DecrementProductStock :one
UPDATE products SET stock = stock - 1, updated_at = now()
WHERE id = $1 AND (stock > 0 OR stock = -1)
RETURNING *;

-- name: RestoreProductStock :exec
UPDATE products SET stock = stock + 1, updated_at = now()
WHERE id = $1 AND stock >= 0;

-- name: SearchProducts :many
SELECT p.*, s.name as store_name, s.slug as store_slug
FROM products p
JOIN stores s ON p.store_id = s.id
WHERE p.status = 'active' AND p.tsv @@ plainto_tsquery('english', $1)
ORDER BY ts_rank(p.tsv, plainto_tsquery('english', $1)) DESC
LIMIT $2 OFFSET $3;

-- name: CountProductsByStore :one
SELECT COUNT(*) FROM products WHERE store_id = $1 AND status = 'active';
