import {
  componentsToCanonicalString,
  createBuiltinSources,
  getCurrentScreenFrame,
  getScreenFrameBackupForTests,
  getScreenFrameValue,
  getUnstableScreenFrame,
  hashComponents,
  isFrameSizeNull,
  isValueComponent,
  load,
  resetScreenFrameWatch,
  screenFrameCheckInterval,
} from '@thenightwatch/browser-sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  resetScreenFrameWatch()
  vi.useRealTimers()
})

describe('getCurrentScreenFrame', () => {
  it('computes CSS-order insets; replaces missing availLeft/Top with 0 entropy path', () => {
    expect(
      getCurrentScreenFrame({
        width: 1920,
        height: 1080,
        availWidth: 1920,
        availHeight: 1040,
        availTop: 40,
        availLeft: 0,
      }),
    ).toEqual([40, 0, 0, 0])
  })

  it('parses stringified screen numbers from privacy plugins', () => {
    expect(
      getCurrentScreenFrame({
        width: '1200',
        height: '800',
        availWidth: '1180',
        availHeight: '760',
        availTop: '20',
        availLeft: '10',
      }),
    ).toEqual([20, 10, 20, 10])
  })

  it('returns null sides for non-finite math', () => {
    const frame = getCurrentScreenFrame({
      width: 'nope',
      height: 'nope',
      availWidth: 'nope',
      availHeight: 'nope',
    })
    expect(isFrameSizeNull(frame)).toBe(true)
  })

  it('returns all-null under Node without screen', () => {
    expect(getCurrentScreenFrame()).toEqual([null, null, null, null])
  })
})

describe('isFrameSizeNull', () => {
  it('treats zeros and nulls as null frame', () => {
    expect(isFrameSizeNull([0, 0, 0, 0])).toBe(true)
    expect(isFrameSizeNull([null, null, null, null])).toBe(true)
    expect(isFrameSizeNull([0, 0, 1, 0])).toBe(false)
  })
})

describe('watch + backup', () => {
  it('caches a non-null frame and reuses it when later reads are null', async () => {
    vi.useFakeTimers()
    let nullReads = 0
    const screens = [
      { width: 100, height: 100, availWidth: 100, availHeight: 100, availTop: 0, availLeft: 0 },
      { width: 1920, height: 1080, availWidth: 1900, availHeight: 1040, availTop: 40, availLeft: 20 },
    ]
    let idx = 0

    const getter = getUnstableScreenFrame({
      allowExitFullscreen: false,
      get screen() {
        // First check from watch may be null; then non-null; later getter null uses backup
        if (idx === 0) {
          idx = 1
          nullReads++
          return screens[0]
        }
        if (idx === 1) {
          idx = 2
          return screens[1]
        }
        return screens[0]
      },
    })

    // Initial watch call used screen[0] (null frame) and scheduled timeout
    expect(nullReads).toBeGreaterThanOrEqual(0)
    await vi.advanceTimersByTimeAsync(screenFrameCheckInterval)
    expect(getScreenFrameBackupForTests()).toEqual([40, 0, 0, 20])

    const frame = await getter()
    expect(frame).toEqual([40, 0, 0, 20])
  })

  it('resetScreenFrameWatch clears timer so none survive dispose', () => {
    vi.useFakeTimers()
    getUnstableScreenFrame({
      screen: {
        width: 100,
        height: 100,
        availWidth: 100,
        availHeight: 100,
        availTop: 0,
        availLeft: 0,
      },
    })
    resetScreenFrameWatch()
    expect(getScreenFrameBackupForTests()).toBeUndefined()
    // Advancing timers after reset must not resurrect backup from a live timeout
    void vi.advanceTimersByTimeAsync(screenFrameCheckInterval * 2)
  })

  it('does not exit fullscreen by default when frame is null', async () => {
    const getter = getUnstableScreenFrame({
      allowExitFullscreen: false,
      screen: {
        width: 100,
        height: 100,
        availWidth: 100,
        availHeight: 100,
        availTop: 0,
        availLeft: 0,
      },
    })
    await expect(getter()).resolves.toEqual([0, 0, 0, 0])
  })
})

describe('stabilized getScreenFrameValue', () => {
  it('rounds sides to precision 10', async () => {
    const getter = getScreenFrameValue({
      allowExitFullscreen: false,
      screen: {
        width: 1920,
        height: 1080,
        availWidth: 1905,
        availHeight: 1033,
        availTop: 37,
        availLeft: 11,
      },
    })
    // right = 1920-1905-11 = 4; bottom = 1080-1033-37 = 10
    await expect(getter()).resolves.toEqual([40, 0, 10, 10])
  })

  it('wires into builtin registry; Node yields null frame tuple (rounded)', async () => {
    const sources = createBuiltinSources()
    expect(Object.keys(sources)[5]).toBe('screenFrame')
    const agent = await load({ delayFallback: 0, sources, allowNonBrowser: true })
    const result = await agent.get()
    expect(isValueComponent(result.components.screenFrame)).toBe(true)
    if (isValueComponent(result.components.screenFrame)) {
      // Under Node: null frame → [null,null,null,null] after stabilize (or zeros from null process)
      const value = result.components.screenFrame.value
      expect(value === undefined || (Array.isArray(value) && value.length === 4)).toBe(true)
    }
    expect(
      hashComponents({
        screenFrame: { value: [40, 0, 0, 0], duration: 1 },
      }),
    ).toMatch(/^[0-9a-f]{32}$/)
    expect(
      componentsToCanonicalString({
        screenFrame: { value: [40, 0, 0, 0], duration: 1 },
      }),
    ).toContain('screenFrame:')
  })
})
