/**
 * Generate a minimal CycloneDX 1.5 SBOM from the workspace lockfile / package metadata.
 * No third-party SBOM CLI required (offline-friendly). Writes JSON to stdout or --out.
 *
 * Usage: node scripts/ci/generate-sbom.mjs [--out reference/sbom.cdx.json]
 */

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

function parseArgs(argv) {
  let out = join(ROOT, 'reference/sbom.cdx.json')
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

function sha256File(path) {
  if (!existsSync(path)) return undefined
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function collectFromPnpmList() {
  // Full lockfile closure (runtime + build toolchain) for supply-chain review.
  // Hard vulnerability gate remains `pnpm audit --prod` in CI.
  // Windows needs shell for pnpm.cmd; Linux CI uses argv-only spawn.
  const isWin = process.platform === 'win32'
  const result = spawnSync('pnpm', ['list', '-r', '--depth', 'Infinity', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: isWin,
    maxBuffer: 20 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(
      `pnpm list failed (status=${String(result.status)}): ${result.error?.message || result.stderr || result.stdout || '(no output)'}`,
    )
  }
  const parsed = JSON.parse(result.stdout || '[]')
  const trees = Array.isArray(parsed) ? parsed : [parsed]
  /** @type {Map<string, { name: string, version: string, path?: string }>} */
  const components = new Map()

  function walkDeps(deps) {
    if (!deps || typeof deps !== 'object') return
    for (const [name, meta] of Object.entries(deps)) {
      if (!meta || typeof meta !== 'object') continue
      const version = typeof meta.version === 'string' ? meta.version : '0.0.0'
      const key = `${name}@${version}`
      if (!components.has(key)) {
        components.set(key, {
          name,
          version,
          path: typeof meta.path === 'string' ? meta.path : undefined,
        })
      }
      if (meta.dependencies) walkDeps(meta.dependencies)
      if (meta.devDependencies) walkDeps(meta.devDependencies)
      if (meta.optionalDependencies) walkDeps(meta.optionalDependencies)
      if (meta.unsavedDependencies) walkDeps(meta.unsavedDependencies)
    }
  }

  for (const tree of trees) {
    if (!tree || typeof tree !== 'object') continue
    const name = typeof tree.name === 'string' ? tree.name : 'workspace'
    const version = typeof tree.version === 'string' ? tree.version : '0.0.0'
    components.set(`${name}@${version}`, { name, version, path: tree.path })
    walkDeps(tree.dependencies)
    walkDeps(tree.devDependencies)
    walkDeps(tree.optionalDependencies)
  }

  return [...components.values()]
}

function toCycloneDx(components) {
  const lockHash = sha256File(join(ROOT, 'pnpm-lock.yaml'))
  const rootPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [
        {
          vendor: 'ibf',
          name: 'generate-sbom.mjs',
          version: '1.0.0',
        },
      ],
      component: {
        type: 'application',
        name: rootPkg.name,
        version: rootPkg.version,
        description: rootPkg.description,
      },
      properties: [
        {
          name: 'ibf:lockfile-sha256',
          value: lockHash ?? '(missing pnpm-lock.yaml)',
        },
        {
          name: 'ibf:scope',
          value: 'pnpm list -r --depth Infinity (lockfile closure incl. toolchain)',
        },
      ],
    },
    components: components
      .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
      .map((c) => ({
        type: 'library',
        name: c.name,
        version: c.version,
        purl: `pkg:npm/${encodeURIComponent(c.name).replace(/%40/g, '@')}@${c.version}`,
      })),
  }
}

const { out } = parseArgs(process.argv.slice(2))
const bom = toCycloneDx(collectFromPnpmList())
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, `${JSON.stringify(bom, null, 2)}\n`)
console.log(`SBOM written: ${out} (${bom.components.length} components)`)
