// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { getProblemTypes, getReviewItem, getReviewList, getSubjects, type ReviewItemDetail, type ReviewList } from './api.ts';
import { App } from './app.tsx';

vi.mock('./api.ts', async (original) => ({
  ...await original<typeof import('./api.ts')>(),
  getSubjects: vi.fn(), getProblemTypes: vi.fn(), getReviewList: vi.fn(), getReviewItem: vi.fn(),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const ITEM = {
  id: '111cb2ecec0d', subject: 'korean' as const, standardCode: '[2국02-02]', skill: '띄어 읽기', difficulty: 1 as const,
  instruction: '띄어 읽을 자리를 고르시오.', stem: '하얀 토끼가 빨간 당근을 먹습니다.', answer: "'토끼가' 다음",
  status: 'pending' as const, priority: null, reasons: [], notes: [],
};

it('keeps an unsaved review draft when the teacher visits another tab and comes back', async () => {
  vi.mocked(getSubjects).mockResolvedValue([]);
  vi.mocked(getProblemTypes).mockResolvedValue([]);
  vi.mocked(getReviewList).mockResolvedValue({
    writeEnabled: true, total: 1, matched: 1, offset: 0, limit: 50, counts: { pending: 1, reviewed: 0, excluded: 0 },
    facets: { subjects: ['korean'], standards: [], verdicts: [] }, items: [ITEM],
  } satisfies ReviewList);
  vi.mocked(getReviewItem).mockResolvedValue({
    ...ITEM, file: 'data/authored/korean/k2-02-02.json', statusEntry: null, writeEnabled: true, revision: 'aaaaaaaaaaaaaaaa',
    item: { id: ITEM.id, difficulty: 1, instruction: ITEM.instruction, stem: ITEM.stem, answer: ITEM.answer, distractors: ['a', 'b', 'c'], solution: ['s'] },
  } satisfies ReviewItemDetail);

  await act(async () => { render(<App />); });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '문항 검토' })); });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /하얀 토끼가/ })); });
  fireEvent.change(screen.getByRole('textbox', { name: '지문' }), { target: { value: '고친 지문' } });

  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '문제 만들기' })); });
  expect(screen.queryByRole('textbox', { name: '지문' })).toBeNull();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '문항 검토' })); });
  expect((screen.getByRole('textbox', { name: '지문' }) as HTMLTextAreaElement).value).toBe('고친 지문');
});
