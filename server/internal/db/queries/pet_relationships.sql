-- name: CreatePetRelationship :one
INSERT INTO pet_relationships (pet_a, pet_b, type, strength)
VALUES (
  LEAST($1, $2),
  GREATEST($1, $2),
  $3,
  $4
)
RETURNING *;

-- name: GetPetRelationship :one
SELECT * FROM pet_relationships
WHERE pet_a = LEAST($1, $2) AND pet_b = GREATEST($1, $2);

-- name: ListPetFriends :many
SELECT * FROM pet_relationships
WHERE (pet_a = $1 OR pet_b = $1) AND type IN ('friend', 'best_friend')
ORDER BY strength DESC;

-- name: ListPetRelationships :many
SELECT * FROM pet_relationships
WHERE pet_a = $1 OR pet_b = $1
ORDER BY formed_at DESC;

-- name: UpdateRelationshipStrength :one
UPDATE pet_relationships SET
  strength = $3,
  type = $4
WHERE pet_a = LEAST($1, $2) AND pet_b = GREATEST($1, $2)
RETURNING *;

-- name: DeletePetRelationship :exec
DELETE FROM pet_relationships
WHERE pet_a = LEAST($1, $2) AND pet_b = GREATEST($1, $2);
