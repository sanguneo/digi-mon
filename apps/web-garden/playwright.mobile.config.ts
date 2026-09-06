import { defineConfig } from '@playwright/test';
import base from './playwright.config.ts';

export default defineConfig(base, {
  testMatch: 'mobile-first.spec.ts',
  outputDir: '../../artifacts/qa-mobile/playwright',
  projects: [
    { name: 'phone-chromium', use: { browserName: 'chromium', viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
    { name: 'phone-webkit', use: { browserName: 'webkit', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'tablet-portrait', use: { browserName: 'webkit', viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true } },
    { name: 'tablet-landscape', use: { browserName: 'webkit', viewport: { width: 1024, height: 768 }, isMobile: true, hasTouch: true } },
  ],
});
