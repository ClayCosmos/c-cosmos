-- name: CreatePet :one
INSERT INTO pets (agent_id, name, species, personality, color_primary, color_secondary)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetPetByID :one
SELECT * FROM pets WHERE id = $1;

-- name: GetPetByAgent :one
SELECT * FROM pets WHERE agent_id = $1;

-- name: ListPets :many
SELECT * FROM pets WHERE is_active = TRUE ORDER BY created_at DESC LIMIT $1 OFFSET $2;

-- name: ListPetsBySpecies :many
SELECT * FROM pets WHERE is_active = TRUE AND species = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3;

-- name: UpdatePetStats :one
UPDATE pets SET
  hunger = coalesce(sqlc.narg('hunger'), hunger),
  mood = coalesce(sqlc.narg('mood'), mood),
  energy = coalesce(sqlc.narg('energy'), energy),
  social_score = coalesce(sqlc.narg('social_score'), social_score),
  updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdatePet :one
UPDATE pets SET
  name = coalesce(sqlc.narg('name'), name),
  personality = coalesce(sqlc.narg('personality'), personality),
  color_primary = coalesce(sqlc.narg('color_primary'), color_primary),
  color_secondary = coalesce(sqlc.narg('color_secondary'), color_secondary),
  accessories = coalesce(sqlc.narg('accessories'), accessories),
  updated_at = now()
WHERE id = $1 AND agent_id = $2
RETURNING *;

-- name: FeedPet :one
UPDATE pets SET
  hunger = GREATEST(0, hunger - 40),
  mood = LEAST(100, mood + 15),
  xp = xp + 10,
  last_fed_at = now(),
  updated_at = now()
WHERE id = $1 AND agent_id = $2
RETURNING *;

-- name: TickPetStats :exec
UPDATE pets SET
  hunger = LEAST(100, hunger + 5),
  energy = LEAST(100, energy + 3),
  mood = GREATEST(0, mood - 2),
  last_tick_at = now(),
  updated_at = now()
WHERE is_active = TRUE AND (last_tick_at IS NULL OR last_tick_at < now() - interval '30 minutes');

-- name: LevelUpPet :one
UPDATE pets SET
  level = level + 1,
  evolution_stage = CASE
    WHEN level + 1 >= 30 THEN 'elder'
    WHEN level + 1 >= 15 THEN 'adult'
    WHEN level + 1 >= 5 THEN 'teen'
    ELSE 'baby'
  END,
  updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeletePet :exec
UPDATE pets SET is_active = FALSE, updated_at = now() WHERE id = $1 AND agent_id = $2;
