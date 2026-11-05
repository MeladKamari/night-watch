# Opt-in fingerprint change inspector (step 69)

**Optional enhancement** — not part of FingerprintJS OSS v5.3.0 parity.
Default `load()` behavior is **unchanged**.

## Why

- Diff two **local** collections to see which sources changed.
- Surface error/value transitions, duration deltas, and **expected instability** tiers.
- Render a privacy-safe markdown/text report for consoles or first-party UI.

## Hard rule

Comparisons are **probabilistic hints only**. A diff does **not** prove the same or
different person/device and must not be treated as an identity guarantee.

Catalog revision: `night-watch-change-inspector-v1` (`CHANGE_INSPECTOR_REVISION`).

## API

```ts
import {
  load,
  inspectFingerprintChange,
  formatFingerprintChangeReport,
  inspectFingerprintRebuild,
  CHANGE_INSPECTOR_DISCLAIMER,
} from '@night-watch/browser-sdk'

const agent = await load({ monitoring: false })
const a = await agent.get()
const b = await agent.get()

const report = inspectFingerprintChange(a, b)
console.log(report.disclaimer) // always the identity disclaimer
console.log(formatFingerprintChangeReport(report)) // markdown visual diff

// Or: one load, two gets, formatted report
const { report: rebuildReport, formatted } = await inspectFingerprintRebuild({
  monitoring: false,
})
```

Rows are **stable-sorted** by source name. Previews run through diagnostics
redaction (URLs / credential-like fields). `applePay` is never listed.

Instability tiers reuse the reliability profile heuristics (`stable` /
`moderate` / `volatile`) — operational labels, not calibrated rates.

## Privacy reminders

- Local only — the inspector opens no network sockets.
- Treat previews as sensitive entropy; do not ship raw dumps to third parties.
- No telemetry; `monitoring` remains a no-op.
