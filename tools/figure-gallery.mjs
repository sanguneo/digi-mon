import fs from 'node:fs';
import { renderFigureSvg } from '../src/render/figure-svg.mjs';

const cases = [
  { label: '3시 20분 (시침이 3과 4 사이 1/3)', fig: { kind: 'measure.clock', spec: { hour: 3, minute: 20 }, altText: 'a' } },
  { label: '9시 45분 (시침이 9와 10 사이 3/4)', fig: { kind: 'measure.clock', spec: { hour: 9, minute: 45 }, altText: 'a' } },
  { label: '12시 0분 (두 바늘 겹침)', fig: { kind: 'measure.clock', spec: { hour: 12, minute: 0 }, altText: 'a' } },
  { label: '6시 30분 (시침 6-7 중간)', fig: { kind: 'measure.clock', spec: { hour: 6, minute: 30 }, altText: 'a' } },
  { label: '오각형 (변 5개)', fig: { kind: 'geometry.plane-shape', spec: { shape: 'pentagon', labelVertices: true }, altText: 'a' } },
  { label: '육각형 (변 6개)', fig: { kind: 'geometry.plane-shape', spec: { shape: 'hexagon', labelVertices: true }, altText: 'a' } },
  { label: '도형 4개 나열', fig: { kind: 'geometry.plane-shape', spec: { shapes: ['triangle', 'circle', 'pentagon', 'quadrilateral'] }, altText: 'a' } },
  { label: '자: 3cm~10cm = 7cm', fig: { kind: 'measure.length', spec: { maxCm: 12, objectCm: 7, startCm: 3 }, altText: 'a' } },
  { label: '묶음: 4개씩 3묶음', fig: { kind: 'array.bundles', spec: { groups: 3, per: 4 }, altText: 'a' } },
];

const html = `<!doctype html><meta charset="utf-8"><style>
body{font-family:system-ui,"Malgun Gothic",sans-serif;background:#fff;margin:0;padding:16px}
.grid{display:flex;flex-wrap:wrap;gap:14px}
.card{border:1px solid #ddd;border-radius:8px;padding:8px;background:#fff}
.cap{font-size:12px;color:#333;margin-top:6px;text-align:center;max-width:220px}
</style><div class="grid">
${cases.map((c) => `<div class="card">${renderFigureSvg(c.fig)}<div class="cap">${c.label}</div></div>`).join('')}
</div>`;
fs.mkdirSync('out/figures', { recursive: true });
fs.writeFileSync('out/figures/gallery.html', html, 'utf8');
console.log('out/figures/gallery.html 작성');
