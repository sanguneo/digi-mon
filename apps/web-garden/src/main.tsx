import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import type { Subject, Worksheet } from './api.ts';
import { Diagnostic } from './diagnostic.tsx';
import { GameProvider, useGame } from './game-context.tsx';
import { GardenRoom } from './garden.tsx';
import { GardenSummary } from './garden-summary.tsx';
import { ProblemStudio } from './problem-studio.tsx';
import './styles.css';
import './worksheet-layout.css';

type LearningView = 'studio' | 'diagnostic';
type AppView = LearningView | 'garden';

function hashView(): AppView {
  if (window.location.hash === '#garden') return 'garden';
  if (window.location.hash === '#diagnostic') return 'diagnostic';
  return 'studio';
}

function App() {
  const { selectSubject } = useGame();
  const [view, setView] = useState<AppView>(hashView);
  const [lastLearningView, setLastLearningView] = useState<LearningView>(() => hashView() === 'diagnostic' ? 'diagnostic' : 'studio');
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [rewardHandoff, setRewardHandoff] = useState(false);
  const [subjectRequest, setSubjectRequest] = useState<{ subject: Subject; revision: number } | null>(null);

  useEffect(() => {
    const updateFromHash = () => {
      const next = hashView();
      if (next !== 'garden' && next !== lastLearningView) {
        setLastLearningView(next);
        setWorksheet(null);
      }
      setView(next);
    };
    window.addEventListener('hashchange', updateFromHash);
    return () => window.removeEventListener('hashchange', updateFromHash);
  }, [lastLearningView]);

  const navigate = (next: AppView, fromReward = false) => {
    if (next !== 'garden' && next !== lastLearningView) {
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
            <small>배움으로 자라는 세 세상</small>
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
            세상 둘러보기
          </button>
        </nav>
      </header>

      {view === 'garden' ? (
        <GardenRoom
          onLearn={(subject) => {
            if (subject) setSubjectRequest((current) => ({ subject, revision: (current?.revision ?? 0) + 1 }));
            navigate(lastLearningView);
          }}
          preselectReward={rewardHandoff}
        />
      ) : null}
        <main id="learning-view" hidden={view === 'garden'} tabIndex={-1}>
          <section className="garden-hero">
            <div className="garden-hero__copy">
              <p className="dm-kicker">배움이 자라는 나만의 공간</p>
              <h1>한 문제씩,<br /><span>세 세상이 자라요!</span></h1>
              <p>
                국어는 초록 정원, 영어는 물속 수족관, 수학은 강아지 마당.
                한 문제씩 해 보며 과목마다 다른 친구를 돌봐요.
              </p>
              <div className="garden-hero__chips">
                <span>국어 · 정원</span>
                <span>영어 · 수족관</span>
                <span>수학 · 강아지 마당</span>
              </div>
            </div>
            <div className="garden-hero__scene" aria-hidden="true">
              <span className="garden-hero__sun">☀️</span>
              <span className="garden-hero__tree">🌳</span>
              <span className="garden-hero__flower">🐠</span>
              <span className="garden-hero__snail">🐶</span>
              <span className="garden-hero__path">•••••</span>
            </div>
          </section>

          <GardenSummary onOpenGarden={() => navigate('garden', true)} />

          <ProblemStudio
            key={lastLearningView}
            mode={lastLearningView === 'diagnostic' ? 'diagnostic' : 'worksheet'}
            onWorksheet={setWorksheet}
            onSubjectChange={selectSubject}
            subjectRequest={subjectRequest}
          />

          {lastLearningView === 'diagnostic' && worksheet ? <Diagnostic key={worksheet.fingerprint} worksheet={worksheet} /> : null}
        </main>

      <footer className="garden-footer">
        <span>2022 개정 초등 국어 · 수학 · 영어</span>
        <span>이름과 답은 저장하지 않고, 이 기기에 돌본 걸음만 남겨요</span>
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
