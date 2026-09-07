// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWorksheet, getProblemTypes, getSubjects, type Worksheet } from './api.ts';
import { GameProvider, useGame } from './game-context.tsx';
import { ProblemStudio } from './problem-studio.tsx';

vi.mock('./api.ts', async (original) => ({
  ...await original<typeof import('./api.ts')>(), createWorksheet: vi.fn(), getSubjects: vi.fn(), getProblemTypes: vi.fn(),
}));

function sheet(seed: string, generation: number): Worksheet {
  return {
    schema: 'digi-mon/worksheet@5', seed, fingerprint: `sheet-${generation}`,
    title: 'fixture', requested: 12, produced: 12, shortfall: 0,
    options: { subject: 'math', gradeBands: ['1-2'], count: 12, difficulty: 1, modes: [], followLearningOrder: false, excludeItemIds: [] },
    standardsUsed: [], difficultyHistogram: { 1: 12 },
    items: Array.from({ length: 12 }, (_, index) => ({
      id: `${generation}-${index}`, number: index + 1, subject: 'math', subjectKorean: '수학',
      standardCode: 'fixture', gradeBand: '1-2', domain: '수와 연산', skill: 'fixture',
      difficulty: 1, format: 'short-answer', scoring: 'auto', stem: `${index} + 1 = □`,
    })),
  };
}

function Progress() {
  const { state } = useGame();
  return <output data-testid="answered">{state.worlds.math.answeredKeys.length}</output>;
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  localStorage.clear();
  vi.mocked(getSubjects).mockResolvedValue([]);
  vi.mocked(getProblemTypes).mockResolvedValue([]);
  vi.mocked(createWorksheet).mockImplementation(async (options) => sheet(options.seed, vi.mocked(createWorksheet).mock.calls.length));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

async function mount() {
  const onWorksheet = vi.fn();
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<GameProvider><ProblemStudio mode="worksheet" onWorksheet={onWorksheet} /><Progress /></GameProvider>); });
  return { ...view, onWorksheet };
}
async function click(name: string) {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name })); });
}

test('new practice is action-driven, uses current options and excludes the previous issued items', async () => {
  const { onWorksheet } = await mount();
  expect(createWorksheet).not.toHaveBeenCalled();
  await click('12문항 생성');
  const first = onWorksheet.mock.calls[0]![0] as Worksheet;
  fireEvent.change(screen.getByLabelText('문항 수'), { target: { value: '30' } });
  expect(createWorksheet).toHaveBeenCalledTimes(1);
  expect((screen.getByLabelText('seed') as HTMLInputElement).value).toBe(first.seed);
  await click('새 문제 풀기');
  const request = vi.mocked(createWorksheet).mock.lastCall![0];
  expect(request.seed).not.toBe(first.seed);
  expect(request.count).toBe(30);
  expect(request.excludeItemIds).toEqual(first.items.map((item) => item.id));
  expect((screen.getByLabelText('seed') as HTMLInputElement).value).toBe(request.seed);
});

test('exact repeat retains the issued identity/order after builder edits, clears answers and cannot duplicate progress', async () => {
  const { container, onWorksheet } = await mount();
  await click('12문항 생성');
  const issued = onWorksheet.mock.calls[0]![0] as Worksheet;
  fireEvent.change(screen.getByRole('textbox', { name: '1번 답 입력' }), { target: { value: '2' } });
  expect(screen.getByTestId('answered').textContent).toBe('1');
  fireEvent.click(screen.getByRole('radio', { name: '영어' }));
  fireEvent.change(screen.getByLabelText('seed'), { target: { value: 'changed-builder' } });
  expect((screen.getByRole('textbox', { name: '1번 답 입력' }) as HTMLInputElement).value).toBe('2');
  await click('같은 문제 다시 풀기');
  expect(createWorksheet).toHaveBeenCalledTimes(1);
  expect(onWorksheet.mock.lastCall![0]).toBe(issued);
  expect(container.querySelector('.dm-practice')?.getAttribute('data-worksheet-id')).toBe(issued.fingerprint);
  expect(Array.from(container.querySelectorAll('.dm-item__stem'), (item) => item.textContent)).toEqual(issued.items.map((item) => item.stem));
  expect((screen.getByRole('textbox', { name: '1번 답 입력' }) as HTMLInputElement).value).toBe('');
  fireEvent.change(screen.getByRole('textbox', { name: '1번 답 입력' }), { target: { value: '3' } });
  expect(screen.getByTestId('answered').textContent).toBe('1');
  expect((screen.getByLabelText('seed') as HTMLInputElement).value).toBe('changed-builder');
});

test('a failed new request retains the issued answers and never silently retries', async () => {
  await mount();
  await click('12문항 생성');
  fireEvent.change(screen.getByRole('textbox', { name: '1번 답 입력' }), { target: { value: '2' } });
  vi.mocked(createWorksheet).mockRejectedValueOnce(new Error('capacity-fixture'));
  await click('새 문제 풀기');
  expect(screen.getByRole('alert').textContent).toContain('capacity-fixture');
  expect((screen.getByRole('textbox', { name: '1번 답 입력' }) as HTMLInputElement).value).toBe('2');
  expect(createWorksheet).toHaveBeenCalledTimes(2);
});

test('settings use a closed native disclosure with twelve math questions and explicit large options', async () => {
  const { container } = await mount();
  const details = container.querySelector<HTMLDetailsElement>('.dm-studio-settings');
  expect(details).not.toBeNull();
  expect(details!.open).toBe(false);
  for (const [label, count] of [['국어', '6'], ['영어', '6'], ['수학', '12']] as const) {
    fireEvent.click(screen.getByRole('radio', { name: label }));
    expect((screen.getByLabelText('문항 수') as HTMLInputElement).value).toBe(count);
  }
  fireEvent.click(details!.querySelector('summary')!);
  expect(details!.open).toBe(true);
  for (const name of ['학년군', '영역', '문항 수', 'seed']) expect(screen.getByLabelText(name)).toBeTruthy();
  for (const count of [30, 50, 100]) expect(screen.getByRole('button', { name: new RegExp(`${count}문항`) })).toBeTruthy();
});

test('configured generation honors the edited seed, including after a fresh action', async () => {
  await mount();
  await click('12문항 생성');
  await click('새 문제 풀기');
  fireEvent.change(screen.getByLabelText('seed'), { target: { value: 'teacher-chosen-seed' } });
  fireEvent.click(document.querySelector('.dm-studio-settings > summary')!);
  await click('입력한 seed로 생성');
  expect(vi.mocked(createWorksheet).mock.lastCall![0].seed).toBe('teacher-chosen-seed');
  expect(vi.mocked(createWorksheet).mock.lastCall![0].excludeItemIds).toBeUndefined();
});

test('rapid fresh actions have unique seeds without crypto.randomUUID and exclusions stay bounded', async () => {
  vi.stubGlobal('crypto', {});
  vi.spyOn(Date, 'now').mockReturnValue(12345);
  try {
    const { onWorksheet } = await mount();
    await click('12문항 생성');
    for (let index = 0; index < 3; index++) await click('새 문제 풀기');
    const requests = vi.mocked(createWorksheet).mock.calls.map(([request]) => request);
    expect(new Set(requests.map((request) => request.seed)).size).toBe(4);
    for (let index = 1; index < 4; index++) {
      const prior = onWorksheet.mock.calls[index - 1]![0] as Worksheet;
      expect(requests[index]!.excludeItemIds).toEqual(prior.items.map((item) => item.id));
    }
  } finally { vi.unstubAllGlobals(); vi.restoreAllMocks(); }
});

test('an in-flight request exposes busy state and cannot be submitted twice', async () => {
  await mount();
  let resolve!: (value: Worksheet) => void;
  const pending = new Promise<Worksheet>((done) => { resolve = done; });
  vi.mocked(createWorksheet).mockReturnValueOnce(pending);
  fireEvent.click(screen.getByRole('button', { name: '12문항 생성' }));
  const busy = screen.getByRole('button', { name: '만드는 중…' });
  expect(busy.getAttribute('aria-busy')).toBe('true');
  expect((busy as HTMLButtonElement).disabled).toBe(true);
  fireEvent.submit(busy.closest('form')!);
  expect(createWorksheet).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(sheet('pending', 1)); await pending; });
  expect(screen.getByRole('button', { name: '12문항 생성' }).getAttribute('aria-busy')).toBe('false');
});
