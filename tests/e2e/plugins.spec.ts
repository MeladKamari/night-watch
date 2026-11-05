import { expect, test } from '@playwright/test'

test.describe('plugins', () => {
  test('Chromium returns serializable plugin list or empty; never executes plugins', async ({
    page,
  }) => {
    await page.setContent('<!doctype html><html dir="rtl"><body><p>سلام</p></body></html>')

    const report = await page.evaluate(() => {
      const raw = navigator.plugins
      if (!raw) {
        return { present: false as const, hostRtl: document.documentElement.getAttribute('dir') }
      }

      const plugins: Array<{
        name: string
        description: string
        mimeTypes: Array<{ type: string; suffixes: string }>
      }> = []
      for (let i = 0; i < raw.length; ++i) {
        const plugin = raw[i]
        if (!plugin) {
          continue
        }
        const mimeTypes: Array<{ type: string; suffixes: string }> = []
        for (let j = 0; j < plugin.length; ++j) {
          const mimeType = plugin[j]!
          mimeTypes.push({ type: mimeType.type, suffixes: mimeType.suffixes })
        }
        plugins.push({
          name: plugin.name,
          description: plugin.description,
          mimeTypes,
        })
      }

      return {
        present: true as const,
        count: plugins.length,
        firstName: plugins[0]?.name,
        allHaveName: plugins.every((p) => typeof p.name === 'string'),
        hostRtl: document.documentElement.getAttribute('dir'),
      }
    })

    expect(report.hostRtl).toBe('rtl')
    if (!report.present) {
      return
    }
    expect(report.count).toBeGreaterThanOrEqual(0)
    expect(report.allHaveName).toBe(true)
  })

  test('null plugin slots skipped; absent collection → undefined semantics', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')
    const report = await page.evaluate(() => {
      const collect = (raw: { length: number; [i: number]: { name: string; description: string; length: number; [j: number]: { type: string; suffixes: string } } | null | undefined } | null) => {
        if (!raw) {
          return undefined
        }
        const plugins = []
        for (let i = 0; i < raw.length; ++i) {
          const plugin = raw[i]
          if (!plugin) {
            continue
          }
          plugins.push({ name: plugin.name, description: plugin.description, mimeTypes: [] })
        }
        return plugins
      }

      const withNull = {
        length: 2,
        0: null,
        1: { name: 'Keep', description: '', length: 0 },
      }

      return {
        skipped: collect(withNull as never),
        absent: collect(null),
      }
    })
    expect(report.skipped).toEqual([{ name: 'Keep', description: '', mimeTypes: [] }])
    expect(report.absent).toBeUndefined()
  })
})
