# STEP 028 — Signed first-party session cookie

**Date:** 2026-11-04  
**Status:** Continuity cookie service **IMPLEMENTED**; tamper/cross-project **VALIDATED** (1/1). Cross-browser/private-mode continuity **NOT claimed**.

## Deliverables

- `IFirstPartySessionCookieService` — issue only with purpose + legal basis
- Cookie attrs: `__Host-ibf_sid`, HttpOnly, Secure, SameSite=Lax, host-only (no Domain)
- HMAC token `v1.{payload}.{sig}`; project-bound; revoke; rotate signing key
- Explicit continuity claim string: no private-mode / clear / unrelated-browser guarantee
- Separate from device authentication (`kind=continuity_not_auth`)

## Commands

```
dotnet test server/NightWatch.sln -c Release --filter FullyQualifiedName~FirstPartySessionCookieTests
```

**Passed: 1**

## Limitations

- Lab signing key default; must use secrets manager in production.
- Not yet attached to identify HTTP response Set-Cookie.

## Next

STEP 029 — (see step index).
