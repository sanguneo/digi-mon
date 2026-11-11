import { useState } from 'react';

import type { Worksheet } from './api.ts';
import { Diagnostic } from './diagnostic.tsx';
import { ProblemStudio } from './problem-studio.tsx';
import { ReviewAdmin } from './review-admin.tsx';

type View = 'studio' | 'diagnostic' | 'review';

export function App() {
  const [view, setView] = useState<View>('studio');
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  // 한 번 연 검토 화면은 다른 탭에 가도 내리지 않는다. 내리면 저장 안 한 수정이 사라진다.
  const [reviewMounted, setReviewMounted] = useState(false);

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
          <button
            aria-current={view === 'review' ? 'page' : undefined}
            className="dm-nav-button"
            onClick={() => {
              setView('review');
              setReviewMounted(true);
              setWorksheet(null);
            }}
            type="button"
          >
            문항 검토
          </button>
        </nav>
      </header>

      <main>
        {reviewMounted ? <div hidden={view !== 'review'}><ReviewAdmin /></div> : null}
        {view === 'review' ? null : (
          <>
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
              <Diagnostic key={worksheet.fingerprint} worksheet={worksheet} />
            ) : null}
          </>
        )}
      </main>

      <footer className="dm-footer">
        <span>2022 개정 초등 국어 · 수학 · 영어</span>
        <span>이름과 계정 없이, 세션 안에서만</span>
      </footer>
    </div>
  );
}
