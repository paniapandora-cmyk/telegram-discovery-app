const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'iphone-webkit', testMatch: 'discovery.spec.cjs', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
  fullyParallel: false,
  workers: 1,
  reporter: [['line']],
  use: {
    baseURL: 'http://127.0.0.1:8080',
    viewport: { width: 390, height: 844 },
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
