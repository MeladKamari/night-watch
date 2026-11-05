# Browser Coverage & Iran Validation Results

**Step:** 59 · **Updated:** 2026-11-03  
**Statuses:** `PASS` \| `FAIL` \| `NOT RUN` — never fabricate results.  
Browser sample demographics are **unknown** until real opt-in telemetry exists.

## Automated Playwright matrix (this host)

| Project | Engine | Specs | Status | Notes |
|---|---|---|---|---|
| `chromium` | Desktop Chrome | Full `tests/e2e` | **PASS** | Headless software GL possible |
| `firefox` | Desktop Firefox | Matrix + smoke/integration subset | **PASS** | Installed via `playwright install firefox` |
| `webkit` | Desktop Safari (Playwright) | Matrix + smoke/integration subset | **PASS** | Not a substitute for real iOS Safari |
| `chromium-incognito` | Desktop Chrome | `browser-matrix` only | **PASS** | Ephemeral contexts; no shared `storageState` |

### Matrix scenarios (`tests/e2e/browser-matrix.spec.ts`)

| Scenario | Status |
|---|---|
| 41-source collect, no `applePay`, no network egress | **PASS** (all matrix projects) |
| CSP without `unsafe-eval` | **PASS** |
| iframe sandbox storage isolation | **PASS** |
| Storage blocked (SecurityError getters) | **PASS** |
| WebGL disabled (Chromium `--disable-webgl`) | **PASS** (Chromium); skipped on Firefox/WebKit |
| Audio API denied | **PASS** |
| Independent contexts (incognito-like) | **PASS** |
| `fa-IR` + `Asia/Tehran` fixtures | **PASS** (locale/timezone, not identity) |

## Manual / real-device matrix (Self-hosted priorities)

| Target | Tier | Status | Evidence |
|---|---|---|---|
| Chromium Stable on Windows 10/11 | P0 | **PASS** | Playwright Desktop Chrome |
| Firefox Windows | P0 | **PASS** | Playwright Desktop Firefox |
| Edge on Windows | P0 | **NOT RUN** | Optional `channel: 'msedge'` not wired |
| Chrome for Android | P0 | **NOT RUN** | Needs real device / emulator |
| Android System WebView | P0 | **NOT RUN** | Needs Android fixture |
| Samsung Internet | P1 | **NOT RUN** | Real Android |
| Safari iOS / macOS hardware | P1 | **NOT RUN** | WebKit project ≠ iOS Safari |
| Brave regular/strict | P1 | **NOT RUN** | Manual privacy modes |
| Embedded WebViews (app) | P0 | **NOT RUN** | App integration fixture |

## Locale / network checks (from `13_IRAN_VALIDATION_MATRIX.md`)

| Case | Status |
|---|---|
| `fa-IR` + RTL surrounding in playground | **PASS** |
| `Asia/Tehran` timezone context | **PASS** |
| First-party IIFE, zero third-party egress during collect | **PASS** |
| CSP without unsafe-eval | **PASS** |
| Excluded payment source absent | **PASS** |
| Offline pnpm / checksum packaging | **NOT RUN** (step 73) |
| Perf/entropy lab report (Chromium) | **PASS** — `reference/perf-entropy-report.md` |
| Perf mid/low-end Android hardware | **NOT RUN** (emulated Pixel+CPU throttle only) |
| Perf browser-restart / production entropy dataset | **NOT RUN** |

## Commands

```bash
pnpm exec playwright install chromium firefox webkit
pnpm test:e2e
pnpm test:e2e:matrix
pnpm test:e2e:chromium
```
