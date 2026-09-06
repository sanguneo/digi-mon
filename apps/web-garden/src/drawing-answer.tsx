import { type PointerEvent, useRef, useState } from 'react';
import './drawing-answer.css';
type Point = [number, number];
export function DrawingAnswer({ name, number, onParticipate }: { name: string; number: number; onParticipate?: () => void }) {
  const [drawing, setDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [paper, setPaper] = useState(false);
  const active = useRef<{ pointer: number; index: number } | null>(null);
  const point = (event: PointerEvent<SVGSVGElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [Math.round(Math.max(0, Math.min(600, (event.clientX - rect.left) * 600 / rect.width))), Math.round(Math.max(0, Math.min(240, (event.clientY - rect.top) * 240 / rect.height)))];
  };
  const finish = (event: PointerEvent<SVGSVGElement>) => {
    if (active.current?.pointer !== event.pointerId) return;
    active.current = null;
    onParticipate?.();
  };
  return <div className="dm-drawing">
    <p className="dm-drawing__note">여기에 손가락이나 펜으로 연습해요. 자를 쓰는 문제는 종이에 그린 뒤 확인해 주세요. 그림은 이 화면에만 남고 자동 채점하지 않아요.</p>
    <div className="dm-drawing__tools">
      <button className="dm-btn" type="button" aria-pressed={drawing} onClick={() => { setDrawing(!drawing); active.current = null; }}>{drawing ? '그리기 마치고 스크롤' : '그리기 시작'}</button>
      <button className="dm-btn" type="button" disabled={!strokes.length} onClick={() => { active.current = null; setStrokes(current => current.slice(0, -1)); }}>한 획 되돌리기</button>
      <button className="dm-btn" type="button" disabled={!strokes.length && !paper} onClick={() => { active.current = null; setStrokes([]); setPaper(false); }}>모두 지우기</button>
      <button className="dm-btn" type="button" aria-pressed={paper} onClick={() => { setPaper(true); setDrawing(false); active.current = null; onParticipate?.(); }}>종이에 그렸어요</button>
    </div>
    <svg viewBox="0 0 600 240" role="img" aria-label={number + '번 그리기 영역'} className="dm-drawing__surface" style={{ touchAction: drawing ? 'none' : 'pan-y' }}
      onPointerDown={event => {
        if (!drawing || event.button !== 0 || active.current) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        active.current = { pointer: event.pointerId, index: strokes.length };
        const start = point(event);
        setStrokes(current => [...current, [start]]);
      }}
      onPointerMove={event => {
        const currentStroke = active.current;
        if (!currentStroke || currentStroke.pointer !== event.pointerId) return;
        const next = point(event);
        setStrokes(current => current.map((stroke, index) => index === currentStroke.index ? [...stroke, next] : stroke));
      }} onPointerUp={finish} onPointerCancel={finish}>
      {strokes.map((stroke, index) => stroke.length === 1
        ? <circle key={index} cx={stroke[0]![0]} cy={stroke[0]![1]} r="2" fill="currentColor" />
        : <polyline key={index} points={stroke.map(p => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
    <input type="hidden" name={name} data-answer-number={number} value={strokes.length ? 'screen-drawing' : paper ? 'paper-drawing' : ''} readOnly />
    <p className="dm-drawing__status" role="status">{paper ? '종이에 그린 답은 선생님과 함께 살펴봐요.' : drawing ? '지금은 그릴 수 있어요. 끝나면 위 버튼으로 스크롤을 켜요.' : '그리기 시작을 누르거나 종이에 그려도 좋아요.'}</p>
  </div>;
}
