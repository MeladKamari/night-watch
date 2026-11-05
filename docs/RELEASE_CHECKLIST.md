# Release checklist — `@night-watch/*` 1.0.0

**Authorization:** Do **not** run `npm publish`, `pnpm publish`, or push release
tags to a remote unless a human explicitly authorizes that action.

## Pre-tag hard gates (must be green locally)

| Gate | Command | Required |
|---|---|---|
| Lint | `pnpm lint` | PASS |
| Typecheck | `pnpm typecheck` | PASS |
| Build | `pnpm build` | PASS |
| Unit | `pnpm test` | PASS |
| Examples | `pnpm run examples:typecheck` | PASS |
| Payment-source guard | `pnpm run ci:guard` | PASS |
| Bundle smoke | `pnpm run ci:bundle-smoke` | PASS |
| Prod audit | `pnpm run audit:prod` | PASS |
| SBOM | `pnpm run ci:sbom` | PASS |
| Checksums | `pnpm run ci:checksums` | PASS |
| Release gate | `pnpm run ci:release-gate` | PASS |
| E2E | `pnpm test:e2e` | PASS (or document NOT RUN) |

## Self-hosted acceptance (release gate encodes these)

- [ ] Exactly **41** enabled built-in sources (`default-v1`)
- [ ] **0** payment-source files / `getApplePay` / `ApplePaySession` in production bundles
- [ ] **41** per-source unit + e2e test pairs present
- [ ] Filtered hash / upstream differential report present (`reference/upstream-diff-report.*`)
- [ ] `fa-IR` + `Asia/Tehran` fixtures in browser matrix
- [ ] Self-hosted no-egress collect proof in matrix e2e
- [ ] Public API covered (`tests/public-contracts.test.ts`, `tests/agent.test.ts`)
- [ ] No unapproved telemetry (`monitoring` no-op; zero vendor egress)

## Package metadata

- [ ] `@night-watch/core` and `@night-watch/browser-sdk` versions identical (`1.0.0`)
- [ ] `LICENSE` + `NOTICE` present
- [ ] `CHANGELOG.md` section for this version
- [ ] `publishConfig.tag` is `next` for RC (stable later uses `latest` only when authorized)

## Tag plan

Follow [`docs/TAG_PLAN.md`](./TAG_PLAN.md). Annotated tag only after gates pass.

## After authorized publish (future)

1. Verify registry tarball contents (no secrets, includes `dist` + LICENSE via npm files or root NOTICE copy).
2. Smoke-install from registry into a clean project (still first-party host for IIFE).
3. File rollback notes if yanked — [`docs/ROLLBACK.md`](./ROLLBACK.md).

## Sign-off record

Write results into `reference/release-gate-report.md` (generated) and
`docs/PROGRESS.md` for step 62.
