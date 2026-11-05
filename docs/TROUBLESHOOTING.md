# Operational troubleshooting

## `load()` throws `UnsupportedEnvironmentError`

**Cause:** Called under Node/SSR without a DOM.  
**Fix:** Dynamic-import the SDK only in client components / `useEffect` /
`onMount`, or gate with `typeof window !== 'undefined'`.

## Empty / unstable `visitorId` after upgrades

1. Check `result.version` and `SOURCE_MANIFEST_REVISION`.
2. Diff `components` with `componentsToDebugString`.
3. Confirm you did not change `excludeSources` / custom sources silently.
4. Private mode, blocked storage, disabled WebGL/Audio change components —
   expected, not a bug by itself.

## `confidence.score` “looks wrong”

It is a heuristic band, not a calibrated model. See
`docs/ACCURACY_AND_LIMITATIONS.md`. Do not map it to fraud decisions alone.

## Canvas / WebGL / Audio differ in headless CI

Headless Chromium often uses software GL and may omit `window.chrome`.
Lab reports document this; real-device rows may be **NOT RUN**.

## CSP blocks the playground inline demo

Production should self-host `fp.min.js` as a file. Avoid relying on
`unsafe-inline` / `unsafe-eval`.

## Unexpected network requests during `get()`

This SDK must not call vendor CDNs. If you see egress:

1. Confirm you loaded **local** `@ibf` artifacts (not a mistaken FingerprintJS
   CDN tag).
2. Check host page third-party tags.
3. Re-run zero-egress Playwright matrix tests.

## `applePay` appears in types or registry

Should be impossible for Default-profile. Run `pnpm run ci:guard` and
`pnpm test` (registry suite). Do not add padding keys.

## Persian RTL page “breaks” fingerprint

Direction alone must not change `visitorId` (same locale/tz). Locale or
timezone changes can. See perf-entropy report mode comparisons.

## Install fails offline

Ensure the pnpm store was transferred and `pnpm-lock.yaml` matches.
Use `pnpm install --offline --frozen-lockfile`. See `docs/BUILD.md`.
