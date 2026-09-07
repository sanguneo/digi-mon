import { useState } from 'react';
import type { LearningSupport, WorksheetItem } from './api.ts';
import { VisualMathHelp } from './visual-math-help.tsx';
import './learning-help.css';

export function LearningHelp({ support, item }: {
  support?: LearningSupport;
  item?: Pick<WorksheetItem, 'subject' | 'stem'>;
}) {
  const [hintCount, setHintCount] = useState(0);
  if (!support) return null;
  const guided = support.status === 'guided-candidate' ? support : null;

  return (
    <details className="dm-learning-help">
      <summary>{guided ? '생각하는 방법 보기' : '무엇을 배울까요?'}</summary>
      <div className="dm-learning-help__body">
        <p className="dm-learning-help__objective">{support.objective.text}</p>
        {item ? <VisualMathHelp item={item} /> : null}
        {guided?.materials.map((material, index) => <p key={index}>{material.text}</p>)}
        {guided ? <>
          <ol className="dm-learning-help__hints" aria-live="polite" aria-relevant="additions">
            {guided.hints.slice(0, hintCount).map((hint) => <li key={hint.level}>{hint.text}</li>)}
          </ol>
          {hintCount < guided.hints.length ? (
            <button
              className="dm-btn"
              onClick={() => setHintCount((current) => current + 1)}
              type="button"
            >
              {hintCount === 0 ? '도움말 한 걸음' : '도움말 한 걸음 더'}
            </button>
          ) : null}
        </> : null}
      </div>
    </details>
  );
}
