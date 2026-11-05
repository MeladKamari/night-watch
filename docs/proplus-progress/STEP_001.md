# STEP 001 — Inventory the completed open-source SDK

**Track:** `01_FOUNDATION_AND_INTEGRATION`  
**Date:** 2026-11-03  
**Feature status:** Inventory **IMPLEMENTED**; local quality gates **VALIDATED** (Vitest/typecheck/build/registry/guard). Playwright e2e and lint **NOT RUN**.  
**STOP:** Awaiting approval before STEP 002.

## Objective result

The Self-hosted 41-source TypeScript SDK is present and healthy in this workspace. Pro+ must extend it — not rewrite `visitorId` / `default-v1`. No ASP.NET / Angular / Redis / Postgres / Pro+ packages exist yet.

## Changed / added files

| Path | Change |
|---|---|
| `docs/proplus-inventory/existing-sdk-inventory.json` | Machine-readable inventory (packages, 41 sources, extension points, hashes) |
| `docs/proplus-existing-baseline.md` | Human baseline freeze for Pro+ |
| `docs/proplus-risk-register.md` | Initial Pro+ risk register |
| `docs/proplus-progress/STEP_001.md` | This handoff |
| `tests/proplus-step001-baseline.test.ts` | visitorId / algorithm stability lock (before ≡ after) |

**Not modified:** `@night-watch/core` / `@night-watch/browser-sdk` collectors, hash, registry, agent, or prior tests.

## Commands actually run and outputs

| Command | Exit | Output summary |
|---|---:|---|
| `pnpm build` | 0 | `tsc -b` + Rollup core/browser bundles OK |
| `pnpm typecheck` | 0 | root + `@night-watch/playground` OK |
| `pnpm test` (pre-change) | 0 | **69** files / **529** tests passed |
| `pnpm test:registry` | 0 | **10** node:test registry locks passed |
| `pnpm run ci:guard` | 0 | `CI guard PASS: no payment-source collector/API…` |
| `pnpm exec vitest run tests/proplus-step001-baseline.test.ts` | 0 | **6** passed |
| `pnpm test` (post-change) | 0 | **70** files / **535** tests passed |
| `pnpm lint` | — | **NOT RUN** |
| `pnpm test:e2e` | — | **NOT RUN** |

### Algorithm probe (Node)

```
SOURCE_MANIFEST_REVISION default-v1
hashingRevision murmur3-x64-128-canonical-v1
confidenceRevision heuristic-platform-v1
enabled 41
excluded applePay
identitySourcesSelfHash c5e055512be85b8798fe5d3240b2a04e
sampleHash b0a3ed33df2bfd9f8ead1eebe9d2cf99
```

`createBuiltinSources()` → 41 keys, `stillNotImplemented: []`.

### Git

`fatal: not a git repository` — no commit SHA available. Recorded in inventory as `gitCommit: null`.

## Implementation / validation status

| Item | Status | Evidence |
|---|---|---|
| Enumerate SDK packages | **VALIDATED** | `@night-watch/core`, `@night-watch/browser-sdk`, `@night-watch/playground` |
| Enumerate 41 sources | **VALIDATED** | Registry + inventory + builtin wiring |
| applePay exclusion | **VALIDATED** | Registry + `ci:guard` |
| visitorId unchanged by STEP 001 | **VALIDATED** | Golden hashes match inventory locks |
| Prior steps 01–73 claim | **PARTIALLY VALIDATED** | Code + 529 tests support claim; e2e matrix not re-run here |
| Pro+ backend/dashboard | **MISSING** | No `.csproj` / `angular.json` |
| Native SDKs | **UNSUPPORTED / out of scope** | Correctly absent |

## Stable extension points (for STEP 002+)

- `load({ customSources, excludeSources })` / `mergeBuiltinSources`
- Component helpers: `extendComponents`, `omitComponents`, `withComponent`
- Opt-in modules: policy, identity scope, reliability profiles, plugins, budgets, diagnostics, inspector, experiments
- Metadata / design-only: `source-meta`, `server-design`
- Do **not** mutate `SOURCE_MANIFEST_REVISION` or default `hashComponents` without reviewed adapter

## Blockers

1. **No git repository** — provenance/rollback commit pinning blocked until VCS is attached.
2. **Pro+ stack absent** — expected; start at STEP 002 (package separation), not a silent rewrite.
3. **E2E / lint not executed this step** — residual risk R-012 in risk register.

## Rollback

Delete the five added paths above. No SDK source rollback required (algorithm files untouched; digests locked in inventory).

## Next step

**STEP 002** — `steps/01_FOUNDATION_AND_INTEGRATION/002_separate-independent-pro-namespace-and-packages.md`  
Separate independent Pro+ namespace and packages **without** changing legacy visitorId behavior.

**Awaiting explicit user approval before starting STEP 002.**
