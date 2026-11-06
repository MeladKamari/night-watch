import {
  getDocument,
  isAndroid,
  isBrowserEnvironment,
  isWebKit,
  selectorToElement,
  wait,
  type BuiltinSourceOptions,
  type Source,
} from '@thenightwatch/core'
import { getFilters, type DomBlockerFilters } from './dom_blockers_filters.js'

export type { DomBlockerFilters }
export { getFilters }

/** Share of a filter's selectors that must be blocked to count the filter as active. */
export const DOM_BLOCKER_MATCH_THRESHOLD = 0.6

function countTruthy(values: readonly unknown[]): number {
  let sum = 0
  for (const value of values) {
    if (value) {
      sum += 1
    }
  }
  return sum
}

function forceShow(element: HTMLElement): void {
  element.style.setProperty('visibility', 'hidden', 'important')
  element.style.setProperty('display', 'block', 'important')
}

export type DomBlockersCollectOptions = {
  debug?: boolean
  /**
   * Override browser eligibility (tests). When omitted, uses {@link isDomBlockersApplicable}.
   */
  applicable?: boolean
  /** Injected document (unit tests). Defaults to the live page document. */
  document?: Document
}

/**
 * Safari (desktop/mobile) and Android browsers keep content blockers in regular and private mode.
 * Elsewhere this source yields `undefined` (no fabricated empty list).
 */
export function isDomBlockersApplicable(): boolean {
  if (!isBrowserEnvironment()) {
    return false
  }
  return isWebKit() || isAndroid()
}

/**
 * Probes which selectors are blocked (no `offsetParent`) after attaching to the document.
 * Always removes the probe tree in `finally`. Does not fetch remote resources
 * (selectors intentionally avoid `iframe` / `[src=]` patterns that would navigate).
 */
export async function getBlockedSelectors<T extends string>(
  selectors: readonly T[],
  options: { document?: Document; bodyPollIntervalMs?: number } = {},
): Promise<{ [K in T]?: true }> {
  let doc: Document
  if (options.document) {
    doc = options.document
  } else {
    const probe = getDocument()
    if (probe.status !== 'ok') {
      throw new TypeError('document is unavailable for getBlockedSelectors')
    }
    doc = probe.value
  }
  const poll = options.bodyPollIntervalMs ?? 50

  const root = doc.createElement('div')
  const elements = new Array<HTMLElement>(selectors.length)
  const blockedSelectors: { [K in T]?: true } = {}

  forceShow(root)

  // Create all elements first to avoid interleaved layout thrash.
  for (let i = 0; i < selectors.length; ++i) {
    const element = selectorToElement(selectors[i]!, doc)
    if (element.tagName === 'DIALOG') {
      ;(element as HTMLDialogElement).show()
    }
    const holder = doc.createElement('div')
    forceShow(holder)
    holder.appendChild(element)
    root.appendChild(holder)
    elements[i] = element
  }

  while (!doc.body) {
    await wait(poll)
  }
  doc.body.appendChild(root)

  try {
    for (let i = 0; i < selectors.length; ++i) {
      if (!elements[i]!.offsetParent) {
        blockedSelectors[selectors[i]!] = true
      }
    }
  } finally {
    root.parentNode?.removeChild(root)
  }

  return blockedSelectors
}

function printDebug(
  filters: DomBlockerFilters,
  blockedSelectors: { [K in string]?: true },
): void {
  let message = 'DOM blockers debug:\n```'
  for (const filterName of Object.keys(filters)) {
    message += `\n${filterName}:`
    for (const selector of filters[filterName]!) {
      message += `\n  ${blockedSelectors[selector] ? 'blocked' : 'ok'} ${selector}`
    }
  }
  // Debug-only; gated by options.debug — no emoji dependency for log sinks.
  console.log(`${message}\n\`\`\``)
}

/**
 * Returns alphabetically sorted active content-blocker filter names, or `undefined`
 * when the browser is not eligible. Empty array means “no signal”, not “no blockers”.
 */
export async function collectDomBlockers(
  options: DomBlockersCollectOptions = {},
): Promise<string[] | undefined> {
  const applicable =
    options.applicable !== undefined ? options.applicable : isDomBlockersApplicable()
  if (!applicable) {
    return undefined
  }

  const filters = getFilters()
  const filterNames = Object.keys(filters)
  const allSelectors = ([] as string[]).concat(
    ...filterNames.map((filterName) => filters[filterName]!),
  )
  const blockedSelectors = await getBlockedSelectors(
    allSelectors,
    options.document ? { document: options.document } : {},
  )

  if (options.debug) {
    printDebug(filters, blockedSelectors)
  }

  const activeBlockers = filterNames.filter((filterName) => {
    const selectors = filters[filterName]!
    const blockedCount = countTruthy(selectors.map((selector) => blockedSelectors[selector]))
    return blockedCount > selectors.length * DOM_BLOCKER_MATCH_THRESHOLD
  })
  activeBlockers.sort()
  return activeBlockers
}

/**
 * Entropy source: content-blocker CSS-selector probes (no ad-block circumvention, no fetch).
 */
export const getDomBlockers: Source<BuiltinSourceOptions, string[] | undefined> = (options) =>
  collectDomBlockers({ debug: options.debug === true })
