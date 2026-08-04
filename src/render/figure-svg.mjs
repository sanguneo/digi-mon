/**
 * figure.spec -> SVG. 결정적으로 그린다.
 *
 * 왜 이미지 생성 모델을 쓰지 않는가:
 * 수학 도형은 각도 47도가 정확히 47도여야 하고, 모눈은 칸이 정확히 세어져야 하며,
 * 시계는 정확히 그 시각을 가리켜야 한다. 확률적 렌더는 문항을 오답으로 만든다.
 * 삽화·표지·캐릭터는 이미지 모델의 몫이고, 도해는 여기 몫이다.
 */

const VERTEX_LABELS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ'];

const STYLE = {
  stroke: '#111111',
  light: '#9aa0a6',
  fill: 'none',
  font: 'system-ui, -apple-system, "Malgun Gothic", sans-serif',
};

function svgRoot(width, height, body, altText) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"`,
    ` role="img" aria-label="${escapeXml(altText)}">`,
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`,
    body,
    '</svg>',
  ].join('');
}

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
}

function text(x, y, content, { size = 13, anchor = 'middle', weight = 'normal' } = {}) {
  return `<text x="${round(x)}" y="${round(y)}" font-family="${STYLE.font}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${STYLE.stroke}">${escapeXml(content)}</text>`;
}

const round = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// measure.clock — 시각과 시간 [2수03-07]
// ---------------------------------------------------------------------------

/**
 * 시침·분침 각도는 계산으로 못 박는다.
 * 분침 = 분 × 6도, 시침 = (시 % 12) × 30도 + 분 × 0.5도.
 * 3시 20분의 시침이 3과 4 사이 1/3 지점에 오는 것까지 정확하다.
 */
function renderClock({ hour, minute }, altText) {
  const size = 150;
  const c = size / 2;
  const r = 64;
  const parts = [`<circle cx="${c}" cy="${c}" r="${r}" fill="#ffffff" stroke="${STYLE.stroke}" stroke-width="2.5"/>`];

  for (let tick = 0; tick < 60; tick += 1) {
    const angle = (tick * 6 * Math.PI) / 180;
    const isHour = tick % 5 === 0;
    const inner = r - (isHour ? 9 : 4);
    parts.push(
      `<line x1="${round(c + inner * Math.sin(angle))}" y1="${round(c - inner * Math.cos(angle))}"`
      + ` x2="${round(c + r * Math.sin(angle))}" y2="${round(c - r * Math.cos(angle))}"`
      + ` stroke="${isHour ? STYLE.stroke : STYLE.light}" stroke-width="${isHour ? 2 : 1}"/>`,
    );
  }

  for (let n = 1; n <= 12; n += 1) {
    const angle = (n * 30 * Math.PI) / 180;
    const rr = r - 21;
    parts.push(text(c + rr * Math.sin(angle), c - rr * Math.cos(angle) + 5, String(n), { size: 14, weight: '600' }));
  }

  const minuteAngle = (minute * 6 * Math.PI) / 180;
  const hourAngle = (((hour % 12) * 30 + minute * 0.5) * Math.PI) / 180;
  parts.push(
    `<line x1="${c}" y1="${c}" x2="${round(c + 32 * Math.sin(hourAngle))}" y2="${round(c - 32 * Math.cos(hourAngle))}" stroke="${STYLE.stroke}" stroke-width="5" stroke-linecap="round"/>`,
    `<line x1="${c}" y1="${c}" x2="${round(c + 50 * Math.sin(minuteAngle))}" y2="${round(c - 50 * Math.cos(minuteAngle))}" stroke="${STYLE.stroke}" stroke-width="3" stroke-linecap="round"/>`,
    `<circle cx="${c}" cy="${c}" r="3.5" fill="${STYLE.stroke}"/>`,
  );
  return svgRoot(size, size, parts.join(''), altText);
}

// ---------------------------------------------------------------------------
// geometry.plane-shape — 평면도형 [2수03-03~05]
// ---------------------------------------------------------------------------

const REGULAR_SIDES = { triangle: 3, quadrilateral: 4, pentagon: 5, hexagon: 6 };

/**
 * 도형별 기본 회전. 저학년 교재는 도형을 표준 방향으로 싣는다.
 *
 * 정n각형의 첫 꼭짓점을 위로 두면 사각형이 마름모로 서 버린다. 수학적으로는
 * 같은 사각형이지만, 1~2학년에게 사각형을 마름모 방향으로 보여 주면 도형 이름을
 * 방향으로 외우게 만들어 오답을 유발한다. 4각형만 45도 돌려 아래변을 수평으로 둔다.
 */
const DEFAULT_ROTATION = { triangle: 0, quadrilateral: 45, pentagon: 0, hexagon: 0 };

/** 정n각형 꼭짓점. 첫 꼭짓점을 위로 두어 아이가 보는 표준 방향으로 맞춘다. */
function polygonPoints(sides, cx, cy, radius, rotationDeg = 0) {
  return Array.from({ length: sides }, (_, k) => {
    const angle = ((k * 360) / sides - 90 + rotationDeg) * (Math.PI / 180);
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  });
}

function renderPlaneShape({ shape, labelVertices = false, rotationDeg }, altText) {
  const size = 130;
  const c = size / 2;
  const r = 46;
  const parts = [];

  if (shape === 'circle') {
    parts.push(`<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${STYLE.stroke}" stroke-width="2.5"/>`);
  } else {
    const sides = REGULAR_SIDES[shape];
    if (!sides) throw new Error(`알 수 없는 평면도형: ${shape}`);
    const pts = polygonPoints(sides, c, c, r, rotationDeg ?? DEFAULT_ROTATION[shape] ?? 0);
    parts.push(`<polygon points="${pts.map(([x, y]) => `${round(x)},${round(y)}`).join(' ')}" fill="none" stroke="${STYLE.stroke}" stroke-width="2.5"/>`);
    if (labelVertices) {
      pts.forEach(([x, y], idx) => {
        const dx = (x - c) * 0.24;
        const dy = (y - c) * 0.24;
        parts.push(text(x + dx, y + dy + 5, VERTEX_LABELS[idx], { size: 13, weight: '600' }));
      });
    }
  }
  return svgRoot(size, size, parts.join(''), altText);
}

/** 여러 도형을 한 줄로 늘어놓는다. '어느 것이 사각형인가' 같은 선택 문항용. */
function renderShapeRow({ shapes }, altText) {
  const cell = 108;
  const size = { w: cell * shapes.length, h: cell + 22 };
  const r = 38;
  const parts = [];

  shapes.forEach((shape, idx) => {
    const cx = cell * idx + cell / 2;
    const cy = cell / 2 + 6;
    if (shape === 'circle') {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${STYLE.stroke}" stroke-width="2.5"/>`);
    } else {
      const sides = REGULAR_SIDES[shape];
      if (!sides) throw new Error(`알 수 없는 평면도형: ${shape}`);
      const pts = polygonPoints(sides, cx, cy, r, DEFAULT_ROTATION[shape] ?? 0);
      parts.push(`<polygon points="${pts.map(([x, y]) => `${round(x)},${round(y)}`).join(' ')}" fill="none" stroke="${STYLE.stroke}" stroke-width="2.5"/>`);
    }
    parts.push(text(cx, cell + 16, ['㉠', '㉡', '㉢', '㉣', '㉤'][idx], { size: 15, weight: '600' }));
  });
  return svgRoot(size.w, size.h, parts.join(''), altText);
}

// ---------------------------------------------------------------------------
// measure.length — 길이 재기 [2수03-12]
// ---------------------------------------------------------------------------

/** 자와 물건. 1cm = 14px 로 고정하므로 눈금과 물건 길이의 비가 정확하다. */
function renderRuler({ maxCm, objectCm, startCm = 0 }, altText) {
  const unit = 14;
  const left = 18;
  const top = 58;
  const width = left * 2 + maxCm * unit;
  const parts = [
    `<rect x="${left}" y="${top}" width="${maxCm * unit}" height="30" fill="#fdfdfd" stroke="${STYLE.stroke}" stroke-width="1.5"/>`,
  ];

  for (let cm = 0; cm <= maxCm; cm += 1) {
    const x = left + cm * unit;
    parts.push(`<line x1="${x}" y1="${top}" x2="${x}" y2="${top + 12}" stroke="${STYLE.stroke}" stroke-width="1.4"/>`);
    parts.push(text(x, top + 26, String(cm), { size: 10 }));
    if (cm < maxCm) {
      const half = x + unit / 2;
      parts.push(`<line x1="${round(half)}" y1="${top}" x2="${round(half)}" y2="${top + 7}" stroke="${STYLE.light}" stroke-width="1"/>`);
    }
  }

  const x0 = left + startCm * unit;
  const x1 = left + (startCm + objectCm) * unit;
  parts.push(
    `<rect x="${round(x0)}" y="${top - 26}" width="${round(x1 - x0)}" height="15" rx="3" fill="#e8eaed" stroke="${STYLE.stroke}" stroke-width="1.5"/>`,
    `<line x1="${round(x0)}" y1="${top - 34}" x2="${round(x1)}" y2="${top - 34}" stroke="${STYLE.stroke}" stroke-width="1"/>`,
  );
  return svgRoot(width, top + 40, parts.join(''), altText);
}

// ---------------------------------------------------------------------------
// array.bundles — 묶음과 낱개 [2수01-01], 곱셈 배열 [2수01-10]
// ---------------------------------------------------------------------------

function renderBundles({ groups, per }, altText) {
  const dot = 9;
  const gap = 5;
  const padding = 10;
  const groupWidth = per * (dot + gap) + padding;
  const width = groups * (groupWidth + 10) + 10;
  const height = dot + padding * 2 + 16;
  const parts = [];

  for (let g = 0; g < groups; g += 1) {
    const gx = 10 + g * (groupWidth + 10);
    parts.push(`<rect x="${gx}" y="8" width="${round(groupWidth)}" height="${dot + padding * 2}" rx="7" fill="none" stroke="${STYLE.light}" stroke-width="1.4"/>`);
    for (let k = 0; k < per; k += 1) {
      parts.push(`<circle cx="${round(gx + padding / 2 + k * (dot + gap) + dot / 2)}" cy="${8 + padding + dot / 2}" r="${dot / 2}" fill="${STYLE.stroke}"/>`);
    }
  }
  return svgRoot(width, height, parts.join(''), altText);
}

const RENDERERS = {
  'measure.clock': renderClock,
  'geometry.plane-shape': (spec, alt) => (spec.shapes ? renderShapeRow(spec, alt) : renderPlaneShape(spec, alt)),
  'measure.length': renderRuler,
  'array.bundles': renderBundles,
};

/** figure 를 SVG 문자열로 만든다. 렌더러가 없는 kind 는 조용히 넘기지 않고 던진다. */
export function renderFigureSvg(figure) {
  const renderer = RENDERERS[figure.kind];
  if (!renderer) throw new Error(`SVG 렌더러가 없는 figure.kind: ${figure.kind}`);
  return renderer(figure.spec, figure.altText);
}

export function hasSvgRenderer(kind) {
  return Object.hasOwn(RENDERERS, kind);
}
