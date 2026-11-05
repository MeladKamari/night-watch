import { describe, expect, it } from 'vitest'
import {
  CONSOLE_MODULES,
  DEFERRED_NATIVE_SIGNAL_CATALOG,
  WEB_SMART_SIGNAL_IDS,
  modulesForRole,
} from './console-modules.js'

describe('console modules catalog', () => {
  it('lists dashboard modules and 19+10 smart signal inventory', () => {
    expect(CONSOLE_MODULES.length).toBeGreaterThanOrEqual(14)
    expect(WEB_SMART_SIGNAL_IDS).toHaveLength(21)
    expect(DEFERRED_NATIVE_SIGNAL_CATALOG).toHaveLength(10)
    expect(modulesForRole('viewer').every((m) => m.minRole === 'viewer')).toBe(true)
    expect(modulesForRole('admin').some((m) => m.id === 'api_keys')).toBe(true)
  })
})
