import { expect, test } from '@playwright/test'

test.describe('privateClickMeasurement', () => {
  test('Chromium has no PCM props → undefined; no click/nav/network; RTL intact', async ({
    page,
  }) => {
    const requests: string[] = []
    page.on('request', (req) => {
      requests.push(req.url())
    })

    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate(() => {
      const beforeChildren = document.body.childElementCount
      const link = document.createElement('a')
      const camel = (link as HTMLAnchorElement & { attributionSourceId?: unknown })
        .attributionSourceId
      const lower = (link as HTMLAnchorElement & { attributionsourceid?: unknown })
        .attributionsourceid
      const sourceId = camel ?? lower
      const value = sourceId === undefined ? undefined : String(sourceId)
      const afterChildren = document.body.childElementCount
      // Must not have been appended
      const stillDetached = link.parentNode === null

      return {
        value,
        camel,
        lower,
        beforeChildren,
        afterChildren,
        stillDetached,
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    })

    expect(report.hostRtl).toBe('rtl')
    expect(report.value).toBeUndefined()
    expect(report.camel).toBeUndefined()
    expect(report.lower).toBeUndefined()
    expect(report.beforeChildren).toBe(report.afterChildren)
    expect(report.stillDetached).toBe(true)
    // Only the data: document itself — no attribution / beacon traffic
    expect(requests.every((u) => u.startsWith('data:') || u.startsWith('about:'))).toBe(true)
  })

  test('Safari desktop inject → "0"/""; iOS-like absent → undefined; both-null → "null"', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate(() => {
      const read = (link: {
        attributionSourceId?: unknown
        attributionsourceid?: unknown
      }) => {
        const sourceId = link.attributionSourceId ?? link.attributionsourceid
        return sourceId === undefined ? undefined : String(sourceId)
      }

      // Desktop Safari ≥15-like
      const macOs = read({ attributionSourceId: 0 })
      // Desktop Safari 14.x-like
      const macOs14 = read({ attributionSourceId: '' })
      // Mobile Safari: property typically absent
      const ios = read({})
      // Single null falls through ?? → undefined; both null → "null"
      const nullAlone = read({ attributionSourceId: null })
      const bothNull = read({ attributionSourceId: null, attributionsourceid: null })

      return { macOs, macOs14, ios, nullAlone, bothNull }
    })

    expect(report.macOs).toBe('0')
    expect(report.macOs14).toBe('')
    expect(report.ios).toBeUndefined()
    expect(report.nullAlone).toBeUndefined()
    expect(report.bothNull).toBe('null')
  })
})
