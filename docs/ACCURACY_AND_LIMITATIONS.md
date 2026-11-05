# Accuracy caveats and limitations

This document is part of the product contract. It is **not** marketing copy.

## What `visitorId` represents

`visitorId` is a hash of the selected client-side components at collection time
for algorithm revision `default-v1`. It can change when:

- the browser, OS, GPU driver, fonts, or privacy settings change,
- the user switches normal ↔ private mode,
- locale / timezone / permissions change,
- anti-fingerprinting noise is applied (Safari, Firefox, Brave, …),
- you change sources, serialization, or the manifest revision.

It does **not** identify a human, nationality, ISP, or legal entity.

## Confidence score

`confidence.score` is a **platform heuristic** with an honest disclaimer comment.
It is **not**:

- a calibrated probability,
- a false-positive rate,
- proof of uniqueness worldwide.

Never invent stability %, collision rates, or FPR without a consented dataset
and documented methodology (`docs/PROGRESS.md` / perf-entropy reports show
**lab numerators only**).

## Default-profile profile ≠ geo inference

Persian/Arabic locales, RTL layout, and `Asia/Tehran` are **test fixtures and
compatibility inputs**. The SDK must not hardcode Iran-based values into the
hash path or treat language/timezone as nationality.

## Excluded payment source

The payment API-state source (`applePay`) is **not** registered. Upstream raw
visitorIds that include it will differ. Do not re-add it for “parity”.

## Threat model (short)

Any page script, extension, or automation can alter client signals. Do not use
this SDK alone for authentication or high-value authorization. See
`SECURITY.md` and `docs/PRIVACY.md`.

## Evidence, not claims

| Claim type | Status |
|---|---|
| Unit / Playwright collect on desktop engines | Documented in `docs/BROWSER_COVERAGE.md` |
| Real mid-range Android / iOS Safari hardware | Often **NOT RUN** until hardware exists |
| Worldwide uniqueness | **Not claimed** |
| Bit-for-bit equality with unmodified 42-source upstream ID | **Not claimed** (D-002) |
