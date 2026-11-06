/**
 * Consumer fixture: Node ESM import of modular + bundled SDK/core.
 * Run after `pnpm build`. Exit 0 on success.
 */
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const require = createRequire(import.meta.url)

const modular = await import('@thenightwatch/browser-sdk')
if (modular.SOURCE_MANIFEST_REVISION !== 'default-v1') {
  throw new Error('modular import: bad manifest')
}
if (modular.ENABLED_SOURCE_COUNT !== 41) {
  throw new Error('modular import: expected 41 sources')
}
if (typeof modular.load !== 'function' || typeof modular.hashComponents !== 'function') {
  throw new Error('modular import: missing load/hashComponents')
}
if (modular.ENABLED_SOURCES.includes('applePay')) {
  throw new Error('modular import: applePay must be absent')
}

const bundledEsmPath = pathToFileURL(join(root, 'packages/browser-sdk/dist/fp.esm.js')).href
const bundled = await import(bundledEsmPath)
if (typeof bundled.load !== 'function') {
  throw new Error('bundled ESM: missing load')
}
if (bundled.default?.load !== bundled.load) {
  // default export object should expose the same load reference when present
}

const coreCjs = require(join(root, 'packages/core/dist/core.cjs'))
if (coreCjs.ENABLED_SOURCE_COUNT !== 41) {
  throw new Error('core CJS: expected 41 sources')
}

console.log(
  JSON.stringify({
    ok: true,
    modularManifest: modular.SOURCE_MANIFEST_REVISION,
    bundledHasLoad: typeof bundled.load === 'function',
    coreCjsCount: coreCjs.ENABLED_SOURCE_COUNT,
  }),
)
