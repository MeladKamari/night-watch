# Build, bundles, checksums, offline install

## Toolchain

| Tool | Pin |
|---|---|
| Node | `>=20` (`engines`) |
| pnpm | `12.15.0` (`packageManager`) |
| TypeScript | workspace `devDependency` |

Commit `pnpm-lock.yaml`. Prefer `pnpm install --frozen-lockfile` in CI.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build          # tsc -b + Rollup bundles
pnpm test           # Vitest (runs build via pretest)
pnpm test:e2e       # Playwright
pnpm run ci:sbom    # CycloneDX → reference/sbom.cdx.json
pnpm run ci:checksums
pnpm run audit:prod
```

## Artifacts (`@night-watch/browser-sdk`)

| Path | Format |
|---|---|
| `dist/index.js` + `.d.ts` | Modular ESM + types |
| `dist/fp.esm(.min).js` | Bundled ESM |
| `dist/fp(.min).cjs` | CJS |
| `dist/fp(.min).js` | IIFE → `NightWatch` |
| `dist/fp.umd(.min).js` | UMD |

`@night-watch/core` ships `dist/core.esm(.min).js` and `dist/core(.min).cjs`.

## Version pinning

- Pin `@night-watch/browser-sdk` and `@night-watch/core` to **exact** versions in apps.
- Record `SOURCE_MANIFEST_REVISION` (`default-v1`) beside stored visitorIds.
- After rebuild, refresh SRI hashes / `ci:checksums` output before deploy.

## Checksums

```bash
pnpm build
pnpm run ci:checksums
# writes reference/artifact-checksums.sha256
```

Verify after transfer:

```bash
# Linux / macOS
sha256sum -c reference/artifact-checksums.sha256
```

## Private registry / offline mirror

1. Connected host: populate pnpm store / Verdaccio / Artifactory mirror; run
   `pnpm audit --prod` and `pnpm run ci:sbom`.
2. Copy store + lockfile + sources; verify SHA-256 of the archive.
3. Air-gapped: `pnpm install --offline --frozen-lockfile && pnpm build`.
4. Serve `fp.min.js` (or ESM) from **your** origin only.

See also **`docs/OFFLINE_SUPPLY_CHAIN.md`** (step 73): lockfile integrity,
vendor-bundle audit, provenance guidance, air-gapped checklist.

## CSP notes

- Prefer external script file + CSP `script-src 'self'`.
- Bundles avoid `eval` / `new Function`.
- Playground/tests may use inline scripts; production pages should not require
  `unsafe-eval`.

## Excluded source guard

`pnpm run ci:guard` fails if production code reintroduces Apple Pay collectors.
See step 60 / D-063.
