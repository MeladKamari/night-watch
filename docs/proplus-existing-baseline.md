# Pro+ existing SDK baseline (STEP 001)

**Audited:** 2026-11-03  
**Status:** Inventory **IMPLEMENTED** and partially **VALIDATED** by local build/tests.  
**Git commit:** unavailable (no `.git` directory in this workspace).

This document freezes what Pro+ must treat as immutable until an explicit adapter review.

## Product identity

| Item | Value |
|---|---|
| Root package | `independent-browser-fingerprint@1.0.0` |
| Core | `@night-watch/core@1.0.0` |
| Browser SDK | `@night-watch/browser-sdk@1.0.0` |
| Playground | `@night-watch/playground@1.0.0` (private) |
| Tooling | pnpm 12.15.0 workspace, TypeScript 5.8, Vitest, Playwright |
| Network default | No runtime vendor CDN / telemetry (`monitoring` is a no-op) |

## Algorithm revision (immutable for Pro+ bridge)

| Field | Locked value |
|---|---|
| `SOURCE_MANIFEST_REVISION` | `default-v1` |
| `hashingRevision` | `murmur3-x64-128-canonical-v1` |
| `confidenceRevision` | `heuristic-platform-v1` |
| Enabled sources | **41** (exact order in `packages/core/src/registry.ts`) |
| Excluded upstream source | `applePay` |
| Upstream pin | FingerprintJS OSS `v5.3.0` / commit `dac5ae59409669f09aa09c0b2f44b7615b0520da` |

### VisitorId contract

- `visitorId = hashComponents(components)` ? MurmurHash3 x64 128, 32-char hex.
- Duration is never hashed.
- Error components serialize to the literal sentinel `error`.
- Raw upstream visitorId equality is **false** (41 vs 42 sources); filtered-hash comparison remains the parity approach.
- Golden locks live in `tests/fixtures/hash-golden-vectors.json` and are re-asserted by `tests/proplus-step001-baseline.test.ts`.

Locked sample hashes:

| Vector | Hash |
|---|---|
| identitySourcesSelfHash (41 keys = source name) | `c5e055512be85b8798fe5d3240b2a04e` |
| componentsSample `a:"x"|b:1` | `b0a3ed33df2bfd9f8ead1eebe9d2cf99` |
| componentsErrorNull | `16fed7428df994fb38b63c173b7b39f9` |

## Monorepo layout (observed)

```
packages/core          # registry, collectors, hash, confidence, runtime helpers
packages/browser-sdk   # load()/get(), 41 sources, opt-in extensions
apps/playground        # local Vite playground
tests/                 # Vitest + Playwright e2e
reference/             # iran profile, inventory, parity/perf reports
docs/                  # SDK docs + this Pro+ baseline
docs/proplus-progress/ # Step progress notes (spec only)
```

**Not present:** ASP.NET Core backend, PostgreSQL/Redis wiring, Angular/PrimeNG dashboard, Pro+ package namespace.

## Public API surface (stable)

Primary: `load()` ? `Agent.get()` ? `{ visitorId, confidence, components, version }`.

Stable extension points (must not rewrite legacy defaults):

- `customSources` / `excludeSources` / `mergeBuiltinSources`
- `extendComponents` / `omitComponents` / `withComponent`
- Opt-in: collection policy, namespaced IDs, reliability profiles, plugin SDK, resource budgets, diagnostics, change inspector, entropy experiments
- Metadata-only: `source-meta` (does not alter visitorId)
- Design-only: `server-design` constant (no network client)

## Prior 73-step claim vs evidence

| Claim (docs/PROGRESS.md) | Evidence this audit |
|---|---|
| Steps 01–73 PASS | Source tree contains foundations, 41 collectors, bundles, CI guards, optional enhancements 63–73 |
| 529 Vitest tests | Re-run: **529 passed** |
| applePay excluded | Registry + CI guard PASS |
| Server integration | Design-only (`docs/SERVER_INTEGRATION_DESIGN.md`); no runtime client |

## Machine-readable inventory

See `docs/proplus-inventory/existing-sdk-inventory.json`.

## Scope for Pro+ (reminder)

- Extend; do **not** rewrite `visitorId` / `default-v1`.
- Web JS/TS + ASP.NET Core only; no native mobile SDKs.
- 19 web/server Smart Signals planned later; 10 native-only deferred; never fake them in JS.
- No proprietary Fingerprint Pro code or accuracy-parity claims.
