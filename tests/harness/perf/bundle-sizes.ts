import { gzipSync } from 'node:zlib'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { BundleSizeRow } from './types.js'

/** Default publish artifacts relative to `packages/browser-sdk/dist`. */
export const DEFAULT_BUNDLE_RELATIVE_PATHS = [
  'fp.min.js',
  'fp.umd.min.js',
  'fp.esm.min.js',
  'fp.min.cjs',
] as const

/** Measures uncompressed + gzip sizes for existing files under `distRoot`. */
export function measureBundleSizes(
  distRoot: string,
  relativePaths: readonly string[] = DEFAULT_BUNDLE_RELATIVE_PATHS,
): BundleSizeRow[] {
  const rows: BundleSizeRow[] = []
  for (const relative of relativePaths) {
    const absolute = join(distRoot, relative)
    if (!existsSync(absolute)) {
      continue
    }
    const raw = readFileSync(absolute)
    const gzipped = gzipSync(raw, { level: 9 })
    rows.push({
      path: relative.replace(/\\/g, '/'),
      bytesUncompressed: raw.byteLength,
      bytesGzip: gzipped.byteLength,
    })
  }
  return rows
}
