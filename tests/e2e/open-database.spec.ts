import { expect, test } from '@playwright/test'

test.describe('openDatabase', () => {
  test('Chromium has WebSQL removed → false; inject old WebKit shape → true; no call', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate(() => {
      const probe = (windowLike: { openDatabase?: unknown } | null): boolean => {
        if (windowLike == null) {
          return false
        }
        return !!windowLike.openDatabase
      }

      let called = false
      const fakeOpen = () => {
        called = true
      }

      return {
        native: probe(window as unknown as { openDatabase?: unknown }),
        injected: probe({ openDatabase: fakeOpen }),
        called,
        missing: probe({}),
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    })

    expect(report.native).toBe(false)
    expect(report.injected).toBe(true)
    expect(report.called).toBe(false)
    expect(report.missing).toBe(false)
    expect(report.hostRtl).toBe('rtl')
  })
})
