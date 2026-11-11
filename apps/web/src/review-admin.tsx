import { type FormEvent, useEffect, useState } from 'react';
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
  submitReviewVerdict,
} from './api.ts';
import './review-admin.css';

export const REVIEWER_STORAGE_KEY = 'digimon.reviewer';
const PAGE_SIZE = 50;

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

function readReviewer(): string {
  try {
    return localStorage.getItem(REVIEWER_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function ReviewAdmin() {
  const [filters, setFilters] = useState<Filters>({ subject: '', standard: '', status: '', verdict: '' });
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [list, setList] = useState<ReviewList | null>(null);
  const [listVersion, setListVersion] = useState(0);
  const [selected, setSelected] = useState<ReviewItemDetail | null>(null);
  const [form, setForm] = useState<ItemForm | null>(null);
  const [reviewer, setReviewer] = useState(readReviewer);
  const [excludeReason, setExcludeReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [gateReasons, setGateReasons] = useState<GateReason[]>([]);

  useEffect(() => {
    let live = true;
    getReviewList({ ...filters, limit }).then((result) => {
      if (live) setList(result);
    }).catch((cause: unknown) => {
      if (live) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => { live = false; };
  }, [filters, limit, listVersion]);

  const changeFilter = (key: keyof Filters, value: string) => {
    setLimit(PAGE_SIZE);
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

  const show = (detail: ReviewItemDetail) => {
    setSelected(detail);
    setForm(toForm(detail.item));
  };

  const open = async (id: string) => {
    setError('');
    setMessage('');
    setGateReasons([]);
    setExcludeReason('');
    try {
      show(await getReviewItem(id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const run = async (task: () => Promise<ReviewItemDetail>, done: string) => {
    setBusy(true);
    setError('');
    setMessage('');
    setGateReasons([]);
    try {
      show(await task());
      setMessage(done);
      setListVersion((v) => v + 1);
    } catch (cause) {
      const reasons = gateReasonsOf(cause);
      if (reasons) setGateReasons(reasons);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const writeEnabled = list?.writeEnabled ?? selected?.writeEnabled ?? false;
  const dirty = Boolean(selected && form && !sameForm(form, toForm(selected.item)));
  const hasReviewer = reviewer.trim().length > 0;
  const canWrite = writeEnabled && !busy;

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !form) return;
    void run(() => saveReviewItem(selected.id, fromForm(form)), '작성 게이트를 통과해 저장했습니다.');
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
    }), labels[action]);
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
                  onClick={() => void open(item.id)}
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
            <button className="dm-btn" onClick={() => setLimit((n) => n + PAGE_SIZE)} type="button">더 보기</button>
          ) : null}
        </div>

        <div className="dm-review__detail-pane">
          {selected && form ? (
            <form className="dm-review__detail" onSubmit={save} aria-label="문항 편집">
              <button className="dm-btn dm-review__back" onClick={() => { setSelected(null); setForm(null); }} type="button">
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
              {error ? <div className="dm-note dm-note--danger" role="alert">{error}</div> : <p>왼쪽 목록에서 문항을 고르세요.</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
