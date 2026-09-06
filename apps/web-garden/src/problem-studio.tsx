import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiError, createWorksheet, getSubjects } from './api.ts';
import type { Difficulty, GradeBand, Subject, SubjectCoverage, Worksheet } from './api.ts';
import { SUBJECT_PRACTICE, WorksheetHeader, practicePresets, type PracticePreset } from './worksheet-experience.tsx';
import { WorksheetItems } from './worksheet-items.tsx';
export { collectResponses, WorksheetItems } from './worksheet-items.tsx';

const SUBJECTS: Subject[] = ['math', 'korean', 'english'];
const GRADES: GradeBand[] = ['1-2', '3-4', '5-6'];
const DIFFICULTIES: Array<{ value: Difficulty; label: string; note: string }> = [
  { value: 1, label: '쉬움', note: '차근차근 시작' },
  { value: 2, label: '기본', note: '배운 것을 연습' },
  { value: 3, label: '도전', note: '조금 더 생각' },
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
  onSubjectChange?: (subject: Subject) => void;
  subjectRequest?: { subject: Subject; revision: number } | null;
}

export function ProblemStudio({ mode, onWorksheet, onSubjectChange, subjectRequest }: ProblemStudioProps) {
  const [subjects, setSubjects] = useState<SubjectCoverage[]>([]);
  const [options, setOptions] = useState<StudioOptions>({
    subject: 'math', grade: '1-2', domain: '', count: 12, difficulty: 1,
    seed: mode === 'diagnostic' ? 'garden-reward-e2e' : 'garden-math',
  });
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void getSubjects().then(setSubjects).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : String(cause));
    });
  }, []);

  useEffect(() => {
    if (!subjectRequest) return;
    const next = SUBJECT_PRACTICE[subjectRequest.subject];
    setOptions((current) => ({ ...current, subject: subjectRequest.subject, grade: next.grade, count: next.count, domain: '', difficulty: 1 }));
    onSubjectChange?.(subjectRequest.subject);
  }, [subjectRequest, onSubjectChange]);

  const practice = SUBJECT_PRACTICE[options.subject];
  const subjectCoverage = subjects.find((entry) => entry.subject === options.subject);
  const domains = useMemo(() => subjectCoverage?.domains.filter((entry) => entry.covered > 0) ?? [], [subjectCoverage]);
  const countValid = Number.isInteger(options.count) && options.count >= 1 && options.count <= 100;

  const chooseSubject = (subject: Subject) => {
    const next = SUBJECT_PRACTICE[subject];
    setOptions((current) => ({ ...current, subject, grade: next.grade, count: next.count, domain: '', difficulty: 1 }));
    onSubjectChange?.(subject);
  };
  const choosePreset = (preset: PracticePreset) => {
    setOptions((current) => ({ ...current, count: preset.count, domain: preset.domain, difficulty: preset.difficulty }));
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!countValid) return;
    setLoading(true);
    setError('');
    try {
      const result = await createWorksheet({
        subject: options.subject, grade: [options.grade],
        ...(options.domain ? { domain: [options.domain] } : {}),
        count: options.count, difficulty: options.difficulty, seed: options.seed,
      });
      setWorksheet(result);
      onWorksheet(result);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409 && cause.detail) {
        const detail = cause.detail as { produced?: number };
        setError(`현재 조건에서는 최대 ${detail.produced ?? 0}문항까지 만들 수 있습니다. 문항 수를 줄이거나 전체 영역을 골라 주세요.`);
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
        <p className="dm-kicker">{mode === 'diagnostic' ? '나의 출발점 찾기' : '오늘의 연습 고르기'}</p>
        <h2>{mode === 'diagnostic' ? '천천히 풀고, 다음을 찾아요' : practice.title}</h2>
        <p>{mode === 'diagnostic' ? '이름은 묻지 않아요. 모르는 문제는 비워 두어도 괜찮아요. 오늘의 연습을 보고 다음 문제를 찾아요.' : practice.guidance}</p>
      </div>
      <form className="dm-builder" onSubmit={submit}>
        <fieldset className="dm-control-group" disabled={loading}>
          <legend>과목</legend>
          <div className="dm-subject-picker">
            {SUBJECTS.map((subject) => (
              <label className="dm-subject-option" data-dm-subject={subject} key={subject}>
                <input checked={options.subject === subject} name={`${mode}-subject`} onChange={() => chooseSubject(subject)} type="radio" />
                <span className="dm-subject-option__mark" aria-hidden="true">{SUBJECT_PRACTICE[subject].mark}</span>
                <span>{SUBJECT_PRACTICE[subject].label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="dm-control-group" disabled={loading}>
          <legend>빠르게 고르기</legend>
          <div className="dm-practice-presets">
            {practicePresets(options.subject, options.grade).map((preset) => (
              <button className="dm-btn" key={preset.label} type="button" aria-pressed={options.count === preset.count && options.domain === preset.domain && options.difficulty === preset.difficulty} onClick={() => choosePreset(preset)}>{preset.label}</button>
            ))}
          </div>
          <p className="dm-preset-note">{options.subject === 'math' ? '골고루는 여러 영역, 30·50문항은 이 학년의 쉬운 수와 연산, 생각 넓히기는 여러 영역의 도전 문제예요. 문항 수는 100개까지 바꿀 수 있어요.' : '아래에서 학년과 문항 수를 바꿀 수 있어요.'}</p>
        </fieldset>
        <div className="dm-field-row">
          <label className="dm-field">
            <span>학년군</span>
            <select disabled={loading} value={options.grade} onChange={(event) => setOptions((current) => ({ ...current, grade: event.target.value as GradeBand }))}>
              {GRADES.filter((grade) => options.subject !== 'english' || grade !== '1-2').map((grade) => <option key={grade} value={grade}>{grade}학년</option>)}
            </select>
          </label>
          <label className="dm-field">
            <span>영역</span>
            <select disabled={loading} value={options.domain} onChange={(event) => setOptions((current) => ({ ...current, domain: event.target.value }))}>
              <option value="">전체 영역</option>
              {domains.map((domain) => <option key={domain.domain} value={domain.domain}>{domain.domain}</option>)}
            </select>
          </label>
          <label className="dm-field">
            <span>문항 수</span>
            <input disabled={loading} aria-invalid={!countValid} max="100" min="1" onChange={(event) => setOptions((current) => ({ ...current, count: event.target.valueAsNumber }))} type="number" value={Number.isNaN(options.count) ? '' : options.count} />
          </label>
        </div>
        {options.subject === 'english' ? <p className="dm-preset-note">학교 영어 교육과정은 3학년부터 시작해요. 처음이라면 3-4학년의 쉬운 문제로 연습해요.</p> : null}
        {!countValid ? <p className="dm-field-error">문항 수는 1개부터 100개까지입니다.</p> : null}
        <fieldset className="dm-control-group" disabled={loading}>
          <legend>난이도</legend>
          <div className="dm-difficulty-picker">
            {DIFFICULTIES.map((difficulty) => (
              <label className="dm-difficulty-option" key={difficulty.value}>
                <input checked={options.difficulty === difficulty.value} name={`${mode}-difficulty`} onChange={() => setOptions((current) => ({ ...current, difficulty: difficulty.value }))} type="radio" />
                <strong>{difficulty.label}</strong><small>{difficulty.note}</small>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="dm-field dm-field--seed">
          <span>seed</span>
          <input disabled={loading} onChange={(event) => setOptions((current) => ({ ...current, seed: event.target.value }))} type="text" value={options.seed} />
          <small>같은 seed와 같은 조건이면 언제든 같은 문제를 다시 만듭니다.</small>
        </label>
        <button className="dm-btn dm-btn--primary" disabled={!countValid || loading} type="submit">{loading ? '만드는 중…' : mode === 'diagnostic' ? '진단평가 시작' : `${options.count}문항 생성`}</button>
      </form>
      {error ? <div className="dm-note dm-note--danger" role="alert">{error}</div> : null}
      {worksheet ? (
        <section className="dm-worksheet" data-dm-subject={worksheet.options.subject} aria-label="생성된 학습지">
          <WorksheetHeader worksheet={worksheet} />
          <WorksheetItems diagnostic={mode === 'diagnostic'} worksheet={worksheet} />
        </section>
      ) : null}
    </section>
  );
}
