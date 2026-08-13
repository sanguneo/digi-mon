import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import type { Worksheet } from './api.ts';
import { Diagnostic } from './diagnostic.tsx';
import { GameProvider } from './game-context.tsx';
import { GardenRoom } from './garden.tsx';
import { GardenSummary } from './garden-summary.tsx';
import { ProblemStudio } from './problem-studio.tsx';
import './styles.css';

type LearningView = 'studio' | 'diagnostic';
type AppView = LearningView | 'garden';

function hashView(): AppView {
  if (window.location.hash === '#garden') return 'garden';
  if (window.location.hash === '#diagnostic') return 'diagnostic';
  return 'studio';
}

function App() {
  const [view, setView] = useState<AppView>(hashView);
  const [lastLearningView, setLastLearningView] = useState<LearningView>('studio');
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [rewardHandoff, setRewardHandoff] = useState(false);

  useEffect(() => {
    const updateFromHash = () => setView(hashView());
    window.addEventListener('hashchange', updateFromHash);
    return () => window.removeEventListener('hashchange', updateFromHash);
  }, []);

  const navigate = (next: AppView, fromReward = false) => {
    if (next !== 'garden') {
      setLastLearningView(next);
      setWorksheet(null);
    }
    setRewardHandoff(fromReward);
    const hash = next === 'studio' ? '' : `#${next}`;
    window.history.pushState(null, '', `${window.location.pathname}${hash}`);
    setView(next);
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(next === 'garden' ? '#garden-view' : '#learning-view')?.focus();
    });
  };

  return (
    <div className="garden-app">
      <header className="garden-topbar">
        <button className="garden-brand" onClick={() => navigate('studio')} type="button">
          <span className="garden-brand__mascot" aria-hidden="true">🌱</span>
          <span>
            <strong>digi-mon</strong>
            <small>오늘의 작은 정원</small>
          </span>
        </button>
        <nav aria-label="주요 메뉴">
          <button
            aria-current={view === 'studio' ? 'page' : undefined}
            onClick={() => navigate('studio')}
            type="button"
          >
            문제 만들기
          </button>
          <button
            aria-current={view === 'diagnostic' ? 'page' : undefined}
            onClick={() => navigate('diagnostic')}
            type="button"
          >
            진단평가
          </button>
          <button
            aria-current={view === 'garden' ? 'page' : undefined}
            onClick={() => navigate('garden')}
            type="button"
          >
            정원 보기
          </button>
        </nav>
      </header>

      {view === 'garden' ? (
        <GardenRoom
          onLearn={() => navigate(lastLearningView)}
          preselectReward={rewardHandoff}
        />
      ) : (
        <main id="learning-view" tabIndex={-1}>
          <section className="garden-hero">
            <div className="garden-hero__copy">
              <p className="dm-kicker">배움이 자라는 나만의 공간</p>
              <h1>한 문제씩,<br /><span>정원이 자라요!</span></h1>
              <p>
                문제를 해 본 걸음마다 작은 씨앗이 자라요.
                세 걸음을 채우면 정원에서 새로운 친구를 놓을 수 있어요.
              </p>
              <div className="garden-hero__chips">
                <span>정답보다 도전</span>
                <span>천천히 해도 괜찮아</span>
                <span>내 마음대로 꾸미기</span>
              </div>
            </div>
            <div className="garden-hero__scene" aria-hidden="true">
              <span className="garden-hero__sun">☀️</span>
              <span className="garden-hero__tree">🌳</span>
              <span className="garden-hero__flower">🌼</span>
              <span className="garden-hero__snail">🐌</span>
              <span className="garden-hero__path">•••••</span>
            </div>
          </section>

          <GardenSummary onOpenGarden={() => navigate('garden', true)} />

          <ProblemStudio
            key={view}
            mode={view === 'diagnostic' ? 'diagnostic' : 'worksheet'}
            onWorksheet={setWorksheet}
          />

          {view === 'diagnostic' && worksheet ? <Diagnostic worksheet={worksheet} /> : null}
        </main>
      )}

      <footer className="garden-footer">
        <span>2022 개정 초등 국어 · 수학 · 영어</span>
        <span>이름 없이, 이 기기의 작은 정원에만 저장해요</span>
      </footer>
    </div>
  );
}

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) {
  throw new Error('root element가 없다');
}

createRoot(root).render(
  <StrictMode>
    <GameProvider>
      <App />
    </GameProvider>
  </StrictMode>,
);
