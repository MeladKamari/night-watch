# Privacy-preserving configurable IDs (step 64)

**Optional enhancement** — not FingerprintJS OSS compatible and **not** the default
`visitorId` from `load()` / `hashComponents()`.

## Goals

- First-party **namespace** + optional **salt** + optional **domain** separation.
- Stable within a configured scope; different scopes → different IDs for the same browser entropy.
- No hidden persistent identifier written by the SDK.
- No third-party exfiltration of salt/namespace.

## API

```ts
import {
  load,
  loadWithIdentityScope,
  applyIdentityScope,
  hashComponentsNamespaced,
  deriveVisitorIds,
} from '@night-watch/browser-sdk'

// Default — unsalted default-profile hash (unchanged)
const agent = await load({ monitoring: false })
const baseline = await agent.get()

// Opt-in namespaced derivation
const { agent: scoped } = await loadWithIdentityScope({
  monitoring: false,
  identity: {
    namespace: 'checkout-service',
    salt: process.env.NIGHT_WATCH_ID_SALT, // held by first party — never logged by SDK
    domain: 'shop.example', // app-supplied label; not auto-read from location
  },
})
const result = await scoped.get()
// result.visitorId          → namespaced
// result.baselineVisitorId  → same as default hashComponents
// result.identity.upstreamCompatible → false
```

Or post-process any `GetResult`:

```ts
const namespaced = applyIdentityScope(baseline, { namespace: 'app', salt: '…' })
```

## Compatibility disclosure

| ID | Compatible with |
|---|---|
| `load().get().visitorId` / `hashComponents` | default-profile `@ibf` / filtered upstream comparisons |
| `hashComponentsNamespaced` / `loadWithIdentityScope` | **Only** the same `IdentityScope` (namespace/salt/domain) |

Do **not** claim bit-for-bit equality with FingerprintJS OSS visitorIds when using
namespaced IDs.

## Salt rotation

Rotating `salt` (or changing `namespace` / `domain`) yields a new `visitorId` for
the same components. Keep the previous salt only if you must resolve legacy IDs;
the SDK does not store rotation history.

## Privacy notes

- Salt values are never returned from `identity` metadata (`hasSalt` only).
- No `localStorage` / cookie visitor key is created by this module.
- Combine with `docs/COLLECTION_POLICY.md` when consent gating is required.
