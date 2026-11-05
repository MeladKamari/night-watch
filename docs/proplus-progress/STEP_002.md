# STEP 002 — Separate independent Pro+ namespace and packages

**Date:** 2026-11-03  
**Status:** Packages **IMPLEMENTED**; typecheck + Vitest **VALIDATED** (541 tests).

## Product identity

| Field | Value |
|---|---|
| Product | **Night Watch** |
| Code | `night-watch` |
| npm scope | `@night-watch` |
| Server identity algorithm | `night-watch-identity-v0` |
| Legacy browser revision | unchanged `default-v1` |

## Packages added

| Package | Path |
|---|---|
| `@night-watch/contracts` | `packages/pro-contracts` |
| `@night-watch/browser-adapter` | `packages/pro-browser-adapter` |
| `@night-watch/server-sdk` | `packages/pro-server-sdk` |
| `@night-watch/dashboard-client` | `packages/pro-dashboard-client` |

Also: `docs/proplus-compatibility.md`, `tests/proplus-step002-packages.test.ts`, lockfile/SBOM/checksum refresh.

## Commands

| Command | Result |
|---|---|
| `pnpm install` | PASS (linked 4 new workspace packages) |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS — **71** files / **541** tests |
| `pnpm run ci:lockfile` | PASS (after checksum regen) |

## Validation

- Adapter imports `@night-watch/browser-sdk` / `@night-watch/core` and preserves `hashComponents` visitorId.
- Rejects mutated visitorId and `applePay` leakage.
- Server SDK blocks vendor Fingerprint hosts.
- Legacy packages do not depend on `@night-watch/*`.

## Limitations

- Server/dashboard clients are scaffolds; backend not bootstrapped yet (STEP 004+).
- No network identify validation against a live API.

## Next

STEP 003 — System architecture, ADRs and boundaries.
