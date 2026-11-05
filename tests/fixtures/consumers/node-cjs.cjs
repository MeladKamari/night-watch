/**
 * Consumer fixture: Node CommonJS require of published CJS bundles.
 * Run after `pnpm build`. Exit 0 on success.
 */
const path = require('node:path')

const root = path.join(__dirname, '../../..')
const sdk = require(path.join(root, 'packages/browser-sdk/dist/fp.cjs'))
const core = require(path.join(root, 'packages/core/dist/core.cjs'))

if (typeof sdk.load !== 'function') {
  throw new Error('sdk CJS: missing load')
}
if (typeof sdk.hashComponents !== 'function') {
  throw new Error('sdk CJS: missing hashComponents')
}
if (typeof sdk.componentsToDebugString !== 'function') {
  throw new Error('sdk CJS: missing componentsToDebugString')
}
if (sdk.ENABLED_SOURCE_COUNT !== 41) {
  throw new Error('sdk CJS: expected 41 sources')
}
if (Array.isArray(sdk.ENABLED_SOURCES) && sdk.ENABLED_SOURCES.includes('applePay')) {
  throw new Error('sdk CJS: applePay must be absent')
}
if (core.SOURCE_MANIFEST_REVISION !== 'default-v1') {
  throw new Error('core CJS: bad manifest')
}

console.log(
  JSON.stringify({
    ok: true,
    sdkCount: sdk.ENABLED_SOURCE_COUNT,
    coreManifest: core.SOURCE_MANIFEST_REVISION,
  }),
)
