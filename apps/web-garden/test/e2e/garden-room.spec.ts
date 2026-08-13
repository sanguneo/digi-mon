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
});

test('opens a dedicated garden room from the compact learning summary', async ({ page }) => {
  await expect(page.getByText('오늘의 걸음 0/3')).toBeVisible();
  await expect(page.getByRole('heading', { name: '모은 정원 친구들' })).toHaveCount(0);

  await page.getByRole('button', { name: '정원 보기' }).first().click();
  await expect(page).toHaveURL(/#garden$/);
  await expect(page.getByRole('heading', { name: '나만의 정원' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '장식 상자' })).toBeVisible();
  await expect(page.getByRole('button', { name: '학습하러 가기' })).toBeVisible();
  await page.screenshot({
    path: '../../artifacts/qa-garden/garden-room.png',
    fullPage: true,
  });
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
  const pondBox = await chair.boundingBox();
  const pondScroll = await page.evaluate(() => window.scrollY);

  await page.reload();
  await expect(page.getByRole('img', { name: '달빛 의자, 연못 옆에 놓임' })).toBeVisible();
  await page.getByRole('button', { name: /달빛 의자.*다시 놓기/ }).click();
  await page.getByRole('button', { name: '큰 나무 아래 배치 지점' }).click();
  const moved = page.getByRole('img', { name: '달빛 의자, 큰 나무 아래에 놓임' });
  const treeBox = await moved.boundingBox();
  const treeScroll = await page.evaluate(() => window.scrollY);
  expect(treeBox?.x).not.toBe(pondBox?.x);
  expect((treeBox?.y ?? 0) + treeScroll).not.toBe((pondBox?.y ?? 0) + pondScroll);

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
  await page.screenshot({
    path: '../../artifacts/qa-garden/garden-expanded-collection.png',
    fullPage: true,
  });
});

test('keeps the expanded collection usable at a tablet viewport', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.evaluate((state) => {
    localStorage.setItem('digi-mon/garden-state@1', JSON.stringify(state));
  }, expandedCollectionState);
  await page.goto('/#garden');
  await page.reload();

  await expect(page.getByText('모은 장식 12/12')).toBeVisible();
  expect(await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )).toBeFalsy();
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
  await page.screenshot({
    path: '../../artifacts/qa-garden/garden-room-mobile.png',
    fullPage: true,
  });
});
