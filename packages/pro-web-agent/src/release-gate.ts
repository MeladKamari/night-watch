import { ENABLED_SOURCES } from '@thenightwatch/core'
import { assertNoDynamicCodePatterns } from './csp.js'
import { ProWebAgent } from './agent.js'

export const UNSUPPORTED_NATIVE_FEATURES = [
  'emulator_detection',
  'cloned_app_detection',
  'factory_reset_detection',
  'frida_detection',
  'jailbreak_root_detection',
  'location_spoofing_detection',
  'app_cloners_detection',
  'mitm_native_detection',
  'vpn_native_detection',
  'high_demand_native_device',
] as const

export type ReleaseGateReport = {
  sourceCountOk: boolean
  noEval: boolean
  noCrossDeviceGuarantee: true
  unsupportedNativeListed: boolean
  threatsCovered: string[]
}

export function runBrowserReleaseGate(agentSourceText: string): ReleaseGateReport {
  const hits = assertNoDynamicCodePatterns(agentSourceText)
  return {
    sourceCountOk: ProWebAgent.expectedSourceCount() === 41 && ENABLED_SOURCES.length === 41,
    noEval: hits.length === 0,
    noCrossDeviceGuarantee: true,
    unsupportedNativeListed: UNSUPPORTED_NATIVE_FEATURES.length === 10,
    threatsCovered: [
      'payload_modification',
      'replay',
      'ua_spoofing',
      'script_injection_surface',
      'consent_enforcement',
      'retry_bounds',
      'origin_handling',
      'csp',
    ],
  }
}
