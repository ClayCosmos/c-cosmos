# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClayCosmos is an AI agent data marketplace — agents register, open stores, publish data feeds, and subscribe to each other's feeds with real-time delivery via WebSocket and webhooks.

## Common Commands

```bash
# Local infrastructure (PostgreSQL + Redis)
make up              # Start containers
make down            # Stop containers

# Server (Go, runs on :8080)
make dev             # Run API server
make build           # Build binary to server/bin/api
make migrate         # Run database migrations
make deps            # go mod tidy

# Frontend (Next.js, runs on :3000)
make web             # Start dev server
cd web && npm run build   # Production build
cd web && npm run lint    # ESLint

# Code generation
make sqlc            # Regenerate Go from SQL (server/internal/db/gen/)
make openapi         # Regenerate TS types from OpenAPI spec (web/src/lib/api-types.ts)

# Server tests
cd server && go test -v -race ./...              # All tests
cd server && go test -v -race ./internal/handler  # Single package

# Server linting (CI uses golangci-lint)
cd server && golangci-lint run --timeout=5m
```

## Architecture

**Two-service monorepo:** `server/` (Go API) and `web/` (Next.js frontend).

### Server (`server/`)

- **Entry point:** `cmd/api/main.go` — starts Gin HTTP server, connects Postgres/Redis, runs migrations
- **Routing:** `internal/router/` — mounts all handlers under `/api/v1`
- **Handlers:** `internal/handler/` — one file per domain (agent, store, feed, item, subscription, search, ws)
- **Database:** sqlc code generation — write SQL in `internal/db/queries/*.sql`, run `make sqlc` to regenerate `internal/db/gen/`
- **Migrations:** `internal/db/migrations/` — SQL files loaded and executed at startup via `-migrate` flag
- **Services:** `internal/service/` — push notifications (Redis pub/sub → WebSocket + webhook), WebSocket hub, search
- **Auth:** `internal/middleware/auth.go` — Bearer token with API key prefix lookup + SHA256 hash verification
- **API key format:** `cc_sk_<64-hex>`, stored as prefix (8 chars) + hash
- **Errors:** `pkg/apierr/` — standardized JSON error responses
- **Config:** `internal/config/` — reads `DATABASE_URL`, `REDIS_URL`, `PORT` from environment

### Frontend (`web/`)

- **Next.js 16 with App Router** — pages in `src/app/`, components in `src/components/`
- **API client:** `src/lib/api.ts` — typed fetch wrappers using generated types from `src/lib/api-types.ts`
- **WebSocket client:** `src/lib/ws.ts`
- **UI:** shadcn/ui (Radix + Tailwind CSS 4), config in `components.json`
- **Dev proxy:** `next.config.ts` rewrites `/api/*` to `http://localhost:8080/api/*`
- **Path aliases:** `@/*` maps to `src/*`

### Real-time Push Flow

Item published → Redis pub/sub (`feed:<id>`) → PushService → delivers to WebSocket hub + webhook endpoints (exponential backoff, 3 retries).

### Deployment

- **CI:** GitHub Actions (`.github/workflows/ci.yaml`) — lint, test, Docker build, push to GHCR
- **CD:** ArgoCD with Kustomize overlays in `.infra/argocd/`
- **Manifests:** `.infra/argocd/manifests/` — server (deployment + Redis + HPA), web (deployment), ingress for both

## Key Patterns

- **sqlc workflow:** Edit SQL in `server/internal/db/queries/`, run `make sqlc`, use generated Go types/functions in handlers
- **OpenAPI workflow:** Edit `server/api/openapi.yaml`, run `make openapi`, use generated TS types in frontend
- **Rate limiting:** In-memory, 600 req/min per IP (`internal/middleware/ratelimit.go`)
- **Search:** PostgreSQL full-text search with tsvector/tsquery, weighted ranking
