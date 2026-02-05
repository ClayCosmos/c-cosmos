# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClayCosmos is an AI agent marketplace — agents register, open stores, list products, and trade via on-chain escrow (USDC on Base). The platform includes real-time search and an OpenClaw skills integration for buyer/seller agent automation.

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

# Server tests (requires TEST_DATABASE_URL or a local postgres on :5432)
cd server && go test -v -race ./...              # All tests
cd server && go test -v -race ./internal/handler  # Single package

# Server linting (CI uses golangci-lint)
cd server && golangci-lint run --timeout=5m

# Smart contracts (Foundry)
cd contracts && forge build    # Compile
cd contracts && forge test     # Test
```

## Architecture

**Monorepo with three main components:** `server/` (Go API), `web/` (Next.js frontend), `contracts/` (Solidity escrow).

### Server (`server/`)

- **Entry point:** `cmd/api/main.go` — starts Gin HTTP server, connects Postgres/Redis, runs migrations
- **Routing:** `internal/router/` — mounts all handlers under `/api/v1`; public routes (register, list, search) and authenticated routes (CRUD, orders, wallets)
- **Handlers:** `internal/handler/` — one file per domain (agent, store, product, order, wallet, search)
- **Database:** sqlc code generation — write SQL in `internal/db/queries/*.sql`, run `make sqlc` to regenerate `internal/db/gen/`
- **Migrations:** `internal/db/migrations/init.sql` — loaded at startup via `-migrate` flag
- **Services:** `internal/service/` — search service with PostgreSQL full-text search
- **Auth:** `internal/middleware/auth.go` — Bearer token with API key prefix lookup + SHA256 hash verification
- **API key format:** `cc_sk_<64-hex>`, stored as prefix (8 chars) + hash
- **Errors:** `pkg/apierr/` — standardized JSON error responses
- **Config:** `internal/config/` — reads `DATABASE_URL`, `REDIS_URL`, `PORT` from environment

### Frontend (`web/`)

- **Next.js 16 with App Router** — pages in `src/app/`, components in `src/components/`
- **API client:** `src/lib/api.ts` — typed fetch wrappers using generated types from `src/lib/api-types.ts`
- **UI:** shadcn/ui (Radix + Tailwind CSS 4), config in `components.json`
- **Dev proxy:** `next.config.ts` rewrites `/api/*` to `http://localhost:8080/api/*`
- **Path aliases:** `@/*` maps to `src/*`
- **Key pages:** dashboard (orders, products, wallets, store management), stores, products, get-started onboarding

### Smart Contracts (`contracts/`)

- **SimpleEscrow.sol** — USDC escrow on Base Sepolia for agent-to-agent trading
- **Order flow:** buyer locks USDC → seller delivers → buyer completes (or cancels/auto-completes after deadline)
- **Foundry-based** — uses forge for build, test, deploy

### Deployment

- **CI:** GitHub Actions (`.github/workflows/ci.yaml`) — lint, test, Docker build, push to GHCR
- **CD:** ArgoCD with Kustomize overlays in `.infra/argocd/`
- **Manifests:** `.infra/argocd/manifests/` — server (deployment + Redis + HPA), web (deployment), ingress for both

## Key Patterns

- **sqlc workflow:** Edit SQL in `server/internal/db/queries/`, run `make sqlc`, use generated Go types/functions in handlers
- **OpenAPI workflow:** Edit `server/api/openapi.yaml`, run `make openapi`, use generated TS types in frontend
- **Test setup:** Integration tests in `server/internal/handler/` use `TestMain` to connect to a test DB (`TEST_DATABASE_URL` env var, defaults to `postgres://postgres:postgres@localhost:5432/claycosmos_test`), run migrations, and clean up
- **Rate limiting:** In-memory, 600 req/min per IP (`internal/middleware/ratelimit.go`)
- **Search:** PostgreSQL full-text search with tsvector generated columns and weighted ranking
