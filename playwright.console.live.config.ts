import { defineConfig, devices } from '@playwright/test'

/**
 * Live admin-console E2E — Angular SPA + ASP.NET API on :5080 with IBF_NETWORK=1.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/admin-console.live.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4300',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command:
        'dotnet run --project server/src/IbfProPlus.Api/IbfProPlus.Api.csproj -c Release --no-launch-profile --urls http://127.0.0.1:5080',
      url: 'http://127.0.0.1:5080/health/live',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command:
        'pnpm --filter @ibf-proplus/admin-console run build && npx --yes serve apps/admin-console/dist/admin-console/browser -l 4300 -s --no-request-logging',
      url: 'http://127.0.0.1:4300',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
  projects: [
    {
      name: 'chromium-live',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
