/**
 * figure.spec -> SVG 디스패치.
 * 공통 헬퍼는 svg-base.mjs, 3~4학년 기하 도해는 figure-geometry34.mjs 에 있다.
 */
import {
  DEFAULT_ROTATION,
  REGULAR_SIDES,
  SVG_STYLE as STYLE,
  VERTEX_LABELS,
  polygonPoints,
  round,
  svgRoot,
  svgText as text,
} from './svg-base.mjs';
import {
  renderAngle,
  renderAngleRow,
  renderCircle,
  renderLine,
  renderPolygonDiagonals,
  renderTransform,
  renderQuadrilateral,
  renderBarGraph,
  renderTriangle,
} from './figure-geometry34.mjs';

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
  // 물건 막대의 양 끝이 눈금과 정확히 맞아야 문항이 성립한다.
  // 막대 위에 별도 지시선을 덧그리면 어느 쪽을 읽어야 하는지 흐려지므로 두지 않는다.
  parts.push(
    `<rect x="${round(x0)}" y="${top - 26}" width="${round(x1 - x0)}" height="16" rx="3" fill="#e8eaed" stroke="${STYLE.stroke}" stroke-width="1.5"/>`,
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

// ---------------------------------------------------------------------------
// geometry.solid-shape — 입체도형의 모양 [2수03-01], 쌓기나무 [2수03-02]
// ---------------------------------------------------------------------------

/** 등각 투상으로 직육면체를 그린다. 앞면·윗면·옆면이 모두 보여야 입체로 읽힌다. */
function isoBox(x, y, w, h, d) {
  const front = `${x},${y} ${x + w},${y} ${x + w},${y + h} ${x},${y + h}`;
  const top = `${x},${y} ${x + d},${y - d} ${x + w + d},${y - d} ${x + w},${y}`;
  const side = `${x + w},${y} ${x + w + d},${y - d} ${x + w + d},${y + h - d} ${x + w},${y + h}`;
  return [
    `<polygon points="${top}" fill="#f1f3f4" stroke="${STYLE.stroke}" stroke-width="1.8"/>`,
    `<polygon points="${side}" fill="#e3e6e8" stroke="${STYLE.stroke}" stroke-width="1.8"/>`,
    `<polygon points="${front}" fill="#fafafa" stroke="${STYLE.stroke}" stroke-width="1.8"/>`,
  ].join('');
}

function isoCylinder(cx, cy, rx, height) {
  const ry = rx * 0.34;
  return [
    `<path d="M ${cx - rx} ${cy - height / 2} L ${cx - rx} ${cy + height / 2} A ${rx} ${ry} 0 0 0 ${cx + rx} ${cy + height / 2} L ${cx + rx} ${cy - height / 2} Z" fill="#fafafa" stroke="${STYLE.stroke}" stroke-width="1.8"/>`,
    `<ellipse cx="${cx}" cy="${round(cy - height / 2)}" rx="${rx}" ry="${round(ry)}" fill="#f1f3f4" stroke="${STYLE.stroke}" stroke-width="1.8"/>`,
  ].join('');
}

function isoSphere(cx, cy, r) {
  return [
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fafafa" stroke="${STYLE.stroke}" stroke-width="1.8"/>`,
    `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${round(r * 0.32)}" fill="none" stroke="${STYLE.light}" stroke-width="1.2" stroke-dasharray="3 3"/>`,
  ].join('');
}

/**
 * 직육면체는 가로로 길게 그린다.
 *
 * 정육면체를 여기 두지 않는다. 정육면체는 직육면체의 특수한 경우여서 둘을 같은
 * 선택지에 넣으면 '직육면체는 어느 것인가'의 정답이 둘이 된다. 게다가 [2수03-01]이
 * 다루는 입체는 직육면체·원기둥·구뿐이고 정육면체는 이 학년군 범위가 아니다.
 */
const SOLID_DRAW = {
  cuboid: (cx, cy) => isoBox(cx - 30, cy - 8, 56, 32, 14),
  cylinder: (cx, cy) => isoCylinder(cx, cy + 2, 22, 46),
  sphere: (cx, cy) => isoSphere(cx, cy + 2, 26),
};

/** 입체도형 여러 개를 한 줄로. '원기둥은 어느 것인가' 선택 문항용. */
function renderSolidShape({ solids }, altText) {
  const cell = 110;
  const parts = [];
  solids.forEach((solid, idx) => {
    const draw = SOLID_DRAW[solid];
    if (!draw) throw new Error(`알 수 없는 입체도형: ${solid}`);
    const cx = cell * idx + cell / 2;
    parts.push(draw(cx, cell / 2 + 4));
    parts.push(text(cx, cell + 14, ['㉠', '㉡', '㉢', '㉣', '㉤'][idx], { size: 15, weight: '600' }));
  });
  return svgRoot(cell * solids.length, cell + 24, parts.join(''), altText);
}

/**
 * 쌓기나무. 층별 개수를 받아 아래에서 위로 쌓는다.
 * layers[0] 이 맨 아래 층이며 각 층은 앞줄에 나란히 놓인 개수다.
 */
function renderStackedCubes({ layers }, altText) {
  const unit = 26;
  const depth = 9;
  const maxWidth = Math.max(...layers);
  const width = maxWidth * unit + depth + 24;
  const height = layers.length * unit + depth + 24;
  const parts = [];

  // 아래 층부터 그리면 위 층이 나중에 그려져 겹침이 자연스럽다.
  layers.forEach((count, level) => {
    const y = height - 14 - (level + 1) * unit;
    for (let k = 0; k < count; k += 1) {
      parts.push(isoBox(12 + k * unit, y, unit - 2, unit - 2, depth));
    }
  });
  return svgRoot(width, height, parts.join(''), altText);
}

// ---------------------------------------------------------------------------
// data.table / data.picture-graph — 자료의 정리 [2수04-01~03]
// ---------------------------------------------------------------------------

/** 분류 결과 표. 헤더 1행 + 값 1행. */
function renderDataTable({ headers, values, headerLabel, valueLabel }, altText) {
  const colWidth = 74;
  const labelWidth = headerLabel ? 76 : 0;
  const rowHeight = 32;
  const width = labelWidth + headers.length * colWidth + 2;
  const height = rowHeight * 2 + 2;
  const parts = [];

  const cell = (x, y, w, h, content, opts = {}) => {
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${opts.shaded ? '#f1f3f4' : '#ffffff'}" stroke="${STYLE.stroke}" stroke-width="1.2"/>`);
    parts.push(text(x + w / 2, y + h / 2 + 5, content, { size: 13, weight: opts.shaded ? '600' : 'normal' }));
  };

  if (headerLabel) {
    cell(1, 1, labelWidth, rowHeight, headerLabel, { shaded: true });
    cell(1, 1 + rowHeight, labelWidth, rowHeight, valueLabel ?? '', { shaded: true });
  }
  headers.forEach((h, idx) => {
    const x = 1 + labelWidth + idx * colWidth;
    cell(x, 1, colWidth, rowHeight, String(h), { shaded: true });
    cell(x, 1 + rowHeight, colWidth, rowHeight, String(values[idx]), {});
  });
  return svgRoot(width, height, parts.join(''), altText);
}

/** ○ 그림그래프. 세로축이 개수, 가로축이 항목이다. */
function renderPictureGraph({ categories, counts, mark = '○' }, altText) {
  const colWidth = 62;
  const cellHeight = 22;
  const maxCount = Math.max(...counts, 1);
  const axisWidth = 26;
  const width = axisWidth + categories.length * colWidth + 8;
  const height = maxCount * cellHeight + 40;
  const parts = [];

  for (let level = 1; level <= maxCount; level += 1) {
    const y = height - 30 - (level - 1) * cellHeight;
    parts.push(text(axisWidth - 8, y - cellHeight / 2 + 5, String(level), { size: 11, anchor: 'end' }));
  }
  parts.push(`<line x1="${axisWidth}" y1="8" x2="${axisWidth}" y2="${height - 28}" stroke="${STYLE.stroke}" stroke-width="1.4"/>`);
  parts.push(`<line x1="${axisWidth}" y1="${height - 28}" x2="${width - 4}" y2="${height - 28}" stroke="${STYLE.stroke}" stroke-width="1.4"/>`);

  categories.forEach((category, idx) => {
    const cx = axisWidth + idx * colWidth + colWidth / 2;
    for (let k = 0; k < counts[idx]; k += 1) {
      const y = height - 30 - k * cellHeight;
      parts.push(text(cx, y - cellHeight / 2 + 6, mark, { size: 16 }));
    }
    parts.push(text(cx, height - 10, String(category), { size: 12 }));
  });
  return svgRoot(width, height, parts.join(''), altText);
}

const RENDERERS = {
  'measure.clock': renderClock,
  'geometry.plane-shape': (spec, alt) => (spec.shapes ? renderShapeRow(spec, alt) : renderPlaneShape(spec, alt)),
  'measure.length': renderRuler,
  'array.bundles': renderBundles,
  'geometry.solid-shape': (spec, alt) => (spec.layers ? renderStackedCubes(spec, alt) : renderSolidShape(spec, alt)),
  'data.table': renderDataTable,
  'data.picture-graph': renderPictureGraph,
  // 3~4학년 기하. spec 의 모양으로 하위 렌더러를 고른다.
  'geometry.angle': (spec, alt) => (spec.angles ? renderAngleRow(spec, alt) : renderAngle(spec, alt)),
  'geometry.line': renderLine,
  'geometry.circle': renderCircle,
  'geometry.triangle': renderTriangle,
  'geometry.grid-area': renderPolygonDiagonals,
  'geometry.symmetry': renderTransform,
  'geometry.quadrilateral': renderQuadrilateral,
  'data.bar-graph': renderBarGraph,
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
