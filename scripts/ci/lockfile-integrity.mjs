/**
 * Verifies pnpm-lock.yaml exists, is non-empty, and matches the SHA-256 recorded
 * in reference/artifact-checksums.sha256 when that file is present.
 * Usage: node scripts/ci/lockfile-integrity.mjs
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const LOCK = join(ROOT, 'pnpm-lock.yaml')
const CHECKSUMS = join(ROOT, 'reference/artifact-checksums.sha256')

function fail(message) {
  console.error(`lockfile-integrity: FAIL — ${message}`)
  process.exit(1)
}

if (!existsSync(LOCK)) {
  fail('pnpm-lock.yaml missing')
}

const lockBytes = readFileSync(LOCK)
if (lockBytes.length < 32) {
  fail('pnpm-lock.yaml suspiciously small')
}

const digest = createHash('sha256').update(lockBytes).digest('hex')
console.log(`lockfile-integrity: pnpm-lock.yaml sha256=${digest}`)

if (existsSync(CHECKSUMS)) {
  const lines = readFileSync(CHECKSUMS, 'utf8').split(/\r?\n/)
  const lockLine = lines.find((line) => line.includes('pnpm-lock.yaml'))
  if (!lockLine) {
    console.warn(
      'lockfile-integrity: WARN — checksums file has no pnpm-lock.yaml entry (run ci:checksums)',
    )
  } else {
    const expected = lockLine.trim().split(/\s+/)[0]
    if (expected !== digest) {
      fail(
        `pnpm-lock.yaml digest mismatch vs reference/artifact-checksums.sha256 (expected ${expected})`,
      )
    }
    console.log('lockfile-integrity: matches artifact-checksums.sha256')
  }
}

console.log('lockfile-integrity: PASS')
