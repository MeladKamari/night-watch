# Opt-in signal reliability profiles (step 65)

**Optional enhancement** — not part of FingerprintJS OSS v5.3.0 parity.
Default `load()` / default-profile **41-source** behavior is **unchanged** unless you
call the profile API.

## Why

- Prefer more stable selectors when churn from canvas/audio/WebGL/fonts hurts
  session continuity.
- Document which sources are treated as stable / moderate / volatile.
- Keep a labeled **diagnostic** path that still collects the full 41-source set.

Tiers are **operational heuristics**, not calibrated stability rates or
uniqueness claims.

## Profiles

| Profile | Includes | VisitorId vs default `load()` |
|---|---|---|
| `conservative` | `stable` tier only | Differs (volatile + moderate omitted) |
| `balanced` | `stable` + `moderate` | Differs (volatile omitted) |
| `diagnostic` | All 41 sources | **Same selectors / same ID** as default `load()` |

Catalog revision: `night-watch-reliability-profiles-v1` (`RELIABILITY_PROFILES_REVISION`).
Independent of `SOURCE_MANIFEST_REVISION` (default algorithm unchanged).

## API

```ts
import {
  load,
  loadWithReliabilityProfile,
  getReliabilityProfileManifest,
  resolveReliabilityProfile,
  RELIABILITY_PROFILES_REVISION,
  SOURCE_RELIABILITY_TIERS,
} from '@night-watch/browser-sdk'

// Default path — unchanged
await load({ monitoring: false })

const { agent, resolution } = await loadWithReliabilityProfile({
  monitoring: false,
  profile: 'balanced', // 'conservative' | 'balanced' | 'diagnostic'
})

console.log(resolution.manifest.excludedSources)
console.log(resolution.visitorIdWillDifferFromFullDefault)
const result = await agent.get()

// Diffable / ops snapshot without collecting
const manifest = getReliabilityProfileManifest('conservative')
```

Excluded collectors use the existing `excludeSources` path and **never start**.

## VisitorId impact

Omitting any source changes the hash vs full `default-v1`. Store the
profile id / `RELIABILITY_PROFILES_REVISION` beside IDs when you rely on a
profile. `diagnostic` is for labeled debugging with the same inclusion as
default `load()`.

## Privacy reminders

- No telemetry; `monitoring` remains a no-op.
- Do not re-add `applePay`.
- Profiles do not bypass Permissions-Policy or anti-fingerprinting controls.
- Combine with `docs/COLLECTION_POLICY.md` when consent gating is required.
