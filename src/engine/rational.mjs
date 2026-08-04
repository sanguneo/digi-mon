/**
 * 분수와 소수. 전부 정수 연산으로 처리한다.
 *
 * 부동소수점을 쓰면 4.7 - 1.9 가 2.8000000000000003 이 되어 정답 문자열이
 * 조용히 틀린다. 초등 소수 문항은 소수 두 자리까지만 다루므로, 값을 10^scale 배
 * 정수로 들고 다니고 표시할 때만 소수점을 꽂는다.
 */

export function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x;
}

export function lcm(a, b) {
  return Math.abs(a * b) / gcd(a, b);
}

/** n 의 약수를 오름차순으로. */
export function divisorsOf(n) {
  const out = [];
  for (let k = 1; k * k <= n; k += 1) {
    if (n % k !== 0) continue;
    out.push(k);
    if (k !== n / k) out.push(n / k);
  }
  return out.sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// 분수
// ---------------------------------------------------------------------------

export function makeFraction(n, d) {
  if (!Number.isInteger(n) || !Number.isInteger(d)) throw new Error(`분수는 정수여야 한다: ${n}/${d}`);
  if (d === 0) throw new Error('분모가 0이다');
  return { n, d };
}

export function reduceFraction({ n, d }) {
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}

export function isReduced({ n, d }) {
  return gcd(n, d) === 1;
}

/** 가분수 -> 대분수. 3보다 작은 몫이면 whole 이 0 이다. */
export function toMixed({ n, d }) {
  return { whole: Math.floor(n / d), n: n % d, d };
}

export function fromMixed({ whole, n, d }) {
  return { n: whole * d + n, d };
}

/** 분모를 통일해 정수 분자끼리만 비교한다. 나눗셈을 쓰지 않으므로 오차가 없다. */
export function compareFractions(a, b) {
  const left = a.n * b.d;
  const right = b.n * a.d;
  return left === right ? 0 : (left > right ? 1 : -1);
}

export function addFractions(a, b) {
  return reduceFraction({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
}

export function subFractions(a, b) {
  return reduceFraction({ n: a.n * b.d - b.n * a.d, d: a.d * b.d });
}

export function multiplyFractions(a, b) {
  return reduceFraction({ n: a.n * b.n, d: a.d * b.d });
}

export function divideFractions(a, b) {
  if (b.n === 0) throw new Error('0으로 나눌 수 없다');
  return reduceFraction({ n: a.n * b.d, d: a.d * b.n });
}

export const FRACTION_KINDS = { proper: '진분수', improper: '가분수', unit: '단위분수' };

export function fractionKind({ n, d }) {
  if (n === 1 && d > 1) return 'unit';
  return n < d ? 'proper' : 'improper';
}

/** 학습지 표기: 세로 분수를 쓸 수 없는 텍스트 맥락에서는 a/b 로 적는다. */
export function formatFraction({ n, d }) {
  return `${n}/${d}`;
}

/**
 * 대분수 표기. 순수 수학 표기만 만들고 조사는 붙이지 않는다.
 * '2과 1/3' 같은 조사 오류를 만들지 않으려면 한국어 조립은 호출자가 한다.
 */
export function formatMixed({ whole, n, d }) {
  if (n === 0) return String(whole);
  if (whole === 0) return `${n}/${d}`;
  return `${whole} ${n}/${d}`;
}

/**
 * 분모가 같은 분수의 덧셈·뺄셈. 약분하지 않는다.
 *
 * 약분은 5~6학년 내용이다. 3~4학년 [4수01-15]에서 1/6 + 2/6 의 답은 3/6 이고,
 * 이를 1/2 로 줄여 내면 학년 범위를 벗어난 답을 정답으로 제시하는 것이 된다.
 */
export function addSameDenominator(a, b) {
  if (a.d !== b.d) throw new Error(`분모가 다르다: ${a.d}, ${b.d}`);
  return { n: a.n + b.n, d: a.d };
}

export function subSameDenominator(a, b) {
  if (a.d !== b.d) throw new Error(`분모가 다르다: ${a.d}, ${b.d}`);
  return { n: a.n - b.n, d: a.d };
}

/** 약분하지 않은 표기. 분자가 분모의 배수면 자연수로 적는다. */
export function formatUnreducedFraction({ n, d }) {
  if (n % d === 0) return String(n / d);
  return `${n}/${d}`;
}

/** 한국어 읽기: 2/3 -> '3분의 2'. 분모를 먼저 읽는다. */
export function readFraction({ n, d }) {
  return `${d}분의 ${n}`;
}

// ---------------------------------------------------------------------------
// 소수 (고정소수점)
// ---------------------------------------------------------------------------

/**
 * value = units / 10^scale.
 * 4.7 은 { units: 47, scale: 1 }, 3.25 는 { units: 325, scale: 2 }.
 */
export function makeDecimal(units, scale) {
  if (!Number.isInteger(units)) throw new Error(`소수의 내부 표현은 정수여야 한다: ${units}`);
  if (!Number.isInteger(scale) || scale < 0 || scale > 3) throw new Error(`scale 범위 밖: ${scale}`);
  return { units, scale };
}

/** 두 소수의 scale 을 큰 쪽으로 맞춘다. 자리수가 달라도 정수 비교가 되게 한다. */
function alignDecimals(a, b) {
  const scale = Math.max(a.scale, b.scale);
  return [
    a.units * 10 ** (scale - a.scale),
    b.units * 10 ** (scale - b.scale),
    scale,
  ];
}

export function addDecimals(a, b) {
  const [x, y, scale] = alignDecimals(a, b);
  return makeDecimal(x + y, scale);
}

export function subDecimals(a, b) {
  const [x, y, scale] = alignDecimals(a, b);
  return makeDecimal(x - y, scale);
}

export function compareDecimals(a, b) {
  const [x, y] = alignDecimals(a, b);
  return x === y ? 0 : (x > y ? 1 : -1);
}

/**
 * 표기. 0.30000000000000004 같은 것이 나올 여지가 없다.
 * 뒤따르는 0 은 지우지 않는다. 0.50 과 0.5 는 같은 수지만, 문항이 요구한
 * 자리수를 유지해야 '소수 두 자리 수'라는 조건이 보인다.
 */
export function formatDecimal({ units, scale }) {
  if (scale === 0) return String(units);
  const sign = units < 0 ? '-' : '';
  const abs = Math.abs(units);
  const power = 10 ** scale;
  const whole = Math.floor(abs / power);
  const frac = String(abs % power).padStart(scale, '0');
  return `${sign}${whole}.${frac}`;
}

/**
 * 뒤따르는 0을 지운 표기. 계산 결과를 보일 때 쓴다.
 *
 * 50 × 3.14 = 157 인데 '157.00' 으로 내면, 학생이 '157' 이라고 쓴 정답이
 * 오답으로 채점된다. 자리수를 보여야 하는 문항(소수 두 자리 수 읽기)에서는
 * formatDecimal 을, 계산 결과에서는 이 함수를 쓴다.
 */
export function formatDecimalTrimmed(decimal) {
  const shown = formatDecimal(decimal);
  if (!shown.includes('.')) return shown;
  return shown.replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * 표기 문자열을 다시 값으로 읽는다.
 *
 * 검산이 params 에 담긴 계산 결과를 되읽으면 answer 를 보지 않는 검산이 되어
 * 아무것도 잡지 못한다. 답 문자열에서 값을 복원하는 이 경로가 생성 경로와
 * 방향이 반대이므로 검산의 독립성을 만든다.
 */
export function parseFractionText(text) {
  const t = String(text).trim();
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(t);
  if (mixed) {
    const d = Number(mixed[3]);
    if (d === 0) return null;
    return { n: Number(mixed[1]) * d + Number(mixed[2]), d };
  }
  const frac = /^(\d+)\/(\d+)$/.exec(t);
  if (frac) {
    const d = Number(frac[2]);
    return d === 0 ? null : { n: Number(frac[1]), d };
  }
  const whole = /^(\d+)$/.exec(t);
  return whole ? { n: Number(whole[1]), d: 1 } : null;
}

/** 소수 표기 -> { units, scale }. '5.0' 은 units 50, scale 1 이다. */
export function parseDecimalText(text) {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(text).trim());
  if (!m) return null;
  const frac = m[3] ?? '';
  return { units: Number(`${m[1]}${m[2]}${frac}`), scale: frac.length };
}

/** 소수를 읽는 말: 3.25 -> '삼 점 이오'가 아니라 문항에서는 자리 이름을 쓴다. */
export const DECIMAL_PLACE_NAMES = ['소수 첫째', '소수 둘째', '소수 셋째'];

export function decimalDigitAt({ units, scale }, place) {
  if (place < 1 || place > scale) return 0;
  return Math.floor(Math.abs(units) / 10 ** (scale - place)) % 10;
}

/** 분모가 10 또는 100 인 분수를 소수로. 등분할과 소수의 연결이 초점이다. */
export function fractionToDecimal({ n, d }) {
  if (d === 10) return makeDecimal(n, 1);
  if (d === 100) return makeDecimal(n, 2);
  if (d === 1000) return makeDecimal(n, 3);
  throw new Error(`10의 거듭제곱 분모만 소수로 바꾼다: 분모 ${d}`);
}

export function decimalToFraction({ units, scale }) {
  return reduceFraction({ n: units, d: 10 ** scale });
}

/** 소수를 자연수 부분과 소수 부분으로. '자연수와 소수의 관계' 문항에 쓴다. */
export function splitDecimal({ units, scale }) {
  const power = 10 ** scale;
  return { whole: Math.floor(units / power), fractionUnits: units % power, scale };
}
