# STEP 009 — Cryptographic and tenant security baseline

**Status:** Key ring + envelope crypto + replay guard **IMPLEMENTED**; xUnit **VALIDATED** (TenantSecurityTests).

## Deliverables
- `server/.../Security/TenantKeyRing.cs` — tenant keys, ECDSA sign/verify, AES-GCM envelope, cross-tenant denial, log redaction
- 4 security tests passing inside `dotnet test` (14 total server tests)

## Limitations
- Full OIDC/MFA management IAM deferred to later admin steps; local key ring is the baseline.

## Next
STEP 010
