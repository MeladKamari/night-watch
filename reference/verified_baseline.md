# Verified Baseline Ledger — FingerprintJS OSS v5.3.0 → Default-profile-v1

**Verified on:** 2026-11-03  
**Pinned commit:** `dac5ae59409669f09aa09c0b2f44b7615b0520da` (tag `v5.3.0`)  
**Local manifest:** `default-profile-v1` (41 sources)  
**Status:** Registry, API surface, hashing contract, and monitoring behavior locked for implementation. **No entropy-source collectors implemented in this step.**

## 1. Upstream facts observed from pinned code

| Topic | Observed at v5.3.0 |
|---|---|
| Built-in registry size | **42** keys in `src/sources/index.ts` |
| Public SemVer exports | `load`, `Agent`, `LoadOptions`, `GetOptions`, `GetResult`, `hashComponents`, `componentsToDebugString`, `Component`, `UnknownComponents`, `BuiltinComponents`, `Confidence` |
| Default export | `{ load, hashComponents, componentsToDebugString }` |
| Collector shapes | sync value, Promise value, deferred getter, Promise of deferred getter (`utils/entropy_source.ts`) |
| Component result | `{ value, duration }` **or** `{ error, duration }` |
| Canonicalization | sort keys; escape `:`, `|`, `\`; error → literal `error`; else `JSON.stringify(value)`; join with `|`; **duration excluded** |
| Hash | MurmurHash3 x64 128 (`x64hash128`), UTF-8 bytes via `getUTF8Bytes`, 32-char hex |
| Confidence | Heuristic platform score (Android 0.4, WebKit 0.3/0.5, Win 0.6, Mac 0.5, else 0.7); **not calibrated**; upstream embeds Pro upsell comment |
| Monitoring | `LoadOptions.monitoring` **defaults to `true`**; ~0.1% chance XHR GET to `https://m1.openfpcdn.io/fingerprintjs/v${version}/npm-monitoring` |
| License | MIT, Copyright (c) 2025 FingerprintJS, Inc |
| Target | Browser SDK; SSR-safe import expected (`check:ssr` in upstream package scripts) |

## 2. Upstream registry (42) vs Default-profile (41)

Upstream registration order from pinned `sources` object:

| # | Name | Default-profile |
|---:|---|---|
| 1 | `userAgentData` | included (#1) |
| 2 | `fonts` | included (#2) |
| 3 | `domBlockers` | included (#3) |
| 4 | `fontPreferences` | included (#4) |
| 5 | `audio` | included (#5) |
| 6 | `screenFrame` | included (#6) |
| 7 | `canvas` | included (#7) |
| 8 | `osCpu` | included (#8) |
| 9 | `languages` | included (#9) |
| 10 | `colorDepth` | included (#10) |
| 11 | `deviceMemory` | included (#11) |
| 12 | `screenResolution` | included (#12) |
| 13 | `hardwareConcurrency` | included (#13) |
| 14 | `timezone` | included (#14) |
| 15 | `sessionStorage` | included (#15) |
| 16 | `localStorage` | included (#16) |
| 17 | `indexedDB` | included (#17) |
| 18 | `openDatabase` | included (#18) |
| 19 | `cpuClass` | included (#19) |
| 20 | `platform` | included (#20) |
| 21 | `plugins` | included (#21) |
| 22 | `touchSupport` | included (#22) |
| 23 | `vendor` | included (#23) |
| 24 | `vendorFlavors` | included (#24) |
| 25 | `cookiesEnabled` | included (#25) |
| 26 | `colorGamut` | included (#26) |
| 27 | `invertedColors` | included (#27) |
| 28 | `forcedColors` | included (#28) |
| 29 | `monochrome` | included (#29) |
| 30 | `contrast` | included (#30) |
| 31 | `reducedMotion` | included (#31) |
| 32 | `reducedTransparency` | included (#32) |
| 33 | `hdr` | included (#33) |
| 34 | `math` | included (#34) |
| 35 | `pdfViewerEnabled` | included (#35) |
| 36 | `architecture` | included (#36) |
| 37 | **`applePay`** | **EXCLUDED** (payment API / `ApplePaySession`) |
| 38 | `privateClickMeasurement` | included (#37) — Safari privacy capability, **not** payment |
| 39 | `audioBaseLatency` | included (#38) |
| 40 | `dateTimeLocale` | included (#39) |
| 41 | `webGlBasics` | included (#40) — must run late |
| 42 | `webGlExtensions` | included (#41) — must run late |

**Source-link verification (2026-11-03):** HTTP HEAD against all 41 unique upstream source files under tag `v5.3.0` returned **200**, including `apple_pay.ts` (present upstream, not registered locally) and `webgl.ts` (shared by two keys).

## 3. Parity ladder (goals, not yet proven in code)

| Level | Meaning | Acceptance for this product |
|---|---|---|
| A. API shape | `load` / `get` / helpers / types | Target: **observable API-equivalent** |
| B. Registry | Exact 41 names + relative order; no `applePay` | Target: **must match** `default-profile-v1` |
| C. Collector engine | Four source shapes, isolation, durations, cleanup | Target: behavior-equivalent |
| D. Per-source values | Same environment → same value/sentinel/error class | Target: measured component parity |
| E. Canonical + hash | Same 41-key map → same MurmurHash3 string | Target: **filtered** hash parity |
| F. Raw upstream `visitorId` | Unfiltered 42-source ID | **NOT a goal**; mismatch is expected |
| G. Identity certainty | Unique human/device | **Never claimed** |

## 4. Intentional product deltas vs upstream (summary)

Full rationale: `reference/parity_decisions.md`.

1. **Exclude `applePay`** — no payment-provider browser signals; no placeholder component.
2. **`monitoring` default `false`** — zero outbound telemetry; no FingerprintJS / openfpcdn endpoints.
3. **Independent package naming** — do not publish as `@fingerprintjs/*` or reuse company branding/domains.
4. **Confidence comments** — no upstream Pro marketing / fingerprint.com referral text.
5. **`version` field** — this SDK’s algorithm/package version, not a forged upstream version string.
6. **Self-hosted QA/deployment** — locale/timezone as test fixtures only; no geo-inference in collectors.

## 5. Delta list — what must still be built (post step 01)

| Area | Steps | Notes |
|---|---|---|
| Strict TS monorepo (pnpm, Vitest, Playwright) | 02 | Quality gates unavailable until then |
| Public types & contracts | 03 | Mirror shapes; own names/version |
| Runtime guards (SSR-safe) | 04 | No browser globals at import |
| Idle / yield scheduler | 05 | `requestIdleCallback` + fallback |
| Two-stage collector engine | 06 | Preserve order; parallel slow sources |
| Error isolation + debug JSON | 07 | Per-source errors; safe serialization |
| Canonicalization + MurmurHash3 | 08 | Golden vectors before ID claims |
| Confidence heuristic | 09 | Honest semantics; no Pro comment |
| Agent `load` / `get` | 10 | Lifecycle + debug delay |
| Browser detectors + DOM helpers | 11–12 | Shared by many sources |
| 41 entropy sources | 13–53 | One prompt each; WebGL last |
| Extensibility, bundles, CI, docs | 54–62 | Release gates |
| Optional enhancements | 63–73 | Must not silently change baseline IDs |

## 6. Evidence artifacts produced in this step

- `reference/pin.md`
- `reference/verified_baseline.md` (this file)
- `reference/parity_decisions.md`
- `reference/PARITY_MATRIX.md`
- `reference/baseline_registry.ts`
- `reference/upstream_registry_42.json`
- `reference/default_profile.json` / `source_inventory.json` / `SOURCES_INDEX.md`
- `tests/unit/baseline-registry.test.mjs`
- `docs/PROGRESS.md` / `docs/DECISIONS.md`

## 7. Limitations of this verification

- Upstream Karma/BrowserStack suites were **not** executed in this environment.
- No side-by-side component collection against a local `@fingerprintjs/fingerprintjs@5.3.0` install yet (deferred to differential harness in later steps).
- Hash golden vectors are **not** implemented until step 08.
- File fetches prove registry/API contracts; they do not prove runtime parity of each collector.
