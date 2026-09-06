import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/#diagnostic');
  await page.reload();
});

test('fork preserves subject worksheet generation and engine geometry', async ({ page }) => {
  await page.goto('/#studio');
  await expect(page.locator('#garden-summary-title')).toBeVisible();

  await page.getByRole('button', { name: '문제 만들기' }).click();
  await page.getByRole('radio', { name: '수학' }).check();
  await page.getByLabel('학년군').selectOption('3-4');
  await page.getByLabel('영역').selectOption({ label: '도형과 측정' });
  await page.getByLabel('문항 수').fill('6');
  await page.getByRole('radio', { name: '기본' }).check();
  await page.getByRole('button', { name: '6문항 생성' }).click();

  await expect(page.locator('.dm-item')).toHaveCount(6);
  await expect(page.getByText(/fingerprint/i)).toBeVisible();
  await expect(
    page.locator('.dm-figure svg[role="img"], .dm-figure-fallback').first(),
  ).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('digi-mon/garden-state@1')!).worlds.math.answeredKeys)).toEqual([]);
  await page.screenshot({
    path: '../../artifacts/qa-garden/problem-studio.png',
    fullPage: true,
  });
});

test('three unique answers unlock one reward and duplicate changes do not count', async ({ page }) => {
  await page.goto('/');
  await page.goto('/#diagnostic');
  await page.getByRole('radio', { name: '수학' }).check();
  await page.getByLabel('학년군').selectOption('1-2');
  await page.getByLabel('문항 수').fill('6');
  await page.getByRole('radio', { name: '기본' }).check();
  await page.getByLabel('seed').fill('garden-reward-e2e');
  await page.getByRole('button', { name: '진단평가 시작' }).click();

  const fields = page.locator('[data-response-number]');
  const firstRadio = fields.nth(0).getByRole('radio').first();
  const firstText = fields.nth(0).getByRole('textbox');
  if (await firstRadio.count()) await firstRadio.check();
  else await firstText.fill('아무 답');
  await expect(page.locator('#garden-summary-title')).toContainText('1/3');

  if (await firstRadio.count()) {
    const choices = fields.nth(0).getByRole('radio');
    if (await choices.count() > 1) await choices.nth(1).check();
  } else {
    await firstText.fill('바꾼 답');
  }
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('digi-mon/garden-state@1')!).worlds.math.answeredKeys)).toHaveLength(1);

  for (const index of [1, 2]) {
    const item = fields.nth(index);
    const radio = item.getByRole('radio').first();
    if (await radio.count()) await radio.check();
    else await item.getByRole('textbox').fill('해 본 답');
  }

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('digi-mon/garden-state@1')!));
  expect(saved.worlds.math.quotaProgress).toBe(0);
  expect(saved.worlds.math.unlockedItemIds).toEqual(['puppy-ball']);
  expect(saved.worlds.korean.unlockedItemIds).toEqual([]);
  await page.getByRole('button', { name: '새 장식 놓으러 가기' }).click();
  await expect(page).toHaveURL(/#garden$/);
  await expect(page.getByRole('button', { name: /통통 공/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /폭신 방석/ })).toBeDisabled();
  await expect(page.locator('.world-placement__spots button')).toHaveCount(8);
  await expect(page.locator('#garden-view')).toHaveAttribute('data-world', 'math');

  await page.screenshot({
    path: '../../artifacts/qa-garden/reward-to-garden.png',
    fullPage: true,
  });
});

test('places an earned decoration and persists it across reload', async ({ page }) => {
  await page.goto('/#garden');
  await page.evaluate(() => {
    localStorage.setItem('digi-mon/garden-state@1', JSON.stringify({
      version: 2,
      quotaProgress: 0,
      answeredKeys: ['a:1', 'a:2', 'a:3'],
      unlockedItemIds: ['moon-chair'],
      placements: {},
      latestRewardId: 'moon-chair',
    }));
  });
  await page.reload();
  await page.getByRole('button', { name: /달빛 의자/ }).click();
  await page.getByRole('button', { name: '연못 옆 배치 지점' }).click();
  await expect(page.getByRole('img', { name: '달빛 의자, 연못 옆에 놓임' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('img', { name: '달빛 의자, 연못 옆에 놓임' })).toBeVisible();
  await page.getByRole('button', { name: /달빛 의자.*다시 놓기/ }).click();
  await page.getByRole('button', { name: '큰 나무 아래 배치 지점' }).click();
  await expect(page.getByRole('img', { name: '달빛 의자, 큰 나무 아래에 놓임' })).toBeVisible();

  await page.screenshot({
    path: '../../artifacts/qa-garden/decorated-garden.png',
    fullPage: true,
  });
});
