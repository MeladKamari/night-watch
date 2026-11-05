# STEP 018 — Edge-aware IP and TLS signal adapter

**Date:** 2026-11-04  
**Status:** Edge adapter **IMPLEMENTED**; unit matrix **VALIDATED** (4/4).

## Deliverables

- `IEdgeConnectionAdapter` / `EdgeConnectionAdapter` — trusted-CIDR proxy hops only; ignore spoofed XFF from untrusted peers
- IPv4-mapped IPv6 normalization; Forwarded / X-Forwarded-For left-most when hop trusted
- Coarse TLS/HTTP evidence cells (`Known` / `Unknown` / `Unavailable`); `RetainedPacketPayload = false`
- `Evidence.Unknown<T>` / `Unavailable<T>` typed helpers
- DI: `AddProPlusEdgeAdapter()`; `TrustedProxyOptions` CIDR allowlist
- `EdgeConnectionAdapterTests` — spoof ignore, trusted normalize, missing→unknown, CIDR helpers

## Commands

```
dotnet test server/NightWatch.sln -c Release --filter FullyQualifiedName~EdgeConnectionAdapterTests
```

**Passed: 4**

## Limitations

- TLS protocol depends on ingress exposing negotiated ALPN/version; otherwise `Unknown` (not fabricated).
- No licensed IP-intel / ASN enrichment in this step.
- Adapter registered; ingest endpoint does not yet attach edge metadata to accepted observations (pipeline step).

## Next

STEP 019 — Event enrichment pipeline and durability.
