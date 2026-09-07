import { defineConfig } from '@playwright/test';
import base from './playwright.studio.config.ts';

// These specs contain code-only assertions. Do not run image-producing specs
// through this entry point; the user owns appearance review.
export default defineConfig(base, {
  testMatch: [
    'nature-assets.spec.ts', 'puppy-asset.spec.ts', 'care-reactions.spec.ts',
    'mobile-first.spec.ts', 'problem-selection.spec.ts', 'worksheet-worlds.spec.ts',
  ],
  outputDir: '../../artifacts/model-code-checks',
  use: { screenshot: 'off', trace: 'off', video: 'off' },
});
