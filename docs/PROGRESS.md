# Progress Ledger

## Current step

| Field | Value |
|---|---|
| Step | **73** — final optional enhancement |
| Phase | `04_optional_enhancements` |
| Status | **PASS** (steps **70–73**) |
| Date | 2026-11-03 |
| Next pending | **None** — cursor track **01–73** complete |

## Scope completed (steps 70–73)

- **70:** Consent-gated entropy experiment harness (`night-watch-entropy-experiments-v1`).
- **71:** First-party server integration **design only** (no runtime client).
- **72:** Hash-neutral source metadata registry (`night-watch-source-metadata-v1`).
- **73:** Lockfile integrity + vendor bundle audit + offline supply-chain docs.
- Default `load()` / `SOURCE_MANIFEST_REVISION` **unchanged**.
- ADR-081…084 / D-073…D-076.

## Quality gates

| Command | Status | Notes |
|---|---|---|
| `pnpm lint` | **PASS** | |
| `pnpm typecheck` | **PASS** | |
| `pnpm build` | **PASS** | |
| `pnpm test` | **PASS** | 529 Vitest |
| `pnpm test:e2e` (experiments) | **PASS** | Chromium entropy-experiments |
| `pnpm run ci:lockfile` | **PASS** | |
| `pnpm run ci:vendor-audit` | **PASS** | 6 bundles |

## Still NOT RUN (environment)

- Real-device Iran hardware matrix.
- Remote GitHub Actions / npm publish (need explicit authorization).
