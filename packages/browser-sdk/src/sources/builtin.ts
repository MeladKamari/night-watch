import {
  ENABLED_SOURCES,
  assertDefaultRegistryInvariants,
  type BuiltinSourceOptions,
  type BuiltinSources,
  type EnabledSourceName,
  type Source,
} from '@night-watch/core'
import { getArchitecture } from './architecture.js'
import { getAudio } from './audio.js'
import { getAudioBaseLatency } from './audio_base_latency.js'
import { getCanvas } from './canvas.js'
import { getColorDepth } from './color_depth.js'
import { getColorGamut } from './color_gamut.js'
import { getContrast } from './contrast.js'
import { getCookiesEnabled } from './cookies_enabled.js'
import { getCpuClass } from './cpu_class.js'
import { getDateTimeLocale } from './date_time_locale.js'
import { getDeviceMemory } from './device_memory.js'
import { getDomBlockers } from './dom_blockers.js'
import { getFontPreferences } from './font_preferences.js'
import { getFonts } from './fonts.js'
import { getForcedColors } from './forced_colors.js'
import { getHardwareConcurrency } from './hardware_concurrency.js'
import { getHdr } from './hdr.js'
import { getIndexedDB } from './indexed_db.js'
import { getInvertedColors } from './inverted_colors.js'
import { getLanguages } from './languages.js'
import { getLocalStorage } from './local_storage.js'
import { getMath } from './math.js'
import { getMonochrome } from './monochrome.js'
import { SourceNotImplementedError } from './not-implemented.js'
import { getOpenDatabase } from './open_database.js'
import { getPdfViewerEnabled } from './pdf_viewer_enabled.js'
import { getOsCpu } from './os_cpu.js'
import { getPlatform } from './platform.js'
import { getPlugins } from './plugins.js'
import { getPrivateClickMeasurement } from './private_click_measurement.js'
import { getReducedMotion } from './reduced_motion.js'
import { getReducedTransparency } from './reduced_transparency.js'
import { getScreenFrame } from './screen_frame.js'
import { getScreenResolution } from './screen_resolution.js'
import { getSessionStorage } from './session_storage.js'
import { getTimezone } from './timezone.js'
import { getTouchSupport } from './touch_support.js'
import { getUserAgentData } from './user_agent_data.js'
import { getVendor } from './vendor.js'
import { getVendorFlavors } from './vendor_flavors.js'
import { getWebGlBasics, getWebGlExtensions } from './webgl.js'

function createNotImplementedSource(
  sourceName: EnabledSourceName,
): Source<BuiltinSourceOptions, never> {
  return () => {
    throw new SourceNotImplementedError(sourceName)
  }
}

/**
 * Builds the default 41-source registry in locked order.
 * Individual collectors replace not-implemented entries as source steps land.
 */
export function createBuiltinSources(): BuiltinSources {
  const sources = {} as BuiltinSources
  for (const name of ENABLED_SOURCES) {
    sources[name] = createNotImplementedSource(name)
  }
  sources.userAgentData = getUserAgentData
  sources.fonts = getFonts
  sources.domBlockers = getDomBlockers
  sources.fontPreferences = getFontPreferences
  sources.audio = getAudio
  sources.screenFrame = getScreenFrame
  sources.canvas = getCanvas
  sources.osCpu = getOsCpu
  sources.languages = getLanguages
  sources.colorDepth = getColorDepth
  sources.deviceMemory = getDeviceMemory
  sources.screenResolution = getScreenResolution
  sources.hardwareConcurrency = getHardwareConcurrency
  sources.timezone = getTimezone
  sources.sessionStorage = getSessionStorage
  sources.localStorage = getLocalStorage
  sources.indexedDB = getIndexedDB
  sources.openDatabase = getOpenDatabase
  sources.cpuClass = getCpuClass
  sources.platform = getPlatform
  sources.plugins = getPlugins
  sources.touchSupport = getTouchSupport
  sources.vendor = getVendor
  sources.vendorFlavors = getVendorFlavors
  sources.cookiesEnabled = getCookiesEnabled
  sources.colorGamut = getColorGamut
  sources.invertedColors = getInvertedColors
  sources.forcedColors = getForcedColors
  sources.monochrome = getMonochrome
  sources.contrast = getContrast
  sources.reducedMotion = getReducedMotion
  sources.reducedTransparency = getReducedTransparency
  sources.hdr = getHdr
  sources.math = getMath
  sources.pdfViewerEnabled = getPdfViewerEnabled
  sources.architecture = getArchitecture
  sources.privateClickMeasurement = getPrivateClickMeasurement
  sources.audioBaseLatency = getAudioBaseLatency
  sources.dateTimeLocale = getDateTimeLocale
  sources.webGlBasics = getWebGlBasics
  sources.webGlExtensions = getWebGlExtensions
  assertDefaultRegistryInvariants(Object.keys(sources))
  return sources
}
