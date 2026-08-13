import { useState } from 'react';

import {
  createAdaptiveWorksheet,
  createRemediation,
  type LearningRecommendation,
  type Worksheet,
} from './api.ts';
import { WorksheetItems } from './problem-studio.tsx';

const DECISIONS: Record<LearningRecommendation['decision'], string> = {
  practice: '조금 더 연습',
  remediate: '선수 개념부터 보충',
  advance: '다음 수준으로',
  'await-manual-review': '선생님 확인 대기',
};

const REASONS: Record<string, string> = {
  'approved-prerequisite-path': '검토된 선수 학습 순서를 적용했습니다.',
  incomplete: '아직 답하지 않은 문항이 있습니다.',
  'insufficient-evidence': '한 번의 평가만으로 수준을 단정할 수 없습니다.',
  'manual-scoring-pending': '사람이 확인해야 하는 문항이 남아 있습니다.',
  'meets-policy-threshold': '현재 연습 범위를 안정적으로 완료했습니다.',
  'no-approved-prerequisite-path': '승인된 선수 경로가 없어 같은 기준을 더 연습합니다.',
  'weak-standard': '추가 연습이 필요한 성취기준이 관찰됐습니다.',
};

interface AdaptiveProps {
  source: Worksheet;
  recommendation: LearningRecommendation;
}

export function AdaptiveLearning({ source, recommendation }: AdaptiveProps) {
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
          <span className="dm-label">추천 판단</span>
          <strong>{DECISIONS[recommendation.decision]}</strong>
        </div>
        <div>
          <span className="dm-label">추천 근거</span>
          <ul>
            {recommendation.reasonCodes.map((reason) => (
              <li key={reason}>{REASONS[reason] ?? reason}</li>
            ))}
          </ul>
        </div>
      </div>

      {actionable ? (
        <button className="dm-btn dm-btn--primary" disabled={loading} onClick={start} type="button">
          {loading ? '맞춤 문제를 만드는 중…' : '맞춤 학습 시작'}
        </button>
      ) : (
        <p className="dm-note dm-note--info">
          {recommendation.nextAction.kind === 'manual-review'
            ? `${recommendation.nextAction.pendingItems}문항을 선생님이 확인하면 다음 학습을 제안합니다.`
            : '이번 학습 범위를 완료했습니다.'}
        </p>
      )}

      {error ? <div className="dm-note dm-note--danger" role="alert">{error}</div> : null}

      {worksheet ? (
        <section className="dm-worksheet dm-worksheet--adaptive">
          <header className="dm-worksheet__header">
            <div>
              <p className="dm-kicker">PERSONAL NEXT STEP</p>
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
