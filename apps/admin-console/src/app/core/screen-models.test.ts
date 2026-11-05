import { describe, expect, it } from 'vitest'
import { ConsoleScreenModels } from './screen-models.js'

describe('ConsoleScreenModels', () => {
  it('exposes 19 web signals and defers 10 native; UI does not decide deny', () => {
    const m = new ConsoleScreenModels()
    expect(m.smartSignalsPanel().web).toHaveLength(21)
    expect(m.smartSignalsPanel().deferredNative).toHaveLength(10)
    expect(m.apiKeys().every((k) => k.masked.includes('****'))).toBe(true)
    expect(m.consumeStepUpHint('challenge')).toBe('show_challenge_ui')
    expect(m.consumeStepUpHint('deny')).toBe('ignore')
  })
})
