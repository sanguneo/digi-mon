/**
 * 3~4학년 기하 도해. 각도·직선·원·삼각형·다각형·평면도형의 이동.
 *
 * 각도 문항은 그림의 각이 문제의 각과 정확히 같아야 한다. 이미지 생성 모델로는
 * 47도를 47도로 그릴 수 없으므로 삼각함수로 좌표를 계산한다.
 */
import { SVG_STYLE, VERTEX_LABELS, polygonPoints, round, svgRoot, svgText } from './svg-base.mjs';

const toRad = (deg) => (deg * Math.PI) / 180;
const MARKS = ['㉠', '㉡', '㉢', '㉣', '㉤'];

// ---------------------------------------------------------------------------
// geometry.angle — 각과 직각 [4수03-02], 각도 [4수03-24~25]
// ---------------------------------------------------------------------------

/**
 * 한 변을 수평 기준선으로 두어 아이가 각도기를 놓는 방향과 맞춘다.
 * rotate 로 기준선을 기울여 같은 각도라도 다른 문항으로 보이게 한다.
 */
export function renderAngle({ degrees, showArc = true, label = null, rotate = 0 }, altText) {
  const size = 168;
  const vx = 34;
  const vy = size - 46;
  const armLength = 110;

  const baseAngle = -rotate;
  const openAngle = -(rotate + degrees);
  const arm = (deg) => [vx + armLength * Math.cos(toRad(deg)), vy + armLength * Math.sin(toRad(deg))];
  const p1 = arm(baseAngle);
  const p2 = arm(openAngle);

  const parts = [
    `<line x1="${vx}" y1="${vy}" x2="${round(p1[0])}" y2="${round(p1[1])}" stroke="${SVG_STYLE.stroke}" stroke-width="2.2"/>`,
    `<line x1="${vx}" y1="${vy}" x2="${round(p2[0])}" y2="${round(p2[1])}" stroke="${SVG_STYLE.stroke}" stroke-width="2.2"/>`,
  ];

  if (showArc) {
    if (degrees === 90) {
      // 직각은 호가 아니라 작은 네모로 표시한다. 교과서 표기와 같다.
      const r = 16;
      const a = [vx + r * Math.cos(toRad(baseAngle)), vy + r * Math.sin(toRad(baseAngle))];
      const b = [vx + r * Math.cos(toRad(openAngle)), vy + r * Math.sin(toRad(openAngle))];
      const corner = [a[0] + (b[0] - vx), a[1] + (b[1] - vy)];
      parts.push(`<polyline points="${round(a[0])},${round(a[1])} ${round(corner[0])},${round(corner[1])} ${round(b[0])},${round(b[1])}" fill="none" stroke="${SVG_STYLE.stroke}" stroke-width="1.6"/>`);
    } else {
      const r = 32;
      const a = [vx + r * Math.cos(toRad(baseAngle)), vy + r * Math.sin(toRad(baseAngle))];
      const b = [vx + r * Math.cos(toRad(openAngle)), vy + r * Math.sin(toRad(openAngle))];
      const largeArc = degrees > 180 ? 1 : 0;
      parts.push(`<path d="M ${round(a[0])} ${round(a[1])} A ${r} ${r} 0 ${largeArc} 0 ${round(b[0])} ${round(b[1])}" fill="none" stroke="${SVG_STYLE.stroke}" stroke-width="1.6"/>`);
    }
  }

  if (label !== null) {
    const mid = toRad(baseAngle - degrees / 2);
    parts.push(svgText(vx + 52 * Math.cos(mid), vy + 52 * Math.sin(mid) + 5, label, { size: 14, weight: '600' }));
  }
  parts.push(`<circle cx="${vx}" cy="${vy}" r="2.6" fill="${SVG_STYLE.stroke}"/>`);
  return svgRoot(size, size, parts.join(''), altText);
}

/** 각 여러 개를 한 줄로. '예각은 어느 것인가' 선택 문항용. */
export function renderAngleRow({ angles }, altText) {
  const cell = 112;
  const parts = [];
  angles.forEach((degrees, idx) => {
    const vx = cell * idx + 16;
    const vy = cell - 24;
    const armLength = 74;
    const arm = (deg) => [vx + armLength * Math.cos(toRad(deg)), vy + armLength * Math.sin(toRad(deg))];
    const p1 = arm(0);
    const p2 = arm(-degrees);
    parts.push(
      `<line x1="${vx}" y1="${vy}" x2="${round(p1[0])}" y2="${round(p1[1])}" stroke="${SVG_STYLE.stroke}" stroke-width="2"/>`,
      `<line x1="${vx}" y1="${vy}" x2="${round(p2[0])}" y2="${round(p2[1])}" stroke="${SVG_STYLE.stroke}" stroke-width="2"/>`,
      `<circle cx="${vx}" cy="${vy}" r="2.4" fill="${SVG_STYLE.stroke}"/>`,
    );
    if (degrees === 90) {
      const r = 13;
      parts.push(`<polyline points="${vx + r},${vy} ${vx + r},${vy - r} ${vx},${vy - r}" fill="none" stroke="${SVG_STYLE.stroke}" stroke-width="1.5"/>`);
    } else {
      const r = 24;
      const a = [vx + r, vy];
      const b = [vx + r * Math.cos(toRad(-degrees)), vy + r * Math.sin(toRad(-degrees))];
      parts.push(`<path d="M ${round(a[0])} ${round(a[1])} A ${r} ${r} 0 0 0 ${round(b[0])} ${round(b[1])}" fill="none" stroke="${SVG_STYLE.stroke}" stroke-width="1.5"/>`);
    }
    parts.push(svgText(vx + 30, cell + 12, MARKS[idx], { size: 14, weight: '600' }));
  });
  return svgRoot(cell * angles.length, cell + 22, parts.join(''), altText);
}

// ---------------------------------------------------------------------------
// geometry.line — 직선·선분·반직선 [4수03-01]
// ---------------------------------------------------------------------------

/**
 * segment(선분) / ray(반직선) / line(직선).
 * 끝점의 있고 없음, 연장선의 있고 없음이 곧 정답이므로 표시가 정확해야 한다.
 */
export function renderLine({ kind, labels = ['ㄱ', 'ㄴ'] }, altText) {
  const width = 200;
  const height = 62;
  const y = height / 2 + 4;
  const ax = 56;
  const bx = 146;
  const extend = 44;
  const parts = [];

  const x1 = kind === 'line' ? ax - extend : ax;
  const x2 = kind === 'segment' ? bx : bx + extend;
  parts.push(`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${SVG_STYLE.stroke}" stroke-width="2.2"/>`);
  for (const [x, labelIdx] of [[ax, 0], [bx, 1]]) {
    parts.push(`<circle cx="${x}" cy="${y}" r="3.4" fill="${SVG_STYLE.stroke}"/>`);
    parts.push(svgText(x, y - 13, labels[labelIdx], { size: 13, weight: '600' }));
  }
  return svgRoot(width, height, parts.join(''), altText);
}

// ---------------------------------------------------------------------------
// geometry.circle — 원의 구성 요소 [4수03-06~07]
// ---------------------------------------------------------------------------

export function renderCircle({ show = ['center', 'radius'], radiusLabel = null, diameterLabel = null }, altText) {
  const size = 168;
  const c = size / 2;
  const r = 60;
  const parts = [`<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${SVG_STYLE.stroke}" stroke-width="2.2"/>`];

  if (show.includes('diameter')) {
    parts.push(`<line x1="${c - r}" y1="${c}" x2="${c + r}" y2="${c}" stroke="${SVG_STYLE.stroke}" stroke-width="1.8"/>`);
    parts.push(`<circle cx="${c - r}" cy="${c}" r="2.6" fill="${SVG_STYLE.stroke}"/>`);
    parts.push(`<circle cx="${c + r}" cy="${c}" r="2.6" fill="${SVG_STYLE.stroke}"/>`);
    if (diameterLabel !== null) parts.push(svgText(c, c + 20, diameterLabel, { size: 13 }));
  } else if (show.includes('radius')) {
    parts.push(`<line x1="${c}" y1="${c}" x2="${c + r}" y2="${c}" stroke="${SVG_STYLE.stroke}" stroke-width="1.8"/>`);
    parts.push(`<circle cx="${c + r}" cy="${c}" r="2.6" fill="${SVG_STYLE.stroke}"/>`);
    if (radiusLabel !== null) parts.push(svgText(c + r / 2, c - 9, radiusLabel, { size: 13 }));
  }
  if (show.includes('center')) {
    parts.push(`<circle cx="${c}" cy="${c}" r="3" fill="${SVG_STYLE.stroke}"/>`);
    parts.push(svgText(c - 12, c - 9, 'ㅇ', { size: 12, weight: '600' }));
  }
  return svgRoot(size, size, parts.join(''), altText);
}

// ---------------------------------------------------------------------------
// geometry.triangle — 여러 가지 삼각형 [4수03-08~09]
// ---------------------------------------------------------------------------

/**
 * 세 각을 받아 삼각형을 그린다. 각의 합이 180도가 아니면 던진다.
 * 변 길이를 사인 법칙으로 정하므로 그려진 각이 실제로 그 각도가 된다.
 * 눈금 표시(markSides)는 길이가 같은 변에만 붙어 이등변·정삼각형 판단의 근거가 된다.
 */
export function renderTriangle({ angles, markSides = false, labelAngles = false }, altText) {
  const [A, B, C] = angles;
  if (Math.abs(A + B + C - 180) > 1e-9) throw new Error(`세 각의 합이 180도가 아니다: ${angles.join('+')}`);

  const scale = 104;
  const cSide = scale * (Math.sin(toRad(C)) / Math.sin(toRad(A)));
  const raw = [
    [cSide * Math.cos(toRad(B)), -cSide * Math.sin(toRad(B))], // A
    [0, 0], // B
    [scale, 0], // C
  ];
  // 둔각·얇은 삼각형에서 각도 라벨이 도형 밖으로 밀리지 않게 여백을 넉넉히 둔다.
  const pad = 34;
  const minX = Math.min(...raw.map((p) => p[0]));
  const minY = Math.min(...raw.map((p) => p[1]));
  const width = Math.ceil(Math.max(...raw.map((p) => p[0])) - minX + pad * 2);
  const height = Math.ceil(Math.max(...raw.map((p) => p[1])) - minY + pad * 2);
  const pts = raw.map(([x, y]) => [x - minX + pad, y - minY + pad]);

  const parts = [
    `<polygon points="${pts.map(([x, y]) => `${round(x)},${round(y)}`).join(' ')}" fill="none" stroke="${SVG_STYLE.stroke}" stroke-width="2.2"/>`,
  ];

  const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3;
  const cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;

  // 직각은 숫자 대신 작은 네모로 표시한다. 교과서 표기와 같고, 얇은 삼각형에서
  // '90°' 글자가 변 위에 겹쳐 읽히지 않는 문제도 함께 없어진다.
  const rightIdx = angles.findIndex((deg) => deg === 90);
  if (rightIdx >= 0) {
    const v = pts[rightIdx];
    const others = pts.filter((_, i) => i !== rightIdx);
    const unit = (from, to) => {
      const dx = to[0] - from[0];
      const dy = to[1] - from[1];
      const len = Math.hypot(dx, dy) || 1;
      return [dx / len, dy / len];
    };
    const u1 = unit(v, others[0]);
    const u2 = unit(v, others[1]);
    const m = 13;
    const a = [v[0] + u1[0] * m, v[1] + u1[1] * m];
    const b = [v[0] + u2[0] * m, v[1] + u2[1] * m];
    const corner = [v[0] + (u1[0] + u2[0]) * m, v[1] + (u1[1] + u2[1]) * m];
    parts.push(`<polyline points="${round(a[0])},${round(a[1])} ${round(corner[0])},${round(corner[1])} ${round(b[0])},${round(b[1])}" fill="none" stroke="${SVG_STYLE.stroke}" stroke-width="1.5"/>`);
  }

  if (labelAngles) {
    // 라벨을 무게중심 쪽으로 충분히 당겨야 변 위에 겹치지 않는다.
    pts.forEach(([x, y], idx) => {
      if (idx === rightIdx) return;
      const lx = x + (cx - x) * 0.44;
      const ly = y + (cy - y) * 0.44;
      parts.push(svgText(lx, ly + 4, `${angles[idx]}°`, { size: 12 }));
    });
  }

  if (markSides) {
    // 각이 같으면 마주보는 변의 길이가 같다. 각도로 그룹을 나누면 부동소수점 비교를 피한다.
    const sideByOppositeAngle = [
      { angle: A, from: pts[1], to: pts[2] },
      { angle: B, from: pts[2], to: pts[0] },
      { angle: C, from: pts[0], to: pts[1] },
    ];
    const groups = new Map();
    for (const s of sideByOppositeAngle) {
      if (!groups.has(s.angle)) groups.set(s.angle, []);
      groups.get(s.angle).push(s);
    }
    let tick = 0;
    for (const group of groups.values()) {
      tick += 1;
      if (group.length < 2) continue;
      for (const s of group) {
        const mx = (s.from[0] + s.to[0]) / 2;
        const my = (s.from[1] + s.to[1]) / 2;
        const dx = s.to[0] - s.from[0];
        const dy = s.to[1] - s.from[1];
        const len = Math.hypot(dx, dy) || 1;
        const nx = (-dy / len) * 5;
        const ny = (dx / len) * 5;
        for (let t = 0; t < tick; t += 1) {
          const off = (t - (tick - 1) / 2) * 4;
          const ox = (dx / len) * off;
          const oy = (dy / len) * off;
          parts.push(`<line x1="${round(mx + nx + ox)}" y1="${round(my + ny + oy)}" x2="${round(mx - nx + ox)}" y2="${round(my - ny + oy)}" stroke="${SVG_STYLE.stroke}" stroke-width="1.5"/>`);
        }
      }
    }
  }
  return svgRoot(width, height, parts.join(''), altText);
}

// ---------------------------------------------------------------------------
// geometry.grid-area — 다각형과 대각선 [4수03-11~12]
// ---------------------------------------------------------------------------

export function renderPolygonDiagonals({ sides, showDiagonals = true }, altText) {
  const size = 176;
  const c = size / 2;
  const r = 68;
  const pts = polygonPoints(sides, c, c, r, sides === 4 ? 45 : 0);
  const parts = [
    `<polygon points="${pts.map(([x, y]) => `${round(x)},${round(y)}`).join(' ')}" fill="none" stroke="${SVG_STYLE.stroke}" stroke-width="2.2"/>`,
  ];
  if (showDiagonals) {
    for (let i = 0; i < sides; i += 1) {
      for (let j = i + 2; j < sides; j += 1) {
        if (i === 0 && j === sides - 1) continue;
        parts.push(`<line x1="${round(pts[i][0])}" y1="${round(pts[i][1])}" x2="${round(pts[j][0])}" y2="${round(pts[j][1])}" stroke="${SVG_STYLE.light}" stroke-width="1.4" stroke-dasharray="4 3"/>`);
      }
    }
  }
  pts.forEach(([x, y], idx) => {
    parts.push(`<circle cx="${round(x)}" cy="${round(y)}" r="2.6" fill="${SVG_STYLE.stroke}"/>`);
    parts.push(svgText(x + (x - c) * 0.2, y + (y - c) * 0.2 + 4, VERTEX_LABELS[idx], { size: 11, weight: '600' }));
  });
  return svgRoot(size, size, parts.join(''), altText);
}

// ---------------------------------------------------------------------------
// geometry.symmetry — 평면도형의 이동 [4수03-04~05]
// ---------------------------------------------------------------------------

const TRANSFORM_OPS = {
  slide: { op: 'translate(24,0)', label: '밀기' },
  'flip-horizontal': { op: 'translate(80,0) scale(-1,1)', label: '왼쪽·오른쪽 뒤집기' },
  'flip-vertical': { op: 'translate(0,94) scale(1,-1)', label: '위·아래 뒤집기' },
  'rotate-90': { op: 'translate(94,0) rotate(90)', label: '시계 방향 90도 돌리기' },
  'rotate-180': { op: 'translate(80,94) rotate(180)', label: '180도 돌리기' },
};

export const TRANSFORM_LABELS = Object.fromEntries(
  Object.entries(TRANSFORM_OPS).map(([k, v]) => [k, v.label]),
);

/** 밀기·뒤집기·돌리기 결과를 원본과 나란히 보여 준다. */
export function renderTransform({ transform }, altText) {
  const cell = 116;
  const gap = 34;
  // 좌우와 상하가 모두 구별되는 비대칭 도형이어야 뒤집기와 돌리기가 눈에 보인다.
  const shape = '10,74 10,20 46,20 46,44 70,44 70,74';
  const entry = TRANSFORM_OPS[transform];
  if (!entry) throw new Error(`알 수 없는 이동: ${transform}`);

  const parts = [
    `<g transform="translate(6,6)"><polygon points="${shape}" fill="#f1f3f4" stroke="${SVG_STYLE.stroke}" stroke-width="2"/></g>`,
    svgText(cell / 2 - 6, cell + 14, '처음 도형', { size: 12 }),
    `<line x1="${cell + gap / 2 - 12}" y1="52" x2="${cell + gap / 2 + 6}" y2="52" stroke="${SVG_STYLE.light}" stroke-width="1.6"/>`,
    `<g transform="translate(${cell + gap},6) ${entry.op}"><polygon points="${shape}" fill="#e0e3e6" stroke="${SVG_STYLE.stroke}" stroke-width="2"/></g>`,
    svgText(cell + gap + cell / 2 - 16, cell + 14, entry.label, { size: 12 }),
  ];
  return svgRoot(cell * 2 + gap, cell + 22, parts.join(''), altText);
}

// ---------------------------------------------------------------------------
// geometry.quadrilateral — 여러 가지 사각형 [4수03-10]
// ---------------------------------------------------------------------------

/**
 * 사각형 종류별 좌표. 눈으로 종류가 구별되어야 하므로 결정적 성질을 좌표에 박는다.
 * 정사각형과 마름모는 네 변이 모두 같지만 각이 다르고, 직사각형과 평행사변형은
 * 마주보는 변이 같지만 각이 다르다.
 */
const QUAD_SHAPES = {
  square: { points: [[16, 12], [84, 12], [84, 80], [16, 80]], korean: '정사각형' },
  rectangle: { points: [[8, 24], [92, 24], [92, 68], [8, 68]], korean: '직사각형' },
  rhombus: { points: [[50, 8], [90, 46], [50, 84], [10, 46]], korean: '마름모' },
  parallelogram: { points: [[26, 24], [96, 24], [74, 72], [4, 72]], korean: '평행사변형' },
  trapezoid: { points: [[28, 24], [76, 24], [96, 72], [8, 72]], korean: '사다리꼴' },
};

export const QUAD_NAMES = Object.fromEntries(
  Object.entries(QUAD_SHAPES).map(([k, v]) => [k, v.korean]),
);

/** 사각형 하나 또는 여러 개를 한 줄로. */
export function renderQuadrilateral({ kind, kinds }, altText) {
  const list = kinds ?? [kind];
  const cell = 110;
  const parts = [];
  list.forEach((name, idx) => {
    const shape = QUAD_SHAPES[name];
    if (!shape) throw new Error(`알 수 없는 사각형: ${name}`);
    const ox = cell * idx + 5;
    const pts = shape.points.map(([x, y]) => `${round(x + ox)},${round(y + 8)}`).join(' ');
    parts.push(`<polygon points="${pts}" fill="none" stroke="${SVG_STYLE.stroke}" stroke-width="2.2"/>`);
    if (list.length > 1) parts.push(svgText(ox + 50, cell + 12, MARKS[idx], { size: 14, weight: '600' }));
  });
  return svgRoot(cell * list.length, cell + (list.length > 1 ? 22 : 10), parts.join(''), altText);
}

// ---------------------------------------------------------------------------
// data.bar-graph — 막대그래프 [4수04-02~03]
// ---------------------------------------------------------------------------

/** 막대그래프. 세로축 눈금 간격이 정확해야 값을 읽는 문항이 성립한다. */
export function renderBarGraph({ categories, counts, step = 1, unitLabel = '' }, altText) {
  const colWidth = 64;
  const barWidth = 30;
  const ticks = Math.ceil(Math.max(...counts) / step);
  const unitHeight = 22;
  const axisWidth = 36;
  const plotHeight = ticks * unitHeight;
  const width = axisWidth + categories.length * colWidth + 12;
  const height = plotHeight + 48;
  const baseY = plotHeight + 14;
  const parts = [];

  for (let t = 0; t <= ticks; t += 1) {
    const y = baseY - t * unitHeight;
    parts.push(`<line x1="${axisWidth}" y1="${round(y)}" x2="${width - 8}" y2="${round(y)}" stroke="${SVG_STYLE.light}" stroke-width="0.8"/>`);
    parts.push(svgText(axisWidth - 6, round(y) + 4, String(t * step), { size: 11, anchor: 'end' }));
  }
  parts.push(`<line x1="${axisWidth}" y1="10" x2="${axisWidth}" y2="${baseY}" stroke="${SVG_STYLE.stroke}" stroke-width="1.4"/>`);
  parts.push(`<line x1="${axisWidth}" y1="${baseY}" x2="${width - 8}" y2="${baseY}" stroke="${SVG_STYLE.stroke}" stroke-width="1.4"/>`);

  categories.forEach((category, idx) => {
    const cx = axisWidth + idx * colWidth + colWidth / 2;
    const barHeight = (counts[idx] / step) * unitHeight;
    parts.push(`<rect x="${round(cx - barWidth / 2)}" y="${round(baseY - barHeight)}" width="${barWidth}" height="${round(barHeight)}" fill="#dfe3e6" stroke="${SVG_STYLE.stroke}" stroke-width="1.4"/>`);
    parts.push(svgText(cx, baseY + 17, String(category), { size: 12 }));
  });
  if (unitLabel) parts.push(svgText(axisWidth - 4, 8, unitLabel, { size: 10, anchor: 'end' }));
  return svgRoot(width, height, parts.join(''), altText);
}
