import { expect, test } from '@playwright/test';
import type { Worksheet } from '../../src/api.ts';

function choiceSheet(fingerprint: string): Worksheet {
  return {
    schema: 'digi-mon/worksheet@5', fingerprint, seed: fingerprint, title: 'fixture',
    produced: 1, requested: 1, shortfall: 0, standardsUsed: ['[2수01-03]'],
    difficultyHistogram: { 1: 1 },
    options: { subject: 'math', count: 1, modes: [], followLearningOrder: false, excludeItemIds: [] },
    items: [{
      id: fingerprint, number: 1, subject: 'math', subjectKorean: '수학',
      standardCode: '[2수01-03]', gradeBand: '1-2', domain: '수와 연산',
      skill: 'fixture', difficulty: 1, scoring: 'auto', format: 'multiple-choice',
      stem: '더 큰 수를 고르세요.', choices: [{ label: 'A', text: '3' }, { label: 'B', text: '5' }],
    }],
  };
}

test('diagnostic and adaptive answers remain independent in the real browser', async ({ page }) => {
  let issued = 0;
  await page.route('**/learner/api/v1/worksheets', route =>
    route.fulfill({ json: choiceSheet(++issued === 1 ? 'original' : 'follow-up') }));
  await page.route('**/learner/api/v1/grade', async route => {
    expect(route.request().postDataJSON().responses).toEqual({ 1: '3' });
    await route.fulfill({ json: { schema: 'digi-mon/grading-result@1', graded: 1, answered: 1, total: 1, correct: 0, accuracy: 0, completionRate: 1, manualScoringCount: 0, byStandard: { '[2수01-03]': { attempted: 1, correct: 0, accuracy: 0 } } } });
  });
  await page.route('**/learner/api/v1/learning-gate', route => route.fulfill({ json: {
    decision: 'practice', reasonCodes: ['insufficient-evidence'],
    nextAction: { kind: 'worksheet', codes: ['[2수01-03]'], modes: [], count: 1 },
  } }));
  await page.goto('/#diagnostic');
  await page.getByRole('button', { name: '진단평가 시작', exact: true }).click();
  const original = page.locator('.dm-studio .dm-item input[type="radio"]');
  await original.first().check();
  await page.getByRole('button', { name: '진단 결과 보기', exact: true }).click();
  await page.getByRole('button', { name: '맞춤 학습 시작', exact: true }).click();
  const followUp = page.locator('.dm-adaptive .dm-item input[type="radio"]');
  await followUp.last().check();
  await expect(original.first()).toBeChecked();
  await expect(followUp.last()).toBeChecked();
  await original.last().check();
  await expect(followUp.last()).toBeChecked();
});

test('a real construction item accepts a local drawing and keeps it across room visits', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route('**/learner/api/v1/worksheets', route => route.continue({
    postData: JSON.stringify({ ...route.request().postDataJSON(), codes: ['[2수03-04]'], count: 1 }),
  }));
  await page.goto('/');
  await page.getByRole('button', { name: '12문항 생성', exact: true }).click();
  await expect(page.locator('.dm-drawing')).toHaveCount(1);
  await expect(page.locator('.dm-item textarea')).toHaveCount(0);
  const area = page.locator('.dm-drawing__surface');
  await expect(area).toHaveCSS('touch-action', 'pan-y');
  await page.getByRole('button', { name: '그리기 시작', exact: true }).click();
  await area.scrollIntoViewIfNeeded();
  const box = (await area.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.2);
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7);
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.7);
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.up();
  await expect(area.locator('polyline')).toHaveCount(1);
  await page.getByRole('button', { name: '그리기 마치고 스크롤', exact: true }).click();
  await expect(area).toHaveCSS('touch-action', 'pan-y');
  await page.getByRole('button', { name: '세상 둘러보기', exact: true }).click();
  await page.getByRole('button', { name: '학습하러 가기', exact: true }).click();
  await expect(area.locator('polyline')).toHaveCount(1);
  await page.locator('.dm-drawing').screenshot({ path: '../../artifacts/qa-final/drawing-mobile.png' });
  await page.emulateMedia({ media: 'print' });
  await expect(area.locator('polyline')).toBeVisible();
  await page.pdf({ path: '../../artifacts/qa-final/drawing-print.pdf', format: 'A4', printBackground: true });
});
