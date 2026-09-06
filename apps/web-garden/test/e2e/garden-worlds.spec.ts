import { expect, test } from '@playwright/test';
import { EMPTY_GAME_STATE, careForWorld, recordAnswer } from '../../src/game-state.ts';

for (const subject of ['korean', 'english', 'math'] as const) {
  test(`${subject} persists substantial growth, care and its own decorations`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let state = { ...EMPTY_GAME_STATE, activeSubject: subject };
    for (let i = 0; i < 3; i++) state = recordAnswer(state, 'growth-browser', String(i), subject).state;
    await page.addInitScript((saved) => {
      if (!localStorage.getItem('digi-mon/garden-state@1')) localStorage.setItem('digi-mon/garden-state@1', JSON.stringify(saved));
    }, state);
    await page.goto('/#garden');
    const canvas = page.locator('canvas[data-renderer="three-webgl"]');
    await expect(canvas).toHaveAttribute('data-world', subject);
    await expect(canvas).toHaveAttribute('data-stage', '0');
    const before = await canvas.screenshot();
    const action = subject === 'korean' ? '물 주기' : subject === 'english' ? '먹이 주기' : '밥 주기';
    await page.locator('.world-care__actions').getByRole('button', { name: action, exact: true }).click();
    await expect(canvas).toHaveAttribute('data-stage', '1');
    expect((await canvas.screenshot()).equals(before)).toBe(false);
    expect(await page.evaluate((key) => JSON.parse(localStorage.getItem('digi-mon/garden-state@1')!).worlds[key].growthMilestones, subject)).toEqual([1]);
    if (subject === 'math') {
      await page.getByRole('button', { name: '공 던져 주기', exact: true }).click();
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('digi-mon/garden-state@1')!).worlds.math.lastCare)).toBe('play');
    }
    await page.reload();
    await expect(canvas).toHaveAttribute('data-stage', '1');
    await expect(page.locator('.world-growth progress').first()).toHaveAttribute('max', '12');
    await expect(page.locator('.garden-item:enabled')).toHaveCount(1);

    for (let i = 3; i < 36; i++) state = recordAnswer(state, 'growth-browser', String(i), subject).state;
    for (let i = 0; i < 6; i++) state = careForWorld(state, subject, subject === 'korean' ? 'water' : 'feed');
    await page.evaluate((saved) => localStorage.setItem('digi-mon/garden-state@1', JSON.stringify(saved)), state);
    await page.reload();
    await expect(canvas).toHaveAttribute('data-stage', '3');
    await page.locator('.world-memory summary').click();
    await expect(page.locator('[data-milestone]')).toHaveCount(3);
    await canvas.screenshot({ path: `../../artifacts/qa-garden/${subject}-grown-3d.png` });
    const other = subject === 'korean' ? 'english' : 'korean';
    expect(await page.evaluate((key) => JSON.parse(localStorage.getItem('digi-mon/garden-state@1')!).worlds[key].answeredKeys, other)).toEqual([]);
  });
}

test('WebGL initialization failure keeps care, growth, placement and retry usable', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof getContext>) {
      if (String(args[0]).startsWith('webgl')) return null;
      return getContext.apply(this, args);
    } as typeof getContext;
    localStorage.setItem('digi-mon/garden-state@1', JSON.stringify({
      version: 2, quotaProgress: 0, answeredKeys: ['old:1', 'old:2', 'old:3'],
      unlockedItemIds: ['moon-chair'], placements: {},
    }));
  });
  await page.goto('/#garden');
  await expect(page.locator('.world-scene')).toHaveAttribute('data-status', 'unavailable');
  await page.locator('.world-care__actions').getByRole('button', { name: '물 주기', exact: true }).click();
  await expect(page.locator('.world-growth')).toHaveAttribute('data-stage', '1');
  await page.getByRole('button', { name: /달빛 의자/ }).click();
  await page.getByRole('button', { name: '앞뜰 배치 지점', exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('digi-mon/garden-state@1')!));
  expect(saved.worlds.korean.careCounts.water).toBe(1);
  expect(saved.worlds.korean.placements['moon-chair']).toBe('front-garden');
  await page.getByRole('button', { name: '3D 다시 열기', exact: true }).click();
  await expect(page.locator('.world-scene')).toHaveAttribute('data-status', 'unavailable');
  await expect(page.getByRole('img', { name: '달빛 의자, 앞뜰에 놓임', exact: true })).toBeVisible();
});

test('a lost GPU context can be retried without losing care, and camera mode releases page scrolling', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#garden');
  const canvas = page.locator('canvas[data-renderer="three-webgl"]');
  await expect(canvas).toHaveAttribute('data-motion', 'off');
  await page.locator('.world-camera summary').click();
  await page.getByRole('button', { name: '손으로 둘러보기 켜기', exact: true }).click();
  expect(await canvas.evaluate((element) => getComputedStyle(element).touchAction)).toBe('none');
  await page.locator('.world-camera summary').click();
  await expect(canvas).toHaveCSS('touch-action', 'pan-y');
  await page.locator('.world-care__actions').getByRole('button', { name: '물 주기', exact: true }).click();
  await canvas.evaluate(async (element: HTMLCanvasElement) => {
    const extension = element.getContext('webgl2')?.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('Chromium did not expose WEBGL_lose_context');
    const lost = new Promise<void>((resolve) => element.addEventListener('webglcontextlost', () => resolve(), { once: true }));
    extension.loseContext();
    await lost;
  });
  await expect(page.locator('.world-scene')).toHaveAttribute('data-status', 'unavailable');
  await page.getByRole('button', { name: '3D 다시 열기', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-world', 'korean');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('digi-mon/garden-state@1')!).worlds.korean.careCounts.water)).toBe(1);
});
