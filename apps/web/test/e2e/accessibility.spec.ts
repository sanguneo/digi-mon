import { expect, test } from '@playwright/test';

test('stays keyboard-operable and overflow-free on a learner viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const heading = page.getByRole('heading', { name: '오늘의 배움을 설계하세요' });
  await expect(heading).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBeFalsy();

  const motion = await page.evaluate(
    () => getComputedStyle(document.documentElement).getPropertyValue('--dm-motion-base').trim(),
  );
  expect(motion).toBe('0ms');

  await expect(page.getByLabel('문항 수')).toBeVisible();
  await expect(page.getByLabel('학년군')).toBeVisible();
  await expect(page.getByRole('button', { name: '진단평가' })).toBeVisible();

  await page.screenshot({
    path: '../../artifacts/qa/mobile.png',
    fullPage: true,
  });
});
