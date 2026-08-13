import { type FormEvent, useState } from 'react';

import { gradeWorksheet, recommendLearning } from './api.ts';
import type {
  GradingResult,
  LearningRecommendation,
  Worksheet,
} from './api.ts';
import { AdaptiveLearning } from './adaptive.tsx';
import { collectResponses } from './problem-studio.tsx';

interface DiagnosticProps {
  worksheet: Worksheet;
}

function percent(value: number | null): string {
  return value === null ? '확인 전' : `${Math.round(value * 100)}%`;
}

export function Diagnostic({ worksheet }: DiagnosticProps) {
  const [grading, setGrading] = useState<GradingResult | null>(null);
  const [recommendation, setRecommendation] = useState<LearningRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const responses = collectResponses();
      const result = await gradeWorksheet(worksheet, responses);
      const next = await recommendLearning(worksheet, result);
      setGrading(result);
      setRecommendation(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  };

  if (grading && recommendation) {
    return (
      <section className="dm-results" aria-live="polite">
        <header>
          <p className="dm-kicker">LEARNING SIGNAL</p>
          <h2>진단 결과</h2>
          <p>이 결과는 오늘의 연습 신호입니다. 학습자의 고정된 수준을 뜻하지 않습니다.</p>
        </header>

        <div className="dm-result-metrics">
          <article>
            <span>정확도</span>
            <strong>{percent(grading.accuracy)}</strong>
            <small>{grading.correct}/{grading.graded} 자동 채점</small>
          </article>
          <article>
            <span>완료율</span>
            <strong>{percent(grading.completionRate)}</strong>
            <small>{grading.answered}/{grading.graded} 응답</small>
          </article>
          <article>
            <span>사람이 볼 문항</span>
            <strong>{grading.manualScoringCount}</strong>
            <small>자동 정확도에서 제외</small>
          </article>
        </div>

        <div className="dm-standard-results">
          <h3>성취기준별 연습 신호</h3>
          {Object.entries(grading.byStandard).map(([code, aggregate]) => (
            <article className="dm-standard-row" key={code}>
              <div>
                <strong>{code}</strong>
                <span>{aggregate.correct}/{aggregate.attempted} 시도</span>
              </div>
              {aggregate.attempted < 3 ? (
                <span className="dm-badge dm-badge--warning">표본 부족</span>
              ) : (
                <span className="dm-badge">추가 연습 후보 {percent(aggregate.accuracy)}</span>
              )}
            </article>
          ))}
        </div>

        <AdaptiveLearning recommendation={recommendation} source={worksheet} />
      </section>
    );
  }

  return (
    <form className="dm-diagnostic-submit" onSubmit={submit}>
      {error ? <div className="dm-note dm-note--danger" role="alert">{error}</div> : null}
      <button className="dm-btn dm-btn--primary" disabled={loading} type="submit">
        {loading ? '채점하고 다음 학습 찾는 중…' : '진단 결과 보기'}
      </button>
    </form>
  );
}
