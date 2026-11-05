# Release gate report

Generated: `2026-11-05T09:53:12.708Z`
Version: `1.0.0`
Manifest: `default-v1` (41 sources)
Overall: **PASS**

| Check | OK | Detail |
|---|:---:|---|
| `enabled_count_41` | yes | ENABLED_SOURCE_COUNT=41 |
| `applePay_absent_registry` | yes | excluded=applePay |
| `registry_invariants` | yes | assertDefaultRegistryInvariants ok |
| `manifest_revision` | yes | default-v1 |
| `source_tests_userAgentData` | yes | user-agent-data.test.ts + e2e/user-agent-data.spec.ts |
| `source_tests_fonts` | yes | fonts.test.ts + e2e/fonts.spec.ts |
| `source_tests_domBlockers` | yes | dom-blockers.test.ts + e2e/dom-blockers.spec.ts |
| `source_tests_fontPreferences` | yes | font-preferences.test.ts + e2e/font-preferences.spec.ts |
| `source_tests_audio` | yes | audio.test.ts + e2e/audio.spec.ts |
| `source_tests_screenFrame` | yes | screen-frame.test.ts + e2e/screen-frame.spec.ts |
| `source_tests_canvas` | yes | canvas.test.ts + e2e/canvas.spec.ts |
| `source_tests_osCpu` | yes | os-cpu.test.ts + e2e/os-cpu.spec.ts |
| `source_tests_languages` | yes | languages.test.ts + e2e/languages.spec.ts |
| `source_tests_colorDepth` | yes | color-depth.test.ts + e2e/color-depth.spec.ts |
| `source_tests_deviceMemory` | yes | device-memory.test.ts + e2e/device-memory.spec.ts |
| `source_tests_screenResolution` | yes | screen-resolution.test.ts + e2e/screen-resolution.spec.ts |
| `source_tests_hardwareConcurrency` | yes | hardware-concurrency.test.ts + e2e/hardware-concurrency.spec.ts |
| `source_tests_timezone` | yes | timezone.test.ts + e2e/timezone.spec.ts |
| `source_tests_sessionStorage` | yes | session-storage.test.ts + e2e/session-storage.spec.ts |
| `source_tests_localStorage` | yes | local-storage.test.ts + e2e/local-storage.spec.ts |
| `source_tests_indexedDB` | yes | indexed-db.test.ts + e2e/indexed-db.spec.ts |
| `source_tests_openDatabase` | yes | open-database.test.ts + e2e/open-database.spec.ts |
| `source_tests_cpuClass` | yes | cpu-class.test.ts + e2e/cpu-class.spec.ts |
| `source_tests_platform` | yes | platform.test.ts + e2e/platform.spec.ts |
| `source_tests_plugins` | yes | plugins.test.ts + e2e/plugins.spec.ts |
| `source_tests_touchSupport` | yes | touch-support.test.ts + e2e/touch-support.spec.ts |
| `source_tests_vendor` | yes | vendor.test.ts + e2e/vendor.spec.ts |
| `source_tests_vendorFlavors` | yes | vendor-flavors.test.ts + e2e/vendor-flavors.spec.ts |
| `source_tests_cookiesEnabled` | yes | cookies-enabled.test.ts + e2e/cookies-enabled.spec.ts |
| `source_tests_colorGamut` | yes | color-gamut.test.ts + e2e/color-gamut.spec.ts |
| `source_tests_invertedColors` | yes | inverted-colors.test.ts + e2e/inverted-colors.spec.ts |
| `source_tests_forcedColors` | yes | forced-colors.test.ts + e2e/forced-colors.spec.ts |
| `source_tests_monochrome` | yes | monochrome.test.ts + e2e/monochrome.spec.ts |
| `source_tests_contrast` | yes | contrast.test.ts + e2e/contrast.spec.ts |
| `source_tests_reducedMotion` | yes | reduced-motion.test.ts + e2e/reduced-motion.spec.ts |
| `source_tests_reducedTransparency` | yes | reduced-transparency.test.ts + e2e/reduced-transparency.spec.ts |
| `source_tests_hdr` | yes | hdr.test.ts + e2e/hdr.spec.ts |
| `source_tests_math` | yes | math.test.ts + e2e/math.spec.ts |
| `source_tests_pdfViewerEnabled` | yes | pdf-viewer-enabled.test.ts + e2e/pdf-viewer-enabled.spec.ts |
| `source_tests_architecture` | yes | architecture.test.ts + e2e/architecture.spec.ts |
| `source_tests_privateClickMeasurement` | yes | private-click-measurement.test.ts + e2e/private-click-measurement.spec.ts |
| `source_tests_audioBaseLatency` | yes | audio-base-latency.test.ts + e2e/audio-base-latency.spec.ts |
| `source_tests_dateTimeLocale` | yes | date-time-locale.test.ts + e2e/date-time-locale.spec.ts |
| `source_tests_webGlBasics` | yes | webgl-basics.test.ts + e2e/webgl-basics.spec.ts |
| `source_tests_webGlExtensions` | yes | webgl-extensions.test.ts + e2e/webgl-extensions.spec.ts |
| `all_41_source_test_pairs` | yes | missingPairs=0; mapSize=41 |
| `evidence_reference/upstream-diff-report.md` | yes | reference/upstream-diff-report.md |
| `evidence_reference/upstream-diff-report.json` | yes | reference/upstream-diff-report.json |
| `evidence_reference/perf-entropy-report.md` | yes | reference/perf-entropy-report.md |
| `evidence_reference/PARITY_MATRIX.md` | yes | reference/PARITY_MATRIX.md |
| `evidence_docs/BROWSER_COVERAGE.md` | yes | docs/BROWSER_COVERAGE.md |
| `evidence_LICENSE` | yes | LICENSE |
| `evidence_NOTICE` | yes | NOTICE |
| `evidence_CHANGELOG.md` | yes | CHANGELOG.md |
| `evidence_docs/RELEASE_CHECKLIST.md` | yes | docs/RELEASE_CHECKLIST.md |
| `evidence_docs/ROLLBACK.md` | yes | docs/ROLLBACK.md |
| `evidence_docs/TAG_PLAN.md` | yes | docs/TAG_PLAN.md |
| `fa_IR_fixture` | yes | browser-matrix.spec.ts locale/tz fixtures |
| `no_egress_proof` | yes | browser-matrix collects with egress assertions |
| `no_payment_source_files` | yes | none |
| `ci_guard_script` | yes | scripts/ci/guard-excluded-payment-source.mjs |
| `release_version_aligned` | yes | browser-sdk=1.0.0; core=1.0.0 |
| `package_license_mit` | yes | sdk=MIT; core=MIT |
| `release_dist_tag` | yes | 1.x packages use npm dist-tag "latest" + public access |
| `package_license_files` | yes | LICENSE+NOTICE packaged beside dist |
| `bundle_no_getApplePay` | yes | fp.min.js scanned |

Remote npm/git publish was **not** performed.

