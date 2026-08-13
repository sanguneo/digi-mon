import { expect, test } from '@playwright/test';

test('garden stays pressure-free, keyboard-operable, and overflow-free', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page.getByText('맞혔는지보다, 해 본 것이 소중해요.')).toBeVisible();
  await expect(page.locator('.garden-app').getByText(/연속|스트릭|타이머|순위|감점|실패/)).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBeFalsy();

  const motion = await page.evaluate(
    () => getComputedStyle(document.documentElement).getPropertyValue('--garden-motion').trim(),
  );
  expect(motion).toBe('0ms');

  await expect(page.getByRole('button', { name: /달빛 의자/ })).toBeDisabled();
  await page.screenshot({
    path: '../../artifacts/qa-garden/mobile-garden.png',
    fullPage: true,
  });
});
