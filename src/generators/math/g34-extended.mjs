/**
 * 2022 개정 초등 수학 3~4학년군 확장 문항 생성기.
 *
 * 기존 생성기가 다루지 않던 표현 방식을 더한다. 세 자리 수 계산의 빈 자리 숫자,
 * 세 자리 수 문장제, 곱셈 문장제, 나머지가 있는 나눗셈 문장제와 나누어지는 수 찾기,
 * 대분수와 가분수 바꾸기, 대분수의 덧셈과 뺄셈, 수 배열과 계산식 배열의 규칙,
 * 각도의 합과 차, 길이의 합과 차다.
 *
 * verify 는 generate 와 다른 경로(역연산, 대입, 나눗셈 불변식)로 답을 확인한다.
 */
import {
  countIda, fracEun, josaEul, josaEun, josaI, numberParticle, numEun, numRo,
} from '../../engine/korean-number.mjs';
import { reducedFractionForms } from '../../engine/rational.mjs';
import { expressionAnswerForms } from '../expression-answer.mjs';

const num = (n) => String(n);
const ORDINALS = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째', '여덟째', '아홉째', '열째'];

// ---------------------------------------------------------------------------
// [4수01-03] 세 자리 수의 덧셈과 뺄셈
// ---------------------------------------------------------------------------

function threeDigitPair(rng, difficulty) {
  return rng.until(() => {
    const a = rng.int(100, 899);
    const b = rng.int(100, 899);
    return { a, b, op: difficulty === 3 ? '-' : (difficulty === 2 ? '+' : rng.pick(['+', '-'])) };
  }, ({ a, b, op }) => {
    const digits = (n) => [n % 10, Math.floor(n / 10) % 10, Math.floor(n / 100)];
    const [a0, a1, a2] = digits(a);
    const [b0, b1, b2] = digits(b);
    if (op === '+') {
      if (a + b > 999) return false;
      const carry = a0 + b0 >= 10 || a1 + b1 >= 10;
      return difficulty === 1 ? !carry && a2 + b2 <= 9 : carry;
    }
    if (a <= b + 99) return false;
    const borrow = a0 < b0 || a1 < b1;
    return difficulty === 1 ? !borrow && a2 > b2 : borrow;
  }, 1000);
}

const missingDigit3 = {
  id: 'math.g34.no.s03.missing-digit',
  standardCode: '[4수01-03]',
  skill: '세 자리 수의 덧셈식·뺄셈식에서 빈 자리 숫자 찾기',
  format: 'fill-blank',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 받아올림·받아내림이 없는 계산, 2는 받아올림이 있는 덧셈, 3은 받아내림이 있는 뺄셈이다.',
  generate(rng, { difficulty }) {
    const { a, b, op } = threeDigitPair(rng, difficulty);
    const r = op === '+' ? a + b : a - b;
    const terms = [a, b, r];
    const term = rng.int(0, 2);
    const width = String(terms[term]).length;
    const place = rng.int(0, width - 1);
    const text = terms.map(String);
    const digits = text[term].split('');
    const at = width - 1 - place;
    const hidden = Number(digits[at]);
    digits[at] = '□';
    text[term] = digits.join('');
    return {
      params: { shown: text, op },
      instruction: '□ 안에 알맞은 숫자를 써넣으시오.',
      stem: `${text[0]} ${op} ${text[1]} = ${text[2]}`,
      answer: { value: hidden, display: num(hidden), accepts: [num(hidden)] },
      solution: [
        term === 2
          ? `${a} ${op} ${b} = ${r}이다.`
          : `□가 있는 수는 ${term === 0 ? (op === '+' ? `${r} - ${b}` : `${r} + ${b}`) : (op === '+' ? `${r} - ${a}` : `${a} - ${r}`)} = ${terms[term]}이다.`,
        `□에 알맞은 숫자는 ${hidden}이다.`,
      ],
      dedupeKey: `missing-digit3:${a}${op}${b}:${term}:${place}`,
      difficulty,
    };
  },
  verify({ shown, op }, answer) {
    if (!Number.isInteger(answer.value) || answer.value < 0 || answer.value > 9) return false;
    const [x, y, z] = shown.map((t) => Number(t.replace('□', String(answer.value))));
    return op === '+' ? x + y === z : x - y === z;
  },
};

const STORY3 = [
  { noun: '종이컵', counter: '개', where: '창고' },
  { noun: '공책', counter: '권', where: '도서실' },
  { noun: '색종이', counter: '장', where: '미술실' },
  { noun: '귤', counter: '개', where: '과일 가게' },
  { noun: '꽃', counter: '송이', where: '꽃집' },
];

const story3 = {
  id: 'math.g34.no.s03.story',
  standardCode: '[4수01-03]',
  skill: '세 자리 수의 덧셈과 뺄셈 문장제',
  format: 'write-expression',
  generate(rng, { difficulty }) {
    const [lo, hi] = difficulty === 1 ? [100, 499] : difficulty === 2 ? [200, 699] : [300, 999];
    const kind = rng.pick(['total', 'more', 'left', 'after-sale']);
    const t = rng.pick(STORY3);
    const { noun: N, counter: C, where } = t;
    let a = rng.int(lo, hi);
    let b = rng.until(() => rng.int(Math.max(100, Math.floor(lo / 2)), hi), (v) => v !== a);
    if (kind === 'total') {
      while (a + b > 999) { a = Math.floor(a / 2) + 50; b = Math.floor(b / 2) + 50; }
      if (a === b) b += 1;
    } else if (a < b) {
      [a, b] = [b, a];
    }
    // 빼는 수가 꼭 절반이면 답이 문제에 그대로 보인다.
    if (!(kind === 'total') && a === 2 * b) a += 1;
    const add = kind === 'total';
    const value = add ? a + b : a - b;
    const stems = {
      total: `${where}에 ${N}${josaI(N)} 어제 ${a}${C}, 오늘 ${b}${C} 들어왔습니다. 이틀 동안 들어온 ${N}${josaEun(N)} 모두 몇 ${C}입니까?`,
      more: `${where}에 있는 ${N}${josaEun(N)} ${a}${C}, 다른 곳에 있는 ${N}${josaEun(N)} ${b}${C}입니다. ${where}에 있는 ${N}${josaI(N)} 몇 ${C} 더 많습니까?`,
      left: `${where}에 ${N}${josaI(N)} ${a}${C} 있었습니다. 그중 ${b}${C}${josaEul(C)} 다른 곳으로 보냈습니다. ${where}에 남은 ${N}${josaEun(N)} 몇 ${C}입니까?`,
      'after-sale': `${where}에서 ${N}${josaEul(N)} ${a}${C} 준비해서 ${b}${C}${josaEul(C)} 나누어 주었습니다. 남은 ${N}${josaEun(N)} 몇 ${C}입니까?`,
    };
    const expr = `${a} ${add ? '+' : '-'} ${b} = ${value}`;
    return {
      params: { a, b, add },
      instruction: '식을 쓰고 답을 구하시오.',
      stem: stems[kind],
      answer: { value, display: `${value}${C}`, accepts: [num(value), `${value}${C}`, expr, ...expressionAnswerForms([expr], value, C)] },
      solution: [
        add ? '두 날 들어온 수를 모두 더한다.' : '큰 수에서 작은 수를 빼서 차이나 남은 수를 구한다.',
        expr,
        `답은 ${countIda(value, C)}.`,
      ],
      // 맥락(명사)만 다른 같은 계산은 같은 문항으로 센다. 나눠 주고 남은 수도 옮기고 남은 수와 같은 셈이다.
      dedupeKey: `story3:${kind === 'after-sale' ? 'left' : kind}:${a}:${b}`,
      difficulty,
    };
  },
  verify({ a, b, add }, answer) {
    const v = answer.value;
    return Number.isInteger(v) && (add ? v - b === a : v + b === a);
  },
};

// ---------------------------------------------------------------------------
// [4수01-04] 곱셈 · [4수01-06]~[4수01-07] 나눗셈
// ---------------------------------------------------------------------------

/** max 는 한 묶음에 들어갈 수 있는 생활 상식의 상한이다. */
const GROUPS = [
  { noun: '사탕', counter: '개', unit: '상자', max: 499 },
  { noun: '단추', counter: '개', unit: '봉지', max: 499 },
  { noun: '색종이', counter: '장', unit: '묶음', max: 499 },
  { noun: '학생', counter: '명', unit: '반', max: 35 },
  { noun: '의자', counter: '개', unit: '줄', max: 30 },
  { noun: '귤', counter: '개', unit: '상자', max: 99 },
];

const storyMultiply = {
  id: 'math.g34.no.s04.story-multiply',
  standardCode: '[4수01-04]',
  skill: '같은 수씩 여러 묶음인 상황을 곱셈식으로 나타내고 계산하기',
  format: 'write-expression',
  generate(rng, { difficulty }) {
    const [lo, hi] = difficulty === 1 ? [11, 49] : difficulty === 2 ? [101, 499] : [12, 99];
    // 두 자리 수 묶음을 여러 개 쓰는 난이도 3에는 반·줄처럼 수가 제한된 맥락을 빼다.
    const g = rng.pick(GROUPS.filter((x) => x.max >= (difficulty === 3 ? 99 : lo + 10)));
    const per = rng.int(lo, Math.min(hi, g.max));
    const groups = difficulty === 3 ? rng.int(11, 39) : rng.int(2, 9);
    const total = per * groups;
    const expr = `${per} × ${groups} = ${total}`;
    return {
      params: { per, groups },
      instruction: '식을 쓰고 답을 구하시오.',
      stem: `${g.noun}${josaI(g.noun)} 한 ${g.unit}에 ${per}${g.counter}씩 ${groups}${g.unit} 있습니다. ${g.noun}${josaEun(g.noun)} 모두 몇 ${g.counter}입니까?`,
      answer: { value: total, display: `${total}${g.counter}`, accepts: [num(total), `${total}${g.counter}`, expr, ...expressionAnswerForms([expr], total, g.counter)] },
      solution: [`한 ${g.unit}에 ${per}${g.counter}씩 ${groups}${g.unit}이므로 곱셈으로 구한다.`, expr, `답은 ${total}${g.counter}이다.`],
      dedupeKey: `story-multiply:${per}:${groups}`,
      difficulty,
    };
  },
  verify({ per, groups }, answer) {
    // 곱을 묶음 수로 나누어 한 묶음의 수가 되돌아오는지 본다.
    const v = answer.value;
    return Number.isInteger(v) && v % groups === 0 && v / groups === per;
  },
};

const PACKING = [
  { noun: '구슬', counter: '개', box: '봉지' },
  { noun: '사탕', counter: '개', box: '상자' },
  { noun: '귤', counter: '개', box: '바구니' },
  { noun: '쿠키', counter: '개', box: '접시' },
];

const storyRemainder = {
  id: 'math.g34.no.s06.story-remainder',
  standardCode: '[4수01-06]',
  skill: '나머지가 있는 나눗셈 상황에서 몫과 나머지의 뜻 해석하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const divisor = rng.int(2, 9);
    const total = rng.until(
      () => (difficulty === 1 ? rng.int(10, 89) : difficulty === 2 ? rng.int(100, 499) : rng.int(500, 999)),
      (v) => v % divisor !== 0,
    );
    const kind = rng.pick(['left', 'full', 'at-least']);
    const p = rng.pick(PACKING);
    const q = Math.floor(total / divisor);
    const r = total % divisor;
    const intro = `${p.noun} ${total}${p.counter}${josaEul(p.counter)} 한 ${p.box}에 ${divisor}${p.counter}씩 담으려고 합니다.`;
    const asks = {
      left: { tail: `${p.box}에 담고 남는 ${p.noun}${josaEun(p.noun)} 몇 ${p.counter}입니까?`, value: r, unit: p.counter },
      full: { tail: `${divisor}${p.counter}씩 가득 담은 ${p.box}${josaEun(p.box)} 몇 ${p.box}입니까?`, value: q, unit: p.box },
      'at-least': { tail: `${p.noun}${josaEul(p.noun)} 남김없이 모두 담으려면 ${p.box}${josaI(p.box)} 적어도 몇 개 필요합니까?`, value: q + 1, unit: '개' },
    };
    const ask = asks[kind];
    return {
      params: { kind, total, divisor },
      instruction: '물음에 답하시오.',
      stem: `${intro} ${ask.tail}`,
      answer: { value: ask.value, display: `${ask.value}${ask.unit}`, accepts: [num(ask.value), `${ask.value}${ask.unit}`] },
      solution: [
        `${total} ÷ ${divisor} = ${q} ··· ${r}이다.`,
        kind === 'left'
          ? `나머지 ${numEun(r)} 담지 못하고 남는 ${p.noun}의 수이다.`
          : kind === 'full'
            ? `몫 ${numEun(q)} 가득 담은 ${p.box}의 수이다.`
            : `남는 ${r}${p.counter}도 담아야 하므로 몫보다 하나 많은 ${q + 1}개가 필요하다.`,
      ],
      dedupeKey: `story-remainder:${kind}:${total}:${divisor}`,
      difficulty,
    };
  },
  verify({ kind, total, divisor }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v < 0) return false;
    // 곱셈으로 되짚어 몫·나머지의 범위를 확인한다.
    if (kind === 'left') return v < divisor && (total - v) % divisor === 0;
    if (kind === 'full') return v * divisor <= total && total < (v + 1) * divisor;
    return (v - 1) * divisor < total && total <= v * divisor;
  },
};

function makeFindDividend(id, standardCode, skill, divisorRange) {
  return {
    id,
    standardCode,
    skill,
    format: 'short-answer',
    generate(rng, { difficulty }) {
      const divisor = rng.int(...divisorRange);
      const quotientCap = Math.min(difficulty === 1 ? 9 : difficulty === 2 ? 30 : 99, Math.floor((999 - divisor + 1) / divisor));
      const quotient = rng.int(difficulty === 1 ? 2 : Math.min(10, quotientCap), quotientCap);
      const remainder = rng.int(1, divisor - 1);
      const dividend = divisor * quotient + remainder;
      return {
        params: { divisor, quotient, remainder },
        instruction: '물음에 답하시오.',
        stem: `어떤 수를 ${numRo(divisor)} 나누었더니 몫이 ${quotient}이고 나머지가 ${remainder}${numberParticle(remainder, '이었습니다', '였습니다')}.`
          + ' 어떤 수는 얼마입니까?',
        answer: { value: dividend, display: num(dividend), accepts: [num(dividend)] },
        solution: [
          '나누는 수와 몫을 곱한 뒤 나머지를 더하면 나누어지는 수가 된다.',
          `${divisor} × ${quotient} = ${divisor * quotient}, ${divisor * quotient} + ${remainder} = ${dividend}이다.`,
        ],
        dedupeKey: `find-dividend:${divisor}:${quotient}:${remainder}`,
        difficulty,
      };
    },
    verify({ divisor, quotient, remainder }, answer) {
      // 답을 실제로 나누어 몫과 나머지가 같은지 본다.
      const v = answer.value;
      return Number.isInteger(v) && Math.floor(v / divisor) === quotient && v % divisor === remainder;
    },
  };
}

const findDividend1 = makeFindDividend(
  'math.g34.no.s06.find-dividend',
  '[4수01-06]',
  '몫과 나머지로 나누어지는 수 구하기(나누는 수가 한 자리 수)',
  [2, 9],
);
const findDividend2 = makeFindDividend(
  'math.g34.no.s07.find-dividend',
  '[4수01-07]',
  '몫과 나머지로 나누어지는 수 구하기(나누는 수가 두 자리 수)',
  [11, 49],
);

// ---------------------------------------------------------------------------
// [4수01-10] 대분수와 가분수 · [4수01-15] 분모가 같은 분수의 덧셈과 뺄셈
// ---------------------------------------------------------------------------

const mixedText = (whole, n, d) => (n === 0 ? `${whole}` : whole === 0 ? `${n}/${d}` : `${whole} ${n}/${d}`);

/**
 * '2 3/5', '13/5', '3' 을 분모 d 의 분자 하나로 바꾼다.
 * 약분한 답(13 3/5)처럼 분모가 달라도 값이 같으면 교차 곱으로 분모 d 에 맞춘다. 맞출 수 없으면 null.
 */
function toNumerator(text, d) {
  const mixed = /^(\d+) (\d+)\/(\d+)$/.exec(text);
  const frac = /^(\d+)\/(\d+)$/.exec(text);
  if (!mixed && !frac) return /^\d+$/.test(text) ? Number(text) * d : null;
  const den = Number(mixed ? mixed[3] : frac[2]);
  if (mixed && !(Number(mixed[2]) > 0 && Number(mixed[2]) < den)) return null;
  const top = mixed ? Number(mixed[1]) * den + Number(mixed[2]) : Number(frac[1]);
  if (den === 0 || (top * d) % den !== 0) return null;
  return (top * d) / den;
}

const mixedToImproper = {
  id: 'math.g34.no.s10.to-improper',
  standardCode: '[4수01-10]',
  skill: '대분수를 가분수로 나타내기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const d = difficulty === 1 ? rng.int(2, 9) : difficulty === 2 ? rng.int(3, 25) : rng.int(6, 40);
    const whole = difficulty === 1 ? rng.int(1, 9) : difficulty === 2 ? rng.int(2, 40) : rng.int(5, 60);
    const n = rng.int(1, d - 1);
    const top = whole * d + n;
    const display = `${top}/${d}`;
    return {
      params: { whole, n, d },
      instruction: '대분수를 가분수로 나타내시오.',
      stem: mixedText(whole, n, d),
      // 약분한 가분수(10/4 대신 5/2)도 같은 값의 가분수이므로 받는다.
      answer: { value: display, display, accepts: [...new Set([display, ...reducedFractionForms({ n: top, d }).filter((f) => !f.includes(' '))])] },
      solution: [
        `자연수 ${numEun(whole)} 1/${d}이 ${whole * d}개인 수이다.`,
        `${whole * d} + ${n} = ${top}이므로 ${display}이다.`,
      ],
      dedupeKey: `to-improper:${whole}:${n}:${d}`,
      difficulty,
    };
  },
  verify({ whole, n, d }, answer) {
    const m = /^(\d+)\/(\d+)$/.exec(String(answer.value));
    if (!m || Number(m[2]) === 0) return false;
    // 가분수를 분모 d 로 되돌려(교차 곱) 다시 대분수로 나누어 본다.
    const [top, den] = [Number(m[1]), Number(m[2])];
    if (top <= den || (top * d) % den !== 0) return false;
    const back = (top * d) / den;
    return Math.floor(back / d) === whole && back % d === n;
  },
};

const mixedAddSub = {
  id: 'math.g34.no.s15.mixed-add-sub',
  standardCode: '[4수01-15]',
  skill: '분모가 같은 대분수의 덧셈과 뺄셈',
  format: 'short-answer',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 분수 부분끼리 받아올림·받아내림이 없는 계산, 2는 분수 부분의 합이 1 이상인 덧셈, 3은 자연수에서 1을 받아내리는 뺄셈이다.',
  generate(rng, { difficulty }) {
    const d = rng.int(3, 12);
    const isAdd = difficulty === 2 || (difficulty === 1 && rng.bool());
    const { aw, an, bw, bn } = rng.until(() => ({
      aw: rng.int(1, 9), an: rng.int(1, d - 1), bw: rng.int(1, 9), bn: rng.int(1, d - 1),
    }), (x) => {
      if (isAdd) {
        if (x.an + x.bn === d) return false;
        return difficulty === 1 ? x.an + x.bn < d : x.an + x.bn > d;
      }
      if (x.an === x.bn || (x.aw * d + x.an) === 2 * (x.bw * d + x.bn)) return false;
      if (difficulty === 1) return x.aw > x.bw && x.an > x.bn;
      return x.aw > x.bw + 1 && x.an < x.bn;
    }, 400);
    const A = aw * d + an;
    const B = bw * d + bn;
    const R = isAdd ? A + B : A - B;
    const display = mixedText(Math.floor(R / d), R % d, d);
    const op = isAdd ? '+' : '-';
    return {
      params: { A, B, d, isAdd },
      instruction: '계산하시오.',
      stem: `${mixedText(aw, an, d)} ${op} ${mixedText(bw, bn, d)}`,
      answer: { value: display, display, accepts: [...new Set([display, `${R}/${d}`, ...reducedFractionForms({ n: R, d })])] },
      solution: isAdd
        ? [
          `자연수끼리 더하면 ${aw} + ${bw} = ${aw + bw}, 분수끼리 더하면 ${an}/${d} + ${bn}/${d} = ${an + bn}/${d}이다.`,
          an + bn > d ? `${fracEun(`${an + bn}/${d}`)} 1과 ${an + bn - d}/${d}이므로 답은 ${display}이다.` : `답은 ${display}이다.`,
        ]
        : [
          an < bn
            ? `분수끼리 뺄 수 없으므로 자연수에서 1을 받아내린다: ${mixedText(aw, an, d)} = ${aw - 1} ${an + d}/${d}`
            : `자연수끼리, 분수끼리 뺀다: ${aw} - ${bw} = ${aw - bw}, ${an}/${d} - ${bn}/${d} = ${an - bn}/${d}`,
          `답은 ${display}이다.`,
        ],
      dedupeKey: `mixed-add-sub:${A}${op}${B}:${d}`,
      difficulty,
    };
  },
  verify({ A, B, d, isAdd }, answer) {
    const R = toNumerator(String(answer.value), d);
    if (R === null) return false;
    return isAdd ? R - B === A : R + B === A;
  },
};

// ---------------------------------------------------------------------------
// [4수02-01] 변화 규칙 · [4수02-02] 계산식의 배열
// ---------------------------------------------------------------------------

const nthTerm = {
  id: 'math.g34.mr.s02-01.nth-term',
  standardCode: '[4수02-01]',
  skill: '일정하게 변하는 수의 배열에서 몇째 수 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const step = difficulty === 1 ? rng.int(2, 5) : difficulty === 2 ? rng.int(3, 15) : rng.int(11, 75);
    const position = difficulty === 1 ? rng.int(6, 7) : difficulty === 2 ? rng.int(7, 9) : rng.int(8, 10);
    const growing = difficulty === 1 ? true : rng.bool();
    const span = step * (position - 1);
    const start = growing ? rng.int(1, difficulty === 3 ? 500 : 99) : rng.int(span + 1, span + (difficulty === 3 ? 500 : 99));
    const terms = [0, 1, 2, 3].map((k) => (growing ? start + step * k : start - step * k));
    const value = growing ? start + span : start - span;
    return {
      params: { terms, position },
      instruction: '수의 배열에서 규칙을 찾아 답하시오.',
      stem: `${terms.join(', ')}, ...\n이 규칙에 따라 수를 늘어놓을 때 ${ORDINALS[position - 1]} 수는 무엇입니까?`,
      answer: { value, display: num(value), accepts: [num(value)] },
      solution: [
        `${step}씩 ${growing ? '커지는' : '작아지는'} 규칙이다.`,
        `${ORDINALS[position - 1]} 수는 ${start} ${growing ? '+' : '-'} ${step} × ${position - 1} = ${value}이다.`,
      ],
      dedupeKey: `nth-term:${start}:${growing ? '' : '-'}${step}:${position}`,
      difficulty,
    };
  },
  verify({ terms, position }, answer) {
    // 보이는 수들의 차로 규칙을 다시 읽고 한 칸씩 이어 간다.
    const diff = terms[1] - terms[0];
    if (terms.some((t, k) => k > 0 && t - terms[k - 1] !== diff)) return false;
    let v = terms[terms.length - 1];
    for (let k = terms.length; k < position; k += 1) v += diff;
    return answer.value === v;
  },
};

const expressionSequence = {
  id: 'math.g34.mr.s02-02.expression-sequence',
  standardCode: '[4수02-02]',
  skill: '계산식의 배열에서 규칙을 찾아 다음 계산 결과 추측하기',
  format: 'short-answer',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 백 단위로 커지는 덧셈식, 2는 덧셈식이나 뺄셈식, 3은 곱셈식의 배열이다.',
  generate(rng, { difficulty }) {
    const op = difficulty === 1 ? '+' : difficulty === 2 ? rng.pick(['+', '-']) : '×';
    let rows;
    if (op === '×') {
      const m = rng.int(3, 9);
      const base = rng.int(11, 40);
      const s = rng.pick([10, 11, 100, 101, 111]);
      rows = [0, 1, 2, 3, 4].map((k) => [base + s * k, m]);
    } else {
      const unit = difficulty === 1 ? 100 : rng.pick([10, 100]);
      const a = rng.int(1, 5) * unit + rng.int(0, 9) * (unit / 10);
      const b = rng.int(1, 4) * unit;
      const sa = rng.pick([1, 2]) * unit;
      // 뺄셈에서 두 수가 같은 만큼 변하면 결과가 그대로여서 규칙을 찾을 거리가 없다.
      const sb = op === '+' ? rng.pick([1, 2]) * unit : (sa === unit ? 0 : rng.pick([0, 1]) * unit);
      const start = op === '-' ? [a + 6 * unit, b] : [a, b];
      rows = [0, 1, 2, 3, 4].map((k) => [start[0] + sa * k, start[1] + sb * k]);
    }
    const calc = ([x, y]) => (op === '+' ? x + y : op === '-' ? x - y : x * y);
    const shown = rows.slice(0, 4).map((r) => `${r[0]} ${op} ${r[1]} = ${calc(r)}`);
    const value = calc(rows[4]);
    return {
      params: { results: rows.slice(0, 4).map(calc), op },
      instruction: '계산식의 배열을 보고 물음에 답하시오.',
      stem: `${shown.join('\n')}\n규칙에 따라 다섯째 계산식의 계산 결과를 구하시오.`,
      answer: { value, display: num(value), accepts: [num(value)] },
      solution: [
        calc(rows[1]) === calc(rows[0])
          ? '계산 결과가 모두 같다.'
          : `계산 결과가 ${Math.abs(calc(rows[1]) - calc(rows[0]))}씩 ${calc(rows[1]) > calc(rows[0]) ? '커진다' : '작아진다'}.`,
        `다섯째 계산식은 ${rows[4][0]} ${op} ${rows[4][1]} = ${value}이다.`,
      ],
      dedupeKey: `expr-seq:${op}:${rows.map((r) => r.join(op)).join('|')}`,
      difficulty,
    };
  },
  verify({ results }, answer) {
    // 결과끼리의 차가 일정하면 그 차를 한 번 더 이어 붙인다.
    const diff = results[1] - results[0];
    if (results.some((r, k) => k > 0 && r - results[k - 1] !== diff)) return false;
    return answer.value - results[results.length - 1] === diff;
  },
};

// ---------------------------------------------------------------------------
// [4수03-24] 각도의 합과 차 · [4수03-16] 길이의 합과 차
// ---------------------------------------------------------------------------

const angleAddSub = {
  id: 'math.g34.gd.s24.angle-add-sub',
  standardCode: '[4수03-24]',
  skill: '각도의 합과 차 구하기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    const unit = difficulty === 1 ? 10 : difficulty === 2 ? 5 : 1;
    // 각도기로 재는 각은 180°까지다. 난이도 3에서만 두 각의 합이 180°를 넘을 수 있다.
    const cap = difficulty === 3 ? 360 : 180;
    const isAdd = rng.bool();
    const { a, b } = rng.until(() => ({ a: rng.int(1, 180 / unit) * unit, b: rng.int(1, 180 / unit) * unit }), ({ a: x, b: y }) => (
      isAdd ? x + y <= cap : x > y && x !== 2 * y
    ));
    const value = isAdd ? a + b : a - b;
    return {
      params: { a, b, isAdd },
      instruction: '□ 안에 알맞은 수를 써넣으시오.',
      stem: `${a}° ${isAdd ? '+' : '-'} ${b}° = □°`,
      answer: { value, display: `${value}°`, accepts: [num(value), `${value}°`] },
      solution: [`각도의 합과 차는 자연수의 덧셈, 뺄셈과 같은 방법으로 계산하고 단위 °를 붙인다.`, `${a} ${isAdd ? '+' : '-'} ${b} = ${value}이므로 ${value}°이다.`],
      dedupeKey: `angle-add-sub:${a}${isAdd ? '+' : '-'}${b}`,
      difficulty,
    };
  },
  verify({ a, b, isAdd }, answer) {
    const v = answer.value;
    return Number.isInteger(v) && v > 0 && (isAdd ? v - a === b : v + b === a);
  },
};

const LENGTH_PAIRS = {
  'cm-mm': { big: 'cm', small: 'mm', rate: 10, bigMax: 30 },
  'km-m': { big: 'km', small: 'm', rate: 1000, bigMax: 9 },
};

const lengthAddSub = {
  id: 'math.g34.mr.s03-16.length-add-sub',
  standardCode: '[4수03-16]',
  skill: '몇 cm 몇 mm, 몇 km 몇 m의 덧셈과 뺄셈',
  format: 'short-answer',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 받아올림·받아내림이 없는 계산, 2는 작은 단위끼리 더해 큰 단위로 받아올리는 덧셈, 3은 큰 단위에서 받아내리는 뺄셈이다.',
  generate(rng, { difficulty }) {
    const pairKey = rng.pick(Object.keys(LENGTH_PAIRS));
    const P = LENGTH_PAIRS[pairKey];
    const isAdd = difficulty === 2 || (difficulty === 1 && rng.bool());
    const { a, b } = rng.until(() => ({
      a: rng.int(1, P.bigMax) * P.rate + rng.int(1, P.rate - 1),
      b: rng.int(1, P.bigMax) * P.rate + rng.int(1, P.rate - 1),
    }), ({ a: x, b: y }) => {
      const xs = x % P.rate;
      const ys = y % P.rate;
      if (isAdd) {
        if ((x + y) % P.rate === 0 || x + y >= (P.bigMax + 1) * P.rate * 2) return false;
        return difficulty === 1 ? xs + ys < P.rate : xs + ys > P.rate;
      }
      if (x - y < P.rate || (x - y) % P.rate === 0 || x === 2 * y) return false;
      return difficulty === 1 ? xs > ys : xs < ys;
    }, 600);
    const fmt = (v) => `${Math.floor(v / P.rate)}${P.big} ${v % P.rate}${P.small}`;
    const result = isAdd ? a + b : a - b;
    const display = fmt(result);
    return {
      params: { a, b, isAdd, pair: pairKey },
      instruction: '계산하시오.',
      stem: `${fmt(a)} ${isAdd ? '+' : '-'} ${fmt(b)}`,
      answer: { value: display, display, accepts: [display, display.replace(' ', ''), `${result}${P.small}`] },
      solution: [
        `1${P.big}는 ${P.rate}${P.small}이다. 같은 단위끼리 계산한다.`,
        `${fmt(a)} ${isAdd ? '+' : '-'} ${fmt(b)} = ${display}이다.`,
      ],
      dedupeKey: `length34:${pairKey}:${a}${isAdd ? '+' : '-'}${b}`,
      difficulty,
    };
  },
  verify({ a, b, isAdd, pair }, answer) {
    const P = LENGTH_PAIRS[pair];
    const text = String(answer.value);
    const both = new RegExp(`^(\\d+)${P.big} ?(\\d+)${P.small}$`).exec(text);
    const only = new RegExp(`^(\\d+)${P.small}$`).exec(text);
    let v = null;
    if (both && Number(both[2]) < P.rate) v = Number(both[1]) * P.rate + Number(both[2]);
    else if (only) v = Number(only[1]);
    if (v === null) return false;
    return isAdd ? v - b === a : v + b === a;
  },
};

export const generators = [
  missingDigit3,
  story3,
  storyMultiply,
  storyRemainder,
  findDividend1,
  findDividend2,
  mixedToImproper,
  mixedAddSub,
  nthTerm,
  expressionSequence,
  angleAddSub,
  lengthAddSub,
];

