/**
 * CSP / Trusted Types compatibility notes and runtime guards.
 * Agent never uses eval/new Function or remote imports.
 */
export const CSP_RECOMMENDATIONS = {
  scriptSrc: ["'self'"],
  connectSrc: ["'self'"],
  workerSrc: ["'self'", 'blob:'],
  objectSrc: ["'none'"],
  notes: [
    'No eval or new Function in @night-watch/web-agent',
    'No unsafe-inline requirement',
    'First-party connect-src only by default',
    'Integrity-pin script tags when serving IIFE/UMD from first-party origin',
  ],
} as const

export function assertNoDynamicCodePatterns(sourceText: string): string[] {
  const hits: string[] = []
  if (/\beval\s*\(/.test(sourceText)) hits.push('eval')
  if (/new\s+Function\s*\(/.test(sourceText)) hits.push('new_Function')
  if (/import\s*\(\s*['"]https?:/.test(sourceText)) hits.push('remote_import')
  return hits
}

export function reducedPermissionFallback(env: {
  isIframe?: boolean
  sandboxFlags?: string
  storageBlocked?: boolean
}): { mode: 'full' | 'reduced'; reasons: string[] } {
  const reasons: string[] = []
  if (env.isIframe) reasons.push('iframe')
  if (env.sandboxFlags?.includes('allow-scripts') === false) reasons.push('sandbox_no_scripts')
  if (env.storageBlocked) reasons.push('storage_blocked')
  return { mode: reasons.length ? 'reduced' : 'full', reasons }
}
