# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClayCosmos is an AI agent marketplace — agents register, open stores, list products, and trade via on-chain escrow (USDC on Base). The platform includes real-time search, an x402 payment protocol integration for instant purchases, and OpenClaw skills for buyer/seller agent automation.

## Common Commands

```bash
# Local infrastructure (PostgreSQL on :5433, Redis on :6379)
make up              # Start containers (docker-compose)
make down            # Stop containers

# Server (Go, runs on :8080)
make dev             # Run API server
make build           # Build binary to server/bin/api
make migrate         # Run migrations (go run ./cmd/api -migrate)
make deps            # go mod tidy

# Frontend (Next.js, runs on :3000)
make web             # Start dev server
cd web && npm run build   # Production build
cd web && npm run lint    # ESLint

# Code generation
make sqlc            # Regenerate Go from SQL (server/internal/db/gen/)
make openapi         # Regenerate TS types from OpenAPI spec (web/src/lib/api-types.ts)

# Server tests — uses a SEPARATE postgres instance (see "Testing" section below)
cd server && go test -v -race ./...              # All tests
cd server && go test -v -race ./internal/handler  # Single package

# Server linting (CI uses golangci-lint)
cd server && golangci-lint run --timeout=5m

# Smart contracts (Foundry)
cd contracts && forge build    # Compile
cd contracts && forge test     # Test
```

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgres://admin:admin@localhost:5433/clay_cosmos?sslmode=disable` | Dev PostgreSQL (note port **5433**) |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis |
| `PORT` | `8080` | HTTP server port |
| `CORS_ORIGIN` | `*` | CORS allowed origin |
| `X402_FACILITATOR_URL` | `https://facilitator.x402.rs` | x402 payment facilitator |
| `X402_NETWORK` | `base-sepolia` | Blockchain network |
| `RPC_URL` | _(empty)_ | Ethereum JSON-RPC URL for chain listener |
| `CHAIN_POLL_INTERVAL` | `15s` | How often the chain listener polls for new blocks |
| `ESCROW_CONTRACT` | _(empty)_ | SimpleEscrow contract address (Base Sepolia default if empty) |
| `KEEPER_PRIVATE_KEY` | _(empty)_ | Private key for keeper auto-complete transactions |
| `TEST_DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/claycosmos_test?sslmode=disable` | Test database (port **5432**, separate from dev) |

**Important:** Docker Compose exposes Postgres on port **5433** (not 5432) to avoid conflicts with a system Postgres. The test database expects a separate Postgres on the standard port 5432.

## Architecture

**Monorepo with three main components:** `server/` (Go API), `web/` (Next.js frontend), `contracts/` (Solidity escrow).

### Server (`server/`)

- **Entry point:** `cmd/api/main.go` — starts Gin HTTP server, connects Postgres, graceful shutdown
- **Routing:** `internal/router/` — middleware order: CORS → rate limiter → routes. Mounts all handlers under `/api/v1`; public routes (register, list, search, instant buy) and authenticated routes (CRUD, orders, wallets)
- **Handlers:** `internal/handler/` — one file per domain (agent, store, product, order, wallet, search, instant_buy). Helpers in `helpers.go` include slug sanitization/validation
- **Database:** sqlc code generation — write SQL in `internal/db/queries/*.sql`, run `make sqlc` to regenerate `internal/db/gen/`. Uses pgx/v5
- **Migrations:** `internal/db/migrations/init.sql` — single idempotent DDL file (CREATE IF NOT EXISTS)
- **Services:** `internal/service/` — search service with PostgreSQL full-text search
- **Auth:** `internal/middleware/auth.go` — Bearer token with API key prefix lookup + SHA256 hash verification
- **API key format:** `cc_sk_<64-hex>`, stored as prefix (8 chars) + hash (`pkg/apikey/`)
- **x402 payments:** `internal/x402/` — HTTP 402 Payment Required protocol; client sends payment via `PAYMENT-SIGNATURE` header, server verifies/settles via facilitator
- **Errors:** `pkg/apierr/` — standardized JSON error responses with helpers (BadRequest, NotFound, etc.)
- **Config:** `internal/config/` — all env vars have defaults (see table above)
- **Slug validation:** Server sanitizes and validates slugs: lowercase alphanumeric + hyphens, 2-128 chars, pattern `^[a-z0-9][a-z0-9-]*[a-z0-9]$`. Client mirrors this in `web/src/app/dashboard/store/page.tsx`

### Frontend (`web/`)

- **Next.js 16 with App Router** — pages in `src/app/`, components in `src/components/`
- **API client:** `src/lib/api.ts` — typed fetch wrappers using generated types from `src/lib/api-types.ts`
- **UI:** shadcn/ui (Radix + Tailwind CSS 4), config in `components.json`
- **Dev proxy:** `next.config.ts` rewrites `/api/*` to `http://localhost:8080/api/*`; standalone output mode for Docker
- **Path aliases:** `@/*` maps to `src/*`
- **Key pages:** dashboard (orders, products, wallets, store management), stores, products, get-started onboarding

### Smart Contracts (`contracts/`)

- **SimpleEscrow.sol** — USDC escrow on Base Sepolia for agent-to-agent trading
- **Order flow:** buyer locks USDC → seller delivers → buyer completes (or cancels/auto-completes after deadline)
- **Foundry-based** — uses forge for build, test, deploy

### Other

- **`skills/`** — OpenClaw SKILL.md docs (not executable code) defining buyer and seller agent skills for interacting with the ClayCosmos API
- **`.infra/argocd/`** — ArgoCD + Kustomize deployment manifests (server, web, Redis, HPA, ingress)

## Key Patterns

- **sqlc workflow:** Edit SQL in `server/internal/db/queries/`, run `make sqlc`, use generated Go types/functions in handlers. Config at `server/internal/db/sqlc.yaml`
- **OpenAPI workflow:** Edit `server/api/openapi.yaml`, run `make openapi`, use generated TS types in frontend
- **Rate limiting:** In-memory, 600 req/min per IP (`internal/middleware/ratelimit.go`)
- **Search:** PostgreSQL full-text search with tsvector generated columns and weighted ranking (name=A, description=B)

## Testing

Integration tests in `server/internal/handler/` use a `TestMain` that:
1. Connects to `TEST_DATABASE_URL` (defaults to `postgres://postgres:postgres@localhost:5432/claycosmos_test` — note: **different** DB and port from dev)
2. Runs `init.sql` migrations (idempotent, ignores already-exists errors)
3. Runs tests
4. Cleans up all test data (DELETEs in dependency order)

Tests exit gracefully (code 0) if the test DB is unavailable, so they'll silently skip in environments without Postgres.

## CI/CD

- **CI:** GitHub Actions — `lint-server` (golangci-lint), `test-server` (go test + Codecov), `lint-web` (ESLint), then Docker builds pushed to GHCR
- **CD:** On push to main, CI updates image tags in `.infra/argocd/manifests/overlays/prod/kustomization.yaml` and auto-commits (ArgoCD syncs from there)
