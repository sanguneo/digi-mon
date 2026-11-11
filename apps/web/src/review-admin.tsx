import { type FormEvent, useEffect, useRef, useState } from 'react';
import {
  type AuthoredItemFields,
  type GateReason,
  type ReviewAction,
  type ReviewItemDetail,
  type ReviewList,
  type ReviewStatus,
  gateReasonsOf,
  getReviewItem,
  getReviewList,
  saveReviewItem,
  setTeacherToken,
  submitReviewVerdict,
} from './api.ts';
import { useLatestRequests } from './latest-request.ts';
import './review-admin.css';

export const REVIEWER_STORAGE_KEY = 'digimon.reviewer';
const PAGE_SIZE = 50;
/** 서버가 한 번에 주는 최대 문항 수(src/server/review-admin.mjs MAX_LIMIT). */
const SERVER_PAGE_MAX = 500;

const STATUS_LABEL: Record<ReviewStatus, string> = { pending: '검토 전', reviewed: '검토 완료', excluded: '제외' };
const SUBJECT_LABEL: Record<string, string> = { korean: '국어', english: '영어' };
const VERDICT_LABEL: Record<string, string> = { problem: '문제 있음', ok: '문제 없음' };
const verdictLabel = (verdict: string) => VERDICT_LABEL[verdict] ?? verdict;

interface Filters {
  subject: string;
  standard: string;
  status: string;
  verdict: string;
}

interface ItemForm {
  instruction: string;
  stem: string;
  answer: string;
  distractors: string[];
  solution: string;
}

const toForm = (item: AuthoredItemFields): ItemForm => ({
  instruction: item.instruction,
  stem: item.stem,
  answer: item.answer,
  distractors: [...item.distractors],
  solution: item.solution.join('\n'),
});

const fromForm = (form: ItemForm): AuthoredItemFields => ({
  instruction: form.instruction,
  stem: form.stem,
  answer: form.answer,
  distractors: form.distractors,
  solution: form.solution.split('\n').map((line) => line.trim()).filter((line) => line.length > 0),
});

const sameForm = (a: ItemForm, b: ItemForm) => JSON.stringify(a) === JSON.stringify(b);
const messageOf = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

/** 화면에 떠 있는 목록과 그 목록을 받은 필터. '더 보기'는 이 필터로만 잇는다. */
interface ShownList {
  filters: Filters;
  list: ReviewList;
}

/** 초안을 버릴 수 있는 이동. 저장 안 한 수정이 있으면 먼저 물어본다. */
type Leave = { kind: 'open'; id: string } | { kind: 'back' };

/** offset 부터 count 문항을 서버 한도(500)씩 나눠 받아 잇는다. */
async function fetchRange(filters: Filters, offset: number, count: number): Promise<ReviewList> {
  let result = await getReviewList({ ...filters, offset, limit: Math.min(count, SERVER_PAGE_MAX) });
  let items = result.items;
  while (items.length < count && offset + items.length < result.matched) {
    const next = await getReviewList({
      ...filters, offset: offset + items.length, limit: Math.min(count - items.length, SERVER_PAGE_MAX),
    });
    if (next.items.length === 0) break;
    items = [...items, ...next.items];
    result = next;
  }
  return { ...result, offset, items };
}

function readReviewer(): string {
  try {
    return localStorage.getItem(REVIEWER_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function ReviewAdmin() {
  const [filters, setFilters] = useState<Filters>({ subject: '', standard: '', status: '', verdict: '' });
  const [shown, setShown] = useState<ShownList | null>(null);
  const list = shown?.list ?? null;
  // 지금까지 보여 준 문항 수. 저장 뒤 목록을 다시 받을 때 이만큼 다시 채운다.
  const shownRef = useRef(PAGE_SIZE);
  // 이 화면의 모든 비동기 요청은 여기서 세대를 받는다. list: 목록·더 보기, item: 상세·저장·판정·되돌리기.
  const requests = useLatestRequests<'list' | 'item'>();
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listVersion, setListVersion] = useState(0);
  const [listError, setListError] = useState('');
  const [selected, setSelected] = useState<ReviewItemDetail | null>(null);
  const [form, setForm] = useState<ItemForm | null>(null);
  const [reviewer, setReviewer] = useState(readReviewer);
  const [teacherToken, setTeacherTokenInput] = useState('');
  const [excludeReason, setExcludeReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [openError, setOpenError] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [gateReasons, setGateReasons] = useState<GateReason[]>([]);
  const [pendingLeave, setPendingLeave] = useState<Leave | null>(null);

  useEffect(() => {
    const isLatest = requests.begin('list');
    setListLoading(true);
    fetchRange(filters, 0, shownRef.current).then((result) => {
      if (!isLatest()) return;
      setShown({ filters, list: result });
      setListError('');
    }).catch((cause: unknown) => {
      if (isLatest()) setListError(messageOf(cause));
    }).finally(() => {
      if (isLatest()) setListLoading(false);
    });
  }, [filters, listVersion, requests]);

  // 화면 목록이 지금 필터로 받은 것이고 새로 받는 중이 아닐 때만 잇는다.
  const canLoadMore = Boolean(shown && shown.filters === filters && !listLoading && !loadingMore);

  const loadMore = async () => {
    if (!shown || !canLoadMore) return;
    const base = shown;
    const isLatest = requests.join('list');
    setLoadingMore(true);
    try {
      const next = await fetchRange(base.filters, base.list.items.length, PAGE_SIZE);
      if (!isLatest()) return;
      const items = [...base.list.items, ...next.items];
      shownRef.current = items.length;
      setShown({ filters: base.filters, list: { ...next, offset: 0, items } });
    } catch (cause) {
      if (isLatest()) setListError(messageOf(cause));
    } finally {
      setLoadingMore(false);
    }
  };

  const changeFilter = (key: keyof Filters, value: string) => {
    shownRef.current = PAGE_SIZE;
    setFilters((current) => ({ ...current, [key]: value, ...(key === 'subject' ? { standard: '' } : {}) }));
  };

  const changeReviewer = (value: string) => {
    setReviewer(value);
    try {
      localStorage.setItem(REVIEWER_STORAGE_KEY, value);
    } catch {
      // 저장소를 못 쓰는 브라우저면 이번 화면에서만 기억한다.
    }
  };

  const changeTeacherToken = (value: string) => {
    setTeacherTokenInput(value);
    setTeacherToken(value);
  };

  const clearNotices = () => {
    setOpenError('');
    setError('');
    setMessage('');
    setGateReasons([]);
  };

  const open = async (id: string) => {
    const isLatest = requests.begin('item');
    clearNotices();
    setBusy(true);
    try {
      const detail = await getReviewItem(id);
      if (!isLatest()) return;
      setSelected(detail);
      setForm(toForm(detail.item));
      setExcludeReason('');
    } catch (cause) {
      if (isLatest()) setOpenError(messageOf(cause));
    } finally {
      if (isLatest()) setBusy(false);
    }
  };

  /**
   * 저장·판정·되돌리기. 응답이 왔을 때 그사이 다른 문항을 열었거나 목록으로 나갔으면 화면에는 반영하지 않는다.
   * keepDraft: 문항 내용을 바꾸지 않는 요청(빼기·되돌리기)이면 고치던 초안을 그대로 둔다.
   * 성공해 화면에 반영했을 때만 true.
   */
  const run = async (task: () => Promise<ReviewItemDetail>, done: string, keepDraft = false): Promise<boolean> => {
    const isLatest = requests.begin('item');
    setBusy(true);
    clearNotices();
    try {
      const detail = await task();
      setListVersion((v) => v + 1);
      if (!isLatest()) return false;
      setSelected(detail);
      if (!keepDraft) setForm(toForm(detail.item));
      setMessage(done);
      return true;
    } catch (cause) {
      if (!isLatest()) return false;
      const reasons = gateReasonsOf(cause);
      if (reasons) setGateReasons(reasons);
      setError(messageOf(cause));
      return false;
    } finally {
      if (isLatest()) setBusy(false);
    }
  };

  const writeEnabled = list?.writeEnabled ?? selected?.writeEnabled ?? false;
  const dirty = Boolean(selected && form && !sameForm(form, toForm(selected.item)));
  const hasReviewer = reviewer.trim().length > 0;
  const canWrite = writeEnabled && !busy;

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const go = (target: Leave) => {
    setPendingLeave(null);
    if (target.kind === 'open') {
      void open(target.id);
      return;
    }
    requests.begin('item');
    setBusy(false);
    clearNotices();
    setSelected(null);
    setForm(null);
  };

  const leave = (target: Leave) => {
    if (dirty) setPendingLeave(target);
    else go(target);
  };

  const saveDraft = () => {
    if (!selected || !form) return Promise.resolve(false);
    return run(() => saveReviewItem(selected.id, fromForm(form)), '작성 게이트를 통과해 저장했습니다.');
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void saveDraft();
  };

  const saveThenGo = async (target: Leave) => {
    setPendingLeave(null);
    if (await saveDraft()) go(target);
  };

  const verdict = (action: ReviewAction) => {
    if (!selected || !form) return;
    const labels: Record<ReviewAction, string> = {
      approve: dirty ? '고친 뒤 승인했습니다.' : '승인했습니다.', exclude: '학습지에서 뺐습니다.', reset: '검토 전으로 되돌렸습니다.',
    };
    void run(() => submitReviewVerdict({
      id: selected.id,
      action,
      ...(action === 'reset' ? {} : { reviewer: reviewer.trim() }),
      ...(action === 'approve' && dirty ? { item: fromForm(form) } : {}),
      ...(action === 'exclude' && excludeReason.trim() ? { reason: excludeReason.trim() } : {}),
    }), labels[action], action !== 'approve');
  };

  const standards = list?.facets.standards.filter((s) => !filters.subject || s.subject === filters.subject) ?? [];

  return (
    <section className="dm-review" data-detail-open={selected ? 'true' : undefined} aria-label="문항 검토">
      <div className="dm-review__intro">
        <p className="dm-kicker">AI 작성 문항 검토</p>
        <h2>검토한 문항만 학습지에 나갑니다</h2>
        {list ? (
          <p className="dm-review__counts">
            전체 {list.total.toLocaleString()}문항 · 검토 전 {list.counts.pending.toLocaleString()} ·
            검토 완료 {list.counts.reviewed.toLocaleString()} · 제외 {list.counts.excluded.toLocaleString()}
          </p>
        ) : null}
        {list && !list.writeEnabled ? (
          <p className="dm-note dm-note--warn" role="status">
            이 서버는 쓰기가 꺼져 있어 조회만 됩니다. 로컬에서 DIGIMON_ADMIN_WRITE=1 로 엔진을 켜면 수정·판정할 수 있습니다.
          </p>
        ) : null}
        <label className="dm-field dm-review__reviewer">
          <span>검토자 이름</span>
          <input
            autoComplete="name"
            onChange={(event) => changeReviewer(event.target.value)}
            placeholder="승인·빼기에 함께 기록됩니다"
            type="text"
            value={reviewer}
          />
        </label>
        <label className="dm-field dm-review__reviewer">
          <span>교사 토큰 (다른 기기에서 들어왔을 때만)</span>
          <input
            autoComplete="off"
            onChange={(event) => changeTeacherToken(event.target.value)}
            placeholder="이 컴퓨터에서는 비워 둡니다"
            type="password"
            value={teacherToken}
          />
        </label>
      </div>

      {/* 오류와 '수정 버리기' 확인은 두 패널 밖에 둔다. 좁은 화면에서는 한 패널이 숨어 있다. */}
      <div className="dm-review__notices">
        {listError ? (
          <div className="dm-note dm-note--danger" role="alert">
            <p>목록을 불러오지 못했습니다. {listError}</p>
            <button className="dm-btn" onClick={() => setListVersion((v) => v + 1)} type="button">다시 불러오기</button>
          </div>
        ) : null}
        {openError ? <div className="dm-note dm-note--danger" role="alert">문항을 열지 못했습니다. {openError}</div> : null}
        {pendingLeave ? (
          <div className="dm-note dm-note--warn dm-review__leave" role="alertdialog" aria-label="저장하지 않은 수정">
            <p>
              <code>{selected?.id}</code> 문항에 저장하지 않은 수정이 있습니다.
              {pendingLeave.kind === 'open' ? ' 다른 문항을 열기 전에' : ' 목록으로 가기 전에'} 어떻게 할까요?
            </p>
            <div className="dm-review__leave-actions">
              <button className="dm-btn dm-btn--primary" disabled={!canWrite} onClick={() => void saveThenGo(pendingLeave)} type="button">
                저장하고 이동
              </button>
              <button className="dm-btn dm-review__exclude" onClick={() => go(pendingLeave)} type="button">수정 버리기</button>
              <button autoFocus className="dm-btn" onClick={() => setPendingLeave(null)} type="button">계속 고치기</button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="dm-review__layout">
        <div className="dm-review__list-pane">
          <div className="dm-review__filters">
            <label className="dm-field">
              <span>교과</span>
              <select value={filters.subject} onChange={(event) => changeFilter('subject', event.target.value)}>
                <option value="">전체</option>
                {(list?.facets.subjects ?? []).map((s) => <option key={s} value={s}>{SUBJECT_LABEL[s] ?? s}</option>)}
              </select>
            </label>
            <label className="dm-field">
              <span>성취기준</span>
              <select value={filters.standard} onChange={(event) => changeFilter('standard', event.target.value)}>
                <option value="">전체</option>
                {standards.map((s) => <option key={s.code} value={s.code}>{s.code} {s.skill}</option>)}
              </select>
            </label>
            <label className="dm-field">
              <span>상태</span>
              <select value={filters.status} onChange={(event) => changeFilter('status', event.target.value)}>
                <option value="">전체</option>
                {(Object.keys(STATUS_LABEL) as ReviewStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </label>
            <label className="dm-field">
              <span>오달 판정</span>
              <select value={filters.verdict} onChange={(event) => changeFilter('verdict', event.target.value)}>
                <option value="">전체</option>
                <option value="none">판정 없음</option>
                {(list?.facets.verdicts ?? []).map((v) => <option key={v} value={v}>{verdictLabel(v)}</option>)}
              </select>
            </label>
          </div>
          {list ? <p className="dm-review__matched">{list.matched.toLocaleString()}문항</p> : null}
          <ol className="dm-review__list" aria-label="검토할 문항">
            {list?.items.map((item) => (
              <li key={item.id}>
                <button
                  aria-current={selected?.id === item.id ? 'true' : undefined}
                  className="dm-review__row"
                  onClick={() => leave({ kind: 'open', id: item.id })}
                  type="button"
                >
                  <span className="dm-review__row-meta">
                    {item.priority !== null ? <span className="dm-badge dm-badge--warning">우선 {item.priority}</span> : null}
                    <span className="dm-badge" data-status={item.status}>{STATUS_LABEL[item.status]}</span>
                    {item.notes.map((note) => (
                      <span className="dm-badge dm-badge--quiet" key={`${note.source}-${note.verdict}`}>오달 {verdictLabel(note.verdict)}</span>
                    ))}
                    <code>{item.standardCode}</code>
                  </span>
                  <span className="dm-review__row-stem">{item.stem}</span>
                </button>
              </li>
            ))}
          </ol>
          {list && list.items.length < list.matched ? (
            <button className="dm-btn" disabled={!canLoadMore} onClick={() => void loadMore()} type="button">더 보기</button>
          ) : null}
        </div>

        <div className="dm-review__detail-pane">
          {selected && form ? (
            <form className="dm-review__detail" onSubmit={save} aria-label="문항 편집">
              <button className="dm-btn dm-review__back" onClick={() => leave({ kind: 'back' })} type="button">
                목록으로
              </button>
              <header className="dm-review__detail-head">
                <p className="dm-label">{selected.standardCode} · {selected.skill}</p>
                <h3>
                  <code>{selected.id}</code>
                  <span className="dm-badge" data-status={selected.status}>{STATUS_LABEL[selected.status]}</span>
                </h3>
                <p className="dm-review__file">{selected.file}</p>
                {selected.statusEntry ? (
                  <p className="dm-review__file">
                    {selected.statusEntry.reviewer} · {selected.statusEntry.reviewedAt ?? selected.statusEntry.excludedAt}
                    {selected.statusEntry.reason ? ` · ${selected.statusEntry.reason}` : ''}
                  </p>
                ) : null}
              </header>

              {selected.reasons.length > 0 ? (
                <div className="dm-note dm-note--warn">
                  <strong>짚은 점</strong>
                  {selected.reasons.map((r) => <p key={r.source}>{r.source}: {r.text}</p>)}
                </div>
              ) : null}
              {selected.notes.length > 0 ? (
                <div className="dm-note">
                  <strong>오달 판정</strong>
                  {selected.notes.map((n) => (
                    <p key={`${n.source}-${n.verdict}`}>{verdictLabel(n.verdict)}{n.kind ? ` (${n.kind})` : ''}: {n.note}</p>
                  ))}
                </div>
              ) : null}

              <fieldset className="dm-review__fields" disabled={!canWrite}>
                <label className="dm-field">
                  <span>지시문</span>
                  <textarea rows={2} value={form.instruction} onChange={(event) => setForm({ ...form, instruction: event.target.value })} />
                </label>
                <label className="dm-field">
                  <span>지문</span>
                  <textarea rows={3} value={form.stem} onChange={(event) => setForm({ ...form, stem: event.target.value })} />
                </label>
                <label className="dm-field">
                  <span>정답</span>
                  <input type="text" value={form.answer} onChange={(event) => setForm({ ...form, answer: event.target.value })} />
                </label>
                {form.distractors.map((distractor, index) => (
                  <label className="dm-field" key={index}>
                    <span>오답지 {index + 1}</span>
                    <input
                      type="text"
                      value={distractor}
                      onChange={(event) => setForm({
                        ...form,
                        distractors: form.distractors.map((d, i) => (i === index ? event.target.value : d)),
                      })}
                    />
                  </label>
                ))}
                <label className="dm-field">
                  <span>풀이 (한 줄에 한 단계)</span>
                  <textarea rows={4} value={form.solution} onChange={(event) => setForm({ ...form, solution: event.target.value })} />
                </label>
              </fieldset>

              {gateReasons.length > 0 ? (
                <div className="dm-note dm-note--danger" role="alert">
                  <strong>작성 게이트를 통과하지 못해 저장하지 않았습니다</strong>
                  <ul>{gateReasons.map((r, i) => <li key={i}><code>{r.gate}</code> {r.detail}</li>)}</ul>
                </div>
              ) : error ? <div className="dm-note dm-note--danger" role="alert">{error}</div> : null}
              {message ? <p className="dm-note" role="status">{message}</p> : null}

              <div className="dm-review__actions">
                <button className="dm-btn" disabled={!canWrite || !dirty} type="submit">저장</button>
                <button className="dm-btn dm-btn--primary" disabled={!canWrite || !hasReviewer || dirty} onClick={() => verdict('approve')} type="button">
                  승인
                </button>
                <button className="dm-btn dm-btn--primary" disabled={!canWrite || !hasReviewer || !dirty} onClick={() => verdict('approve')} type="button">
                  고친 뒤 승인
                </button>
                <label className="dm-field dm-review__reason">
                  <span>뺄 이유 (선택)</span>
                  <input disabled={!canWrite} type="text" value={excludeReason} onChange={(event) => setExcludeReason(event.target.value)} />
                </label>
                <button className="dm-btn dm-review__exclude" disabled={!canWrite || !hasReviewer} onClick={() => verdict('exclude')} type="button">
                  빼기
                </button>
                {selected.status !== 'pending' ? (
                  <button className="dm-btn" disabled={!canWrite} onClick={() => verdict('reset')} type="button">되돌리기</button>
                ) : null}
              </div>
              {!hasReviewer && writeEnabled ? <p className="dm-field-error">승인·빼기 전에 검토자 이름을 적어 주세요.</p> : null}
            </form>
          ) : (
            <div className="dm-review__empty">
              <p>왼쪽 목록에서 문항을 고르세요.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
