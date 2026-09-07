import { expect, test, type Page } from '@playwright/test';
import type { Worksheet } from '../../src/api.ts';
import { EMPTY_GAME_STATE, careForWorld, recordAnswer, serializeGameState, type GameState } from '../../src/game-state.ts';

async function create(page: Page, name: string): Promise<Worksheet> {
  const issued = page.waitForResponse((response) => response.url().endsWith('/v1/worksheets') && response.request().method() === 'POST');
  await page.getByRole('button', { name, exact: true }).click();
  const response = await issued;
  expect(response.ok()).toBe(true);
  const worksheet = await response.json() as Worksheet;
  await expect(page.locator('.dm-practice')).toHaveAttribute('data-worksheet-id', worksheet.fingerprint);
  return worksheet;
}

test('phone home puts subject and start in the first viewport and reaches a question in two taps', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const cta = page.getByRole('button', { name: '12문항 생성', exact: true });
  const box = await cta.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(812);
  for (const label of ['수학', '국어', '영어']) await expect(page.getByRole('radio', { name: label, exact: true })).toBeInViewport();
  await expect(page.locator('.dm-studio-settings')).not.toHaveAttribute('open');
  await page.screenshot({ path: '../../artifacts/quality-review/home-phone-after.png', fullPage: true });
  console.log(`375x812 CTA: y=${box!.y}, bottom=${box!.y + box!.height}`);
  await page.getByRole('radio', { name: '수학', exact: true }).check();
  await create(page, '12문항 생성');
  await expect(page.locator('.dm-practice-group').first()).toBeFocused();
  await expect(page.locator('.dm-item').first()).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '../../artifacts/quality-review/question-phone-after.png' });
});

test('real new practice excludes prior items; exact repeat ignores builder edits and does not duplicate progress', async ({ page }) => {
  await page.goto('/');
  await page.locator('.dm-studio-settings > summary').click();
  await page.getByLabel('seed', { exact: true }).fill('studio-repeat-real');
  const first = await create(page, '입력한 seed로 생성');
  const second = await create(page, '새 문제 풀기');
  expect(second.seed).not.toBe(first.seed);
  expect(new Set(second.options.excludeItemIds)).toEqual(new Set(first.items.map((item) => item.id)));
  expect(second.items.some((item) => first.items.some((prior) => prior.id === item.id))).toBe(false);
  const input = page.locator('.dm-item input[type="text"], .dm-item textarea').first();
  await input.fill('2');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('digi-mon/garden-state@1')!).worlds.math);
  await page.getByRole('radio', { name: '영어', exact: true }).check();
  await page.getByLabel('seed', { exact: true }).fill('changed-builder');
  const requests: string[] = [];
  page.on('request', (request) => { if (request.url().endsWith('/v1/worksheets')) requests.push(request.url()); });
  await page.getByRole('button', { name: '같은 문제 다시 풀기' }).click();
  await expect(input).toHaveValue('');
  await expect(page.locator('.dm-practice')).toHaveAttribute('data-worksheet-id', second.fingerprint);
  expect(await page.locator('.dm-item__stem').allTextContents()).toEqual(second.items.map((item) => item.stem));
  await input.fill('3');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('digi-mon/garden-state@1')!).worlds.math)).toEqual(saved);
  expect(requests).toHaveLength(0);
});

test('exact repeat clears diagnostic results with an identical fingerprint', async ({ page }) => {
  await page.goto('/#diagnostic');
  const first = await create(page, '진단평가 시작');
  const gate = page.waitForResponse((response) => response.url().endsWith('/v1/learning-gate'));
  await page.getByRole('button', { name: '진단 결과 보기' }).click();
  await gate;
  await expect(page.locator('.dm-results')).toBeVisible();
  await page.getByRole('button', { name: '같은 문제 다시 풀기' }).click();
  await expect(page.locator('.dm-results')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '진단 결과 보기' })).toBeVisible();
  await expect(page.locator('.dm-practice')).toHaveAttribute('data-worksheet-id', first.fingerprint);
});

for (const subject of ['korean', 'english'] as const) {
  test(`direct garden reload preserves the saved ${subject} companion and growth`, async ({ page }) => {
    let state: GameState = { ...EMPTY_GAME_STATE, activeSubject: subject };
    for (let index = 0; index < 36; index++) state = recordAnswer(state, 'restore', String(index), subject).state;
    for (let index = 0; index < 6; index++) state = careForWorld(state, subject, subject === 'korean' ? 'water' : 'feed');
    await page.addInitScript((saved) => {
      if (!localStorage.getItem('digi-mon/garden-state@1')) localStorage.setItem('digi-mon/garden-state@1', saved);
    }, serializeGameState(state));
    await page.goto('/#garden');
    await expect(page.locator('#garden-view')).toHaveAttribute('data-world', subject);
    await expect(page.locator('.world-growth')).toHaveAttribute('data-stage', '3');
    await page.reload();
    await expect(page.locator('#garden-view')).toHaveAttribute('data-world', subject);
    await expect(page.locator('.world-growth')).toHaveAttribute('data-stage', '3');
    expect(await page.evaluate((selected) => JSON.parse(localStorage.getItem('digi-mon/garden-state@1')!).worlds[selected].answeredKeys.length, subject)).toBe(36);
  });
}

test('a new page start is fresh while explicit configured seeds remain reproducible', async ({ page }) => {
  await page.goto('/');
  const first = await create(page, '12문항 생성');
  await page.reload();
  const next = await create(page, '12문항 생성');
  expect(next.seed).not.toBe(first.seed);
  await page.locator('.dm-studio-settings > summary').click();
  await page.getByLabel('seed', { exact: true }).fill('reproducible-studio');
  const configured = await create(page, '입력한 seed로 생성');
  const replayed = await create(page, '입력한 seed로 생성');
  expect(configured.seed).toBe('reproducible-studio');
  expect(replayed.fingerprint).toBe(configured.fingerprint);
});

for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
  test(`tablet ${viewport.width}x${viewport.height} keeps settings and paper-sized practice available`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('button', { name: '12문항 생성' })).toBeInViewport();
    await page.locator('.dm-studio-settings > summary').click();
    for (const count of [30, 50, 100]) await expect(page.getByRole('button', { name: new RegExp(`${count}문항`) })).toBeVisible();
    for (const label of ['학년군', '영역', '문항 수', 'seed']) await expect(page.getByLabel(label, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.dm-studio-settings > summary').click();
    await page.screenshot({ path: `../../artifacts/quality-review/home-${viewport.width}-after.png`, fullPage: true });
  });
}
