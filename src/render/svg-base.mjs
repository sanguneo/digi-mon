/**
 * SVG 도해 공통 기반.
 *
 * 왜 이미지 생성 모델을 쓰지 않는가:
 * 수학 도형은 각도 47도가 정확히 47도여야 하고, 모눈은 칸이 정확히 세어져야 하며,
 * 시계는 정확히 그 시각을 가리켜야 한다. 확률적 렌더는 문항을 오답으로 만든다.
 * 삽화·표지·캐릭터는 이미지 모델의 몫이고, 도해는 여기 몫이다.
 */

export const VERTEX_LABELS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ'];

export const SVG_STYLE = {
  stroke: '#111111',
  light: '#9aa0a6',
  font: 'system-ui, -apple-system, "Malgun Gothic", sans-serif',
};

export const round = (n) => Math.round(n * 100) / 100;

export function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
}

export function svgRoot(width, height, body, altText) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"`,
    ` role="img" aria-label="${escapeXml(altText)}">`,
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`,
    body,
    '</svg>',
  ].join('');
}

export function svgText(x, y, content, { size = 13, anchor = 'middle', weight = 'normal' } = {}) {
  return `<text x="${round(x)}" y="${round(y)}" font-family="${SVG_STYLE.font}" font-size="${size}"`
    + ` font-weight="${weight}" text-anchor="${anchor}" fill="${SVG_STYLE.stroke}">${escapeXml(content)}</text>`;
}

export const REGULAR_SIDES = { triangle: 3, quadrilateral: 4, pentagon: 5, hexagon: 6 };

/**
 * 도형별 기본 회전. 저학년 교재는 도형을 표준 방향으로 싣는다.
 *
 * 정n각형의 첫 꼭짓점을 위로 두면 사각형이 마름모로 서 버린다. 수학적으로는
 * 같은 사각형이지만, 사각형을 마름모 방향으로 보여 주면 도형 이름을 방향으로
 * 외우게 만들어 오답을 유발한다. 4각형만 45도 돌려 아래변을 수평으로 둔다.
 */
export const DEFAULT_ROTATION = { triangle: 0, quadrilateral: 45, pentagon: 0, hexagon: 0 };

/** 정n각형 꼭짓점. 첫 꼭짓점을 위로 두어 아이가 보는 표준 방향으로 맞춘다. */
export function polygonPoints(sides, cx, cy, radius, rotationDeg = 0) {
  return Array.from({ length: sides }, (_, k) => {
    const angle = ((k * 360) / sides - 90 + rotationDeg) * (Math.PI / 180);
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  });
}
