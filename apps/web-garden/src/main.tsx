import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import type { Subject, Worksheet } from './api.ts';
import { Diagnostic } from './diagnostic.tsx';
import { GameProvider, useGame } from './game-context.tsx';
import { GardenRoom } from './garden.tsx';
import { GardenSummary } from './garden-summary.tsx';
import { ProblemStudio } from './problem-studio.tsx';
import { StudioWelcome } from './studio-welcome.tsx';
import { SubjectMark } from './subject-mark.tsx';
import './styles.css';
import './worksheet-layout.css';
import './studio.css';

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
  const [attempt, setAttempt] = useState(0);
  const [studySubject, setStudySubject] = useState<Subject>('math');
  const chooseStudySubject = useCallback((subject: Subject) => {
    setStudySubject(subject);
    selectSubject(subject);
  }, [selectSubject]);
  const [rewardHandoff, setRewardHandoff] = useState(false);
  const [subjectRequest, setSubjectRequest] = useState<{ subject: Subject; revision: number } | null>(null);

  useEffect(() => {
    // A direct garden visit keeps its saved world; learning shows its selected subject.
    if (view !== 'garden') selectSubject(studySubject);
  }, [view, studySubject, selectSubject]);

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
          <span className="garden-brand__mascot" aria-hidden="true"><SubjectMark subject="korean" /></span>
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
          <StudioWelcome />

          <ProblemStudio
            key={lastLearningView}
            mode={lastLearningView === 'diagnostic' ? 'diagnostic' : 'worksheet'}
            onWorksheet={(issued) => { setWorksheet(issued); setAttempt((current) => current + 1); }}
            onSubjectChange={chooseStudySubject}
            subjectRequest={subjectRequest}
          />

          {lastLearningView === 'diagnostic' && worksheet ? <Diagnostic key={attempt} worksheet={worksheet} /> : null}
          <GardenSummary onOpenGarden={() => navigate('garden', true)} />
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
