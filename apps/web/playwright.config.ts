import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  outputDir: '../../artifacts/qa/playwright',
  fullyParallel: false,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run serve --prefix ../..',
      url: 'http://127.0.0.1:8787/health',
      reuseExistingServer: false,
      env: {
        TEACHER_TOKEN: 'e2e-teacher-token',
      },
    },
    {
      command: 'npm run dev',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
    },
  ],
});
