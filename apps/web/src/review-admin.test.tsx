// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  getReviewItem,
  getReviewList,
  saveReviewItem,
  submitReviewVerdict,
  type ReviewItemDetail,
  type ReviewList,
} from './api.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REVIEWER_STORAGE_KEY, ReviewAdmin } from './review-admin.tsx';

vi.mock('./api.ts', async (original) => ({
  ...await original<typeof import('./api.ts')>(),
  getReviewList: vi.fn(), getReviewItem: vi.fn(), saveReviewItem: vi.fn(), submitReviewVerdict: vi.fn(),
}));

const SUMMARY = {
  id: '111cb2ecec0d', subject: 'korean' as const, standardCode: '[2국02-02]', skill: '띄어 읽기', difficulty: 1 as const,
  instruction: '띄어 읽을 자리를 고르시오.', stem: '하얀 토끼가 빨간 당근을 먹습니다.', answer: "'토끼가' 다음",
  status: 'pending' as const, priority: 1,
  reasons: [{ source: '4차 리뷰 MEDIUM', text: '정답이 둘' }],
  notes: [{ verdict: 'problem', kind: 'multi-answer', note: '당근을 다음도 맞다', source: 'odal-review-1.jsonl' }],
};

function list(writeEnabled: boolean): ReviewList {
  return {
    writeEnabled, total: 2, matched: 2, offset: 0, limit: 50,
    counts: { pending: 2, reviewed: 0, excluded: 0 },
    facets: { subjects: ['korean'], standards: [{ code: '[2국02-02]', subject: 'korean', skill: '띄어 읽기', count: 2 }], verdicts: ['problem'] },
    items: [SUMMARY, { ...SUMMARY, id: '20ccc7f8fa19', priority: null, reasons: [], notes: [], stem: '씩씩한 동생이 가방을 멨습니다.' }],
  };
}

const REV_A = 'aaaaaaaaaaaaaaaa';
const REV_B = 'bbbbbbbbbbbbbbbb';

function detail(writeEnabled: boolean, overrides: Partial<ReviewItemDetail> = {}): ReviewItemDetail {
  return {
    ...SUMMARY, file: 'data/authored/korean/k2-02-02.json', statusEntry: null, writeEnabled, revision: REV_A,
    item: {
      id: SUMMARY.id, difficulty: 1, instruction: SUMMARY.instruction, stem: SUMMARY.stem, answer: SUMMARY.answer,
      distractors: ["'하얀' 다음", "'당근을' 다음", "'빨간' 다음"], solution: ['주어 뒤에서 쉰다.'],
    },
    ...overrides,
  };
}

async function mount(writeEnabled = true) {
  vi.mocked(getReviewList).mockResolvedValue(list(writeEnabled));
  vi.mocked(getReviewItem).mockResolvedValue(detail(writeEnabled));
  await act(async () => { render(<ReviewAdmin />); });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /하얀 토끼가/ })); });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

const B_ID = '20ccc7f8fa19';
const B_STEM = '씩씩한 동생이 가방을 멨습니다.';
const detailB = (overrides: Partial<ReviewItemDetail> = {}) => detail(true, {
  id: B_ID, priority: null, reasons: [], notes: [], stem: B_STEM,
  item: { ...detail(true).item, id: B_ID, stem: B_STEM },
  ...overrides,
});
const stemBox = () => screen.getByRole('textbox', { name: '지문' }) as HTMLTextAreaElement;
const row = (name: RegExp) => within(screen.getByRole('list', { name: '검토할 문항' })).getByRole('button', { name });
const leavePrompt = () => screen.queryByRole('alertdialog', { name: '저장하지 않은 수정' });

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('review admin', () => {
  it('lists priority items with reasons and odal verdicts, and filters through the API', async () => {
    await mount();
    const rows = within(screen.getByRole('list', { name: '검토할 문항' })).getAllByRole('button');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('우선 1');
    expect(rows[0]?.textContent).toContain('오달 문제 있음');
    expect(screen.getByText(/4차 리뷰 MEDIUM: 정답이 둘/)).toBeTruthy();
    expect(screen.getByText(/문제 있음 \(multi-answer\): 당근을 다음도 맞다/)).toBeTruthy();

    await act(async () => { fireEvent.change(screen.getByRole('combobox', { name: '오달 판정' }), { target: { value: 'problem' } }); });
    expect(vi.mocked(getReviewList)).toHaveBeenLastCalledWith(expect.objectContaining({ verdict: 'problem' }));
  });

  it('shows gate failure reasons verbatim and keeps the edit when saving is rejected', async () => {
    await mount();
    vi.mocked(saveReviewItem).mockRejectedValue(new ApiError('작성 게이트를 통과하지 못해 저장하지 않았다', 422, {
      reasons: [{ gate: 'answer-leak', detail: '지문에 정답만 있고 오답은 없다' }],
    }));
    fireEvent.change(screen.getByRole('textbox', { name: '지문' }), { target: { value: '새 지문' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '저장' })); });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('answer-leak');
    expect(alert.textContent).toContain('지문에 정답만 있고 오답은 없다');
    expect((screen.getByRole('textbox', { name: '지문' }) as HTMLTextAreaElement).value).toBe('새 지문');
    expect(saveReviewItem).toHaveBeenCalledWith(SUMMARY.id, REV_A, expect.objectContaining({ stem: '새 지문' }));
  });

  it('remembers the reviewer name locally and sends it with approve and fix-then-approve', async () => {
    await mount();
    const approve = screen.getByRole('button', { name: '승인' }) as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
    fireEvent.change(screen.getByRole('textbox', { name: '검토자 이름' }), { target: { value: '김검토' } });
    expect(localStorage.getItem(REVIEWER_STORAGE_KEY)).toBe('김검토');
    expect(approve.disabled).toBe(false);

    vi.mocked(submitReviewVerdict).mockResolvedValue(detail(true, { status: 'reviewed' }));
    await act(async () => { fireEvent.click(approve); });
    expect(submitReviewVerdict).toHaveBeenLastCalledWith({ id: SUMMARY.id, revision: REV_A, action: 'approve', reviewer: '김검토' });

    fireEvent.change(screen.getByRole('textbox', { name: '풀이 (한 줄에 한 단계)' }), { target: { value: '첫 줄\n\n둘째 줄' } });
    expect((screen.getByRole('button', { name: '승인' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '고친 뒤 승인' })); });
    expect(submitReviewVerdict).toHaveBeenLastCalledWith(expect.objectContaining({
      action: 'approve', reviewer: '김검토', item: expect.objectContaining({ solution: ['첫 줄', '둘째 줄'] }),
    }));
  });

  it('excludes with an optional reason', async () => {
    localStorage.setItem(REVIEWER_STORAGE_KEY, '김검토');
    await mount();
    vi.mocked(submitReviewVerdict).mockResolvedValue(detail(true, { status: 'excluded' }));
    fireEvent.change(screen.getByRole('textbox', { name: '뺄 이유 (선택)' }), { target: { value: '정답이 둘' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '빼기' })); });
    expect(submitReviewVerdict).toHaveBeenCalledWith({ id: SUMMARY.id, revision: REV_A, action: 'exclude', reviewer: '김검토', reason: '정답이 둘' });
    expect(screen.getByRole('button', { name: '되돌리기' })).toBeTruthy();
  });

  it('pages past the 500-item server cap with offset and starts over when a filter changes', async () => {
    const MATCHED = 1200;
    const SERVER_MAX = 500;
    const rowsFor = (prefix: string) => Array.from({ length: MATCHED }, (_, n) => ({
      ...SUMMARY, id: `${prefix}${String(n).padStart(6, '0')}`, priority: null, reasons: [], notes: [], stem: `${prefix} 지문 ${n}`,
    }));
    const all = { '': rowsFor('aaaaaa'), problem: rowsFor('bbbbbb') };
    vi.mocked(getReviewList).mockImplementation(async (filters) => {
      const offset = filters.offset ?? 0;
      const limit = Math.min(SERVER_MAX, filters.limit ?? 100);
      const pool = all[(filters.verdict ?? '') as keyof typeof all];
      return { ...list(true), total: MATCHED, matched: MATCHED, offset, limit, items: pool.slice(offset, offset + limit) };
    });
    await act(async () => { render(<ReviewAdmin />); });
    const rows = () => [...screen.getByRole('list', { name: '검토할 문항' }).querySelectorAll('li')];
    expect(rows()).toHaveLength(50);

    for (let page = 2; page <= 12; page += 1) {
      await act(async () => { fireEvent.click(screen.getByText('더 보기')); });
      expect(rows()).toHaveLength(page * 50);
    }
    expect(vi.mocked(getReviewList)).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 550, limit: 50 }));
    expect(rows().map((row) => row.textContent?.match(/aaaaaa 지문 (\d+)/)?.[1])).toEqual(
      Array.from({ length: 600 }, (_, n) => String(n)),
    );

    await act(async () => { fireEvent.change(screen.getByRole('combobox', { name: '오달 판정' }), { target: { value: 'problem' } }); });
    expect(vi.mocked(getReviewList)).toHaveBeenLastCalledWith(expect.objectContaining({ verdict: 'problem', offset: 0, limit: 50 }));
    expect(rows()).toHaveLength(50);
    expect(rows()[0]?.textContent).toContain('bbbbbb 지문 0');
  });

  it('keeps the last opened item when an earlier detail response arrives late', async () => {
    vi.mocked(getReviewList).mockResolvedValue(list(true));
    const a = deferred<ReviewItemDetail>();
    const b = deferred<ReviewItemDetail>();
    vi.mocked(getReviewItem).mockImplementation((id) => (id === B_ID ? b.promise : a.promise));
    await act(async () => { render(<ReviewAdmin />); });
    await act(async () => { fireEvent.click(row(/하얀 토끼가/)); });
    await act(async () => { fireEvent.click(row(/씩씩한 동생이/)); });
    await act(async () => { b.resolve(detailB()); });
    fireEvent.change(stemBox(), { target: { value: 'B 고친 지문' } });
    await act(async () => { a.resolve(detail(true)); });
    expect(screen.getByRole('form', { name: '문항 편집' }).textContent).toContain(B_ID);
    expect(stemBox().value).toBe('B 고친 지문');
  });

  describe('drops a stale response whichever order the requests settle in', () => {
    type Op = 'save' | 'approve' | 'fix-approve' | 'exclude' | 'reset';
    const ops: Op[] = ['save', 'approve', 'fix-approve', 'exclude', 'reset'];
    const orders = ['older-first', 'newer-first'] as const;
    it.each(ops.flatMap((op) => orders.map((order) => [op, order] as const)))('%s then open another item, %s', async (op, order) => {
      localStorage.setItem(REVIEWER_STORAGE_KEY, '김검토');
      vi.mocked(getReviewList).mockResolvedValue(list(true));
      const opened = detail(true, op === 'reset' ? { status: 'reviewed' } : {});
      const older = deferred<ReviewItemDetail>();
      const newer = deferred<ReviewItemDetail>();
      vi.mocked(getReviewItem).mockImplementation((id) => (id === B_ID ? newer.promise : Promise.resolve(opened)));
      vi.mocked(saveReviewItem).mockReturnValue(older.promise);
      vi.mocked(submitReviewVerdict).mockReturnValue(older.promise);
      await act(async () => { render(<ReviewAdmin />); });
      await act(async () => { fireEvent.click(row(/하얀 토끼가/)); });

      if (op === 'save' || op === 'fix-approve') fireEvent.change(stemBox(), { target: { value: 'A 고친 지문' } });
      const button = { save: '저장', approve: '승인', 'fix-approve': '고친 뒤 승인', exclude: '빼기', reset: '되돌리기' }[op];
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: button })); });
      await act(async () => { fireEvent.click(row(/씩씩한 동생이/)); });
      const prompt = leavePrompt();
      if (prompt) await act(async () => { fireEvent.click(within(prompt).getByRole('button', { name: '수정 버리기' })); });

      const settle = [
        async () => { older.resolve({ ...opened, status: op === 'exclude' ? 'excluded' : op === 'reset' ? 'pending' : 'reviewed' }); },
        async () => { newer.resolve(detailB()); },
      ];
      for (const step of order === 'older-first' ? settle : [...settle].reverse()) await act(step);

      expect(screen.getByRole('form', { name: '문항 편집' }).textContent).toContain(B_ID);
      expect(stemBox().value).toBe(B_STEM);
      expect(screen.queryByRole('status')).toBeNull();
      expect((screen.getByRole('button', { name: '빼기' }) as HTMLButtonElement).disabled).toBe(false);
    });

    it.each(orders)('list refresh after a filter change, %s', async (order) => {
      const first = deferred<ReviewList>();
      const second = deferred<ReviewList>();
      vi.mocked(getReviewList).mockImplementation((filters) => (filters.verdict === 'none' ? second.promise : first.promise));
      await act(async () => { render(<ReviewAdmin />); });
      await act(async () => { fireEvent.change(screen.getByRole('combobox', { name: '오달 판정' }), { target: { value: 'none' } }); });
      expect(getReviewList).toHaveBeenLastCalledWith(expect.objectContaining({ verdict: 'none' }));
      const settle = [
        async () => { first.resolve(list(true)); },
        async () => { second.resolve({ ...list(true), matched: 1, items: [list(true).items[1]!] }); },
      ];
      for (const step of order === 'older-first' ? settle : [...settle].reverse()) await act(step);
      expect(screen.getByRole('list', { name: '검토할 문항' }).querySelectorAll('li')).toHaveLength(1);
      expect(screen.getByText('1문항')).toBeTruthy();
    });
  });

  describe('pagination never mixes two filters', () => {
    const MATCHED = 120;
    const rowsFor = (prefix: string) => Array.from({ length: MATCHED }, (_, n) => ({
      ...SUMMARY, id: `${prefix}${String(n).padStart(6, '0')}`, priority: null, reasons: [], notes: [], stem: `${prefix} 지문 ${n}`,
    }));
    const pools = { '': rowsFor('aaaaaa'), problem: rowsFor('bbbbbb') };
    const page = (filters: { verdict?: string; offset?: number; limit?: number }): ReviewList => {
      const offset = filters.offset ?? 0;
      const limit = filters.limit ?? 50;
      const pool = pools[(filters.verdict ?? '') as keyof typeof pools];
      return { ...list(true), total: MATCHED, matched: MATCHED, offset, limit, items: pool.slice(offset, offset + limit) };
    };
    const rowTexts = () => [...screen.getByRole('list', { name: '검토할 문항' }).querySelectorAll('li')].map((li) => li.textContent ?? '');
    const changeVerdict = (value: string) => fireEvent.change(screen.getByRole('combobox', { name: '오달 판정' }), { target: { value } });

    it('blocks 더 보기 while the new filter is still loading', async () => {
      const pending = deferred<ReviewList>();
      vi.mocked(getReviewList).mockImplementation(async (filters) => (
        filters.verdict === 'problem' && (filters.offset ?? 0) === 0 ? pending.promise : page(filters)
      ));
      await act(async () => { render(<ReviewAdmin />); });
      await act(async () => { changeVerdict('problem'); });
      const more = screen.queryByRole('button', { name: '더 보기' }) as HTMLButtonElement | null;
      if (more) await act(async () => { fireEvent.click(more); });
      expect(vi.mocked(getReviewList)).not.toHaveBeenCalledWith(expect.objectContaining({ verdict: 'problem', offset: 50 }));

      await act(async () => { pending.resolve(page({ verdict: 'problem', offset: 0, limit: 50 })); });
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: '더 보기' })); });
      expect(rowTexts()).toHaveLength(100);
      expect(rowTexts().every((text) => text.includes('bbbbbb'))).toBe(true);
    });

    it('drops a 더 보기 page that lands after the filter changed', async () => {
      const more = deferred<ReviewList>();
      vi.mocked(getReviewList).mockImplementation(async (filters) => (
        !filters.verdict && (filters.offset ?? 0) === 50 ? more.promise : page(filters)
      ));
      await act(async () => { render(<ReviewAdmin />); });
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: '더 보기' })); });
      await act(async () => { changeVerdict('problem'); });
      await act(async () => { more.resolve(page({ offset: 50, limit: 50 })); });
      expect(rowTexts()).toHaveLength(50);
      expect(rowTexts().every((text) => text.includes('bbbbbb'))).toBe(true);
    });
  });

  describe('unsaved corrections are never dropped silently', () => {
    const editA = () => fireEvent.change(stemBox(), { target: { value: 'A 고친 지문' } });

    it('asks before opening another item, and keeps the draft when told to keep editing', async () => {
      await mount();
      vi.mocked(getReviewItem).mockResolvedValue(detailB());
      editA();
      await act(async () => { fireEvent.click(row(/씩씩한 동생이/)); });
      expect(getReviewItem).toHaveBeenCalledTimes(1);
      await act(async () => { fireEvent.click(within(leavePrompt()!).getByRole('button', { name: '계속 고치기' })); });
      expect(leavePrompt()).toBeNull();
      expect(stemBox().value).toBe('A 고친 지문');

      await act(async () => { fireEvent.click(row(/씩씩한 동생이/)); });
      await act(async () => { fireEvent.click(within(leavePrompt()!).getByRole('button', { name: '수정 버리기' })); });
      expect(getReviewItem).toHaveBeenLastCalledWith(B_ID);
      expect(stemBox().value).toBe(B_STEM);
    });

    it('can save first and then open the other item', async () => {
      await mount();
      vi.mocked(getReviewItem).mockResolvedValue(detailB());
      vi.mocked(saveReviewItem).mockImplementation(async (_id, _revision, item) => detail(true, { item: { ...detail(true).item, ...item } }));
      editA();
      await act(async () => { fireEvent.click(row(/씩씩한 동생이/)); });
      await act(async () => { fireEvent.click(within(leavePrompt()!).getByRole('button', { name: '저장하고 이동' })); });
      expect(saveReviewItem).toHaveBeenCalledWith(SUMMARY.id, REV_A, expect.objectContaining({ stem: 'A 고친 지문' }));
      expect(stemBox().value).toBe(B_STEM);
    });

    it('stays on the item when saving before leaving is rejected', async () => {
      await mount();
      vi.mocked(saveReviewItem).mockRejectedValue(new ApiError('작성 게이트를 통과하지 못해 저장하지 않았다', 422, {
        reasons: [{ gate: 'answer-leak', detail: '정답 노출' }],
      }));
      editA();
      await act(async () => { fireEvent.click(row(/씩씩한 동생이/)); });
      await act(async () => { fireEvent.click(within(leavePrompt()!).getByRole('button', { name: '저장하고 이동' })); });
      expect(getReviewItem).toHaveBeenCalledTimes(1);
      expect(stemBox().value).toBe('A 고친 지문');
      expect(screen.getByRole('alert').textContent).toContain('answer-leak');
    });

    it('asks before going back to the list', async () => {
      await mount();
      editA();
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: '목록으로' })); });
      expect(stemBox().value).toBe('A 고친 지문');
      await act(async () => { fireEvent.click(within(leavePrompt()!).getByRole('button', { name: '수정 버리기' })); });
      expect(screen.queryByRole('form', { name: '문항 편집' })).toBeNull();
    });

    it.each([
      ['빼기', 'excluded', '제외'],
      ['되돌리기', 'pending', '검토 전'],
    ] as const)('keeps the draft through %s', async (button, status, label) => {
      localStorage.setItem(REVIEWER_STORAGE_KEY, '김검토');
      vi.mocked(getReviewList).mockResolvedValue(list(true));
      vi.mocked(getReviewItem).mockResolvedValue(detail(true, { status: 'reviewed' }));
      await act(async () => { render(<ReviewAdmin />); });
      await act(async () => { fireEvent.click(row(/하얀 토끼가/)); });
      vi.mocked(submitReviewVerdict).mockResolvedValue(detail(true, { status }));
      editA();
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: button })); });
      expect(stemBox().value).toBe('A 고친 지문');
      expect(within(screen.getByRole('form', { name: '문항 편집' })).getByText(label, { selector: '.dm-badge' })).toBeTruthy();
      expect((screen.getByRole('button', { name: '저장' }) as HTMLButtonElement).disabled).toBe(false);
    });

    it('asks the browser to confirm leaving the page while there is a draft', async () => {
      await mount();
      const clean = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(clean);
      expect(clean.defaultPrevented).toBe(false);
      editA();
      const dirty = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(dirty);
      expect(dirty.defaultPrevented).toBe(true);
    });
  });

  describe('below 900px', () => {
    // jsdom 은 @media 를 평가하지 않으니, 좁은 화면 규칙 블록만 꺼내 그대로 건다.
    const reviewCss = readFileSync(join(import.meta.dirname, 'review-admin.css'), 'utf8');
    const narrowRules = (() => {
      const start = reviewCss.indexOf('@media (max-width: 900px)');
      const open = reviewCss.indexOf('{', start);
      let depth = 0;
      for (let i = open; i < reviewCss.length; i += 1) {
        if (reviewCss[i] === '{') depth += 1;
        if (reviewCss[i] === '}') depth -= 1;
        if (depth === 0) return reviewCss.slice(open + 1, i);
      }
      throw new Error('900px 규칙 블록을 찾지 못했다');
    })();
    let style: HTMLStyleElement;
    beforeEach(() => {
      style = document.createElement('style');
      style.textContent = narrowRules;
      document.head.append(style);
    });
    afterEach(() => { style.remove(); });
    const visible = (element: Element) => {
      for (let node: Element | null = element; node; node = node.parentElement) {
        if (getComputedStyle(node).display === 'none') return false;
      }
      return true;
    };

    it('hides the detail pane until an item is open (rules applied)', async () => {
      vi.mocked(getReviewList).mockResolvedValue(list(true));
      await act(async () => { render(<ReviewAdmin />); });
      expect(visible(screen.getByRole('list', { name: '검토할 문항' }))).toBe(true);
      expect(visible(screen.getByText('왼쪽 목록에서 문항을 고르세요.'))).toBe(false);
    });

    it('shows a failed list request', async () => {
      vi.mocked(getReviewList).mockRejectedValue(new ApiError('교사 토큰이 없거나 틀렸습니다.', 403, undefined));
      await act(async () => { render(<ReviewAdmin />); });
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain('교사 토큰이 없거나 틀렸습니다.');
      expect(visible(alert)).toBe(true);
    });

    it('shows a failed first detail request', async () => {
      vi.mocked(getReviewList).mockResolvedValue(list(true));
      vi.mocked(getReviewItem).mockRejectedValue(new ApiError('문항을 찾지 못했습니다.', 404, undefined));
      await act(async () => { render(<ReviewAdmin />); });
      await act(async () => { fireEvent.click(row(/하얀 토끼가/)); });
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain('문항을 찾지 못했습니다.');
      expect(visible(alert)).toBe(true);
    });
  });

  it('disables every write control when the server has writing turned off', async () => {
    localStorage.setItem(REVIEWER_STORAGE_KEY, '김검토');
    await mount(false);
    expect(screen.getByRole('status').textContent).toContain('DIGIMON_ADMIN_WRITE=1');
    for (const name of ['저장', '승인', '고친 뒤 승인', '빼기']) {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect(screen.getByRole('textbox', { name: '지문' }).matches(':disabled')).toBe(true);
  });
  it('warns that saving an edit to an approved item drops the approval, and shows the item back as pending', async () => {
    const approved = detail(true, { status: 'reviewed', statusEntry: { reviewer: '김검토', reviewedAt: '2026-11-12' } });
    vi.mocked(getReviewList).mockResolvedValue(list(true));
    vi.mocked(getReviewItem).mockResolvedValue(approved);
    await act(async () => { render(<ReviewAdmin />); });
    await act(async () => { fireEvent.click(row(/하얀 토끼가/)); });
    const warning = () => screen.queryByText(/그냥 저장하면 승인이 풀려 검토 전으로 돌아가고/);
    expect(warning()).toBeNull();

    fireEvent.change(stemBox(), { target: { value: '하얀 토끼가 빨간 당근을 먹었습니다.' } });
    expect(warning()).toBeTruthy();

    vi.mocked(saveReviewItem).mockResolvedValue(detail(true, {
      saved: true, unapproved: true, item: { ...approved.item, stem: '하얀 토끼가 빨간 당근을 먹었습니다.' },
    }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '저장' })); });
    expect(screen.getByText(/승인이 풀렸고 검토 전으로 돌아갔습니다/)).toBeTruthy();
    const head = screen.getByRole('form', { name: '문항 편집' }).querySelector('h3');
    expect(head?.textContent).toContain('검토 전');
    expect(warning()).toBeNull();
  });
  describe('a write rejected because the item changed elsewhere (409)', () => {
    const theirs = '하얀 토끼가 빨간 당근을 맛있게 먹습니다.';
    const latest = () => detail(true, { revision: REV_B, item: { ...detail(true).item, stem: theirs } });
    const conflict = () => new ApiError('다른 곳에서 이 문항이 바뀌었다', 409, { current: latest() });
    const conflictNote = () => screen.queryByRole('alert', { name: '다른 곳에서 바뀜' });

    it('reloads the latest content instead of approving it unseen, then approves with the new revision', async () => {
      localStorage.setItem(REVIEWER_STORAGE_KEY, '김검토');
      await mount();
      vi.mocked(submitReviewVerdict).mockRejectedValueOnce(conflict());
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: '승인' })); });
      expect(submitReviewVerdict).toHaveBeenCalledTimes(1);
      expect(conflictNote()?.textContent).toContain('최신 내용을 다시 불러왔습니다');
      expect(stemBox().value).toBe(theirs);
      expect(screen.getByRole('form', { name: '문항 편집' }).querySelector('h3')?.textContent).toContain('검토 전');

      vi.mocked(submitReviewVerdict).mockResolvedValue(latest());
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: '승인' })); });
      expect(submitReviewVerdict).toHaveBeenLastCalledWith({ id: SUMMARY.id, revision: REV_B, action: 'approve', reviewer: '김검토' });
      expect(conflictNote()).toBeNull();
    });

    it.each([
      ['저장', 'save'],
      ['고친 뒤 승인', 'fix-approve'],
    ] as const)('keeps the draft after %s is rejected, shows what differs, and can re-apply or drop it', async (button, op) => {
      localStorage.setItem(REVIEWER_STORAGE_KEY, '김검토');
      await mount();
      if (op === 'save') vi.mocked(saveReviewItem).mockRejectedValueOnce(conflict());
      else vi.mocked(submitReviewVerdict).mockRejectedValueOnce(conflict());
      fireEvent.change(stemBox(), { target: { value: '내가 고친 지문' } });
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: button })); });

      expect(stemBox().value).toBe('내가 고친 지문');
      const note = conflictNote()!;
      expect(note.textContent).toContain('고치던 초안은 그대로 두었습니다');
      expect(note.textContent).toContain(`최신: ${theirs}`);
      expect(note.textContent).toContain('내 초안: 내가 고친 지문');

      // 다시 적용: 같은 버튼을 다시 누르면 최신 버전(revision)으로 초안을 보낸다.
      vi.mocked(saveReviewItem).mockResolvedValue(latest());
      vi.mocked(submitReviewVerdict).mockResolvedValue(latest());
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: button })); });
      if (op === 'save') {
        expect(saveReviewItem).toHaveBeenLastCalledWith(SUMMARY.id, REV_B, expect.objectContaining({ stem: '내가 고친 지문' }));
      } else {
        expect(submitReviewVerdict).toHaveBeenLastCalledWith(expect.objectContaining({
          revision: REV_B, action: 'approve', item: expect.objectContaining({ stem: '내가 고친 지문' }),
        }));
      }
    });

    it('drops the draft for the latest content when asked', async () => {
      await mount();
      vi.mocked(saveReviewItem).mockRejectedValueOnce(conflict());
      fireEvent.change(stemBox(), { target: { value: '내가 고친 지문' } });
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: '저장' })); });
      await act(async () => { fireEvent.click(within(conflictNote()!).getByRole('button', { name: '내 초안 버리고 최신 내용 쓰기' })); });
      expect(stemBox().value).toBe(theirs);
      expect(conflictNote()).toBeNull();
      expect((screen.getByRole('button', { name: '저장' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('says when an approval was dropped because the file changed after it', async () => {
      vi.mocked(getReviewList).mockResolvedValue(list(true));
      vi.mocked(getReviewItem).mockResolvedValue(detail(true, { staleApproval: true }));
      await act(async () => { render(<ReviewAdmin />); });
      await act(async () => { fireEvent.click(row(/하얀 토끼가/)); });
      expect(screen.getByText(/승인한 뒤 문항 파일이 바뀌어 그 승인은 풀렸습니다/)).toBeTruthy();
    });
  });
});
