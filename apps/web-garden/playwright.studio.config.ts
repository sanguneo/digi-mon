import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e', testMatch: ['studio-first.spec.ts', 'mobile-first.spec.ts', 'worksheet-*.spec.ts', 'response-integrity.spec.ts', 'garden-learning.spec.ts'],
  outputDir: '../../artifacts/quality-review/studio-browser', workers: 1,
  timeout: 30_000, expect: { timeout: 10_000 }, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4473', browserName: 'chromium', viewport: { width: 375, height: 812 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'node test/studio-server.mjs', url: 'http://127.0.0.1:4473', reuseExistingServer: false },
});
