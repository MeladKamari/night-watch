# STEP 134 — Close Iran Pro+ technical gaps (identity-v3)

**Date:** 2026-11-05  
**Plan:** `STEP_134_PLAN.md`

## Shipped
- Offline feeds: lab + `offline_feed_v1` (VPN/Tor/proxy/DC/geo/abuse/IR operators)
- Network enricher → geo + blocklist + default not_detected when ASN known
- Event velocity counters on identify/decisions
- Probe mapper: device attrs, WebGL VM hints, anti-detect, tamper
- Smart signal evaluators no longer lazy-unavailable when data exists
- Durable visitor alias index (EF) + hydrate
- EnrichmentStatus `completed` when probes evaluated
- `POST /v1/lab/calibration/run` holdout metrics (honest: not production ML)
- Algorithm → `identity-v3` / `processing-v3`
- Accuracy harness expanded (7 scenarios)

## Still intentionally not 100% vs Fingerprint SaaS
- Global labeled population / calibrated ML
- Proximity without location consent
- Native mobile SDK
- Live foreign threat intel crawl

## Verify
```bash
dotnet test server/NightWatch.sln -c Release --filter "FullyQualifiedName~Closure100WaveTests|FullyQualifiedName~IdentityStabilityTests|FullyQualifiedName~BeatProWaveTests"
```
