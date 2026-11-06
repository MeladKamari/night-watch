# Opt-in AbortSignal and resource budgets (step 67)

**Optional enhancement** — not part of FingerprintJS OSS v5.3.0 parity.
Default `load()` behavior is **unchanged** unless you call `loadWithResourceBudget`.

## Why

- Abort in-flight collection (navigation, UI cancel, route change).
- Cap **total** wall-clock time and/or **per-source** load/get stages.
- Prefer cooperative **idle** scheduling between starting sources.
- Never invent a successful component value on timeout/abort.

## Semantics

| Event | Result |
|---|---|
| Abort before collectors start | Throws `CollectionAbortError` |
| Abort / total timeout during collection | Affected sources → **error components** |
| Per-source stage timeout | `SourceTimeoutError` on that source |
| Successful full run under a budget | Same visitorId as default for the same sources |

Catalog revision: `night-watch-resource-budgets-v1` (`RESOURCE_BUDGETS_REVISION`).
Does **not** bump `SOURCE_MANIFEST_REVISION`.

Iframe-backed sources (`fonts`, `fontPreferences`) forward `signal` into `withIframe`
so abort removes the iframe. Other sources are raced at the wrapper layer.

## API

```ts
import {
  load,
  loadWithResourceBudget,
  RESOURCE_BUDGETS_REVISION,
} from '@thenightwatch/browser-sdk'

await load({ monitoring: false }) // unchanged

const controller = new AbortController()
const { agent, resolution, dispose, getPendingTimerCount } =
  await loadWithResourceBudget({
    monitoring: false,
    budget: {
      signal: controller.signal,
      totalTimeoutMs: 1500,
      perSourceTimeoutMs: 400,
      scheduling: 'idle', // optional
    },
  })

// controller.abort() // cancel mid-flight
const result = await agent.get()
dispose() // clears any leftover budget timers if get() was not called
```

## VisitorId impact

Timeout/abort error components change the hash vs a fully successful run.
Store `RESOURCE_BUDGETS_REVISION` beside IDs when budgets are enabled in
production paths that may hit limits.

## Privacy reminders

- No telemetry; `monitoring` remains a no-op.
- Do not re-add `applePay`.
- Budgets do not bypass Permissions-Policy denials.
