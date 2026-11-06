# Opt-in browser entropy experiment harness (step 70)

**Optional enhancement** — not FingerprintJS OSS parity. Default `load()` unchanged.

## Why

- Measure **within-browser** rebuild variance and **across-cohort** collision numerators.
- Require **explicit consent** before samples are retained.
- Keep aggregates **local**; support deletion via `clearSamples()` / `dispose()`.

## Hard rules

- Lab aggregates only — not worldwide uniqueness / FPR / identity guarantees.
- No automatic network upload or persistent SDK storage.
- Catalog: `night-watch-entropy-experiments-v1`.

## API

```ts
import { createEntropyExperimentHarness } from '@thenightwatch/browser-sdk'

const harness = createEntropyExperimentHarness({
  consent: {
    status: 'granted',
    purpose: 'lab stability study',
    noticeVersion: '2026-11-lab-v1',
  },
  maxSamples: 200,
})

await harness.collectRebuilds(20, { monitoring: false }, 'chromium-lab')
harness.recordSample({ visitorId: '...', cohort: 'firefox-lab' })

const report = harness.aggregate()
console.log(report.disclaimer)
harness.clearSamples() // deletion control
```

Denied/withdrawn consent throws `ExperimentConsentError`.
