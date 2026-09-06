import { expect, test } from '@playwright/test';

test('practice answers belong to their issued subject and survive world visits and explicit subject requests', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '12문항 생성', exact: true }).click();
  await expect(page.locator('.dm-item')).toHaveCount(12);
  const fields = page.locator('.dm-worksheet .dm-answer__input');
  const first = fields.nth(0);
  const second = fields.nth(1);
  await expect(second).toBeVisible();
  const worldAnswers = () => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('digi-mon/garden-state@1')!);
    return Object.fromEntries(Object.entries(state.worlds).map(([subject, world]) => [subject, (world as { answeredKeys: string[] }).answeredKeys.length]));
  });
  await first.fill('   ');
  expect(await worldAnswers()).toEqual({ korean: 0, english: 0, math: 0 });
  await first.fill('1/2');
  expect(await worldAnswers()).toEqual({ korean: 0, english: 0, math: 1 });
  await page.getByRole('radio', { name: '영어', exact: true }).check();
  await second.fill('3');
  expect(await worldAnswers()).toEqual({ korean: 0, english: 0, math: 2 });

  await page.getByRole('button', { name: '세상 둘러보기', exact: true }).click();
  await expect(page.locator('#learning-view')).toBeHidden();
  await page.getByRole('group', { name: '돌볼 세상 고르기' }).getByRole('button', { name: /^영어/ }).click();
  await page.getByRole('button', { name: '영어 문제 해 보기', exact: true }).click();
  await expect(page.locator('#learning-view')).toBeVisible();
  await expect(page.getByLabel('학년군')).toHaveValue('3-4');
  await expect(page.getByLabel('문항 수')).toHaveValue('6');
  await expect(page.locator('.dm-worksheet')).toHaveAttribute('data-dm-subject', 'math');
  await expect(first).toHaveValue('1/2');
  await expect(second).toHaveValue('3');

  await page.getByLabel('문항 수').fill('9');
  await page.getByRole('button', { name: '세상 둘러보기', exact: true }).click();
  await page.getByRole('button', { name: '학습하러 가기', exact: true }).click();
  await expect(page.getByLabel('문항 수')).toHaveValue('9');
  await expect(first).toHaveValue('1/2');
  await page.goBack();
  await expect(page.locator('#learning-view')).toBeHidden();
  await page.goBack();
  await expect(page.locator('#learning-view')).toBeVisible();
  await expect(first).toHaveValue('1/2');
  await expect(second).toHaveValue('3');
});
