import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/tests',
  timeout: 60 * 1000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],//quitar
    ['html'],
    ['allure-playwright']
  ],
  use: {
    baseURL: process.env.BASE_URL || "https://10.203.113.119/oc/bes/sm/login/login-colombia.html",
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,//false
    viewport: { width: 1366, height: 768 },//quitar
    ignoreHTTPSErrors: true,//quitar
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});