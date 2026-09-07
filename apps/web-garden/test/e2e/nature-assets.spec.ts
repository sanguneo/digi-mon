import { EventEmitter, once } from 'node:events';
import { expect, test } from '@playwright/test';
import { EMPTY_GAME_STATE, careForWorld, recordAnswer, serializeGameState, type GameState } from '../../src/game-state.ts';

const worlds = [
  { subject: 'korean', label: '국어', path: '/models/tree.glb', care: '물 주기', action: 'water' },
  { subject: 'english', label: '영어', path: '/models/fish.glb', care: '먹이 주기', action: 'feed' },
] as const;

for (const world of worlds) {
  test(`${world.subject} loads only on entry and reuses its own cached GLB`, async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => {
      if (/\/models\/[^/]+\.glb$/.test(request.url())) requests.push(request.url());
    });
    await page.goto('/');
    await page.getByRole('radio', { name: world.label, exact: true }).check();
    await expect(page.getByRole('button', { name: '6문항 생성', exact: true })).toBeVisible();
    expect(requests).toHaveLength(0);
    const loaded = page.waitForResponse((response) => response.url().endsWith(world.path));
    await page.getByRole('button', { name: '세상 둘러보기', exact: true }).click();
    const response = await loaded;
    expect(response.status()).toBe(200);
    expect((await response.body()).subarray(0, 4).toString()).toBe('glTF');
    const canvas = page.locator('canvas[data-renderer="three-webgl"]');
    await expect(canvas).toHaveAttribute('data-world', world.subject);
    await expect(canvas).toHaveAttribute('data-asset-source', world.path);
    expect(requests).toHaveLength(1);
    await page.getByRole('group', { name: '돌볼 세상 고르기' }).getByRole('button', { name: /^수학/ }).click();
    await expect(canvas).toHaveAttribute('data-asset-source', '/models/puppy.glb');
    await page.getByRole('group', { name: '돌볼 세상 고르기' }).getByRole('button', { name: new RegExp(`^${world.label}`) }).click();
    await expect(canvas).toHaveAttribute('data-asset-source', world.path);
    expect(requests.filter((url) => url.endsWith(world.path))).toHaveLength(1);
  });

  for (const stage of [0, 1, 2, 3] as const) {
    test(`${world.subject} stage ${stage} restores its asset and care without replay`, async ({ page }) => {
      const answerCount = [0, 3, 12, 36][stage];
      const careCount = [0, 1, 3, 6][stage];
      if (answerCount === undefined || careCount === undefined) throw new Error('Invalid fixture stage');
      let state: GameState = { ...EMPTY_GAME_STATE, activeSubject: world.subject };
      for (let i = 0; i < answerCount; i++) state = recordAnswer(state, 'nature-asset', String(i), world.subject).state;
      for (let i = 0; i < careCount; i++) state = careForWorld(state, world.subject, world.action);
      await page.addInitScript((saved) => {
        if (!localStorage.getItem('digi-mon/garden-state@1')) localStorage.setItem('digi-mon/garden-state@1', saved);
      }, serializeGameState(state));
      await page.setViewportSize(stage % 2 ? { width: 768, height: 1024 } : { width: 375, height: 812 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/#garden');
      const canvas = page.locator('canvas[data-renderer="three-webgl"]');
      await expect(canvas).toHaveAttribute('data-asset-source', world.path);
      await expect(canvas).toHaveAttribute('data-stage', String(stage));
      await page.locator('.world-care__actions').getByRole('button', { name: world.care, exact: true }).click();
      await expect(canvas).toHaveAttribute('data-care-state', 'settled');
      await page.reload();
      await expect(canvas).toHaveAttribute('data-asset-source', world.path);
      await expect(canvas).toHaveAttribute('data-stage', String(stage));
      await expect(canvas).toHaveAttribute('data-care-id', '0');
      const savedWorld = await page.evaluate((subject) => {
        const raw = localStorage.getItem('digi-mon/garden-state@1');
        if (!raw) throw new Error('Missing saved world');
        return JSON.parse(raw).worlds[subject];
      }, world.subject);
      expect(savedWorld.answeredKeys).toHaveLength(answerCount);
      expect(savedWorld.careCounts[world.action]).toBe(careCount + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }

  test(`${world.subject} asset failures preserve care and retry the correct file`, async ({ page }) => {
    let requests = 0;
    await page.route(`**${world.path}`, async (route) => {
      requests += 1;
      if (requests === 1) await route.fulfill({ status: 503, body: 'Asset unavailable' });
      else await route.continue();
    });
    await page.goto('/');
    await page.getByRole('radio', { name: world.label, exact: true }).check();
    await page.getByRole('button', { name: '세상 둘러보기', exact: true }).click();
    await expect(page.locator('.world-scene')).toHaveAttribute('data-status', 'unavailable');
    await page.locator('.world-care__actions').getByRole('button', { name: world.care, exact: true }).click();
    const loaded = page.waitForResponse((response) => response.url().endsWith(world.path));
    await page.getByRole('button', { name: '3D 다시 열기', exact: true }).click();
    expect((await loaded).status()).toBe(200);
    const canvas = page.locator('canvas[data-renderer="three-webgl"]');
    await expect(canvas).toHaveAttribute('data-asset-source', world.path);
    await expect(canvas).toHaveAttribute('data-care-id', '0');
    expect(requests).toBe(2);
    const count = await page.evaluate(({ subject, action }) => {
      const raw = localStorage.getItem('digi-mon/garden-state@1');
      if (!raw) throw new Error('Missing saved care');
      return JSON.parse(raw).worlds[subject].careCounts[action];
    }, world);
    expect(count).toBe(1);
  });
}

test('a late fish response cannot replace the active tree world', async ({ page }) => {
  const events = new EventEmitter();
  const intercepted = once(events, 'intercepted', { signal: AbortSignal.timeout(15_000) });
  await page.route('**/models/fish.glb', async (route) => {
    const released = once(events, 'release', { signal: AbortSignal.timeout(15_000) });
    events.emit('intercepted');
    await released;
    await route.continue();
  });
  await page.goto('/');
  await page.getByRole('radio', { name: '영어', exact: true }).check();
  await page.getByRole('button', { name: '세상 둘러보기', exact: true }).click();
  await intercepted;
  await page.getByRole('group', { name: '돌볼 세상 고르기' }).getByRole('button', { name: /^국어/ }).click();
  const canvas = page.locator('canvas[data-renderer="three-webgl"]');
  await expect(canvas).toHaveAttribute('data-asset-source', '/models/tree.glb');
  const loaded = page.waitForResponse((response) => response.url().endsWith('/models/fish.glb'));
  events.emit('release');
  expect((await loaded).status()).toBe(200);
  await page.unroute('**/models/fish.glb');
  await expect(canvas).toHaveAttribute('data-world', 'korean');
  await page.getByRole('group', { name: '돌볼 세상 고르기' }).getByRole('button', { name: /^영어/ }).click();
  await expect(canvas).toHaveAttribute('data-asset-source', '/models/fish.glb');
  await expect(page.locator('canvas')).toHaveCount(1);
});
