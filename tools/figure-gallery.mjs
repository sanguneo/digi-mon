/**
 * figure 렌더러 대표컷 갤러리.
 * SVG 가 문법적으로 유효한 것과 그림이 실제로 맞는 것은 다른 문제다.
 * 시침이 엉뚱한 데를 가리켜도 태그는 유효하므로, 눈으로 보는 절차를 남긴다.
 *   node tools/figure-gallery.mjs && node tools/shot.mjs
 */
import fs from 'node:fs';
import { renderFigureSvg } from '../src/render/figure-svg.mjs';

const fig = (kind, spec) => ({ kind, spec, altText: 'gallery' });

const cases = [
  ['3시 20분 (시침 3-4 사이 1/3)', fig('measure.clock', { hour: 3, minute: 20 })],
  ['9시 45분 (시침 9-10 사이 3/4)', fig('measure.clock', { hour: 9, minute: 45 })],
  ['12시 0분 (두 바늘 겹침)', fig('measure.clock', { hour: 12, minute: 0 })],
  ['오각형 (변 5개)', fig('geometry.plane-shape', { shape: 'pentagon', labelVertices: true })],
  ['육각형 (변 6개)', fig('geometry.plane-shape', { shape: 'hexagon', labelVertices: true })],
  ['평면도형 4종 (㉣ 사각형은 아래변 수평)', fig('geometry.plane-shape', { shapes: ['triangle', 'circle', 'pentagon', 'quadrilateral'] })],
  ['자: 3cm~10cm = 7cm', fig('measure.length', { maxCm: 12, objectCm: 7, startCm: 3 })],
  ['묶음: 4개씩 3묶음', fig('array.bundles', { groups: 3, per: 4 })],
  ['입체도형 3종 (직육면체·원기둥·구)', fig('geometry.solid-shape', { solids: ['cuboid', 'cylinder', 'sphere'] })],
  ['입체도형 순서 바꿈 (직육면체는 가로로 길게)', fig('geometry.solid-shape', { solids: ['sphere', 'cylinder', 'cuboid'] })],
  ['쌓기나무 4+2+1 = 7개', fig('geometry.solid-shape', { layers: [4, 2, 1] })],
  ['쌓기나무 3+3 = 6개', fig('geometry.solid-shape', { layers: [3, 3] })],
  ['표: 색깔별 색종이 수', fig('data.table', { headers: ['빨강', '노랑', '파랑'], values: [5, 3, 6], headerLabel: '색깔', valueLabel: '수(장)' })],
  ['그림그래프: 좋아하는 운동', fig('data.picture-graph', { categories: ['축구', '수영', '야구'], counts: [5, 2, 4] })],
  ['그림그래프: 4항목', fig('data.picture-graph', { categories: ['봄', '여름', '가을', '겨울'], counts: [3, 6, 4, 1] })],
  ['각 47도 (정확히 47도)', fig('geometry.angle', { degrees: 47, label: '47°' })],
  ['직각 90도 (네모 표시)', fig('geometry.angle', { degrees: 90 })],
  ['둔각 130도', fig('geometry.angle', { degrees: 130, label: '130°' })],
  ['각 3개 나열 (예각·직각·둔각)', fig('geometry.angle', { angles: [35, 90, 145] })],
  ['선분 ㄱㄴ', fig('geometry.line', { kind: 'segment' })],
  ['반직선 ㄱㄴ', fig('geometry.line', { kind: 'ray' })],
  ['직선 ㄱㄴ', fig('geometry.line', { kind: 'line' })],
  ['원: 중심과 반지름', fig('geometry.circle', { show: ['center', 'radius'], radiusLabel: '5cm' })],
  ['원: 지름', fig('geometry.circle', { show: ['center', 'diameter'], diameterLabel: '10cm' })],
  ['정삼각형 60-60-60 (눈금 3개 같음)', fig('geometry.triangle', { angles: [60, 60, 60], markSides: true })],
  ['이등변삼각형 40-70-70', fig('geometry.triangle', { angles: [40, 70, 70], markSides: true })],
  ['직각삼각형 90-55-35', fig('geometry.triangle', { angles: [90, 55, 35], labelAngles: true })],
  ['둔각삼각형 120-35-25', fig('geometry.triangle', { angles: [120, 35, 25], labelAngles: true })],
  ['오각형 대각선 5개', fig('geometry.grid-area', { sides: 5 })],
  ['육각형 대각선 9개', fig('geometry.grid-area', { sides: 6 })],
  ['뒤집기 (왼쪽·오른쪽)', fig('geometry.symmetry', { transform: 'flip-horizontal' })],
  ['돌리기 90도', fig('geometry.symmetry', { transform: 'rotate-90' })],
  ['사각형 4종 (마름모·정사각형 구별)', fig('geometry.quadrilateral', { kinds: ['parallelogram', 'square', 'rhombus', 'trapezoid'] })],
  ['직사각형 하나', fig('geometry.quadrilateral', { kind: 'rectangle' })],
  ['막대그래프 눈금 1', fig('data.bar-graph', { categories: ['사과', '포도', '배', '귤'], counts: [5, 3, 8, 6], step: 1, unitLabel: '(명)' })],
  ['막대그래프 눈금 2 (5,10,15)', fig('data.bar-graph', { categories: ['1반', '2반', '3반'], counts: [10, 16, 6], step: 2, unitLabel: '(명)' })],
];

const html = `<!doctype html><meta charset="utf-8"><style>
body{font-family:system-ui,"Malgun Gothic",sans-serif;background:#fff;margin:0;padding:16px}
.grid{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start}
.card{border:1px solid #ddd;border-radius:8px;padding:8px;background:#fff}
.cap{font-size:12px;color:#333;margin-top:6px;text-align:center;max-width:260px}
</style><div class="grid">
${cases.map(([label, f]) => `<div class="card">${renderFigureSvg(f)}<div class="cap">${label}</div></div>`).join('')}
</div>`;

fs.mkdirSync('out/figures', { recursive: true });
const only = process.env.ONLY;
const picked = only === 'g34' ? cases.slice(15) : only === 'g12' ? cases.slice(0, 15) : cases;
const body = `<!doctype html><meta charset="utf-8"><style>
body{font-family:system-ui,"Malgun Gothic",sans-serif;background:#fff;margin:0;padding:16px}
.grid{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start}
.card{border:1px solid #ddd;border-radius:8px;padding:8px;background:#fff}
.cap{font-size:12px;color:#333;margin-top:6px;text-align:center;max-width:260px}
</style><div class="grid">
${picked.map(([label, f]) => `<div class="card">${renderFigureSvg(f)}<div class="cap">${label}</div></div>`).join('')}
</div>`;
fs.writeFileSync('out/figures/gallery.html', body, 'utf8');
console.log(`out/figures/gallery.html 작성 (${picked.length}컷)`);
