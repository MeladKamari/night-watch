# Night Watch — additive compatibility guidelines

**Product:** Night Watch (`@thenightwatch/*`)  
**Legacy SDK:** `@thenightwatch/core` + `@thenightwatch/browser-sdk` (`default-v1`)

## Rules

1. **Additive only.** ProPlus packages must not change default `load()` / `get()` / `hashComponents` behavior.
2. **Two identity planes.** Keep legacy browser `visitorId` and server `visitorId` separate fields forever; never overwrite one with the other.
3. **Algorithm versions.**
   - Legacy: `SOURCE_MANIFEST_REVISION = default-v1`, `hashingRevision = murmur3-x64-128-canonical-v1`
   - ProPlus server identity: `IDENTITY_ALGORITHM_VERSION = night-watch-identity-v0`
4. **Namespace.** Use `@thenightwatch/*` and product label `Night Watch (independent)`. Do not use Fingerprint / FingerprintJS Pro branding in endpoints, package names, or UI copy.
5. **No Apple Pay.** Reject any path that registers or serializes `applePay`.
6. **Evidence honesty.** Prefer `unknown` / `unsupported` / `unavailable` / `not_applicable` over false booleans.
7. **First-party network only.** Server and dashboard clients must refuse vendor SaaS hosts.
8. **Import direction.** `@thenightwatch/browser-adapter` → `@thenightwatch/browser-sdk`. Legacy packages must not depend on `@thenightwatch/*`.

## Package map

| Package | Role |
|---|---|
| `@thenightwatch/contracts` | Shared DTOs, evidence cells, product/identity versions |
| `@thenightwatch/browser-adapter` | Wrap legacy `GetResult` → `ObservationEnvelope` |
| `@thenightwatch/server-sdk` | First-party `/v1` TypeScript client skeleton |
| `@thenightwatch/dashboard-client` | Authenticated management client skeleton |

## Migration for app authors

```ts
import { load } from '@thenightwatch/browser-sdk'
import { adaptGetResultToObservation } from '@thenightwatch/browser-adapter'

const agent = await load({ monitoring: false })
const result = await agent.get()
// result.visitorId unchanged vs pre-ProPlus installs
const observation = adaptGetResultToObservation(result, {
  purpose: 'fraud_prevention',
  consentStatus: 'granted',
})
```
