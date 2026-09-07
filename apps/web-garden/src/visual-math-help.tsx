import { useState } from 'react';
import type { WorksheetItem } from './api.ts';
import './visual-math-help.css';

type PublicExpression = Pick<WorksheetItem, 'subject' | 'stem'>;
type VisualExpression = {
  operation: 'addition' | 'subtraction' | 'multiplication';
  left: number;
  right: number;
};

// This is a bounded drawing grammar, not an evaluator or an answer parser.
export function parseVisualExpression(item: PublicExpression): VisualExpression | null {
  if (item.subject !== 'math') return null;
  const match = /^(10|[0-9])\s*([+−\-×*])\s*(10|[0-9])(?:\s*=\s*[□?])?$/.exec(item.stem.trim());
  if (!match) return null;
  const left = Number(match[1]);
  const right = Number(match[3]);
  const operation = match[2] === '+' ? 'addition'
    : match[2] === '-' || match[2] === '−' ? 'subtraction' : 'multiplication';
  if (operation === 'addition' && left + right > 20) return null;
  if (operation === 'subtraction' && left < right) return null;
  return { operation, left, right };
}

function TenFrame({ quantity, removed = 0, secondary = false }: {
  quantity: number;
  removed?: number;
  secondary?: boolean;
}) {
  return (
    <div className={`dm-visual-math__frame${secondary ? ' dm-visual-math__frame--secondary' : ''}`} data-quantity={quantity}>
      {Array.from({ length: 10 }, (_, index) => (
        <span className="dm-visual-math__cell" key={index}>
          {index < quantity ? <span
            className="dm-visual-math__dot"
            data-dot=""
            data-removed={index >= quantity - removed ? 'true' : undefined}
          /> : null}
        </span>
      ))}
    </div>
  );
}

export function VisualMathHelp({ item }: { item: PublicExpression }) {
  const [open, setOpen] = useState(false);
  const expression = parseVisualExpression(item);
  if (!expression) return null;
  const { operation, left, right } = expression;
  const description = operation === 'addition'
    ? `점 ${left}개와 ${right}개를 더해요. 두 칸의 점을 함께 세어 보세요.`
    : operation === 'subtraction'
      ? `점 ${left}개에서 ${right}개를 빼요. 빼는 점에 빗금을 그었어요. 빗금 없는 점을 세어 보세요.`
      : `한 묶음에 점 ${left}개씩, ${right}묶음이에요. 같은 크기의 묶음을 세어 보세요.`;

  return (
    <details className="dm-visual-math" data-operation={operation} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>점으로 생각해 보기</summary>
      {open ? <div role="img" aria-label={description} lang="ko">
        <div aria-hidden="true">
          {operation === 'addition' ? <>
            <div className="dm-visual-math__joined">
              <div className="dm-visual-math__quantity">
                <p><strong>{left}</strong>개</p>
                <TenFrame quantity={left} />
              </div>
              <span className="dm-visual-math__operator">+</span>
              <div className="dm-visual-math__quantity">
                <p><strong>{right}</strong>개</p>
                <TenFrame quantity={right} secondary />
              </div>
            </div>
            <p className="dm-visual-math__legend">두 칸의 점을 함께 세어 보세요.</p>
          </> : operation === 'subtraction' ? <>
            <p className="dm-visual-math__given"><strong>{left}</strong>개에서 <strong>{right}</strong>개 빼기</p>
            <TenFrame quantity={left} removed={right} />
            <p className="dm-visual-math__legend">빗금은 빼는 점이에요. 빗금 없는 점을 세어 보세요.</p>
          </> : <>
            <p className="dm-visual-math__given">한 묶음에 <strong>{left}</strong>개씩, <strong>{right}</strong>묶음</p>
            <div className="dm-visual-math__groups">
              {Array.from({ length: right }, (_, index) => <TenFrame quantity={left} key={index} secondary={index % 2 === 1} />)}
            </div>
            <p className="dm-visual-math__legend">{right === 0 ? '묶음이 없어요.' : '같은 크기의 묶음을 세어 보세요.'}</p>
          </>}
        </div>
      </div> : null}
    </details>
  );
}
