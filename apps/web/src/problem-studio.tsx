import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { ApiError, createWorksheet, getSubjects } from './api.ts';
import type {
  Difficulty,
  GradeBand,
  Subject,
  SubjectCoverage,
  Worksheet,
  WorksheetItem,
} from './api.ts';
import { Figure } from './figure.tsx';

const SUBJECTS: Array<{ id: Subject; label: string; mark: string }> = [
  { id: 'math', label: '수학', mark: '수' },
  { id: 'korean', label: '국어', mark: '국' },
  { id: 'english', label: '영어', mark: '영' },
];
const GRADES: GradeBand[] = ['1-2', '3-4', '5-6'];
const DIFFICULTIES: Array<{ value: Difficulty; label: string; note: string }> = [
  { value: 1, label: '쉬움', note: '개념 확인' },
  { value: 2, label: '기본', note: '핵심 연습' },
  { value: 3, label: '도전', note: '생각 확장' },
];

export interface StudioOptions {
  subject: Subject;
  grade: GradeBand;
  domain: string;
  count: number;
  difficulty: Difficulty;
  seed: string;
}

interface ProblemStudioProps {
  mode: 'worksheet' | 'diagnostic';
  onWorksheet: (worksheet: Worksheet) => void;
}

function ItemCard({ item, diagnostic }: { item: WorksheetItem; diagnostic: boolean }) {
  const language = item.subject === 'english' ? 'en' : 'ko';
  return (
    <article
      className="dm-item"
      data-response-number={diagnostic ? item.number : undefined}
    >
      <header className="dm-item__meta">
        <span className="dm-item__number">{String(item.number).padStart(2, '0')}</span>
        <span className="dm-badge">난이도 {item.difficulty}</span>
        <span className="dm-badge dm-badge--quiet">{item.standardCode}</span>
      </header>
      {item.instruction ? <p className="dm-item__instruction">{item.instruction}</p> : null}
      <p className="dm-item__stem" lang={language}>{item.stem}</p>
      {item.figure ? <Figure figure={item.figure} /> : null}
      {diagnostic ? (
        <fieldset className="dm-answer" aria-label={`${item.number}번 답`}>
          <legend>내 답</legend>
          {item.choices ? (
            <div className="dm-choice-list">
              {item.choices.map((choice) => (
                <label className="dm-choice" key={choice.label}>
                  <input
                    type="radio"
                    name={`response-${item.number}`}
                    value={choice.text}
                  />
                  <span>{choice.label}</span>
                  <span lang="ko">{choice.text}</span>
                </label>
              ))}
            </div>
          ) : (
            <input
              aria-label={`${item.number}번 답 입력`}
              className="dm-input dm-answer__input"
              name={`response-${item.number}`}
              type="text"
              autoComplete="off"
            />
          )}
        </fieldset>
      ) : (
        <div className="dm-print-answer" aria-hidden="true">답</div>
      )}
    </article>
  );
}

export function collectResponses(root: ParentNode = document): Record<string, string> {
  const responses: Record<string, string> = {};
  const fields = root.querySelectorAll<HTMLInputElement>('input[name^="response-"]');
  for (const field of fields) {
    if (field.type === 'radio' && !field.checked) continue;
    const match = /^response-(\d+)$/.exec(field.name);
    if (match && field.value.trim()) responses[match[1] ?? ''] = field.value;
  }
  return responses;
}

export function WorksheetItems({
  worksheet,
  diagnostic,
}: {
  worksheet: Worksheet;
  diagnostic: boolean;
}) {
  return (
    <div className="dm-item-list">
      {worksheet.items.map((item) => (
        <ItemCard diagnostic={diagnostic} item={item} key={item.id} />
      ))}
    </div>
  );
}

export function ProblemStudio({ mode, onWorksheet }: ProblemStudioProps) {
  const [subjects, setSubjects] = useState<SubjectCoverage[]>([]);
  const [options, setOptions] = useState<StudioOptions>({
    subject: 'math',
    grade: '3-4',
    domain: '',
    count: 6,
    difficulty: 2,
    seed: mode === 'diagnostic' ? 'diagnostic-e2e' : 'today-math',
  });
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void getSubjects()
      .then(setSubjects)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : String(cause));
      });
  }, []);

  const subjectCoverage = subjects.find((entry) => entry.subject === options.subject);
  const domains = useMemo(
    () => subjectCoverage?.domains.filter((entry) => entry.covered > 0) ?? [],
    [subjectCoverage],
  );
  const countValid = Number.isInteger(options.count) && options.count >= 1 && options.count <= 100;
  const difficultyLabel = DIFFICULTIES.find((entry) => entry.value === options.difficulty)?.label;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!countValid) return;
    setLoading(true);
    setError('');
    try {
      const result = await createWorksheet({
        subject: options.subject,
        grade: [options.grade],
        ...(options.domain ? { domain: [options.domain] } : {}),
        count: options.count,
        difficulty: options.difficulty,
        seed: options.seed,
      });
      setWorksheet(result);
      onWorksheet(result);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409 && cause.detail) {
        const detail = cause.detail as { produced?: number };
        setError(`현재 조건에서는 최대 ${detail.produced ?? 0}문항까지 만들 수 있습니다.`);
      } else {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="dm-studio" data-dm-subject={options.subject}>
      <div className="dm-studio__intro">
        <p className="dm-kicker">{mode === 'diagnostic' ? 'DIAGNOSTIC' : 'PROBLEM STUDIO'}</p>
        <h2>{mode === 'diagnostic' ? '지금의 출발점을 확인해요' : '필요한 만큼, 정확한 문제를'}</h2>
        <p>
          {mode === 'diagnostic'
            ? '이름을 묻지 않습니다. 한 번의 결과를 능력으로 단정하지 않고 다음 연습만 제안합니다.'
            : '교과와 난이도, 문항 수를 고르면 교육과정 엔진이 바로 학습지를 만듭니다.'}
        </p>
      </div>

      <form className="dm-builder" onSubmit={submit}>
        <fieldset className="dm-control-group">
          <legend>과목</legend>
          <div className="dm-subject-picker">
            {SUBJECTS.map((subject) => (
              <label className="dm-subject-option" key={subject.id}>
                <input
                  checked={options.subject === subject.id}
                  name={`${mode}-subject`}
                  onChange={() => setOptions((current) => ({
                    ...current,
                    subject: subject.id,
                    domain: '',
                  }))}
                  type="radio"
                />
                <span className="dm-subject-option__mark">{subject.mark}</span>
                <span>{subject.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="dm-field-row">
          <label className="dm-field">
            <span>학년군</span>
            <select
              value={options.grade}
              onChange={(event) => setOptions((current) => ({
                ...current,
                grade: event.target.value as GradeBand,
              }))}
            >
              {GRADES.map((grade) => (
                <option key={grade} value={grade}>{grade}학년</option>
              ))}
            </select>
          </label>
          <label className="dm-field">
            <span>영역</span>
            <select
              value={options.domain}
              onChange={(event) => setOptions((current) => ({
                ...current,
                domain: event.target.value,
              }))}
            >
              <option value="">전체 영역</option>
              {domains.map((domain) => (
                <option key={domain.domain} value={domain.domain}>
                  {domain.domain}
                </option>
              ))}
            </select>
          </label>
          <label className="dm-field">
            <span>문항 수</span>
            <input
              aria-invalid={!countValid}
              max="100"
              min="1"
              onChange={(event) => setOptions((current) => ({
                ...current,
                count: event.target.valueAsNumber,
              }))}
              type="number"
              value={Number.isNaN(options.count) ? '' : options.count}
            />
          </label>
        </div>
        {!countValid ? (
          <p className="dm-field-error">문항 수는 1개부터 100개까지입니다.</p>
        ) : null}

        <fieldset className="dm-control-group">
          <legend>난이도</legend>
          <div className="dm-difficulty-picker">
            {DIFFICULTIES.map((difficulty) => (
              <label className="dm-difficulty-option" key={difficulty.value}>
                <input
                  checked={options.difficulty === difficulty.value}
                  name={`${mode}-difficulty`}
                  onChange={() => setOptions((current) => ({
                    ...current,
                    difficulty: difficulty.value,
                  }))}
                  type="radio"
                />
                <strong>{difficulty.label}</strong>
                <small>{difficulty.note}</small>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="dm-field dm-field--seed">
          <span>seed</span>
          <input
            onChange={(event) => setOptions((current) => ({
              ...current,
              seed: event.target.value,
            }))}
            type="text"
            value={options.seed}
          />
          <small>같은 seed와 같은 조건이면 언제든 같은 문제를 다시 만듭니다.</small>
        </label>

        <button className="dm-btn dm-btn--primary" disabled={!countValid || loading} type="submit">
          {loading
            ? '만드는 중…'
            : mode === 'diagnostic'
              ? '진단평가 시작'
              : `${options.count}문항 생성`}
        </button>
      </form>

      {error ? <div className="dm-note dm-note--danger" role="alert">{error}</div> : null}

      {worksheet ? (
        <section className="dm-worksheet" aria-label="생성된 학습지">
          <header className="dm-worksheet__header">
            <div>
              <p className="dm-kicker">{worksheet.title}</p>
              <h3>{subjectCoverage?.subjectKorean ?? worksheet.items[0]?.subjectKorean} · {options.grade}학년</h3>
              <p>난이도 {difficultyLabel} · {worksheet.produced}문항</p>
            </div>
            <div className="dm-seal">
              <span>seed {worksheet.seed}</span>
              <span>fingerprint {worksheet.fingerprint.slice(0, 12)}</span>
            </div>
          </header>
          <WorksheetItems diagnostic={mode === 'diagnostic'} worksheet={worksheet} />
        </section>
      ) : null}
    </section>
  );
}
