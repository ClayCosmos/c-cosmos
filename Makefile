.PHONY: dev build migrate migrate-down generate sqlc openapi deps up down web

# Start Go API server
dev:
	cd server && go run ./cmd/api

# Build Go binary
build:
	cd server && go build -o bin/api ./cmd/api

# Run database migrations up
migrate:
	cd server && go run ./cmd/api -migrate

# Generate sqlc Go code
sqlc:
	cd server/internal/db && sqlc generate

# Generate frontend types from OpenAPI spec
openapi:
	cd web && npx openapi-typescript ../server/api/openapi.yaml -o src/lib/api-types.ts

# Install Go dependencies
deps:
	cd server && go mod tidy

# Start all services
up:
	docker-compose up -d

# Stop all services
down:
	docker-compose down

# Start frontend dev server
web:
	cd web && PORT=3000 npm run dev
