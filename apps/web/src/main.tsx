import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

import type { Worksheet } from './api.ts';
import { Diagnostic } from './diagnostic.tsx';
import { ProblemStudio } from './problem-studio.tsx';
import './styles.css';

type View = 'studio' | 'diagnostic';

function App() {
  const [view, setView] = useState<View>('studio');
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);

  return (
    <div className="dm-app">
      <header className="dm-topbar">
        <a className="dm-brand" href="/" aria-label="digi-mon 홈">
          <span className="dm-brand__mark">dm</span>
          <span>
            <strong>digi-mon</strong>
            <small>초등 학습 설계실</small>
          </span>
        </a>
        <nav aria-label="주요 메뉴">
          <button
            aria-current={view === 'studio' ? 'page' : undefined}
            className="dm-nav-button"
            onClick={() => {
              setView('studio');
              setWorksheet(null);
            }}
            type="button"
          >
            문제 만들기
          </button>
          <button
            aria-current={view === 'diagnostic' ? 'page' : undefined}
            className="dm-nav-button"
            onClick={() => {
              setView('diagnostic');
              setWorksheet(null);
            }}
            type="button"
          >
            진단평가
          </button>
        </nav>
      </header>

      <main>
        <section className="dm-hero">
          <div>
            <p className="dm-kicker">DREAM · MEASURE · MOVE</p>
            <h1>오늘의 배움을<br />설계하세요</h1>
          </div>
          <p className="dm-hero__copy">
            문제는 무작위로 쌓지 않습니다. 교육과정, 난이도, 진단 근거를 잇고
            다음 한 걸음까지 분명하게 보여 줍니다.
          </p>
        </section>

        <ProblemStudio
          key={view}
          mode={view === 'diagnostic' ? 'diagnostic' : 'worksheet'}
          onWorksheet={setWorksheet}
        />

        {view === 'diagnostic' && worksheet ? (
          <Diagnostic worksheet={worksheet} />
        ) : null}
      </main>

      <footer className="dm-footer">
        <span>2022 개정 초등 국어 · 수학 · 영어</span>
        <span>이름과 계정 없이, 세션 안에서만</span>
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
    <App />
  </StrictMode>,
);
