import { expect, test, type Page } from '@playwright/test';
import type { Worksheet } from '../../src/api.ts';

async function generate(page: Page, button: string): Promise<Worksheet> {
  const responseReady = page.waitForResponse((response) => response.url().endsWith('/v1/worksheets')
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: button, exact: true }).click();
  const response = await responseReady;
  expect(response.status()).toBe(200);
  const worksheet: Worksheet = await response.json();
  await expect(page.locator('.dm-practice')).toHaveAttribute('data-worksheet-id', worksheet.fingerprint);
  return worksheet;
}

test('phone count and type controls generate exactly the chosen type without opening settings', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const count = page.getByRole('spinbutton', { name: '문항 수' });
  const type = page.getByRole('combobox', { name: '문제 유형' });
  await expect(type).toBeEnabled();
  await expect(count).toBeInViewport();
  await expect(type).toBeInViewport();
  await count.fill('7');
  await type.selectOption('math.g12.no.s06.add');
  const start = page.getByRole('button', { name: '7문항 생성', exact: true });
  await expect(start).toBeInViewport();
  await expect(page.locator('.dm-studio-settings')).not.toHaveAttribute('open');
  const sheet = await generate(page, '7문항 생성');
  expect(sheet.options.generatorIds).toEqual(['math.g12.no.s06.add']);
  expect(sheet.produced).toBe(7);
  expect(sheet.items.every((item) => 'generatorId' in item && item.generatorId === 'math.g12.no.s06.add')).toBe(true);
  await expect(page.locator('.dm-item')).toHaveCount(7);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('fresh and exact-repeat keep selected-type identity while builder changes preserve the issued sheet', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('문제 유형', { exact: true })).toBeEnabled();
  await page.getByLabel('문항 수', { exact: true }).fill('7');
  await page.getByLabel('문제 유형', { exact: true }).selectOption('math.g12.no.s06.add');
  const first = await generate(page, '7문항 생성');
  const fresh = await generate(page, '새 문제 풀기');
  expect(fresh.options.generatorIds).toEqual(first.options.generatorIds);
  expect(fresh.items.some((item) => first.items.some((prior) => prior.id === item.id))).toBe(false);
  const answer = page.getByRole('textbox', { name: '1번 답 입력' });
  await answer.fill('42');
  await page.getByRole('radio', { name: '국어', exact: true }).check();
  await expect(page.getByLabel('문항 수', { exact: true })).toHaveValue('7');
  await expect(page.getByLabel('문제 유형', { exact: true })).toHaveValue('');
  await expect(answer).toHaveValue('42');
  await page.getByRole('button', { name: '같은 문제 다시 풀기', exact: true }).click();
  await expect(answer).toHaveValue('');
  await expect(page.locator('.dm-practice')).toHaveAttribute('data-worksheet-id', fresh.fingerprint);
  await expect(page.locator('.dm-item__stem')).toHaveText(fresh.items.map((item) => item.stem));
});

test('Korean spacing requires a written correction and capacity errors preserve the current answers', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByLabel('문제 유형', { exact: true })).toBeEnabled();
  await page.getByRole('radio', { name: '국어', exact: true }).check();
  await page.locator('.dm-studio-settings > summary').click();
  await page.getByLabel('학년군', { exact: true }).selectOption('5-6');
  await page.getByLabel('문제 유형', { exact: true }).selectOption('korean.g56.gr.s06.spacing');
  await page.getByLabel('문항 수', { exact: true }).fill('5');
  const sheet = await generate(page, '5문항 생성');
  expect(sheet.items.every((item) => item.format === 'short-answer' && !item.choices)).toBe(true);
  await expect(page.locator('.dm-choice')).toHaveCount(0);
  const answer = page.getByRole('textbox', { name: '1번 답 입력' });
  await expect(answer).toHaveValue('');
  const teacherResponse = await request.post('/teacher/api/v1/worksheets', {
    data: { ...sheet.options, seed: sheet.seed, includeAnswers: true },
  });
  expect(teacherResponse.status()).toBe(200);
  const teacher: { items: { answer: { display: string } }[] } = await teacherResponse.json();
  for (const item of teacher.items) {
    await expect(page.locator('.dm-item')).not.toContainText([item.answer.display]);
  }
  const firstItem = sheet.items[0];
  if (!firstItem) throw new Error('Expected a spacing item');
  await answer.fill(firstItem.stem);
  await page.getByLabel('문항 수', { exact: true }).fill('6');
  const failure = page.waitForResponse((response) => response.url().endsWith('/v1/worksheets')
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: '새 문제 풀기', exact: true }).click();
  expect((await failure).status()).toBe(409);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(answer).toHaveValue(firstItem.stem);
  await expect(page.locator('.dm-practice')).toHaveAttribute('data-worksheet-id', sheet.fingerprint);
});
