import { expect, test } from '@playwright/test'

const VENDOR_FLAVOR_KEYS = [
  'chrome',
  'safari',
  '__crWeb',
  '__gCrWeb',
  'yandex',
  '__yb',
  '__ybro',
  '__firefox__',
  '__edgeTrackingPreventionStatistics',
  'webkit',
  'oprt',
  'samsungAr',
  'ucweb',
  'UCShellJava',
  'puffinDevice',
] as const

test.describe('vendorFlavors', () => {
  test('live window yields sorted allowlist names only; chrome object counted when present; RTL intact', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate((keys) => {
      const win = window as unknown as Record<string, unknown>
      const flavors: string[] = []
      for (const key of keys) {
        const value = win[key]
        if (value && typeof value === 'object') {
          flavors.push(key)
        }
      }
      const sorted = flavors.sort()
      const chromeRaw = win.chrome

      return {
        flavors: sorted,
        chromePresentAsObject: !!(chromeRaw && typeof chromeRaw === 'object'),
        allAllowlisted: sorted.every((k) => (keys as readonly string[]).includes(k)),
        chromeCountedIffObject:
          sorted.includes('chrome') === !!(chromeRaw && typeof chromeRaw === 'object'),
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    }, VENDOR_FLAVOR_KEYS)

    expect(report.hostRtl).toBe('rtl')
    expect(report.allAllowlisted).toBe(true)
    expect(report.chromeCountedIffObject).toBe(true)
    expect(report.flavors).toEqual([...report.flavors].sort())
    // Headless Playwright may omit window.chrome; headed Chromium usually has it.
    expect(typeof report.chromePresentAsObject).toBe('boolean')
  })

  test('non-object / null / false-positive globals are excluded; order sorted', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate((keys) => {
      const collect = (win: Record<string, unknown>) => {
        const flavors: string[] = []
        for (const key of keys) {
          const value = win[key]
          if (value && typeof value === 'object') {
            flavors.push(key)
          }
        }
        return flavors.sort()
      }

      return {
        mixed: collect({
          chrome: { runtime: {} },
          safari: 'string-false-positive',
          yandex: null,
          __firefox__: 1,
          oprt: {},
          fakeExtra: { should: 'ignore' },
        }),
        empty: collect({}),
        crossOriginLike: collect({
          // Mimic cross-origin opaque access pattern: only allowlisted object keys count
          chrome: Object.create(null),
          webkit: Object.create(null),
        }),
      }
    }, VENDOR_FLAVOR_KEYS)

    expect(report.mixed).toEqual(['chrome', 'oprt'])
    expect(report.empty).toEqual([])
    expect(report.crossOriginLike).toEqual(['chrome', 'webkit'])
  })
})
