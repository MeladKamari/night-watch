# Night Watch — privacy threat model & retention (STEP 008)

## Lawful purpose (tenant-configured)

Allowed purposes are explicit strings configured per tenant/project (e.g. `fraud_prevention`, `account_security`).  
**Never** silently elevate purpose. Ingest without purpose fails when `Privacy.RequirePurposeOnIngest=true`.

Legal basis / consent status travels on each observation: `granted` | `denied` | `unknown` | `not_required`.

## Data planes (separated)

| Plane | Examples | Rules |
|---|---|---|
| Pseudonymous observation | `eventId`, legacy browser `visitorId`, server `visitorId` | Opaque; not a national ID |
| Subject links | tenant-scoped account tags | Optional; erasure cascades |
| Raw network metadata | edge IP, TLS JA3-like | Minimized, retention-limited, never in public SDK responses |

## Default suppression

Unless explicitly enabled: no page URL/title, no cookies, no contacts, no microphone/camera, no advertising IDs, no geolocation prompts, no cross-origin third-party beacons, no Apple Pay.

## Retention

- Default **90 days** (configurable 1–3650).
- Tenant overrides allowed within range.
- Erasure request removes observations, aliases, graph edges, analytics projections.

## Jurisdiction note (Iran / deployer’s law)

Operators must configure notice, purpose limitation and retention under **applicable Iranian law and any other jurisdiction where they process data**. This document is engineering design, not legal advice. Lawful testing uses consented lab fixtures only.

## Threats & mitigations

| Threat | Mitigation |
|---|---|
| Scope creep / silent tracking | Purpose + consent required; modes off by default |
| Cross-tenant leakage | `tenant_id` isolation (STEP 009+) |
| Vendor call-home | Forbidden hosts; air-gap compose |
| Over-collection | Field suppression + budgets |
| False certainty | `unknown` / `unsupported` statuses |
