import { expect, test } from '@playwright/test';

test('a plentiful worksheet keeps every item and choice on touch screens and paper', async ({ page }) => {
  await page.goto('/');
  await page.locator('.dm-studio-settings > summary').click();
  await page.getByRole('radio', { name: '수학', exact: true }).check();
  await page.getByLabel('학년군').selectOption('1-2');
  await page.getByLabel('영역').selectOption({ label: '수와 연산' });
  await page.getByLabel('문항 수').fill('50');
  await page.getByRole('radio', { name: /^쉬움/ }).check();
  await page.getByLabel('seed').fill('mobile-long-practice');
  const delivered = page.waitForResponse((response) =>
    response.url().endsWith('/v1/worksheets') && response.request().method() === 'POST');
  await page.getByRole('button', { name: '50문항 생성', exact: true }).click();
  const response = await delivered;
  expect(response.ok()).toBe(true);
  const worksheet = await response.json() as {
    produced: number;
    items: Array<{ choices?: Array<{ text: string }> }>;
  };
  expect(worksheet.produced).toBe(50);
  await expect(page.locator('.dm-item')).toHaveCount(50);
  const expectedChoices = worksheet.items.reduce((total, item) => total + (item.choices?.length ?? 0), 0);
  await expect(page.locator('.dm-item .dm-choice')).toHaveCount(expectedChoices);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  const textInput = page.locator('.dm-item input[type="text"], .dm-item textarea').first();
  if (await textInput.count()) {
    expect(await textInput.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    await textInput.fill('2');
    await expect(textInput).toHaveValue('2');
  }

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.dm-item:visible')).toHaveCount(50);
  await expect(page.locator('.dm-item .dm-choice:visible')).toHaveCount(expectedChoices);
  await expect(page.locator('.dm-learning-help:visible')).toHaveCount(0);
});

test('visiting a companion and returning preserves the active worksheet and answer', async ({ page }) => {
  await page.goto('/');
  await page.locator('.dm-studio-settings > summary').click();
  await page.getByRole('radio', { name: '수학', exact: true }).check();
  await page.getByLabel('문항 수').fill('6');
  await page.getByLabel('seed').fill('mobile-answer-retention');
  await page.getByRole('button', { name: '6문항 생성', exact: true }).click();
  await expect(page.locator('.dm-item')).toHaveCount(6);
  const first = page.locator('.dm-item').first();
  const radio = first.getByRole('radio').first();
  const isChoice = await radio.count() > 0;
  if (isChoice) await radio.check();
  else await first.getByRole('textbox').fill('2');
  const original = await first.innerText();

  await page.evaluate(() => { window.location.hash = 'garden'; });
  await expect(page.locator('#garden-view')).toBeVisible();
  await page.getByRole('button', { name: '학습하러 가기', exact: true }).click();
  await expect(page.locator('.dm-item')).toHaveCount(6);
  if (isChoice) await expect(first.getByRole('radio').first()).toBeChecked();
  else await expect(first.getByRole('textbox')).toHaveValue('2');
  expect(await first.innerText()).toBe(original);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
