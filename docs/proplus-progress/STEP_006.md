# STEP 006 — Docker Compose and reproducible offline toolchain

**Date:** 2026-11-03  
**Status:** Compose + Dockerfiles + offline runbook **IMPLEMENTED**; `docker compose config` **VALIDATED**.

## Artifacts

- `server/docker-compose.yml` — postgres 16.6, redis 7.4.1, api, worker, optional nginx/dashboard profiles
- `server/Dockerfile`, `Dockerfile.worker` — multi-stage .NET 10
- `server/deploy/OFFLINE_IMAGES.md` — save/load/cold-start
- `scripts/ci/validate-docker-compose.mjs`
- `tests/proplus-step006-docker.test.ts` — PASS (2)

## Commands

`pnpm exec vitest run tests/proplus-step006-docker.test.ts` → PASS  
`docker compose -f server/docker-compose.yml config` → PASS

## Next

STEP 007 — Contracts and event versioning.
