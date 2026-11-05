# Architecture / Product Decisions

Format: newest first. Cross-reference `reference/parity_decisions.md` for parity-specific IDs (D-00x).

ProPlus platform ADRs (**ADR-P00x**) live in `docs/proplus-architecture/ADR_INDEX.md`.

---

## 2026-11-03 — ProPlus STEP 003: Platform architecture boundaries

### ADR-P002…P008 (summary)

- **Decision:** ASP.NET Core modular monolith + PostgreSQL SoR + Redis ephemeral cache; browser untrusted; Self-hosted/local-only; sync identify with honest degradation; Angular/PrimeNG admin later.
- **Details:** `docs/proplus-architecture/ADR_INDEX.md` and `C4_AND_FLOWS.md`.
- **Consequences:** Legacy `@night-watch/*` visitorId unchanged; server identity versioned separately (`night-watch-identity-v0`).

---

## 2026-11-03 — Steps 70–73: Final optional enhancements

### ADR-081: Consent-gated entropy experiment harness (step 70)

- **Decision:** Ship `packages/browser-sdk/src/experiments` with in-memory samples, within/across aggregates, deletion controls, revision `night-watch-entropy-experiments-v1`. No network upload. Default `load()` unchanged.
- **Consequences:** Lab stats only — not population uniqueness claims.

### ADR-082: First-party server integration design only (step 71)

- **Decision:** Publish `FIRST_PARTY_SERVER_INTEGRATION_DESIGN` + `docs/SERVER_INTEGRATION_DESIGN.md`. No runtime server/network client in `@night-watch/browser-sdk`. Browser package stays standalone.
- **Consequences:** Future server package needs a separate ADR/version.

### ADR-083: Hash-neutral source metadata registry (step 72)

- **Decision:** Ship `getSourceMetadataRegistry` (`night-watch-source-metadata-v1`) documenting privacy/stability/cost/deps for 41 sources. Does not alter `SOURCE_MANIFEST_REVISION` or visitorId.
- **Consequences:** Metadata changes that should affect hashing require an explicit algorithm ADR.

### ADR-084: Supply-chain reproducibility tooling (step 73)

- **Decision:** Add `ci:lockfile`, `ci:vendor-audit`, and `docs/OFFLINE_SUPPLY_CHAIN.md` for air-gapped install, checksums, SBOM, provenance guidance. No runtime telemetry.
- **Consequences:** Release reviewers can verify lockfile + bundle hygiene offline.

---

## 2026-11-03 — Step 69: Fingerprint change inspector

### ADR-080: Local component diff; probabilistic hints; no identity claims

- **Context:** Optional enhancement to explain why two local visitorIds/components differ without implying person/device identity.
- **Decision:** Ship `packages/browser-sdk/src/inspector` with `inspectFingerprintChange`, markdown/text `formatFingerprintChangeReport`, and `inspectFingerprintRebuild`. Reports include stable-sorted rows, value/error/duration deltas, reliability-tier expected instability, privacy-safe previews (reuse diagnostics redaction), and a fixed disclaimer that diffs are probabilistic hints only. Never list `applePay`. Default `load()` unchanged. `SOURCE_MANIFEST_REVISION` unchanged. Revision `night-watch-change-inspector-v1`.
- **Consequences:** Integrators must not present diffs as identity proof; volatile-tier changes are labeled as weak continuity signals.

---

## 2026-11-03 — Step 68: Opt-in diagnostics and reproducibility snapshots

### ADR-079: Local schema-validated snapshots; explicit export; page-context redaction

- **Context:** Optional enhancement for support/lab reproducibility without telemetry or changing default-profile fingerprint behavior.
- **Decision:** Ship `packages/browser-sdk/src/diagnostics` with `buildDiagnosticSnapshot` / `exportDiagnosticSnapshot` / `loadWithDiagnostics`, schema `night-watch-diagnostics-snapshot-v1`, revision `night-watch-diagnostics-v1`, repro seed hashing, deep redaction of page URL/title/cookies/referrer and credential-like fields, and schema validation that rejects `applePay` and leaked page-context keys. Export is explicit only; SDK performs no network upload. Default `load()` unchanged. `SOURCE_MANIFEST_REVISION` unchanged.
- **Consequences:** Snapshots remain sensitive entropy dumps — document handling; raw repro seeds omitted unless `includeRawReproSeed`.

---

## 2026-11-03 — Step 67: AbortSignal and resource budgets

### ADR-078: Opt-in budgets; abort/timeout ? error components; default load unchanged

- **Context:** Optional enhancement to abort collection and bound wall-clock / per-source time without changing default-profile fingerprint compatibility.
- **Decision:** Ship `packages/browser-sdk/src/budgets` with `loadWithResourceBudget`, versioned manifests (`night-watch-resource-budgets-v1`), linked AbortSignal + total timeout, per-source load/get stage races, optional idle `loopReleaseInterval`, and timer registry cleanup. Optional `BuiltinSourceOptions.signal` forwarded into iframe helpers (`fonts`, `fontPreferences`). Never fabricate success values — abort/timeout become error components (or `CollectionAbortError` if aborted before start). Default `load()` ignores budgets. `SOURCE_MANIFEST_REVISION` unchanged.
- **Consequences:** Partial error components change visitorId vs fully successful runs; call `dispose()` if `get()` is skipped so budget timers clear.

---

## 2026-11-03 — Step 66: Optional custom plugin SDK

### ADR-077: Opt-in plugin SDK; namespaced keys; default load unchanged

- **Context:** Optional enhancement for typed first-party custom sources with ordering, timeouts, and cleanup without changing default-profile fingerprint compatibility.
- **Decision:** Ship `packages/browser-sdk/src/plugins` with `loadWithPlugins`, `resolvePlugins`, explicit `PluginPolicy` (default prefix `ext:`, no builtin overwrite, timeout caps, `allowNetwork` disclosure only), topo-sorted execution after builtins, JSON-safe values by default, error-component isolation, and cleanup hooks. Catalog `night-watch-plugin-sdk-v1`. Sample `createPersianFontProbePlugin` is opt-in only and must not alter the 41-source registry or default IDs. `applePay` forbidden. `SOURCE_MANIFEST_REVISION` unchanged.
- **Consequences:** Any registered plugin key changes visitorId vs full default; store plugin manifest revision/ids beside IDs.

---

## 2026-11-03 — Step 65: Signal reliability profiles

### ADR-076: Opt-in reliability profiles; default load unchanged; tiers are heuristics

- **Context:** Optional enhancement to prefer more stable selectors (or label a full diagnostic run) without changing default-profile fingerprint compatibility.
- **Decision:** Ship `packages/browser-sdk/src/profiles` with `loadWithReliabilityProfile`, versioned manifests (`night-watch-reliability-profiles-v1`), and per-source tiers (`stable` / `moderate` / `volatile`). Profiles: `conservative` (stable only), `balanced` (stable+moderate), `diagnostic` (all 41 — same selectors as default `load()`). Exclusions use existing `excludeSources` so disabled collectors never start. Default `load()` ignores profiles. Tiers are operational heuristics, not calibrated stability or uniqueness. `SOURCE_MANIFEST_REVISION` unchanged.
- **Consequences:** Apps that use non-diagnostic profiles must document ID divergence vs full 41-source default; store profile id / revision beside IDs.

---

## 2026-11-03 — Step 64: Privacy-preserving configurable IDs

### ADR-075: Opt-in namespaced/salted IDs; default hash unchanged; no persistence

- **Context:** Optional first-party domain separation so unrelated apps/sites do not share the same visitorId, without claiming FingerprintJS OSS compatibility.
- **Decision:** Ship `night-watch-namespaced-v1` via `hashComponentsNamespaced` / `loadWithIdentityScope` / `applyIdentityScope`. Scope fields: required `namespace`, optional `salt` and app-supplied `domain` (not auto-read from `location`). Salt never returned in metadata (`hasSalt` only). SDK does not write IDs to storage or network. Default `load()`/`hashComponents` remain unsalted. Always set `upstreamCompatible: false`.
- **Consequences:** Salt/namespace rotation intentionally changes IDs; document scope beside stored values.

---

## 2026-11-03 — Step 63: Explicit consent and collection policies

### ADR-074: Opt-in policy module; default load unchanged; no region classification

- **Context:** Optional enhancement to gate collection on consent and omit sources by privacy category without changing default-profile fingerprint behavior.
- **Decision:** Ship `packages/browser-sdk/src/policy` with `loadWithCollectionPolicy`, `describePolicyImpact`, category map (`SOURCE_CATEGORIES`), and `CollectionConsentError` for denied/withdrawn consent. Exclusions use existing `excludeSources` so disabled collectors never start. Default `load()` ignores policies. Categories are not regional classifiers; purpose/notice strings are integrator metadata only. Does not bypass Permissions-Policy denials. `SOURCE_MANIFEST_REVISION` unchanged.
- **Consequences:** Apps that omit sources must document ID divergence vs full 41-source default.

---

## 2026-11-03 — Step 62: Release candidate and sign-off

### ADR-073: 1.0.0 cut; release-gate script; no publish without authorization

- **Context:** Integration/release phase needs a versioned RC, changelog, tag plan, checklist, rollback, and Self-hosted hard gates without accidentally publishing.
- **Decision:** Bump `@night-watch/core` and `@night-watch/browser-sdk` to **1.0.0** with `publishConfig.tag: next`. Ship `CHANGELOG.md`, `docs/RELEASE_CHECKLIST.md`, `docs/TAG_PLAN.md`, `docs/ROLLBACK.md`. Automate Iran acceptance via `ci:release-gate` (41 sources, no payment collectors, 41 unit+e2e pairs, upstream-diff + coverage evidence, fa-IR/Asia/Tehran fixtures, no-egress matrix proof). Annotated tag `v1.0.0` is planned locally only; **npm/git remote publish requires explicit human authorization**. Algorithm / `default-v1` unchanged.
- **Consequences:** RC is ready for authorized tagging. Steps 63+ remain optional enhancements.

---

## 2026-11-03 — Step 61: Licensing, documentation and public examples

### ADR-072: MIT + NOTICE; @ibf scope locked; docs/examples without CDN or compliance fiction

- **Context:** Need public README/API/migration/privacy/build/troubleshooting/accuracy docs, MIT obligations for adapted upstream algorithms, trademark-distinct naming, offline install guidance, and compilable examples (EN + optional FA).
- **Decision:** Ship root `LICENSE` (MIT for this project) and `NOTICE` (FingerprintJS OSS v5.3.0 MIT attribution + explicit non-affiliation). Confirm publish scope **`@night-watch/*`**, product label **Night Watch**, global **`NightWatch`**. Document self-host / private registry / checksums (`ci:checksums`). Privacy doc states the SDK is not a compliance substitute. Examples under `examples/` are typechecked in CI; IIFE sample uses first-party `fp.min.js` only. Algorithm / visitorId unchanged.
- **Consequences:** ADR-008 provisional scope is **locked** for the release track unless a later ADR renames before first public npm publish.

---

## 2026-11-03 — Step 60: CI security and quality gates

### ADR-071: SHA-pinned Actions; prod audit hard gate; static applePay exclusion guard

- **Context:** Need automated lint/typecheck/unit/e2e/bundle smoke, dependency audit, and SBOM with low privilege and no secret leakage, plus a CI static check that the excluded payment source cannot re-enter production code.
- **Decision:** Ship `.github/workflows/ci.yml` with actions pinned to full commit SHAs, `permissions: contents: read`, and no repository secrets. Hard gates: `pnpm lint`, `typecheck`, `build`, `test`, `ci:guard` (fails on `getApplePay` / `ApplePaySession` / forbidden filenames / `ENABLED_SOURCES` registration), offline `ci:bundle-smoke`, and `pnpm audit --prod`. SBOM via local CycloneDX generator (`ci:sbom`) uploaded as an artifact; full `pnpm audit` (dev tree) is informational only. E2E job installs Playwright browsers and runs the existing matrix (RTL / `fa-IR` / offline IIFE). Algorithm / visitorId unchanged.
- **Consequences:** Local scripts mirror CI. Remote Actions execution requires a GitHub remote (**NOT RUN** until a remote is configured).

---

## 2026-11-03 — Step 59: Performance, stability and entropy evaluation

### ADR-070: Observed baselines only; consented lab cohorts; no invented SLAs/uniqueness

- **Context:** Need microbenchmarks (p50/p95/p99), per-signal cost, rebuild stability, mode diffs, collision numerators, and bundle sizes without fabricating worldwide uniqueness, FPR, or absolute performance promises.
- **Decision:** Ship a test-only harness (`tests/harness/perf`) that aggregates consented samples into `reference/perf-entropy-report.{json,md}`. Wall-clock and per-source durations use nearest-rank percentiles. Relative-expensive flags use `factor × max(1ms, median mean)` as a profiling hint. Stability is reported as unique/N and majority share (lab rebuild×20). Collision cohorts record uniqueness ratio and approximate collision pairs with explicit “local sample only” notes. RTL-only direction must not change `visitorId`; locale/tz fixtures may. Real mid/low-end Android hardware and production-scale datasets remain **NOT RUN**. Algorithm / visitorId semantics unchanged.
- **Consequences:** `pnpm test` covers fixtures; Chromium e2e refreshes the report. No production telemetry.

---

## 2026-11-03 — Step 58: Upstream differential harness

### ADR-069: Consented dual-run harness; filter applePay; never gate on raw visitorId

- **Context:** Need source-by-source and filtered-hash comparison against pinned `@fingerprintjs/fingerprintjs@5.3.0` without claiming unmodified 42-source ID parity.
- **Decision:** Dev-only dependency on the pinned upstream package. Harness (`tests/harness/diff`) snapshots components (duration excluded), omits `applePay` only in the test harness, compares all 41 enabled keys, and hashes with local `hashComponents` / `hashComponentsOmittingExcluded`. Reports land in `reference/upstream-diff-report.{json,md}`. Collection requires consent. Raw `visitorId` equality is recorded but never a pass gate. Live e2e asserts filtered-hash equality only when source parity is `41/41`; otherwise mismatches are classified (not fabricated PASS).
- **Consequences:** `pnpm test` covers fixture proofs; `pnpm test:e2e` emits the live Chromium report. Upstream is never a production runtime dependency.

---

## 2026-11-03 — Step 57: Browser coverage matrix

### ADR-068: Playwright Chromium/Firefox/WebKit + matrix subset; manual devices NOT RUN

- **Context:** Need multi-engine coverage (incognito/contexts, CSP, sandbox, storage/WebGL/audio denial) without claiming unrun real-device results as PASS.
- **Decision:** Full e2e suite stays on `chromium`. `firefox` and `webkit` run matrix + smoke/integration specs. `chromium-incognito` runs matrix with ephemeral contexts. Dedicated `browser-matrix.spec.ts` covers headless caveats, CSP (no unsafe-eval), iframe sandbox storage, blocked storage, WebGL-disabled Chromium launch, audio denial, and `fa-IR`/`Asia/Tehran` fixtures. Real Android/iOS/Brave/Samsung/Edge hardware recorded as **NOT RUN** in `docs/BROWSER_COVERAGE.md`. Demographics remain unknown without opt-in telemetry.
- **Consequences:** `pnpm test:e2e` requires Playwright browser installs for firefox/webkit. Missing engines must be reported NOT RUN, never fabricated PASS.

---

## 2026-11-03 — Step 56: Multi-format publish bundles

### ADR-067: Rollup ESM/CJS/IIFE/UMD + sourcemaps; modular ESM remains primary

- **Context:** Consumers need Node `import`/`require`, Vite/webpack resolution, and offline script-tag (IIFE/UMD) deployment without CDN or telemetry.
- **Decision:** Keep `tsc` modular ESM + `.d.ts` as the tree-shakeable primary (`sideEffects: false`). Add Rollup artifacts: `fp.{js,min.js}` (IIFE), `fp.umd{.min}.js`, `fp.esm{.min}.js`, `fp.cjs{.min}.js` for `@night-watch/browser-sdk` (core inlined in IIFE/UMD; external in npm ESM/CJS). Core ships `core.{esm,cjs}{.min}.js`. Global name `NightWatch`. Sourcemaps always generated and published with the package for first-party debugging; runtime does not require them. No `eval`/`new Function` in compress. Exports map dual-package; `unpkg`/`jsdelivr` fields point at self-hostable IIFE min (still first-party when mirrored).
- **Consequences:** `pnpm build` runs `tsc -b` then package `bundle`. Algorithm/visitorId unchanged. Iran offline/self-host uses IIFE/UMD from local origin.

---

## 2026-11-03 — Step 55: Live development playground

### ADR-066: Local Vite playground; consent-gated; no automatic upload

- **Context:** Developers need an interactive first-party page for visitorId, confidence, full signal table (value/error/duration), version, independent repeat-run comparison, and JSON copy — without telemetry or CDN assets.
- **Decision:** Ship `@night-watch/playground` with Vite on loopback (`127.0.0.1:4173`). Collection requires explicit consent checkbox. Each Collect click uses a fresh `load()`+`get()` with `monitoring: false`. Copy JSON is user-action only. Persian RTL surrounding stays beside English LTR diagnostics; Persian digits are display-only and never mutate hashed values. Unsupported/error keys are listed without claiming IP, nationality, or physical device identity. Playwright starts the playground via `webServer`.
- **Consequences:** `pnpm playground` is the local entry. No remote sample endpoints. Algorithm / visitorId semantics unchanged.

---

## 2026-11-03 — Step 54: Public component extension / filtering API

### ADR-065: Safe-by-default extend/omit + merge; no built-in overwrite; no applePay

- **Context:** Integrators need `hashComponents` / `componentsToDebugString`, post-get component filtering, and optional custom sources without silently replacing Default-profile built-ins or reintroducing the excluded payment key.
- **Decision:** Public helpers `omitComponents`, `extendComponents`, `withComponent`, and `mergeBuiltinSources` default to **no overwrite**. `LoadOptions.excludeSources` / `customSources` / `overwriteBuiltins` wire the same semantics into `load()`. Registering `applePay` throws `RegistryInvariantError`. Playground shell gains Persian `dir=rtl` surrounding content beside an English `dir=ltr` diagnostics panel (first-party only; no remote fonts/CDNs). Canonical hash algorithm unchanged.
- **Consequences:** Custom entropy is additive unless `overwrite` / `overwriteBuiltins` is explicit. Identifier semantics unchanged for the 41-source default path.

---

## 2026-11-03 — Step 53: `webGlExtensions` (WebGL extensions / precision)

### ADR-064: Allowlisted params + sorted arrays; skip warning-prone extensions

- **Context:** Extensions source enumerates context attributes, prototype constants, shader precisions, and extension parameters. Some extensions warn in console.
- **Decision:** Port allowlists and sort of `parameters` / `extensionParameters`. Skip `WEBGL_debug_renderer_info` on Gecko and `WEBGL_polygon_mode` on Chromium/WebKit. Same statuses `-1`/`-2` and shared `cache.webgl` as basics. Completes the 41-source Default-profile registry.
- **Consequences:** Node ? `-1`. Desktop Chromium typically returns large string-array payload.

---

## 2026-11-03 — Step 52: `webGlBasics` (WebGL basic capabilities)

### ADR-063: Cached WebGL context; statuses -1/-2; Gecko skips debug renderer info

- **Context:** Basics and extensions share one canvas/context; creating it is expensive. Gecko warns on `WEBGL_debug_renderer_info`.
- **Decision:** Cache under `options.cache.webgl`. Statuses: no context=`-1`, missing `getParameter`=`-2`. Avoid debug-renderer extension on Gecko (empty unmasked strings). Export `disposeWebGlCache` for explicit cleanup (tests / post-collection).
- **Consequences:** Node ? `-1`. Desktop Chromium often returns a payload (SwiftShader/ANGLE in headless).

---

## 2026-11-03 — Step 51: `dateTimeLocale` (Intl.DateTimeFormat locale)

### ADR-062: Default resolved locale only; status codes for missing Intl/DTF/locale

- **Context:** Upstream returns `Intl.DateTimeFormat().resolvedOptions().locale` or `-1`/`-2`/`-3`.
- **Decision:** Match statuses. Empty string is a valid locale value; only `null`/`undefined` ? `-3`. Prefer `window.Intl`; fall back to global `Intl` when window is absent (Node/SSR). Never force `fa-IR`, Jalali, or numeral systems — Iran locales are test inputs only.
- **Consequences:** Node/Chromium typically return a BCP 47 string; environments with neither window nor Intl ? `-1`.

---

## 2026-11-03 — Step 50: `audioBaseLatency` (AudioContext.baseLatency)

### ADR-061: Platform-gated baseLatency; special codes; always close context

- **Context:** Creating AudioContext warns in Chrome/Firefox consoles; upstream enables only Android or WebKit. Special codes: NotSupported=-1, Disabled=-2, NotFinite=-3.
- **Decision:** Match allow-list and special codes. Distinct from OfflineAudioContext `SpecialFingerprint`. **Close** the AudioContext after reading (upstream does not; value unchanged).
- **Consequences:** Desktop Chromium ? `-2` without constructing AudioContext; WebKit/Android may return a finite seconds value.

---

## 2026-11-03 — Step 49: `privateClickMeasurement` (Safari PCM)

### ADR-060: Unattached `<a>` attribution props only; no click / network / registration

- **Context:** Desktop Safari exposes `attributionSourceId` / `attributionsourceid` on anchors when PCM is on; mobile Safari typically does not.
- **Decision:** `createElement('a')` without append; `id = attributionSourceId ?? attributionsourceid`; return `String(id)` when `id !== undefined`, else `undefined` (`??` skips `null`). Never navigate, click, or register attribution. No network.
- **Consequences:** Chromium / Node / iOS-like ? `undefined`; desktop Safari inject fixtures ? `''` or `'0'`.

---

## 2026-11-03 — Step 48: `architecture` (floating-point architecture clue)

### ADR-059: NaN sign-bit byte only; never a CPU / hardware ID label

- **Context:** x86 often sets the sign bit on produced NaNs (8 - 8); other ISAs often do not. Upstream returns `Uint8Array` byte 3 of that Float32 pattern.
- **Decision:** Port the probe; return `number | undefined`. Typed arrays unavailable ? `undefined` (not a fabricated byte). Do not map the value to CPU names (`"x86"`, `"arm"`, etc.).
- **Consequences:** Typical LE x86/x64 hosts ? `255` or `127`; Node and Chromium both support typed arrays.

---

## 2026-11-03 — Step 47: `pdfViewerEnabled` (built-in PDF viewer)

### ADR-058: Read-only `navigator.pdfViewerEnabled`; never invent false

- **Context:** Modern browsers expose a boolean PDF-viewer flag; older engines omit it.
- **Decision:** Return the property as `boolean | undefined`. Absence / Node ? `undefined` (not `false`). Do not open PDFs, plugins, or MIME lists.
- **Consequences:** Desktop Chromium typically `true`; Node / unsupported ? `undefined` hashed distinctly from `false`.

---

## 2026-11-03 — Step 46: `math` (floating-point math differences)

### ADR-057: Empirical Math probes + polyfills; no rounding before hash

- **Context:** JS engines differ in transcendental Math results; Tor/Firefox bugs historically tracked via fixed inputs.
- **Decision:** Port v5.3.0 probe set and polyfill formulas (including `sinhPf` operator-precedence quirk). Missing native methods ? `0`. Do not round/stringify samples before hashing. Preserve -0/NaN/Infinity. Key list locked as `MATH_FINGERPRINT_KEYS`.
- **Consequences:** Works under Node (Math is ES); engine differences remain the entropy.

---

## 2026-11-03 — Step 45: `hdr` (dynamic range / HDR)

### ADR-056: Tri-state dynamic-range via matchMedia

- **Context:** CSS `(dynamic-range: high|standard)` distinguishes HDR vs SDR displays; unsupported must not be hashed as fabricated SDR/`false`.
- **Decision:** Port v5.3.0: high ? `true`, standard ? `false`, neither / missing matchMedia ? `undefined`. SSR-safe `getMatchMedia`.
- **Consequences:** Typical desktop Chromium on SDR ? `false`; Node ? `undefined`.

---

## 2026-11-03 — Step 44: `reducedTransparency` (reduced transparency preference)

### ADR-055: Tri-state prefers-reduced-transparency via matchMedia

- **Context:** CSS `(prefers-reduced-transparency: reduce|no-preference)` is newer than reduced-motion; older browsers must hash as `undefined`, not fabricated `false`.
- **Decision:** Port v5.3.0: reduce ? `true`, no-preference ? `false`, neither / missing matchMedia ? `undefined`. SSR-safe `getMatchMedia`.
- **Consequences:** Many Chromium builds ? `undefined` or `false`; Node ? `undefined`.

---

## 2026-11-03 — Step 43: `reducedMotion` (reduced motion preference)

### ADR-054: Tri-state prefers-reduced-motion via matchMedia

- **Context:** CSS `(prefers-reduced-motion: reduce|no-preference)` reflects OS accessibility toggles; unsupported must not be hashed as fabricated `false`.
- **Decision:** Port v5.3.0: reduce ? `true`, no-preference ? `false`, neither / missing matchMedia ? `undefined`. SSR-safe `getMatchMedia`.
- **Consequences:** Typical Chromium ? `false`; Node ? `undefined`.

---

## 2026-11-03 — Step 42: `contrast` (preferred contrast)

### ADR-053: Stable prefers-contrast numeric codes; undefined when unsupported

- **Context:** CSS `prefers-contrast` uses keywords (`no-preference` / `more|high` / `less|low` / `forced`); browsers historically disagree on high/low vs more/less.
- **Decision:** Port v5.3.0 codes: Less=-1, None=0, More=1, ForcedColors=10. Probe order: no-preference ? high|more ? low|less ? forced. Missing matchMedia / no match ? `undefined` (never invent None). Const-object (not TS const enum) for isolatedModules.
- **Consequences:** Typical Chromium ? `0` or `undefined`; Node ? `undefined`.

---

## 2026-11-03 — Step 41: `monochrome` (monochrome bit depth)

### ADR-052: Bounded max-monochrome search; unsupported ? undefined

- **Context:** CSS `monochrome` reports bits-per-pixel on B&W displays and `0` on color; unsupported browsers must not be hashed as fabricated `0` without a support gate.
- **Decision:** Port v5.3.0: if `(min-monochrome: 0)` fails ? `undefined`. Else return first `i` in `0..100` where `(max-monochrome: i)` matches. Exceeding 100 throws (`Too high value`). SSR-safe `getMatchMedia`.
- **Consequences:** Typical Chromium color display ? `0`; Node ? `undefined`.

---

## 2026-11-03 — Step 40: `forcedColors` (forced color mode)

### ADR-051: Tri-state forced-colors via matchMedia

- **Context:** CSS `(forced-colors: active|none)` maps Windows High Contrast / forced-color modes; unsupported browsers must not be hashed as fabricated `false`.
- **Decision:** Port v5.3.0: active ? `true`, none ? `false`, neither / missing matchMedia ? `undefined`. SSR-safe `getMatchMedia`. Throws surface as component errors.
- **Consequences:** Desktop Chromium typically ? `false`; Node ? `undefined`.

---

## 2026-11-03 — Step 39: `invertedColors` (inverted color preference)

### ADR-050: Tri-state inverted-colors via matchMedia

- **Context:** CSS `(inverted-colors: inverted|none)` is sparsely supported; unsupported browsers must not be hashed as a fabricated `false`.
- **Decision:** Port v5.3.0: inverted ? `true`, none ? `false`, neither / missing matchMedia ? `undefined`. SSR-safe `getMatchMedia`. Throws surface as component errors.
- **Consequences:** Desktop Chromium often ? `undefined` or `false`; Node ? `undefined`.

---

## 2026-11-03 — Step 38: `colorGamut` (CSS display color gamut)

### ADR-049: Widest-first color-gamut matchMedia; undefined when unidentified

- **Context:** CSS `(color-gamut: rec2020|p3|srgb)` reports display capability; rec2020 includes p3 includes srgb.
- **Decision:** Port v5.3.0 probe order (rec2020 ? p3 ? srgb). First matching `.matches` wins. Missing `matchMedia` or no matches ? `undefined` (never invent `srgb`). Use SSR-safe `getMatchMedia`.
- **Consequences:** Typical desktop Chromium ? `srgb` or `p3`; Node ? `undefined`.

---

## 2026-11-03 — Step 37: `cookiesEnabled` (cookie access capability)

### ADR-048: Temporary SameSite=Strict cookietest; never trust cookieEnabled

- **Context:** `navigator.cookieEnabled` lies under nuanced IE/privacy settings; sandboxed iframes / data-URIs throw SecurityError on `document.cookie`.
- **Decision:** Port v5.3.0 Modernizr-style probe: write `cookietest=1; SameSite=Strict;`, detect via `indexOf`, expire-delete. Catch ? `false`. Always attempt cleanup in `finally` (intentional hardening vs upstream). Do not use `navigator.cookieEnabled`. First-party only; not a persistent ID.
- **Consequences:** Brief cookie side effect on the current document. Preexisting `cookietest` may be overwritten then cleared. Node / missing document ? `false`.

---

## 2026-11-03 — Step 36: `vendorFlavors` (vendor-specific globals)

### ADR-047: Allowlisted window globals; sorted names; no API invocation

- **Context:** Same-engine browsers (Blink/WebKit) need flavor separation via vendor globals (`chrome`, `safari`, Yandex/UC/Samsung markers, etc.).
- **Decision:** Port v5.3.0 fixed key list. Include a key only when `window[key]` is truthy and `typeof === 'object'`. Return `.sort()`ed names. Never call methods on matched objects. Missing window ? `[]`.
- **Consequences:** Desktop Chromium typically `['chrome']`; Node ? `[]`. Allowlist changes require a new algorithm revision.

---

## 2026-11-03 — Step 35: `vendor` (browser vendor)

### ADR-046: Raw `navigator.vendor` with empty-string fallback

- **Context:** Vendor is a coarse brand string (`Google Inc.`, `Apple Computer, Inc.`, or `''` on Firefox); privacy tools may blank or throw.
- **Decision:** Port v5.3.0: `navigator.vendor || ''`. Missing navigator / undefined / empty ? `''`. Never synthesize a brand from UA. Getter throws surface as component errors.
- **Consequences:** Chromium typically `"Google Inc."`; Firefox often `''`; Node ? `''`.

---

## 2026-11-03 — Step 34: `touchSupport` (touch input capability)

### ADR-045: Crude maxTouchPoints + TouchEvent + ontouchstart; no physical certainty

- **Context:** JS cannot reliably prove a physical touchscreen without subscribing to real touch events; hybrid laptops and privacy spoofing further muddy the signal.
- **Decision:** Port v5.3.0: `{ maxTouchPoints, touchEvent, touchStart }` where points use `toInt(maxTouchPoints)` else legacy `msMaxTouchPoints` else `0`; `touchEvent` from try/`createEvent('TouchEvent')`; `touchStart` from `'ontouchstart' in window`. Never invent points; never claim physical touchscreen certainty.
- **Consequences:** Desktop Chromium often hashes `{0, false|true, false|true}` depending on engine; Node ? `{0, false, false}`.

---

## 2026-11-03 — Step 33: `plugins` (navigator plugins metadata)

### ADR-044: Serializable plugin list; skip nulls; never execute plugins

- **Context:** `navigator.plugins` is array-like (Safari 10 needs index loops) and may contain null holes; Chromium may expose a short PDF-only list.
- **Decision:** Port v5.3.0: when `plugins` is absent ? `undefined`; else build `{ name, description, mimeTypes: [{type, suffixes}] }[]` in source order, skipping null plugins. Never call plugin methods / instantiate. Empty list is `[]` (not undefined).
- **Consequences:** Node/`allowNonBrowser` yields `undefined`; Chromium typically yields PDF viewer entries or empty.

---

## 2026-11-03 — Step 32: `platform` (platform descriptor)


### ADR-043: navigator.platform + mobile-WebKit MacIntel remap

- **Context:** iOS Safari desktop mode reports `MacIntel`; iPadOS defaults to desktop mode since iOS 13. Hashing that as a Mac would collide with real Macs.
- **Decision:** Port v5.3.0: if `platform === 'MacIntel'` and WebKit and not desktop WebKit, return `iPad` or `iPhone` via `isIPad()`. Otherwise return raw `platform`. Missing navigator ? `''`. Never invent Android/Windows strings from UA.
- **Consequences:** Desktop Chromium/Windows report native strings; live iOS desktop-mode validation deferred to step 57.

---

## 2026-11-03 — Step 31: `cpuClass` (legacy CPU class)


### ADR-042: Raw navigator.cpuClass only; never infer from UA

- **Context:** `navigator.cpuClass` is an old IE field (e.g. `x86`); modern engines omit it. Inferring from UA would invent entropy.
- **Decision:** Port v5.3.0 behavior via SSR-safe `getNavigator`: return `cpuClass` string or `undefined`. No UA parsing; no fabricated class. Omit upstream test-only `isSourceLoaded` hack.
- **Consequences:** Chromium/Firefox/Safari/Node hash `undefined`; spoofed/injected values pass through unchanged.

---

## 2026-11-03 — Step 30: `openDatabase` (legacy WebSQL presence)


### ADR-041: Existence-only `!!openDatabase`; never create a WebSQL database

- **Context:** WebSQL is removed from modern Chromium; older WebKit may still expose `openDatabase`. Calling it would create a database.
- **Decision:** Port v5.3.0 one-liner via SSR-safe `getWindow`: `!!window.openDatabase`. Never invoke the function. Missing/removed ? `false`.
- **Consequences:** Desktop Chromium hashes `false`; legacy WebKit with WebSQL hashes `true` without side effects.

---

## 2026-11-03 — Step 29: `indexedDB` (availability)


### ADR-040: Existence-only; IE/EdgeHTML ? undefined; never open databases

- **Context:** IE/EdgeHTML block IndexedDB in private mode, which would otherwise flip the visitorId vs normal mode. Opening DBs would mutate storage.
- **Decision:** Port v5.3.0: on Trident/EdgeHTML return `undefined`. Else `!!window.indexedDB` with SecurityError ? `true`. Never call `indexedDB.open` / write. Node/unavailable window ? `false`.
- **Consequences:** Modern Chromium/Firefox/Safari contribute a boolean; legacy IE/Edge skip the signal entirely.

---

## 2026-11-03 — Step 28: `localStorage` (availability)


### ADR-039: Existence-only probe; SecurityError means present; no persistent writes

- **Context:** Same blocked-iframe / disabled-storage semantics as sessionStorage; must not create persistent tracking keys.
- **Decision:** Port v5.3.0: `!!window.localStorage` in try/catch; on throw return `true`. Never call `getItem`/`setItem`. Node/unavailable window ? `false`.
- **Consequences:** Matches Firefox bug 781447 / sandbox SecurityError behavior without mutating storage.

---

## 2026-11-03 — Step 27: `sessionStorage` (availability)


### ADR-038: Existence-only probe; SecurityError means present; no storage writes

- **Context:** Fingerprinting must not persist tracking keys; third-party iframes may throw SecurityError on `sessionStorage` access.
- **Decision:** Port v5.3.0: `!!window.sessionStorage` inside try/catch; on throw return `true` (API exists but blocked). Never call `getItem`/`setItem`. Node/unavailable window ? `false`.
- **Consequences:** Blocked storage still contributes `true` to the hash (upstream-compatible), without writing identifiers.

---

## 2026-11-03 — Step 26: `timezone` (timezone identity)


### ADR-037: Intl IANA name first; DST-stable offset fallback; no geo hardcoding

- **Context:** DST can flip `getTimezoneOffset` mid-year; Iran QA needs `Asia/Tehran` / `UTC+03:30` fixtures without treating timezone as nationality.
- **Decision:** Port v5.3.0: prefer `Intl.DateTimeFormat().resolvedOptions().timeZone`; else `-max(Jan,July offsets)` as `UTC±N` (minutes). Never invent or force `Asia/Tehran`. `Asia/Tehran`, `Asia/Dubai`, `UTC` appear only as test inputs.
- **Consequences:** Modern browsers hash the IANA id; legacy/denied Intl hash a DST-stable numeric offset string.

---

## 2026-11-03 — Step 25: `hardwareConcurrency` (logical processor count)


### ADR-036: toInt + Firefox143 RFP tiering; unstable probe kept

- **Context:** Firefox 143+ spoofs `hardwareConcurrency` in private/ETP strict to tiers 4 or 8, which would otherwise diverge from normal mode.
- **Decision:** Port v5.3.0: parse with `replaceNaN(toInt(...), undefined)`. On Gecko=143, stabilize with `value >= 8 ? 8 : 4` (idempotent). Export `getUnstableHardwareConcurrency` for diagnostics. Never invent a core count when absent.
- **Consequences:** Chromium reports raw cores; Firefox 143+ always hashes as 4 or 8. Live private-mode matrix deferred to step 57.

---

## 2026-11-03 — Step 24: `screenResolution` (physical screen dimensions)


### ADR-035: toInt + sort/reverse; Safari 17+ skip

- **Context:** Portrait/landscape must not flip the visitorId; Safari 17+ private mode reports document size as screen resolution.
- **Decision:** Port v5.3.0: `replaceNaN(toInt(dim), null)`, then default `sort().reverse()` (lexicographic, not numeric). Skip entirely (`undefined`) on WebKit616+ Safari. String spoofed dims accepted via `toInt`. Missing screen ? `[null, null]` unstable / Node.
- **Consequences:** Some non-typical size pairs order differently than pure numeric max/min (upstream quirk preserved). Live Safari17 private validation deferred to step 57.

---

## 2026-11-03 — Step 23: `deviceMemory` (approximate device memory)


### ADR-034: toFloat + replaceNaN; no RAM inventing or un-clamping

- **Context:** `navigator.deviceMemory` is Chromium-oriented (often absent on Safari/Firefox), may be a numeric string, and is privacy-bucketed (powers of two).
- **Decision:** Port v5.3.0: `replaceNaN(toFloat(deviceMemory), undefined)`. Preserve Infinity. Never invent GiB values or reverse privacy clamping. Node/unavailable navigator ? `undefined`.
- **Consequences:** Safari/Firefox-like absence is `undefined`; Chromium reports the bucket as-is.

---

## 2026-11-03 — Step 22: `colorDepth` (display color depth)


### ADR-033: Raw screen.colorDepth; never invent bit depth

- **Context:** Upstream returns `window.screen.colorDepth` as a number (often 24). Missing screen under Node/SSR must not fabricate a common depth.
- **Decision:** Port v5.3.0 via SSR-safe `getScreen`. Return the reported number (including `0` / `NaN` / non-integers). Unavailable screen ? `undefined` component value. Accessor throws ? collector error. No pixel-format guessing.
- **Consequences:** Node/`allowNonBrowser` yields `undefined`; Chromium headless typically `24`.

---

## 2026-11-03 — Step 21: `languages` (browser locale list)


### ADR-032: string[][] schema; Chromium86+ skips languages array; no locale inventing

- **Context:** Chromium =86 Incognito collapses `navigator.languages` to a single entry matching `language`, which would otherwise diverge the hash from normal mode. Iran QA needs `fa-IR`/`fa` fixtures without assuming Persian is advertised.
- **Decision:** Port v5.3.0: push `[language]` (or legacy IE fields), then optionally push `languages` (array copy or comma-split string). On Chromium =86, omit the `languages` array. Never reorder, translate, or invent codes; Node/unavailable ? `[]`.
- **Consequences:** Desktop Chromium component is typically `[[navigator.language]]` only. Live Incognito differential deferred to step 57.

---

## 2026-11-03 — Step 20: `osCpu` (legacy navigator.oscpu)


### ADR-031: Absence of oscpu is undefined, never a fabricated CPU string

- **Context:** `navigator.oscpu` exists mainly on Firefox/Gecko; Chromium/Safari/Node omit it. Self-hosted must not invent platform CPU labels.
- **Decision:** Port v5.3.0 one-liner via SSR-safe `getNavigator`. Missing/unavailable navigator ? `undefined` component **value**. Accessor throws ? collector `{ error }` (not a silent default). No geo/OS hardcoding.
- **Consequences:** Desktop Chromium e2e expects `undefined`; Firefox live confirmation deferred to step 57.

---

## 2026-11-03 — Step 19: `canvas` (2D winding + geometry/text)


### ADR-030: Canvas ImageStatus + antifingerprinting skip; Latin+emoji fixture locked

- **Context:** Canvas entropy must stay stable under privacy noise (Safari 17+ / Firefox 120+) and must not absorb host RTL/Persian CSS into the hashed drawing text.
- **Decision:** Port v5.3.0 winding + dual `toDataURL` (text then geometry). Status tokens `unsupported` / `skipped` / `unstable` are string **values** (not errors). Skip images when antifingerprinting detectors fire; keep winding. Lock `CANVAS_PRINTED_TEXT` to upstream Latin + smiling-emoji surrogates (D-022). Never append canvas to the document.
- **Consequences:** Node/`allowNonBrowser` yields `{ winding: false, geometry/text: unsupported }`. Live private-mode skip validation deferred to step 57.

---

## 2026-11-03 — Step 18: `screenFrame` (chrome insets)


### ADR-029: Backup watch + rounding; no default fullscreen exit

- **Context:** Screen frame can transiently read as null (incl. programmatic fullscreen); upstream exits fullscreen to recover. Self-hosted UX should not yank users out of fullscreen.
- **Decision:** Port v5.3.0 frame math, backup interval watch, side rounding (base 10), and Safari17 / Firefox143 skip ? `undefined`. Default `allowExitFullscreen: false` (D-021); set true only for explicit upstream-compatible experiments. Export `resetScreenFrameWatch` so timers do not survive dispose.
- **Consequences:** In fullscreen with a null frame and no backup, default-profile may keep a null/zero frame instead of exiting fullscreen.

---

## 2026-11-03 — Step 17: `audio` (offline synthesis fingerprint)

### ADR-028: OfflineAudioContext only; special codes are values; antifingerprinting skips

- **Context:** Audio fingerprinting must be deterministic, silent, and honor browsers that suspend or noise the signal.
- **Decision:** Port v5.3.0 OfflineAudioContext oscillator/compressor parameters and sample-sum hash. Special fingerprints `-1…-4` are component **values** (not errors). Skip synthesis on Safari=17 / Samsung Internet=26; skip on old mobile WebKit that never leaves suspended. Two-stage getter finalizes render. No realtime `AudioContext` / speaker output.
- **Consequences:** Node/`allowNonBrowser` yields `-2` (NotSupported). Live Safari private-mode validation deferred to multi-browser matrix.

---

## 2026-11-03 — Step 16: `fontPreferences` (font preference widths)

### ADR-027: Natural-font iframe + Chromium128 DPR normalize; Latin hash text locked

- **Context:** Prefer measuring system/default font widths without host CSS contamination; Chromium 128+ CSS zoom interacts with `devicePixelRatio`; Iran QA wants Persian/RTL fixtures without changing the hashed probe string.
- **Decision:** Port v5.3.0 presets + `withNaturalFonts` (viewport srcdoc, zoom reset / `1/dpr`, wide body). Chromium=128: `floor(width*dpr)` with Android 0 / else 3 decimals. Keep `FONT_PREFERENCES_DEFAULT_TEXT` Latin-only for hashing; Persian samples only in test fixtures (D-019).
- **Consequences:** VisitorId stays comparable to upstream fontPreferences; RTL pages must not retain orphan iframes (covered in e2e).

---

## 2026-11-03 — Step 15: `domBlockers` (content-blocker CSS probes)

### ADR-026: Local filter dataset; eligibility-gated; empty ? no blockers

- **Context:** Detect installed content-blocker *filter lists* via CSS selector probes without fetching lists or bypassing blockers.
- **Decision:** Port v5.3.0 filter?selector map (incl. `adBlockPersian`) and 60% threshold; apply only on WebKit or Android (`isDomBlockersApplicable`). Ineligible browsers return `undefined`. Empty array means no signal. No network; cleanup probe DOM always.
- **Consequences:** Desktop Chromium/Firefox typically hash `undefined`. Live Safari/Android blocker detection deferred to broader browser matrix.

---

## 2026-11-03 — Step 14: `fonts` (installed font availability)

### ADR-025: Upstream font probe set only; Persian fonts via future opt-in pack

- **Context:** Iran market wants Vazirmatn / Tahoma / B Nazanin coverage, but default-profile must keep upstream signal behavior; no Local Font Access permission prompts.
- **Decision:** Implement v5.3.0 layout-delta probe (`FONT_PROBE_STRING`, base families, 52 candidates) inside `withIframe`. Never call `queryLocalFonts`. Do **not** silently append Persian fonts to the default list. Document a future opt-in extension (new `sourceManifestRevision`, separate package or `sources` override) — D-017.
- **Consequences:** Core visitorId semantics stay comparable to filtered upstream; Persian glyph packs require an explicit algorithm bump when shipped.

---

## 2026-11-03 — Step 13: `userAgentData` (UA-CH)

### ADR-024: Stable UA-CH component; absence is `undefined`, denial is a value sentinel

- **Context:** First entropy source; Chromium Client Hints include GREASE brands and unstable versions; Permissions Policy can block high-entropy reads.
- **Decision:** Match v5.3.0 observable shape: brand-name list (no versions), GREASE removed, drop `Chromium` when another brand remains, optional high-entropy fields, `highEntropyStatus: 'not_allowed'` on `NotAllowedError`. Missing API ? `undefined` value (not `{ error }`). No remote hint servers.
- **Consequences:** Firefox/Safari/Node yield `undefined`; hash includes that. Other sources remain not-implemented until their steps.

---

## 2026-11-03 — Step 12: DOM and iframe isolation utilities

### ADR-023: Offscreen iframe helper with mandatory cleanup + abort/timeout

- **Context:** Fonts/DOM probes need an isolated document; host CSS and orphan iframes corrupt measurements and leak nodes. Upstream `withIframe` has no abort/timeout.
- **Decision:** Port v5.3.0-observable `withIframe` / `addStyleString` / `selectorToElement` / `isAnyParentCrossOrigin` under `packages/core/src/dom`. Use `about:blank` or `srcdoc` only (never http(s) navigation of the host). Always detach the iframe in `finally`. Apply styles via `setProperty` (CSP-friendly). Add optional `timeoutMs` / `AbortSignal` (D-015) so collectors can cancel without leaving DOM behind.
- **Consequences:** Later sources (fonts, fontPreferences, domBlockers, …) share one isolation primitive. Full in-page package import e2e still waits on playground bundling.

---

## 2026-11-03 — Step 11: Browser engine / version capability detectors

### ADR-022: Capability-signature detectors; wire into confidence

- **Context:** Confidence heuristic needs engine hints; UA strings are spoofable; Iran-facing Chromium/WebView variants must not be classified by brand text alone.
- **Decision:** Port v5.3.0-style detectors under `packages/core/src/browser` (on-demand `getBrowserContext`, injectable fixtures). Prefer feature counts over UA. `getConfidence` merges `detectConfidenceEnvironmentHints()` then caller overrides. `ApplePayError` remains an engine signature only (D-001 / D-014) — never an entropy source.
- **Consequences:** Agent confidence picks up live hints in browsers; Node/SSR stays all-false ? platform-string path. Full WebKit/Gecko/Android e2e matrix deferred to coverage step 57; Desktop Chromium capability smoke is covered now.

---

## 2026-11-03 — Step 10: Agent lifecycle load() / get()

### ADR-021: Agent API with monitoring no-op and not-yet-implemented sources as errors

- **Context:** Need public `load`/`get` before individual entropy sources exist (steps 13–53).
- **Decision:** Implement upstream-shaped agent (idle prep, lazy visitorId, debug dump). `monitoring` defaults false and never beacons. Builtin registry registers all 41 keys; missing collectors throw `SourceNotImplementedError` ? `{ error, duration }` (not fake values). Test-only `allowNonBrowser` + `sources` injection for Node unit tests.
- **Consequences:** Visitor IDs today reflect mostly-error component maps; they will change as real sources land (expected pre-release). `version` is `@night-watch/browser-sdk` package version.

---

## 2026-11-03 — Step 09: Confidence model with honest semantics

### ADR-020: Labeled heuristic confidence; no Pro marketing; injectable env hints

- **Context:** Upstream confidence uses platform/engine heuristics and embeds a FingerprintJS Pro referral comment. Browser detectors arrive in step 11.
- **Decision:** Port OSS score bands (Android 0.4, WebKit 0.3/0.5, Win 0.6, Mac 0.5, other 0.7). Replace Pro URL comment with an explicit non-calibrated disclaimer. Accept optional `ConfidenceEnvironmentHints` (Node-safe defaults). Export `ConfidenceModel` + `CalibratedConfidenceModel` types; only ship the uncalibrated heuristic model. Never use locale/IP/brand as inputs.
- **Consequences:** Agent (step 10) can call `getConfidence`; step 11 will supply real engine hints.

---

## 2026-11-03 — Step 08: Canonicalization and MurmurHash3 x64 128

### ADR-019: Lock hashing to pinned OSS canonical + x64hash128 semantics

- **Context:** Visitor IDs require bit-compatible hashing on the **41-source** map.
- **Decision:** Port observable `componentsToCanonicalString` + `x64hash128`/`getUTF8Bytes` behavior from v5.3.0. Remainder processing uses equivalent `if (remainder >= n)` form (no switch fallthrough) under `noFallthroughCasesInSwitch`. Export `hashComponentsOmittingExcluded` for filtered upstream comparisons; never assert raw 42-source visitorId equality.
- **Consequences:** `ALGORITHM_SCHEMA.hashingRevision` (`murmur3-x64-128-canonical-v1`) is now implemented; golden vectors live in `tests/fixtures/hash-golden-vectors.json`.

---

## 2026-11-03 — Step 07: Error isolation and debug serializer

### ADR-018: Debug serializer with credential-key redaction

- **Context:** Upstream `componentsToDebugString` + `errorToObject` make Errors JSON-safe; raw dumps could still include custom secret fields.
- **Decision:** Match upstream Error ? plain object conversion (name/message/stack split) and add redaction of credential-like keys (`token`, `password`, `authorization`, …) in both `errorToObject` and the debug JSON replacer. Hashing continues to use the literal sentinel `'error'` only.
- **Consequences:** Local debug output is safer for first-party support; filtered-hash parity is unaffected because debug strings are not hashed.

---

## 2026-11-03 — Step 06: Two-stage collector engine

### ADR-017: Pinned two-stage loader semantics (`loadSource` / `loadSources`)

- **Context:** Upstream entropy sources may return sync/async values or deferred getters; slow sources must start early without serial `await`.
- **Decision:** Port observable behavior from v5.3.0 `entropy_source.ts`: sync getter factory, `awaitIfAsync` duration measurement, `mapWithBreaks` cooperative iteration, `suppressUnhandledRejectionWarning`, exclude-list filtering, insertion-order component maps. Include `transformSource` for later source adapters.
- **Consequences:** Agent `get()` can await one components function; per-source errors become `{ error, duration }` without failing the whole result.

---

## 2026-11-03 — Step 05: Async scheduling and event-loop yielding

### ADR-016: MessageChannel-first event-loop yield with safe fallbacks

- **Context:** Upstream avoids `setTimeout` for yielding because Chrome can throttle it; Node has no `window.requestIdleCallback`.
- **Decision:** `releaseEventLoop` uses `MessageChannel`, then `setImmediate`, then `setTimeout(0)`. `requestIdleCallbackIfAvailable` binds to `window` when present, else finite `wait(min(fallback, deadline))`.
- **Consequences:** Agent prep delay and cooperative `mapWithBreaks` work in browser and Node tests without import-time globals.

---

## 2026-11-03 — Step 04: Environment guards and runtime context

### ADR-014: On-demand probes with explicit unsupported / blocked / error

- **Context:** Collectors need browser APIs without breaking SSR imports or conflating missing APIs with exceptions.
- **Decision:** All access goes through `packages/core/src/runtime` helpers returning `ProbeResult<T>` (`ok` \| `unsupported` \| `blocked` \| `error`). `SecurityError` / `NotAllowedError` map to `blocked`. Never read `window`/`navigator` at module top level.
- **Consequences:** Agent `load()` will call `assertBrowserEnvironment()`; sources use accessors instead of bare globals.

### ADR-015: WebGL probe returns canvas+context and requires explicit release

- **Context:** GPU contexts must not leak across collections.
- **Decision:** `probeWebGlContext()` returns `{ context, contextId, canvas }`; callers must `releaseWebGlProbe()`.
- **Consequences:** Later WebGL sources share this cleanup contract.

---

## 2026-11-03 — Step 03: Public contracts and API typing

### ADR-011: Split generic contracts (`@night-watch/core`) from SDK surface (`@night-watch/browser-sdk`)

- **Context:** Step 03 requires stable public types without implementing collectors.
- **Decision:** Engine generics (`Source`, `Component`, `SourcesToComponents`, …) and `BuiltinComponents` live in core; `LoadOptions` / `Agent` / `GetResult` and function signature types live in browser-sdk. Runtime functions remain unimplemented until later steps.
- **Consequences:** Consumers can type against the public API now; importing packages under Node stays SSR-safe.

### ADR-012: Retain `monitoring?: boolean`, default false / no-op toward vendor endpoints

- **Context:** Upstream defaults `monitoring` to true and may beacon openfpcdn.
- **Decision:** Keep the optional flag for observable API familiarity; document default **false** and forbid FingerprintJS monitoring URLs. See D-003.
- **Consequences:** Type tests assert the field exists; behavior enforced when `load()` is implemented.

### ADR-013: Versioned `ALGORITHM_SCHEMA` separate from upstream package version

- **Context:** Iran profile and hashing must not impersonate upstream `5.3.0` identity.
- **Decision:** Export `ALGORITHM_SCHEMA` with `sourceManifestRevision: default-v1`, `hashingRevision`, `confidenceRevision`, and local `packageVersion`.
- **Consequences:** `GetResult.version` (later) uses this SDK’s version; manifest changes require an explicit revision bump.

---

## 2026-11-03 — Step 02: Monorepo bootstrap and package naming

### ADR-008: Independent npm scope `@night-watch/*`

- **Context:** Must not publish under `@fingerprintjs` or claim affiliation.
- **Decision:** Root workspace `independent-browser-fingerprint`; packages `@night-watch/core` and `@night-watch/browser-sdk` (Night Watch). Product label: “Night Watch”.
- **Consequences:** Docs, playground, and publish use this scope. **Locked for release track in ADR-072 / step 61** (rename only via a new ADR before first public npm publish).

### ADR-009: Tooling stack for foundations

- **Context:** Step 02 requires strict TS monorepo with lint/test/e2e gates.
- **Decision:** pnpm workspaces; TypeScript project references (`tsc -b`); ESLint 9 flat + Prettier; Vitest (node); Playwright (Chromium smoke only for now); target ES2018; `module`/`moduleResolution` NodeNext; `sideEffects: false`.
- **Consequences:** `pnpm test` / `test:e2e` run `pre*` build so imports resolve against `dist`. Playground is typecheck-only until the live playground step.

### ADR-010: Bootstrap exports are registry/metadata only

- **Context:** Avoid stub `load()` / fake collector success before contracts exist.
- **Decision:** Packages export source-manifest constants and invariants only; no browser globals at import time.
- **Consequences:** Public `load`/`get` types arrive in step 03; implementation in later foundation steps.

---

## 2026-11-03 — Step 01: Lock baseline and Default-profile profile

### ADR-001: Pin FingerprintJS OSS v5.3.0 commit `dac5ae59…`

- **Context:** Specs require a fixed behavioral baseline, not moving `master`.
- **Decision:** Treat annotated tag `v5.3.0` ? commit `dac5ae59409669f09aa09c0b2f44b7615b0520da` as the only reference pin until an explicit re-baseline is approved.
- **Consequences:** All source links and differential tests target this tag.

### ADR-002: Source manifest `default-v1` = 41 sources, exclude `applePay`

- **Context:** Upstream registers 42 sources including payment API state (`ApplePaySession`).
- **Decision:** Ship 41 sources; delete `applePay` without replacement or padding; preserve relative order. See D-001 / D-002.
- **Consequences:** Raw upstream `visitorId` will differ; only filtered 41-key hash comparison is valid. Changing the set requires a new manifest revision.

### ADR-003: Observable API parity ? bit-for-bit visitorId parity

- **Context:** Consumers need familiar `load`/`get` shapes; hashing inputs differ by design.
- **Decision:** Pursue API + component + filtered-hash parity. Forbid raw upstream visitorId equality as a release gate. See D-010.
- **Consequences:** Test harnesses must filter upstream components before hash compares.

### ADR-004: No default telemetry / vendor monitoring

- **Context:** Upstream `monitoring` defaults to true and may contact `m1.openfpcdn.io`.
- **Decision:** Default off; no FingerprintJS analytics endpoints. See D-003.
- **Consequences:** Zero-egress tests become a release requirement.

### ADR-005: Independent branding; preserve MIT when adapting code

- **Context:** Independent library for first-party Iran deployments.
- **Decision:** Unique package name/scope; no `@fingerprintjs` publish identity. Retain MIT notices if code is copied. See D-004.
- **Consequences:** Docs and packages must not claim official Fingerprint affiliation.

### ADR-006: Confidence without Pro marketing comment

- **Context:** Upstream confidence comment promotes Pro with fingerprint.com UTM link.
- **Decision:** Keep heuristic score bands; omit vendor upsell comment. See D-005.
- **Consequences:** `GetResult.confidence.comment` wording defined in step 09.

### ADR-007: Locale/timezone are fixtures, not identity

- **Context:** Self-hosted QA needs `fa-IR` / `Asia/Tehran` coverage.
- **Decision:** Never hardcode nationality or force locale/timezone in collectors. See D-007.
- **Consequences:** Validation matrix is additive QA, not signal injection.

### Pending (deferred)

- `@ibf` scope locked for release track (ADR-072); change only via new ADR before first public npm publish.
- Real-device Iran matrix (Android/iOS/Brave/Samsung) remains NOT RUN — see `docs/BROWSER_COVERAGE.md`.
