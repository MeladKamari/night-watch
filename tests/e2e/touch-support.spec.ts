import { expect, test } from '@playwright/test'

test.describe('touchSupport', () => {
  test('Chromium reports maxTouchPoints + touchEvent + touchStart; RTL intact', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate(() => {
      const n = navigator
      let maxTouchPoints = 0
      if (n.maxTouchPoints !== undefined) {
        maxTouchPoints = parseInt(String(n.maxTouchPoints), 10)
      } else if (
        (n as Navigator & { msMaxTouchPoints?: number }).msMaxTouchPoints !== undefined
      ) {
        maxTouchPoints = (n as Navigator & { msMaxTouchPoints?: number }).msMaxTouchPoints!
      }

      let touchEvent: boolean
      try {
        document.createEvent('TouchEvent')
        touchEvent = true
      } catch {
        touchEvent = false
      }

      const touchStart = 'ontouchstart' in window

      return {
        maxTouchPoints,
        touchEvent,
        touchStart,
        maxTouchPointsIsNumber: typeof maxTouchPoints === 'number',
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    })

    expect(report.hostRtl).toBe('rtl')
    expect(report.maxTouchPointsIsNumber).toBe(true)
    expect(report.maxTouchPoints).toBeGreaterThanOrEqual(0)
    expect(typeof report.touchEvent).toBe('boolean')
    expect(typeof report.touchStart).toBe('boolean')
  })

  test('hybrid / synthetic injects: points, TouchEvent fail, ontouchstart independent', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate(() => {
      const collect = (opts: {
        maxTouchPoints?: number
        msMaxTouchPoints?: number
        touchEventOk: boolean
        hasOntouchstart: boolean
      }) => {
        let maxTouchPoints = 0
        if (opts.maxTouchPoints !== undefined) {
          maxTouchPoints = parseInt(String(opts.maxTouchPoints), 10)
        } else if (opts.msMaxTouchPoints !== undefined) {
          maxTouchPoints = opts.msMaxTouchPoints
        }

        let touchEvent: boolean
        try {
          if (!opts.touchEventOk) {
            throw new Error('NOT_SUPPORTED_ERR')
          }
          touchEvent = true
        } catch {
          touchEvent = false
        }

        const win = opts.hasOntouchstart ? { ontouchstart: null } : {}
        const touchStart = 'ontouchstart' in win

        return { maxTouchPoints, touchEvent, touchStart }
      }

      return {
        hybridLaptop: collect({
          maxTouchPoints: 1,
          touchEventOk: true,
          hasOntouchstart: true,
        }),
        noTouch: collect({
          maxTouchPoints: 0,
          touchEventOk: false,
          hasOntouchstart: false,
        }),
        legacyMs: collect({
          msMaxTouchPoints: 2,
          touchEventOk: false,
          hasOntouchstart: false,
        }),
        negativePoints: collect({
          maxTouchPoints: -1,
          touchEventOk: false,
          hasOntouchstart: false,
        }),
      }
    })

    expect(report.hybridLaptop).toEqual({
      maxTouchPoints: 1,
      touchEvent: true,
      touchStart: true,
    })
    expect(report.noTouch).toEqual({
      maxTouchPoints: 0,
      touchEvent: false,
      touchStart: false,
    })
    expect(report.legacyMs).toEqual({
      maxTouchPoints: 2,
      touchEvent: false,
      touchStart: false,
    })
    expect(report.negativePoints).toEqual({
      maxTouchPoints: -1,
      touchEvent: false,
      touchStart: false,
    })
  })
})
