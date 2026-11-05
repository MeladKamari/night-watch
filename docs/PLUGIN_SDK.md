# Opt-in custom plugin SDK (step 66)

**Optional enhancement** — not part of FingerprintJS OSS v5.3.0 parity.
Default `load()` / default-profile **41-source** behavior is **unchanged** unless you
call `loadWithPlugins`.

## Why

- Register typed first-party entropy sources with **namespaced keys** (`ext:…`).
- Declare **dependency order**, **timeout budgets**, and **cleanup** hooks.
- Keep plugin policy **explicit** (prefix, overwrite, timeouts, network disclosure).

## Guarantees

- Default-profile registry stays 41 sources; `applePay` is never allowed.
- Sample `createPersianFontProbePlugin()` is **opt-in only** — does not change
  default visitorIds.
- Adding any plugin key **changes** `visitorId` vs the 41-source default
  (`visitorIdWillDifferFromFullDefault: true`).
- Failed plugins become **error components**; other plugins still run.
- Values are **JSON-safe by default** (non-serializable → error component).
- Catalog revision: `night-watch-plugin-sdk-v1` (`PLUGIN_SDK_REVISION`).

## API

```ts
import {
  load,
  loadWithPlugins,
  createPersianFontProbePlugin,
  resolvePlugins,
  PLUGIN_SDK_REVISION,
} from '@night-watch/browser-sdk'

// Default path — unchanged
await load({ monitoring: false })

const { agent, resolution } = await loadWithPlugins({
  monitoring: false,
  pluginPolicy: {
    requiredKeyPrefix: 'ext:', // default
    allowOverwriteBuiltins: false,
    defaultTimeoutMs: 2000,
    maxTimeoutMs: 5000,
    allowNetwork: false, // disclosure; SDK opens no sockets
  },
  plugins: [
    {
      id: 'my-probe',
      key: 'ext:myProbe',
      version: '1.0.0',
      dependsOn: ['platform'],
      timeoutMs: 1000,
      collect: (ctx) => ({ platform: ctx.deps.platform }),
      cleanup: ({ reason }) => {
        /* release DOM / contexts */
      },
    },
    createPersianFontProbePlugin(),
  ],
})

console.log(resolution.manifest.executionOrder, resolution.pluginKeys)
const result = await agent.get()
```

`collect` may return a value or a phase-2 deferred getter (same two-stage shape
as builtin sources). `resolvePlugins` / `pluginManifestToJson` produce diffable
manifests without collecting.

## VisitorId impact

Store `PLUGIN_SDK_REVISION` + plugin ids/versions beside IDs when plugins are
enabled. This does **not** bump `SOURCE_MANIFEST_REVISION` (default algorithm
unchanged).

## Privacy reminders

- No telemetry; `monitoring` remains a no-op.
- Do not re-add `applePay`.
- Prefer first-party, offline-safe probes; keep `allowNetwork: false` unless you
  document integrator-owned fetches.
- Combine with `docs/COLLECTION_POLICY.md` when consent gating is required.
