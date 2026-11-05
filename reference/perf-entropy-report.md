# Performance, stability & entropy evaluation

Generated: `2026-11-03T18:38:46.453Z`
Consented local sample: **yes**

## Environment

| Field | Value |
|---|---|
| Browser | chromium |
| Device class | desktop-playwright |
| Headless | true |
| Locale | en-US |
| Timezone | (default) |
| Viewport | 1280×720 |
| UA | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.8078.4 Safari/537.36` |

## Algorithm

- Manifest: `default-profile-v1` (41 sources)
- SDK version field: `1.0.0`

## Wall-clock collection (`load` delayFallback=0 + `get`)

n=10 · min=45.3 · p50=58.2 · p95=245.3 · p99=245.3 · max=245.3 · mean=75.0 (ms)

Relative expensive flag: mean > 3× max(1ms noise floor, median of source means) (profiling hint only — not an SLA).

## Per-source cost (top by mean)

| Source | n | mean | p50 | p95 | p99 | expensive? |
|---|---:|---:|---:|---:|---:|:---:|
| `fonts` | 10 | 37.9 | 26.0 | 142.0 | 142.0 | yes |
| `webGlExtensions` | 10 | 24.7 | 23.0 | 31.0 | 31.0 | yes |
| `fontPreferences` | 10 | 21.6 | 20.0 | 28.0 | 28.0 | yes |
| `userAgentData` | 10 | 18.4 | 17.0 | 24.0 | 24.0 | yes |
| `domBlockers` | 10 | 13.9 | 12.0 | 20.0 | 20.0 | yes |
| `webGlBasics` | 10 | 6.00 | 6.00 | 9.00 | 9.00 | yes |
| `canvas` | 10 | 4.40 | 3.00 | 17.0 | 17.0 | yes |
| `audio` | 10 | 2.50 | 2.00 | 3.00 | 3.00 |  |
| `timezone` | 10 | 1.20 | 0.00 | 10.0 | 10.0 |  |
| `screenFrame` | 10 | 0.30 | 0.00 | 1.00 | 1.00 |  |
| `audioBaseLatency` | 10 | 0.20 | 0.00 | 1.00 | 1.00 |  |
| `dateTimeLocale` | 10 | 0.20 | 0.00 | 1.00 | 1.00 |  |
| `languages` | 10 | 0.10 | 0.00 | 1.00 | 1.00 |  |
| `sessionStorage` | 10 | 0.10 | 0.00 | 1.00 | 1.00 |  |
| `localStorage` | 10 | 0.10 | 0.00 | 1.00 | 1.00 |  |
| … | 26 more | | | | | |

## Stability

- **document-rebuild×20**: unique=1/20; majority share=100.0% (`49bc8976ca499c1d9df8e61f4583e4f2`)
  - Each sample is a fresh setContent + IIFE inject + load/get (reload-equivalent profile).
  - Not a claim of cross-device or post-browser-restart stability.

## Mode comparisons

- ltr+en-US vs rtl+en-US: visitorId equal=true
  - Same locale/timezone; only html dir differs — visitorId must not change solely due to RTL.
- ltr+en-US vs rtl+fa-IR+Asia/Tehran: visitorId equal=false
  - Locale/timezone fixtures may legitimately change languages/timezone sources; not an RTL defect.
- default-context vs ephemeral-context: visitorId equal=true
  - Same engine/profile class; storage isolation should not alter default-profile visitorId when signals are environment-stable.

## Collision / uniqueness (consented cohorts)

Ratios are **local sample statistics only** — not calibrated worldwide uniqueness or FPR.

- **same-profile micro+reloads**: unique=1/30 (ratio=0.033); approx collision pairs=435
  - Local Playwright Chromium cohort only; not a worldwide collision rate.
- **lab locale/timezone variants**: unique=4/6 (ratio=0.667); approx collision pairs=3
  - Synthetic lab diversity (locale/tz). Numerators/denominators only — no uniqueness claim.

## Bundle sizes (published artifacts)

| Artifact | uncompressed | gzip |
|---|---:|---:|
| `fp.min.js` | 63285 | 23317 |
| `fp.umd.min.js` | 63478 | 23387 |
| `fp.esm.min.js` | 42166 | 16740 |
| `fp.min.cjs` | 46952 | 16823 |

## DOM cleanup snapshot

nodes before=8, after=8, delta=0
- Node count includes consent DOM; collectors should not leave unbounded detached trees.
- WebGL cache / AudioContext close are source-owned (disposeWebGlCache / closeAudioContext).

## Operational notes

- Wall-clock sample size=10; delayFallback=0 (idle scheduling skipped for microbench).
- Stability rebuilds=20.
- Enabled sources locked at 41 (default-profile-v1); applePay absent.
- Budgets are observed baselines (p50/p95/p99), not invented absolute SLAs.
- No network egress expected; scripts are self-hosted IIFE only.

## NOT RUN

- Real mid-range / low-memory Chrome for Android hardware (CPU/memory) — emulator/device required
- Real Android System WebView / Samsung Internet / iOS Safari hardware
- Browser restart persistence across OS sessions
- Main-thread long-task attribution via PerformanceObserver in production pages
- Multi-thousand consented production entropy dataset

