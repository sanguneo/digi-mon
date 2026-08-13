import { expect, test } from '@playwright/test';

test('creates an exact-count math worksheet with accessible engine geometry', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: '문제 만들기' }).click();
  await page.getByRole('radio', { name: '수학' }).check();
  await page.getByLabel('학년군').selectOption('3-4');
  await page.getByLabel('문항 수').fill('6');
  await page.getByRole('radio', { name: '기본' }).check();
  await page.getByLabel('영역').selectOption({ label: '도형과 측정' });
  await page.getByRole('button', { name: '6문항 생성' }).click();

  await expect(page.locator('.dm-item')).toHaveCount(6);
  await expect(page.getByText('수학 · 3-4학년')).toBeVisible();
  await expect(page.getByText('난이도 기본')).toBeVisible();
  await expect(page.getByText(/fingerprint/i)).toBeVisible();
  await expect(
    page.locator('.dm-figure svg[role="img"], .dm-figure-fallback').first(),
  ).toBeVisible();

  await page.screenshot({
    path: '../../artifacts/qa/problem-studio.png',
    fullPage: true,
  });
});

test('honors subject, count, difficulty, and count boundaries', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '문제 만들기' }).click();

  const create = async (
    subject: '국어' | '영어',
    gradeBand: '1-2' | '5-6',
    count: number,
    difficulty: '쉬움' | '도전',
  ) => {
    await page.getByRole('radio', { name: subject }).check();
    await page.getByLabel('학년군').selectOption(gradeBand);
    await page.getByLabel('영역').selectOption('');
    await page.getByLabel('문항 수').fill(String(count));
    await page.getByRole('radio', { name: difficulty }).check();
    await page.getByRole('button', { name: `${count}문항 생성` }).click();
    await expect(page.locator('.dm-item')).toHaveCount(count);
    await expect(page.getByText(new RegExp(`${subject} · ${gradeBand}학년`))).toBeVisible();
    await expect(page.getByText(`난이도 ${difficulty}`)).toBeVisible();
  };

  await create('국어', '1-2', 3, '쉬움');
  await create('영어', '5-6', 4, '도전');

  await page.getByLabel('문항 수').fill('101');
  await expect(page.getByRole('button', { name: /문항 생성/ })).toBeDisabled();
  await expect(page.getByText('문항 수는 1개부터 100개까지입니다.')).toBeVisible();
});
