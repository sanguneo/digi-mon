import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, createWorksheet, getProblemTypes, getSubjects } from './api.ts';
import type { Difficulty, GradeBand, ProblemType, Subject, SubjectCoverage, Worksheet } from './api.ts';
import { SUBJECT_PRACTICE, WorksheetHeader, practicePresets, type PracticePreset } from './worksheet-experience.tsx';
import { WorksheetItems } from './worksheet-items.tsx';
import { SubjectMark } from './subject-mark.tsx';
export { collectResponses, WorksheetItems } from './worksheet-items.tsx';

const SUBJECTS: Subject[] = ['math', 'korean', 'english'];
const GRADES: GradeBand[] = ['1-2', '3-4', '5-6'];
let sessionNonce: string | undefined;
let practiceSequence = 0;
function freshPracticeSeed(): string {
  // Practice seeds are not secrets. This also works on a tablet's HTTP LAN host.
  sessionNonce ??= `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `garden-${sessionNonce}-${++practiceSequence}`;
}
const DIFFICULTIES: Array<{ value: Difficulty; label: string; note: string }> = [
  { value: 1, label: '쉬움', note: '차근차근 시작' },
  { value: 2, label: '기본', note: '배운 것을 연습' },
  { value: 3, label: '도전', note: '조금 더 생각' },
];

export interface StudioOptions {
  subject: Subject;
  grade: GradeBand;
  domain: string;
  generatorId: string;
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
  const [problemTypes, setProblemTypes] = useState<ProblemType[]>([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const countChosen = useRef(false);
  const [options, setOptions] = useState<StudioOptions>({
    subject: 'math', grade: '1-2', domain: '', generatorId: '', count: 12, difficulty: 1,
    seed: mode === 'diagnostic' ? 'garden-reward-e2e' : 'garden-math',
  });
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const worksheetRef = useRef<HTMLElement>(null);
  const requestInFlight = useRef(false);

  useEffect(() => {
    if (!attempt) return;
    const first = worksheetRef.current!.querySelector<HTMLElement>('.dm-practice-group')!;
    first.focus({ preventScroll: true });
    first.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [attempt]);

  useEffect(() => {
    void getSubjects().then(setSubjects).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : String(cause));
    });
    void getProblemTypes().then(setProblemTypes).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : String(cause));
    }).finally(() => setTypesLoading(false));
  }, []);

  useEffect(() => {
    if (!subjectRequest) return;
    const next = SUBJECT_PRACTICE[subjectRequest.subject];
    setOptions((current) => ({ ...current, subject: subjectRequest.subject, grade: next.grade, count: countChosen.current ? current.count : next.count, domain: '', generatorId: '', difficulty: 1 }));
    onSubjectChange?.(subjectRequest.subject);
  }, [subjectRequest, onSubjectChange]);

  const practice = SUBJECT_PRACTICE[options.subject];
  const subjectCoverage = subjects.find((entry) => entry.subject === options.subject);
  const domains = useMemo(() => subjectCoverage?.domains.filter((entry) => entry.covered > 0) ?? [], [subjectCoverage]);
  const availableTypes = problemTypes.filter((type) => type.subject === options.subject
    && type.gradeBand === options.grade
    && (!options.domain || type.domain === options.domain)
    && type.difficulties.includes(options.difficulty));
  const countValid = Number.isInteger(options.count) && options.count >= 1 && options.count <= 100;

  const chooseSubject = (subject: Subject) => {
    const next = SUBJECT_PRACTICE[subject];
    setOptions((current) => ({ ...current, subject, grade: next.grade, count: countChosen.current ? current.count : next.count, domain: '', generatorId: '', difficulty: 1 }));
    onSubjectChange?.(subject);
  };
  const choosePreset = (preset: PracticePreset) => {
    countChosen.current = true;
    setOptions((current) => ({ ...current, count: preset.count, domain: preset.domain, generatorId: '', difficulty: preset.difficulty }));
  };
  const generate = async (fresh: boolean) => {
    if (!countValid || requestInFlight.current) return;
    requestInFlight.current = true;
    setLoading(true);
    setError('');
    const seed = fresh ? freshPracticeSeed() : options.seed;
    const excludeItemIds = fresh && worksheet?.options.subject === options.subject
      ? worksheet.items.map((item) => item.id) : undefined;
    if (fresh) setOptions((current) => ({ ...current, seed }));
    try {
      const result = await createWorksheet({
        subject: options.subject, grade: [options.grade],
        ...(options.domain ? { domain: [options.domain] } : {}),
        ...(options.generatorId ? { generatorIds: [options.generatorId] } : {}),
        count: options.count, difficulty: options.difficulty, seed,
        ...(excludeItemIds ? { excludeItemIds } : {}),
      });
      setWorksheet(result);
      setAttempt((current) => current + 1);
      onWorksheet(result);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409 && cause.detail) {
        const detail = cause.detail as { produced?: number };
        setError(`현재 조건에서는${fresh ? ' 이전 문제를 빼고' : ''} 최대 ${detail.produced ?? 0}문항까지 만들 수 있습니다. 설정에서 문항 수나 영역을 바꿔 주세요. 풀던 문제와 답은 그대로 있어요.`);
      } else {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void generate(mode !== 'diagnostic');
  };
  const repeat = () => {
    if (!worksheet || requestInFlight.current) return;
    setError('');
    setAttempt((current) => current + 1);
    onWorksheet(worksheet);
  };

  return (
    <section className="dm-studio" data-dm-subject={options.subject}>
      <div className="dm-studio__intro">
        <h2>{mode === 'diagnostic' ? '나의 출발점 찾기' : '무엇을 배워 볼까요?'}</h2>
        <p>{mode === 'diagnostic' ? '모르는 문제는 비워 두어도 괜찮아요.' : '과목을 고르고, 나의 속도로 시작해요.'}</p>
      </div>
      <form className="dm-builder" onSubmit={submit}>
        <fieldset className="dm-control-group" disabled={loading}>
          <legend>과목</legend>
          <div className="dm-subject-picker">
            {SUBJECTS.map((subject) => (
              <label className="dm-subject-option" data-dm-subject={subject} key={subject}>
                <input aria-label={SUBJECT_PRACTICE[subject].label} checked={options.subject === subject} name={`${mode}-subject`} onChange={() => chooseSubject(subject)} type="radio" />
                <SubjectMark subject={subject} />
                <span>{SUBJECT_PRACTICE[subject].label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="dm-generation-options">
          <label className="dm-field">
            <span>문항 수</span>
            <input aria-label="문항 수" disabled={loading} aria-invalid={!countValid} max="100" min="1" step="1" onChange={(event) => {
              countChosen.current = true;
              setOptions((current) => ({ ...current, count: event.target.valueAsNumber }));
            }} type="number" value={Number.isNaN(options.count) ? '' : options.count} />
          </label>
          <label className="dm-field">
            <span>문제 유형</span>
            <select aria-label="문제 유형" disabled={loading || typesLoading} value={options.generatorId} onChange={(event) => setOptions((current) => ({ ...current, generatorId: event.target.value }))}>
              <option value="">{typesLoading ? '유형 불러오는 중…' : '전체 유형'}</option>
              {availableTypes.map((type) => <option key={type.id} value={type.id}>{type.skill}</option>)}
            </select>
          </label>
        </div>
        {!countValid ? <p className="dm-field-error">문항 수는 1개부터 100개까지입니다.</p> : null}
        <div className="dm-start-row">
          <p><strong>{practice.label} {options.count}문항</strong><span>{options.grade}학년 · {DIFFICULTIES.find((entry) => entry.value === options.difficulty)?.label}</span></p>
          <button className="dm-btn dm-btn--primary" disabled={!countValid || loading} aria-busy={loading} type="submit">{loading ? '만드는 중…' : mode === 'diagnostic' ? '진단평가 시작' : `${options.count}문항 생성`}</button>
        </div>
        <details className="dm-studio-settings">
          <summary>학습 설정 <span>학년 · 영역 · 난이도</span></summary>
          <div className="dm-studio-settings__body">
        <fieldset className="dm-control-group" disabled={loading}>
          <legend>빠르게 고르기</legend>
          <div className="dm-practice-presets">
            {practicePresets(options.subject, options.grade).map((preset) => (
              <button className="dm-btn" key={preset.label} type="button" aria-pressed={!options.generatorId && options.count === preset.count && options.domain === preset.domain && options.difficulty === preset.difficulty} onClick={() => choosePreset(preset)}>{preset.label}</button>
            ))}
          </div>
          <p className="dm-preset-note">{options.subject === 'math' ? '골고루는 여러 영역, 30·50문항은 이 학년의 쉬운 수와 연산, 생각 넓히기는 여러 영역의 도전 문제예요. 문항 수는 100개까지 바꿀 수 있어요.' : '아래에서 학년과 문항 수를 바꿀 수 있어요.'}</p>
        </fieldset>
        <div className="dm-field-row">
          <label className="dm-field">
            <span>학년군</span>
            <select aria-label="학년군" disabled={loading} value={options.grade} onChange={(event) => {
              const grade = GRADES.find((entry) => entry === event.target.value);
              if (grade) setOptions((current) => ({ ...current, grade, generatorId: '' }));
            }}>
              {GRADES.filter((grade) => options.subject !== 'english' || grade !== '1-2').map((grade) => <option key={grade} value={grade}>{grade}학년</option>)}
            </select>
          </label>
          <label className="dm-field">
            <span>영역</span>
            <select aria-label="영역" disabled={loading} value={options.domain} onChange={(event) => setOptions((current) => ({ ...current, domain: event.target.value, generatorId: '' }))}>
              <option value="">전체 영역</option>
              {domains.map((domain) => <option key={domain.domain} value={domain.domain}>{domain.domain}</option>)}
            </select>
          </label>
        </div>
        {options.subject === 'english' ? <p className="dm-preset-note">학교 영어 교육과정은 3학년부터 시작해요. 처음이라면 3-4학년의 쉬운 문제로 연습해요.</p> : null}
        <fieldset className="dm-control-group" disabled={loading}>
          <legend>난이도</legend>
          <div className="dm-difficulty-picker">
            {DIFFICULTIES.map((difficulty) => (
              <label className="dm-difficulty-option" key={difficulty.value}>
                <input checked={options.difficulty === difficulty.value} name={`${mode}-difficulty`} onChange={() => setOptions((current) => ({ ...current, difficulty: difficulty.value, generatorId: '' }))} type="radio" />
                <strong>{difficulty.label}</strong><small>{difficulty.note}</small>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="dm-field dm-field--seed">
          <span>seed</span>
          <input aria-label="seed" disabled={loading} onChange={(event) => setOptions((current) => ({ ...current, seed: event.target.value }))} type="text" value={options.seed} />
          <small>같은 seed와 같은 조건이면 언제든 같은 문제를 다시 만듭니다.</small>
        </label>
        <button className="dm-btn" disabled={!countValid || loading} aria-busy={loading} onClick={() => void generate(false)} type="button">입력한 seed로 생성</button>
        <p className="dm-preset-note">이 버튼은 입력한 seed와 설정을 그대로 사용해요. {mode === 'worksheet' ? '위 시작 버튼과 ' : ''}‘새 문제 풀기’는 새 seed를 만들어요. 지금 문제의 빈 답안은 ‘같은 문제 다시 풀기’를 골라요.</p>
          </div>
        </details>
      </form>
      {error ? <div className="dm-note dm-note--danger" role="alert">{error}</div> : null}
      {worksheet ? (
        <section ref={worksheetRef} className="dm-worksheet" data-dm-subject={worksheet.options.subject} aria-label="생성된 학습지">
          <div className="dm-attempt-actions">
            <div><strong>나의 연습장</strong><span>새 문제는 현재 설정으로, 다시 풀기는 지금 문제 그대로</span></div>
            <button className="dm-btn dm-btn--primary" disabled={!countValid || loading} aria-busy={loading} onClick={() => void generate(true)} type="button">새 문제 풀기</button>
            <button className="dm-btn" disabled={loading} onClick={repeat} type="button">같은 문제 다시 풀기</button>
          </div>
          <WorksheetHeader worksheet={worksheet} />
          <WorksheetItems key={attempt} diagnostic={mode === 'diagnostic'} worksheet={worksheet} />
        </section>
      ) : null}
    </section>
  );
}
