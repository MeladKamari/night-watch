# STEP 135 — Close remaining quality gap (identity-v4)

**Date:** 2026-11-05

## Shipped
- Tenant-local device population baseline → `rare_device_detection` real rarity
- Identify confidence `holdout_backed` when feedback model active (never fake calibrated ML)
- Consented proximity (impossible travel / location jump)
- MITM from edge TLS headers / probe
- Expanded `offline_feed_v1` feed (operators, cities, VPN/Tor/DC/abuse density)
- Incognito weak signal from storage quota
- Algorithm → `identity-v4` / `processing-v4`

## Still out of scope (honest)
- Fingerprint global SaaS population / live crawl
- Native mobile SDK
- Claiming production-calibrated ML without customer labeled data

## Verify
```bash
dotnet test server/NightWatch.sln -c Release --filter "FullyQualifiedName~GapClosureV4Tests|FullyQualifiedName~IdentityStabilityTests|FullyQualifiedName~Closure100WaveTests|FullyQualifiedName~BeatProWaveTests"
```

## Live smoke (API :5080)
- `/v1/lab/network/lookup` → `asn:197207` = `ir_operator`
- `/v1/decisions/evaluate` with `proximityConsent` + distance → proximity points
- local population warm → `rare_device_detection` points
- calibration activate + continuity identify → `confidenceStatus=holdout_backed`, `identity-v4`

