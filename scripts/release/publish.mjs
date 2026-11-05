#!/usr/bin/env node
/**
 * Publishes Night Watch 1.x packages to npm (tag latest, public).
 *
 * Prerequisites:
 *   1. npm login
 *   2. Create org https://www.npmjs.com/org/create → night-watch
 *   3. pnpm release:prepare
 *
 * Usage:
 *   node scripts/release/publish.mjs           # dry-run
 *   node scripts/release/publish.mjs --execute # real publish
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const execute = process.argv.includes('--execute')

/** Publish order: leaves first so dependents resolve. */
const PACKAGES = [
  'packages/core',
  'packages/browser-sdk',
  'packages/pro-contracts',
  'packages/pro-browser-adapter',
  'packages/pro-server-sdk',
  'packages/pro-dashboard-client',
  'packages/pro-web-agent',
  'packages/vanilla',
  'packages/react',
  'packages/preact',
  'packages/vue',
  'packages/angular',
  'packages/blazor',
]

function publishOne(rel) {
  const dir = join(root, rel)
  const pj = join(dir, 'package.json')
  if (!existsSync(pj)) throw new Error(`missing ${rel}`)
  const pkg = JSON.parse(readFileSync(pj, 'utf8'))
  if (pkg.private) {
    console.log(`skip private ${pkg.name}`)
    return
  }
  const args = ['publish', '--access', 'public', '--tag', 'latest']
  if (!execute) args.push('--dry-run')
  console.log(`\n> pnpm -C ${rel} ${args.join(' ')}  (${pkg.name}@${pkg.version})`)
  execFileSync('pnpm', args, { cwd: dir, stdio: 'inherit', shell: true })
}

console.log(execute ? 'EXECUTE publish' : 'DRY-RUN publish (pass --execute to publish for real)')
for (const rel of PACKAGES) publishOne(rel)
console.log(execute ? '\nPublished.' : '\nDry-run done. Re-run with --execute after npm org is ready.')
