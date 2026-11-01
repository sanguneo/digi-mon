/** Actual app screenshots, never a mock scene. Requires a local Chromium.
 * CHROMIUM_PATH=/usr/bin/chromium node apps/web-garden/art/quality/capture-worlds.mjs [repo-root] [label]
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const repository = resolve(process.argv[2] || '.');
const label = process.argv[3] || 'after';
const output = resolve('artifacts/model-quality', label);
await mkdir(output, { recursive: true });
const engine = spawn(process.execPath, [resolve(repository, 'bin/serve.mjs')], {
  env: { ...process.env, PORT: '14587', TEACHER_TOKEN: 'quality-local-only' }, stdio: 'ignore',
});
const proxy = prefix => ({ target: 'http://127.0.0.1:14587', rewrite: path => path.replace(prefix, '') });
const vite = await createServer({ root: resolve(repository, 'apps/web-garden'), server: { host: '127.0.0.1', port: 4573, strictPort: true,
  proxy: { '/learner/api': proxy('/learner/api'), '/teacher/api': { ...proxy('/teacher/api'), headers: { authorization: 'Bearer quality-local-only' } } },
} });
let browser;
try {
  await vite.listen();
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const evidence = [];
  for (const size of ['desktop', 'mobile']) {
    for (const subject of ['korean', 'english', 'math']) {
      for (const stage of subject === 'korean' ? [0, 2, 3] : [0, 3]) {
        const context = await browser.newContext({ viewport: size === 'desktop' ? { width: 1280, height: 960 } : { width: 375, height: 812 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        await page.addInitScript(({ subject, stage }) => {
          const empty = () => ({ quotaProgress: 0, answeredKeys: [], unlockedItemIds: [], placements: {}, careCounts: {}, growthMilestones: [] });
          const state = { version: 3, activeSubject: subject, worlds: { korean: empty(), english: empty(), math: empty() } };
          state.worlds[subject].answeredKeys = Array.from({ length: [0,3,12,36][stage] }, (_, i) => JSON.stringify(['quality', String(i)]));
          state.worlds[subject].careCounts = { [subject === 'korean' ? 'water' : 'feed']: [0,1,3,6][stage] };
          state.worlds[subject].growthMilestones = [1,2,3].slice(0,stage);
          localStorage.setItem('digi-mon/garden-state@1', JSON.stringify(state));
        }, { subject, stage });
        await page.goto('http://127.0.0.1:4573/#garden');
        const canvas = page.locator('canvas[data-renderer="three-webgl"]');
        await canvas.waitFor({ state: 'visible', timeout: 30000 });
        await page.waitForFunction(({ subject, stage }) => {
          const c = document.querySelector('canvas'); return c?.dataset.world === subject && c.dataset.stage === String(stage);
        }, { subject, stage });
        await canvas.scrollIntoViewIfNeeded();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const prefix = `${size}-${subject}-${stage}`;
        await canvas.screenshot({ path: resolve(output, `${prefix}-canvas.png`) });
        await page.screenshot({ path: resolve(output, `${prefix}-app.png`), fullPage: true });
        // Optional in older baselines; compare the new on-demand shadow direction.
        const warm = page.getByRole('button', { name: '따뜻한 옆빛', exact: true });
        if (await warm.count()) {
          await page.locator('.world-camera > summary').click();
          await warm.click();
          await page.waitForFunction(() => document.querySelector('canvas')?.dataset.lighting === 'warm-side');
          await canvas.screenshot({ path: resolve(output, `${prefix}-warm-side.png`) });
        }
        evidence.push({ size, subject, stage, errors, horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          canvas: await canvas.boundingBox(), renderer: await canvas.getAttribute('data-renderer') });
        await context.close();
      }
    }
  }
  await writeFile(resolve(output, 'browser-report.json'), JSON.stringify(evidence, null, 2) + '\n');
  if (evidence.some(item => item.errors.length || item.horizontalOverflow)) process.exitCode = 1;
  console.log(JSON.stringify({ output, cases: evidence.length, errors: evidence.filter(item => item.errors.length), overflow: evidence.filter(item => item.horizontalOverflow) }, null, 2));
} finally {
  await browser?.close(); await vite.close(); engine.kill();
}
