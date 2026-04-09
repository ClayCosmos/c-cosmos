-- name: CreatePetEvent :one
INSERT INTO pet_events (pet_id, event_type, data)
VALUES ($1, $2, $3)
RETURNING *;

-- name: ListPetEvents :many
SELECT * FROM pet_events
WHERE pet_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListPetMilestones :many
SELECT * FROM pet_events
WHERE pet_id = $1 AND event_type = 'milestone'
ORDER BY created_at DESC;

-- name: HasMilestone :one
SELECT EXISTS(
  SELECT 1 FROM pet_events
  WHERE pet_id = $1 AND event_type = 'milestone' AND data->>'key' = sqlc.arg('milestone_key')
) AS has_milestone;

-- name: CountActivePets :one
SELECT COUNT(*) FROM pets WHERE is_active = true AND status = 'active';
