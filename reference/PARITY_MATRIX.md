# Parity Matrix ? default-profile-v1

**Upstream:** FingerprintJS OSS v5.3.0 @ `dac5ae59409669f09aa09c0b2f44b7615b0520da`  
**Updated:** 2026-11-03 (step 18)  
**Statuses:** `NOT_STARTED` \| `IMPLEMENTED_UNVERIFIED` \| `PASS_UNIT` \| `PASS_BROWSER` \| `PASS_COMPONENT_PARITY` \| `PASS_FILTERED_HASH_PARITY` \| `DEVIATION_APPROVED` \| `BLOCKED_ENVIRONMENT` \| `NOT_RUN` \| `FAIL`

## Engine / contract rows

| Area | Contract | Status | Evidence |
|---|---|---|---|
| Monorepo / SSR-safe import | Node import of `@thenightwatch/*` without DOM | `PASS_UNIT` | `tests/ssr-import.test.ts`; Playwright smoke |
| DOM / iframe isolation | Offscreen iframe; cleanup; CSS/CSP-safe styles; abort/timeout | `PASS_UNIT` + `PASS_BROWSER` | `tests/dom-utils.test.ts`; `tests/e2e/dom-iframe.spec.ts`; D-015 |
| Browser engine detectors | Capability signatures; SSR-safe; confidence wiring | `PASS_UNIT` + `PASS_BROWSER` | `tests/browser-engines.test.ts`; `tests/e2e/browser-engines.spec.ts` (Chromium); WebKit/Gecko/Android matrix `NOT_RUN` until step 57 |
| Runtime probes | On-demand globals; unsupported/blocked/error | `PASS_UNIT` + `PASS_BROWSER` | `tests/runtime-environment.test.ts`; `tests/e2e/runtime-probes.spec.ts` |
| Scheduler / idle / yield | ric + fallback; MessageChannel yield; mapWithBreaks | `PASS_UNIT` | `tests/scheduler.test.ts` |
| Two-stage collectors | 4 shapes; order; isolation; concurrency; cache | `PASS_UNIT` | `tests/collectors.test.ts` |
| Error isolation + debug JSON | Errors/DOMException; sentinel `'error'`; redaction | `PASS_UNIT` + `DEVIATION_APPROVED` | `tests/debug-errors.test.ts`; D-012 |
| Canonicalization + MurmurHash3 | Sorted keys; escapes; duration excluded; x64 128 | `PASS_UNIT` | `tests/hash.test.ts`; golden vectors |
| Filtered hash (omit applePay) | Harness omits excluded key before hash | `PASS_UNIT` + `PASS_BROWSER` | `hashComponentsOmittingExcluded`; `tests/upstream-diff.test.ts`; `tests/e2e/upstream-diff.spec.ts`; D-061 |
| Upstream differential (41 sources) | Consented dual-run vs v5.3.0; classify mismatches; no raw ID gate | `PASS_UNIT` + `PASS_BROWSER` | `reference/upstream-diff-report.*`; ADR-069 |
| Source registry (41 names, order) | Match `ENABLED_SOURCES`; no `applePay` | `PASS_UNIT` | `@thenightwatch/core` + `tests/registry.test.ts` + baseline mjs |
| Excluded `applePay` | Absent from types/registry/bundles | `DEVIATION_APPROVED` + `PASS_UNIT` | D-001; `AssertApplePayExcluded`; type tests |
| Public API **types** | `Load`/`Agent`/`GetResult`/helpers | `PASS_UNIT` | `packages/*/src/types.ts`; `tests/public-contracts.test.ts` |
| Public API **runtime** | `load`/`get`/`hashComponents`/`componentsToDebugString` | `PASS_UNIT` | `tests/agent.test.ts`; default export |
| Component extend / filter | omit/extend/withComponent; mergeBuiltinSources; exclude/custom LoadOptions; no applePay | `PASS_UNIT` + `PASS_BROWSER` | `tests/components-extend.test.ts`; `tests/e2e/playground-rtl-ltr.spec.ts`; D-057 / ADR-065 |
| Live playground | Consent-gated local Vite UI; signal table; repeat compare; copy JSON; no upload | `PASS_UNIT` + `PASS_BROWSER` | `tests/playground-format.test.ts`; `tests/e2e/playground-live.spec.ts`; D-058 / ADR-066 |
| Publish bundles | ESM/CJS/IIFE/UMD + d.ts + sourcemaps; sideEffects false; offline/CSP | `PASS_UNIT` + `PASS_BROWSER` | `tests/bundles.test.ts`; `tests/e2e/bundles-iife.spec.ts`; D-059 / ADR-067 |
| Browser coverage matrix | Chromium/Firefox/WebKit + incognito; CSP/sandbox/storage/WebGL/audio | `PASS_BROWSER` + manual `NOT_RUN` | `tests/e2e/browser-matrix.spec.ts`; `docs/BROWSER_COVERAGE.md`; D-060 / ADR-068 |
| Perf / stability / entropy | Consented lab p50/p95/p99, source cost, rebuild?20, RTL, bundles | `PASS_UNIT` + `PASS_BROWSER` | `reference/perf-entropy-report.*`; ADR-070 / D-062; real Android **NOT_RUN** |
| CI security / quality gates | SHA-pinned Actions; lint/type/unit/e2e; prod audit; SBOM; applePay guard | `PASS_UNIT` + workflow authored | `.github/workflows/ci.yml`; `scripts/ci/*`; ADR-071 / D-063; remote Actions **NOT_RUN** |
| Licensing / public docs / examples | MIT+NOTICE; README/API/migration/privacy/build; EN+FA examples | `PASS_UNIT` | `LICENSE`, `NOTICE`, `docs/*`, `examples/*`, `tests/docs-examples.test.ts`; ADR-072 / D-064 |
| Release candidate 1.0.0 | Changelog, tag plan, checklist, rollback, release-gate | `PASS_UNIT` + hard gates | `reference/release-gate-report.*`; ADR-073 / D-065; npm publish **NOT_RUN** |
| Opt-in collection policy | Consent gate + category omit; default load unchanged | `PASS_UNIT` + `PASS_BROWSER` | `docs/COLLECTION_POLICY.md`; ADR-074 / D-066; not upstream OSS |
| Opt-in namespaced / salted IDs | Namespace/domain/salt derivation; default hash unchanged | `PASS_UNIT` + `PASS_BROWSER` | `docs/NAMESPACED_IDS.md`; ADR-075 / D-067; not upstream OSS |
| Opt-in reliability profiles | conservative / balanced / diagnostic; default load unchanged | `PASS_UNIT` + `PASS_BROWSER` | `docs/RELIABILITY_PROFILES.md`; ADR-076 / D-068; not upstream OSS |
| Opt-in custom plugin SDK | Namespaced plugins, deps, timeouts, cleanup; default load unchanged | `PASS_UNIT` + `PASS_BROWSER` | `docs/PLUGIN_SDK.md`; ADR-077 / D-069; not upstream OSS |
| Opt-in resource budgets | AbortSignal, total/per-source timeouts, idle scheduling; default load unchanged | `PASS_UNIT` + `PASS_BROWSER` | `docs/RESOURCE_BUDGETS.md`; ADR-078 / D-070; not upstream OSS |
| Opt-in diagnostics snapshots | Local schema JSON, repro seed, page-context redaction; default load unchanged | `PASS_UNIT` + `PASS_BROWSER` | `docs/DIAGNOSTICS.md`; ADR-079 / D-071; not upstream OSS |
| Opt-in change inspector | Local component diff + instability hints; probabilistic disclaimer; default load unchanged | `PASS_UNIT` + `PASS_BROWSER` | `docs/CHANGE_INSPECTOR.md`; ADR-080 / D-072; not upstream OSS |
| Opt-in entropy experiments | Consent-gated within/across aggregates; local deletion; default load unchanged | `PASS_UNIT` + `PASS_BROWSER` | `docs/ENTROPY_EXPERIMENTS.md`; ADR-081 / D-073; not upstream OSS |
| Server integration design | Design constant + docs only; no runtime client | `PASS_UNIT` | `docs/SERVER_INTEGRATION_DESIGN.md`; ADR-082 / D-074 |
| Source metadata registry | Hash-neutral 41-source metadata; v5.3.0-aligned; no applePay | `PASS_UNIT` | `docs/SOURCE_METADATA.md`; ADR-083 / D-075 |
| Supply chain / offline | Lockfile integrity, vendor audit, offline docs | `PASS_UNIT` | `docs/OFFLINE_SUPPLY_CHAIN.md`; ADR-084 / D-076 |
| Monitoring default | false / no vendor beacon | `DEVIATION_APPROVED` + `PASS_UNIT` | D-003; agent tests |
| Builtin sources (41) | Registered; collectors pending ? errors | `IMPLEMENTED_UNVERIFIED` | D-013; steps 13?53 |
| Confidence heuristic | Platform bands; honest comment; live detector hints; no Pro URL | `PASS_UNIT` + `DEVIATION_APPROVED` | `tests/confidence.test.ts`; `getConfidence` + `detectConfidenceEnvironmentHints`; D-005 / ADR-020 / ADR-022 |
| Algorithm schema | `default-profile-v1` + hash/confidence revs | `PASS_UNIT` | `ALGORITHM_SCHEMA` |
| Canonicalization | Sorted keys, escapes, `error` token | `NOT_STARTED` | Step 08 |
| MurmurHash3 x64 128 | UTF-8 hex | `NOT_STARTED` | Step 08 |
| Filtered hash parity | Upstream-`applePay` vs local | `PASS_UNIT` + `PASS_BROWSER` | Step 58 / D-061 |
| Raw upstream visitorId | Equality | `DEVIATION_APPROVED` / N/A | D-002 ? not a gate |
| Monitoring default | No outbound; option typed | `DEVIATION_APPROVED` | D-003 / ADR-012 |
| Confidence heuristic | Honest scores; no Pro URL | `NOT_STARTED` | Step 09 + D-005 |

## Per-source rows (41)

| # | Source | Upstream file | Step | Output contract (high level) | Status | Evidence |
|---:|---|---|---:|---|---|---|
| 1 | `userAgentData` | `user_agent_data.ts` | 13 | UA-CH brands/platform/mobile (+ high-entropy when available) | `PASS_UNIT` + `PASS_BROWSER` | `tests/user-agent-data.test.ts`; `tests/e2e/user-agent-data.spec.ts` (Chromium HTTPS) |
| 2 | `fonts` | `fonts.ts` | 14 | Installed font availability set | `PASS_UNIT` + `PASS_BROWSER` | `tests/fonts.test.ts`; `tests/e2e/fonts.spec.ts`; D-017 |
| 3 | `domBlockers` | `dom_blockers.ts` | 15 | Content-blocker CSS probe hits | `PASS_UNIT` + `PASS_BROWSER` | `tests/dom-blockers.test.ts`; `tests/e2e/dom-blockers.spec.ts` (Chromium ineligible?`undefined`); WebKit/Android live `NOT_RUN` until step 57 |
| 4 | `fontPreferences` | `font_preferences.ts` | 16 | Font preference size measurements | `PASS_UNIT` + `PASS_BROWSER` | `tests/font-preferences.test.ts`; `tests/e2e/font-preferences.spec.ts`; D-019 |
| 5 | `audio` | `audio.ts` | 17 | OfflineAudioContext fingerprint / unstable sentinel | `PASS_UNIT` + `PASS_BROWSER` | `tests/audio.test.ts`; `tests/e2e/audio.spec.ts`; D-020 |
| 6 | `screenFrame` | `screen_frame.ts` | 18 | Screen frame / chrome insets | `PASS_UNIT` + `PASS_BROWSER` + `DEVIATION_APPROVED` | `tests/screen-frame.test.ts`; `tests/e2e/screen-frame.spec.ts`; D-021 |
| 7 | `canvas` | `canvas.ts` | 19 | Canvas winding + geometry/text hashes | `PASS_UNIT` + `PASS_BROWSER` | `tests/canvas.test.ts`; `tests/e2e/canvas.spec.ts`; D-022; ADR-030 |
| 8 | `osCpu` | `os_cpu.ts` | 20 | `navigator.oscpu` or undefined | `PASS_UNIT` + `PASS_BROWSER` | `tests/os-cpu.test.ts`; `tests/e2e/os-cpu.spec.ts`; D-023; ADR-031 |

| 9 | `languages` | `languages.ts` | 21 | Language list (raw runtime semantics) | `PASS_UNIT` + `PASS_BROWSER` | `tests/languages.test.ts`; `tests/e2e/languages.spec.ts`; D-024; ADR-032 |
| 10 | `colorDepth` | `color_depth.ts` | 22 | Display color depth | `PASS_UNIT` + `PASS_BROWSER` | `tests/color-depth.test.ts`; `tests/e2e/color-depth.spec.ts`; D-025; ADR-033 |

| 11 | `deviceMemory` | `device_memory.ts` | 23 | Approximate device memory | `PASS_UNIT` + `PASS_BROWSER` | `tests/device-memory.test.ts`; `tests/e2e/device-memory.spec.ts`; D-026; ADR-034 |

| 12 | `screenResolution` | `screen_resolution.ts` | 24 | Physical screen dimensions | `PASS_UNIT` + `PASS_BROWSER` | `tests/screen-resolution.test.ts`; `tests/e2e/screen-resolution.spec.ts`; D-027; ADR-035 |

| 13 | `hardwareConcurrency` | `hardware_concurrency.ts` | 25 | Logical processor count | `PASS_UNIT` + `PASS_BROWSER` | `tests/hardware-concurrency.test.ts`; `tests/e2e/hardware-concurrency.spec.ts`; D-028; ADR-036 |

| 14 | `timezone` | `timezone.ts` | 26 | Timezone identity (no hardcoded offset) | `PASS_UNIT` + `PASS_BROWSER` | `tests/timezone.test.ts`; `tests/e2e/timezone.spec.ts`; D-029; ADR-037 |

| 15 | `sessionStorage` | `session_storage.ts` | 27 | Session storage availability | `PASS_UNIT` + `PASS_BROWSER` | `tests/session-storage.test.ts`; `tests/e2e/session-storage.spec.ts`; D-030; ADR-038 |

| 16 | `localStorage` | `local_storage.ts` | 28 | Local storage availability | `PASS_UNIT` + `PASS_BROWSER` | `tests/local-storage.test.ts`; `tests/e2e/local-storage.spec.ts`; D-031; ADR-039 |

| 17 | `indexedDB` | `indexed_db.ts` | 29 | IndexedDB availability | `PASS_UNIT` + `PASS_BROWSER` | `tests/indexed-db.test.ts`; `tests/e2e/indexed-db.spec.ts`; D-032; ADR-040 |

| 18 | `openDatabase` | `open_database.ts` | 30 | Legacy WebSQL presence | `PASS_UNIT` + `PASS_BROWSER` | `tests/open-database.test.ts`; `tests/e2e/open-database.spec.ts`; D-033; ADR-041 |

| 19 | `cpuClass` | `cpu_class.ts` | 31 | Legacy CPU class | `PASS_UNIT` + `PASS_BROWSER` | `tests/cpu-class.test.ts`; `tests/e2e/cpu-class.spec.ts`; D-034; ADR-042 |

| 20 | `platform` | `platform.ts` | 32 | Platform descriptor | `PASS_UNIT` + `PASS_BROWSER` | `tests/platform.test.ts`; `tests/e2e/platform.spec.ts`; D-035; ADR-043 |

| 21 | `plugins` | `plugins.ts` | 33 | Plugin metadata list | `PASS_UNIT` + `PASS_BROWSER` | `tests/plugins.test.ts`; `tests/e2e/plugins.spec.ts`; D-036; ADR-044 |

| 22 | `touchSupport` | `touch_support.ts` | 34 | Max touch points / touch event support | `PASS_UNIT` + `PASS_BROWSER` | `tests/touch-support.test.ts`; `tests/e2e/touch-support.spec.ts`; D-037; ADR-045 |
| 23 | `vendor` | `vendor.ts` | 35 | Browser vendor string | `PASS_UNIT` + `PASS_BROWSER` | `tests/vendor.test.ts`; `tests/e2e/vendor.spec.ts`; D-038; ADR-046 |
| 24 | `vendorFlavors` | `vendor_flavors.ts` | 36 | Vendor-specific globals | `PASS_UNIT` + `PASS_BROWSER` | `tests/vendor-flavors.test.ts`; `tests/e2e/vendor-flavors.spec.ts`; D-039; ADR-047 |
| 25 | `cookiesEnabled` | `cookies_enabled.ts` | 37 | Cookie capability (temp cookie + cleanup) | `PASS_UNIT` + `PASS_BROWSER` | `tests/cookies-enabled.test.ts`; `tests/e2e/cookies-enabled.spec.ts`; D-040; ADR-048 |
| 26 | `colorGamut` | `color_gamut.ts` | 38 | CSS color gamut | `PASS_UNIT` + `PASS_BROWSER` | `tests/color-gamut.test.ts`; `tests/e2e/color-gamut.spec.ts`; D-041; ADR-049 |
| 27 | `invertedColors` | `inverted_colors.ts` | 39 | Inverted colors preference | `PASS_UNIT` + `PASS_BROWSER` | `tests/inverted-colors.test.ts`; `tests/e2e/inverted-colors.spec.ts`; D-042; ADR-050 |
| 28 | `forcedColors` | `forced_colors.ts` | 40 | Forced colors mode | `PASS_UNIT` + `PASS_BROWSER` | `tests/forced-colors.test.ts`; `tests/e2e/forced-colors.spec.ts`; D-043; ADR-051 |
| 29 | `monochrome` | `monochrome.ts` | 41 | Monochrome bit depth | `PASS_UNIT` + `PASS_BROWSER` | `tests/monochrome.test.ts`; `tests/e2e/monochrome.spec.ts`; D-044; ADR-052 |
| 30 | `contrast` | `contrast.ts` | 42 | Preferred contrast | `PASS_UNIT` + `PASS_BROWSER` | `tests/contrast.test.ts`; `tests/e2e/contrast.spec.ts`; D-045; ADR-053 |
| 31 | `reducedMotion` | `reduced_motion.ts` | 43 | Reduced motion preference | `PASS_UNIT` + `PASS_BROWSER` | `tests/reduced-motion.test.ts`; `tests/e2e/reduced-motion.spec.ts`; D-046; ADR-054 |
| 32 | `reducedTransparency` | `reduced_transparency.ts` | 44 | Reduced transparency preference | `PASS_UNIT` + `PASS_BROWSER` | `tests/reduced-transparency.test.ts`; `tests/e2e/reduced-transparency.spec.ts`; D-047; ADR-055 |
| 33 | `hdr` | `hdr.ts` | 45 | Dynamic range / HDR preference | `PASS_UNIT` + `PASS_BROWSER` | `tests/hdr.test.ts`; `tests/e2e/hdr.spec.ts`; D-048; ADR-056 |
| 34 | `math` | `math.ts` | 46 | Floating-point math fingerprint | `PASS_UNIT` + `PASS_BROWSER` | `tests/math.test.ts`; `tests/e2e/math.spec.ts`; D-049; ADR-057 |
| 35 | `pdfViewerEnabled` | `pdf_viewer_enabled.ts` | 47 | Built-in PDF viewer | `PASS_UNIT` + `PASS_BROWSER` | `tests/pdf-viewer-enabled.test.ts`; `tests/e2e/pdf-viewer-enabled.spec.ts`; D-050; ADR-058 |
| 36 | `architecture` | `architecture.ts` | 48 | Float architecture probe | `PASS_UNIT` + `PASS_BROWSER` | `tests/architecture.test.ts`; `tests/e2e/architecture.spec.ts`; D-051; ADR-059 |
| 37 | `privateClickMeasurement` | `private_click_measurement.ts` | 49 | Safari PCM capability state | `PASS_UNIT` + `PASS_BROWSER` | `tests/private-click-measurement.test.ts`; `tests/e2e/private-click-measurement.spec.ts`; D-052; ADR-060 |
| 38 | `audioBaseLatency` | `audio_base_latency.ts` | 50 | Audio context base latency | `PASS_UNIT` + `PASS_BROWSER` | `tests/audio-base-latency.test.ts`; `tests/e2e/audio-base-latency.spec.ts`; D-053; ADR-061 |
| 39 | `dateTimeLocale` | `date_time_locale.ts` | 51 | Intl date/time locale | `PASS_UNIT` + `PASS_BROWSER` | `tests/date-time-locale.test.ts`; `tests/e2e/date-time-locale.spec.ts`; D-054; ADR-062 |
| 40 | `webGlBasics` | `webgl.ts` | 52 | WebGL basics (late; shared cache) | `PASS_UNIT` + `PASS_BROWSER` | `tests/webgl-basics.test.ts`; `tests/e2e/webgl-basics.spec.ts`; D-055; ADR-063 |
| 41 | `webGlExtensions` | `webgl.ts` | 53 | WebGL extensions/precision (late) | `PASS_UNIT` + `PASS_BROWSER` | `tests/webgl-extensions.test.ts`; `tests/e2e/webgl-extensions.spec.ts`; D-056; ADR-064 |

## Explicitly excluded

| Upstream # | Source | Reason | Status |
|---:|---|---|---|
| 37 | `applePay` | Payment API / not required for Self-hosted profile; D-001 | `DEVIATION_APPROVED` |

## Iran validation fixtures (tracking only)

| Fixture | Status |
|---|---|
| `fa-IR` / `fa` / mixed languages | `PASS_UNIT` + `PASS_BROWSER` (step 21; no reorder/invent) |

| `Asia/Tehran` timezone | `PASS_UNIT` + `PASS_BROWSER` (fixtures only; never forced) |

| RTL / ZWNJ DOM probes | `NOT_RUN` |
| Zero-egress self-host | `NOT_RUN` |
| Android WebView / Samsung Internet | `NOT_RUN` |
