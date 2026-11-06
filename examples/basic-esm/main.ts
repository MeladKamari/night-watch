/**
 * Compilable ESM usage example (documentation fixture).
 * Run under a bundler or native ESM in the browser � not executed by Vitest.
 */
import {
  ENABLED_SOURCES,
  SOURCE_MANIFEST_REVISION,
  componentsToDebugString,
  load,
  omitComponents,
} from '@thenightwatch/browser-sdk'

export async function collectVisitorId(): Promise<string> {
  const agent = await load({ monitoring: false, delayFallback: 0 })
  const result = await agent.get()

  // Illustrative post-processing � does not change default agent hash.
  const withoutFonts = omitComponents(result.components, ['fonts'])
  void componentsToDebugString(withoutFonts)

  if (ENABLED_SOURCES.length !== 41) {
    throw new Error('Default-profile registry must stay at 41 sources')
  }
  if (SOURCE_MANIFEST_REVISION !== 'default-v1') {
    throw new Error(`Unexpected manifest: ${SOURCE_MANIFEST_REVISION}`)
  }
  if ((ENABLED_SOURCES as readonly string[]).includes('applePay')) {
    throw new Error('applePay must remain excluded')
  }

  return result.visitorId
}
