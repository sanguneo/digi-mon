import { type FormEvent, useState } from 'react';

import { gradeWorksheet, recommendLearning } from './api.ts';
import type {
  GradingResult,
  LearningRecommendation,
  Worksheet,
} from './api.ts';
import { AdaptiveLearning } from './adaptive.tsx';
import { collectResponses } from './problem-studio.tsx';

function percent(value: number | null): string {
  return value === null ? '아직 몰라요' : `${Math.round(value * 100)}%`;
}

export function Diagnostic({ worksheet }: { worksheet: Worksheet }) {
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
          <p className="dm-kicker">오늘 발견한 배움</p>
          <h2>나의 연습 지도</h2>
          <p>오늘 해 본 모습만 살펴봐요. 이 결과가 나의 모든 실력을 뜻하지 않아요.</p>
        </header>

        <div className="dm-result-metrics">
          <article>
            <span>맞힌 문제</span>
            <strong>{percent(grading.accuracy)}</strong>
            <small>{grading.correct}/{grading.graded} 자동 채점</small>
          </article>
          <article>
            <span>해 본 문제</span>
            <strong>{percent(grading.completionRate)}</strong>
            <small>{grading.answered}/{grading.graded} 응답</small>
          </article>
          <article>
            <span>함께 볼 문제</span>
            <strong>{grading.manualScoringCount}</strong>
            <small>선생님과 살펴봐요</small>
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
              <span className="dm-badge dm-badge--warning">
                {aggregate.attempted < 3 ? '표본 부족' : `한 번 더 ${percent(aggregate.accuracy)}`}
              </span>
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
        {loading ? '나의 다음 길을 찾는 중…' : '진단 결과 보기'}
      </button>
    </form>
  );
}
