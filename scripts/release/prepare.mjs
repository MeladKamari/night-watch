#!/usr/bin/env node
/**
 * Night Watch 1.x release prepare:
 * build → checksums → sbom → typecheck packages that ship.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const run = (cmd, args) => {
  console.log(`\n> ${cmd} ${args.join(' ')}`)
  execFileSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true })
}

const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
if (rootPkg.version !== '1.0.0' && !String(rootPkg.version).startsWith('1.')) {
  console.warn(`Warning: root version is ${rootPkg.version} (expected 1.x)`)
}

run('pnpm', ['build'])
run('pnpm', ['exec', 'tsc', '-b', '--pretty', 'false'])
run('pnpm', ['run', 'ci:checksums'])
run('pnpm', ['run', 'ci:sbom'])
run('pnpm', ['test'])

console.log('\nrelease:prepare OK — ready for release:publish (npm org @night-watch required)')
