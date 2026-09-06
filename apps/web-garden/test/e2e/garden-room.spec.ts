import { expect, test } from '@playwright/test';

const unlockedState = {
  version: 2,
  quotaProgress: 0,
  answeredKeys: ['sheet:1', 'sheet:2', 'sheet:3'],
  unlockedItemIds: ['moon-chair'],
  placements: {},
  latestRewardId: 'moon-chair',
};

const expandedCollectionState = {
  ...unlockedState,
  unlockedItemIds: [
    'moon-chair',
    'dandelion-pot',
    'tiny-pond',
    'cloud-balloon',
    'reading-cat',
    'rainbow-flag',
    'picnic-basket',
    'strawberry-patch',
    'mushroom-home',
    'bird-bath',
    'pebble-fountain',
    'firefly-lantern',
  ],
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/#studio');
  await page.reload();
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('opens a dedicated garden room from the compact learning summary', async ({ page }) => {
  await expect(page.locator('#garden-summary-title')).toBeVisible();
  await expect(page.getByRole('heading', { name: '모은 정원 친구들' })).toHaveCount(0);

  await page.getByRole('button', { name: '내 세상 둘러보기', exact: true }).click();
  await expect(page).toHaveURL(/#garden$/);
  await expect(page.getByRole('heading', { name: '나만의 정원', exact: true })).toBeVisible();
  await expect(page.locator('canvas[data-renderer="three-webgl"]')).toHaveAttribute('data-world', 'korean');
  await expect(page.getByRole('heading', { name: '장식 상자' })).toBeVisible();
  await expect(page.getByRole('button', { name: '학습하러 가기' })).toBeVisible();
  await page.screenshot({
    path: '../../artifacts/qa-garden/garden-room.png',
    fullPage: true,
  });
});

test('returns to the learning view with browser back', async ({ page }) => {
  await page.getByRole('button', { name: '세상 둘러보기', exact: true }).click();
  await expect(page).toHaveURL(/#garden$/);
  await page.goBack();

  await expect(page).toHaveURL(/#studio$/);
  await expect(page.locator('#garden-summary-title')).toBeVisible();
  await expect(page.getByRole('heading', { name: '나만의 정원' })).toHaveCount(0);
});

test('places and moves an item across named canvas coordinates', async ({ page }) => {
  await page.evaluate((state) => {
    localStorage.setItem('digi-mon/garden-state@1', JSON.stringify(state));
  }, unlockedState);
  await page.reload();
  await page.goto('/#garden');
  await page.reload();

  await page.getByRole('button', { name: /달빛 의자/ }).click();
  await expect(page.getByRole('button', { name: /배치 지점/ })).toHaveCount(8);
  await page.getByRole('button', { name: '연못 옆 배치 지점' }).click();
  const chair = page.getByRole('img', { name: '달빛 의자, 연못 옆에 놓임' });
  await expect(chair).toBeVisible();
  const canvas = page.locator('canvas[data-renderer="three-webgl"]');
  await expect(canvas).toHaveAttribute('data-world', 'korean');
  const beforeMove = await canvas.screenshot({ path: '../../artifacts/qa-garden/placement-pond-3d.png' });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('digi-mon/garden-state@1')!).worlds.korean.placements['moon-chair'])).toBe('pond-side');

  await page.reload();
  await expect(page.getByRole('img', { name: '달빛 의자, 연못 옆에 놓임' })).toBeVisible();
  await page.getByRole('button', { name: /달빛 의자.*다시 놓기/ }).click();
  await page.getByRole('button', { name: '큰 나무 아래 배치 지점' }).click();
  const moved = page.getByRole('img', { name: '달빛 의자, 큰 나무 아래에 놓임' });
  await expect(moved).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('digi-mon/garden-state@1')!).worlds.korean.placements['moon-chair'])).toBe('big-tree');
  // Geometry tests assert real transforms; compare canvas pixels here, not text boxes.
  const afterMove = await canvas.screenshot({ path: '../../artifacts/qa-garden/placement-tree-3d.png' });
  expect(afterMove.equals(beforeMove)).toBe(false);

  await page.screenshot({
    path: '../../artifacts/qa-garden/garden-decorated-room.png',
    fullPage: true,
  });
});

test('shows twelve collected decorations grouped into four themes', async ({ page }) => {
  await page.evaluate((state) => {
    localStorage.setItem('digi-mon/garden-state@1', JSON.stringify(state));
  }, expandedCollectionState);
  await page.goto('/#garden');
  await page.reload();

  await expect(page.getByText('모은 장식 12/12')).toBeVisible();
  for (const theme of ['쉴 곳', '꽃과 열매', '물가 풍경', '하늘과 빛']) {
    await expect(page.getByRole('heading', { name: theme })).toBeVisible();
  }
  await expect(page.locator('.garden-item:enabled')).toHaveCount(12);
  await expect(page.locator('canvas[data-renderer="three-webgl"]')).toHaveAttribute('data-motion', 'off');
  await page.screenshot({
    path: '../../artifacts/qa-garden/garden-expanded-collection.png',
    fullPage: true,
  });
});

test('keeps the expanded collection usable at a tablet viewport', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.evaluate((state) => {
    localStorage.setItem('digi-mon/garden-state@1', JSON.stringify(state));
  }, expandedCollectionState);
  await page.goto('/#garden');
  await page.reload();

  await expect(page.getByText('모은 장식 12/12')).toBeVisible();
  expect(await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )).toBeFalsy();
  await expect(page.locator('canvas[data-renderer="three-webgl"]')).toHaveAttribute('data-motion', 'off');
  await page.screenshot({
    path: '../../artifacts/qa-garden/garden-expanded-collection-tablet.png',
    fullPage: true,
  });
});

test('keeps the expanded collection usable at a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate((state) => {
    localStorage.setItem('digi-mon/garden-state@1', JSON.stringify(state));
  }, expandedCollectionState);
  await page.goto('/#garden');
  await page.reload();

  await expect(page.getByText('모은 장식 12/12')).toBeVisible();
  expect(await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )).toBeFalsy();
  await expect(page.locator('canvas[data-renderer="three-webgl"]')).toHaveAttribute('data-motion', 'off');
  await page.screenshot({
    path: '../../artifacts/qa-garden/garden-expanded-collection-mobile.png',
    fullPage: true,
  });
});

test('keeps the dedicated room usable on a learner viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#garden');

  await expect(page.getByRole('heading', { name: '나만의 정원' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBeFalsy();
  const motion = await page.evaluate(
    () => getComputedStyle(document.documentElement).getPropertyValue('--garden-motion').trim(),
  );
  expect(motion).toBe('0ms');
  await expect(page.locator('canvas[data-renderer="three-webgl"]')).toHaveAttribute('data-motion', 'off');
  await page.screenshot({
    path: '../../artifacts/qa-garden/garden-room-mobile.png',
    fullPage: true,
  });
});
