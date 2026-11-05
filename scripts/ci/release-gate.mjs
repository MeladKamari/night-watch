/**
 * Release-candidate hard gate (step 62).
 * Verifies Default-profile 41 sources, excluded payment source absent, per-source
 * unit+e2e fixtures, filtered-hash / coverage evidence files, and package metadata.
 *
 * Does **not** publish. Exit 0 = ready for annotated tag (local); 1 = blocked.
 *
 * Usage: node scripts/ci/release-gate.mjs [--root <path>] [--json]
 */

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = join(SCRIPT_DIR, '../..')

/** Source name → kebab unit/e2e basename (tests/<name>.test.ts, tests/e2e/<name>.spec.ts). */
export const SOURCE_TEST_BASENAMES = {
  userAgentData: 'user-agent-data',
  fonts: 'fonts',
  domBlockers: 'dom-blockers',
  fontPreferences: 'font-preferences',
  audio: 'audio',
  screenFrame: 'screen-frame',
  canvas: 'canvas',
  osCpu: 'os-cpu',
  languages: 'languages',
  colorDepth: 'color-depth',
  deviceMemory: 'device-memory',
  screenResolution: 'screen-resolution',
  hardwareConcurrency: 'hardware-concurrency',
  timezone: 'timezone',
  sessionStorage: 'session-storage',
  localStorage: 'local-storage',
  indexedDB: 'indexed-db',
  openDatabase: 'open-database',
  cpuClass: 'cpu-class',
  platform: 'platform',
  plugins: 'plugins',
  touchSupport: 'touch-support',
  vendor: 'vendor',
  vendorFlavors: 'vendor-flavors',
  cookiesEnabled: 'cookies-enabled',
  colorGamut: 'color-gamut',
  invertedColors: 'inverted-colors',
  forcedColors: 'forced-colors',
  monochrome: 'monochrome',
  contrast: 'contrast',
  reducedMotion: 'reduced-motion',
  reducedTransparency: 'reduced-transparency',
  hdr: 'hdr',
  math: 'math',
  pdfViewerEnabled: 'pdf-viewer-enabled',
  architecture: 'architecture',
  privateClickMeasurement: 'private-click-measurement',
  audioBaseLatency: 'audio-base-latency',
  dateTimeLocale: 'date-time-locale',
  webGlBasics: 'webgl-basics',
  webGlExtensions: 'webgl-extensions',
}

export function parseArgs(argv) {
  let root = DEFAULT_ROOT
  let json = false
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root' && argv[i + 1]) root = argv[++i]
    if (argv[i] === '--json') json = true
  }
  return { root, json }
}

function loadCore(root) {
  const dist = join(root, 'packages/core/dist/index.js')
  if (!existsSync(dist)) {
    throw new Error('packages/core/dist missing — run pnpm build first')
  }
  return import(pathToFileURL(dist).href)
}

function loadSdkMeta(root) {
  const pkg = JSON.parse(readFileSync(join(root, 'packages/browser-sdk/package.json'), 'utf8'))
  const corePkg = JSON.parse(readFileSync(join(root, 'packages/core/package.json'), 'utf8'))
  return { pkg, corePkg }
}

/**
 * @returns {{ ok: boolean, checks: Array<{ id: string, ok: boolean, detail: string }>, version: string }}
 */
export async function runReleaseGate(root = DEFAULT_ROOT) {
  const checks = []
  const push = (id, ok, detail) => {
    checks.push({ id, ok, detail })
  }

  const core = await loadCore(root)
  const { pkg, corePkg } = loadSdkMeta(root)

  push(
    'enabled_count_41',
    core.ENABLED_SOURCE_COUNT === 41 && core.ENABLED_SOURCES.length === 41,
    `ENABLED_SOURCE_COUNT=${core.ENABLED_SOURCE_COUNT}`,
  )
  push(
    'applePay_absent_registry',
    !core.ENABLED_SOURCES.includes('applePay') &&
      core.EXCLUDED_UPSTREAM_SOURCE === 'applePay',
    `excluded=${core.EXCLUDED_UPSTREAM_SOURCE}`,
  )
  try {
    core.assertDefaultRegistryInvariants()
    push('registry_invariants', true, 'assertDefaultRegistryInvariants ok')
  } catch (err) {
    push('registry_invariants', false, String(err))
  }

  push(
    'manifest_revision',
    core.SOURCE_MANIFEST_REVISION === 'default-v1',
    String(core.SOURCE_MANIFEST_REVISION),
  )

  // Per-source unit + e2e fixtures
  let missingTests = 0
  for (const name of core.ENABLED_SOURCES) {
    const base = SOURCE_TEST_BASENAMES[name]
    if (!base) {
      missingTests++
      push(`source_map_${name}`, false, 'no basename mapping')
      continue
    }
    const unit = join(root, 'tests', `${base}.test.ts`)
    const e2e = join(root, 'tests/e2e', `${base}.spec.ts`)
    const ok = existsSync(unit) && existsSync(e2e)
    if (!ok) missingTests++
    push(
      `source_tests_${name}`,
      ok,
      ok ? `${base}.test.ts + e2e/${base}.spec.ts` : `missing unit/e2e for ${base}`,
    )
  }
  push(
    'all_41_source_test_pairs',
    missingTests === 0 && Object.keys(SOURCE_TEST_BASENAMES).length === 41,
    `missingPairs=${missingTests}; mapSize=${Object.keys(SOURCE_TEST_BASENAMES).length}`,
  )

  // Evidence artifacts
  const evidence = [
    'reference/upstream-diff-report.md',
    'reference/upstream-diff-report.json',
    'reference/perf-entropy-report.md',
    'reference/PARITY_MATRIX.md',
    'docs/BROWSER_COVERAGE.md',
    'LICENSE',
    'NOTICE',
    'CHANGELOG.md',
    'docs/RELEASE_CHECKLIST.md',
    'docs/ROLLBACK.md',
    'docs/TAG_PLAN.md',
  ]
  for (const rel of evidence) {
    push(`evidence_${rel}`, existsSync(join(root, rel)), rel)
  }

  // fa-IR / Asia/Tehran fixture mentions in matrix e2e
  const matrix = readFileSync(join(root, 'tests/e2e/browser-matrix.spec.ts'), 'utf8')
  push(
    'fa_IR_fixture',
    /fa-IR/.test(matrix) && /Asia\/Tehran/.test(matrix),
    'browser-matrix.spec.ts locale/tz fixtures',
  )

  // No-egress / self-host proof present in matrix
  push(
    'no_egress_proof',
    /no egress|remote\.push|zero.*egress/i.test(matrix) || /remote\.push/.test(matrix),
    'browser-matrix collects with egress assertions',
  )

  // Payment source files absent under production sources
  const sourcesDir = join(root, 'packages/browser-sdk/src/sources')
  const sourceFiles = existsSync(sourcesDir)
    ? readdirSync(sourcesDir).map((n) => n.toLowerCase())
    : []
  const paymentFiles = sourceFiles.filter((n) => /apple.?pay/.test(n))
  push(
    'no_payment_source_files',
    paymentFiles.length === 0,
    paymentFiles.length ? paymentFiles.join(',') : 'none',
  )

  // Guard script exists
  push(
    'ci_guard_script',
    existsSync(join(root, 'scripts/ci/guard-excluded-payment-source.mjs')),
    'scripts/ci/guard-excluded-payment-source.mjs',
  )

  // Package metadata for RC
  const versionOk =
    typeof pkg.version === 'string' &&
    pkg.version === corePkg.version &&
    (/^1\.\d+\.\d+$/.test(pkg.version) || /-rc\./.test(pkg.version))
  push(
    'release_version_aligned',
    versionOk,
    `browser-sdk=${pkg.version}; core=${corePkg.version}`,
  )
  push(
    'package_license_mit',
    pkg.license === 'MIT' && corePkg.license === 'MIT',
    `sdk=${pkg.license}; core=${corePkg.license}`,
  )
  const isStable = /^1\.\d+\.\d+$/.test(String(pkg.version))
  const tagOk = isStable
    ? pkg.publishConfig?.tag === 'latest' &&
      corePkg.publishConfig?.tag === 'latest' &&
      pkg.publishConfig?.access === 'public' &&
      corePkg.publishConfig?.access === 'public'
    : pkg.publishConfig?.tag === 'next' && corePkg.publishConfig?.tag === 'next'
  push(
    'release_dist_tag',
    tagOk,
    isStable
      ? '1.x packages use npm dist-tag "latest" + public access'
      : 'RC packages use npm dist-tag "next"',
  )
  push(
    'package_license_files',
    existsSync(join(root, 'packages/browser-sdk/LICENSE')) &&
      existsSync(join(root, 'packages/browser-sdk/NOTICE')) &&
      existsSync(join(root, 'packages/core/LICENSE')) &&
      existsSync(join(root, 'packages/core/NOTICE')),
    'LICENSE+NOTICE packaged beside dist',
  )

  // Bundles must not contain getApplePay
  const iife = join(root, 'packages/browser-sdk/dist/fp.min.js')
  if (existsSync(iife)) {
    const text = readFileSync(iife, 'utf8')
    push(
      'bundle_no_getApplePay',
      !/\bgetApplePay(?:State)?\b/.test(text) && !/\bApplePaySession\b/.test(text),
      'fp.min.js scanned',
    )
  } else {
    push('bundle_no_getApplePay', false, 'fp.min.js missing')
  }

  const ok = checks.every((c) => c.ok)
  return {
    ok,
    version: pkg.version,
    manifest: core.SOURCE_MANIFEST_REVISION,
    enabledSourceCount: core.ENABLED_SOURCE_COUNT,
    checks,
    generatedAtIso: new Date().toISOString(),
  }
}

function isCli() {
  const entry = process.argv[1]
  if (!entry) return false
  return entry.replace(/\\/g, '/').endsWith('scripts/ci/release-gate.mjs')
}

if (isCli()) {
  const { root, json } = parseArgs(process.argv.slice(2))
  const report = await runReleaseGate(root)
  const outDir = join(root, 'reference')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'release-gate-report.json'), `${JSON.stringify(report, null, 2)}\n`)

  const md = [
    '# Release gate report',
    '',
    `Generated: \`${report.generatedAtIso}\``,
    `Version: \`${report.version}\``,
    `Manifest: \`${report.manifest}\` (${report.enabledSourceCount} sources)`,
    `Overall: **${report.ok ? 'PASS' : 'FAIL'}**`,
    '',
    '| Check | OK | Detail |',
    '|---|:---:|---|',
    ...report.checks.map(
      (c) => `| \`${c.id}\` | ${c.ok ? 'yes' : 'NO'} | ${c.detail.replace(/\|/g, '/')} |`,
    ),
    '',
    'Remote npm/git publish was **not** performed.',
    '',
  ].join('\n')
  writeFileSync(join(outDir, 'release-gate-report.md'), `${md}\n`)

  if (json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log(md)
  }
  process.exitCode = report.ok ? 0 : 1
}
