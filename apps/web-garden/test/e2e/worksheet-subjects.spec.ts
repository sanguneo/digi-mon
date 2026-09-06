import { expect, test } from '@playwright/test';
import type { Worksheet } from '../../src/api.ts';

const screenshots = '../../artifacts/worksheet-garden';

test('real grade presets generate complete plentiful arithmetic and mixed practice', async ({ request }) => {
  for (const grade of ['1-2', '3-4', '5-6']) {
    for (const count of [30, 50]) {
      const response = await request.post('/learner/api/v1/worksheets', { data: {
        subject: 'math', grade: [grade], domain: ['수와 연산'], count, difficulty: 1, seed: `worksheet-${grade}-${count}`,
      } });
      expect(response.status()).toBe(200);
      const sheet = await response.json() as Worksheet;
      expect(sheet.produced).toBe(count);
      expect(sheet.items.every((item) => item.gradeBand === grade && item.difficulty === 1 && item.domain === '수와 연산')).toBe(true);
      expect(new Set(sheet.items.map((item) => item.id)).size).toBe(count);
      expect(sheet.items.every((item) => !('answer' in item))).toBe(true);
    }
  }
});

test('renders subject sheets, exact choices, progressive help, and full print sets without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const generate = async (count: number) => {
    const responseReady = page.waitForResponse((response) => response.url().endsWith('/learner/api/v1/worksheets') && response.request().method() === 'POST');
    await page.getByRole('button', { name: `${count}문항 생성`, exact: true }).click();
    const response = await responseReady;
    expect(response.status()).toBe(200);
    const sheet = await response.json() as Worksheet;
    await expect(page.locator('.dm-item')).toHaveCount(count);
    return sheet;
  };
  const checkLayout = async (sheet: Worksheet) => {
    const choiceCount = sheet.items.reduce((count, item) => count + (item.choices?.length ?? 0), 0);
    await expect(page.locator('.dm-choice')).toHaveCount(choiceCount);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator('.dm-choice, .dm-figure__canvas').evaluateAll((nodes) => nodes.every((node) => node.scrollWidth <= node.clientWidth + 1))).toBe(true);
  };

  const math = await generate(12);
  expect(new Set(math.items.map((item) => item.standardCode)).size).toBeGreaterThan(3);
  expect(new Set(math.items.map((item) => item.domain)).size).toBeGreaterThan(1);
  await checkLayout(math);
  await expect(page.locator('.dm-practice-group')).toHaveCount(3);
  const helpItem = math.items.find((item) => item.learningSupport?.status === 'guided-candidate');
  expect(helpItem).toBeDefined();
  if (!helpItem || helpItem.learningSupport?.status !== 'guided-candidate') throw new Error('Expected guided support in real default worksheet');
  const card = page.locator('.dm-item').nth(helpItem.number - 1);
  const help = card.locator('.dm-learning-help');
  await expect(help).not.toHaveAttribute('open', '');
  await help.locator('summary').click();
  await expect(help.locator('li')).toHaveCount(0);
  await help.getByRole('button', { name: '도움말 한 걸음', exact: true }).click();
  await expect(help.locator('li')).toHaveText([helpItem.learningSupport.hints[0].text]);
  await help.getByRole('button', { name: '도움말 한 걸음 더', exact: true }).click();
  await expect(help.locator('li')).toHaveText(helpItem.learningSupport.hints.map((hint) => hint.text));
  await page.locator('.dm-worksheet').screenshot({ path: `${screenshots}-math-mobile.png` });

  await page.getByRole('button', { name: '50문항 넉넉히', exact: true }).click();
  const plentiful = await generate(50);
  await checkLayout(plentiful);
  await expect(page.locator('.dm-practice-group')).toHaveCount(13);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.dm-item')).toHaveCount(50);
  await expect(page.locator('.dm-item').last()).toBeVisible();
  await expect(page.locator('.dm-learning-help').first()).toBeHidden();
  await checkLayout(plentiful);
  await page.pdf({ path: `${screenshots}-50.pdf`, format: 'A4', printBackground: true });
  await page.emulateMedia({ media: 'screen' });

  for (const subject of ['국어', '영어']) {
    await page.getByRole('radio', { name: subject, exact: true }).check();
    if (subject === '영어') await expect(page.getByLabel('학년군')).toHaveValue('3-4');
    const sheet = await generate(6);
    await checkLayout(sheet);
    await page.locator('.dm-worksheet').screenshot({ path: `${screenshots}-${sheet.options.subject}-mobile.png` });
    await page.setViewportSize({ width: 1024, height: 768 });
    await checkLayout(sheet);
    await page.locator('.dm-worksheet').screenshot({ path: `${screenshots}-${sheet.options.subject}-tablet.png` });
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.dm-item').last()).toBeVisible();
    await checkLayout(sheet);
    await page.pdf({ path: `${screenshots}-${sheet.options.subject}.pdf`, format: 'A4', printBackground: true });
    await page.emulateMedia({ media: 'screen' });
    await page.setViewportSize({ width: 390, height: 844 });
  }
});
