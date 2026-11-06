import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { rollup } from 'rollup'
import resolve from '@rollup/plugin-node-resolve'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

const SDK_BUNDLES = [
  'fp.js',
  'fp.min.js',
  'fp.umd.js',
  'fp.umd.min.js',
  'fp.esm.js',
  'fp.esm.min.js',
  'fp.cjs',
  'fp.min.cjs',
] as const

const CORE_BUNDLES = [
  'core.esm.js',
  'core.esm.min.js',
  'core.cjs',
  'core.min.cjs',
] as const

/** URL-like outbound endpoints that must never appear as runtime dependencies. */
const FORBIDDEN_RUNTIME_URL = [
  /https?:\/\/[^"'`\s]*openfpcdn/i,
  /https?:\/\/[^"'`\s]*fingerprintjs\.com/i,
  /https?:\/\/[^"'`\s]*fpjscdn/i,
  /https?:\/\/fonts\.googleapis\.com/i,
  /https?:\/\/cdn\.jsdelivr\.net/i,
  /https?:\/\/unpkg\.com/i,
  /https?:\/\/ajax\.googleapis\.com/i,
]

function readSdk(name: string): string {
  return readFileSync(join(root, 'packages/browser-sdk/dist', name), 'utf8')
}

function readCore(name: string): string {
  return readFileSync(join(root, 'packages/core/dist', name), 'utf8')
}

describe('publish bundles (step 56)', () => {
  it('emits readable + minified ESM/CJS/IIFE/UMD artifacts with sourcemaps', () => {
    for (const name of SDK_BUNDLES) {
      const file = join(root, 'packages/browser-sdk/dist', name)
      expect(existsSync(file), name).toBe(true)
      expect(existsSync(`${file}.map`), `${name}.map`).toBe(true)
      expect(readSdk(name).length).toBeGreaterThan(100)
    }
    for (const name of CORE_BUNDLES) {
      const file = join(root, 'packages/core/dist', name)
      expect(existsSync(file), name).toBe(true)
      expect(existsSync(`${file}.map`), `${name}.map`).toBe(true)
    }
    // Minified browser IIFE should be smaller than readable.
    expect(readSdk('fp.min.js').length).toBeLessThan(readSdk('fp.js').length)
    expect(readSdk('fp.umd.min.js').length).toBeLessThan(readSdk('fp.umd.js').length)
  })

  it('keeps sideEffects false and exports map for dual package consumers', () => {
    const sdkPkg = require('../packages/browser-sdk/package.json') as {
      sideEffects: boolean
      exports: Record<string, unknown>
      types: string
    }
    const corePkg = require('../packages/core/package.json') as {
      sideEffects: boolean
      exports: Record<string, unknown>
    }
    expect(sdkPkg.sideEffects).toBe(false)
    expect(corePkg.sideEffects).toBe(false)
    expect(sdkPkg.types).toBe('./dist/index.d.ts')
    expect(sdkPkg.exports['.']).toMatchObject({
      types: './dist/index.d.ts',
      import: './dist/index.js',
      require: './dist/fp.cjs',
    })
    expect(existsSync(join(root, 'packages/browser-sdk/dist/index.d.ts'))).toBe(true)
    expect(existsSync(join(root, 'packages/core/dist/index.d.ts'))).toBe(true)
  })

  it('ships no payment probe / CDN runtime deps; applePay only as exclusion constant', () => {
    const bodies = [
      ...SDK_BUNDLES.map(readSdk),
      ...CORE_BUNDLES.map(readCore),
    ]
    for (const body of bodies) {
      // Exclusion constant may mention the key; never ship Apple Pay session probing.
      expect(body).not.toMatch(/\bApplePaySession\b/)
      expect(body).not.toMatch(/\bgetApplePay\b/)
      expect(body).not.toMatch(/applePay\s*:/)
      for (const pattern of FORBIDDEN_RUNTIME_URL) {
        expect(body).not.toMatch(pattern)
      }
      expect(body).not.toMatch(/\beval\s*\(/)
      expect(body).not.toMatch(/\bnew\s+Function\s*\(/)
    }
    // Runtime registry must exclude the payment key.
    const iife = readSdk('fp.min.js')
    const api = new Function(`${iife}\n; return NightWatch;`)() as { ENABLED_SOURCES: string[] }
    expect(api.ENABLED_SOURCES).not.toContain('applePay')
    expect(api.ENABLED_SOURCES).toHaveLength(41)
  })

  it('Node ESM + CJS consumer fixtures succeed', () => {
    const esm = spawnSync(process.execPath, [join(root, 'tests/fixtures/consumers/node-esm.mjs')], {
      cwd: root,
      encoding: 'utf8',
    })
    expect(esm.status, esm.stderr || esm.stdout).toBe(0)
    expect(JSON.parse(esm.stdout)).toMatchObject({ ok: true })

    const cjs = spawnSync(process.execPath, [join(root, 'tests/fixtures/consumers/node-cjs.cjs')], {
      cwd: root,
      encoding: 'utf8',
    })
    expect(cjs.status, cjs.stderr || cjs.stdout).toBe(0)
    expect(JSON.parse(cjs.stdout)).toMatchObject({ ok: true, sdkCount: 41 })
  })

  it('Vite/webpack resolve fixture points at first-party offline assets', () => {
    const fixture = JSON.parse(
      readFileSync(join(root, 'tests/fixtures/consumers/vite-resolve.json'), 'utf8'),
    ) as {
      offline: boolean
      cdn: null
      sideEffects: boolean
      resolutions: {
        '@thenightwatch/browser-sdk': Record<string, string>
        '@thenightwatch/core': Record<string, string>
      }
    }
    expect(fixture.offline).toBe(true)
    expect(fixture.cdn).toBeNull()
    expect(fixture.sideEffects).toBe(false)
    for (const rel of Object.values(fixture.resolutions['@thenightwatch/browser-sdk'])) {
      expect(existsSync(join(root, rel)), rel).toBe(true)
    }
    for (const rel of Object.values(fixture.resolutions['@thenightwatch/core'])) {
      expect(existsSync(join(root, rel)), rel).toBe(true)
    }
  })

  it('tree-shakes unused collectors when importing only hash helpers from core', async () => {
    const bundle = await rollup({
      input: join(root, 'tests/fixtures/consumers/tree-shake-entry.mjs'),
      plugins: [
        resolve({
          preferBuiltins: false,
        }),
      ],
      onwarn(warning, warn) {
        if (warning.code === 'CIRCULAR_DEPENDENCY') {
          return
        }
        warn(warning)
      },
    })
    const { output } = await bundle.generate({ format: 'esm', exports: 'named' })
    await bundle.close()
    const code = output.map((chunk) => ('code' in chunk ? chunk.code : '')).join('\n')
    expect(code).toContain('hashComponents')
    expect(code).toContain('x64hash128')
    // Collectors / agent entrypoints should not be pulled in.
    expect(code).not.toMatch(/\bapplePay\b/)
    expect(code).not.toMatch(/\bloadSources\b/)
    expect(code).not.toMatch(/\bcreateBuiltinSources\b/)
    expect(code).not.toMatch(/\bgetWebGlExtensions\b/)
  })

  it('IIFE global exposes load/hashComponents/componentsToDebugString without network', () => {
    const iife = readSdk('fp.min.js')
    // Rollup IIFE binds `var NightWatch = ...` in the evaluating scope (script-tag global).
    const fn = new Function(`${iife}\n; return NightWatch;`)
    const api = fn() as {
      load: unknown
      hashComponents: unknown
      componentsToDebugString: unknown
      ENABLED_SOURCE_COUNT: number
      ENABLED_SOURCES: string[]
    }
    expect(api).toBeTruthy()
    expect(typeof api.load).toBe('function')
    expect(typeof api.hashComponents).toBe('function')
    expect(typeof api.componentsToDebugString).toBe('function')
    expect(api.ENABLED_SOURCE_COUNT).toBe(41)
    expect(api.ENABLED_SOURCES).not.toContain('applePay')
  })

  it('SSR import of published modular entry still works under Node', async () => {
    const sdk = await import(pathToFileURL(join(root, 'packages/browser-sdk/dist/index.js')).href)
    expect(sdk.SDK_PACKAGE_NAME).toBe('@thenightwatch/browser-sdk')
    expect(sdk.listEnabledSources()).toHaveLength(41)
  })
})

describe('declaration surface', () => {
  it('index.d.ts re-exports public API names used by consumers', () => {
    const dts = readFileSync(join(root, 'packages/browser-sdk/dist/index.d.ts'), 'utf8')
    for (const name of [
      'load',
      'hashComponents',
      'componentsToDebugString',
      'LoadOptions',
      'GetResult',
      'Agent',
      'ENABLED_SOURCE_COUNT',
    ]) {
      expect(dts).toContain(name)
    }
    expect(dts).not.toContain('applePay')
  })
})
