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

function detail(writeEnabled: boolean, overrides: Partial<ReviewItemDetail> = {}): ReviewItemDetail {
  return {
    ...SUMMARY, file: 'data/authored/korean/k2-02-02.json', statusEntry: null, writeEnabled,
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
    expect(saveReviewItem).toHaveBeenCalledWith(SUMMARY.id, expect.objectContaining({ stem: '새 지문' }));
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
    expect(submitReviewVerdict).toHaveBeenLastCalledWith({ id: SUMMARY.id, action: 'approve', reviewer: '김검토' });

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
    expect(submitReviewVerdict).toHaveBeenCalledWith({ id: SUMMARY.id, action: 'exclude', reviewer: '김검토', reason: '정답이 둘' });
    expect(screen.getByRole('button', { name: '되돌리기' })).toBeTruthy();
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
});
