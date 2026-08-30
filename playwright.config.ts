import { defineConfig, devices } from '@playwright/test';

const PORT = 3010;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // tests share one Postgres dev database
  retries: 0,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // This project's pinned @playwright/test version may not match the
        // Chromium revision Playwright would otherwise try to download —
        // point at the browser already installed in this environment.
        launchOptions: { executablePath: '/opt/pw-browsers/chromium' },
      },
    },
  ],
  webServer: {
    // Runs against a production build rather than `next dev`: dev mode
    // compiles each route on first hit, which can race with the very
    // first request to a freshly-touched route and flake assertions —
    // a production server (what actually ships) has no such race.
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      // Routes OTPs to .playwright-otp.json instead of a real SMS gateway —
      // see src/lib/providers/sms.ts TestFileSmsProvider.
      SMS_PROVIDER: 'test-file',
    },
  },
});
