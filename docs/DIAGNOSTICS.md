# Opt-in diagnostics and reproducibility snapshots (step 68)

**Optional enhancement** — not part of FingerprintJS OSS v5.3.0 parity.
Default `load()` / hashing behavior is **unchanged** unless you explicitly export.

## Why

- Produce a **local**, schema-validated JSON snapshot for support / lab repro.
- Attach a **reproducibility seed** hash for fixture correlation.
- **Redact** page URL, title, cookies, referrer, and credential-like fields.
- Never open analytics / telemetry beacons from the SDK.

## Guarantees

- Export is an **explicit action** (`exportDiagnosticSnapshot` / `agent.exportDiagnostics`).
- No `fetch` / `sendBeacon` / XHR performed by the diagnostics module.
- Schema id: `night-watch-diagnostics-snapshot-v1` (`DIAGNOSTICS_SNAPSHOT_SCHEMA`).
- Catalog revision: `night-watch-diagnostics-v1` (`DIAGNOSTICS_REVISION`).
- Does **not** bump `SOURCE_MANIFEST_REVISION`.

## API

```ts
import {
  load,
  loadWithDiagnostics,
  exportDiagnosticSnapshot,
  validateDiagnosticSnapshot,
  hashReproSeed,
} from '@thenightwatch/browser-sdk'

await load({ monitoring: false }) // unchanged

const { agent } = await loadWithDiagnostics({
  monitoring: false,
  diagnostics: {
    reproSeed: 'lab-fa-IR',
    includeEnvironment: true,
  },
})

const result = await agent.get()
const { snapshot, json, byteLength } = await agent.exportDiagnostics()
// or: exportDiagnosticSnapshot(result, { reproSeed: 'lab-fa-IR' })

validateDiagnosticSnapshot(snapshot) // { ok: true, snapshot } | { ok: false, errors }
```

Raw `reproSeed` is omitted by default; only `reproSeedHash` is embedded unless
`includeRawReproSeed: true` (lab machines).

## Redaction

Omitted / replaced: `href`, `location`, `title`, `referrer`, cookies, storage
dumps, credential-like keys, absolute `http(s)` / `file://` URLs inside error
text. Environment hints may include UA / `dir` / `secureContext` with
`pageContextRedacted: true`.

## Privacy reminders

- Snapshots may still contain entropy values — treat exports as sensitive.
- No telemetry; `monitoring` remains a no-op.
- Do not re-add `applePay` (validation rejects it).
