# Self-hosted Profile: Selected Browser Entropy Sources

**Source baseline:** FingerprintJS OSS v5.3.0. **Enabled source count: 41.** The upstream registry contains 42; one country-irrelevant payment API signal was intentionally excluded. Relative upstream order is preserved.

| Iran profile order | Included name | Pinned source | Implementation prompt |
|---:|---|---|---:|
| 1 | [`userAgentData`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/user_agent_data.ts) | `user_agent_data.ts` | [13](../steps/13_implement-useragentdata-source-client-hints-ua-ch.md) |
| 2 | [`fonts`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/fonts.ts) | `fonts.ts` | [14](../steps/14_implement-fonts-source-installed-font-availability.md) |
| 3 | [`domBlockers`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/dom_blockers.ts) | `dom_blockers.ts` | [15](../steps/15_implement-domblockers-source-content-blocker-css-selector-pr.md) |
| 4 | [`fontPreferences`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/font_preferences.ts) | `font_preferences.ts` | [16](../steps/16_implement-fontpreferences-source-font-preference-measurement.md) |
| 5 | [`audio`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/audio.ts) | `audio.ts` | [17](../steps/17_implement-audio-source-offline-audio-synthesis.md) |
| 6 | [`screenFrame`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/screen_frame.ts) | `screen_frame.ts` | [18](../steps/18_implement-screenframe-source-screen-frame-browser-chrome-ins.md) |
| 7 | [`canvas`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/canvas.ts) | `canvas.ts` | [19](../steps/19_implement-canvas-source-canvas-rendering.md) |
| 8 | [`osCpu`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/os_cpu.ts) | `os_cpu.ts` | [20](../steps/20_implement-oscpu-source-legacy-navigator-oscpu.md) |
| 9 | [`languages`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/languages.ts) | `languages.ts` | [21](../steps/21_implement-languages-source-browser-locale-list.md) |
| 10 | [`colorDepth`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/color_depth.ts) | `color_depth.ts` | [22](../steps/22_implement-colordepth-source-display-color-depth.md) |
| 11 | [`deviceMemory`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/device_memory.ts) | `device_memory.ts` | [23](../steps/23_implement-devicememory-source-approximate-device-memory.md) |
| 12 | [`screenResolution`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/screen_resolution.ts) | `screen_resolution.ts` | [24](../steps/24_implement-screenresolution-source-physical-screen-dimensions.md) |
| 13 | [`hardwareConcurrency`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/hardware_concurrency.ts) | `hardware_concurrency.ts` | [25](../steps/25_implement-hardwareconcurrency-source-logical-processor-count.md) |
| 14 | [`timezone`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/timezone.ts) | `timezone.ts` | [26](../steps/26_implement-timezone-source-timezone-identity.md) |
| 15 | [`sessionStorage`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/session_storage.ts) | `session_storage.ts` | [27](../steps/27_implement-sessionstorage-source-session-storage-availability.md) |
| 16 | [`localStorage`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/local_storage.ts) | `local_storage.ts` | [28](../steps/28_implement-localstorage-source-local-storage-availability.md) |
| 17 | [`indexedDB`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/indexed_db.ts) | `indexed_db.ts` | [29](../steps/29_implement-indexeddb-source-indexeddb-availability.md) |
| 18 | [`openDatabase`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/open_database.ts) | `open_database.ts` | [30](../steps/30_implement-opendatabase-source-legacy-websql-presence.md) |
| 19 | [`cpuClass`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/cpu_class.ts) | `cpu_class.ts` | [31](../steps/31_implement-cpuclass-source-legacy-cpu-class.md) |
| 20 | [`platform`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/platform.ts) | `platform.ts` | [32](../steps/32_implement-platform-source-platform-descriptor.md) |
| 21 | [`plugins`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/plugins.ts) | `plugins.ts` | [33](../steps/33_implement-plugins-source-navigator-plugins-metadata.md) |
| 22 | [`touchSupport`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/touch_support.ts) | `touch_support.ts` | [34](../steps/34_implement-touchsupport-source-touch-input-capability.md) |
| 23 | [`vendor`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/vendor.ts) | `vendor.ts` | [35](../steps/35_implement-vendor-source-browser-vendor.md) |
| 24 | [`vendorFlavors`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/vendor_flavors.ts) | `vendor_flavors.ts` | [36](../steps/36_implement-vendorflavors-source-browser-vendor-specific-globa.md) |
| 25 | [`cookiesEnabled`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/cookies_enabled.ts) | `cookies_enabled.ts` | [37](../steps/37_implement-cookiesenabled-source-cookie-access-capability.md) |
| 26 | [`colorGamut`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/color_gamut.ts) | `color_gamut.ts` | [38](../steps/38_implement-colorgamut-source-css-display-color-gamut.md) |
| 27 | [`invertedColors`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/inverted_colors.ts) | `inverted_colors.ts` | [39](../steps/39_implement-invertedcolors-source-inverted-color-preference.md) |
| 28 | [`forcedColors`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/forced_colors.ts) | `forced_colors.ts` | [40](../steps/40_implement-forcedcolors-source-forced-color-mode.md) |
| 29 | [`monochrome`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/monochrome.ts) | `monochrome.ts` | [41](../steps/41_implement-monochrome-source-monochrome-bit-depth.md) |
| 30 | [`contrast`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/contrast.ts) | `contrast.ts` | [42](../steps/42_implement-contrast-source-preferred-contrast.md) |
| 31 | [`reducedMotion`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/reduced_motion.ts) | `reduced_motion.ts` | [43](../steps/43_implement-reducedmotion-source-reduced-motion-preference.md) |
| 32 | [`reducedTransparency`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/reduced_transparency.ts) | `reduced_transparency.ts` | [44](../steps/44_implement-reducedtransparency-source-reduced-transparency-pr.md) |
| 33 | [`hdr`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/hdr.ts) | `hdr.ts` | [45](../steps/45_implement-hdr-source-dynamic-range-hdr.md) |
| 34 | [`math`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/math.ts) | `math.ts` | [46](../steps/46_implement-math-source-floating-point-math-differences.md) |
| 35 | [`pdfViewerEnabled`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/pdf_viewer_enabled.ts) | `pdf_viewer_enabled.ts` | [47](../steps/47_implement-pdfviewerenabled-source-built-in-pdf-viewer-availa.md) |
| 36 | [`architecture`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/architecture.ts) | `architecture.ts` | [48](../steps/48_implement-architecture-source-floating-point-architecture-pr.md) |
| 37 | [`privateClickMeasurement`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/private_click_measurement.ts) | `private_click_measurement.ts` | [49](../steps/49_implement-privateclickmeasurement-source-safari-attribution-.md) |
| 38 | [`audioBaseLatency`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/audio_base_latency.ts) | `audio_base_latency.ts` | [50](../steps/50_implement-audiobaselatency-source-audio-base-latency.md) |
| 39 | [`dateTimeLocale`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/date_time_locale.ts) | `date_time_locale.ts` | [51](../steps/51_implement-datetimelocale-source-intl-date-locale.md) |
| 40 | [`webGlBasics`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/webgl.ts) | `webgl.ts` | [52](../steps/52_implement-webglbasics-source-webgl-basic-capabilities.md) |
| 41 | [`webGlExtensions`](https://github.com/fingerprintjs/fingerprintjs/blob/v5.3.0/src/sources/webgl.ts) | `webgl.ts` | [53](../steps/53_implement-webglextensions-source-webgl-extension-and-precisi.md) |

The removed source is not imported, typed, collected, emitted, hashed, included in default/opt-in builds or referenced as a runtime dependency. This changes the default `visitorId` relative to unmodified upstream.

Do not replace the omitted source with fake placeholder values, hidden `undefined`, or a regional constant. For differential tests, compute a separate filtered upstream hash with the excluded key removed.
