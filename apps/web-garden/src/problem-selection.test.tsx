// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWorksheet, getSubjects, type Worksheet } from './api.ts';
import { ProblemStudio } from './problem-studio.tsx';

const { getProblemTypes } = vi.hoisted(() => ({ getProblemTypes: vi.fn() }));
vi.mock('./api.ts', async (original) => ({
  ...await original<typeof import('./api.ts')>(),
  createWorksheet: vi.fn(), getSubjects: vi.fn(), getProblemTypes,
}));
vi.mock('./game-context.tsx', () => ({ useGame: () => ({ answerItem: vi.fn() }) }));

const types = [
  { id: 'math.add', skill: '덧셈', subject: 'math', gradeBand: '1-2', domain: '수와 연산', difficulties: [1, 2] },
  { id: 'math.shape', skill: '도형', subject: 'math', gradeBand: '1-2', domain: '도형과 측정', difficulties: [1] },
  { id: 'math.upper', skill: '분수', subject: 'math', gradeBand: '5-6', domain: '수와 연산', difficulties: [1] },
  { id: 'math.challenge', skill: '복합 계산', subject: 'math', gradeBand: '1-2', domain: '수와 연산', difficulties: [3] },
  { id: 'korean.spacing', skill: '띄어쓰기', subject: 'korean', gradeBand: '1-2', domain: '문법', difficulties: [1] },
];

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  getProblemTypes.mockResolvedValue(types);
  vi.mocked(getSubjects).mockResolvedValue([{
    subject: 'math', subjectKorean: '수학', standardCount: 2, coveredStandards: 2, coverageRatio: 1,
    domains: ['수와 연산', '도형과 측정'].map((domain) => ({ domain, total: 1, covered: 1, coverageRatio: 1 })),
  }]);
  vi.mocked(createWorksheet).mockImplementation(async (options): Promise<Worksheet> => ({
    schema: 'digi-mon/worksheet@5', seed: options.seed, fingerprint: 'selection-fixture',
    title: 'fixture', requested: options.count, produced: options.count, shortfall: 0,
    options: { subject: options.subject, count: options.count, modes: [], followLearningOrder: false, excludeItemIds: [] },
    standardsUsed: [], difficultyHistogram: { 1: options.count },
    items: Array.from({ length: options.count }, (_, index) => ({
      id: `fixture-${index}`, number: index + 1, standardCode: 'fixture',
      subject: options.subject, subjectKorean: '수학', gradeBand: '1-2', domain: '수와 연산',
      skill: 'fixture', difficulty: 1, format: 'short-answer', scoring: 'auto', stem: '2 + 3',
    })),
  }));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

async function mount() {
  await act(async () => { render(<ProblemStudio mode="worksheet" onWorksheet={vi.fn()} />); });
}

test('count and type are available without opening advanced settings', async () => {
  await mount();
  expect(screen.getByRole('spinbutton', { name: '문항 수' }).closest('details')).toBeNull();
  expect(screen.getByRole('combobox', { name: '문제 유형' }).closest('details')).toBeNull();
});

test('explicit count and selected type reach the generation request together', async () => {
  await mount();
  fireEvent.change(screen.getByRole('spinbutton', { name: '문항 수' }), { target: { value: '7' } });
  fireEvent.change(screen.getByRole('combobox', { name: '문제 유형' }), { target: { value: 'math.add' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '7문항 생성' })); });
  expect(createWorksheet).toHaveBeenCalledWith(expect.objectContaining({ count: 7, generatorIds: ['math.add'] }));
  expect(document.querySelectorAll('.dm-item')).toHaveLength(7);
});

test('type choices follow the subject grade domain and difficulty, and incompatible selection resets', async () => {
  await mount();
  const selector = screen.getByRole('combobox', { name: '문제 유형' });
  const values = () => Array.from(selector.querySelectorAll('option'), (option) => option.value);
  expect(values()).toEqual(['', 'math.add', 'math.shape']);
  fireEvent.change(selector, { target: { value: 'math.add' } });
  fireEvent.change(screen.getByLabelText('영역'), { target: { value: '도형과 측정' } });
  expect(values()).toEqual(['', 'math.shape']);
  expect(selector).toHaveProperty('value', '');
  fireEvent.change(screen.getByLabelText('학년군'), { target: { value: '5-6' } });
  expect(values()).toEqual(['']);
  fireEvent.change(screen.getByLabelText('영역'), { target: { value: '' } });
  expect(values()).toEqual(['', 'math.upper']);
  fireEvent.click(screen.getByRole('radio', { name: '국어' }));
  expect(values()).toEqual(['', 'korean.spacing']);
});

test('an explicitly entered count survives a subject change but its old type does not', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText('문항 수'), { target: { value: '17' } });
  fireEvent.change(screen.getByLabelText('문제 유형'), { target: { value: 'math.add' } });
  fireEvent.click(screen.getByRole('radio', { name: '국어' }));
  expect(screen.getByLabelText('문항 수')).toHaveProperty('value', '17');
  expect(screen.getByLabelText('문제 유형')).toHaveProperty('value', '');
});

test('changing difficulty clears an incompatible type and all-types requests omit the filter', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText('문제 유형'), { target: { value: 'math.add' } });
  const settings = document.querySelector('.dm-studio-settings > summary');
  if (!settings) throw new Error('Missing advanced settings');
  fireEvent.click(settings);
  expect(screen.getByRole('button', { name: '12문항 골고루' }).getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(screen.getByRole('radio', { name: /도전/ }));
  const selector = screen.getByLabelText('문제 유형');
  expect(selector).toHaveProperty('value', '');
  expect(Array.from(selector.querySelectorAll('option'), (option) => option.value)).toEqual(['', 'math.challenge']);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '12문항 생성' })); });
  expect(vi.mocked(createWorksheet).mock.lastCall?.[0].generatorIds).toBeUndefined();
  expect(vi.mocked(createWorksheet).mock.lastCall?.[0].difficulty).toBe(3);
});

test('a practice preset clears the old type and retains its explicit count on subject change', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText('문제 유형'), { target: { value: 'math.add' } });
  const settings = document.querySelector('.dm-studio-settings > summary');
  if (!settings) throw new Error('Missing advanced settings');
  fireEvent.click(settings);
  fireEvent.click(screen.getByRole('button', { name: '50문항 넉넉히' }));
  expect(screen.getByLabelText('문제 유형')).toHaveProperty('value', '');
  fireEvent.click(screen.getByRole('radio', { name: '국어' }));
  expect(screen.getByLabelText('문항 수')).toHaveProperty('value', '50');
});

test.each(['0', '101', '1.5', ''])('invalid count %s cannot submit a worksheet', async (value) => {
  await mount();
  fireEvent.change(screen.getByLabelText('문항 수'), { target: { value } });
  const input = screen.getByLabelText('문항 수');
  const form = input.closest('form');
  if (!form) throw new Error('Missing worksheet form');
  await act(async () => { fireEvent.submit(form); });
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(createWorksheet).not.toHaveBeenCalled();
});
