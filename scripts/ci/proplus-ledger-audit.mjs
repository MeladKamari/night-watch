import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const ledger = JSON.parse(readFileSync(join(root, 'docs/proplus-feature-coverage.json'), 'utf8'))

const allowed = new Set(ledger.statusesAllowed)
const signals = ledger.smartSignals
if (signals.length !== 29) {
  console.error(`ledger-audit: expected 29 smart signals, got ${signals.length}`)
  process.exit(1)
}

let native = 0
let active = 0
for (const s of signals) {
  if (!allowed.has(s.status)) {
    console.error(`ledger-audit: bad status ${s.status} on ${s.name}`)
    process.exit(1)
  }
  if (s.status === 'unsupported' && s.scope === 'native_deferred') native++
  if (s.step != null) active++
  if (s.status === 'validated' && (!s.tests || s.tests.length === 0) && s.step >= 53) {
    console.error(`ledger-audit: validated signal missing tests: ${s.name}`)
    process.exit(1)
  }
}

if (native !== 10) {
  console.error(`ledger-audit: expected 10 native deferred, got ${native}`)
  process.exit(1)
}
if (active !== 19) {
  console.error(`ledger-audit: expected 19 active stepped signals, got ${active}`)
  process.exit(1)
}

if (!Array.isArray(ledger.managementFeatures) || ledger.managementFeatures.length < 5) {
  console.error('ledger-audit: management features missing')
  process.exit(1)
}

console.log('ledger-audit: PASS — 29 signals (19 active / 10 deferred), statuses honest')
