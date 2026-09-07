// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Worksheet } from './api.ts';
import { collectResponses, ProblemStudio, WorksheetItems } from './problem-studio.tsx';
import { createWorksheet, getProblemTypes, getSubjects } from './api.ts';
import { isCompactCalculation } from './worksheet-items.tsx';

const { answerItem } = vi.hoisted(() => ({ answerItem: vi.fn() }));
vi.mock('./game-context.tsx', () => ({ useGame: () => ({ answerItem }) }));

vi.mock('./api.ts', async (original) => ({
  ...await original<typeof import('./api.ts')>(),
  createWorksheet: vi.fn(),
  getSubjects: vi.fn(),
  getProblemTypes: vi.fn(),
}));

function worksheet(subject: 'math' | 'korean' | 'english', count: number): Worksheet {
  return {
    schema: 'digi-mon/worksheet@5', seed: 'fixture', fingerprint: 'fixture-fingerprint',
    title: 'fixture', requested: count, produced: count, shortfall: 0,
    options: { subject, gradeBands: ['1-2'], count, difficulty: 1, modes: [], followLearningOrder: false, excludeItemIds: [] },
    standardsUsed: [], difficultyHistogram: { 1: count },
    items: Array.from({ length: count }, (_, index) => ({
      id: `${subject}-${index}`, number: index + 1, standardCode: 'fixture', subject,
      subjectKorean: { math: '수학', korean: '국어', english: '영어' }[subject],
      gradeBand: '1-2', domain: 'fixture', skill: 'fixture', difficulty: 1,
      format: 'short-answer', scoring: 'auto', stem: 'fixture question',
    })),
  };
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.mocked(getSubjects).mockResolvedValue([]);
  vi.mocked(getProblemTypes).mockResolvedValue([]);
  vi.mocked(createWorksheet).mockImplementation(async (options) => worksheet(options.subject, options.count));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

async function renderStudio(node: Parameters<typeof render>[0]) {
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(node); });
  fireEvent.click(view.container.querySelector('.dm-studio-settings > summary')!);
  return view;
}
async function generate(name: string) {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name })); });
}

describe('subject worksheet experience', () => {
  it.each([
    ['12 + 9 = □', true], ['3/4 × 2/5', true], ['42 − 18', true],
    ['1234', false], ['사과가 3개 있어요. 2개를 더 받으면?', false],
    ['12:30', false], ['1/2', false], ['삼각형을 그리세요.', false],
  ])('compacts only symbolic arithmetic: %s', (stem, expected) => {
    expect(isCompactCalculation({ subject: 'math', stem })).toBe(expected);
  });
  it('never compacts a figure, sequence, or another subject', () => {
    expect(isCompactCalculation({ subject: 'math', stem: '2 + 3', figure: { kind: 'fixture', altText: 'fixture' } })).toBe(false);
    expect(isCompactCalculation({ subject: 'korean', stem: '2 + 3' })).toBe(false);
    expect(isCompactCalculation({ subject: 'math', stem: '2 - 4 - □ - 8', instruction: '규칙을 찾으세요.' })).toBe(false);
  });
  it('defaults to twelve easy lower-grade math questions and keeps optional practice explicit', async () => {
    await renderStudio(<ProblemStudio mode="worksheet" onWorksheet={vi.fn()} />);
    expect((screen.getByLabelText('학년군') as HTMLSelectElement).value).toBe('1-2');
    expect((screen.getByLabelText('문항 수') as HTMLInputElement).value).toBe('12');
    await generate('12문항 생성');
    expect(createWorksheet).toHaveBeenCalledWith(expect.objectContaining({ subject: 'math', grade: ['1-2'], count: 12, difficulty: 1 }));
    fireEvent.click(screen.getByRole('button', { name: /30문항/ }));
    expect((screen.getByLabelText('문항 수') as HTMLInputElement).value).toBe('30');
    expect(createWorksheet).toHaveBeenCalledTimes(1);
  });

  it.each([['국어', 'korean', '1-2'], ['영어', 'english', '3-4']] as const)('uses a valid %s starter without carrying math count or domain', async (label, subject, grade) => {
    await renderStudio(<ProblemStudio mode="worksheet" onWorksheet={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: label }));
    expect((screen.getByLabelText('학년군') as HTMLSelectElement).value).toBe(grade);
    expect((screen.getByLabelText('문항 수') as HTMLInputElement).value).toBe('6');
    await generate('6문항 생성');
    expect(createWorksheet).toHaveBeenCalledWith(expect.objectContaining({ subject, grade: [grade], count: 6 }));
  });

  it.each([['math', 12, [4, 4, 4]], ['korean', 6, [2, 2, 2]], ['english', 7, [3, 3, 1]]] as const)('chunks %s without dropping or renumbering engine items', (subject, count, sizes) => {
    const { container } = render(<WorksheetItems worksheet={worksheet(subject, count)} diagnostic />);
    expect(Array.from(container.querySelectorAll('.dm-practice-group')).map((group) => group.querySelectorAll('.dm-item').length)).toEqual(sizes);
    expect(Array.from(container.querySelectorAll('[data-response-number]')).map((item) => Number(item.getAttribute('data-response-number')))).toEqual(Array.from({ length: count }, (_, i) => i + 1));
  });

  it('renders every engine choice on a printable worksheet', () => {
    const sheet = worksheet('english', 1);
    sheet.items[0]!.choices = [{ label: 'A', text: 'apple' }, { label: 'B', text: 'pear' }];
    const { container } = render(<WorksheetItems worksheet={sheet} diagnostic={false} />);
    expect(container.querySelectorAll('.dm-choice')).toHaveLength(2);
    expect(container.querySelector('.dm-choice span[lang="en"]')?.textContent).toBe('apple');
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(2);
  });

  it('collects multiline Korean responses without losing line breaks or blank-answer semantics', () => {
    const sheet = worksheet('korean', 2);
    sheet.items[0]!.scoring = 'manual';
    const { container } = render(<WorksheetItems worksheet={sheet} diagnostic />);
    const field = screen.getByRole('textbox', { name: '1번 답 입력' });
    expect(field.tagName).toBe('TEXTAREA');
    fireEvent.change(field, { target: { value: '첫 문장\n다음 문장' } });
    fireEvent.change(screen.getByRole('textbox', { name: '2번 답 입력' }), { target: { value: '   ' } });
    expect(collectResponses(container)).toEqual({ 1: '첫 문장\n다음 문장' });
  });

  it.each(['1-2', '3-4', '5-6'] as const)('keeps %s plentiful arithmetic and mixed application requests grade-correct', async (grade) => {
    await renderStudio(<ProblemStudio mode="worksheet" onWorksheet={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('학년군'), { target: { value: grade } });
    fireEvent.click(screen.getByRole('button', { name: /50문항/ }));
    await generate('50문항 생성');
    expect(createWorksheet).toHaveBeenCalledWith(expect.objectContaining({ subject: 'math', grade: [grade], count: 50, difficulty: 1, domain: ['수와 연산'] }));
    expect(screen.getByRole('button', { name: '학습지 인쇄' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '12문항 생각 넓히기' }));
    await generate('12문항 생성');
    expect(createWorksheet).toHaveBeenLastCalledWith(expect.objectContaining({ grade: [grade], count: 12, difficulty: grade === '1-2' ? 2 : 3 }));
    expect(vi.mocked(createWorksheet).mock.lastCall?.[0].domain).toBeUndefined();
  });

  it('marks mixed-language English prompts and translation choices by their text', () => {
    const sheet = worksheet('english', 1);
    sheet.items[0]!.stem = '알맞은 뜻을 고르세요. apple';
    sheet.items[0]!.choices = [{ label: 'A', text: '사과' }, { label: 'B', text: 'pear' }];
    const { container } = render(<WorksheetItems worksheet={sheet} diagnostic />);
    expect(container.querySelector('.dm-item__stem')?.getAttribute('lang')).toBe('ko');
    expect(container.querySelectorAll('.dm-choice span:last-child')[0]?.getAttribute('lang')).toBe('ko');
    expect(container.querySelectorAll('.dm-choice span:last-child')[1]?.getAttribute('lang')).toBe('en');
  });

  it('keeps fifty answers mounted while navigating among chunks', () => {
    const sheet = worksheet('math', 50);
    render(<WorksheetItems worksheet={sheet} diagnostic />);
    const field = screen.getByRole('textbox', { name: '1번 답 입력' });
    fireEvent.change(field, { target: { value: '1/2' } });
    fireEvent.click(screen.getByRole('link', { name: '49–50번' }));
    expect(document.activeElement?.className).toBe('dm-practice-group');
    expect((field as HTMLInputElement).value).toBe('1/2');
    expect(screen.getAllByRole('textbox')).toHaveLength(50);
    expect(field.getAttribute('inputmode')).not.toBe('numeric');
  });

  it('integrates delivered learning support without exposing hints until requested', async () => {
    const sheet = worksheet('math', 1);
    sheet.items[0]!.learningSupport = {
      schema: 'digi-mon/learning-support@1', objective: { text: 'fixture-objective', source: 'generator-skill' },
      status: 'guided-candidate', review: { status: 'candidate', sourceKind: 'repository-authored', revision: 1 },
      materials: [{ kind: 'principle', text: 'fixture-principle' }],
      hints: [{ level: 1, kind: 'strategy', text: 'fixture-hint-1' }, { level: 2, kind: 'strategy', text: 'fixture-hint-2' }],
    };
    vi.mocked(createWorksheet).mockResolvedValue(sheet);
    const { container } = await renderStudio(<ProblemStudio mode="worksheet" onWorksheet={vi.fn()} />);
    await generate('12문항 생성');
    const details = container.querySelector<HTMLDetailsElement>('.dm-item .dm-learning-help')!;
    expect(details).not.toBeNull();
    expect(details.open).toBe(false);
    fireEvent.click(details.querySelector('summary')!);
    expect(details.querySelectorAll('li')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: '도움말 한 걸음' }));
    expect(details.querySelectorAll('li')).toHaveLength(1);
    expect(details.querySelector('li')?.textContent).toBe(sheet.items[0]!.learningSupport.hints[0].text);
  });

  it('applies explicit room subject requests once without replacing the issued sheet', async () => {
    const onWorksheet = vi.fn();
    const onSubjectChange = vi.fn();
    const { container, rerender } = await renderStudio(<ProblemStudio mode="worksheet" onWorksheet={onWorksheet} onSubjectChange={onSubjectChange} />);
    await generate('12문항 생성');
    expect(screen.getByRole('button', { name: '학습지 인쇄' })).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: '1번 답 입력' }), { target: { value: '1/2' } });
    const subjectRequest = { subject: 'english' as const, revision: 1 };
    rerender(<ProblemStudio mode="worksheet" onWorksheet={onWorksheet} onSubjectChange={onSubjectChange} subjectRequest={subjectRequest} />);
    expect((screen.getByLabelText('학년군') as HTMLSelectElement).value).toBe('3-4');
    expect((screen.getByLabelText('문항 수') as HTMLInputElement).value).toBe('6');
    expect(container.querySelector('.dm-worksheet')?.getAttribute('data-dm-subject')).toBe('math');
    expect((screen.getByRole('textbox', { name: '1번 답 입력' }) as HTMLInputElement).value).toBe('1/2');
    fireEvent.change(screen.getByLabelText('문항 수'), { target: { value: '9' } });
    rerender(<ProblemStudio mode="worksheet" onWorksheet={onWorksheet} onSubjectChange={onSubjectChange} subjectRequest={subjectRequest} />);
    expect((screen.getByLabelText('문항 수') as HTMLInputElement).value).toBe('9');
  });

  it('allows practice participation only for nonblank answers and uses the delivered item subject', () => {
    const sheet = worksheet('english', 1);
    render(<WorksheetItems worksheet={sheet} diagnostic={false} />);
    const field = screen.getByRole('textbox', { name: '1번 답 입력' });
    fireEvent.change(field, { target: { value: '   ' } });
    expect(answerItem).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: 'apple' } });
    expect(answerItem).toHaveBeenCalledWith(sheet.fingerprint, sheet.items[0]!.id, 'english');
  });

  it('keeps the issued subject identity when builder selection changes', async () => {
    const { container } = await renderStudio(<ProblemStudio mode="worksheet" onWorksheet={vi.fn()} />);
    await generate('12문항 생성');
    expect(container.querySelector('.dm-worksheet')).not.toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: '영어' }));
    expect(container.querySelector('.dm-worksheet')?.getAttribute('data-dm-subject')).toBe('math');
    expect(container.querySelector('.dm-worksheet__header h3')?.textContent).toContain('수학');
  });
});
