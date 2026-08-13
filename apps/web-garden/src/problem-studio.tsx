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
import { useGame } from './game-context.tsx';

const SUBJECTS: Array<{ id: Subject; label: string; mark: string; emoji: string }> = [
  { id: 'math', label: '수학', mark: '수', emoji: '🔢' },
  { id: 'korean', label: '국어', mark: '국', emoji: '📖' },
  { id: 'english', label: '영어', mark: '영', emoji: '🌍' },
];
const GRADES: GradeBand[] = ['1-2', '3-4', '5-6'];
const DIFFICULTIES: Array<{ value: Difficulty; label: string; note: string }> = [
  { value: 1, label: '쉬움', note: '천천히 씨앗 심기' },
  { value: 2, label: '기본', note: '쑥쑥 자라기' },
  { value: 3, label: '도전', note: '튼튼한 나무 되기' },
];

interface ProblemStudioProps {
  mode: 'worksheet' | 'diagnostic';
  onWorksheet: (worksheet: Worksheet) => void;
}

function ItemCard({ item, diagnostic, worksheetId }: {
  item: WorksheetItem;
  diagnostic: boolean;
  worksheetId: string;
}) {
  const { answerItem } = useGame();
  const language = item.subject === 'english' ? 'en' : 'ko';
  const markAnswered = () => answerItem(worksheetId, item.id);
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
          <legend>내가 해 본 답</legend>
          {item.choices ? (
            <div className="dm-choice-list">
              {item.choices.map((choice) => (
                <label className="dm-choice" key={choice.label}>
                  <input
                    type="radio"
                    name={`response-${item.number}`}
                    value={choice.text}
                    onChange={markAnswered}
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
              onChange={markAnswered}
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
        <ItemCard
          diagnostic={diagnostic}
          item={item}
          key={item.id}
          worksheetId={worksheet.fingerprint}
        />
      ))}
    </div>
  );
}

export function ProblemStudio({ mode, onWorksheet }: ProblemStudioProps) {
  const [subjects, setSubjects] = useState<SubjectCoverage[]>([]);
  const [subject, setSubject] = useState<Subject>('math');
  const [grade, setGrade] = useState<GradeBand>(mode === 'diagnostic' ? '1-2' : '3-4');
  const [domain, setDomain] = useState('');
  const [count, setCount] = useState(6);
  const [difficulty, setDifficulty] = useState<Difficulty>(2);
  const [seed, setSeed] = useState(mode === 'diagnostic' ? 'garden-reward-e2e' : 'garden-math');
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void getSubjects().then(setSubjects).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : String(cause));
    });
  }, []);

  const subjectCoverage = subjects.find((entry) => entry.subject === subject);
  const domains = useMemo(
    () => subjectCoverage?.domains.filter((entry) => entry.covered > 0) ?? [],
    [subjectCoverage],
  );
  const countValid = Number.isInteger(count) && count >= 1 && count <= 100;
  const difficultyLabel = DIFFICULTIES.find((entry) => entry.value === difficulty)?.label;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!countValid) return;
    setLoading(true);
    setError('');
    try {
      const result = await createWorksheet({
        subject,
        grade: [grade],
        ...(domain ? { domain: [domain] } : {}),
        count,
        difficulty,
        seed,
      });
      setWorksheet(result);
      onWorksheet(result);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409 && cause.detail) {
        const detail = cause.detail as { produced?: number };
        setError(`지금 고른 조건에서는 ${detail.produced ?? 0}문항까지 만들 수 있어요.`);
      } else {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="dm-studio" data-dm-subject={subject}>
      <div className="dm-studio__intro">
        <p className="dm-kicker">{mode === 'diagnostic' ? '나의 출발점 찾기' : '문제 씨앗 고르기'}</p>
        <h2>{mode === 'diagnostic' ? '천천히 해 보고 다음 길을 찾아요' : '오늘 심을 문제 씨앗은?'}</h2>
        <p>
          {mode === 'diagnostic'
            ? '이름은 묻지 않아요. 답을 해 본 걸음마다 작은 정원이 자라요.'
            : '과목과 난이도, 문항 수를 고르면 나만의 문제 밭이 바로 만들어져요.'}
        </p>
      </div>

      <form className="dm-builder" onSubmit={submit}>
        <fieldset className="dm-control-group">
          <legend>어떤 과목을 해 볼까요?</legend>
          <div className="dm-subject-picker">
            {SUBJECTS.map((entry) => (
              <label className="dm-subject-option" key={entry.id}>
                <input
                  checked={subject === entry.id}
                  name={`${mode}-subject`}
                  onChange={() => {
                    setSubject(entry.id);
                    setDomain('');
                  }}
                  type="radio"
                />
                <span className="dm-subject-option__emoji" aria-hidden="true">{entry.emoji}</span>
                <span className="dm-subject-option__mark">{entry.mark}</span>
                <span>{entry.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="dm-field-row">
          <label className="dm-field">
            <span>학년군</span>
            <select value={grade} onChange={(event) => setGrade(event.target.value as GradeBand)}>
              {GRADES.map((value) => <option key={value} value={value}>{value}학년</option>)}
            </select>
          </label>
          <label className="dm-field">
            <span>영역</span>
            <select value={domain} onChange={(event) => setDomain(event.target.value)}>
              <option value="">전체 영역</option>
              {domains.map((entry) => (
                <option key={entry.domain} value={entry.domain}>{entry.domain}</option>
              ))}
            </select>
          </label>
          <label className="dm-field">
            <span>문항 수</span>
            <input
              aria-invalid={!countValid}
              max="100"
              min="1"
              onChange={(event) => setCount(event.target.valueAsNumber)}
              type="number"
              value={Number.isNaN(count) ? '' : count}
            />
          </label>
        </div>
        {!countValid ? <p className="dm-field-error">1개부터 100개까지 고를 수 있어요.</p> : null}

        <fieldset className="dm-control-group">
          <legend>어느 높이부터 시작할까요?</legend>
          <div className="dm-difficulty-picker">
            {DIFFICULTIES.map((entry) => (
              <label className="dm-difficulty-option" key={entry.value}>
                <input
                  checked={difficulty === entry.value}
                  name={`${mode}-difficulty`}
                  onChange={() => setDifficulty(entry.value)}
                  type="radio"
                />
                <strong>{entry.label}</strong>
                <small>{entry.note}</small>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="dm-field dm-field--seed">
          <span>seed</span>
          <input onChange={(event) => setSeed(event.target.value)} type="text" value={seed} />
          <small>같은 seed와 같은 조건이면 같은 문제를 다시 만나요.</small>
        </label>

        <button className="dm-btn dm-btn--primary" disabled={!countValid || loading} type="submit">
          {loading ? '문제 씨앗을 심는 중…' : mode === 'diagnostic' ? '진단평가 시작' : `${count}문항 생성`}
        </button>
      </form>

      {error ? <div className="dm-note dm-note--danger" role="alert">{error}</div> : null}

      {worksheet ? (
        <section className="dm-worksheet" aria-label="생성된 학습지">
          <header className="dm-worksheet__header">
            <div>
              <p className="dm-kicker">{worksheet.title}</p>
              <h3>{subjectCoverage?.subjectKorean ?? worksheet.items[0]?.subjectKorean} · {grade}학년</h3>
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
