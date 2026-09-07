// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createWorksheet, getSubjects, type Worksheet } from './api.ts';
import { ProblemStudio } from './problem-studio.tsx';

const { getProblemTypes } = vi.hoisted(() => ({ getProblemTypes: vi.fn() }));
vi.mock('./api.ts', async (original) => ({
  ...await original<typeof import('./api.ts')>(),
  createWorksheet: vi.fn(), getSubjects: vi.fn(), getProblemTypes,
}));

const types = [
  { id: 'math.add', skill: '덧셈', subject: 'math', gradeBand: '1-2', domain: '수와 연산', difficulties: [1, 2] },
  { id: 'math.shape', skill: '도형', subject: 'math', gradeBand: '1-2', domain: '도형과 측정', difficulties: [1] },
  { id: 'math.upper', skill: '분수', subject: 'math', gradeBand: '5-6', domain: '수와 연산', difficulties: [1] },
  { id: 'math.challenge', skill: '복합 계산', subject: 'math', gradeBand: '1-2', domain: '수와 연산', difficulties: [3] },
  { id: 'korean.spacing', skill: '띄어쓰기', subject: 'korean', gradeBand: '1-2', domain: '문법', difficulties: [1] },
  { id: 'english.word', skill: '낱말', subject: 'english', gradeBand: '3-4', domain: '이해', difficulties: [1] },
];

function worksheet(subject: Worksheet['options']['subject'], count: number): Worksheet {
  return {
    schema: 'digi-mon/worksheet@5', seed: 'fixture', fingerprint: 'selection-fixture',
    title: 'fixture', requested: count, produced: count, shortfall: 0,
    options: { subject, count, modes: [], followLearningOrder: false, excludeItemIds: [] },
    standardsUsed: [], difficultyHistogram: { 1: count },
    items: Array.from({ length: count }, (_, index) => ({
      id: `fixture-${index}`, number: index + 1, standardCode: 'fixture',
      subject, subjectKorean: '수학', gradeBand: '1-2', domain: '수와 연산',
      skill: 'fixture', difficulty: 1, format: 'short-answer', scoring: 'auto', stem: '2 + 3',
    })),
  };
}

beforeEach(() => {
  getProblemTypes.mockResolvedValue(types);
  vi.mocked(getSubjects).mockResolvedValue([{
    subject: 'math', subjectKorean: '수학', standardCount: 2, coveredStandards: 2, coverageRatio: 1,
    domains: ['수와 연산', '도형과 측정'].map((domain) => ({ domain, total: 1, covered: 1, coverageRatio: 1 })),
  }]);
  vi.mocked(createWorksheet).mockImplementation(async (options) => worksheet(options.subject, options.count));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

async function mount() {
  const onWorksheet = vi.fn();
  await act(async () => { render(<ProblemStudio mode="worksheet" onWorksheet={onWorksheet} />); });
  return onWorksheet;
}
const typeSelect = () => screen.getByRole('combobox', { name: '문제 유형' });
const chooseType = () => fireEvent.change(typeSelect(), { target: { value: 'math.add' } });

describe('problem selection', () => {
  it('offers native directly visible type and count controls with exact catalog skills', async () => {
    await mount();
    expect(getProblemTypes).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('spinbutton', { name: '문항 수' }).closest('details')).toBeNull();
    expect(typeSelect().tagName).toBe('SELECT');
    expect(typeSelect().closest('details')).toBeNull();
    expect(Array.from(typeSelect().querySelectorAll('option'), (option) => [option.value, option.textContent]))
      .toEqual([['', '전체 유형'], ...types.slice(0, 2).map((type) => [type.id, type.skill])]);
  });

  it('submits the exact count and selected generator together and renders every issued item', async () => {
    const onWorksheet = await mount();
    fireEvent.change(screen.getByLabelText('문항 수'), { target: { value: '7' } });
    chooseType();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '7문항 생성' })); });
    expect(createWorksheet).toHaveBeenCalledExactlyOnceWith({
      subject: 'math', grade: ['1-2'], count: 7, difficulty: 1, seed: 'today-math', generatorIds: ['math.add'],
    });
    expect(document.querySelectorAll('.dm-item')).toHaveLength(7);
    expect(onWorksheet).toHaveBeenCalledTimes(1);
  });

  it('filters availability by subject, grade, domain and difficulty', async () => {
    await mount();
    const values = () => Array.from(typeSelect().querySelectorAll('option'), (option) => option.value);
    expect(values()).toEqual(['', 'math.add', 'math.shape']);
    fireEvent.change(screen.getByLabelText('영역'), { target: { value: '도형과 측정' } });
    expect(values()).toEqual(['', 'math.shape']);
    fireEvent.change(screen.getByLabelText('학년군'), { target: { value: '5-6' } });
    expect(values()).toEqual(['']);
    fireEvent.change(screen.getByLabelText('영역'), { target: { value: '' } });
    expect(values()).toEqual(['', 'math.upper']);
    fireEvent.change(screen.getByLabelText('학년군'), { target: { value: '1-2' } });
    fireEvent.click(screen.getByRole('radio', { name: /기본/ }));
    expect(values()).toEqual(['', 'math.add']);
    fireEvent.click(screen.getByRole('radio', { name: /도전/ }));
    expect(values()).toEqual(['', 'math.challenge']);
    fireEvent.click(screen.getByRole('radio', { name: '국어' }));
    expect(values()).toEqual(['', 'korean.spacing']);
    fireEvent.click(screen.getByRole('radio', { name: '영어' }));
    expect(values()).toEqual(['', 'english.word']);
  });

  it.each(['subject', 'grade', 'domain', 'difficulty', 'preset'])('clears a selected type after changing %s even if still compatible', async (control) => {
    await mount();
    chooseType();
    if (control === 'subject') fireEvent.click(screen.getByRole('radio', { name: '국어' }));
    if (control === 'grade') fireEvent.change(screen.getByLabelText('학년군'), { target: { value: '5-6' } });
    if (control === 'domain') fireEvent.change(screen.getByLabelText('영역'), { target: { value: '수와 연산' } });
    if (control === 'difficulty') fireEvent.click(screen.getByRole('radio', { name: /기본/ }));
    if (control === 'preset') fireEvent.click(screen.getByRole('button', { name: /30문항/ }));
    expect(typeSelect()).toHaveProperty('value', '');
  });

  it.each(['initial', 'explicit-all'])('omits the optional generator filter for %s all types', async (selection) => {
    await mount();
    if (selection === 'explicit-all') {
      chooseType();
      fireEvent.change(typeSelect(), { target: { value: '' } });
    }
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '12문항 생성' })); });
    expect(createWorksheet).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createWorksheet).mock.lastCall?.[0]).not.toHaveProperty('generatorIds');
  });

  it.each(['edited', 'preset'])('preserves %s count through subject switches', async (choice) => {
    await mount();
    if (choice === 'edited') fireEvent.change(screen.getByLabelText('문항 수'), { target: { value: '17' } });
    else fireEvent.click(screen.getByRole('button', { name: /30문항/ }));
    for (const subject of ['국어', '영어', '수학']) {
      fireEvent.click(screen.getByRole('radio', { name: subject }));
      expect(screen.getByLabelText('문항 수')).toHaveProperty('value', choice === 'edited' ? '17' : '30');
    }
  });

  it('uses subject defaults only until count is explicitly chosen', async () => {
    await mount();
    expect(screen.getByLabelText('문항 수')).toHaveProperty('value', '12');
    for (const [subject, count] of [['국어', '6'], ['영어', '6'], ['수학', '12']] as const) {
      fireEvent.click(screen.getByRole('radio', { name: subject }));
      expect(screen.getByLabelText('문항 수')).toHaveProperty('value', count);
    }
  });

  it.each(['0', '101', '1.5', ''])('does not submit invalid count %s', async (value) => {
    await mount();
    const input = screen.getByLabelText('문항 수');
    fireEvent.change(input, { target: { value } });
    await act(async () => { fireEvent.submit(input.closest('form')!); });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(createWorksheet).not.toHaveBeenCalled();
  });

  it('keeps the prior worksheet and exact requested count on a capacity conflict without retrying', async () => {
    const onWorksheet = await mount();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '12문항 생성' })); });
    const issued = screen.getByRole('region', { name: '생성된 학습지' });
    vi.mocked(createWorksheet).mockRejectedValueOnce(new ApiError('capacity', 409, { produced: 3 }));
    fireEvent.change(screen.getByLabelText('문항 수'), { target: { value: '17' } });
    chooseType();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '17문항 생성' })); });
    expect(createWorksheet).toHaveBeenCalledTimes(2);
    expect(createWorksheet).toHaveBeenLastCalledWith(expect.objectContaining({ count: 17, generatorIds: ['math.add'] }));
    expect(screen.getByLabelText('문항 수')).toHaveProperty('value', '17');
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('region', { name: '생성된 학습지' })).toBe(issued);
    expect(issued.querySelectorAll('.dm-item')).toHaveLength(12);
    expect(onWorksheet).toHaveBeenCalledTimes(1);
  });
});

describe('selection API contract', () => {
  it('unwraps the generator catalog from the learner endpoint', async () => {
    const api = await vi.importActual<typeof import('./api.ts')>('./api.ts');
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ generators: types })));
    vi.stubGlobal('fetch', fetch);
    expect(await api.getProblemTypes()).toEqual(types);
    expect(fetch).toHaveBeenCalledWith('/learner/api/v1/generators', expect.any(Object));
  });

  it('sends the exact optional filter for creation and replays issued options for grading', async () => {
    const api = await vi.importActual<typeof import('./api.ts')>('./api.ts');
    const sheet = worksheet('math', 7);
    sheet.options.generatorIds = ['math.add'];
    const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify(sheet)));
    vi.stubGlobal('fetch', fetch);
    await api.createWorksheet({ subject: 'math', count: 7, seed: 'fixture', generatorIds: ['math.add'] });
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({ subject: 'math', count: 7, seed: 'fixture', generatorIds: ['math.add'] });
    await api.gradeWorksheet(sheet, { 1: '5' });
    expect(JSON.parse(fetch.mock.calls[1]![1].body)).toEqual({
      ...sheet.options, seed: sheet.seed, fingerprint: sheet.fingerprint, responses: { 1: '5' }, records: false,
    });
    await api.createWorksheet({ subject: 'math', count: 7, seed: 'fixture' });
    expect(JSON.parse(fetch.mock.calls[2]![1].body)).not.toHaveProperty('generatorIds');
  });
});
