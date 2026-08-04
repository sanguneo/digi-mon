/**
 * 2022 개정 초등 수학 5~6학년군 '수와 연산' [6수01-01]~[6수01-15].
 *
 * 이 학년군부터 약분·통분이 들어온다. 3~4학년과 달리 결과를 기약분수로 낸다.
 * 소수의 곱셈·나눗셈은 자리수가 늘어나므로 고정소수점 정수 연산이 특히 중요하다.
 */
import { buildChoices } from '../../engine/item.mjs';
import { fracEul, josaEul, josaEun, josaI, numEun, numEul, numGwa, numI, numberParticle } from '../../engine/korean-number.mjs';
import {
  addFractions,
  compareFractions,
  divideFractions,
  divisorsOf,
  formatDecimal,
  formatFraction,
  formatMixed,
  gcd,
  lcm,
  makeDecimal,
  makeFraction,
  multiplyFractions,
  parseDecimalText,
  parseFractionText,
  reduceFraction,
  subFractions,
  toMixed,
} from '../../engine/rational.mjs';

const CODE = (n) => `[6수01-${String(n).padStart(2, '0')}]`;
const num = (n) => String(n);

function distractors(correct, candidates) {
  const out = [];
  for (const c of candidates) {
    if (c === correct || out.includes(c) || !Number.isFinite(c) || c < 0) continue;
    out.push(c);
  }
  return out;
}

/** 기약분수를 문자열로. 분모가 1이면 자연수로 적는다. */
function formatReduced(fraction) {
  const r = reduceFraction(fraction);
  return r.d === 1 ? String(r.n) : formatFraction(r);
}

// ---------------------------------------------------------------------------
// [6수01-01] 자연수의 혼합 계산
// ---------------------------------------------------------------------------

const mixedOperations = {
  id: 'math.g56.no.s01.mixed-ops',
  standardCode: CODE(1),
  skill: '자연수의 혼합 계산',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    // 계산 순서(괄호 -> 곱셈·나눗셈 -> 덧셈·뺄셈)를 재는 문항이다.
    const shape = rng.pick(
      difficulty === 1 ? ['a+b*c', 'a-b*c'] : difficulty === 2 ? ['a+b*c', '(a+b)*c', 'a+b/c'] : ['(a+b)*c-d', 'a*b+c/d', 'a-(b+c)/d'],
    );
    const b = rng.int(2, 9);
    const c = rng.int(2, 9);

    if (shape === 'a+b*c') {
      const a = rng.int(5, 40);
      return pack(`${a} + ${b} × ${c}`, a + b * c, [`곱셈을 먼저 한다: ${b} × ${c} = ${b * c}`, `${a} + ${b * c} = ${a + b * c}`]);
    }
    if (shape === 'a-b*c') {
      const product = b * c;
      const a = rng.int(product + 1, product + 50);
      return pack(`${a} - ${b} × ${c}`, a - product, [`곱셈을 먼저 한다: ${b} × ${c} = ${product}`, `${a} - ${product} = ${a - product}`]);
    }
    if (shape === '(a+b)*c') {
      const a = rng.int(2, 20);
      return pack(`(${a} + ${b}) × ${c}`, (a + b) * c, [`괄호를 먼저 계산한다: ${a} + ${b} = ${a + b}`, `${a + b} × ${c} = ${(a + b) * c}`]);
    }
    if (shape === 'a+b/c') {
      const quotient = rng.int(2, 9);
      const divisor = rng.int(2, 9);
      const dividend = divisor * quotient;
      const a = rng.int(5, 40);
      return pack(`${a} + ${dividend} ÷ ${divisor}`, a + quotient, [`나눗셈을 먼저 한다: ${dividend} ÷ ${divisor} = ${quotient}`, `${a} + ${quotient} = ${a + quotient}`]);
    }
    if (shape === '(a+b)*c-d') {
      const a = rng.int(2, 15);
      const product = (a + b) * c;
      const d = rng.int(1, product - 1);
      return pack(`(${a} + ${b}) × ${c} - ${d}`, product - d, [
        `괄호를 먼저: ${a} + ${b} = ${a + b}`,
        `곱셈: ${a + b} × ${c} = ${product}`,
        `뺄셈: ${product} - ${d} = ${product - d}`,
      ]);
    }
    if (shape === 'a*b+c/d') {
      const a = rng.int(2, 12);
      const quotient = rng.int(2, 9);
      const divisor = rng.int(2, 9);
      const dividend = divisor * quotient;
      return pack(`${a} × ${b} + ${dividend} ÷ ${divisor}`, a * b + quotient, [
        `곱셈과 나눗셈을 먼저 한다.`,
        `${a} × ${b} = ${a * b}, ${dividend} ÷ ${divisor} = ${quotient}`,
        `${a * b} + ${quotient} = ${a * b + quotient}`,
      ]);
    }
    // a-(b+c)/d
    const divisor = rng.int(2, 9);
    const quotient = rng.int(2, 9);
    const sum = divisor * quotient;
    const inner = rng.int(1, sum - 1);
    const other = sum - inner;
    const a = rng.int(quotient + 1, quotient + 50);
    return pack(`${a} - (${inner} + ${other}) ÷ ${divisor}`, a - quotient, [
      `괄호를 먼저: ${inner} + ${other} = ${sum}`,
      `나눗셈: ${sum} ÷ ${divisor} = ${quotient}`,
      `뺄셈: ${a} - ${quotient} = ${a - quotient}`,
    ]);

    function pack(stem, value, solution) {
      return {
        params: { stem, value },
        instruction: '계산하시오.',
        stem,
        answer: { value, display: num(value), accepts: [num(value)] },
        solution,
        dedupeKey: `mixed-ops:${stem}`,
        difficulty,
      };
    }
  },
  verify({ stem, value }, answer) {
    // 식을 직접 다시 파싱해 계산 순서대로 평가한다. 생성 때 쓴 값과 독립적이다.
    return evaluateExpression(stem) === answer.value && answer.value === value;
  },
};

/**
 * 초등 혼합 계산식 평가기. 괄호, × ÷ + -, 자연수만 다룬다.
 * 검산 전용이므로 생성기가 만든 중간값을 쓰지 않고 문자열에서 다시 계산한다.
 */
function evaluateExpression(text) {
  const tokens = text.replace(/×/g, '*').replace(/÷/g, '/').match(/\d+|[()+\-*/]/g);
  if (!tokens) return Number.NaN;
  let pos = 0;
  const peek = () => tokens[pos];

  const parsePrimary = () => {
    if (peek() === '(') {
      pos += 1;
      const value = parseSum();
      pos += 1; // ')'
      return value;
    }
    const value = Number(tokens[pos]);
    pos += 1;
    return value;
  };
  const parseProduct = () => {
    let value = parsePrimary();
    while (peek() === '*' || peek() === '/') {
      const op = tokens[pos];
      pos += 1;
      const rhs = parsePrimary();
      value = op === '*' ? value * rhs : value / rhs;
    }
    return value;
  };
  const parseSum = () => {
    let value = parseProduct();
    while (peek() === '+' || peek() === '-') {
      const op = tokens[pos];
      pos += 1;
      const rhs = parseProduct();
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  };
  return parseSum();
}

// ---------------------------------------------------------------------------
// [6수01-02] 수의 범위: 이상·이하·초과·미만
// ---------------------------------------------------------------------------

const RANGE_WORDS = {
  이상: (v, k) => v >= k,
  이하: (v, k) => v <= k,
  초과: (v, k) => v > k,
  미만: (v, k) => v < k,
};

const numberRange = {
  id: 'math.g56.no.s02.range',
  standardCode: CODE(2),
  skill: '이상·이하·초과·미만',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const word = rng.pick(difficulty === 1 ? ['이상', '이하'] : Object.keys(RANGE_WORDS));
    const boundary = rng.int(10, difficulty === 1 ? 30 : 90);
    const spread = difficulty === 1 ? 3 : 5;
    const predicate = RANGE_WORDS[word];
    // 조건을 만족하는 수가 하나도 없으면 물음이 성립하지 않는다.
    // 경계값과 조건을 만족하는 수를 각각 하나씩 반드시 넣고 나머지를 채운다.
    const candidates = [boundary];
    const sure = word === '이상' || word === '초과' ? boundary + rng.int(1, spread) : boundary - rng.int(1, spread);
    candidates.push(sure);
    while (candidates.length < 5) {
      const v = boundary + rng.int(-spread, spread);
      if (v > 0 && !candidates.includes(v)) candidates.push(v);
    }
    const shuffled = rng.shuffle(candidates);
    const matching = shuffled.filter((v) => predicate(v, boundary)).sort((a, b) => a - b);
    const display = matching.join(', ');
    return {
      params: { word, boundary, candidates: shuffled },
      instruction: '조건에 맞는 수를 모두 찾아 쓰시오.',
      stem: `${shuffled.join(', ')} 중에서 ${boundary} ${word}인 수를 모두 쓰시오.`,
      answer: { value: matching, display, accepts: [display, matching.join(' ')] },
      solution: [
        word === '이상' ? `${boundary} 이상은 ${numGwa(boundary)} 같거나 큰 수다.`
          : word === '이하' ? `${boundary} 이하는 ${numGwa(boundary)} 같거나 작은 수다.`
            : word === '초과' ? `${boundary} 초과는 ${boundary}보다 큰 수다. ${numEun(boundary)} 넣지 않는다.`
              : `${boundary} 미만은 ${boundary}보다 작은 수다. ${numEun(boundary)} 넣지 않는다.`,
        `조건에 맞는 수는 ${display}이다.`,
      ],
      dedupeKey: `range:${word}:${boundary}:${shuffled.join('-')}`,
      difficulty,
    };
  },
  verify({ word, boundary, candidates }, answer) {
    // 조건을 후보 전체에 다시 적용해 정답 집합을 재구성한다.
    const predicate = RANGE_WORDS[word];
    const expected = candidates.filter((v) => predicate(v, boundary)).sort((a, b) => a - b);
    return expected.length === answer.value.length && expected.every((v, i) => v === answer.value[i]);
  },
};

// ---------------------------------------------------------------------------
// [6수01-03] 올림·버림·반올림
// ---------------------------------------------------------------------------

const ROUNDING = {
  올림: (v, unit) => Math.ceil(v / unit) * unit,
  버림: (v, unit) => Math.floor(v / unit) * unit,
  반올림: (v, unit) => Math.round(v / unit) * unit,
};

const roundingMethods = {
  id: 'math.g56.no.s03.rounding',
  standardCode: CODE(3),
  skill: '올림·버림·반올림',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const method = rng.pick(Object.keys(ROUNDING));
    const unit = difficulty === 1 ? 10 : difficulty === 2 ? rng.pick([10, 100]) : rng.pick([100, 1000]);
    // 반올림에서 기준 자리가 5면 규칙상 올림이지만, 올림·버림과 헷갈리기 쉬운
    // 경계값이므로 난이도 3에서만 낸다.
    const value = rng.until(
      () => rng.int(unit + 1, unit * 99),
      (v) => v % unit !== 0 && (difficulty === 3 || Math.floor(v / (unit / 10)) % 10 !== 5),
    );
    const result = ROUNDING[method](value, unit);
    const placeName = unit === 10 ? '십의 자리' : unit === 100 ? '백의 자리' : '천의 자리';
    return {
      params: { method, unit, value },
      instruction: '□에 알맞은 수를 구하시오.',
      stem: `${numEul(value)} ${placeName}까지 ${method}하면 얼마입니까?`,
      answer: { value: result, display: num(result), accepts: [num(result)] },
      solution: [
        method === '올림' ? `${placeName} 아래를 모두 올려 ${unit}의 배수로 만든다.`
          : method === '버림' ? `${placeName} 아래를 모두 버려 ${unit}의 배수로 만든다.`
            : `${placeName} 아래 첫 숫자가 5 이상이면 올리고 4 이하면 버린다.`,
        `${value} -> ${result}`,
      ],
      dedupeKey: `rounding:${method}:${unit}:${value}`,
      difficulty,
    };
  },
  verify({ method, unit, value }, answer) {
    // 결과는 단위의 배수여야 하고, 원래 수와의 차가 단위보다 작아야 한다.
    if (answer.value % unit !== 0 || Math.abs(answer.value - value) >= unit) return false;
    if (method === '올림') return answer.value >= value;
    if (method === '버림') return answer.value <= value;
    return Math.abs(answer.value - value) <= unit / 2;
  },
};

// ---------------------------------------------------------------------------
// [6수01-04] 약수와 배수
// ---------------------------------------------------------------------------

const divisorsAndMultiples = {
  id: 'math.g56.no.s04.divisors',
  standardCode: CODE(4),
  skill: '약수와 배수 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const askDivisors = rng.bool();
    if (askDivisors) {
      const n = difficulty === 1 ? rng.pick([12, 18, 20, 24]) : difficulty === 2 ? rng.int(20, 60) : rng.int(60, 120);
      const list = divisorsOf(n);
      const display = list.join(', ');
      return {
        params: { n, kind: 'divisors' },
        instruction: '약수를 모두 구하시오.',
        stem: `${numEul(n)} 나누어떨어지게 하는 수를 모두 쓰시오.`,
        answer: { value: list, display, accepts: [display, list.join(' ')] },
        solution: [`${numEul(n)} 나누어떨어지게 하는 수를 작은 것부터 찾는다.`, display],
        dedupeKey: `divisors:${n}`,
        difficulty,
      };
    }
    const base = difficulty === 1 ? rng.int(2, 6) : rng.int(3, 12);
    const count = difficulty === 1 ? 4 : 5;
    const list = Array.from({ length: count }, (_, k) => base * (k + 1));
    const display = list.join(', ');
    return {
      params: { base, count, kind: 'multiples' },
      instruction: '배수를 작은 것부터 구하시오.',
      stem: `${base}의 배수를 작은 것부터 ${count}개 쓰시오.`,
      answer: { value: list, display, accepts: [display, list.join(' ')] },
      solution: [`${base}에 1, 2, 3... 을 차례로 곱한다.`, display],
      dedupeKey: `multiples:${base}:${count}`,
      difficulty,
    };
  },
  verify(params, answer) {
    if (params.kind === 'divisors') {
      // 모든 답이 나누어떨어지게 하고, 빠진 약수가 없고, 작은 것부터여야 한다.
      // 순서를 안 보면 역순 답도 통과해 정답 허용 목록과 어긋난다.
      const every = answer.value.every((v) => params.n % v === 0);
      const complete = divisorsOf(params.n).length === answer.value.length;
      const ascending = answer.value.every((v, i) => i === 0 || answer.value[i - 1] < v);
      return every && complete && ascending;
    }
    // 모든 답이 배수이고 간격이 일정해야 한다.
    return answer.value.every((v, i) => v % params.base === 0 && v === params.base * (i + 1));
  },
};

// ---------------------------------------------------------------------------
// [6수01-05] 최대공약수와 최소공배수
// ---------------------------------------------------------------------------

const gcdLcm = {
  id: 'math.g56.no.s05.gcd-lcm',
  standardCode: CODE(5),
  skill: '최대공약수와 최소공배수',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const askGcd = rng.bool();
    const g = difficulty === 1 ? rng.int(2, 6) : rng.int(2, 12);
    const m = rng.int(2, difficulty === 1 ? 6 : 12);
    const n = rng.until(() => rng.int(2, difficulty === 1 ? 6 : 12), (v) => gcd(v, m) === 1);
    const a = g * m;
    const b = g * n;
    const value = askGcd ? gcd(a, b) : lcm(a, b);
    return {
      params: { a, b, askGcd },
      instruction: askGcd ? '최대공약수를 구하시오.' : '최소공배수를 구하시오.',
      stem: `${a}${josaEng(a)} ${b}의 ${askGcd ? '최대공약수' : '최소공배수'}를 구하시오.`,
      answer: { value, display: num(value), accepts: [num(value)] },
      solution: askGcd
        ? [`${a} = ${g} × ${m}, ${b} = ${g} × ${n}`, `공통인 부분이 ${g}이므로 최대공약수는 ${value}이다.`]
        : [`${a} = ${g} × ${m}, ${b} = ${g} × ${n}`, `최소공배수는 ${g} × ${m} × ${n} = ${value}이다.`],
      dedupeKey: `${askGcd ? 'gcd' : 'lcm'}:${a}:${b}`,
      difficulty,
    };
  },
  verify({ a, b, askGcd }, answer) {
    if (askGcd) {
      // 두 수를 모두 나누고, 그보다 큰 공약수가 없어야 한다.
      if (a % answer.value !== 0 || b % answer.value !== 0) return false;
      for (let k = answer.value + 1; k <= Math.min(a, b); k += 1) {
        if (a % k === 0 && b % k === 0) return false;
      }
      return true;
    }
    // 두 수의 배수이고, 그보다 작은 공배수가 없어야 한다.
    if (answer.value % a !== 0 || answer.value % b !== 0) return false;
    for (let k = Math.max(a, b); k < answer.value; k += 1) {
      if (k % a === 0 && k % b === 0) return false;
    }
    return true;
  },
};

/** 숫자 뒤 '과/와'. 만 단위를 넘는 수도 읽는 소리로 판단한다. */
function josaEng(n) {
  return numberParticle(n, '과', '와');
}

// ---------------------------------------------------------------------------
// [6수01-06~07] 약분·통분, 분모가 다른 분수의 크기 비교
// ---------------------------------------------------------------------------

const reduceFractionItem = {
  id: 'math.g56.no.s06.reduce',
  standardCode: CODE(6),
  skill: '분수를 약분하여 기약분수로 나타내기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const baseD = difficulty === 1 ? rng.int(2, 6) : rng.int(3, 11);
    const baseN = rng.until(() => rng.int(1, baseD - 1), (v) => gcd(v, baseD) === 1);
    const factor = difficulty === 1 ? rng.int(2, 4) : rng.int(2, 8);
    const fraction = makeFraction(baseN * factor, baseD * factor);
    const reduced = makeFraction(baseN, baseD);
    const display = formatFraction(reduced);
    return {
      params: { fraction, reduced },
      instruction: '기약분수로 나타내시오.',
      stem: formatFraction(fraction),
      answer: { value: display, display, accepts: [display] },
      solution: [
        `분자와 분모의 최대공약수는 ${factor}이다.`,
        `${fraction.n} ÷ ${factor} = ${baseN}, ${fraction.d} ÷ ${factor} = ${baseD}`,
        `${display}이다.`,
      ],
      dedupeKey: `reduce:${fraction.n}:${fraction.d}`,
      difficulty,
    };
  },
  verify({ fraction, reduced }, answer) {
    // 기약분수 조건(최대공약수 1)과 원래 분수와 같은 크기인지 함께 확인한다.
    const parsed = /^(\d+)\/(\d+)$/.exec(answer.value);
    if (!parsed) return false;
    const n = Number(parsed[1]);
    const d = Number(parsed[2]);
    return gcd(n, d) === 1 && n * fraction.d === fraction.n * d && n === reduced.n && d === reduced.d;
  },
};

const compareDifferentDenominators = {
  id: 'math.g56.no.s07.compare',
  standardCode: CODE(7),
  skill: '분모가 다른 분수의 크기 비교',
  format: 'compare',
  generate(rng, { difficulty }) {
    // 두 분수를 한 쌍으로 뽑아 재시도한다. a 를 먼저 고정하면 b 의 후보가 전부
    // a 와 같은 크기일 수 있다(예: a = 2/4, 분모 2 -> 1/2 뿐).
    const cap = difficulty === 1 ? 6 : 12;
    const [a, b] = rng.until(
      () => {
        const d1 = rng.int(2, cap);
        const d2 = rng.until(() => rng.int(2, cap), (v) => v !== d1);
        return [makeFraction(rng.int(1, d1 - 1), d1), makeFraction(rng.int(1, d2 - 1), d2)];
      },
      ([x, y]) => compareFractions(x, y) !== 0,
    );
    const sign = compareFractions(a, b) > 0 ? '>' : '<';
    const common = lcm(a.d, b.d);
    return {
      params: { a, b },
      instruction: '□ 안에 >, < 중 알맞은 것을 써넣으시오.',
      stem: `${formatFraction(a)} □ ${formatFraction(b)}`,
      answer: { value: sign, display: sign, accepts: [sign] },
      solution: [
        `두 분모의 최소공배수 ${common}으로 통분한다.`,
        `${formatFraction({ n: (a.n * common) / a.d, d: common })} ${sign} ${formatFraction({ n: (b.n * common) / b.d, d: common })}`,
        `그러므로 ${formatFraction(a)} ${sign} ${formatFraction(b)}이다.`,
      ],
      dedupeKey: `compare-diff-d:${a.n}:${a.d}:${b.n}:${b.d}`,
      difficulty,
    };
  },
  verify({ a, b }, answer) {
    const cmp = compareFractions(a, b);
    return (cmp > 0 && answer.value === '>') || (cmp < 0 && answer.value === '<');
  },
};

// ---------------------------------------------------------------------------
// [6수01-08] 분모가 다른 분수의 덧셈과 뺄셈
// ---------------------------------------------------------------------------

const addSubDifferentDenominators = {
  id: 'math.g56.no.s08.add-sub',
  standardCode: CODE(8),
  skill: '분모가 다른 분수의 덧셈과 뺄셈',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const d1 = difficulty === 1 ? rng.pick([2, 3, 4]) : rng.int(3, 10);
    const d2 = rng.until(() => rng.int(2, difficulty === 1 ? 6 : 12), (v) => v !== d1);
    const isAdd = rng.bool();
    const a = makeFraction(rng.int(1, d1 - 1), d1);
    const b = makeFraction(rng.int(1, d2 - 1), d2);
    const [x, y] = isAdd ? [a, b] : (compareFractions(a, b) > 0 ? [a, b] : [b, a]);
    if (!isAdd && compareFractions(x, y) === 0) return this.generate(rng, { difficulty });
    const result = isAdd ? addFractions(x, y) : subFractions(x, y);
    const display = formatReduced(result);
    const common = lcm(x.d, y.d);
    return {
      params: { x, y, isAdd, result },
      instruction: '계산하시오.',
      stem: `${formatFraction(x)} ${isAdd ? '+' : '-'} ${formatFraction(y)}`,
      answer: { value: display, display, accepts: [display, formatFraction(result)] },
      solution: [
        `최소공배수 ${common}으로 통분한다.`,
        `${(x.n * common) / x.d}/${common} ${isAdd ? '+' : '-'} ${(y.n * common) / y.d}/${common}`,
        `답을 기약분수로 나타내면 ${display}이다.`,
      ],
      dedupeKey: `add-sub-diff-d:${x.n}:${x.d}:${y.n}:${y.d}:${isAdd ? 'a' : 's'}`,
      difficulty,
    };
  },
  verify({ x, y, isAdd, result }, answer) {
    // 역연산으로 되짚는다.
    const back = isAdd ? subFractions(result, y) : addFractions(result, y);
    const expected = reduceFraction(x);
    return back.n === expected.n && back.d === expected.d && answer.value === formatReduced(result);
  },
};

// ---------------------------------------------------------------------------
// [6수01-09~11] 분수의 곱셈과 나눗셈
// ---------------------------------------------------------------------------

const multiplyFractionsItem = {
  id: 'math.g56.no.s09.multiply',
  standardCode: CODE(9),
  skill: '분수의 곱셈',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const mode = difficulty === 1 ? 'by-natural' : rng.pick(['by-natural', 'fraction']);
    if (mode === 'by-natural') {
      const d = rng.int(3, 9);
      const n = rng.int(1, d - 1);
      const k = rng.int(2, 9);
      const a = makeFraction(n, d);
      const result = multiplyFractions(a, makeFraction(k, 1));
      const display = formatReduced(result);
      return {
        params: { a, b: makeFraction(k, 1), result },
        instruction: '계산하시오.',
        stem: `${formatFraction(a)} × ${k}`,
        answer: { value: display, display, accepts: [display, formatFraction(result)] },
        solution: [`분자에 자연수를 곱한다: ${n} × ${k} = ${n * k}`, `${fracEul(`${n * k}/${d}`)} 약분하면 ${display}`],
        dedupeKey: `frac-mul-nat:${n}:${d}:${k}`,
        difficulty,
      };
    }
    const d1 = rng.int(2, 9);
    const d2 = rng.int(2, 9);
    const a = makeFraction(rng.int(1, d1 - 1), d1);
    const b = makeFraction(rng.int(1, d2 - 1), d2);
    const result = multiplyFractions(a, b);
    const display = formatReduced(result);
    return {
      params: { a, b, result },
      instruction: '계산하시오.',
      stem: `${formatFraction(a)} × ${formatFraction(b)}`,
      answer: { value: display, display, accepts: [display, formatFraction(result)] },
      solution: [
        `분자끼리, 분모끼리 곱한다: ${a.n} × ${b.n} = ${a.n * b.n}, ${a.d} × ${b.d} = ${a.d * b.d}`,
        `기약분수로 나타내면 ${display}이다.`,
      ],
      dedupeKey: `frac-mul:${a.n}:${a.d}:${b.n}:${b.d}`,
      difficulty,
    };
  },
  verify({ a, b, result }, answer) {
    // 곱을 한 인수로 나누어 다른 인수가 나오는지 본다.
    const back = divideFractions(result, b);
    const expected = reduceFraction(a);
    return back.n === expected.n && back.d === expected.d && answer.value === formatReduced(result);
  },
};

const divideByNatural = {
  id: 'math.g56.no.s10.divide-natural',
  standardCode: CODE(10),
  skill: '분수를 자연수로 나누기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const d = difficulty === 1 ? rng.int(2, 6) : rng.int(3, 11);
    const n = rng.int(1, d - 1);
    const k = difficulty === 1 ? rng.int(2, 5) : rng.int(2, 9);
    const a = makeFraction(n, d);
    const result = divideFractions(a, makeFraction(k, 1));
    const display = formatReduced(result);
    return {
      params: { a, k, result },
      instruction: '계산하시오.',
      stem: `${formatFraction(a)} ÷ ${k}`,
      answer: { value: display, display, accepts: [display, formatFraction(result)] },
      solution: [
        `자연수로 나누는 것은 그 수의 역수를 곱하는 것과 같다.`,
        `${formatFraction(a)} × 1/${k} = ${formatFraction({ n, d: d * k })}`,
        `기약분수로 나타내면 ${display}이다.`,
      ],
      dedupeKey: `frac-div-nat:${n}:${d}:${k}`,
      difficulty,
    };
  },
  verify({ a, k, result }, answer) {
    // 몫에 나누는 수를 곱하면 원래 분수가 되어야 한다.
    const back = multiplyFractions(result, makeFraction(k, 1));
    const expected = reduceFraction(a);
    return back.n === expected.n && back.d === expected.d && answer.value === formatReduced(result);
  },
};

const divideFractionsItem = {
  id: 'math.g56.no.s11.divide-fraction',
  standardCode: CODE(11),
  skill: '분수의 나눗셈',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const d1 = difficulty === 1 ? rng.int(2, 6) : rng.int(3, 10);
    const d2 = difficulty === 1 ? d1 : rng.int(2, 10);
    const a = makeFraction(rng.int(1, d1 - 1), d1);
    const b = makeFraction(rng.int(1, Math.max(1, d2 - 1)), d2);
    const result = divideFractions(a, b);
    const display = result.d === 1 ? String(result.n) : formatMixed(toMixed(result));
    const accepts = [display, formatFraction(result)];
    return {
      params: { a, b, result },
      instruction: '계산하시오.',
      stem: `${formatFraction(a)} ÷ ${formatFraction(b)}`,
      answer: { value: display, display, accepts },
      solution: [
        '나누는 분수의 분자와 분모를 바꾸어 곱한다.',
        `${formatFraction(a)} × ${formatFraction({ n: b.d, d: b.n })} = ${formatFraction(result)}`,
        result.n > result.d ? `대분수로 나타내면 ${display}이다.` : `${display}이다.`,
      ],
      dedupeKey: `frac-div:${a.n}:${a.d}:${b.n}:${b.d}`,
      difficulty,
    };
  },
  verify({ a, b }, answer) {
    // 답 문자열을 분수로 다시 읽어 나누는 수를 곱한다.
    // params 의 result 를 되읽으면 answer 를 보지 않는 검산이 된다.
    const parsed = parseFractionText(answer.value);
    if (!parsed) return false;
    const back = multiplyFractions(parsed, b);
    const expected = reduceFraction(a);
    return back.n === expected.n && back.d === expected.d;
  },
};

// ---------------------------------------------------------------------------
// [6수01-12] 분수와 소수의 관계
// ---------------------------------------------------------------------------

const fractionDecimalRelation = {
  id: 'math.g56.no.s12.relation',
  standardCode: CODE(12),
  skill: '분수를 소수로, 소수를 분수로',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const scale = difficulty === 1 ? 1 : 2;
    const power = 10 ** scale;
    const toDecimal = rng.bool();
    // 분모가 10의 거듭제곱의 약수여야 유한소수가 된다. 2와 5의 곱으로만 만든다.
    const d = rng.pick(scale === 1 ? [2, 5, 10] : [2, 4, 5, 20, 25, 50, 100]);
    const n = rng.until(() => rng.int(1, d - 1), (v) => gcd(v, d) === 1);
    const units = (n * power) / d;
    if (!Number.isInteger(units)) return this.generate(rng, { difficulty });
    const decimal = makeDecimal(units, scale);
    const fraction = makeFraction(n, d);

    if (toDecimal) {
      return {
        params: { fraction, units, scale },
        instruction: '소수로 나타내시오.',
        stem: formatFraction(fraction),
        answer: { value: formatDecimal(decimal), display: formatDecimal(decimal), accepts: [formatDecimal(decimal)] },
        solution: [
          `분모를 ${power}으로 만든다: ${formatFraction(fraction)} = ${units}/${power}`,
          `${formatDecimal(decimal)}이다.`,
        ],
        dedupeKey: `frac-to-dec:${n}:${d}:${scale}`,
        difficulty,
      };
    }
    const display = formatFraction(fraction);
    return {
      params: { fraction, units, scale, reverse: true },
      instruction: '기약분수로 나타내시오.',
      stem: formatDecimal(decimal),
      answer: { value: display, display, accepts: [display] },
      solution: [
        `${formatDecimal(decimal)} = ${units}/${power}`,
        `약분하면 ${display}이다.`,
      ],
      dedupeKey: `dec-to-frac:${units}:${scale}`,
      difficulty,
    };
  },
  verify({ fraction, units, scale, reverse }, answer) {
    // 답 문자열을 값으로 되읽어 원래 값과 크기가 같은지 교차곱으로 확인한다.
    if (reverse) {
      const parsed = parseFractionText(answer.value);
      if (!parsed) return false;
      // 기약분수를 요구한 문항이므로 약분 상태도 함께 본다.
      return parsed.n * 10 ** scale === units * parsed.d && gcd(parsed.n, parsed.d) === 1;
    }
    const parsed = parseDecimalText(answer.value);
    if (!parsed) return false;
    return parsed.units * fraction.d === fraction.n * 10 ** parsed.scale;
  },
};

// ---------------------------------------------------------------------------
// [6수01-13~15] 소수의 곱셈과 나눗셈
// ---------------------------------------------------------------------------

const multiplyDecimalByNatural = {
  id: 'math.g56.no.s13.mul-natural',
  standardCode: CODE(13),
  skill: '소수와 자연수의 곱셈',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const scale = difficulty === 1 ? 1 : 2;
    const units = rng.int(10 ** scale, 10 ** (scale + 1) * (difficulty === 1 ? 3 : 9));
    const k = difficulty === 1 ? rng.int(2, 5) : rng.int(2, 9);
    const a = makeDecimal(units, scale);
    const result = makeDecimal(units * k, scale);
    return {
      params: { units, scale, k, resultUnits: units * k },
      instruction: '계산하시오.',
      stem: `${formatDecimal(a)} × ${k}`,
      answer: { value: formatDecimal(result), display: formatDecimal(result), accepts: [formatDecimal(result)] },
      solution: [
        `소수점을 무시하고 ${units} × ${k} = ${numEul(units * k)} 계산한다.`,
        `곱하는 소수의 소수점 아래 자리가 ${scale}개이므로 결과도 ${scale}개다.`,
        `${formatDecimal(result)}`,
      ],
      dedupeKey: `dec-mul-nat:${units}:${scale}:${k}`,
      difficulty,
    };
  },
  verify({ units, k, resultUnits, scale }, answer) {
    // 반복 덧셈으로 되짚고 표기도 다시 만들어 비교한다.
    let sum = 0;
    for (let i = 0; i < k; i += 1) sum += units;
    return sum === resultUnits && answer.value === formatDecimal(makeDecimal(resultUnits, scale));
  },
};

const multiplyDecimals = {
  id: 'math.g56.no.s14.mul-decimals',
  standardCode: CODE(14),
  skill: '소수의 곱셈',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const s1 = 1;
    const s2 = difficulty === 1 ? 1 : rng.pick([1, 2]);
    const u1 = rng.int(11, difficulty === 1 ? 49 : 99);
    const u2 = rng.int(10 ** (s2 - 1) + 1, 10 ** (s2 + 1) - 1);
    const a = makeDecimal(u1, s1);
    const b = makeDecimal(u2, s2);
    // 소수점 아래 자리수는 두 수의 자리수를 더한 값이다. 정수 곱으로 계산한다.
    const result = makeDecimal(u1 * u2, s1 + s2);
    return {
      params: { u1, s1, u2, s2 },
      instruction: '계산하시오.',
      stem: `${formatDecimal(a)} × ${formatDecimal(b)}`,
      answer: { value: formatDecimal(result), display: formatDecimal(result), accepts: [formatDecimal(result)] },
      solution: [
        `소수점을 무시하고 ${u1} × ${u2} = ${numEul(u1 * u2)} 계산한다.`,
        `소수점 아래 자리가 ${s1} + ${s2} = ${s1 + s2}개이므로 소수점을 ${s1 + s2}칸 옮긴다.`,
        `${formatDecimal(result)}`,
      ],
      dedupeKey: `dec-mul:${u1}:${s1}:${u2}:${s2}`,
      difficulty,
    };
  },
  verify({ u1, s1, u2, s2 }, answer) {
    // 반복 덧셈으로 정수 곱을 되짚어 부동소수점을 거치지 않는다.
    let product = 0;
    for (let i = 0; i < u2; i += 1) product += u1;
    return answer.value === formatDecimal(makeDecimal(product, s1 + s2));
  },
};

const divideDecimals = {
  id: 'math.g56.no.s15.divide',
  standardCode: CODE(15),
  skill: '소수의 나눗셈',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const scale = difficulty === 1 ? 1 : 2;
    // 나누어떨어지는 문항만 낸다. 몫에 소수점 자리를 정해 두고 거꾸로 만든다.
    const quotientUnits = rng.int(10 ** scale + 1, 10 ** (scale + 1) * 9);
    const divisor = difficulty === 1 ? rng.int(2, 5) : rng.int(2, 9);
    const dividendUnits = quotientUnits * divisor;
    const dividend = makeDecimal(dividendUnits, scale);
    const quotient = makeDecimal(quotientUnits, scale);
    return {
      params: { dividendUnits, quotientUnits, divisor, scale },
      instruction: '계산하시오.',
      stem: `${formatDecimal(dividend)} ÷ ${divisor}`,
      answer: { value: formatDecimal(quotient), display: formatDecimal(quotient), accepts: [formatDecimal(quotient)] },
      solution: [
        `소수점을 무시하고 ${dividendUnits} ÷ ${divisor} = ${numEul(quotientUnits)} 계산한다.`,
        `나누어지는 수의 소수점 위치를 그대로 옮긴다.`,
        `${formatDecimal(quotient)}`,
      ],
      dedupeKey: `dec-div:${dividendUnits}:${divisor}:${scale}`,
      difficulty,
    };
  },
  verify({ dividendUnits, quotientUnits, divisor, scale }, answer) {
    // 몫만큼 반복해서 빼면 정확히 0이 되어야 한다.
    let rest = dividendUnits;
    for (let i = 0; i < divisor; i += 1) rest -= quotientUnits;
    return rest === 0 && answer.value === formatDecimal(makeDecimal(quotientUnits, scale));
  },
};

export const generators = [
  mixedOperations,
  numberRange,
  roundingMethods,
  divisorsAndMultiples,
  gcdLcm,
  reduceFractionItem,
  compareDifferentDenominators,
  addSubDifferentDenominators,
  multiplyFractionsItem,
  divideByNatural,
  divideFractionsItem,
  fractionDecimalRelation,
  multiplyDecimalByNatural,
  multiplyDecimals,
  divideDecimals,
];
