import { EventEmitter, once } from 'node:events';
import { expect, test } from '@playwright/test';

const assetPath = '/models/puppy.glb';

test('only the math world loads the Blender asset and reports its rendered source', async ({ page }) => {
  const assetRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith(assetPath)) assetRequests.push(request.url());
  });
  await page.goto('/#garden');
  const canvas = page.locator('canvas[data-renderer="three-webgl"]');
  await expect(canvas).toHaveAttribute('data-world', 'korean');
  await page.getByRole('group', { name: '돌볼 세상 고르기' }).getByRole('button', { name: /^영어/ }).click();
  await expect(canvas).toHaveAttribute('data-world', 'english');
  expect(assetRequests).toHaveLength(0);

  const loaded = page.waitForResponse((response) => response.url().endsWith(assetPath));
  await page.getByRole('group', { name: '돌볼 세상 고르기' }).getByRole('button', { name: /^수학/ }).click();
  const response = await loaded;
  expect(response.status()).toBe(200);
  expect((await response.body()).subarray(0, 4).toString()).toBe('glTF');
  await expect(canvas).toHaveAttribute('data-world', 'math');
  await expect(canvas).toHaveAttribute('data-asset-source', assetPath);
  await expect(page.locator('.world-scene')).toHaveAttribute('data-status', 'ready');
  expect(assetRequests).toHaveLength(1);

  await page.getByRole('group', { name: '돌볼 세상 고르기' }).getByRole('button', { name: /^국어/ }).click();
  await expect(canvas).toHaveAttribute('data-world', 'korean');
  await page.getByRole('group', { name: '돌볼 세상 고르기' }).getByRole('button', { name: /^수학/ }).click();
  await expect(canvas).toHaveAttribute('data-asset-source', assetPath);
  expect(assetRequests).toHaveLength(1);
});

test('an asset failure keeps care usable and a retry loads without replaying prior care', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let requests = 0;
  await page.route(`**${assetPath}`, async (route) => {
    requests += 1;
    if (requests === 1) await route.fulfill({ status: 503, body: 'Asset unavailable' });
    else await route.continue();
  });
  await page.goto('/');
  await page.getByRole('button', { name: '세상 둘러보기', exact: true }).click();
  await expect(page.locator('.world-scene')).toHaveAttribute('data-status', 'unavailable');
  await page.getByRole('button', { name: '밥 주기', exact: true }).click();
  const careCount = () => page.evaluate(() => {
    const saved = localStorage.getItem('digi-mon/garden-state@1');
    if (!saved) throw new Error('Missing saved care');
    return JSON.parse(saved).worlds.math.careCounts.feed;
  });
  expect(await careCount()).toBe(1);
  const loaded = page.waitForResponse((response) => response.url().endsWith(assetPath));
  await page.getByRole('button', { name: '3D 다시 열기', exact: true }).click();
  expect((await loaded).status()).toBe(200);
  const canvas = page.locator('canvas[data-renderer="three-webgl"]');
  await expect(canvas).toHaveAttribute('data-asset-source', assetPath);
  await expect(canvas).toHaveAttribute('data-care-id', '0');
  expect(await careCount()).toBe(1);
  expect(requests).toBe(2);
});

test('switching worlds during a held GLB response cannot install a stale math renderer', async ({ page }) => {
  const events = new EventEmitter();
  const intercepted = once(events, 'intercepted', { signal: AbortSignal.timeout(15_000) });
  await page.route(`**${assetPath}`, async (route) => {
    const released = once(events, 'release', { signal: AbortSignal.timeout(15_000) });
    events.emit('intercepted');
    await released;
    await route.continue();
  });
  await page.goto('/');
  await page.getByRole('button', { name: '세상 둘러보기', exact: true }).click();
  await intercepted;
  await expect(page.locator('.world-scene')).toHaveAttribute('data-status', 'loading');
  await page.getByRole('group', { name: '돌볼 세상 고르기' }).getByRole('button', { name: /^영어/ }).click();
  const canvas = page.locator('canvas[data-renderer="three-webgl"]');
  await expect(canvas).toHaveAttribute('data-world', 'english');
  const loaded = page.waitForResponse((response) => response.url().endsWith(assetPath));
  events.emit('release');
  expect((await loaded).status()).toBe(200);
  await page.unroute(`**${assetPath}`);
  await expect(canvas).toHaveAttribute('data-world', 'english');
  await page.getByRole('group', { name: '돌볼 세상 고르기' }).getByRole('button', { name: /^수학/ }).click();
  await expect(canvas).toHaveAttribute('data-asset-source', assetPath);
  await expect(page.locator('canvas')).toHaveCount(1);
});
