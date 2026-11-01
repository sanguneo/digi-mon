import { defineConfig } from '@playwright/test';
import base from './playwright.studio.config.ts';

// Fast code-only asset/behavior checks. Visual acceptance is separately captured
// with art/quality/capture-worlds.mjs and inspected alongside Blender renders.
export default defineConfig(base, {
  testMatch: [
    'nature-assets.spec.ts', 'prop-assets.spec.ts', 'puppy-asset.spec.ts', 'care-reactions.spec.ts',
    'mobile-first.spec.ts', 'problem-selection.spec.ts', 'worksheet-worlds.spec.ts',
  ],
  outputDir: '../../artifacts/model-code-checks',
  use: { screenshot: 'off', trace: 'off', video: 'off' },
});
