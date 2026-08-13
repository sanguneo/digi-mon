import { useState } from 'react';

import {
  createAdaptiveWorksheet,
  createRemediation,
  type LearningRecommendation,
  type Worksheet,
} from './api.ts';
import { WorksheetItems } from './problem-studio.tsx';

const DECISIONS: Record<LearningRecommendation['decision'], string> = {
  practice: '같은 길을 조금 더 걸어 봐요',
  remediate: '쉬운 징검다리부터 건너요',
  advance: '다음 정원으로 가도 좋아요',
  'await-manual-review': '선생님과 함께 살펴봐요',
};

const REASONS: Record<string, string> = {
  'approved-prerequisite-path': '검토된 쉬운 순서를 골랐어요.',
  incomplete: '아직 해 보지 않은 문제가 있어요.',
  'insufficient-evidence': '한 번만으로는 단정하지 않고 더 연습해요.',
  'manual-scoring-pending': '사람이 살펴볼 문제가 남아 있어요.',
  'meets-policy-threshold': '이번 길을 차근차근 잘 걸었어요.',
  'no-approved-prerequisite-path': '같은 곳에서 한 번 더 연습해요.',
  'weak-standard': '한 번 더 만나면 좋은 문제가 보여요.',
};

export function AdaptiveLearning({
  source,
  recommendation,
}: {
  source: Worksheet;
  recommendation: LearningRecommendation;
}) {
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const actionable = recommendation.nextAction.kind === 'worksheet'
    || recommendation.nextAction.kind === 'remediation';

  const start = async () => {
    setLoading(true);
    setError('');
    try {
      const next = recommendation.nextAction.kind === 'remediation'
        ? await createRemediation(source, recommendation)
        : await createAdaptiveWorksheet(source, recommendation);
      setWorksheet(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="dm-adaptive">
      <div className="dm-adaptive__summary">
        <div>
          <span className="dm-label">다음에 가 볼 길</span>
          <strong>{DECISIONS[recommendation.decision]}</strong>
        </div>
        <div>
          <span className="dm-label">이 길을 고른 까닭</span>
          <ul>
            {recommendation.reasonCodes.map((reason) => (
              <li key={reason}>{REASONS[reason] ?? reason}</li>
            ))}
          </ul>
        </div>
      </div>

      {actionable ? (
        <button className="dm-btn dm-btn--primary" disabled={loading} onClick={start} type="button">
          {loading ? '다음 문제를 준비하는 중…' : '맞춤 학습 시작'}
        </button>
      ) : (
        <p className="dm-note">
          {recommendation.nextAction.kind === 'manual-review'
            ? `${recommendation.nextAction.pendingItems}문항을 선생님과 살펴보면 다음 길이 보여요.`
            : '이번 학습 길을 모두 걸었어요.'}
        </p>
      )}

      {error ? <div className="dm-note dm-note--danger" role="alert">{error}</div> : null}

      {worksheet ? (
        <section className="dm-worksheet dm-worksheet--adaptive">
          <header className="dm-worksheet__header">
            <div>
              <p className="dm-kicker">나에게 맞는 다음 길</p>
              <h3>맞춤 학습지</h3>
              <p>{worksheet.produced}문항 · {worksheet.standardsUsed.length}개 성취기준</p>
            </div>
            <div className="dm-seal">
              <span>seed {worksheet.seed}</span>
              <span>fingerprint {worksheet.fingerprint.slice(0, 12)}</span>
            </div>
          </header>
          <WorksheetItems diagnostic={false} worksheet={worksheet} />
        </section>
      ) : null}
    </section>
  );
}
