/**
 * Static audit of published min bundles: forbid vendor telemetry hosts and
 * payment collectors. Does not execute bundles.
 * Usage: node scripts/ci/vendor-bundle-audit.mjs
 */

import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

const BUNDLES = [
  'packages/browser-sdk/dist/fp.min.js',
  'packages/browser-sdk/dist/fp.esm.min.js',
  'packages/browser-sdk/dist/fp.min.cjs',
  'packages/browser-sdk/dist/fp.umd.min.js',
  'packages/core/dist/core.esm.min.js',
  'packages/core/dist/core.min.cjs',
]

const FORBIDDEN = [
  /openfpcdn\.io/i,
  /fingerprintjs\.com\/v\d/i,
  /fpcdn\.io/i,
  /GoogleAnalytics|gtag\(/i,
  /facebook\.com\/tr/i,
  /ApplePaySession/,
  /getApplePay/,
]

function fail(message) {
  console.error(`vendor-bundle-audit: FAIL — ${message}`)
  process.exit(1)
}

let scanned = 0
for (const rel of BUNDLES) {
  const path = join(ROOT, rel)
  if (!existsSync(path)) {
    fail(`missing bundle ${rel} (run pnpm build first)`)
  }
  const text = readFileSync(path, 'utf8')
  scanned++
  for (const pattern of FORBIDDEN) {
    if (pattern.test(text)) {
      fail(`${rel} matched forbidden pattern ${pattern}`)
    }
  }
  console.log(`vendor-bundle-audit: ok ${rel} (${text.length} bytes)`)
}

console.log(`vendor-bundle-audit: PASS (${scanned} bundles)`)
