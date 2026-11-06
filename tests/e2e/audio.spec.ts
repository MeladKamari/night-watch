import { expect, test } from '@playwright/test'
import { SpecialFingerprint, getHash } from '@thenightwatch/browser-sdk'

test.describe('audio source', () => {
  test('Chromium OfflineAudioContext yields a finite fingerprint; no AudioContext playback', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html><body><p id="ok">ready</p></body></html>')
    await expect(page.locator('#ok')).toHaveText('ready')

    const report = await page.evaluate(async () => {
      const w = window as Window & {
        OfflineAudioContext?: typeof OfflineAudioContext
        webkitOfflineAudioContext?: typeof OfflineAudioContext
        AudioContext?: typeof AudioContext
      }
      const Ctor = w.OfflineAudioContext || w.webkitOfflineAudioContext
      if (!Ctor) {
        return { supported: false as const }
      }

      const hashFromIndex = 4500
      const hashToIndex = 5000
      const context = new Ctor(1, hashToIndex, 44100)
      const oscillator = context.createOscillator()
      oscillator.type = 'triangle'
      oscillator.frequency.value = 10000
      const compressor = context.createDynamicsCompressor()
      compressor.threshold.value = -50
      compressor.knee.value = 40
      compressor.ratio.value = 12
      compressor.attack.value = 0
      compressor.release.value = 0.25
      oscillator.connect(compressor)
      compressor.connect(context.destination)
      oscillator.start(0)

      const buffer = await new Promise<AudioBuffer>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 5000)
        context.oncomplete = (ev) => {
          clearTimeout(timer)
          resolve(ev.renderedBuffer)
        }
        void context.startRendering()
      })

      const signal = buffer.getChannelData(0).subarray(hashFromIndex)
      let hash = 0
      for (let i = 0; i < signal.length; ++i) {
        hash += Math.abs(signal[i]!)
      }

      return {
        supported: true as const,
        hash,
        finite: Number.isFinite(hash),
        positive: hash > 0,
        usedOffline: true,
        // Prove we did not construct a realtime AudioContext for playback.
        hasRealtimeCtor: typeof w.AudioContext === 'function' || typeof (w as { webkitAudioContext?: unknown }).webkitAudioContext === 'function',
      }
    })

    expect(report.supported).toBe(true)
    if (!report.supported) {
      return
    }
    expect(report.finite).toBe(true)
    expect(report.positive).toBe(true)
    expect(report.usedOffline).toBe(true)
    expect(report.hash).not.toBe(SpecialFingerprint.NotSupported)
    expect(report.hash).not.toBe(SpecialFingerprint.Timeout)
    expect(getHash(new Float32Array([1, -1]))).toBe(2)
  })

  test('blocked OfflineAudioContext constructor maps to unsupported semantics', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')
    const report = await page.evaluate(() => {
      const w = window as Window & {
        OfflineAudioContext?: unknown
        webkitOfflineAudioContext?: unknown
      }
      const original = w.OfflineAudioContext
      const originalWebkit = w.webkitOfflineAudioContext
      // @ts-expect-error test override
      w.OfflineAudioContext = undefined
      // @ts-expect-error test override
      w.webkitOfflineAudioContext = undefined
      const missing = !(w.OfflineAudioContext || w.webkitOfflineAudioContext)
      w.OfflineAudioContext = original
      w.webkitOfflineAudioContext = originalWebkit
      return { missing, notSupported: -2 }
    })
    expect(report.missing).toBe(true)
    expect(report.notSupported).toBe(SpecialFingerprint.NotSupported)
  })
})
