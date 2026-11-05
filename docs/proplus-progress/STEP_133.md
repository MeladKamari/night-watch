# STEP 133 — Identity stability: durable vectors + continuity + heuristic confidence

**Date:** 2026-11-05

## Shipped
- Algorithm bump → `night-watch-identity-v2` / `processing-v2`
- `IDeviceVectorStore` + EF dual-write/hydrate (`visitor_device_vectors`)
- Continuity token issue/renew via first-party cookie service; identify accepts body / `X-Continuity-Token` / cookie
- Continuity rematch: new legacy hash + valid continuity → same `visitorId` (`matched`)
- Candidate retrieval wired into identify (continuity + block keys)
- Heuristic confidence (`confidenceStatus=heuristic`) — never claims calibrated ML
- Playground persists continuity token in `localStorage`

## Verify
```bash
dotnet test server/NightWatch.sln -c Release --filter FullyQualifiedName~IdentityStabilityTests
dotnet test server/NightWatch.sln -c Release --filter FullyQualifiedName~IdentifyApiTests
```
