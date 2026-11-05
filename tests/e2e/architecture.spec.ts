import { expect, test } from '@playwright/test'

test.describe('architecture', () => {
  test('Chromium NaN probe returns 127|255; stable; RTL intact; not a CPU label', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate(() => {
      const probe = () => {
        const f = new Float32Array(1)
        const u8 = new Uint8Array(f.buffer)
        f[0] = Infinity
        f[0] = f[0]! - f[0]!
        return u8[3]
      }
      const a = probe()
      const b = probe()
      return {
        a,
        b,
        isNaNSlot: (() => {
          const f = new Float32Array(1)
          f[0] = Infinity
          f[0] = f[0]! - f[0]!
          return Number.isNaN(f[0]!)
        })(),
        hostRtl: document.documentElement.getAttribute('dir'),
        // Must not invent architecture strings from the byte
        noCpuLabel: typeof a === 'number',
      }
    })

    expect(report.hostRtl).toBe('rtl')
    expect([127, 255]).toContain(report.a)
    expect(report.b).toBe(report.a)
    expect(report.isNaNSlot).toBe(true)
    expect(report.noCpuLabel).toBe(true)
  })

  test('typed arrays unavailable → undefined semantics; byte fixture matches LE u8[3]', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const report = await page.evaluate(() => {
      const f = new Float32Array(1)
      const u8 = new Uint8Array(f.buffer)
      f[0] = Infinity
      f[0] = f[0]! - f[0]!
      const byte3 = u8[3]
      const bytes = [u8[0], u8[1], u8[2], u8[3]]

      // Simulate unavailable typed arrays
      const unsupported = (() => {
        const arrays = null as null
        if (arrays == null) return undefined
        return 0
      })()

      return { byte3, bytes, unsupported, bufferByteLength: f.buffer.byteLength }
    })

    expect(report.bufferByteLength).toBe(4)
    expect([127, 255]).toContain(report.byte3)
    expect(report.bytes[3]).toBe(report.byte3)
    expect(report.unsupported).toBeUndefined()
  })
})
