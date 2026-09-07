import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { Subject } from './api.ts';
import { growthStage, type WorldState } from './game-state.ts';
import { WORLDS, type CareEvent } from './garden-worlds.ts';
import type { CameraAction, WorldRenderer } from './garden-renderer.ts';

const CAMERA_BUTTONS: readonly [CameraAction, string][] = [
  ['left', '왼쪽 보기'], ['right', '오른쪽 보기'], ['up', '위에서 보기'],
  ['down', '낮게 보기'], ['in', '가까이'], ['out', '멀리'], ['home', '처음 시점'],
];

export function GardenScene({ subject, world, careEvent = null, children }: { subject: Subject; world: WorldState; careEvent?: CareEvent | null; children?: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<WorldRenderer | null>(null);
  const consumedCare = useRef(careEvent?.id ?? 0);
  const latestCare = useRef(careEvent);
  latestCare.current = careEvent;
  const latestWorld = useRef(world);
  latestWorld.current = world;
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [retry, setRetry] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [paused, setPaused] = useState(false);
  const [gestures, setGestures] = useState(false);
  const definition = WORLDS[subject];
  const stage = growthStage(world);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Subject changes and GPU retries are fresh views, never playback commands.
    consumedCare.current = latestCare.current?.id ?? 0;
    setStatus('loading');
    setGestures(false);
    const canvas = canvasRef.current!;
    import('./garden-renderer.ts').then(({ createWorldRenderer }) => {
      if (cancelled) return;
      const runtime = createWorldRenderer(canvas, subject, latestWorld.current, () => {
        setStatus('unavailable');
        runtimeRef.current?.dispose();
        runtimeRef.current = null;
        setGestures(false);
      });
      runtimeRef.current = runtime;
      setStatus('ready');
    }).catch((error: unknown) => {
      if (cancelled) return;
      console.warn('3D world renderer unavailable:', error);
      setStatus('unavailable');
    });
    return () => {
      cancelled = true;
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
    };
  }, [subject, retry]);

  useEffect(() => { runtimeRef.current?.update(world); }, [world]);
  useEffect(() => { runtimeRef.current?.setMotion(!paused && !reducedMotion); }, [paused, reducedMotion, status]);
  useEffect(() => { runtimeRef.current?.setGestures(gestures); }, [gestures, status]);
  useEffect(() => {
    if (!careEvent || careEvent.id <= consumedCare.current) return;
    consumedCare.current = careEvent.id;
    if (careEvent.subject === subject) runtimeRef.current?.care(careEvent);
  }, [careEvent, subject]);

  return (
    <section className="world-scene" aria-label={`${definition.name} 3D 풍경`} data-subject={subject} data-status={status}>
      <div className="world-scene__viewport">
        <canvas
          key={`${subject}:${retry}`}
          ref={canvasRef}
          className="world-scene__canvas"
          aria-label={`${definition.companion}: ${definition.stages[stage]}. 아래 버튼으로 시점을 바꿀 수 있어요.`}
          role="img"
          hidden={status === 'unavailable'}
        />
        <div className="world-scene__caption" aria-hidden="true">
          <span>{definition.subjectName}의 작은 세상</span>
          <strong>{definition.companion} · {definition.stages[stage]}</strong>
        </div>
        {status === 'loading' ? <p className="world-scene__loading" role="status">작은 세상을 열고 있어요…</p> : null}
        {status === 'unavailable' ? (
          <div className="world-scene__fallback" role="status">
            <span aria-hidden="true">{definition.art}</span>
            <h3>3D 풍경을 열 수 없어요</h3>
            <p>{definition.companion}는 {definition.stages[stage]} 모습이에요. 아래에서 똑같이 돌보고 장식을 놓을 수 있어요. 모은 것은 그대로예요.</p>
            <button className="dm-btn" type="button" onClick={() => setRetry((value) => value + 1)}>3D 다시 열기</button>
          </div>
        ) : null}
      </div>
      {children}
      <details className="world-camera" onToggle={(event) => { if (!event.currentTarget.open) setGestures(false); }}>
        <summary>시점과 움직임 조절</summary>
        <div className="world-camera__buttons">
          {CAMERA_BUTTONS.map(([action, label]) => (
            <button className="dm-btn dm-btn--quiet" type="button" key={action} disabled={status !== 'ready'} onClick={() => runtimeRef.current?.camera(action)}>{label}</button>
          ))}
        </div>
        <div className="world-camera__options">
          <button className="dm-btn dm-btn--quiet" type="button" disabled={status !== 'ready'} aria-pressed={gestures} onClick={() => setGestures((value) => !value)}>
            {gestures ? '손으로 둘러보기 끄기' : '손으로 둘러보기 켜기'}
          </button>
          <button className="dm-btn dm-btn--quiet" type="button" disabled={status !== 'ready' || reducedMotion} aria-pressed={paused || reducedMotion} onClick={() => setPaused((value) => !value)}>
            {paused || reducedMotion ? '움직임 멈춤' : '움직임 멈추기'}
          </button>
        </div>
        <p>{gestures ? '한 손가락으로 돌리고, 두 손가락으로 가까이 봐요. 위 버튼을 끄면 다시 페이지가 스크롤돼요.' : '풍경 위에서도 위아래로 스크롤할 수 있어요. 시점은 위 버튼으로 바꿔요.'}</p>
        {reducedMotion ? <p>기기의 움직임 줄이기 설정을 따르고 있어요.</p> : null}
      </details>
    </section>
  );
}
