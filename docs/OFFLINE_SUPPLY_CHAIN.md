# Supply chain reproducibility and offline distribution (step 73)

Complements `docs/BUILD.md`. Default fingerprint runtime still has **no egress**.

## Lockfile integrity

```bash
pnpm install --frozen-lockfile
pnpm run ci:lockfile          # sha256 of pnpm-lock.yaml (+ match checksums file)
pnpm build
pnpm run ci:checksums         # refresh reference/artifact-checksums.sha256
pnpm run ci:vendor-audit      # static scan of min bundles (no telemetry hosts)
pnpm run ci:sbom
```

Commit `pnpm-lock.yaml`. CI should fail on lockfile drift.

## Reproducible builds

1. Pin Node `>=20` and pnpm via `packageManager` (`12.15.0`).
2. `pnpm install --frozen-lockfile`
3. `pnpm build` then `pnpm run ci:checksums`
4. Compare artifact SHA-256 across machines; investigate non-determinism (timestamps,
   locale) before release.

## npm provenance (guidance)

When publishing `@night-watch/*` with human authorization:

- Prefer npm provenance / OIDC-signed publishes from CI.
- Publish with `publishConfig.tag` (`next` for RC) as already configured.
- Record provenance URL + checksums beside the git tag.

## Vendor bundle audit

`ci:vendor-audit` forbids `openfpcdn`, Fingerprint CDN hosts, GA/Facebook pixels,
and Apple Pay collectors inside dist bundles.

## Air-gapped / offline pack

1. Online machine: `pnpm fetch` / populate store; `pnpm run ci:sbom`; Playwright
   browser download if e2e is required offline.
2. Archive: sources + `pnpm-lock.yaml` + store + `reference/artifact-checksums.sha256`
   + SBOM; verify archive SHA-256 after transfer.
3. Offline: `pnpm install --offline --frozen-lockfile && pnpm build`
4. Serve only first-party `fp.min.js` / ESM from your origin.

## Reviewable releases

- Annotated tag (see `docs/TAG_PLAN.md`)
- `CHANGELOG.md` entry
- Checksums + SBOM attached
- `ci:release-gate` hard checks

Revision note: supply-chain tooling does not alter `SOURCE_MANIFEST_REVISION`.
