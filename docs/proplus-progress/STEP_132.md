# STEP 132 — Beat-Pro wave: fuzzy identity + accuracy + network + feedback weights

**Date:** 2026-11-05

## Shipped
- Identity algorithm / processing → `night-watch-identity-v1` / `processing-v1`
- Soft fuzzy `matchInsights` on `/v1/identify` (WeightedMatcher + FeatureNormalizer); soft `share_hypothesis` graph edge only — **no auto-merge** of similar browsers
- Auto-attach observed `environmentProbes` → `smartSignals` + `scoreReceipt` on identify
- Offline ASN/VPN/Tor/proxy lab feed (`NetworkReputationBootstrap`) + enricher on decisions/identify/explain
- `GET /v1/lab/accuracy` synthetic longitudinal harness
- `POST /v1/lab/network/lookup` offline reputation probe
- `POST /v1/management/score/feedback` → transparent SuspectScore reweight (`SuspectScoreFeedbackTrainer`)
- Playground identify sends real `clientDevice` + `environmentProbes`

## Verify
```bash
dotnet test server/NightWatch.sln -c Release --filter FullyQualifiedName~BeatProWaveTests
dotnet test server/NightWatch.sln -c Release --filter FullyQualifiedName~IdentifyApiTests
```
