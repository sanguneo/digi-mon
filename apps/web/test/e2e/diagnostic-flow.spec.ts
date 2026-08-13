import { expect, test, type Page } from '@playwright/test';

interface TeacherItem {
  number: number;
  format: string;
  answer: { display: string; accepts?: string[] };
  choices?: Array<{ label: string; text: string; correct: boolean }>;
}

async function answerItem(page: Page, item: TeacherItem, answer: string): Promise<void> {
  const itemSurface = page.locator(`[data-response-number="${item.number}"]`);
  if (item.choices) {
    const choice = item.choices.find((entry) => entry.text === answer);
    if (!choice) throw new Error(`${item.number}번에 답 "${answer}" 선택지가 없다`);
    await itemSurface
      .getByRole('radio', { name: `${choice.label} ${choice.text}`, exact: true })
      .check();
    return;
  }
  await itemSurface.getByRole('textbox').fill(answer);
}

test('grades an anonymous diagnostic and starts the recommended learning path', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '진단평가' }).click();

  const options = {
    subject: 'math',
    grade: ['1-2'],
    count: 6,
    difficulty: 2,
    seed: 'diagnostic-e2e',
    includeAnswers: true,
  };
  const teacherResponse = await request.post('/teacher/api/v1/worksheets', { data: options });
  expect(teacherResponse.ok()).toBeTruthy();
  const teacherWorksheet = await teacherResponse.json() as {
    items: TeacherItem[];
  };

  await page.getByRole('radio', { name: '수학' }).check();
  await page.getByLabel('학년군').selectOption('1-2');
  await page.getByLabel('문항 수').fill('6');
  await page.getByRole('radio', { name: '기본' }).check();
  await page.getByLabel('seed').fill('diagnostic-e2e');
  await page.getByRole('button', { name: '진단평가 시작' }).click();

  const [first, second] = teacherWorksheet.items;
  if (!first || !second) throw new Error('진단 fixture에 두 문항이 필요하다');
  await answerItem(page, first, first.answer.display);
  if (second.choices) {
    const incorrect = second.choices.find((choice) => !choice.correct);
    expect(incorrect).toBeDefined();
    if (!incorrect) throw new Error('오답 선택지가 필요하다');
    await answerItem(page, second, incorrect.text);
  } else {
    await answerItem(page, second, '틀린 답');
  }

  await page.getByRole('button', { name: '진단 결과 보기' }).click();

  await expect(page.getByRole('heading', { name: '진단 결과' })).toBeVisible();
  await expect(page.getByText('정확도', { exact: true })).toBeVisible();
  await expect(page.getByText('완료율', { exact: true })).toBeVisible();
  await expect(page.getByText('표본 부족').first()).toBeVisible();
  await expect(page.getByText('추천 판단', { exact: true })).toBeVisible();
  await expect(page.getByText('추천 근거', { exact: true })).toBeVisible();

  await page.screenshot({
    path: '../../artifacts/qa/diagnostic-result.png',
    fullPage: true,
  });

  await page.getByRole('button', { name: '맞춤 학습 시작' }).click();
  await expect(page.getByRole('heading', { name: '맞춤 학습지' })).toBeVisible();
  await expect(page.locator('.dm-item').first()).toBeVisible();

  await page.screenshot({
    path: '../../artifacts/qa/adaptive-learning.png',
    fullPage: true,
  });
});
