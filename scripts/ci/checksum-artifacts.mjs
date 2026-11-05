/**
 * SHA-256 checksums for published dist artifacts + lockfile (offline transfer).
 * Usage: node scripts/ci/checksum-artifacts.mjs [--out reference/artifact-checksums.sha256]
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

const TARGETS = [
  'pnpm-lock.yaml',
  'packages/browser-sdk/dist/fp.min.js',
  'packages/browser-sdk/dist/fp.umd.min.js',
  'packages/browser-sdk/dist/fp.esm.min.js',
  'packages/browser-sdk/dist/fp.min.cjs',
  'packages/core/dist/core.esm.min.js',
  'packages/core/dist/core.min.cjs',
  'reference/sbom.cdx.json',
]

function parseArgs(argv) {
  let out = join(ROOT, 'reference/artifact-checksums.sha256')
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out' && argv[i + 1]) {
      out = argv[++i]
      if (!out.startsWith('/') && !/^[A-Za-z]:/.test(out)) {
        out = join(ROOT, out)
      }
    }
  }
  return { out }
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

const { out } = parseArgs(process.argv.slice(2))
const lines = []
for (const rel of TARGETS) {
  const abs = join(ROOT, rel)
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    console.warn(`skip missing: ${rel}`)
    continue
  }
  lines.push(`${sha256(abs)}  ${rel.replace(/\\/g, '/')}`)
}

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, `${lines.join('\n')}\n`)
console.log(`Wrote ${lines.length} checksums → ${relative(ROOT, out).replace(/\\/g, '/')}`)
