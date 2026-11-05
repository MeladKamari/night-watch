/**
 * Static CI guard: fail if the excluded payment capability source is
 * implemented, registered, or imported in production package sources/bundles.
 *
 * Allowed: exclusion constants, type-level proofs, ApplePayError engine probe,
 * comments/docs stating the exclusion. Forbidden: Apple Pay APIs / collectors.
 *
 * Usage: node scripts/ci/guard-excluded-payment-source.mjs [--root <path>]
 * Exit 0 = clean; 1 = violations.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = join(SCRIPT_DIR, '../..')

/** Production trees scanned (relative to repo root). */
export const PRODUCTION_SOURCE_DIRS = [
  'packages/core/src',
  'packages/browser-sdk/src',
  'apps/playground/src',
]

/** Built artifacts scanned for collector/API symbols (relative to repo root). */
export const PRODUCTION_BUNDLE_GLOBS = [
  'packages/core/dist',
  'packages/browser-sdk/dist',
]

const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs'])
const BUNDLE_EXT = new Set(['.js', '.cjs', '.mjs'])

/** File basenames that would reintroduce the payment source module. */
const FORBIDDEN_BASENAMES = new Set([
  'apple_pay.ts',
  'apple_pay.js',
  'applepay.ts',
  'applepay.js',
  'apple-pay.ts',
  'apple-pay.js',
])

/**
 * Patterns that indicate a payment API / entropy collector (not exclusion plumbing).
 * Applied after comment stripping on source; raw on minified bundles.
 */
export const FORBIDDEN_CODE_PATTERNS = [
  { id: 'getApplePay', re: /\bgetApplePay(?:State)?\b/ },
  { id: 'ApplePaySession', re: /\bApplePaySession\b/ },
  { id: 'canMakePayments', re: /\.canMakePayments\b/ },
  { id: 'applePay_source_prop', re: /\bapplePay\s*:/ },
  { id: 'import_apple_pay_module', re: /from\s+['"][^'"]*apple[_-]?pay[^'"]*['"]/i },
]

/**
 * Lines that may still mention applePay after comment strip (exclusion / types / engine).
 * A line matching any allow pattern is ignored for applePay_source_prop only when
 * it also matches an allowlist; other forbidden ids always fail.
 */
export const ALLOWED_LINE_PATTERNS = [
  /\bEXCLUDED_UPSTREAM_SOURCE\b/,
  /\bAPPLE_PAY_EXCLUDED\b/,
  /\bAssertApplePayExcluded\b/,
  /\bisExcludedUpstreamSource\b/,
  /\bomitExcludedUpstreamComponents\b/,
  /\bhashComponentsOmittingExcluded\b/,
  /\bApplePayError\b/,
  /\bRegistryInvariantError\b/,
  /Must never include the excluded payment key/,
  /Never registers the excluded upstream payment key/,
  /Excluded upstream/,
  /excluded payment/,
]

/** Strip // and /* *\/ comments (approx; good enough for CI static guard). */
export function stripComments(source) {
  let out = ''
  let i = 0
  const n = source.length
  while (i < n) {
    const c = source[i]
    const next = source[i + 1]
    if (c === '/' && next === '/') {
      i += 2
      while (i < n && source[i] !== '\n') i++
      continue
    }
    if (c === '/' && next === '*') {
      i += 2
      while (i < n - 1 && !(source[i] === '*' && source[i + 1] === '/')) i++
      i = Math.min(n, i + 2)
      out += ' '
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c
      out += c
      i++
      while (i < n) {
        const ch = source[i]
        out += ch
        if (ch === '\\') {
          i++
          if (i < n) {
            out += source[i]
            i++
          }
          continue
        }
        if (ch === quote) {
          i++
          break
        }
        i++
      }
      continue
    }
    out += c
    i++
  }
  return out
}

function walkFiles(dir, exts, out = []) {
  if (!existsSync(dir)) {
    return out
  }
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue
      walkFiles(full, exts, out)
    } else {
      const lower = name.toLowerCase()
      const dot = lower.lastIndexOf('.')
      const ext = dot >= 0 ? lower.slice(dot) : ''
      if (exts.has(ext) && !lower.endsWith('.d.ts') && !lower.endsWith('.map')) {
        out.push(full)
      }
    }
  }
  return out
}

function isAllowedLine(line) {
  return ALLOWED_LINE_PATTERNS.some((re) => re.test(line))
}

/**
 * Scan one source file. Returns violation objects.
 */
export function scanSourceText(filePath, text) {
  const violations = []
  const base = filePath.split(/[/\\]/).pop()?.toLowerCase() ?? ''
  if (FORBIDDEN_BASENAMES.has(base)) {
    violations.push({
      file: filePath,
      id: 'forbidden_filename',
      detail: `basename ${base} is reserved for the excluded payment source`,
    })
  }

  const stripped = stripComments(text)
  const lines = stripped.split(/\r?\n/)
  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    const line = lines[lineNo] ?? ''
    for (const { id, re } of FORBIDDEN_CODE_PATTERNS) {
      if (!re.test(line)) continue
      if (id === 'applePay_source_prop' && isAllowedLine(line)) continue
      // Exclusion constant assignment is allowed: EXCLUDED_UPSTREAM_SOURCE = 'applePay'
      if (id === 'applePay_source_prop' && /EXCLUDED_UPSTREAM_SOURCE/.test(line)) continue
      violations.push({
        file: filePath,
        id,
        detail: `line ${lineNo + 1}: ${line.trim().slice(0, 120)}`,
      })
    }
  }
  return violations
}

/**
 * Scan a built bundle for collector/API symbols (minified-safe).
 */
export function scanBundleText(filePath, text) {
  const violations = []
  for (const { id, re } of FORBIDDEN_CODE_PATTERNS) {
    if (id === 'applePay_source_prop') {
      // Bundles contain EXCLUDED_UPSTREAM_SOURCE:'applePay' — skip property-style check.
      continue
    }
    if (re.test(text)) {
      violations.push({
        file: filePath,
        id,
        detail: 'matched in built artifact',
      })
    }
  }
  // Ensure ENABLED_SOURCES list in bundles is not trivially registering the key as a collectable
  // by looking for getApplePay already covered. Also forbid applePay," next to other sources wrongly —
  // covered by registry unit tests. Extra: fail if function name getApplePay appears.
  return violations
}

/**
 * Assert registry.ts ENABLED_SOURCES array literal does not contain applePay.
 */
export function scanRegistryEnabledSources(registryText) {
  const violations = []
  const match = registryText.match(/export const ENABLED_SOURCES\s*=\s*\[([\s\S]*?)\]\s*as const/)
  if (!match) {
    violations.push({
      file: 'registry',
      id: 'missing_ENABLED_SOURCES',
      detail: 'Could not parse ENABLED_SOURCES array',
    })
    return violations
  }
  const body = match[1] ?? ''
  if (/(^|[\s,])['"]applePay['"]([\s,]|$)/.test(body)) {
    violations.push({
      file: 'registry',
      id: 'ENABLED_SOURCES_contains_applePay',
      detail: 'applePay appears inside ENABLED_SOURCES',
    })
  }
  return violations
}

export function runGuard(root = DEFAULT_ROOT) {
  const violations = []
  const rel = (p) => relative(root, p).split(sep).join('/')

  for (const dirRel of PRODUCTION_SOURCE_DIRS) {
    const dir = join(root, dirRel)
    for (const file of walkFiles(dir, SOURCE_EXT)) {
      const text = readFileSync(file, 'utf8')
      for (const v of scanSourceText(file, text)) {
        violations.push({ ...v, file: rel(file) })
      }
    }
  }

  const registryPath = join(root, 'packages/core/src/registry.ts')
  if (existsSync(registryPath)) {
    for (const v of scanRegistryEnabledSources(readFileSync(registryPath, 'utf8'))) {
      violations.push({ ...v, file: rel(registryPath) })
    }
  }

  for (const dirRel of PRODUCTION_BUNDLE_GLOBS) {
    const dir = join(root, dirRel)
    for (const file of walkFiles(dir, BUNDLE_EXT)) {
      const name = file.split(/[/\\]/).pop() ?? ''
      // Skip declaration emit and sourcemaps companions already filtered; skip nested types folders noise
      if (name.endsWith('.d.ts')) continue
      const text = readFileSync(file, 'utf8')
      for (const v of scanBundleText(file, text)) {
        violations.push({ ...v, file: rel(file) })
      }
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    scannedRoots: [...PRODUCTION_SOURCE_DIRS, ...PRODUCTION_BUNDLE_GLOBS],
  }
}

function parseArgs(argv) {
  let root = DEFAULT_ROOT
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root' && argv[i + 1]) {
      root = argv[++i]
    }
  }
  return { root }
}

function isExecutedAsCli() {
  const entry = process.argv[1]
  if (!entry) return false
  const thisFile = fileURLToPath(import.meta.url)
  try {
    return (
      thisFile === entry ||
      thisFile.toLowerCase() === entry.toLowerCase() ||
      relative(thisFile, entry) === '' ||
      entry.replace(/\\/g, '/').endsWith('scripts/ci/guard-excluded-payment-source.mjs')
    )
  } catch {
    return entry.replace(/\\/g, '/').endsWith('guard-excluded-payment-source.mjs')
  }
}

if (isExecutedAsCli()) {
  const { root } = parseArgs(process.argv.slice(2))
  const result = runGuard(root)
  if (!result.ok) {
    console.error('CI guard FAILED: excluded payment source indicators found:')
    for (const v of result.violations) {
      console.error(`  [${v.id}] ${v.file}: ${v.detail}`)
    }
    process.exitCode = 1
  } else {
    console.log(
      `CI guard PASS: no payment-source collector/API in production trees (${result.scannedRoots.join(', ')})`,
    )
  }
}
