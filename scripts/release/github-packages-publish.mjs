#!/usr/bin/env node
/**
 * Mirror Night Watch frontend packages to GitHub Packages.
 *
 * npmjs.org keeps the canonical @thenightwatch/* names.
 * GitHub Packages requires scope === GitHub owner, so we publish as:
 *   @MeladKamari/night-watch-<pkg>
 *
 * Usage:
 *   node scripts/release/github-packages-publish.mjs
 *   node scripts/release/github-packages-publish.mjs --execute
 *
 * Auth: NODE_AUTH_TOKEN / GITHUB_TOKEN with packages:write
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const execute = process.argv.includes('--execute')

const GH_OWNER = 'MeladKamari'
const GH_REGISTRY = 'https://npm.pkg.github.com'
const REPO_URL = 'https://github.com/MeladKamari/night-watch.git'

/** dir → GitHub Packages short name (scope must match GH owner). */
const PACKAGES = [
  ['packages/core', 'night-watch-core'],
  ['packages/browser-sdk', 'night-watch-browser-sdk'],
  ['packages/vanilla', 'night-watch-vanilla'],
  ['packages/react', 'night-watch-react'],
  ['packages/preact', 'night-watch-preact'],
  ['packages/vue', 'night-watch-vue'],
  ['packages/angular', 'night-watch-angular'],
]

function readPkg(rel) {
  return JSON.parse(readFileSync(join(root, rel, 'package.json'), 'utf8'))
}

function writePkg(rel, pkg) {
  writeFileSync(join(root, rel, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`)
}

function publishOne(rel, ghName) {
  const dir = join(root, rel)
  const pj = join(dir, 'package.json')
  if (!existsSync(pj)) throw new Error(`missing ${rel}`)

  const original = readFileSync(pj, 'utf8')

  try {
    const pkg = JSON.parse(original)
    if (pkg.private) {
      console.log(`skip private ${pkg.name}`)
      return
    }

    const ghFull = `@${GH_OWNER}/${ghName}`
    pkg.name = ghFull
    pkg.repository = {
      type: 'git',
      url: REPO_URL,
      directory: rel.replace(/\\/g, '/'),
    }
    pkg.publishConfig = {
      registry: GH_REGISTRY,
      access: 'public',
      tag: 'latest',
    }
    writePkg(rel, pkg)

    const args = ['publish', '--no-git-checks', '--access', 'public', '--tag', 'latest']
    if (!execute) args.push('--dry-run')
    console.log(`\n> pnpm ${args.join(' ')}  (${ghFull}@${pkg.version} → GitHub Packages)`)
    execFileSync('pnpm', args, {
      cwd: dir,
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        NODE_AUTH_TOKEN: process.env.NODE_AUTH_TOKEN || process.env.GITHUB_TOKEN || '',
        // GitHub Packages rejects npm provenance attestations from npmjs OIDC.
        NPM_CONFIG_PROVENANCE: 'false',
      },
    })
  } finally {
    writeFileSync(pj, original)
  }
}

console.log(execute ? 'EXECUTE GitHub Packages mirror' : 'DRY-RUN GitHub Packages mirror')
for (const [rel, ghName] of PACKAGES) {
  if (!existsSync(join(root, rel, 'package.json'))) throw new Error(`missing ${rel}`)
  // Ensure package is built before packing (dist must exist).
  void readPkg(rel)
  publishOne(rel, ghName)
}
console.log(execute ? '\nMirrored packages to GitHub Packages' : '\nDry-run done')
