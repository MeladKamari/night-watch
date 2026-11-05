# Public API — `@night-watch/browser-sdk`

Import is **SSR-safe**. Call `load()` only in a browser (or tests with
`allowNonBrowser` overrides). Types live in the published `.d.ts` files.

## `load(options?) → Promise<Agent>`

Creates an agent, optionally waits for idle (`delayFallback`, default `50`),
starts the 41 Default-profile collectors, and returns an `Agent`.

| Option | Type | Default | Notes |
|---|---|---|---|
| `delayFallback` | `number` | `50` | ms when `requestIdleCallback` missing |
| `debug` | `boolean` | `false` | Console debug bundle |
| `monitoring` | `boolean` | `false` | **No-op** — never contacts vendor telemetry |
| `excludeSources` | `string[]` | `[]` | Skip builtin keys at collect time |
| `customSources` | sources map | — | Additive unless `overwriteBuiltins` |
| `overwriteBuiltins` | `boolean` | `false` | Allow custom to replace builtins |

Registering the excluded key `applePay` throws `RegistryInvariantError`.

```ts
import { load } from '@night-watch/browser-sdk'

const agent = await load({
  monitoring: false,
  excludeSources: ['domBlockers'],
})
```

## `agent.get(options?) → Promise<GetResult>`

| Field | Type | Notes |
|---|---|---|
| `visitorId` | `string` | MurmurHash3 x64 128 hex of canonical components |
| `confidence` | `{ score: number; comment: string }` | Heuristic; see accuracy doc |
| `components` | `BuiltinComponents` | Per-source `{ value, duration }` or `{ error, duration }` |
| `version` | `string` | `@night-watch/browser-sdk` package version |

`duration` is **never** part of the hash input.

## Hash / debug helpers (`@night-watch/core` re-exported)

```ts
import {
  hashComponents,
  componentsToDebugString,
  omitComponents,
  extendComponents,
  withComponent,
  ENABLED_SOURCES,
  SOURCE_MANIFEST_REVISION,
} from '@night-watch/browser-sdk'
```

| Helper | Role |
|---|---|
| `hashComponents(components)` | Canonical serialize + murmur |
| `componentsToDebugString(components)` | Human JSON (errors redacted) |
| `omitComponents(components, keys)` | Drop keys before hash |
| `extendComponents(base, extra, opts?)` | Merge; default no overwrite |
| `withComponent(components, key, component)` | Single-key extend |

## Component outcome semantics

| Shape | Meaning |
|---|---|
| `{ value, duration }` | Collected (may be `undefined` where upstream uses absence) |
| `{ error, duration }` | Isolated failure — other sources continue |
| Missing key | Filtered via `excludeSources` / `omitComponents` |

Do not invent successful values for unsupported APIs.

## Opt-in collection policy (optional)

`loadWithCollectionPolicy({ policy, ... })` enforces consent and category/source
omissions. Default `load()` ignores policies. See `docs/COLLECTION_POLICY.md`.

## Opt-in namespaced IDs (optional)

`loadWithIdentityScope({ identity, ... })` / `hashComponentsNamespaced` derive a
first-party salted ID. Default `visitorId` remains unsalted. See
`docs/NAMESPACED_IDS.md`.

## Opt-in reliability profiles (optional)

`loadWithReliabilityProfile({ profile, ... })` selects conservative / balanced /
diagnostic inclusion sets. Default `load()` ignores profiles. See
`docs/RELIABILITY_PROFILES.md`.

## Opt-in custom plugins (optional)

`loadWithPlugins({ plugins, pluginPolicy, ... })` registers typed namespaced
sources with dependency order, timeouts, and cleanup. Default `load()` ignores
plugins. See `docs/PLUGIN_SDK.md`.

## Opt-in resource budgets (optional)

`loadWithResourceBudget({ budget, ... })` adds AbortSignal, total/per-source
timeouts, and optional idle scheduling. Default `load()` ignores budgets. See
`docs/RESOURCE_BUDGETS.md`.

## Opt-in diagnostics snapshots (optional)

`loadWithDiagnostics` / `exportDiagnosticSnapshot` build schema-validated,
redacted local JSON snapshots. Default `load()` does not export. See
`docs/DIAGNOSTICS.md`.

## Opt-in change inspector (optional)

`inspectFingerprintChange` / `formatFingerprintChangeReport` diff two local
collections with probabilistic-hint labeling. Default `load()` unchanged. See
`docs/CHANGE_INSPECTOR.md`.

## Opt-in entropy experiments (optional)

`createEntropyExperimentHarness` runs consent-gated lab aggregates. See
`docs/ENTROPY_EXPERIMENTS.md`.

## Source metadata registry (optional)

`getSourceMetadataRegistry` documents privacy/stability/cost without changing
hashes. See `docs/SOURCE_METADATA.md`.

## Server integration (design only)

`FIRST_PARTY_SERVER_INTEGRATION_DESIGN` — no runtime client. See
`docs/SERVER_INTEGRATION_DESIGN.md`.

## Bundles

| Artifact | Use |
|---|---|
| Modular `dist/index.js` + `.d.ts` | Tree-shakeable ESM (primary) |
| `fp.esm(.min).js` | Bundled ESM |
| `fp(.min).cjs` | CommonJS |
| `fp(.min).js` | IIFE global `NightWatch` |
| `fp.umd(.min).js` | UMD |

Self-host from your origin. See `docs/BUILD.md`.
