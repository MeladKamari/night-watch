import { defineConfig, devices } from '@playwright/test'

/**
 * Admin console E2E — serves Angular dist (offline demo mode, IBF_NETWORK unset).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/admin-console.spec.ts',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4300',
    trace: 'on-first-retry',
  },
  webServer: {
    command:
      'pnpm --filter @ibf-proplus/admin-console run build && npx --yes serve apps/admin-console/dist/admin-console/browser -l 4300 -s --no-request-logging',
    url: 'http://127.0.0.1:4300',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
})
