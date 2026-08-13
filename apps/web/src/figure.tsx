import { useEffect, useRef } from 'react';

import type { Figure as FigureData } from './api.ts';

interface FigureProps {
  figure: FigureData;
}

export function Figure({ figure }: FigureProps) {
  const canvas = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!figure.svg || !canvas.current) return;
    const parsed = new DOMParser().parseFromString(figure.svg, 'text/html');
    const svg = parsed.querySelector('svg');
    if (!svg) return;
    canvas.current.replaceChildren(window.document.importNode(svg, true));
  }, [figure.svg]);

  if (!figure.svg) {
    return (
      <aside className="dm-figure-fallback" aria-label="그림 대체 안내">
        <span className="dm-badge">그림 없음 · 종이 학습지로</span>
        <p>{figure.altText}</p>
      </aside>
    );
  }

  return (
    <figure className="dm-figure">
      <div className="dm-figure__canvas" ref={canvas} />
      {figure.access === 'requires-visual' && figure.accommodation ? (
        <figcaption className="dm-note dm-note--warn">
          <strong>시각 자료 준비 필요</strong>
          <span>{figure.accommodation}</span>
        </figcaption>
      ) : null}
    </figure>
  );
}
