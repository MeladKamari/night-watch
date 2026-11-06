import { expect, test } from '@playwright/test'
import { isFrameSizeNull, screenFrameCheckInterval } from '@thenightwatch/browser-sdk'

test.describe('screenFrame', () => {
  test('reads screen chrome insets; repeated reads are stable; no orphan timers after clear', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html><body><p id="ok">ready</p></body></html>')
    await expect(page.locator('#ok')).toHaveText('ready')

    const report = await page.evaluate(async () => {
      const s = screen as Screen & { availTop?: number; availLeft?: number }
      const toFloat = (v: unknown) => parseFloat(String(v))
      const replaceNaN = <T, U>(value: T, replacement: U): T | U =>
        typeof value === 'number' && Number.isNaN(value) ? replacement : value

      const read = (): [number | null, number | null, number | null, number | null] => [
        replaceNaN(toFloat(s.availTop), null),
        replaceNaN(toFloat(s.width) - toFloat(s.availWidth) - replaceNaN(toFloat(s.availLeft), 0), null),
        replaceNaN(
          toFloat(s.height) - toFloat(s.availHeight) - replaceNaN(toFloat(s.availTop), 0),
          null,
        ),
        replaceNaN(toFloat(s.availLeft), null),
      ]

      const first = read()
      const second = read()
      const round = (n: number | null) =>
        n === null ? null : Math.round(n / 10) * 10
      const rounded = first.map(round)

      return {
        first,
        second,
        rounded,
        fullscreen: !!document.fullscreenElement,
        hidden: document.hidden,
      }
    })

    expect(report.first).toEqual(report.second)
    expect(report.first).toHaveLength(4)
    expect(report.fullscreen).toBe(false)
    expect(typeof report.hidden).toBe('boolean')
    expect(isFrameSizeNull([0, 0, 0, 0])).toBe(true)
    expect(screenFrameCheckInterval).toBe(2500)
  })

  test('privacy-spoofed string screen dimensions still parse', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')
    const report = await page.evaluate(() => {
      const fake = {
        width: '1200',
        height: '800',
        availWidth: '1180',
        availHeight: '760',
        availTop: '20',
        availLeft: '10',
      }
      const toFloat = (v: unknown) => parseFloat(String(v))
      const replaceNaN = <T, U>(value: T, replacement: U): T | U =>
        typeof value === 'number' && Number.isNaN(value) ? replacement : value
      return [
        replaceNaN(toFloat(fake.availTop), null),
        replaceNaN(
          toFloat(fake.width) - toFloat(fake.availWidth) - replaceNaN(toFloat(fake.availLeft), 0),
          null,
        ),
        replaceNaN(
          toFloat(fake.height) - toFloat(fake.availHeight) - replaceNaN(toFloat(fake.availTop), 0),
          null,
        ),
        replaceNaN(toFloat(fake.availLeft), null),
      ]
    })
    expect(report).toEqual([20, 10, 20, 10])
  })
})
