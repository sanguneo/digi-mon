/**
 * 2022 개정 초등 수학 3~4학년군 '수와 연산' [4수01-01]~[4수01-16] 문항 생성기.
 *
 * 분수·소수는 engine/rational.mjs 의 정수 연산만 쓴다.
 * 부동소수점으로 4.7 - 1.9 를 계산하면 2.8000000000000003 이 되어 정답이 틀린다.
 */
import { buildChoices } from '../../engine/item.mjs';
import { NAMES, THINGS } from '../corpus.mjs';
import {
  josaEul,
  josaEun,
  josaI,
  fracEul,
  fracEun,
  numEun,
  numEul,
  numI,
  parseSinoKoreanLarge,
  sinoKorean,
  numRo,
  sinoKoreanLarge,
} from '../../engine/korean-number.mjs';
import {
  DECIMAL_PLACE_NAMES,
  addDecimals,
  addFractions,
  addSameDenominator,
  compareDecimals,
  compareFractions,
  decimalDigitAt,
  formatDecimal,
  formatFraction,
  formatMixed,
  fractionKind,
  fractionToDecimal,
  FRACTION_KINDS,
  makeDecimal,
  makeFraction,
  readFraction,
  reduceFraction,
  subDecimals,
  subFractions,
  parseFractionText,
  subSameDenominator,
  formatUnreducedFraction,
  toMixed,
} from '../../engine/rational.mjs';

const CODE = (n) => `[4수01-${String(n).padStart(2, '0')}]`;
const num = (n) => String(n);

function distractors(correct, candidates) {
  const out = [];
  for (const c of candidates) {
    if (c === correct || out.includes(c) || c === null || c === undefined) continue;
    out.push(c);
  }
  return out;
}

// ---------------------------------------------------------------------------
// [4수01-01] 만·억·조의 자릿값과 십진법
// ---------------------------------------------------------------------------

/** 만 단위 자리 이름. 자릿값 문항의 정답 근거가 된다. */
const BIG_PLACE_NAMES = ['일', '십', '백', '천', '만', '십만', '백만', '천만', '억', '십억', '백억', '천억'];

function digitAtPlace(n, place) {
  return Math.floor(n / 10 ** place) % 10;
}

const readBigNumberItem = {
  id: 'math.g34.no.s01.read-big',
  standardCode: CODE(1),
  skill: '큰 수 읽기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    // 난이도가 자릿수를 정한다. 만 -> 천만 -> 억 순으로 커진다.
    const digits = difficulty === 1 ? rng.int(5, 6) : difficulty === 2 ? rng.int(7, 8) : rng.int(9, 10);
    const n = rng.int(10 ** (digits - 1), 10 ** digits - 1);
    const reading = sinoKoreanLarge(n);
    return {
      params: { n },
      instruction: '수를 읽는 방법을 한글로 쓰시오.',
      stem: `${n}`,
      answer: { value: reading, display: reading, accepts: [reading, reading.replaceAll(' ', '')] },
      solution: [
        '오른쪽에서 네 자리씩 끊어 만, 억, 조 단위로 읽는다.',
        `${n} -> ${reading}`,
      ],
      dedupeKey: `read-big:${n}`,
      difficulty,
    };
  },
  verify({ n }, answer) {
    // 읽은 말을 숫자로 되돌려 확인한다. 만 단위 역파서가 독립 경로다.
    return parseSinoKoreanLarge(answer.value) === n;
  },
};

const bigPlaceValue = {
  id: 'math.g34.no.s01.place-value',
  standardCode: CODE(1),
  skill: '큰 수의 자릿값 구하기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const digits = difficulty === 1 ? 5 : difficulty === 2 ? rng.int(6, 7) : rng.int(8, 9);
    const n = rng.until(
      () => rng.int(10 ** (digits - 1), 10 ** digits - 1),
      (v) => String(v).split('').some((d, idx) => d !== '0' && idx > 0),
    );
    // 일의 자리는 묻지 않는다. '숫자 3은 3을 나타낸다'는 자릿값을 재지 않고,
    // 오답 후보도 만들 수 없다(정답 1일 때 후보가 전부 중복으로 사라진다).
    const places = Array.from({ length: digits }, (_, k) => k)
      .filter((p) => p >= 1 && digitAtPlace(n, p) !== 0);
    const place = rng.pick(places);
    const d = digitAtPlace(n, place);
    const value = d * 10 ** place;
    // 전형적 오류를 오답으로 쓴다: 자릿값 무시, 한 자리 밀림, 계수 무시
    const wrong = distractors(value, [
      d,
      d * 10 ** (place - 1),
      d * 10 ** (place + 1),
      10 ** place,
      d * 10 ** (place + 2),
    ]).filter((v) => v > 0);
    return {
      params: { n, place, d },
      instruction: '알맞은 것을 고르시오.',
      stem: `${n}에서 숫자 ${numEun(d)} 얼마를 나타냅니까?`,
      choices: buildChoices(rng, value, wrong.slice(0, 3)),
      answer: { value, display: num(value), accepts: [num(value)] },
      solution: [
        `숫자 ${numEun(d)} ${BIG_PLACE_NAMES[place]}의 자리에 있다.`,
        `${d} × ${10 ** place} = ${value}`,
      ],
      dedupeKey: `big-place:${n}:${place}`,
      difficulty,
    };
  },
  verify({ n, place, d }, answer) {
    // 나타내는 값을 빼면 그 자리가 0이 되어야 한다.
    return digitAtPlace(n - answer.value, place) === 0 && d * 10 ** place === answer.value;
  },
};

// ---------------------------------------------------------------------------
// [4수01-02] 큰 수의 계열과 크기 비교
// ---------------------------------------------------------------------------

const compareBigNumbers = {
  id: 'math.g34.no.s02.compare',
  standardCode: CODE(2),
  skill: '큰 수의 크기 비교',
  format: 'compare',
  generate(rng, { difficulty }) {
    const digits = difficulty === 1 ? 5 : difficulty === 2 ? 7 : 9;
    const a = rng.int(10 ** (digits - 1), 10 ** digits - 1);
    // 자리수가 같고 앞자리가 겹쳐야 자리별 비교가 필요해진다.
    const b = difficulty === 1
      ? rng.until(() => rng.int(10 ** (digits - 1), 10 ** digits - 1), (v) => v !== a)
      : rng.until(
        () => a + rng.int(-(10 ** (digits - 3)), 10 ** (digits - 3)),
        (v) => v !== a && v >= 10 ** (digits - 1) && v < 10 ** digits,
      );
    const sign = a > b ? '>' : '<';
    return {
      params: { a, b },
      instruction: '□ 안에 >, < 중 알맞은 것을 써넣으시오.',
      stem: `${a} □ ${b}`,
      answer: { value: sign, display: sign, accepts: [sign] },
      solution: [
        '자리수가 같으면 가장 높은 자리부터 차례로 비교한다.',
        `${a} ${sign} ${b}`,
      ],
      dedupeKey: `compare-big:${a}:${b}`,
      difficulty,
    };
  },
  verify({ a, b }, answer) {
    const diff = a - b;
    return (diff > 0 && answer.value === '>') || (diff < 0 && answer.value === '<');
  },
};

const bigSequence = {
  id: 'math.g34.no.s02.sequence',
  standardCode: CODE(2),
  skill: '큰 수의 계열 파악하기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    const step = difficulty === 1 ? 10 ** 4 : difficulty === 2 ? rng.pick([10 ** 4, 10 ** 5]) : rng.pick([10 ** 5, 10 ** 6, 10 ** 8]);
    const start = rng.int(1, 90) * step;
    const terms = [0, 1, 2, 3, 4].map((k) => start + step * k);
    const hideIndex = rng.int(1, 4);
    const hidden = terms[hideIndex];
    const shown = terms.map((t, idx) => (idx === hideIndex ? '□' : String(t)));
    const stepName = sinoKoreanLarge(step);
    return {
      params: { step, hideIndex, terms },
      instruction: '규칙을 찾아 □에 알맞은 수를 써넣으시오.',
      stem: shown.join(' - '),
      answer: { value: hidden, display: num(hidden), accepts: [num(hidden)] },
      solution: [`${stepName}씩 커지는 규칙이다.`, `${terms[hideIndex - 1]} + ${step} = ${hidden}`],
      dedupeKey: `big-sequence:${start}:${step}:${hideIndex}`,
      difficulty,
    };
  },
  verify({ step, hideIndex, terms }, answer) {
    if (answer.value - terms[hideIndex - 1] !== step) return false;
    const next = terms[hideIndex + 1];
    return next === undefined || next - answer.value === step;
  },
};

// ---------------------------------------------------------------------------
// [4수01-03] 세 자리 수의 덧셈과 뺄셈
// ---------------------------------------------------------------------------

const addSubThreeDigit = {
  id: 'math.g34.no.s03.add-sub',
  standardCode: CODE(3),
  skill: '세 자리 수의 덧셈과 뺄셈',
  format: 'short-answer',
  // 세 자리 수 범위는 학년에서 고정이다. 난이도는 수의 크기가 아니라
  // 받아올림·받아내림이 생기는지로 갈린다.
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 받아올림·받아내림이 없고, 2 이상은 일의 자리에서 생긴다.',
  generate(rng, { difficulty }) {
    const isAdd = rng.bool();
    // 받아올림·받아내림 여부를 거부 표집으로 맞추면 조건이 영구 불가능해질 수 있다.
    // 예를 들어 a 가 0으로 끝나면 '일의 자리 합이 10 이상'인 b 가 존재하지 않는다.
    // 그래서 자릿수를 직접 골라 조건을 구성한다.
    const wantCarry = difficulty >= 2;

    if (isAdd) {
      const aOnes = wantCarry ? rng.int(1, 9) : rng.int(0, 4);
      const bOnes = wantCarry ? rng.int(10 - aOnes, 9) : rng.int(0, 9 - aOnes);
      // a 는 100~799 로 두어 b 에 세 자리를 채울 여유를 남긴다.
      const a = rng.int(10, 79) * 10 + aOnes;
      const bUpperMax = Math.floor((999 - a - bOnes) / 10);
      const b = rng.int(10, bUpperMax) * 10 + bOnes;
      const sum = a + b;
      return {
        params: { a, b, isAdd: true },
        instruction: '계산하시오.',
        stem: `${a} + ${b}`,
        answer: { value: sum, display: num(sum), accepts: [num(sum)] },
        solution: [
          `일의 자리: ${aOnes} + ${bOnes} = ${aOnes + bOnes}${aOnes + bOnes >= 10 ? ' (받아올림 1)' : ''}`,
          `${a} + ${b} = ${sum}`,
        ],
        dedupeKey: `add3:${a}:${b}`,
        difficulty,
      };
    }

    const aOnes = wantCarry ? rng.int(0, 8) : rng.int(1, 9);
    const bOnes = wantCarry ? rng.int(aOnes + 1, 9) : rng.int(0, aOnes);
    const aUpper = rng.int(21, 99);
    const a = aUpper * 10 + aOnes;
    const b = rng.int(10, aUpper - 1) * 10 + bOnes;
    const diff = a - b;
    return {
      params: { a, b, isAdd: false },
      instruction: '계산하시오.',
      stem: `${a} - ${b}`,
      answer: { value: diff, display: num(diff), accepts: [num(diff)] },
      solution: [
        bOnes > aOnes
          ? `일의 자리 ${aOnes}에서 ${bOnes}${josaEul(sinoKorean(bOnes))} 뺄 수 없으므로 십의 자리에서 받아내림한다.`
          : `일의 자리: ${aOnes} - ${bOnes} = ${aOnes - bOnes}`,
        `${a} - ${b} = ${diff}`,
      ],
      dedupeKey: `sub3:${a}:${b}`,
      difficulty,
    };
  },
  verify({ a, b, isAdd }, answer) {
    // 역연산으로 되짚는다.
    return isAdd ? answer.value - b === a : answer.value + b === a;
  },
};

// ---------------------------------------------------------------------------
// [4수01-04] 세 자리 수 범위의 곱셈
// ---------------------------------------------------------------------------

const multiplyThreeDigit = {
  id: 'math.g34.no.s04.multiply',
  standardCode: CODE(4),
  skill: '세 자리 수 범위의 곱셈',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const a = difficulty === 1 ? rng.int(11, 99) : rng.int(101, 999);
    const b = difficulty === 1 ? rng.int(2, 9) : difficulty === 2 ? rng.int(2, 9) : rng.int(11, 99);
    const product = a * b;
    return {
      params: { a, b },
      instruction: '계산하시오.',
      stem: `${a} × ${b}`,
      answer: { value: product, display: num(product), accepts: [num(product)] },
      solution: b < 10
        ? [`${a}${josaEul(sinoKorean(a))} ${b}번 더한 값이다.`, `${a} × ${b} = ${product}`]
        : [
            `${b}${josaEul(sinoKorean(b))} ${Math.floor(b / 10) * 10}${josaEnd(b)} ${numRo(b % 10)} 나누어 곱한다.`,
            `${a} × ${Math.floor(b / 10) * 10} = ${a * Math.floor(b / 10) * 10}`,
            `${a} × ${b % 10} = ${a * (b % 10)}`,
            `${a * Math.floor(b / 10) * 10} + ${a * (b % 10)} = ${product}`,
          ],
      dedupeKey: `mul3:${a}:${b}`,
      difficulty,
    };
  },
  verify({ a, b }, answer) {
    // 분배법칙으로 다시 계산한다. 같은 곱셈식을 되쓰지 않는다.
    const tens = Math.floor(b / 10);
    const ones = b % 10;
    let viaDistribution = 0;
    for (let k = 0; k < tens; k += 1) viaDistribution += a * 10;
    for (let k = 0; k < ones; k += 1) viaDistribution += a;
    return viaDistribution === answer.value;
  },
};

function josaEnd(n) {
  return josaEul(sinoKorean(Math.floor(n / 10) * 10)) === '을' ? '과' : '와';
}

// ---------------------------------------------------------------------------
// [4수01-05] 나눗셈의 의미와 곱셈·나눗셈의 관계
// ---------------------------------------------------------------------------

const divisionMeaning = {
  id: 'math.g34.no.s05.meaning',
  standardCode: CODE(5),
  skill: '곱셈과 나눗셈의 관계',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    const divisor = difficulty === 1 ? rng.int(2, 9) : rng.int(3, 9);
    const quotient = difficulty === 1 ? rng.int(2, 9) : difficulty === 2 ? rng.int(10, 30) : rng.int(30, 99);
    const dividend = divisor * quotient;
    const askQuotient = rng.bool();
    return {
      params: { dividend, divisor, quotient, askQuotient },
      instruction: '□에 알맞은 수를 써넣으시오.',
      stem: askQuotient
        ? `${divisor} × □ = ${dividend} 이므로 ${dividend} ÷ ${divisor} = □`
        : `${dividend} ÷ ${divisor} = ${quotient} 이므로 ${divisor} × ${quotient} = □`,
      answer: askQuotient
        ? { value: quotient, display: num(quotient), accepts: [num(quotient)] }
        : { value: dividend, display: num(dividend), accepts: [num(dividend)] },
      solution: askQuotient
        ? [`곱셈식에서 모르는 수는 나눗셈으로 구한다.`, `${dividend} ÷ ${divisor} = ${quotient}`]
        : [`나눗셈식을 곱셈식으로 바꾸면 나누는 수와 몫의 곱이 나누어지는 수다.`, `${divisor} × ${quotient} = ${dividend}`],
      dedupeKey: `div-meaning:${dividend}:${divisor}:${askQuotient ? 'q' : 'd'}`,
      difficulty,
    };
  },
  verify({ dividend, divisor, quotient, askQuotient }, answer) {
    // 반복 덧셈으로 나누어지는 수를 재구성한다.
    let sum = 0;
    for (let k = 0; k < quotient; k += 1) sum += divisor;
    if (sum !== dividend) return false;
    return answer.value === (askQuotient ? quotient : dividend);
  },
};

// ---------------------------------------------------------------------------
// [4수01-06] 나머지의 의미
// ---------------------------------------------------------------------------

const remainderMeaning = {
  id: 'math.g34.no.s06.remainder',
  standardCode: CODE(6),
  skill: '나머지 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const divisor = difficulty === 1 ? rng.int(2, 5) : rng.int(3, 9);
    const quotient = difficulty === 1 ? rng.int(2, 9) : difficulty === 2 ? rng.int(10, 40) : rng.int(20, 99);
    const remainder = rng.int(1, divisor - 1);
    const dividend = divisor * quotient + remainder;
    const askRemainder = difficulty === 1 ? true : rng.bool();
    return {
      params: { dividend, divisor, quotient, remainder, askRemainder },
      instruction: askRemainder ? '나머지를 구하시오.' : '몫을 구하시오.',
      stem: `${dividend} ÷ ${divisor}`,
      answer: askRemainder
        ? { value: remainder, display: num(remainder), accepts: [num(remainder)] }
        : { value: quotient, display: num(quotient), accepts: [num(quotient)] },
      solution: [
        `${divisor} × ${quotient} = ${divisor * quotient}`,
        `${dividend} - ${divisor * quotient} = ${remainder}`,
        `몫은 ${quotient}, 나머지는 ${remainder}이다.`,
      ],
      dedupeKey: `remainder:${dividend}:${divisor}:${askRemainder ? 'r' : 'q'}`,
      difficulty,
    };
  },
  verify({ dividend, divisor, quotient, remainder, askRemainder }, answer) {
    // 나눗셈의 검산식 dividend = divisor * quotient + remainder 와
    // 나머지가 나누는 수보다 작다는 조건을 함께 확인한다.
    let rebuilt = remainder;
    for (let k = 0; k < quotient; k += 1) rebuilt += divisor;
    if (rebuilt !== dividend || remainder >= divisor) return false;
    return answer.value === (askRemainder ? remainder : quotient);
  },
};

// ---------------------------------------------------------------------------
// [4수01-07] 세 자리 수 범위의 나눗셈 계산
// ---------------------------------------------------------------------------

const divideThreeDigit = {
  id: 'math.g34.no.s07.divide',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 나머지가 없고, 2 이상은 나머지가 생긴다.',
  standardCode: CODE(7),
  skill: '세 자리 수 범위의 나눗셈',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const divisor = difficulty === 1 ? rng.int(2, 9) : difficulty === 2 ? rng.int(3, 9) : rng.int(11, 40);
    // 몫의 상한을 나누는 수로 정해 세 자리 수 범위를 벗어나지 않게 한다.
    // 재귀로 다시 뽑으면 난이도가 조용히 낮아지고 시드 재현성이 흐려진다.
    const maxQuotient = Math.floor(999 / divisor);
    const minQuotient = difficulty === 1 ? 11 : difficulty === 2 ? 20 : 5;
    const quotient = rng.int(Math.min(minQuotient, maxQuotient), maxQuotient);
    const dividend = divisor * quotient;
    return {
      params: { dividend, divisor, quotient },
      instruction: '계산하시오.',
      stem: `${dividend} ÷ ${divisor}`,
      answer: { value: quotient, display: num(quotient), accepts: [num(quotient)] },
      solution: [`${divisor} × ${quotient} = ${dividend}이므로 몫은 ${quotient}이다.`],
      dedupeKey: `div3:${dividend}:${divisor}`,
      difficulty,
    };
  },
  verify({ dividend, divisor }, answer) {
    // 몫만큼 반복해서 빼면 정확히 0이 되어야 한다.
    let rest = dividend;
    for (let k = 0; k < answer.value; k += 1) rest -= divisor;
    return rest === 0;
  },
};

// ---------------------------------------------------------------------------
// [4수01-08] 자연수의 어림셈
// ---------------------------------------------------------------------------

function roundTo(n, unit) {
  return Math.round(n / unit) * unit;
}

const estimateNatural = {
  id: 'math.g34.no.s08.estimate',
  standardCode: CODE(8),
  skill: '어림셈으로 계산 결과 어림하기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const unit = difficulty === 1 ? 10 : difficulty === 2 ? 100 : 1000;
    // 어림 자리의 바로 아래 숫자가 5면 올림·버림이 갈려 정답이 하나로 정해지지 않는다.
    const pickRoundable = (lo, hi) => rng.until(() => rng.int(lo, hi), (v) => {
      const digit = Math.floor(v / (unit / 10)) % 10;
      return digit !== 5 && v % unit !== 0;
    });
    const a = pickRoundable(unit, unit * 9);
    const b = pickRoundable(unit, unit * 9);
    const isAdd = rng.bool();
    const [x, y] = isAdd ? [a, b] : [Math.max(a, b), Math.min(a, b)];
    const est = isAdd ? roundTo(x, unit) + roundTo(y, unit) : roundTo(x, unit) - roundTo(y, unit);
    const exact = isAdd ? x + y : x - y;
    const wrong = distractors(est, [exact, est + unit, est - unit, est + unit * 2]);
    const unitName = unit === 10 ? '몇십' : unit === 100 ? '몇백' : '몇천';
    return {
      params: { x, y, isAdd, unit },
      instruction: `${unitName}으로 어림하여 계산한 값을 고르시오.`,
      stem: `${x} ${isAdd ? '+' : '-'} ${y}`,
      choices: buildChoices(rng, est, wrong.slice(0, 3)),
      answer: { value: est, display: num(est), accepts: [num(est)] },
      solution: [
        `${numEun(x)} 약 ${roundTo(x, unit)}, ${numEun(y)} 약 ${roundTo(y, unit)}이다.`,
        `${roundTo(x, unit)} ${isAdd ? '+' : '-'} ${roundTo(y, unit)} = ${est}`,
      ],
      dedupeKey: `estimate34:${x}:${y}:${isAdd ? 'a' : 's'}:${unit}`,
      difficulty,
    };
  },
  verify({ x, y, isAdd, unit }, answer) {
    // 어림값은 어림 단위의 배수이고, 두 항의 어림 오차 합보다 멀 수 없다.
    if (answer.value % unit !== 0) return false;
    const exact = isAdd ? x + y : x - y;
    return Math.abs(answer.value - exact) < unit;
  },
};

// ---------------------------------------------------------------------------
// [4수01-09] 등분할과 분수의 이해
// ---------------------------------------------------------------------------

const readFractionItem = {
  id: 'math.g34.no.s09.read',
  standardCode: CODE(9),
  skill: '분수 읽고 쓰기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const d = difficulty === 1 ? rng.int(2, 6) : rng.int(3, 12);
    const n = rng.int(1, d - 1);
    const toReading = rng.bool();
    const fraction = makeFraction(n, d);
    const reading = readFraction(fraction);
    if (toReading) {
      return {
        params: { n, d, direction: 'to-reading' },
        instruction: '분수를 읽는 방법을 쓰시오.',
        stem: formatFraction(fraction),
        answer: { value: reading, display: reading, accepts: [reading] },
        solution: [`분모 ${numEul(d)} 먼저 읽고 분자 ${numEul(n)} 나중에 읽는다.`, reading],
        dedupeKey: `read-fraction:${n}:${d}`,
        difficulty,
      };
    }
    return {
      params: { n, d, direction: 'to-fraction' },
      instruction: '분수로 나타내시오.',
      stem: reading,
      answer: { value: formatFraction(fraction), display: formatFraction(fraction), accepts: [formatFraction(fraction)] },
      solution: [`'${d}분의 ${n}'은 분모가 ${d}, 분자가 ${n}인 분수다.`, formatFraction(fraction)],
      dedupeKey: `write-fraction:${n}:${d}`,
      difficulty,
    };
  },
  verify({ n, d, direction }, answer) {
    // 표기와 읽기를 서로 반대 방향으로 되짚는다.
    if (direction === 'to-reading') {
      const match = /^(\d+)분의 (\d+)$/.exec(answer.value);
      return Boolean(match) && Number(match[1]) === d && Number(match[2]) === n;
    }
    const match = /^(\d+)\/(\d+)$/.exec(answer.value);
    return Boolean(match) && Number(match[1]) === n && Number(match[2]) === d;
  },
};

const partOfWhole = {
  id: 'math.g34.no.s09.part-of-whole',
  standardCode: CODE(9),
  skill: '전체를 등분할한 부분을 분수로 나타내기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const d = difficulty === 1 ? rng.pick([2, 3, 4]) : difficulty === 2 ? rng.int(4, 8) : rng.int(6, 12);
    const n = rng.int(1, d - 1);
    const thing = rng.pick(THINGS);
    const fraction = makeFraction(n, d);
    return {
      params: { n, d },
      instruction: '분수로 나타내시오.',
      stem: `${thing.noun} 한 개를 똑같이 ${d}조각으로 나누었습니다. 그중 ${n}조각은 전체의 얼마입니까?`,
      answer: { value: formatFraction(fraction), display: formatFraction(fraction), accepts: [formatFraction(fraction), readFraction(fraction)] },
      solution: [
        `똑같이 ${d}조각으로 나누었으므로 한 조각은 전체의 ${formatFraction(makeFraction(1, d))}이다.`,
        `${n}조각은 ${formatFraction(fraction)}이다.`,
      ],
      dedupeKey: `part-of-whole:${n}:${d}:${thing.noun}`,
      difficulty,
    };
  },
  verify({ n, d }, answer) {
    const match = /^(\d+)\/(\d+)$/.exec(answer.value);
    if (!match) return false;
    // 분자가 분모보다 작아야 전체의 일부다.
    return Number(match[1]) === n && Number(match[2]) === d && n < d;
  },
};

// ---------------------------------------------------------------------------
// [4수01-10] 단위분수·진분수·가분수·대분수
// ---------------------------------------------------------------------------

const classifyFraction = {
  id: 'math.g34.no.s10.classify',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 진분수·가분수, 2 이상은 단위분수까지 구별한다.',
  standardCode: CODE(10),
  skill: '진분수·가분수·단위분수 구별',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const kind = rng.pick(difficulty === 1 ? ['proper', 'improper'] : ['proper', 'improper', 'unit']);
    const d = rng.int(3, 9);
    const n = kind === 'unit' ? 1 : kind === 'proper' ? rng.int(2, d - 1) : rng.int(d, d * 2);
    const fraction = makeFraction(n, d);
    const actual = fractionKind(fraction);
    const correct = FRACTION_KINDS[actual];
    const wrong = Object.values(FRACTION_KINDS).filter((v) => v !== correct);
    return {
      params: { n, d },
      instruction: '알맞은 것을 고르시오.',
      stem: `${fracEun(formatFraction(fraction))} 어떤 분수입니까?`,
      choices: buildChoices(rng, correct, [...wrong, '자연수']),
      answer: { value: correct, display: correct, accepts: [correct] },
      solution: [
        actual === 'unit'
          ? '분자가 1인 분수를 단위분수라고 한다.'
          : actual === 'proper'
            ? `분자 ${numI(n)} 분모 ${d}보다 작으므로 진분수다.`
            : `분자 ${numI(n)} 분모 ${d}보다 크거나 같으므로 가분수다.`,
      ],
      dedupeKey: `classify-fraction:${n}:${d}`,
      difficulty,
    };
  },
  verify({ n, d }, answer) {
    // 분자·분모 관계로 종류를 다시 판정한다.
    const expected = FRACTION_KINDS[fractionKind(makeFraction(n, d))];
    return answer.value === expected;
  },
};

const improperToMixedItem = {
  id: 'math.g34.no.s10.to-mixed',
  standardCode: CODE(10),
  skill: '가분수를 대분수로 바꾸기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const d = difficulty === 1 ? rng.int(2, 5) : rng.int(3, 9);
    const whole = difficulty === 1 ? rng.int(1, 3) : rng.int(1, 6);
    const rest = rng.int(1, d - 1);
    const improper = makeFraction(whole * d + rest, d);
    const mixed = toMixed(improper);
    const display = formatMixed(mixed);
    return {
      params: { improper, mixed },
      instruction: '가분수를 대분수로 나타내시오.',
      stem: formatFraction(improper),
      answer: { value: display, display, accepts: [display, `${whole} ${rest}/${d}`] },
      solution: [
        `${improper.n} ÷ ${d} = ${whole} ... ${rest}`,
        `자연수 부분은 ${whole}, 남은 분수는 ${rest}/${d}이므로 ${display}이다.`,
      ],
      dedupeKey: `to-mixed:${improper.n}:${d}`,
      difficulty,
    };
  },
  verify({ improper, mixed }, answer) {
    // 대분수를 다시 가분수로 되돌려 원래 값과 같은지 본다.
    const rebuilt = mixed.whole * mixed.d + mixed.n;
    return rebuilt === improper.n && answer.value === formatMixed(mixed);
  },
};

// ---------------------------------------------------------------------------
// [4수01-11] 분모가 같은 분수의 크기 비교
// ---------------------------------------------------------------------------

const compareSameDenominator = {
  id: 'math.g34.no.s11.compare',
  standardCode: CODE(11),
  skill: '분모가 같은 분수의 크기 비교',
  format: 'compare',
  generate(rng, { difficulty }) {
    const d = difficulty === 1 ? rng.int(3, 6) : rng.int(5, 12);
    const [n1, n2] = rng.until(() => [rng.int(1, d - 1), rng.int(1, d - 1)], ([x, y]) => x !== y);
    const a = makeFraction(n1, d);
    const b = makeFraction(n2, d);
    const sign = compareFractions(a, b) > 0 ? '>' : '<';
    return {
      params: { a, b },
      instruction: '□ 안에 >, < 중 알맞은 것을 써넣으시오.',
      stem: `${formatFraction(a)} □ ${formatFraction(b)}`,
      answer: { value: sign, display: sign, accepts: [sign] },
      solution: [
        `분모가 같으면 분자가 큰 분수가 더 크다.`,
        `${n1} ${sign} ${n2}이므로 ${formatFraction(a)} ${sign} ${formatFraction(b)}이다.`,
      ],
      dedupeKey: `compare-same-d:${n1}:${n2}:${d}`,
      difficulty,
    };
  },
  verify({ a, b }, answer) {
    const cmp = compareFractions(a, b);
    return (cmp > 0 && answer.value === '>') || (cmp < 0 && answer.value === '<');
  },
};

const compareUnitFractions = {
  id: 'math.g34.no.s11.compare-unit',
  standardCode: CODE(11),
  skill: '단위분수의 크기 비교',
  format: 'compare',
  generate(rng, { difficulty }) {
    const [d1, d2] = rng.until(
      () => [rng.int(2, difficulty === 1 ? 6 : 12), rng.int(2, difficulty === 1 ? 6 : 12)],
      ([x, y]) => x !== y,
    );
    const a = makeFraction(1, d1);
    const b = makeFraction(1, d2);
    const sign = compareFractions(a, b) > 0 ? '>' : '<';
    return {
      params: { a, b },
      instruction: '□ 안에 >, < 중 알맞은 것을 써넣으시오.',
      stem: `${formatFraction(a)} □ ${formatFraction(b)}`,
      answer: { value: sign, display: sign, accepts: [sign] },
      solution: [
        '단위분수는 분모가 클수록 작다. 똑같이 더 많이 나눌수록 한 조각이 작아진다.',
        `분모 ${numI(d1)} ${d2}보다 ${d1 > d2 ? '크므로' : '작으므로'} ${formatFraction(a)} ${sign} ${formatFraction(b)}이다.`,
      ],
      dedupeKey: `compare-unit:${d1}:${d2}`,
      difficulty,
    };
  },
  verify({ a, b }, answer) {
    // 단위분수는 분모 대소가 크기 대소의 역이라는 성질로 확인한다.
    const expected = a.d < b.d ? '>' : '<';
    return answer.value === expected && a.n === 1 && b.n === 1;
  },
};

// ---------------------------------------------------------------------------
// [4수01-12] 분모가 10인 분수와 소수
// ---------------------------------------------------------------------------

const tenthsToDecimal = {
  id: 'math.g34.no.s12.tenths',
  standardCode: CODE(12),
  skill: '분모가 10인 분수를 소수로 나타내기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const n = difficulty === 1 ? rng.int(1, 9) : rng.int(1, 9);
    const whole = difficulty === 1 ? 0 : rng.int(1, 9);
    const fraction = makeFraction(whole * 10 + n, 10);
    const decimal = fractionToDecimal(fraction);
    const display = formatDecimal(decimal);
    return {
      params: { fraction, units: decimal.units, scale: decimal.scale },
      instruction: '소수로 나타내시오.',
      stem: formatFraction(fraction),
      answer: { value: display, display, accepts: [display] },
      solution: [
        `분모가 10인 분수는 소수 한 자리 수로 나타낸다.`,
        `${formatFraction(fraction)} = ${display}`,
      ],
      dedupeKey: `tenths:${fraction.n}`,
      difficulty,
    };
  },
  verify({ fraction, units, scale }, answer) {
    // 소수를 다시 분수로 되돌려 원래 분수와 같은지 본다.
    const back = reduceFraction({ n: units, d: 10 ** scale });
    const original = reduceFraction(fraction);
    return back.n === original.n && back.d === original.d && answer.value === formatDecimal({ units, scale });
  },
};

// ---------------------------------------------------------------------------
// [4수01-13] 자연수와 소수의 관계, 소수 두 자리 수
// ---------------------------------------------------------------------------

const decimalPlaceValue = {
  id: 'math.g34.no.s13.place',
  standardCode: CODE(13),
  skill: '소수의 자리 숫자 찾기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const scale = difficulty === 1 ? 1 : 2;
    const whole = rng.int(1, 99);
    const frac = rng.int(1, 10 ** scale - 1);
    const decimal = makeDecimal(whole * 10 ** scale + frac, scale);
    const place = rng.int(1, scale);
    const digit = decimalDigitAt(decimal, place);
    return {
      params: { units: decimal.units, scale, place },
      instruction: '물음에 답하시오.',
      stem: `${formatDecimal(decimal)}에서 ${DECIMAL_PLACE_NAMES[place - 1]} 자리 숫자는 무엇입니까?`,
      answer: { value: digit, display: num(digit), accepts: [num(digit)] },
      solution: [
        `소수점 아래 ${place}번째 숫자를 읽는다.`,
        `${DECIMAL_PLACE_NAMES[place - 1]} 자리 숫자는 ${digit}이다.`,
      ],
      dedupeKey: `dec-place:${decimal.units}:${scale}:${place}`,
      difficulty,
    };
  },
  verify({ units, scale, place }, answer) {
    // 표기 문자열에서 직접 그 자리 글자를 꺼내 비교한다.
    const shown = formatDecimal({ units, scale });
    const afterPoint = shown.split('.')[1] ?? '';
    return Number(afterPoint[place - 1]) === answer.value;
  },
};

// ---------------------------------------------------------------------------
// [4수01-14] 소수의 크기 비교
// ---------------------------------------------------------------------------

const compareDecimalsItem = {
  id: 'math.g34.no.s14.compare',
  standardCode: CODE(14),
  skill: '소수의 크기 비교',
  format: 'compare',
  generate(rng, { difficulty }) {
    const scale = difficulty === 1 ? 1 : 2;
    const whole = rng.int(0, 9);
    const a = makeDecimal(whole * 10 ** scale + rng.int(0, 10 ** scale - 1), scale);
    // 난이도 3은 자연수 부분이 같아 소수 자리까지 비교해야 한다.
    const b = difficulty === 3
      ? makeDecimal(whole * 10 ** scale + rng.until(() => rng.int(0, 10 ** scale - 1), (v) => whole * 10 ** scale + v !== a.units), scale)
      : makeDecimal(rng.until(() => rng.int(0, 10 ** (scale + 1) - 1), (v) => v !== a.units), scale);
    const cmp = compareDecimals(a, b);
    const sign = cmp > 0 ? '>' : '<';
    return {
      params: { a, b },
      instruction: '□ 안에 >, < 중 알맞은 것을 써넣으시오.',
      stem: `${formatDecimal(a)} □ ${formatDecimal(b)}`,
      answer: { value: sign, display: sign, accepts: [sign] },
      solution: [
        '자연수 부분을 먼저 비교하고, 같으면 소수 첫째 자리부터 차례로 비교한다.',
        `${formatDecimal(a)} ${sign} ${formatDecimal(b)}`,
      ],
      dedupeKey: `compare-dec:${a.units}:${b.units}:${scale}`,
      difficulty,
    };
  },
  verify({ a, b }, answer) {
    const cmp = compareDecimals(a, b);
    return (cmp > 0 && answer.value === '>') || (cmp < 0 && answer.value === '<');
  },
};

// ---------------------------------------------------------------------------
// [4수01-15] 분모가 같은 분수의 덧셈과 뺄셈
// ---------------------------------------------------------------------------

const addSubSameDenominator = {
  id: 'math.g34.no.s15.add-sub',
  standardCode: CODE(15),
  skill: '분모가 같은 분수의 덧셈과 뺄셈',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const d = difficulty === 1 ? rng.int(3, 7) : rng.int(5, 12);
    const isAdd = rng.bool();
    if (isAdd) {
      // 난이도 1은 합이 1을 넘지 않게 두어 진분수 범위에서 끝낸다.
      const n1 = rng.int(1, d - 2);
      const n2 = difficulty === 1 ? rng.int(1, d - 1 - n1) : rng.int(1, d - 1);
      const a = makeFraction(n1, d);
      const b = makeFraction(n2, d);
      // 약분하지 않는다. 약분은 5~6학년 내용이므로 3~4학년 답은 분모를 유지한다.
      const sum = addSameDenominator(a, b);
      const display = formatUnreducedFraction(sum);
      return {
        params: { a, b, isAdd: true, result: sum },
        instruction: '계산하시오.',
        stem: `${formatFraction(a)} + ${formatFraction(b)}`,
        answer: { value: display, display, accepts: [display, formatFraction(sum)] },
        solution: [`분모가 같으므로 분자끼리 더한다.`, `${n1} + ${n2} = ${sum.n}`, `답은 ${display}이다.`],
        dedupeKey: `frac-add:${n1}:${n2}:${d}`,
        difficulty,
      };
    }
    const n1 = rng.int(2, d - 1);
    const n2 = rng.int(1, n1 - 1);
    const a = makeFraction(n1, d);
    const b = makeFraction(n2, d);
    const diff = subSameDenominator(a, b);
    const display = formatUnreducedFraction(diff);
    return {
      params: { a, b, isAdd: false, result: diff },
      instruction: '계산하시오.',
      stem: `${formatFraction(a)} - ${formatFraction(b)}`,
      answer: { value: display, display, accepts: [display, formatFraction(diff)] },
      solution: [`분모가 같으므로 분자끼리 뺀다.`, `${n1} - ${n2} = ${diff.n}`, `답은 ${display}이다.`],
      dedupeKey: `frac-sub:${n1}:${n2}:${d}`,
      difficulty,
    };
  },
  verify({ a, b, isAdd }, answer) {
    // 답 문자열을 분수로 다시 읽어 역연산한다.
    // params 의 result 를 되읽으면 answer 를 보지 않는 검산이 되어 아무것도 잡지 못한다.
    const parsed = parseFractionText(answer.value);
    if (!parsed) return false;
    // 6/6 처럼 자연수로 적힌 답은 분모를 맞춰 되돌린다.
    const restored = parsed.d === 1 ? { n: parsed.n * a.d, d: a.d } : parsed;
    if (restored.d !== a.d) return false;
    const back = isAdd ? subSameDenominator(restored, b) : addSameDenominator(restored, b);
    return back.n === a.n && back.d === a.d;
  },
};

// ---------------------------------------------------------------------------
// [4수01-16] 소수 두 자리 수 범위의 덧셈과 뺄셈
// ---------------------------------------------------------------------------

const addSubDecimals = {
  id: 'math.g34.no.s16.add-sub',
  standardCode: CODE(16),
  skill: '소수의 덧셈과 뺄셈',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const scale = difficulty === 1 ? 1 : 2;
    const power = 10 ** scale;
    const isAdd = rng.bool();
    const a = makeDecimal(rng.int(power, power * (difficulty === 1 ? 9 : 20)), scale);
    if (isAdd) {
      const b = makeDecimal(rng.int(power, power * (difficulty === 1 ? 9 : 20)), scale);
      const sum = addDecimals(a, b);
      const display = formatDecimal(sum);
      return {
        params: { a, b, isAdd: true, result: sum },
        instruction: '계산하시오.',
        stem: `${formatDecimal(a)} + ${formatDecimal(b)}`,
        answer: { value: display, display, accepts: [display] },
        solution: ['소수점의 자리를 맞추어 세로로 더한다.', `${formatDecimal(a)} + ${formatDecimal(b)} = ${display}`],
        dedupeKey: `dec-add:${a.units}:${b.units}:${scale}`,
        difficulty,
      };
    }
    const b = makeDecimal(rng.int(power, Math.max(power, a.units - 1)), scale);
    const diff = subDecimals(a, b);
    const display = formatDecimal(diff);
    return {
      params: { a, b, isAdd: false, result: diff },
      instruction: '계산하시오.',
      stem: `${formatDecimal(a)} - ${formatDecimal(b)}`,
      answer: { value: display, display, accepts: [display] },
      solution: ['소수점의 자리를 맞추어 세로로 뺀다.', `${formatDecimal(a)} - ${formatDecimal(b)} = ${display}`],
      dedupeKey: `dec-sub:${a.units}:${b.units}:${scale}`,
      difficulty,
    };
  },
  verify({ a, b, isAdd, result }, answer) {
    // 역연산으로 되짚는다. 전부 정수 연산이므로 오차가 끼지 않는다.
    const back = isAdd ? subDecimals(result, b) : addDecimals(result, b);
    return compareDecimals(back, a) === 0 && answer.value === formatDecimal(result);
  },
};

export const generators = [
  readBigNumberItem,
  bigPlaceValue,
  compareBigNumbers,
  bigSequence,
  addSubThreeDigit,
  multiplyThreeDigit,
  divisionMeaning,
  remainderMeaning,
  divideThreeDigit,
  estimateNatural,
  readFractionItem,
  partOfWhole,
  classifyFraction,
  improperToMixedItem,
  compareSameDenominator,
  compareUnitFractions,
  tenthsToDecimal,
  decimalPlaceValue,
  compareDecimalsItem,
  addSubSameDenominator,
  addSubDecimals,
];
