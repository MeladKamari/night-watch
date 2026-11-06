#!/usr/bin/env node
/**
 * CI publish for Night Watch frontend packages.
 *
 * - Resolves next version from npm (or keeps local if already ahead)
 * - Aligns package.json versions + repository metadata
 * - Builds and publishes in dependency order via `npm publish`
 *
 * Auth (preferred): GitHub Actions OIDC + npm Trusted Publisher
 * Fallback: NODE_AUTH_TOKEN / NPM_TOKEN with Bypass-2FA granular token
 *
 * Usage:
 *   node scripts/release/ci-publish.mjs                 # dry-run
 *   node scripts/release/ci-publish.mjs --execute        # publish
 *   node scripts/release/ci-publish.mjs --execute --bump=minor
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const execute = process.argv.includes('--execute')
const bumpArg = process.argv.find((a) => a.startsWith('--bump='))
const bumpType = (bumpArg?.split('=')[1] || 'patch').toLowerCase()

const REPO_URL = 'git+https://github.com/MeladKamari/night-watch.git'

/** JS framework packages only (publish order: deps first). Blazor ships via NuGet. */
const PACKAGES = [
  'packages/core',
  'packages/browser-sdk',
  'packages/vanilla',
  'packages/react',
  'packages/preact',
  'packages/vue',
  'packages/angular',
]

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true, ...opts })
}

function readPkg(rel) {
  return JSON.parse(readFileSync(join(root, rel, 'package.json'), 'utf8'))
}

function writePkg(rel, pkg) {
  writeFileSync(join(root, rel, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`)
}

function parseVer(v) {
  const m = String(v || '').trim().match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!m) return null
  return { major: +m[1], minor: +m[2], patch: +m[3], raw: `${m[1]}.${m[2]}.${m[3]}` }
}

function cmpVer(a, b) {
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  return a.patch - b.patch
}

function bump(ver, type) {
  if (type === 'major') return `${ver.major + 1}.0.0`
  if (type === 'minor') return `${ver.major}.${ver.minor + 1}.0`
  return `${ver.major}.${ver.minor}.${ver.patch + 1}`
}

function npmViewVersion(name) {
  try {
    const out = execFileSync('npm', ['view', name, 'version', '--registry', 'https://registry.npmjs.org'], {
      cwd: root,
      encoding: 'utf8',
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return parseVer(out.trim())
  } catch {
    return null
  }
}

function resolveNextVersion() {
  const local = parseVer(readPkg(PACKAGES[0]).version)
  if (!local) throw new Error('invalid local version on packages/core')
  const published = npmViewVersion(readPkg(PACKAGES[0]).name)

  if (!published) {
    console.log(`no published version for ${readPkg(PACKAGES[0]).name}; using local ${local.raw}`)
    return local.raw
  }

  if (cmpVer(local, published) > 0) {
    console.log(`local ${local.raw} > npm ${published.raw}; publishing local`)
    return local.raw
  }

  const next = bump(published, bumpType)
  console.log(`npm ${published.raw} → bump ${bumpType} → ${next}`)
  return next
}

function alignPackages(version) {
  for (const rel of PACKAGES) {
    const pkg = readPkg(rel)
    pkg.version = version
    // Keep workspace:* in git; pnpm publish rewrites it in the tarball only.
    pkg.repository = {
      type: 'git',
      url: REPO_URL,
      directory: rel.replace(/\\/g, '/'),
    }
    pkg.publishConfig = {
      ...(pkg.publishConfig || {}),
      access: 'public',
      tag: 'latest',
    }
    writePkg(rel, pkg)
    console.log(`aligned ${pkg.name}@${version}`)
  }
}

function publishOne(rel) {
  const dir = join(root, rel)
  const pkg = readPkg(rel)
  if (pkg.private) {
    console.log(`skip private ${pkg.name}`)
    return
  }
  // pnpm rewrites workspace: protocol for the packed tarball without editing the repo.
  const args = ['publish', '--access', 'public', '--tag', 'latest', '--no-git-checks']
  if (!execute) args.push('--dry-run')
  console.log(`\n> pnpm ${args.join(' ')}  (${pkg.name}@${pkg.version})`)
  execFileSync('pnpm', args, {
    cwd: dir,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      // Prefer OIDC; token fallback when present in CI secrets.
      NODE_AUTH_TOKEN: process.env.NODE_AUTH_TOKEN || process.env.NPM_TOKEN || '',
    },
  })
}

function writeVersionFile(version) {
  const out = join(root, 'scripts/release/.last-version')
  writeFileSync(out, `${version}\n`)
}

const version = resolveNextVersion()
alignPackages(version)

console.log('\n> pnpm build')
run('pnpm', ['build'])

console.log(execute ? '\nEXECUTE publish' : '\nDRY-RUN publish (pass --execute to publish for real)')
for (const rel of PACKAGES) {
  if (!existsSync(join(root, rel, 'package.json'))) throw new Error(`missing ${rel}`)
  publishOne(rel)
}

writeVersionFile(version)
console.log(execute ? `\nPublished @thenightwatch/*@${version}` : `\nDry-run done for ${version}`)
console.log(`NEXT_VERSION=${version}`)
