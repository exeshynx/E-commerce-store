import { defineConfig, devices } from '@playwright/test';

const isContinuousIntegration = Boolean(process.env.CI);

export default defineConfig({
  expect: { timeout: 10_000 },
  forbidOnly: isContinuousIntegration,
  fullyParallel: false,
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  outputDir: 'test-results',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      testIgnore: /customer\.journey\.spec\.ts|admin\.journey\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
    },
  ],
  reporter: isContinuousIntegration
    ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  retries: isContinuousIntegration ? 2 : 0,
  testDir: './e2e',
  timeout: 90_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5273',
    contextOptions: { reducedMotion: 'reduce' },
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  ...(isContinuousIntegration || process.env.E2E_EXTERNAL_SERVERS !== 'true'
    ? {
        webServer: [
          {
            command: 'npm run dev:api',
            env: {
              ...process.env,
              API_PORT: '4100',
              NODE_ENV: 'test',
              WEB_URL: 'http://127.0.0.1:5273',
            },
            reuseExistingServer: !isContinuousIntegration,
            timeout: 120_000,
            url: 'http://127.0.0.1:4100/health/ready',
          },
          {
            command: 'npm run dev -w @aurelia/web -- --host 127.0.0.1 --port 5273',
            env: { ...process.env, API_URL: 'http://127.0.0.1:4100' },
            reuseExistingServer: !isContinuousIntegration,
            timeout: 120_000,
            url: 'http://127.0.0.1:5273',
          },
        ],
      }
    : {}),
  workers: 1,
});
