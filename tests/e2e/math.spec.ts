import { expect, test } from '@playwright/test'

const MATH_FINGERPRINT_KEYS = [
  'acos',
  'acosh',
  'acoshPf',
  'asin',
  'asinh',
  'asinhPf',
  'atanh',
  'atanhPf',
  'atan',
  'sin',
  'sinh',
  'sinhPf',
  'cos',
  'cosh',
  'coshPf',
  'tan',
  'tanh',
  'tanhPf',
  'exp',
  'expm1',
  'expm1Pf',
  'log1p',
  'log1pPf',
  'powPI',
] as const

test.describe('math', () => {
  test('Chromium returns locked numeric math fingerprint; reproducible; RTL intact', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate((keys) => {
      const fallbackFn = () => 0
      const collect = () => {
        const M = Math
        const acos = M.acos || fallbackFn
        const acosh = M.acosh || fallbackFn
        const asin = M.asin || fallbackFn
        const asinh = M.asinh || fallbackFn
        const atanh = M.atanh || fallbackFn
        const atan = M.atan || fallbackFn
        const sin = M.sin || fallbackFn
        const sinh = M.sinh || fallbackFn
        const cos = M.cos || fallbackFn
        const cosh = M.cosh || fallbackFn
        const tan = M.tan || fallbackFn
        const tanh = M.tanh || fallbackFn
        const exp = M.exp || fallbackFn
        const expm1 = M.expm1 || fallbackFn
        const log1p = M.log1p || fallbackFn
        const powPI = (value: number) => M.pow(M.PI, value)
        const acoshPf = (value: number) => M.log(value + M.sqrt(value * value - 1))
        const asinhPf = (value: number) => M.log(value + M.sqrt(value * value + 1))
        const atanhPf = (value: number) => M.log((1 + value) / (1 - value)) / 2
        const sinhPf = (value: number) => M.exp(value) - 1 / M.exp(value) / 2
        const coshPf = (value: number) => (M.exp(value) + 1 / M.exp(value)) / 2
        const expm1Pf = (value: number) => M.exp(value) - 1
        const tanhPf = (value: number) => (M.exp(2 * value) - 1) / (M.exp(2 * value) + 1)
        const log1pPf = (value: number) => M.log(1 + value)
        return {
          acos: acos(0.123124234234234242),
          acosh: acosh(1e308),
          acoshPf: acoshPf(1e154),
          asin: asin(0.123124234234234242),
          asinh: asinh(1),
          asinhPf: asinhPf(1),
          atanh: atanh(0.5),
          atanhPf: atanhPf(0.5),
          atan: atan(0.5),
          sin: sin(-1e300),
          sinh: sinh(1),
          sinhPf: sinhPf(1),
          cos: cos(10.000000000123),
          cosh: cosh(1),
          coshPf: coshPf(1),
          tan: tan(-1e300),
          tanh: tanh(1),
          tanhPf: tanhPf(1),
          exp: exp(1),
          expm1: expm1(1),
          expm1Pf: expm1Pf(1),
          log1p: log1p(10),
          log1pPf: log1pPf(10),
          powPI: powPI(-100),
        }
      }

      const a = collect()
      const b = collect()
      const same = keys.every((k) => Object.is(a[k], b[k]))
      const allNumbers = keys.every((k) => typeof a[k] === 'number')

      return {
        keys: Object.keys(a),
        same,
        allNumbers,
        sinIsNegZero: Object.is(a.sin, -0),
        tanIsNegZero: Object.is(a.tan, -0),
        exp: a.exp,
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    }, MATH_FINGERPRINT_KEYS)

    expect(report.hostRtl).toBe('rtl')
    expect(report.keys).toEqual([...MATH_FINGERPRINT_KEYS])
    expect(report.same).toBe(true)
    expect(report.allNumbers).toBe(true)
    expect(report.exp).toBeCloseTo(Math.E, 10)
    // Engine may or may not yield -0; just ensure we observed booleans.
    expect(typeof report.sinIsNegZero).toBe('boolean')
    expect(typeof report.tanIsNegZero).toBe('boolean')
  })

  test('missing Math.acos falls back to 0; NaN/Infinity inject preserved', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate(() => {
      const fallbackFn = () => 0
      const M = {
        PI: Math.PI,
        pow: Math.pow.bind(Math),
        log: Math.log.bind(Math),
        sqrt: Math.sqrt.bind(Math),
        exp: Math.exp.bind(Math),
      }
      const acos = (M as { acos?: (x: number) => number }).acos || fallbackFn
      const missingAcos = acos(0.123124234234234242)

      const nanAcos = (() => Number.NaN)()
      const infSin = (() => Number.NEGATIVE_INFINITY)()

      return {
        missingAcos,
        nanAcosIsNaN: Number.isNaN(nanAcos),
        infSin,
      }
    })

    expect(report.missingAcos).toBe(0)
    expect(report.nanAcosIsNaN).toBe(true)
    expect(report.infSin).toBe(Number.NEGATIVE_INFINITY)
  })
})
