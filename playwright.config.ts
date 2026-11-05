import { defineConfig, devices } from '@playwright/test'

/**
 * Browser coverage matrix (step 57).
 * - chromium: full e2e suite (all specs)
 * - firefox / webkit: matrix + shared smoke/integration specs
 * - chromium-incognito: matrix only (fresh ephemeral contexts; storage isolation covered in-spec)
 *
 * Real-device / browser-cloud targets (Android Chrome, Samsung Internet, iOS Safari, Brave)
 * are documented as NOT RUN in docs/BROWSER_COVERAGE.md until hardware is available.
 */
const MATRIX_AND_SMOKE = [
  '**/browser-matrix*.spec.ts',
  '**/smoke.spec.ts',
  '**/bundles-iife.spec.ts',
  '**/playground-*.spec.ts',
  '**/runtime-probes.spec.ts',
  '**/agent-load.spec.ts',
  '**/pro-web-agent-smoke.spec.ts',
]

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
    baseURL: 'http://127.0.0.1:4173',
  },
  webServer: {
    command: 'pnpm --filter @ibf/playground dev',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: MATRIX_AND_SMOKE,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: MATRIX_AND_SMOKE,
    },
    {
      name: 'chromium-incognito',
      use: {
        ...devices['Desktop Chrome'],
        // Ephemeral context per test (no shared storageState) — incognito-like isolation.
        storageState: undefined,
      },
      testMatch: ['**/browser-matrix*.spec.ts'],
    },
  ],
})
