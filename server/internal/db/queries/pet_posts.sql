-- name: CreatePetPost :one
INSERT INTO pet_posts (pet_id, content, post_type)
VALUES ($1, $2, $3)
RETURNING *;

-- name: HasRecentDuplicatePost :one
SELECT EXISTS(
  SELECT 1 FROM pet_posts
  WHERE pet_id = $1 AND content = $2 AND created_at > now() - interval '1 hour'
) AS has_duplicate;

-- name: GetLastPostTime :one
SELECT created_at FROM pet_posts
WHERE pet_id = $1
ORDER BY created_at DESC
LIMIT 1;

-- name: GetPetPost :one
SELECT * FROM pet_posts WHERE id = $1;

-- name: ListFeed :many
SELECT * FROM pet_posts ORDER BY created_at DESC LIMIT $1 OFFSET $2;

-- name: ListFeedWithPets :many
SELECT
  pp.id, pp.pet_id, pp.content, pp.post_type, pp.likes_count, pp.comments_count, pp.created_at,
  p.name AS pet_name, p.species AS pet_species, p.level AS pet_level,
  p.color_primary AS pet_color_primary, p.mood AS pet_mood,
  p.evolution_stage AS pet_evolution_stage
FROM pet_posts pp
JOIN pets p ON p.id = pp.pet_id
WHERE p.is_active = TRUE
ORDER BY pp.created_at DESC
LIMIT $1 OFFSET $2;

-- name: ListPetPosts :many
SELECT * FROM pet_posts WHERE pet_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3;

-- name: DeletePetPost :exec
DELETE FROM pet_posts WHERE id = $1 AND pet_id = $2;

-- name: IncrementPostLikes :exec
UPDATE pet_posts SET likes_count = likes_count + 1 WHERE id = $1;

-- name: DecrementPostLikes :exec
UPDATE pet_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1;

-- name: IncrementPostComments :exec
UPDATE pet_posts SET comments_count = comments_count + 1 WHERE id = $1;

-- name: CreatePetComment :one
INSERT INTO pet_comments (post_id, pet_id, content)
VALUES ($1, $2, $3)
RETURNING *;

-- name: ListPostComments :many
SELECT * FROM pet_comments WHERE post_id = $1 ORDER BY created_at ASC LIMIT $2 OFFSET $3;

-- name: CreatePetReaction :one
INSERT INTO pet_reactions (post_id, pet_id, emoji)
VALUES ($1, $2, $3)
ON CONFLICT (post_id, pet_id) DO UPDATE SET emoji = EXCLUDED.emoji
RETURNING *;

-- name: DeletePetReaction :exec
DELETE FROM pet_reactions WHERE post_id = $1 AND pet_id = $2;

-- name: ListPostReactions :many
SELECT * FROM pet_reactions WHERE post_id = $1;
