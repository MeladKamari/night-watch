import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SDK_PACKAGE_NAME, SDK_PRODUCT_LABEL } from '@night-watch/browser-sdk'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

describe('licensing and documentation fixtures (step 61)', () => {
  it('ships MIT LICENSE, NOTICE with upstream attribution, and trademark-distinct naming', () => {
    expect(existsSync(join(root, 'LICENSE'))).toBe(true)
    expect(existsSync(join(root, 'NOTICE'))).toBe(true)
    expect(existsSync(join(root, 'README.md'))).toBe(true)

    const license = read('LICENSE')
    expect(license).toMatch(/MIT License/)
    expect(license).toMatch(/Night Watch/)

    const notice = read('NOTICE')
    expect(notice).toMatch(/FingerprintJS, Inc/)
    expect(notice).toMatch(/dac5ae59409669f09aa09c0b2f44b7615b0520da/)
    expect(notice).toMatch(/official Fingerprint \/ FingerprintJS product/i)
    expect(notice).toMatch(/\*\*not\*\*/)
    expect(notice).toMatch(/applePay/)

    expect(SDK_PACKAGE_NAME).toBe('@night-watch/browser-sdk')
    expect(SDK_PRODUCT_LABEL).toMatch(/Night Watch/)
    expect(SDK_PACKAGE_NAME.startsWith('@fingerprintjs/')).toBe(false)

    const readme = read('README.md')
    expect(readme).toMatch(/@night-watch\/browser-sdk/)
    expect(readme).toMatch(/41/)
    expect(readme).not.toMatch(/official FingerprintJS release/i)
  })

  it('documents API, migration, privacy, build, troubleshooting, accuracy, and Persian usage', () => {
    const required = [
      'docs/API.md',
      'docs/MIGRATION.md',
      'docs/PRIVACY.md',
      'docs/BUILD.md',
      'docs/TROUBLESHOOTING.md',
      'docs/ACCURACY_AND_LIMITATIONS.md',
      'docs/fa/USAGE.md',
      'SECURITY.md',
      'examples/basic-esm/main.ts',
      'examples/extend-omit/main.ts',
      'examples/basic-iife/index.html',
    ]
    for (const rel of required) {
      expect(existsSync(join(root, rel)), rel).toBe(true)
      expect(read(rel).trim().length).toBeGreaterThan(40)
    }
    expect(read('docs/PRIVACY.md')).toMatch(/does \*\*not\*\* provide legal compliance/i)
    expect(read('docs/ACCURACY_AND_LIMITATIONS.md')).toMatch(/Not claimed/i)
    expect(read('docs/BUILD.md')).toMatch(/ci:checksums/)
    expect(read('docs/fa/USAGE.md')).toMatch(/بدون CDN/)
    expect(read('examples/basic-iife/index.html')).toMatch(/fp\.min\.js/)
    expect(read('examples/basic-iife/index.html')).not.toMatch(/cdn\.jsdelivr|unpkg\.com|openfpcdn/i)
  })

  it('typechecks documentation examples against published .d.ts', () => {
    const tsc = join(root, 'node_modules/typescript/bin/tsc')
    expect(existsSync(tsc)).toBe(true)
    expect(existsSync(join(root, 'packages/browser-sdk/dist/index.d.ts'))).toBe(true)

    const result = spawnSync(
      process.execPath,
      [tsc, '-p', join(root, 'examples/tsconfig.json'), '--pretty', 'false'],
      { cwd: root, encoding: 'utf8' },
    )
    expect(result.status, result.stdout + result.stderr).toBe(0)
  })
})
