/**
 * Offline bundle import smoke: ESM dynamic import + CJS require of published artifacts.
 * No network. Verifies ENABLED_SOURCE_COUNT === 41 and applePay absent from registry export.
 *
 * Usage: node scripts/ci/bundle-import-smoke.mjs
 */

import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)

function assert(cond, msg) {
  if (!cond) {
    throw new Error(msg)
  }
}

async function smokeEsm() {
  const corePath = join(ROOT, 'packages/core/dist/core.esm.js')
  const sdkPath = join(ROOT, 'packages/browser-sdk/dist/fp.esm.js')
  assert(existsSync(corePath), `missing ${corePath}`)
  assert(existsSync(sdkPath), `missing ${sdkPath}`)

  const core = await import(pathToFileURL(corePath).href)
  assert(core.ENABLED_SOURCE_COUNT === 41, `core ENABLED_SOURCE_COUNT=${core.ENABLED_SOURCE_COUNT}`)
  assert(core.EXCLUDED_UPSTREAM_SOURCE === 'applePay', 'excluded key constant missing')
  assert(
    !core.ENABLED_SOURCES.includes('applePay'),
    'applePay must not be in ENABLED_SOURCES',
  )
  assert(typeof core.hashComponents === 'function', 'hashComponents missing')

  const sdk = await import(pathToFileURL(sdkPath).href)
  assert(typeof sdk.load === 'function', 'sdk.load missing')
  assert(sdk.ENABLED_SOURCE_COUNT === 41, `sdk ENABLED_SOURCE_COUNT=${sdk.ENABLED_SOURCE_COUNT}`)
  assert(!sdk.ENABLED_SOURCES.includes('applePay'), 'sdk registry leaked applePay')
}

function smokeCjs() {
  const corePath = join(ROOT, 'packages/core/dist/core.cjs')
  const sdkPath = join(ROOT, 'packages/browser-sdk/dist/fp.cjs')
  assert(existsSync(corePath), `missing ${corePath}`)
  assert(existsSync(sdkPath), `missing ${sdkPath}`)

  const core = require(corePath)
  assert(core.ENABLED_SOURCE_COUNT === 41, 'cjs core count')
  assert(!core.ENABLED_SOURCES.includes('applePay'), 'cjs core applePay')

  const sdk = require(sdkPath)
  assert(typeof sdk.load === 'function', 'cjs sdk.load')
  assert(sdk.ENABLED_SOURCE_COUNT === 41, 'cjs sdk count')
}

await smokeEsm()
smokeCjs()
console.log('bundle-import-smoke PASS (ESM+CJS, 41 sources, applePay absent)')
