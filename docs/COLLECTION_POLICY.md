# Opt-in collection policies (step 63)

**Optional enhancement** — not part of FingerprintJS OSS v5.3.0 parity.
Default `load()` / default-profile **41-source** behavior is **unchanged** unless you
call the policy API.

## Why

- Collect only after an app-owned consent / permission signal.
- Omit sensitive or unnecessary sources by **category** (not by region).
- Honor withdrawn/denied consent by refusing to start collectors.
- Never bypass browser Permissions-Policy or anti-fingerprinting controls.

## API

```ts
import {
  load,
  loadWithCollectionPolicy,
  describePolicyImpact,
  SOURCE_CATEGORIES,
} from '@thenightwatch/browser-sdk'

// Default path — unchanged
await load({ monitoring: false })

// Opt-in policy path
const { agent, resolution } = await loadWithCollectionPolicy({
  monitoring: false,
  policy: {
    consent: {
      status: 'granted', // or 'not_required' | 'denied' | 'withdrawn'
      purpose: 'first-party abuse prevention', // disclosure metadata only
      noticeVersion: '2026-11-privacy-v3',
    },
    omitCategories: ['audio', 'rendering'],
    // omitSources: ['domBlockers'],
    // allowCategories: ['locale', 'math'],
  },
})

console.log(resolution.excludedSources, resolution.visitorIdWillDifferFromFullDefault)
const result = await agent.get()
```

| Consent status | Behavior |
|---|---|
| `granted` / `not_required` | Collectors start (minus exclusions) |
| `denied` / `withdrawn` | Throws `CollectionConsentError`; **no** collectors run |

## Categories

See `SOURCE_CATEGORIES` / `SOURCES_BY_CATEGORY`. Categories group entropy sources
for minimization. They are **not** nationality or geo classifiers. Persian /
`fa-IR` / `Asia/Tehran` remain test fixtures only.

## VisitorId impact

Excluding any source changes the hash vs full `default-v1`. Store
`noticeVersion` / policy id beside IDs. This does **not** bump
`SOURCE_MANIFEST_REVISION` (default algorithm unchanged).

Use `describePolicyImpact(policy)` before collecting to document the delta.

## Privacy reminders

- The SDK does not persist consent; your app does.
- No telemetry beacons; `monitoring` remains a no-op.
- Do not re-add `applePay`.
- Policy cannot and must not circumvent storage/WebGL/UA-CH permission denials.
