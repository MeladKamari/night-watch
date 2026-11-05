import {
  awaitIfAsync,
  isPromise,
  mapWithBreaks,
  releaseEventLoop,
  requestIdleCallbackIfAvailable,
  suppressUnhandledRejectionWarning,
  wait,
} from '@night-watch/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('scheduler', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('wait', () => {
    it('resolves after the fallback duration with the provided value', async () => {
      vi.useFakeTimers()
      const pending = wait(50, 'done')
      let settled = false
      void pending.then(() => {
        settled = true
      })
      await vi.advanceTimersByTimeAsync(49)
      expect(settled).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      await expect(pending).resolves.toBe('done')
      expect(settled).toBe(true)
    })
  })

  describe('requestIdleCallbackIfAvailable', () => {
    it('uses finite setTimeout fallback when requestIdleCallback is absent', async () => {
      vi.useFakeTimers()
      const pending = requestIdleCallbackIfAvailable(40, 100)
      let settled = false
      void pending.then(() => {
        settled = true
      })
      await vi.advanceTimersByTimeAsync(39)
      expect(settled).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      await expect(pending).resolves.toBeUndefined()
    })

    it('caps fallback wait at deadlineTimeout', async () => {
      vi.useFakeTimers()
      const pending = requestIdleCallbackIfAvailable(200, 30)
      let settled = false
      void pending.then(() => {
        settled = true
      })
      await vi.advanceTimersByTimeAsync(29)
      expect(settled).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      await expect(pending).resolves.toBeUndefined()
    })

    it('prefers requestIdleCallback when present on window', async () => {
      const fakeRic = vi.fn((cb: () => void, _options?: { timeout?: number }) => {
        queueMicrotask(cb)
        return 1
      })

      vi.stubGlobal('window', {
        requestIdleCallback: fakeRic,
      })

      await requestIdleCallbackIfAvailable(50, 75)
      expect(fakeRic).toHaveBeenCalledTimes(1)
      expect(fakeRic.mock.calls[0]?.[1]).toEqual({ timeout: 75 })
    })
  })

  describe('awaitIfAsync / isPromise', () => {
    it('handles sync success, sync throw, and async paths', async () => {
      expect(isPromise(Promise.resolve(1))).toBe(true)
      expect(isPromise(1)).toBe(false)

      const sync: Array<unknown> = []
      awaitIfAsync(
        () => 7,
        (ok, value) => sync.push(ok, value),
      )
      expect(sync).toEqual([true, 7])

      const fail: Array<unknown> = []
      awaitIfAsync(
        () => {
          throw new Error('sync-fail')
        },
        (ok, value) => fail.push(ok, value),
      )
      expect(fail[0]).toBe(false)
      expect(fail[1]).toBeInstanceOf(Error)

      const asyncOk = await new Promise<unknown>((resolve) => {
        awaitIfAsync(
          () => Promise.resolve('async'),
          (ok, value) => resolve([ok, value]),
        )
      })
      expect(asyncOk).toEqual([true, 'async'])

      const asyncFail = await new Promise<unknown>((resolve) => {
        awaitIfAsync(
          () => Promise.reject(new Error('async-fail')),
          (ok, value) => resolve([ok, value]),
        )
      })
      expect(asyncFail).toEqual([false, expect.any(Error)])
    })
  })

  describe('suppressUnhandledRejectionWarning', () => {
    it('prevents unhandledRejection while preserving rejection for awaiters', async () => {
      const seen: unknown[] = []
      const onUnhandled = (reason: unknown) => {
        seen.push(reason)
      }
      process.on('unhandledRejection', onUnhandled)

      const rejected = Promise.reject(new Error('hidden'))
      suppressUnhandledRejectionWarning(rejected)

      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      await Promise.resolve()
      await Promise.resolve()

      process.off('unhandledRejection', onUnhandled)
      expect(seen).toHaveLength(0)
      await expect(rejected).rejects.toThrow('hidden')
    })
  })

  describe('mapWithBreaks / releaseEventLoop', () => {
    it('preserves order and maps all items without forced yields', async () => {
      const out = await mapWithBreaks([1, 2, 3, 4], (n, index) => n * 10 + index, 10_000)
      expect(out).toEqual([10, 21, 32, 43])
    })

    it('continues in order when the release interval forces event-loop yields', async () => {
      let now = 0
      vi.spyOn(Date, 'now').mockImplementation(() => now)

      const seen: number[] = []
      const out = await mapWithBreaks(
        [1, 2, 3],
        (item) => {
          seen.push(item)
          now += 20
          return item * 2
        },
        16,
      )

      expect(seen).toEqual([1, 2, 3])
      expect(out).toEqual([2, 4, 6])
    })

    it('releaseEventLoop resolves without throwing under Node', async () => {
      await expect(releaseEventLoop()).resolves.toBeUndefined()
    })
  })
})
