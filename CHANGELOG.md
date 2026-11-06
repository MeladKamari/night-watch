# Changelog

All notable changes to Night Watch (`@thenightwatch/*` and the API) are documented here.
Algorithm breaks that change `visitorId` for the same environment must bump
`SOURCE_MANIFEST_REVISION` and be called out explicitly.

Format inspired by [Keep a Changelog](https://keepachangelog.com/).

## [1.0.0] � 2026-11-05

First stable public release of **Night Watch** as one product (browser + server).

### Added

- Brand kit under `branding/` (hero, icons, palette) used by README, packages, playground, and console.
- Framework bindings: `@thenightwatch/vanilla`, `react`, `vue`, `angular`, `preact`, `blazor` (+ `NightWatch.Blazor` C# interop).
- Night Watch API (`identity-v4`): identify, smart signals, decisions, offline ASN feeds, management APIs.
- Admin console + playground themed to Night Watch.

### Changed

- Product rename: IBF / Pro+ ? **Night Watch** (`@thenightwatch/*`, IIFE `NightWatch`, `productCode: night-watch`).
- Source manifest label: `default-v1` (41 sources; `applePay` excluded).
- All publishable packages aligned to **1.0.0** with `publishConfig.access: public` and tag `latest`.
- `pro-*` packages promoted from restricted alpha to public 1.0.0.

### Security

- MIT license + upstream FingerprintJS OSS v5.3.0 attribution in `NOTICE`.
- No automatic third-party network egress during browser `get()`.
- Confidence remains heuristic / holdout-backed � not claimed as production-calibrated ML.

### Intentional deviations from FingerprintJS OSS v5.3.0

- Excludes payment API-state source `applePay`.
- `monitoring` defaults to false and never contacts vendor telemetry.
- Independent branding � not an official Fingerprint product.

## [0.1.0-rc.1] � 2026-11-03

Release candidate cut (pre�Night Watch final naming in places). See git history for RC notes.

## [0.0.0] � development

Pre-RC workspace snapshots.
