import { expect, test } from '@playwright/test';
import { EMPTY_GAME_STATE, GARDEN_SPOTS, careForWorld, gardenSpot, recordAnswer, serializeGameState, type GameState } from '../../src/game-state.ts';
import { WORLD_CATALOGS } from '../../src/garden-worlds.ts';

const worlds = [
  { subject: 'korean', path: '/models/props-korean.glb', action: 'water', care: '물 주기' },
  { subject: 'english', path: '/models/props-english.glb', action: 'feed', care: '먹이 주기' },
  { subject: 'math', path: '/models/props-math.glb', action: 'feed', care: '밥 주기' },
] as const;

for (const world of worlds) {
  function stockedWorld(): GameState {
    let state: GameState = { ...EMPTY_GAME_STATE, activeSubject: world.subject };
    for (let i = 0; i < 36; i++) state = recordAnswer(state, 'props-regression', String(i), world.subject).state;
    for (let i = 0; i < 6; i++) state = careForWorld(state, world.subject, world.action);
    return {
      ...state,
      worlds: {
        ...state.worlds,
        [world.subject]: {
          ...state.worlds[world.subject],
          placements: Object.fromEntries(WORLD_CATALOGS[world.subject].map((item, i) => {
            const spot = GARDEN_SPOTS[i % GARDEN_SPOTS.length];
            if (!spot) throw new Error('Missing placement fixture');
            return [item.id, spot.id];
          })),
        },
      },
    };
  }

  test(`${world.subject} library preserves the full catalog and moved placements across reload`, async ({ page }) => {
    const state = stockedWorld();
    await page.addInitScript((saved) => {
      if (!localStorage.getItem('digi-mon/garden-state@1')) localStorage.setItem('digi-mon/garden-state@1', saved);
    }, serializeGameState(state));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const loaded = page.waitForResponse((response) => response.url().endsWith(world.path));
    await page.goto('/#garden');
    const response = await loaded;
    expect(response.status()).toBe(200);
    expect((await response.body()).subarray(0, 4).toString()).toBe('glTF');
    const canvas = page.locator('canvas[data-renderer="three-webgl"]');
    await expect(canvas).toHaveAttribute('data-prop-asset-source', world.path);
    await expect(canvas).toHaveAttribute('data-stage', '3');
    const catalog = WORLD_CATALOGS[world.subject];
    await expect(page.locator('.world-placed [role="img"]')).toHaveCount(catalog.length);
    await expect(page.locator('.garden-item:enabled')).toHaveCount(catalog.length);
    const first = catalog[0];
    const destination = GARDEN_SPOTS[7];
    if (!first || !destination) throw new Error('Missing move fixture');
    await page.getByRole('button', { name: new RegExp(`^${first.name},`) }).click();
    await page.getByRole('button', { name: `${gardenSpot(destination.id, world.subject).label} 배치 지점`, exact: true }).click();
    await page.reload();
    await expect(canvas).toHaveAttribute('data-prop-asset-source', world.path);
    const saved = await page.evaluate((subject) => {
      const raw = localStorage.getItem('digi-mon/garden-state@1');
      if (!raw) throw new Error('Missing persisted world');
      return JSON.parse(raw).worlds[subject];
    }, world.subject);
    expect(saved.placements).toEqual({ ...state.worlds[world.subject].placements, [first.id]: destination.id });
    expect(saved.unlockedItemIds).toEqual(state.worlds[world.subject].unlockedItemIds);
    await expect(page.locator('.world-placed [role="img"]')).toHaveCount(catalog.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`${world.subject} prop failure retains care and placements while retrying the library`, async ({ page }) => {
    const state = stockedWorld();
    await page.addInitScript((saved) => {
      if (!localStorage.getItem('digi-mon/garden-state@1')) localStorage.setItem('digi-mon/garden-state@1', saved);
    }, serializeGameState(state));
    let requests = 0;
    await page.route(`**${world.path}`, async (route) => {
      requests += 1;
      if (requests === 1) await route.fulfill({ status: 503, body: 'Prop library unavailable' });
      else await route.continue();
    });
    await page.goto('/#garden');
    await expect(page.locator('.world-scene')).toHaveAttribute('data-status', 'unavailable');
    await page.locator('.world-care__actions').getByRole('button', { name: world.care, exact: true }).click();
    const loaded = page.waitForResponse((response) => response.url().endsWith(world.path));
    await page.getByRole('button', { name: '3D 다시 열기', exact: true }).click();
    expect((await loaded).status()).toBe(200);
    const canvas = page.locator('canvas[data-renderer="three-webgl"]');
    await expect(canvas).toHaveAttribute('data-prop-asset-source', world.path);
    await expect(canvas).toHaveAttribute('data-care-id', '0');
    const saved = await page.evaluate((subject) => {
      const raw = localStorage.getItem('digi-mon/garden-state@1');
      if (!raw) throw new Error('Missing persisted world');
      return JSON.parse(raw).worlds[subject];
    }, world.subject);
    expect(saved.placements).toEqual(state.worlds[world.subject].placements);
    expect(saved.careCounts[world.action]).toBe(7);
    expect(requests).toBe(2);
  });
}
