# Parity Decisions ? Default-profile-v1

**Date:** 2026-11-03  
**Baseline:** FingerprintJS OSS `v5.3.0` @ `dac5ae59409669f09aa09c0b2f44b7615b0520da`  
**Manifest:** `default-profile-v1`

This file records intentional deviations and non-goals. Every change that affects identifier semantics must get a new algorithm / source-manifest revision.

---

## D-001 ? Exclude `applePay` (payment API state)

| | |
|---|---|
| **Decision** | Do not implement, type, register, bundle, test-expect, or hash `applePay`. |
| **Upstream** | `src/sources/apple_pay.ts` probes `window.ApplePaySession.canMakePayments()` and returns enum states `0 \| 1 \| -1 \| -2 \| -3`. |
| **Rationale** | Self-hosted product does not require Apple Pay / payment-provider browser signals (`12_IRAN_MARKET_PROFILE.md`). |
| **Padding** | **Forbidden.** No `undefined`, `null`, sentinel, or regional constant under key `applePay`. |
| **Order** | Preserve relative order of the remaining 41 keys after deletion. |
| **ID impact** | Canonical map loses one key ? **raw upstream `visitorId` will not match**. |
| **Valid parity** | Compare components for 41 keys; in tests only, delete `applePay` from upstream components and re-hash. |
| **Evidence** | Pinned registry fetched; `apple_pay.ts` HEAD 200; excluded in `default_profile.json` and `baseline_registry.ts`. |
| **Status** | **APPROVED** (product mandate) |

---

## D-002 ? Raw upstream visitorId equality is NOT an acceptance criterion

| | |
|---|---|
| **Decision** | Never assert `local.visitorId === upstream.visitorId` against unfiltered upstream results. |
| **Rationale** | Source-set mismatch is intentional (D-001). |
| **Allowed comparison** | Filtered 41-key upstream hash vs local hash after per-source value parity. |
| **Status** | **APPROVED** |

---

## D-003 ? Disable monitoring / telemetry by default

| | |
|---|---|
| **Decision** | Accept `monitoring?: boolean` for API familiarity if desired, but **default `false`**. Never call `m1.openfpcdn.io` or any FingerprintJS analytics/CDN monitoring URL. Production default: **zero outbound network**. |
| **Upstream** | `monitoring` defaults to `true`; may XHR GET `https://m1.openfpcdn.io/fingerprintjs/v${version}/npm-monitoring`. |
| **Rationale** | First-party Iran / offline deployment; privacy and compliance (`07`, `14`). |
| **Test** | Zero-egress page must show no fetch/XHR/beacon/WebSocket to third parties during `load`/`get`. |
| **Status** | **APPROVED** (intentional deviation) |

---

## D-004 ? Independent naming, branding, and endpoints

| | |
|---|---|
| **Decision** | Unique package/product name; no `@fingerprintjs` scope; no Fingerprint company branding, domain names, or analytics endpoints in runtime or docs as ?official? affiliation. |
| **MIT** | If upstream code is copied/adapted, preserve copyright + MIT notice. |
| **Status** | **APPROVED** |

---

## D-005 ? Confidence: heuristic only; no Pro marketing comment

| | |
|---|---|
| **Decision** | Reproduce **honest heuristic score bands** compatible with open-source behavior for the platforms we support. Do **not** ship upstream `commentTemplate` linking to fingerprint.com Pro upsell. |
| **Rationale** | Confidence is not a calibrated probability; marketing comments are vendor branding. |
| **ID impact** | None (`confidence` is not hashed). |
| **Status** | **APPROVED** |

---

## D-006 ? `version` reports this SDK, not forged upstream version

| | |
|---|---|
| **Decision** | `GetResult.version` is this package?s algorithm/package version. Track `sourceManifestRevision` (`default-profile-v1`) separately. Do not impersonate `5.3.0` as if we were upstream. |
| **Status** | **APPROVED** |

---

## D-007 ? Locale / timezone are measured, never assigned by nationality

| | |
|---|---|
| **Decision** | `fa-IR`, `Asia/Tehran`, RTL, Persian digits are **test fixtures**. Collectors must not hardcode Iran locale/timezone or infer nationality/geography. |
| **Status** | **APPROVED** |

---

## D-008 ? Keep `privateClickMeasurement`

| | |
|---|---|
| **Decision** | Retain Safari PCM capability probe. It is **not** a payment feature. |
| **Rationale** | Safari/WebKit/iOS parity remains in scope. |
| **Status** | **APPROVED** |

---

## D-009 ? Hash algorithm: match pinned MurmurHash3 x64 128 semantics on the 41-key map

| | |
|---|---|
| **Decision** | Implement reference-compatible canonicalization + `x64hash128` (UTF-8). Apply only to the selected 41 components. Changing serialization or source set requires a new algorithm revision. |
| **Status** | **LOCKED as goal**; implementation in step 08 |

---

## D-010 ? Observable API parity vs bit-for-bit visitorId parity

| Concept | Target |
|---|---|
| Observable API parity | Early goal (`load`/`get`/helpers/types) |
| Component parity (41) | Measured per browser |
| Filtered hash parity | After component + hash golden vectors |
| Bit-for-bit raw upstream visitorId | **Out of scope / fail if asserted** |

---

## D-012 ? Debug redaction of credential-like keys

| | |
|---|---|
| **Decision** | `errorToObject` / `componentsToDebugString` replace sensitive own-property keys with `'[redacted]'`. |
| **Upstream** | Spreads error fields without redaction. |
| **ID impact** | None (debug only; hash uses `'error'` sentinel). |
| **Status** | **APPROVED** (ADR-018) |

---

## D-011 ? Public types land before runtime `load()` / hash helpers

| | |
|---|---|
| **Decision** | Export full public type surface (including `Load` / `HashComponents` function types) without shipping stub implementations that return synthetic results. |
| **Rationale** | Step 03 is contracts-only; fake `load()` would violate ?no synthetic success? rules. |
| **Status** | **APPROVED** |

---

## D-013 ? Unimplemented builtin sources surface as component errors

| | |
|---|---|
| **Decision** | Until prompts 13?53 land, builtin sources throw `SourceNotImplementedError` (isolated per component). |
| **Rationale** | Avoid fabricated successful fingerprint values while still exercising agent/hash/confidence. |
| **ID impact** | Pre-release visitorIds are not stable vs final collectors. |
| **Status** | **APPROVED** (ADR-021); temporary |

---

## D-014 ? `ApplePayError` is a WebKit engine signature only

| | |
|---|---|
| **Decision** | `isWebKit` may observe `'ApplePayError' in window` as one capability signal (upstream-aligned). Never register, call, type, test, or hash an `applePay` entropy source (D-001). |
| **Rationale** | Engine detection ? payment signal collection. |
| **ID impact** | None (detectors are not hashed). |
| **Status** | **APPROVED** (ADR-022) |

---

## D-015 ? `withIframe` optional abort / timeout (additive)

| | |
|---|---|
| **Decision** | Keep upstream-compatible `(action, initialHtml?, domPollInterval?)` plus an options-object form with `timeoutMs` / `signal`. Timeouts raise `DomOperationTimeoutError`; abort always detaches the iframe. |
| **Rationale** | Step 12 requires abort/timeout/cleanup cases; limited-connectivity / hung DOM must not leave orphan nodes. |
| **ID impact** | None (helper is not hashed). |
| **Status** | **APPROVED** (ADR-023); intentional additive API |

---

## D-016 ? `userAgentData` high-entropy fields omit `undefined` keys

| | |
|---|---|
| **Decision** | When `getHighEntropyValues` resolves, assign architecture/bitness/model/platformVersion only if `!== undefined` (`exactOptionalPropertyTypes`). Empty string (e.g. `model: ''`) is kept. |
| **Rationale** | TypeScript strict optional props; `JSON.stringify` already drops `undefined`, so hashed form matches upstream. |
| **ID impact** | None vs upstream hashed form. |
| **Status** | **APPROVED** (ADR-024) |

---

## D-017 ? Persian / regional fonts are opt-in only (proposal)

| | |
|---|---|
| **Decision** | Keep the pinned v5.3.0 `FONT_CANDIDATE_LIST` as default-profile. Do not add Vazirmatn, B Nazanin, Tahoma, or other regional names to the default probe set. A future extension may supply an **additional** candidate list via custom `sources` / plugin with a **new** `sourceManifestRevision` (e.g. `iran-fonts-ext-v1`). |
| **Rationale** | `12_IRAN_MARKET_PROFILE.md` forbids silent extra probes that change core identifier semantics. |
| **ID impact** | Default: none vs upstream fonts list. Extension: intentional new revision when shipped. |
| **Status** | **APPROVED** (ADR-025); extension **not implemented** |

---

## D-018 ? `domBlockers` ineligible browsers yield `undefined`

| | |
|---|---|
| **Decision** | When not WebKit/Android, return `undefined` (hashed), never invent `[]` as ?no blockers?. Empty array only when eligible but no filter crosses the 60% threshold. |
| **Rationale** | Matches upstream semantics; Desktop Chromium is commonly ineligible. |
| **ID impact** | None vs upstream eligibility rules. |
| **Status** | **APPROVED** (ADR-026) |

---

## D-019 ? `fontPreferences` hashed text stays Latin upstream string

| | |
|---|---|
| **Decision** | Production presets always use `mmMwWLliI0fiflO&1`. Persian/Arabic strings are allowed only in non-hashing test fixtures / optional future overrides with a new manifest revision. |
| **Rationale** | Iran validation needs RTL/Persian render checks without silently changing identifier semantics. |
| **ID impact** | None vs upstream default text. |
| **Status** | **APPROVED** (ADR-027) |

---

## D-020 ? Audio special fingerprints are hashed values

| | |
|---|---|
| **Decision** | `-1` suspending, `-2` unsupported, `-3` timeout, `-4` antifingerprinting are successful `{ value }` outcomes (upstream-compatible), never coerced into fabricated positive hashes or silent `0`. |
| **Rationale** | Distinguishes absence / policy from a measured signal without throwing. |
| **ID impact** | None vs upstream special codes. |
| **Status** | **APPROVED** (ADR-028) |

---

## D-021 ? `screenFrame` does not exit fullscreen by default

| | |
|---|---|
| **Decision** | Default-profile `getScreenFrame` sets `allowExitFullscreen: false`. Upstream may call `exitFullscreen()` when the frame is null under programmatic fullscreen; we rely on the backup watch instead unless callers opt in. |
| **Rationale** | Step 18: do not force users out of fullscreen without explicit safety design. |
| **ID impact** | Possible divergence vs upstream when fullscreen + null frame + no backup. |
| **Status** | **APPROVED** (ADR-029); intentional deviation |

---

## D-022 ? Canvas printed text stays Latin+emoji (no Persian substitution)

| | |
|---|---|
| **Decision** | `CANVAS_PRINTED_TEXT` remains the v5.3.0 Latin pangram + smiling-emoji surrogates. Persian/RTL appear only as host-page e2e fixtures; they must not change the hashed fillText string. |
| **Rationale** | Step 19: altering canvas fixture text would diverge visitorId entropy from upstream canvas without an algorithm revision. |
| **ID impact** | None vs upstream canvas text/geometry when antifingerprinting does not skip. |
| **Status** | **APPROVED** (ADR-030) |

---

## D-023 ? `osCpu` absence is `undefined` (no fabricated CPU id)

| | |
|---|---|
| **Decision** | When `navigator.oscpu` is missing or navigator is unavailable, the component value is `undefined`. Never synthesize Windows/Linux/CPU labels. |
| **Rationale** | Step 20 / upstream v5.3.0: Chromium and Safari omit `oscpu`; fabricating one would invent entropy. |
| **ID impact** | None vs upstream on Chromium/Safari; Firefox matches when `oscpu` is present. |
| **Status** | **APPROVED** (ADR-031) |

---

## D-024 ? `languages` keeps raw codes; Chromium86+ omits `languages` array

| | |
|---|---|
| **Decision** | Component value is `string[][]` from runtime locale fields only. Do not invent/reorder/translate `fa-IR`/`fa`/etc. Chromium =86 skips pushing `navigator.languages` (Incognito stability). |
| **Rationale** | Step 21 / upstream v5.3.0; Iran fixtures are inputs, not nationality assumptions. |
| **ID impact** | None vs upstream when detectors agree; empty `[]` under Node. |
| **Status** | **APPROVED** (ADR-032) |

---

## D-025 ? `colorDepth` is raw API value; missing screen is `undefined`

| | |
|---|---|
| **Decision** | Return `screen.colorDepth` as reported (`0`/`NaN`/non-integer preserved). Never invent `24` when screen is unavailable. |
| **Rationale** | Step 22 / upstream v5.3.0 one-liner; inventing depth would fabricate entropy under Node/SSR. |
| **ID impact** | None vs upstream in browser; Node yields `undefined` (intentional SSR-safe). |
| **Status** | **APPROVED** (ADR-033) |

---

## D-026 ? `deviceMemory` uses toFloat/replaceNaN; no RAM inventing

| | |
|---|---|
| **Decision** | `replaceNaN(toFloat(navigator.deviceMemory), undefined)`. Accept Chromium privacy buckets as-is; never invent or un-clamp GiB. Absent API ? `undefined`. |
| **Rationale** | Step 23 / upstream v5.3.0; string coercions without guessing physical RAM. |
| **ID impact** | None vs upstream when API present; Safari/Firefox/Node ? `undefined`. |
| **Status** | **APPROVED** (ADR-034) |

---

## D-027 ? `screenResolution` orientation-normalized; Safari17+ skipped

| | |
|---|---|
| **Decision** | Parse width/height with `toInt` (NaN?null); `sort().reverse()` for orientation stability; return `undefined` on Safari =17 (WebKit616+ SafariWebKit). |
| **Rationale** | Step 24 / upstream v5.3.0; private Safari uses document size as screen size. |
| **ID impact** | None vs upstream when detectors agree; Node unstable ? `[null, null]`. |
| **Status** | **APPROVED** (ADR-035) |

---

## D-028 ? `hardwareConcurrency` Firefox143 tiering (=8?8, else?4)

| | |
|---|---|
| **Decision** | Parse with `toInt` (NaN?undefined). On Gecko=143 apply RFP tiers `value >= 8 ? 8 : 4`. Keep unstable probe without tiering. |
| **Rationale** | Step 25 / upstream v5.3.0; stabilize private vs normal Firefox fingerprints. |
| **ID impact** | None vs upstream when detectors agree; absent API ? `undefined`. |
| **Status** | **APPROVED** (ADR-036) |

---

## D-029 ? `timezone` is capability signal; never force Asia/Tehran

| | |
|---|---|
| **Decision** | Prefer IANA `timeZone` from Intl; else DST-stable `UTC?offsetMinutes`. Do not hardcode or derive nationality from timezone. |
| **Rationale** | Step 26 / upstream v5.3.0; Iran fixtures (`Asia/Tehran`, +03:30) are test inputs only. |
| **ID impact** | None vs upstream when Intl agrees; fallback matches upstream offset formula. |
| **Status** | **APPROVED** (ADR-037) |

---

## D-030 ? `sessionStorage` existence-only; SecurityError ? true; no writes

| | |
|---|---|
| **Decision** | Probe `!!sessionStorage` only. Catch access errors and return `true`. Never persist keys. Missing window ? `false`. |
| **Rationale** | Step 27 / upstream v5.3.0; avoid tracking identifiers while matching blocked-iframe semantics. |
| **ID impact** | None vs upstream. |
| **Status** | **APPROVED** (ADR-038) |

---

## D-031 ? `localStorage` existence-only; SecurityError ? true; no writes

| | |
|---|---|
| **Decision** | Probe `!!localStorage` only. Catch access errors and return `true`. Never persist keys. Missing window ? `false`. |
| **Rationale** | Step 28 / upstream v5.3.0 (incl. Firefox bug 781447); no persistent tracking identifiers. |
| **ID impact** | None vs upstream. |
| **Status** | **APPROVED** (ADR-039) |

---

## D-032 ? `indexedDB` existence-only; IE/EdgeHTML skipped; no DB open

| | |
|---|---|
| **Decision** | On Trident/EdgeHTML return `undefined`. Else `!!indexedDB` (SecurityError?`true`). Never open/write databases. |
| **Rationale** | Step 29 / upstream v5.3.0; stabilize private vs normal on legacy IE/Edge without mutating storage. |
| **ID impact** | None vs upstream when detectors agree. |
| **Status** | **APPROVED** (ADR-040) |

---

## D-033 ? `openDatabase` existence-only; never create WebSQL DB

| | |
|---|---|
| **Decision** | Return `!!window.openDatabase` only. Never call the function. Removed/missing API ? `false`. |
| **Rationale** | Step 30 / upstream v5.3.0; historical capability signal without side effects. |
| **ID impact** | None vs upstream. |
| **Status** | **APPROVED** (ADR-041) |

---

## D-034 ? `cpuClass` absence is `undefined`; no UA inference

| | |
|---|---|
| **Decision** | Return `navigator.cpuClass` as-is or `undefined`. Never invent `x86`/`x64` from UA. |
| **Rationale** | Step 31 / upstream v5.3.0; modern browsers omit the property. |
| **ID impact** | None vs upstream on Chromium/Firefox/Safari. |
| **Status** | **APPROVED** (ADR-042) |

---

## D-035 ? `platform` remaps mobile-WebKit MacIntel to iPad/iPhone

| | |
|---|---|
| **Decision** | Return raw `navigator.platform`, except `MacIntel` + WebKit + !desktopWebKit ? `iPad`/`iPhone`. |
| **Rationale** | Step 32 / upstream v5.3.0; stabilize iOS desktop-mode spoofing without inventing other platforms. |
| **ID impact** | None vs upstream when detectors agree; Node ? `''`. |
| **Status** | **APPROVED** (ADR-043) |

---

## D-036 ? `plugins` is serializable metadata only; absent ? undefined

| | |
|---|---|
| **Decision** | Collect name/description/mimeTypes in order; skip null plugins; never execute plugins. Missing `navigator.plugins` ? `undefined`; empty ? `[]`. |
| **Rationale** | Step 33 / upstream v5.3.0; safe JSON hashing without plugin side effects. |
| **ID impact** | None vs upstream. |
| **Status** | **APPROVED** (ADR-044) |

---

## D-037 ? `touchSupport` is crude capability signals only

| | |
|---|---|
| **Decision** | Hash `{ maxTouchPoints, touchEvent, touchStart }`. Points: `toInt(maxTouchPoints)` ? else `msMaxTouchPoints` ? else `0`. `touchEvent` from `createEvent('TouchEvent')` try/catch. `touchStart` from `'ontouchstart' in window`. Do not claim physical touchscreen certainty. |
| **Rationale** | Step 34 / upstream v5.3.0; hybrid/privacy environments spoof these fields. |
| **ID impact** | None vs upstream; Node ? `{0,false,false}`. |
| **Status** | **APPROVED** (ADR-045) |

---

## D-038 ? `vendor` is raw string with `''` fallback

| | |
|---|---|
| **Decision** | Return `navigator.vendor || ''`. Never invent a brand from UA. Missing navigator ? `''`. |
| **Rationale** | Step 35 / upstream v5.3.0 one-liner. |
| **ID impact** | None vs upstream; Node ? `''`. |
| **Status** | **APPROVED** (ADR-046) |

---

## D-039 ? `vendorFlavors` is allowlisted presence names only

| | |
|---|---|
| **Decision** | Probe fixed window keys; keep only truthy object values; return sorted key names. Never invoke vendor extension APIs. Missing window ? `[]`. |
| **Rationale** | Step 36 / upstream v5.3.0; separates same-engine browser flavors without side effects. |
| **ID impact** | None vs upstream; Node ? `[]`. |
| **Status** | **APPROVED** (ADR-047) |

---

## D-040 ? `cookiesEnabled` uses temp SameSite=Strict cookietest

| | |
|---|---|
| **Decision** | Write/read/expire `cookietest=1; SameSite=Strict;`. Do not trust `navigator.cookieEnabled`. SecurityError ? `false`. Cleanup in `finally`. |
| **Rationale** | Step 37 / upstream v5.3.0 (+ cleanup hardening). First-party capability only; temporary side effect documented. |
| **ID impact** | None vs upstream success/failure boolean; Node ? `false`. |
| **Status** | **APPROVED** (ADR-048) |

---

## D-041 ? `colorGamut` is widest-first matchMedia; else undefined

| | |
|---|---|
| **Decision** | Probe `(color-gamut: rec2020)`, then `p3`, then `srgb`. Return first match or `undefined`. Never invent `srgb` when matchMedia is absent. |
| **Rationale** | Step 38 / upstream v5.3.0; wider gamuts subsume narrower. |
| **ID impact** | None vs upstream; Node ? `undefined`. |
| **Status** | **APPROVED** (ADR-049) |

---

## D-042 ? `invertedColors` is tri-state boolean | undefined

| | |
|---|---|
| **Decision** | `(inverted-colors: inverted)` ? `true`; `(inverted-colors: none)` ? `false`; neither / no matchMedia ? `undefined`. Never invent `false` for unsupported. |
| **Rationale** | Step 39 / upstream v5.3.0. |
| **ID impact** | None vs upstream; Node ? `undefined`. |
| **Status** | **APPROVED** (ADR-050) |

---

## D-043 ? `forcedColors` is tri-state boolean | undefined

| | |
|---|---|
| **Decision** | `(forced-colors: active)` ? `true`; `(forced-colors: none)` ? `false`; neither / no matchMedia ? `undefined`. Never invent `false` for unsupported. |
| **Rationale** | Step 40 / upstream v5.3.0; covers Windows High Contrast. |
| **ID impact** | None vs upstream; Node ? `undefined`. |
| **Status** | **APPROVED** (ADR-051) |

---

## D-044 ? `monochrome` is bounded depth search; unsupported ? undefined

| | |
|---|---|
| **Decision** | Gate on `(min-monochrome: 0)`; return first matching `(max-monochrome: 0..100)`. Too-high throws. Never invent `0` when unsupported. |
| **Rationale** | Step 41 / upstream v5.3.0; prevents infinite loops. |
| **ID impact** | None vs upstream; Node ? `undefined`. |
| **Status** | **APPROVED** (ADR-052) |

---

## D-045 ? `contrast` uses stable numeric preference codes

| | |
|---|---|
| **Decision** | Map `prefers-contrast` to -1/0/1/10 (`Less`/`None`/`More`/`ForcedColors`). Unsupported ? `undefined`. Accept `high`=`more` and `low`=`less`. |
| **Rationale** | Step 42 / upstream v5.3.0; keyword aliases until browsers converge. |
| **ID impact** | None vs upstream; Node ? `undefined`. |
| **Status** | **APPROVED** (ADR-053) |

---

## D-046 ? `reducedMotion` is tri-state boolean | undefined

| | |
|---|---|
| **Decision** | `(prefers-reduced-motion: reduce)` ? `true`; `no-preference` ? `false`; neither / no matchMedia ? `undefined`. Never invent `false` for unsupported. |
| **Rationale** | Step 43 / upstream v5.3.0. |
| **ID impact** | None vs upstream; Node ? `undefined`. |
| **Status** | **APPROVED** (ADR-054) |

---

## D-047 ? `reducedTransparency` is tri-state boolean | undefined

| | |
|---|---|
| **Decision** | `(prefers-reduced-transparency: reduce)` ? `true`; `no-preference` ? `false`; neither / no matchMedia ? `undefined`. Never invent `false` for older/unsupported browsers. |
| **Rationale** | Step 44 / upstream v5.3.0. |
| **ID impact** | None vs upstream; Node ? `undefined`. |
| **Status** | **APPROVED** (ADR-055) |

---

## D-048 ? `hdr` is tri-state boolean | undefined

| | |
|---|---|
| **Decision** | `(dynamic-range: high)` ? `true`; `standard` ? `false`; neither / no matchMedia ? `undefined`. Never invent SDR/`false` for unsupported. |
| **Rationale** | Step 45 / upstream v5.3.0. |
| **ID impact** | None vs upstream; Node ? `undefined`. |
| **Status** | **APPROVED** (ADR-056) |

---

## D-049 ? `math` uses locked empirical probes without pre-hash rounding

| | |
|---|---|
| **Decision** | Return named numeric samples from fixed Math inputs + polyfills. Missing natives ? `0`. Preserve -0/NaN/Infinity. Do not alter probe inputs/keys without a new algorithm revision. |
| **Rationale** | Step 46 / upstream v5.3.0; engine FP differences are the signal. |
| **ID impact** | None vs upstream when Math agrees; Node yields a full map. |
| **Status** | **APPROVED** (ADR-057) |

---

## D-050 ? `pdfViewerEnabled` is tri-state boolean | undefined (read-only)

| | |
|---|---|
| **Decision** | Return `navigator.pdfViewerEnabled` as-is. Missing property / Node ? `undefined`. Never coerce unsupported to `false`. Never open PDFs. |
| **Rationale** | Step 47 / upstream v5.3.0. |
| **ID impact** | None vs upstream; Node ? `undefined`. |
| **Status** | **APPROVED** (ADR-058) |

---

## D-051 ? `architecture` is NaN byte clue only (not a CPU ID)

| | |
|---|---|
| **Decision** | Return `u8[3]` after Float32 `8 - 8`. Expected live values `127` \| `255`. Missing typed arrays ? `undefined`. Never invent CPU architecture strings. |
| **Rationale** | Step 48 / upstream v5.3.0; coarse ISA clue only. |
| **ID impact** | None vs upstream when typed arrays exist; `undefined` path is a documented unsupported extension. |
| **Status** | **APPROVED** (ADR-059) |

---

## D-052 ? `privateClickMeasurement` is optional string from unattached anchor

| | |
|---|---|
| **Decision** | Read `attributionSourceId ?? attributionsourceid` on an unattached `<a>`. Final `undefined` ? unsupported; else `String(value)` (both-null ? `"null"`; single null falls through `??`). No DOM append, click, navigation, or network. |
| **Rationale** | Step 49 / upstream v5.3.0; desktop Safari vs iOS differ; Chromium absent. |
| **ID impact** | None vs upstream; Node / Chromium ? `undefined`. Live Safari macOS/iOS e2e deferred to step 57 coverage. |
| **Status** | **APPROVED** (ADR-060) |

---

## D-053 ? `audioBaseLatency` platform-gated with special codes; context closed

| | |
|---|---|
| **Decision** | Enable only when `isAndroid() \|\| isWebKit()`. Codes: NotSupported=-1, Disabled=-2, NotFinite=-3. Nullish ? -1; non-finite ? -3. Always `close()` after read (hygiene; not in upstream). |
| **Rationale** | Step 50 / upstream v5.3.0; avoid Chrome/Firefox console warnings. |
| **ID impact** | None vs upstream on allow-listed platforms when latency agrees; desktop Chromium ? `-2`. |
| **Status** | **APPROVED** (ADR-061) |

---

## D-054 ? `dateTimeLocale` is default Intl locale or status -1/-2/-3

| | |
|---|---|
| **Decision** | Return `DateTimeFormat().resolvedOptions().locale`. Missing Intl ? `-1`; missing DateTimeFormat ? `-2`; null/undefined locale ? `-3`; empty string kept. Prefer `window.Intl`, else global `Intl` (Node/SSR). Never force Iran/Jalali defaults. |
| **Rationale** | Step 51 / upstream v5.3.0; Iran locales are compatibility test inputs only. |
| **ID impact** | None vs upstream in browsers; Node uses global Intl instead of inventing `-1` when Intl exists. |
| **Status** | **APPROVED** (ADR-062) |

---

## D-055 ? `webGlBasics` uses shared cache; special statuses; Gecko masks unmasked GPU

| | |
|---|---|
| **Decision** | Cache GL context on `cache.webgl`. No context ? `-1`; non-function `getParameter` ? `-2`. Skip `WEBGL_debug_renderer_info` on Gecko. Provide `disposeWebGlCache` for cleanup. |
| **Rationale** | Step 52 / upstream v5.3.0. |
| **ID impact** | None vs upstream when GL available; Node ? `-1`. |
| **Status** | **APPROVED** (ADR-063) |

---

## D-056 ? `webGlExtensions` allowlisted params; sorted arrays; warning skips

| | |
|---|---|
| **Decision** | Collect contextAttributes, allowlisted parameters, shaderPrecisions, extensions, extensionParameters, unsupportedExtensions. Sort `parameters` and `extensionParameters`. Skip debug-renderer on Gecko and polygon-mode on Chromium/WebKit. Shared cache + statuses with basics. Completes 41-source Default-profile. |
| **Rationale** | Step 53 / upstream v5.3.0. |
| **ID impact** | None vs upstream when GL available; Node ? `-1`. |
| **Status** | **APPROVED** (ADR-064) |

---

## D-057 ? Extension/filtering API is additive by default; applePay rejected

| | |
|---|---|
| **Decision** | Expose `hashComponents`, `componentsToDebugString`, `omitComponents`, `extendComponents`, `withComponent`, `mergeBuiltinSources`, plus `LoadOptions.excludeSources` / `customSources` / `overwriteBuiltins`. Collisions do **not** override built-ins unless overwrite is explicit. Custom registration of `applePay` throws. Canonical serialization / MurmurHash3 unchanged. Playground RTL+LTR fixture is first-party only. |
| **Rationale** | Step 54 / upstream-compatible public helpers without Default-profile silent mutation. |
| **ID impact** | None for default 41-source `load()` path; custom/excluded maps produce intentionally different visitorIds. |
| **Status** | **APPROVED** (ADR-065) |

---

## D-058 ? Live playground is local-only, consent-gated, display digits do not mutate hashes

| | |
|---|---|
| **Decision** | Interactive Vite playground on loopback only. Consent required before collect. Fresh independent `load()`/`get()` per run; comparison view for repeat runs. Copy JSON is explicit user action. No automatic upload/telemetry. Persian digit formatting is UI-only; visitorId hex remains Latin for hashing/display canonical form. |
| **Rationale** | Step 55 Self-hosted diagnostics without claiming IP/nationality/device identity. |
| **ID impact** | None ? playground is a consumer of the SDK, not part of the hash algorithm. |
| **Status** | **APPROVED** (ADR-066) |

---

## D-059 ? Publish formats are first-party offline bundles; sourcemaps optional at runtime

| | |
|---|---|
| **Decision** | Ship ESM/CJS/IIFE/UMD (readable + min where applicable) via Rollup atop modular `tsc` output. IIFE/UMD inline `@night-watch/core` for script-tag self-host. npm ESM/CJS keep `@night-watch/core` external. `sideEffects: false`, dual `exports`, `.d.ts` from tsc. Sourcemaps published; not required to execute. No CDN/runtime network in artifacts; no `applePay`. Global `NightWatch`. |
| **Rationale** | Step 56 / upstream-like distribution adapted to Self-hosted offline + CSP without unsafe-eval. |
| **ID impact** | None ? packaging only. |
| **Status** | **APPROVED** (ADR-067) |

---

## D-060 ? Multi-browser matrix via Playwright; real devices stay NOT RUN until hardware

| | |
|---|---|
| **Decision** | Automate Desktop Chromium (full), Firefox, WebKit, and chromium-incognito projects. Matrix specs cover CSP, sandbox, storage/WebGL/audio denial, locale/timezone fixtures. Manual Iran-priority devices (Android Chrome/WebView, Samsung Internet, iOS Safari, Brave, Edge) documented as **NOT RUN** ? never claimed PASS. |
| **Rationale** | Step 57 / `13_IRAN_VALIDATION_MATRIX.md` honesty rules. |
| **ID impact** | None ? test harness only. |
| **Status** | **APPROVED** (ADR-068) |

---

## D-061 ? Differential parity is 41-source + filtered-hash only

| | |
|---|---|
| **Decision** | Compare default-profile components to pinned upstream v5.3.0 after omitting `applePay` in the harness. Report `N/41` source parity and filtered-hash equality separately. Do **not** assert raw upstream `visitorId` equality. Consented local samples only; emit `reference/upstream-diff-report.*`. |
| **Rationale** | Step 58 / D-002. |
| **ID impact** | None when components match; intentional divergence when `applePay` remains in upstream hash input. |
| **Status** | **APPROVED** (ADR-069) |

---

## D-062 ? Perf/entropy reports use observed numerators only

| | |
|---|---|
| **Decision** | Publish consented lab measurements (p50/p95/p99, per-source cost, rebuild stability, mode compare, collision pairs, gzip sizes) in `reference/perf-entropy-report.*`. Never invent absolute SLAs, worldwide uniqueness, or regional stability accuracy. RTL-only direction must not alter `visitorId`. |
| **Rationale** | Step 59 / `04_TEST_MATRIX.md` / Iran validation matrix. |
| **ID impact** | None. |
| **Status** | **APPROVED** (ADR-070) |

---

## D-063 ? CI pins Actions by SHA; static guard blocks payment source

| | |
|---|---|
| **Decision** | GitHub Actions use full commit SHA pins and read-only permissions. `ci:guard` fails the build if production sources/bundles introduce Apple Pay collectors/APIs or register `applePay` in `ENABLED_SOURCES`. Exclusion constants / `ApplePayError` engine probe remain allowed. Prod `pnpm audit` is a hard gate; CycloneDX SBOM is generated locally. |
| **Rationale** | Step 60 / Self-hosted acceptance (payment source must not re-enter). |
| **ID impact** | None. |
| **Status** | **APPROVED** (ADR-071) |

---

## D-064 ? MIT NOTICE + independent trademark; docs are not compliance

| | |
|---|---|
| **Decision** | Publish MIT `LICENSE` for this repo and `NOTICE` preserving FingerprintJS OSS v5.3.0 MIT attribution where algorithms were adapted. Keep `@night-watch/*` / `IBF` naming (not `@fingerprintjs`). Ship API/migration/privacy/build docs and typechecked examples without CDN hotlinks. Privacy guidance does not claim automatic legal compliance. |
| **Rationale** | Step 61 / D-004. |
| **ID impact** | None. |
| **Status** | **APPROVED** (ADR-072) |

---

## D-065 ? RC 1.0.0; publish only with human authorization

| | |
|---|---|
| **Decision** | Cut release candidate **1.0.0** with changelog, tag plan (`v1.0.0`), checklist, rollback, and `ci:release-gate`. npm dist-tag for RC is `next`. Do not push tags or publish packages unless explicitly authorized. |
| **Rationale** | Step 62. |
| **ID impact** | None (`default-profile-v1` unchanged). |
| **Status** | **APPROVED** (ADR-073) |

---

## D-066 ? Opt-in collection policy; default load unchanged

| | |
|---|---|
| **Decision** | Add `loadWithCollectionPolicy` behind an explicit opt-in. Denied/withdrawn consent throws before collectors start. Category/source omissions use `excludeSources`. Default `load()` remains full default-profile. No region/nationality classification via policy. |
| **Rationale** | Step 63 optional enhancement. |
| **ID impact** | None for default path; policy omissions intentionally change visitorId vs full 41-source set. |
| **Status** | **APPROVED** (ADR-074) |

---

## D-067 ? Opt-in namespaced IDs; not upstream compatible

| | |
|---|---|
| **Decision** | Add `night-watch-namespaced-v1` salted/namespaced derivation behind `loadWithIdentityScope` / `hashComponentsNamespaced`. Default unsalted visitorId unchanged. Disclose `upstreamCompatible: false`. No SDK-side persistence or exfiltration of salt. |
| **Rationale** | Step 64 optional enhancement. |
| **ID impact** | None for default path; namespaced IDs differ by design. |
| **Status** | **APPROVED** (ADR-075) |

---

## D-068 ? Opt-in reliability profiles; default load unchanged

| | |
|---|---|
| **Decision** | Add `night-watch-reliability-profiles-v1` with `conservative` / `balanced` / `diagnostic` behind `loadWithReliabilityProfile`. Default `load()` unchanged. Tiers are heuristics. Exclusions via `excludeSources`. |
| **Rationale** | Step 65 optional enhancement. |
| **ID impact** | None for default path; non-diagnostic profiles differ by design. `diagnostic` matches default selectors. |
| **Status** | **APPROVED** (ADR-076) |

---

## D-069 ? Opt-in custom plugin SDK; default load unchanged

| | |
|---|---|
| **Decision** | Add `night-watch-plugin-sdk-v1` behind `loadWithPlugins` with namespaced keys (`ext:`), dependency ordering, timeout budgets, cleanup, JSON-safe results, and explicit `PluginPolicy`. Sample Persian font probe is opt-in only. Default `load()` / 41-source registry unchanged. Forbid `applePay`. |
| **Rationale** | Step 66 optional enhancement. |
| **ID impact** | None for default path; any registered plugin key changes visitorId by design. |
| **Status** | **APPROVED** (ADR-077) |

---

## D-070 ? Opt-in AbortSignal / resource budgets; default load unchanged

| | |
|---|---|
| **Decision** | Add `night-watch-resource-budgets-v1` behind `loadWithResourceBudget` with AbortSignal, totalTimeoutMs, perSourceTimeoutMs, optional idle scheduling, and timer cleanup. Abort/timeout ? error components (never fake success). Optional `BuiltinSourceOptions.signal` for cooperative iframe abort. Default `load()` unchanged. |
| **Rationale** | Step 67 optional enhancement. |
| **ID impact** | None for default path; timeout/abort error components change visitorId vs fully successful runs. |
| **Status** | **APPROVED** (ADR-078) |

---

## D-071 ? Opt-in diagnostics snapshots; local export only; default load unchanged

| | |
|---|---|
| **Decision** | Add `night-watch-diagnostics-v1` / `night-watch-diagnostics-snapshot-v1` behind `exportDiagnosticSnapshot` / `loadWithDiagnostics`. Schema validation, repro seed hash, page-context + error redaction. Explicit export only; no SDK network upload. Reject `applePay` in snapshots. Default `load()` unchanged. |
| **Rationale** | Step 68 optional enhancement. |
| **ID impact** | None ? diagnostics do not alter visitorId algorithms. |
| **Status** | **APPROVED** (ADR-079) |

---

## D-072 ? Opt-in change inspector; probabilistic hints only; default load unchanged

| | |
|---|---|
| **Decision** | Add `night-watch-change-inspector-v1` behind `inspectFingerprintChange` / `formatFingerprintChangeReport` / `inspectFingerprintRebuild`. Stable-sorted local diffs with instability hints and a fixed no-identity-guarantee disclaimer. Privacy-safe previews. Never list `applePay`. Default `load()` unchanged. |
| **Rationale** | Step 69 optional enhancement. |
| **ID impact** | None ? inspector does not alter visitorId algorithms. |
| **Status** | **APPROVED** (ADR-080) |

---

## D-073 ? Opt-in entropy experiment harness; default load unchanged

| | |
|---|---|
| **Decision** | Add `night-watch-entropy-experiments-v1` consent-gated in-memory harness with within/across aggregates and deletion controls. No network upload. Default `load()` unchanged. |
| **Status** | **APPROVED** (ADR-081) |

---

## D-074 ? Server integration design only; no runtime client

| | |
|---|---|
| **Decision** | Publish first-party server integration design constant/docs only. Browser SDK stays standalone with no cloud endpoint. |
| **Status** | **APPROVED** (ADR-082) |

---

## D-075 ? Hash-neutral source metadata registry

| | |
|---|---|
| **Decision** | Add `night-watch-source-metadata-v1` for 41 sources (privacy/stability/cost/deps). Does not change `SOURCE_MANIFEST_REVISION` / visitorId. No applePay. |
| **Status** | **APPROVED** (ADR-083) |

---

## D-076 ? Supply-chain reproducibility / offline distribution tooling

| | |
|---|---|
| **Decision** | Add `ci:lockfile`, `ci:vendor-audit`, and offline/supply-chain docs. No runtime telemetry. |
| **Status** | **APPROVED** (ADR-084) |

---

## Open items

- `LoadOptions.monitoring` retained as optional boolean; default false / no vendor beacon ? locked in D-003 + ADR-012.
- Confidence comment locked via ADR-020 / D-005 (honest heuristic disclaimer).
- Optional Persian font pack (D-017) if product requests it later ? sample probe plugin exists as opt-in only (D-069).
- Steps **01?73** complete (optional enhancement track finished).
- Real-device Iran matrix rows remain NOT RUN until hardware/cloud is available.
- Remote GitHub Actions / npm publish await explicit authorization (**NOT RUN**).
