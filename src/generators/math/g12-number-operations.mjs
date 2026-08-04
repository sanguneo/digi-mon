/**
 * 2022 개정 초등 수학 1~2학년군 '수와 연산' [2수01-01]~[2수01-11] 문항 생성기.
 *
 * 각 생성기는 params 로 문항을 완전히 결정하고, verify 로 답을 독립 경로로 검산한다.
 * verify 가 generate 와 같은 식을 다시 계산하면 검산이 아니므로 역연산·불변식을 쓴다.
 */
import { buildChoices } from '../../engine/item.mjs';
import { NAMES, THINGS, GROUPINGS } from '../corpus.mjs';
import {
  PLACE_NAMES,
  digitAt,
  josaEul,
  josaEun,
  josaI,
  nativeCounted,
  numEul,
  numEun,
  numGwa,
  numI,
  parseSinoKorean,
  placeDecompose,
  sinoKorean,
} from '../../engine/korean-number.mjs';

const CODE = (n) => `[2수01-${String(n).padStart(2, '0')}]`;
const num = (n) => String(n);

/** 오답 후보에서 정답·중복·음수를 걷어낸다. */
function distractors(correct, candidates) {
  const out = [];
  for (const c of candidates) {
    if (!Number.isFinite(c) || c === correct || c < 0 || out.includes(c)) continue;
    out.push(c);
  }
  return out;
}

/** 반복 덧셈으로 곱을 구한다. 곱셈 연산자를 쓰지 않는 독립 검산 경로다. */
function repeatedAdd(per, times) {
  let sum = 0;
  for (let k = 0; k < times; k += 1) sum += per;
  return sum;
}

// ---------------------------------------------------------------------------
// [2수01-01] 0과 100까지의 수: 세고 읽고 쓰기
// ---------------------------------------------------------------------------

const readNumber = {
  id: 'math.g12.no.s01.read-sino',
  standardCode: CODE(1),
  skill: '수를 한자어로 읽기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const n = difficulty === 1 ? rng.int(1, 20) : difficulty === 2 ? rng.int(21, 60) : rng.int(61, 100);
    const reading = sinoKorean(n);
    const parts = placeDecompose(n);
    return {
      params: { n },
      instruction: '수를 읽는 방법을 한글로 쓰시오.',
      stem: `${n}`,
      answer: { value: reading, display: reading, accepts: [reading] },
      solution: [
        parts.length > 1 ? `${numEun(n)} ${parts.join(' + ')}이다.` : `${numEun(n)} 한 자리 수이다.`,
        `그러므로 '${reading}'이라고 읽는다.`,
      ],
      dedupeKey: `read-sino:${n}`,
      difficulty,
    };
  },
  verify({ n }, answer) {
    return parseSinoKorean(answer.value) === n;
  },
};

const writeNumber = {
  id: 'math.g12.no.s01.write-digit',
  standardCode: CODE(1),
  skill: '읽은 수를 숫자로 쓰기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const n = difficulty === 1 ? rng.int(11, 30) : difficulty === 2 ? rng.int(31, 70) : rng.int(71, 100);
    const reading = sinoKorean(n);
    return {
      params: { n, reading },
      instruction: '읽은 수를 숫자로 쓰시오.',
      stem: `${reading}`,
      answer: { value: n, display: num(n), accepts: [num(n)] },
      solution: [`'${reading}'은 ${placeDecompose(n).join(' + ')}이다.`, `숫자로 쓰면 ${n}이다.`],
      dedupeKey: `write-digit:${n}`,
      difficulty,
    };
  },
  verify({ reading }, answer) {
    return parseSinoKorean(reading) === answer.value;
  },
};

const countTensOnes = {
  id: 'math.g12.no.s01.count-tens-ones',
  standardCode: CODE(1),
  skill: '10개씩 묶음과 낱개로 수 세기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const tens = difficulty === 1 ? rng.int(1, 4) : difficulty === 2 ? rng.int(5, 8) : rng.int(6, 9);
    const ones = difficulty === 1 ? rng.int(1, 5) : rng.int(0, 9);
    const thing = rng.pick(THINGS);
    const n = tens * 10 + ones;
    return {
      params: { tens, ones },
      instruction: '모두 몇 개인지 수로 쓰시오.',
      stem: `${thing.noun}${josaI(thing.noun)} 10${thing.counter}씩 묶음 ${tens}개와 낱개 ${ones}${thing.counter} 있습니다.`
        + ` ${thing.noun}${josaEun(thing.noun)} 모두 몇 ${thing.counter}입니까?`,
      answer: { value: n, display: num(n), accepts: [num(n), `${n}${thing.counter}`] },
      solution: [
        `10개씩 묶음 ${tens}개는 ${tens * 10}이다.`,
        `낱개 ${ones}개를 더하면 ${tens * 10} + ${ones} = ${n}이다.`,
      ],
      dedupeKey: `count-tens-ones:${tens}:${ones}:${thing.noun}`,
      difficulty,
    };
  },
  verify({ tens, ones }, answer) {
    // 자리 숫자만 맞추면 199 처럼 자리수가 더 많은 답도 통과한다.
    // 10개씩 묶음과 낱개로 만든 수는 두 자리를 넘을 수 없다.
    if (!Number.isInteger(answer.value) || answer.value < 10 || answer.value > 99) return false;
    return digitAt(answer.value, 1) === tens && digitAt(answer.value, 0) === ones;
  },
};

const countNative = {
  id: 'math.g12.no.s01.count-native',
  standardCode: CODE(1),
  skill: '고유어 수사로 개수 말하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const n = difficulty === 1 ? rng.int(2, 10) : difficulty === 2 ? rng.int(11, 29) : rng.int(30, 99);
    const thing = rng.pick(THINGS);
    const reading = nativeCounted(n, thing.counter);
    return {
      params: { n, counter: thing.counter },
      instruction: '개수를 우리말로 읽어 쓰시오.',
      stem: `${thing.noun} ${n}${thing.counter}`,
      answer: { value: reading, display: reading, accepts: [reading] },
      solution: [`${numEul(n)} 우리말로 세면 '${reading}'이다.`],
      dedupeKey: `count-native:${n}:${thing.counter}`,
      difficulty,
    };
  },
  verify({ n, counter }, answer) {
    return answer.value === nativeCounted(n, counter) && answer.value.endsWith(counter);
  },
};

// ---------------------------------------------------------------------------
// [2수01-02] 일·십·백·천의 자릿값과 위치적 기수법
// ---------------------------------------------------------------------------

function pick4Digit(rng, difficulty) {
  if (difficulty === 1) return rng.int(100, 999);
  if (difficulty === 2) return rng.int(1000, 9999);
  // 난이도 3: 0이 끼어 자릿값을 헷갈리기 쉬운 수
  return rng.until(() => rng.int(1000, 9999), (v) => String(v).includes('0'));
}

const placeValueDigit = {
  id: 'math.g12.no.s02.place-digit',
  standardCode: CODE(2),
  skill: '지정한 자리의 숫자 찾기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const n = pick4Digit(rng, difficulty);
    const place = rng.int(0, String(n).length - 1);
    const d = digitAt(n, place);
    return {
      params: { n, place },
      instruction: '물음에 답하시오.',
      stem: `${n}에서 ${PLACE_NAMES[place]}의 자리 숫자는 무엇입니까?`,
      answer: { value: d, display: num(d), accepts: [num(d)] },
      solution: [
        `${numEul(n)} 자리별로 나누면 ${placeDecompose(n).join(' + ')}이다.`,
        `${PLACE_NAMES[place]}의 자리 숫자는 ${d}이다.`,
      ],
      dedupeKey: `place-digit:${n}:${place}`,
      difficulty,
    };
  },
  verify({ n, place }, answer) {
    // 문자열 인덱싱이라는 다른 경로로 확인한다.
    const s = String(n);
    return Number(s[s.length - 1 - place]) === answer.value;
  },
};

const placeValueAmount = {
  id: 'math.g12.no.s02.place-amount',
  standardCode: CODE(2),
  skill: '숫자가 나타내는 값 구하기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const n = pick4Digit(rng, Math.max(2, difficulty));
    const places = [0, 1, 2, 3].filter((p) => p < String(n).length && digitAt(n, p) !== 0);
    const place = rng.pick(places);
    const d = digitAt(n, place);
    const value = d * 10 ** place;
    // 오답은 전형적 오류를 쓴다: 자릿값 무시(d), 한 자리 밀림, 계수 무시
    const wrong = distractors(value, [d, d * 10 ** (place + 1), place > 0 ? d * 10 ** (place - 1) : d * 100, 10 ** place]);
    return {
      params: { n, place, d },
      instruction: '알맞은 것을 고르시오.',
      stem: `${n}에서 숫자 ${numEun(d)} 얼마를 나타냅니까?`,
      choices: buildChoices(rng, value, wrong.slice(0, 3)),
      answer: { value, display: num(value), accepts: [num(value)] },
      solution: [
        `숫자 ${numEun(d)} ${PLACE_NAMES[place]}의 자리에 있다.`,
        `${PLACE_NAMES[place]}의 자리 숫자 ${d}는 ${d} × ${10 ** place} = ${value}${josaEul(sinoKorean(value))} 나타낸다.`,
      ],
      dedupeKey: `place-amount:${n}:${place}`,
      difficulty,
    };
  },
  verify({ n, place, d }, answer) {
    // 나타내는 값을 뺐을 때 그 자리가 0이 되어야 한다.
    return digitAt(n - answer.value, place) === 0 && d * 10 ** place === answer.value;
  },
};

const placeDecomposeBlank = {
  id: 'math.g12.no.s02.decompose',
  standardCode: CODE(2),
  skill: '네 자리 수를 자릿값으로 분해하기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    const n = pick4Digit(rng, Math.max(2, difficulty));
    const parts = placeDecompose(n);
    const hideIndex = rng.int(0, parts.length - 1);
    const hidden = parts[hideIndex];
    const shown = parts.map((p, idx) => (idx === hideIndex ? '□' : String(p)));
    return {
      params: { n, parts, hideIndex },
      instruction: '□에 알맞은 수를 써넣으시오.',
      stem: `${n} = ${shown.join(' + ')}`,
      answer: { value: hidden, display: num(hidden), accepts: [num(hidden)] },
      solution: [`${numEun(n)} ${parts.join(' + ')}이다.`, `□에는 ${numI(hidden)} 들어간다.`],
      dedupeKey: `decompose:${n}:${hideIndex}`,
      difficulty,
    };
  },
  verify({ n, parts, hideIndex }, answer) {
    const rest = parts.filter((_, idx) => idx !== hideIndex).reduce((s, v) => s + v, 0);
    return rest + answer.value === n;
  },
};

// ---------------------------------------------------------------------------
// [2수01-03] 수의 계열과 크기 비교
// ---------------------------------------------------------------------------

const compareTwo = {
  id: 'math.g12.no.s03.compare',
  standardCode: CODE(3),
  skill: '두 수의 크기 비교',
  format: 'compare',
  generate(rng, { difficulty }) {
    const [lo, hi] = difficulty === 1 ? [10, 99] : difficulty === 2 ? [100, 999] : [1000, 9999];
    const a = rng.int(lo, hi);
    // 난이도 3은 두 수가 가까워 자리별 비교가 필요하게 만든다.
    const b = difficulty === 3
      ? rng.until(() => a + rng.int(-99, 99), (v) => v !== a && v >= lo && v <= hi)
      : rng.until(() => rng.int(lo, hi), (v) => v !== a);
    const sign = a > b ? '>' : '<';
    return {
      params: { a, b },
      instruction: '□ 안에 >, < 중 알맞은 것을 써넣으시오.',
      stem: `${a} □ ${b}`,
      answer: { value: sign, display: sign, accepts: [sign] },
      solution: [
        '두 수의 자리 수를 높은 자리부터 차례로 비교한다.',
        `${numEun(a)} ${b}보다 ${a > b ? '크다' : '작다'}. 그러므로 ${a} ${sign} ${b}이다.`,
      ],
      dedupeKey: `compare:${a}:${b}`,
      difficulty,
    };
  },
  verify({ a, b }, answer) {
    // 차의 부호라는 다른 경로로 확인한다.
    const diff = a - b;
    return (diff > 0 && answer.value === '>') || (diff < 0 && answer.value === '<');
  },
};

const orderThree = {
  id: 'math.g12.no.s03.order',
  standardCode: CODE(3),
  skill: '세 수를 크기 순서로 늘어놓기',
  format: 'ordering',
  generate(rng, { difficulty }) {
    const [lo, hi] = difficulty === 1 ? [10, 99] : difficulty === 2 ? [100, 999] : [1000, 9999];
    const set = [];
    while (set.length < 3) {
      const v = rng.int(lo, hi);
      if (!set.includes(v)) set.push(v);
    }
    const descending = rng.bool();
    const sorted = set.slice().sort((x, y) => (descending ? y - x : x - y));
    const display = sorted.join(', ');
    return {
      params: { set, descending },
      instruction: `수를 ${descending ? '큰' : '작은'} 것부터 차례로 쓰시오.`,
      stem: `${set.join(', ')}`,
      answer: { value: sorted, display, accepts: [display, sorted.join(' ')] },
      solution: [`가장 ${descending ? '큰' : '작은'} 수는 ${sorted[0]}이다.`, `차례로 늘어놓으면 ${display}이다.`],
      dedupeKey: `order:${set.join('-')}:${descending ? 'desc' : 'asc'}`,
      difficulty,
    };
  },
  verify({ set, descending }, answer) {
    const out = answer.value;
    if (out.length !== set.length) return false;
    const same = [...out].sort((a, b) => a - b).join() === [...set].sort((a, b) => a - b).join();
    if (!same) return false;
    // 인접 쌍이 모두 단조인지만 본다.
    return out.every((v, idx) => idx === 0 || (descending ? out[idx - 1] > v : out[idx - 1] < v));
  },
};

const sequenceBlank = {
  id: 'math.g12.no.s03.sequence',
  standardCode: CODE(3),
  skill: '뛰어 세기 규칙으로 빈칸 채우기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    const step = difficulty === 1 ? rng.pick([1, 2, 5, 10]) : difficulty === 2 ? rng.pick([10, 50, 100]) : rng.pick([3, 4, 20, 200, 500]);
    const start = rng.int(1, 9999 - step * 4);
    const terms = [0, 1, 2, 3, 4].map((k) => start + step * k);
    const hideIndex = rng.int(1, 4);
    const hidden = terms[hideIndex];
    const shown = terms.map((t, idx) => (idx === hideIndex ? '□' : String(t)));
    return {
      params: { step, hideIndex, terms },
      instruction: '규칙을 찾아 □에 알맞은 수를 써넣으시오.',
      stem: `${shown.join(' - ')}`,
      answer: { value: hidden, display: num(hidden), accepts: [num(hidden)] },
      solution: [
        `${step}씩 뛰어 세는 규칙이다.`,
        `${terms[hideIndex - 1]} + ${step} = ${hidden}이므로 □는 ${hidden}이다.`,
      ],
      dedupeKey: `sequence:${start}:${step}:${hideIndex}`,
      difficulty,
    };
  },
  verify({ step, hideIndex, terms }, answer) {
    // 앞뒤 항과의 차가 모두 step 이어야 한다.
    if (answer.value - terms[hideIndex - 1] !== step) return false;
    const next = terms[hideIndex + 1];
    return next === undefined || next - answer.value === step;
  },
};

// ---------------------------------------------------------------------------
// [2수01-04] 수의 분해와 합성
// ---------------------------------------------------------------------------

const decomposeNumber = {
  id: 'math.g12.no.s04.decompose',
  standardCode: CODE(4),
  skill: '한 수를 두 수로 가르기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    // 모으기·가르기는 1학년 수 감각 활동이다. 10 이내 -> 20 이내까지만 다룬다.
    const total = difficulty === 1 ? rng.int(4, 9) : difficulty === 2 ? rng.int(10, 15) : rng.int(16, 20);
    const left = rng.int(1, total - 1);
    const right = total - left;
    const hideRight = rng.bool();
    const known = hideRight ? left : right;
    const hidden = hideRight ? right : left;
    return {
      params: { total, known, hidden },
      instruction: '□에 알맞은 수를 써넣으시오.',
      stem: hideRight
        ? `${numEun(total)} ${numGwa(left)} □로 가를 수 있습니다.`
        : `${numEun(total)} □와 ${right}로 가를 수 있습니다.`,
      answer: { value: hidden, display: num(hidden), accepts: [num(hidden)] },
      solution: [`${total}에서 ${numEul(known)} 덜어 낸다.`, `${total} - ${known} = ${hidden}`],
      dedupeKey: `decompose-number:${total}:${left}:${hideRight ? 'r' : 'l'}`,
      difficulty,
    };
  },
  verify({ total, known }, answer) {
    // 두 조각의 합이 전체와 같아야 한다.
    return answer.value + known === total && answer.value > 0;
  },
};

const composeNumber = {
  id: 'math.g12.no.s04.compose',
  standardCode: CODE(4),
  skill: '두 수를 모으기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    // 모으기는 합이 20을 넘지 않게 둔다. 두 자리 수 덧셈은 [2수01-06]의 몫이다.
    const cap = difficulty === 1 ? 9 : difficulty === 2 ? 15 : 20;
    const a = rng.int(1, cap - 1);
    const b = rng.int(1, cap - a);
    return {
      params: { a, b },
      instruction: '두 수를 모으면 얼마입니까?',
      stem: `${numGwa(a)} ${b}`,
      answer: { value: a + b, display: num(a + b), accepts: [num(a + b)] },
      solution: [`${a}에서 ${b}만큼 더 세면 ${a + b}이다.`],
      dedupeKey: `compose:${a}:${b}`,
      difficulty,
    };
  },
  verify({ a, b }, answer) {
    return answer.value - b === a && answer.value - a === b;
  },
};

const makeTen = {
  id: 'math.g12.no.s04.make-ten',
  standardCode: CODE(4),
  skill: '10 만들기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    const base = difficulty === 3 ? rng.pick([20, 30, 50, 100]) : 10;
    const a = difficulty === 3 ? rng.int(1, base - 1) : rng.int(1, 9);
    return {
      params: { base, a },
      instruction: '□에 알맞은 수를 써넣으시오.',
      stem: `${a} + □ = ${base}`,
      answer: { value: base - a, display: num(base - a), accepts: [num(base - a)] },
      solution: [`${base}에서 ${numEul(a)} 빼면 ${base - a}이다.`],
      dedupeKey: `make-ten:${base}:${a}`,
      difficulty,
    };
  },
  verify({ base, a }, answer) {
    return a + answer.value === base;
  },
};

// ---------------------------------------------------------------------------
// [2수01-05] 덧셈·뺄셈의 의미 (실생활 상황)
// ---------------------------------------------------------------------------

const storyAdd = {
  id: 'math.g12.no.s05.story-add',
  standardCode: CODE(5),
  skill: '덧셈 상황에서 식 세우고 답 구하기',
  format: 'write-expression',
  generate(rng, { difficulty }) {
    const cap = difficulty === 1 ? 9 : difficulty === 2 ? 40 : 89;
    const a = rng.int(2, cap);
    const b = rng.int(1, Math.min(cap, 99 - a));
    const name = rng.pick(NAMES);
    const thing = rng.pick(THINGS);
    const sum = a + b;
    const expr = `${a} + ${b} = ${sum}`;
    const N = thing.noun;
    return {
      params: { a, b },
      instruction: '식을 쓰고 답을 구하시오.',
      stem: `${name}${josaEun(name)} ${N}${josaEul(N)} ${a}${thing.counter} 가지고 있었습니다.`
        + ` 친구에게 ${b}${thing.counter}${josaEul(thing.counter)} 더 받았습니다.`
        + ` ${name}${josaI(name)} 가진 ${N}${josaEun(N)} 모두 몇 ${thing.counter}입니까?`,
      answer: { value: sum, display: `${expr} / 답 ${sum}${thing.counter}`, accepts: [num(sum), `${sum}${thing.counter}`, expr] },
      solution: ['더 받아서 늘어났으므로 덧셈으로 구한다.', expr, `답은 ${sum}${thing.counter}이다.`],
      dedupeKey: `story-add:${a}:${b}:${N}`,
      difficulty,
    };
  },
  verify({ a, b }, answer) {
    return answer.value - b === a;
  },
};

const storySub = {
  id: 'math.g12.no.s05.story-sub',
  standardCode: CODE(5),
  skill: '뺄셈 상황에서 식 세우고 답 구하기',
  format: 'write-expression',
  generate(rng, { difficulty }) {
    const cap = difficulty === 1 ? 9 : difficulty === 2 ? 40 : 99;
    const a = rng.int(3, cap);
    const b = rng.int(1, a - 1);
    const thing = rng.pick(THINGS);
    const rest = a - b;
    const expr = `${a} - ${b} = ${rest}`;
    const N = thing.noun;
    return {
      params: { a, b },
      instruction: '식을 쓰고 답을 구하시오.',
      stem: `${thing.place}에 ${N}${josaI(N)} ${a}${thing.counter} 있었습니다.`
        + ` 그중 ${b}${thing.counter}${josaEul(thing.counter)} 사용했습니다.`
        + ` 남은 ${N}${josaEun(N)} 몇 ${thing.counter}입니까?`,
      answer: { value: rest, display: `${expr} / 답 ${rest}${thing.counter}`, accepts: [num(rest), `${rest}${thing.counter}`, expr] },
      solution: ['사용해서 줄었으므로 뺄셈으로 구한다.', expr, `답은 ${rest}${thing.counter}이다.`],
      dedupeKey: `story-sub:${a}:${b}:${N}`,
      difficulty,
    };
  },
  verify({ a, b }, answer) {
    return answer.value + b === a;
  },
};

// ---------------------------------------------------------------------------
// [2수01-06] 두 자리 수 범위의 덧셈과 뺄셈
// ---------------------------------------------------------------------------

const addTwoDigit = {
  id: 'math.g12.no.s06.add',
  standardCode: CODE(6),
  skill: '두 자리 수의 덧셈',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    let a;
    let b;
    if (difficulty === 1) {
      // 받아올림 없음
      const aTens = rng.int(1, 8);
      const aOnes = rng.int(0, 8);
      a = aTens * 10 + aOnes;
      b = rng.int(1, 9 - aTens) * 10 + rng.int(0, 9 - aOnes);
    } else {
      // 일의 자리 받아올림 있음
      const aOnes = rng.int(2, 9);
      const bOnes = rng.int(10 - aOnes, 9);
      const aTens = difficulty === 2 ? rng.int(1, 6) : rng.int(2, 7);
      const bTens = rng.int(1, 8 - aTens);
      a = aTens * 10 + aOnes;
      b = bTens * 10 + bOnes;
    }
    const sum = a + b;
    const carry = (a % 10) + (b % 10) >= 10;
    return {
      params: { a, b },
      instruction: '계산하시오.',
      stem: `${a} + ${b}`,
      answer: { value: sum, display: num(sum), accepts: [num(sum)] },
      solution: [
        carry
          ? `일의 자리: ${a % 10} + ${b % 10} = ${(a % 10) + (b % 10)} → 십의 자리로 1 받아올림`
          : `일의 자리: ${a % 10} + ${b % 10} = ${(a % 10) + (b % 10)}`,
        carry
          ? `십의 자리: ${Math.floor(a / 10)} + ${Math.floor(b / 10)} + 1 = ${Math.floor(sum / 10)}`
          : `십의 자리: ${Math.floor(a / 10)} + ${Math.floor(b / 10)} = ${Math.floor(sum / 10)}`,
        `${a} + ${b} = ${sum}`,
      ],
      dedupeKey: `add:${a}:${b}`,
      difficulty,
    };
  },
  verify({ a, b }, answer) {
    // 역연산 + 범위 불변식
    return answer.value - b === a && answer.value <= 99 && answer.value >= Math.max(a, b);
  },
};

const subTwoDigit = {
  id: 'math.g12.no.s06.sub',
  standardCode: CODE(6),
  skill: '두 자리 수의 뺄셈',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    let a;
    let b;
    if (difficulty === 1) {
      // 받아내림 없음
      const aTens = rng.int(2, 9);
      const aOnes = rng.int(1, 9);
      a = aTens * 10 + aOnes;
      b = rng.int(1, aTens - 1) * 10 + rng.int(0, aOnes);
    } else {
      // 받아내림 있음
      const aTens = difficulty === 2 ? rng.int(2, 9) : rng.int(3, 9);
      const aOnes = rng.int(0, 7);
      a = aTens * 10 + aOnes;
      b = rng.int(1, aTens - 1) * 10 + rng.int(aOnes + 1, 9);
    }
    const diff = a - b;
    const borrow = (b % 10) > (a % 10);
    return {
      params: { a, b },
      instruction: '계산하시오.',
      stem: `${a} - ${b}`,
      answer: { value: diff, display: num(diff), accepts: [num(diff)] },
      solution: borrow
        ? [
            `일의 자리 ${a % 10}에서 ${numEul(b % 10)} 뺄 수 없으므로 십의 자리에서 10을 받아내림한다.`,
            `${(a % 10) + 10} - ${b % 10} = ${(a % 10) + 10 - (b % 10)}`,
            `십의 자리: ${Math.floor(a / 10) - 1} - ${Math.floor(b / 10)} = ${Math.floor(a / 10) - 1 - Math.floor(b / 10)}`,
            `${a} - ${b} = ${diff}`,
          ]
        : [
            `일의 자리: ${a % 10} - ${b % 10} = ${(a % 10) - (b % 10)}`,
            `십의 자리: ${Math.floor(a / 10)} - ${Math.floor(b / 10)} = ${Math.floor(a / 10) - Math.floor(b / 10)}`,
            `${a} - ${b} = ${diff}`,
          ],
      dedupeKey: `sub:${a}:${b}`,
      difficulty,
    };
  },
  verify({ a, b }, answer) {
    return answer.value + b === a && answer.value >= 0 && answer.value < a;
  },
};

// ---------------------------------------------------------------------------
// [2수01-07] 덧셈과 뺄셈의 관계
// ---------------------------------------------------------------------------

const addToSub = {
  id: 'math.g12.no.s07.add-to-sub',
  standardCode: CODE(7),
  skill: '덧셈식을 뺄셈식으로 바꾸기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    const cap = difficulty === 1 ? 9 : difficulty === 2 ? 40 : 99;
    const a = rng.int(2, cap - 1);
    const b = rng.int(1, cap - a);
    const c = a + b;
    const useA = rng.bool();
    const subtrahend = useA ? a : b;
    const hidden = useA ? b : a;
    return {
      params: { c, subtrahend, hidden },
      instruction: '덧셈식을 보고 뺄셈식의 □를 채우시오.',
      stem: `${a} + ${b} = ${c}   →   ${c} - ${subtrahend} = □`,
      answer: { value: hidden, display: num(hidden), accepts: [num(hidden)] },
      solution: [
        `덧셈식 ${a} + ${b} = ${c}에서 두 수 중 하나를 빼면 나머지 수가 남는다.`,
        `${c} - ${subtrahend} = ${hidden}`,
      ],
      dedupeKey: `add-to-sub:${a}:${b}:${useA ? 'a' : 'b'}`,
      difficulty,
    };
  },
  verify({ c, subtrahend }, answer) {
    // 덧셈으로 되돌려 확인한다.
    return answer.value + subtrahend === c;
  },
};

const factFamily = {
  id: 'math.g12.no.s07.fact-family',
  standardCode: CODE(7),
  skill: '세 수로 덧셈식 만들기',
  format: 'write-expression',
  generate(rng, { difficulty }) {
    const cap = difficulty === 1 ? 9 : difficulty === 2 ? 30 : 99;
    const a = rng.int(2, cap - 1);
    const b = rng.until(() => rng.int(1, cap - a), (v) => v !== a);
    const c = a + b;
    const trio = rng.shuffle([a, b, c]);
    const expr = `${a} + ${b} = ${c}`;
    return {
      params: { a, b, c },
      instruction: '세 수를 모두 사용하여 덧셈식 하나를 만드시오.',
      stem: `${trio.join(', ')}`,
      answer: { value: c, display: expr, accepts: [expr, `${b} + ${a} = ${c}`] },
      solution: [`가장 큰 수 ${numI(c)} 합이다.`, expr],
      dedupeKey: `fact-family:${a}:${b}`,
      difficulty,
    };
  },
  verify({ a, b, c }, answer) {
    // 가장 큰 수가 나머지 두 수의 합이라는 불변식
    return Math.max(a, b, c) === c && a + b === c && answer.value === c;
  },
};

// ---------------------------------------------------------------------------
// [2수01-08] 어림하여 크기 비교
// ---------------------------------------------------------------------------

const roundToTen = (n) => Math.round(n / 10) * 10;

const estimateSum = {
  id: 'math.g12.no.s08.estimate',
  standardCode: CODE(8),
  skill: '몇십으로 어림하여 계산하기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const isAdd = difficulty === 3 ? rng.bool() : true;
    // 일의 자리가 0이면 어림할 필요가 없고, 5면 '몇십으로 어림'이 위로도 아래로도
    // 정당해져 정답이 하나로 정해지지 않는다. 1~2학년 문항에서는 둘 다 배제한다.
    const roundable = (v) => v % 10 !== 0 && v % 10 !== 5;
    let x;
    let y;
    if (isAdd) {
      x = rng.until(() => rng.int(12, difficulty === 1 ? 44 : 60), roundable);
      y = rng.until(() => rng.int(12, Math.min(60, 99 - x)), roundable);
    } else {
      x = rng.until(() => rng.int(41, 99), roundable);
      y = rng.until(() => rng.int(12, x - 1), roundable);
    }
    const est = isAdd ? roundToTen(x) + roundToTen(y) : roundToTen(x) - roundToTen(y);
    const exact = isAdd ? x + y : x - y;
    // 오답은 전형적 오류를 쓴다: 어림하지 않고 정확히 계산, 한 쪽만 어림, 자리 밀림
    const wrong = distractors(est, [exact, est + 10, est - 10, est + 20]);
    return {
      params: { x, y, isAdd },
      instruction: '몇십으로 어림하여 계산한 값을 고르시오.',
      stem: `${x} ${isAdd ? '+' : '-'} ${y}`,
      choices: buildChoices(rng, est, wrong.slice(0, 3)),
      answer: { value: est, display: num(est), accepts: [num(est)] },
      solution: [
        `${numEun(x)} 약 ${roundToTen(x)}, ${numEun(y)} 약 ${roundToTen(y)}이다.`,
        `${roundToTen(x)} ${isAdd ? '+' : '-'} ${roundToTen(y)} = ${est}`,
      ],
      dedupeKey: `estimate:${x}:${y}:${isAdd ? 'add' : 'sub'}`,
      difficulty,
    };
  },
  verify({ x, y, isAdd }, answer) {
    // 어림값은 10의 배수여야 한다.
    if (answer.value % 10 !== 0) return false;
    // 일의 자리가 5가 아니므로 한 항의 어림 오차는 최대 4, 두 항이면 최대 8이다.
    const exact = isAdd ? x + y : x - y;
    return Math.abs(answer.value - exact) <= 8;
  },
};

const estimateCompare = {
  id: 'math.g12.no.s08.estimate-compare',
  standardCode: CODE(8),
  skill: '어림하여 두 식의 결과 비교하기',
  format: 'compare',
  generate(rng, { difficulty }) {
    // 어림으로 판단한 결과가 정확한 비교와 반드시 일치하도록 제약을 걸고 뽑는다.
    const gap = difficulty === 1 ? 15 : difficulty === 2 ? 8 : 4;
    const quad = rng.until(
      () => [rng.int(11, 60), rng.int(11, 39), rng.int(11, 60), rng.int(11, 39)],
      ([a1, a2, b1, b2]) => {
        const left = a1 + a2;
        const right = b1 + b2;
        const estDiff = roundToTen(a1) + roundToTen(a2) - (roundToTen(b1) + roundToTen(b2));
        return Math.abs(left - right) >= gap && Math.sign(left - right) === Math.sign(estDiff);
      },
      500,
    );
    const [a1, a2, b1, b2] = quad;
    const left = a1 + a2;
    const right = b1 + b2;
    const sign = left > right ? '>' : '<';
    return {
      params: { a1, a2, b1, b2 },
      instruction: '□ 안에 >, < 중 알맞은 것을 써넣으시오.',
      stem: `${a1} + ${a2} □ ${b1} + ${b2}`,
      answer: { value: sign, display: sign, accepts: [sign] },
      solution: [
        `왼쪽은 약 ${roundToTen(a1)} + ${roundToTen(a2)} = ${roundToTen(a1) + roundToTen(a2)}이다.`,
        `오른쪽은 약 ${roundToTen(b1)} + ${roundToTen(b2)} = ${roundToTen(b1) + roundToTen(b2)}이다.`,
        `실제로 계산하면 ${left} ${sign} ${right}이다.`,
      ],
      dedupeKey: `estimate-compare:${a1}:${a2}:${b1}:${b2}`,
      difficulty,
    };
  },
  verify({ a1, a2, b1, b2 }, answer) {
    const diff = a1 + a2 - (b1 + b2);
    return (diff > 0 && answer.value === '>') || (diff < 0 && answer.value === '<');
  },
};

// ---------------------------------------------------------------------------
// [2수01-09] □가 사용된 덧셈식·뺄셈식
// ---------------------------------------------------------------------------

const boxEquation = {
  id: 'math.g12.no.s09.box',
  standardCode: CODE(9),
  skill: '□의 값 구하기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    const cap = difficulty === 1 ? 18 : difficulty === 2 ? 50 : 99;
    const shapes = difficulty === 1
      ? ['add-left', 'add-right']
      : ['add-left', 'add-right', 'sub-minuend', 'sub-subtrahend'];
    const shape = rng.pick(shapes);

    if (shape === 'add-left' || shape === 'add-right') {
      const known = rng.int(1, cap - 2);
      const total = rng.int(known + 1, cap);
      const value = total - known;
      const stem = shape === 'add-left' ? `□ + ${known} = ${total}` : `${known} + □ = ${total}`;
      return {
        params: { shape, known, total },
        instruction: '□에 알맞은 수를 구하시오.',
        stem,
        answer: { value, display: num(value), accepts: [num(value)] },
        solution: ['덧셈에서 모르는 수는 합에서 아는 수를 빼서 구한다.', `${total} - ${known} = ${value}`],
        dedupeKey: `box:${stem}`,
        difficulty,
      };
    }

    if (shape === 'sub-minuend') {
      const sub = rng.int(1, cap - 2);
      const rest = rng.int(1, cap - sub);
      const value = sub + rest;
      const stem = `□ - ${sub} = ${rest}`;
      return {
        params: { shape, sub, rest },
        instruction: '□에 알맞은 수를 구하시오.',
        stem,
        answer: { value, display: num(value), accepts: [num(value)] },
        solution: ['뺄셈에서 처음 수는 남은 수와 뺀 수를 더해서 구한다.', `${rest} + ${sub} = ${value}`],
        dedupeKey: `box:${stem}`,
        difficulty,
      };
    }

    const start = rng.int(3, cap);
    const rest = rng.int(1, start - 1);
    const value = start - rest;
    const stem = `${start} - □ = ${rest}`;
    return {
      params: { shape, start, rest },
      instruction: '□에 알맞은 수를 구하시오.',
      stem,
      answer: { value, display: num(value), accepts: [num(value)] },
      solution: ['빼는 수는 처음 수에서 남은 수를 빼서 구한다.', `${start} - ${rest} = ${value}`],
      dedupeKey: `box:${stem}`,
      difficulty,
    };
  },
  verify(params, answer) {
    // 원래 식에 답을 대입해 등식이 성립하는지 확인한다.
    const v = answer.value;
    if (params.shape === 'add-left' || params.shape === 'add-right') return v + params.known === params.total;
    if (params.shape === 'sub-minuend') return v - params.sub === params.rest;
    return params.start - v === params.rest;
  },
};

// ---------------------------------------------------------------------------
// [2수01-10] 곱셈의 의미
// ---------------------------------------------------------------------------

const groupsToMultiplication = {
  id: 'math.g12.no.s10.groups',
  standardCode: CODE(10),
  skill: '묶음 상황을 곱셈식으로 나타내기',
  format: 'write-expression',
  generate(rng, { difficulty }) {
    const per = difficulty === 1 ? rng.int(2, 5) : rng.int(2, 9);
    const groups = difficulty === 1 ? rng.int(2, 4) : rng.int(2, 9);
    const thing = rng.pick(THINGS);
    const grouping = rng.pick(GROUPINGS);
    const total = per * groups;
    const expr = `${per} × ${groups} = ${total}`;
    const N = thing.noun;
    return {
      params: { per, groups },
      instruction: '곱셈식으로 나타내고 답을 구하시오.',
      stem: `${grouping.unit} ${groups}개가 있습니다. ${grouping.per} ${N}${josaI(N)} ${per}${thing.counter}씩 담겨 있습니다.`
        + ` ${N}${josaEun(N)} 모두 몇 ${thing.counter}입니까?`,
      answer: {
        value: total,
        display: `${expr} / 답 ${total}${thing.counter}`,
        accepts: [num(total), `${total}${thing.counter}`, expr, `${groups} × ${per} = ${total}`],
      },
      solution: [`${per}${thing.counter}씩 ${groups}묶음이다.`, expr],
      dedupeKey: `groups:${per}:${groups}:${N}`,
      difficulty,
    };
  },
  verify({ per, groups }, answer) {
    return repeatedAdd(per, groups) === answer.value;
  },
};

const addToMultiplication = {
  id: 'math.g12.no.s10.add-to-mult',
  standardCode: CODE(10),
  skill: '같은 수의 덧셈을 곱셈식으로 바꾸기',
  format: 'write-expression',
  generate(rng, { difficulty }) {
    const per = difficulty === 1 ? rng.int(2, 5) : rng.int(2, 9);
    const times = difficulty === 1 ? rng.int(2, 4) : rng.int(3, 8);
    const total = per * times;
    const expr = `${per} × ${times} = ${total}`;
    return {
      params: { per, times },
      instruction: '덧셈식을 곱셈식으로 나타내시오.',
      stem: `${Array.from({ length: times }, () => per).join(' + ')} = ${total}`,
      answer: { value: total, display: expr, accepts: [expr, `${times} × ${per} = ${total}`] },
      solution: [`${numI(per)} ${times}번 더해졌다.`, expr],
      dedupeKey: `add-to-mult:${per}:${times}`,
      difficulty,
    };
  },
  verify({ per, times }, answer) {
    return repeatedAdd(per, times) === answer.value;
  },
};

// ---------------------------------------------------------------------------
// [2수01-11] 곱셈구구와 한 자리 수의 곱셈
// ---------------------------------------------------------------------------

const timesTable = {
  id: 'math.g12.no.s11.times-table',
  standardCode: CODE(11),
  skill: '곱셈구구',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const hard = [6, 7, 8, 9];
    const a = difficulty === 1 ? rng.pick([2, 5, 3, 4]) : difficulty === 2 ? rng.int(2, 9) : rng.pick(hard);
    const b = difficulty === 1 ? rng.int(1, 5) : difficulty === 2 ? rng.int(2, 9) : rng.pick(hard);
    const product = a * b;
    return {
      params: { a, b },
      instruction: '계산하시오.',
      stem: `${a} × ${b}`,
      answer: { value: product, display: num(product), accepts: [num(product)] },
      solution: [`${a}단 곱셈구구에서 ${a} × ${b} = ${product}이다.`],
      dedupeKey: `times:${a}:${b}`,
      difficulty,
    };
  },
  verify({ a, b }, answer) {
    return repeatedAdd(a, b) === answer.value;
  },
};

const timesBlank = {
  id: 'math.g12.no.s11.times-blank',
  standardCode: CODE(11),
  skill: '곱셈구구 빈칸 채우기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    const a = difficulty === 1 ? rng.pick([2, 5]) : rng.int(2, 9);
    const b = difficulty === 1 ? rng.int(2, 5) : rng.int(2, 9);
    const product = a * b;
    const hideB = rng.bool();
    const known = hideB ? a : b;
    const hidden = hideB ? b : a;
    return {
      params: { product, known, hidden },
      instruction: '□에 알맞은 수를 써넣으시오.',
      stem: hideB ? `${a} × □ = ${product}` : `□ × ${b} = ${product}`,
      answer: { value: hidden, display: num(hidden), accepts: [num(hidden)] },
      solution: [
        `${known}단 곱셈구구에서 곱이 ${numI(product)} 되는 수를 찾는다.`,
        `${known} × ${hidden} = ${product}`,
      ],
      dedupeKey: `times-blank:${a}:${b}:${hideB ? 'b' : 'a'}`,
      difficulty,
    };
  },
  verify({ product, known }, answer) {
    return repeatedAdd(known, answer.value) === product;
  },
};

export const generators = [
  readNumber,
  writeNumber,
  countTensOnes,
  countNative,
  placeValueDigit,
  placeValueAmount,
  placeDecomposeBlank,
  compareTwo,
  orderThree,
  sequenceBlank,
  decomposeNumber,
  composeNumber,
  makeTen,
  storyAdd,
  storySub,
  addTwoDigit,
  subTwoDigit,
  addToSub,
  factFamily,
  estimateSum,
  estimateCompare,
  boxEquation,
  groupsToMultiplication,
  addToMultiplication,
  timesTable,
  timesBlank,
];
