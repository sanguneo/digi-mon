import { expect, test } from '@playwright/test';
import type { Worksheet } from '../../src/api.ts';

// The engine supplies a targeted arithmetic sheet; only the teacher-style code filter
// is added to the normal browser request so print density is measured on real items.
test('prints fifty real symbolic calculations in compact columns without losing item numbers', async ({ page }, testInfo) => {
  await page.route('**/learner/api/v1/worksheets', (route) => route.continue({
    postData: JSON.stringify({ ...route.request().postDataJSON(), codes: ['[2수01-06]'] }),
  }));
  await page.goto('/');
  await page.locator('.dm-studio-settings > summary').click();
  await page.getByRole('button', { name: '50문항 넉넉히', exact: true }).click();
  const responseReady = page.waitForResponse((response) => response.url().endsWith('/learner/api/v1/worksheets') && response.request().method() === 'POST');
  await page.getByRole('button', { name: '50문항 생성', exact: true }).click();
  const response = await responseReady;
  expect(response.status()).toBe(200);
  const sheet = await response.json() as Worksheet;
  expect(sheet.produced).toBe(50);
  await expect(page.locator('.dm-item--calculation')).toHaveCount(50);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('.dm-item')).toHaveCount(50);
  const first = await page.locator('.dm-item').nth(0).boundingBox();
  const second = await page.locator('.dm-item').nth(1).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(second!.x).toBeGreaterThan(first!.x);
  expect(second!.y).toBe(first!.y);
  const numbers = await page.locator('.dm-item__number').allTextContents();
  expect(numbers.map(Number)).toEqual(Array.from({ length: 50 }, (_, index) => index + 1));
  const pdf = await page.pdf({ path: testInfo.outputPath('fifty-calculations.pdf'), format: 'A4', printBackground: true });
  const pages = pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length ?? 0;
  expect(pages).toBeGreaterThan(0);
  expect(pages).toBeLessThanOrEqual(6);
  await testInfo.attach('print-density', { body: JSON.stringify({ items: sheet.produced, pages }), contentType: 'application/json' });
});
