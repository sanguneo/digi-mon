/**
 * 2022 개정 초등 수학 1~2학년군 2차 확장 문항 생성기.
 *
 * 1차 확장에도 없던 문제 유형을 더한다. □ 안에 들어갈 수 있는 숫자 세기, 몇 개씩
 * 묶음으로 수 만들기, 숫자 카드로 수 만들기, 세 수의 계산 문장제와 □가 있는 세 수의 식,
 * 계산 규칙이 번갈아 바뀌거나 커지는 수의 배열, 정한 규칙으로 늘어놓을 때 처음으로
 * 기준을 넘는 수, 길이 비교와 길이 문장제, 날짜 계산, 표의 빈칸과 ○ 그래프 해석이다.
 *
 * 각 생성기는 params 로 문항을 완전히 결정하고, verify 는 generate 와 다른 경로
 * (닫힌 식, 대입, 하루씩 세기, 다시 세기)로 답을 확인한다.
 */
import { NAMES, THINGS } from '../corpus.mjs';
import {
  countIda, josaEul, josaEun, josaI, numEul, numEun, numRo, particle,
} from '../../engine/korean-number.mjs';
import { expressionAnswerForms } from '../expression-answer.mjs';

const num = (n) => String(n);
const ORDINALS = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째', '여덟째', '아홉째', '열째'];

/** 난이도마다 가장 큰 수가 들어가는 범위. 두 자리 수 범위 안에서 겹치지 않게 나눈다. */
const BANDS = { 1: [10, 39], 2: [40, 69], 3: [70, 99] };

// ---------------------------------------------------------------------------
// [2수01-03] 네 자리 이하의 수의 크기 비교
// ---------------------------------------------------------------------------

const digitsOf = (n, width) => String(n).padStart(width, '0').split('').map(Number);
const fromDigits = (digits) => digits.reduce((acc, d) => acc * 10 + d, 0);

const blankDigitCompare = {
  id: 'math.g12.no.s03.blank-digit-compare',
  standardCode: '[2수01-03]',
  skill: '크기를 비교한 식에서 □ 안에 들어갈 수 있는 숫자의 개수 구하기',
  format: 'short-answer',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 세 자리 수, 2는 네 자리 수의 십·일의 자리, 3은 네 자리 수의 천·백의 자리에 □가 있어 뒤의 자리까지 비교해야 한다.',
  generate(rng, { difficulty }) {
    const width = difficulty === 1 ? 3 : 4;
    const hidden = difficulty === 1 ? rng.int(0, 2) : difficulty === 2 ? rng.int(2, 3) : rng.int(0, 1);
    const lo = hidden === 0 ? 1 : 0;
    const candidates = 10 - lo;
    const built = rng.until(() => {
      const left = digitsOf(rng.int(10 ** (width - 1), 10 ** width - 1), width);
      // 오른쪽 수는 □ 앞자리까지 왼쪽과 같게 두어 □ 자리에서 크기가 갈리게 한다.
      const right = left.map((d, i) => (i < hidden ? d : rng.int(i === 0 ? 1 : 0, 9)));
      const op = rng.pick(['<', '>']);
      const rightValue = fromDigits(right);
      let count = 0;
      for (let x = lo; x <= 9; x += 1) {
        const v = fromDigits(left.map((d, i) => (i === hidden ? x : d)));
        if (op === '<' ? v < rightValue : v > rightValue) count += 1;
      }
      return { left, right: rightValue, op, count };
    }, (b) => b.count > 0 && b.count < candidates, 400);
    const shown = built.left.map((d, i) => (i === hidden ? '□' : String(d))).join('');
    const range = lo === 1 ? '1부터 9까지' : '0부터 9까지';
    return {
      params: { shown, hidden, op: built.op, right: built.right },
      instruction: '물음에 답하시오.',
      stem: `${shown} ${built.op} ${built.right}\n${range}의 숫자 중에서 □ 안에 들어갈 수 있는 숫자는 모두 몇 개입니까?`,
      answer: { value: built.count, display: `${built.count}개`, accepts: [num(built.count), `${built.count}개`] },
      solution: [
        `${hidden === 0 ? '가장 높은' : '앞'} 자리부터 차례로 비교한다. □ 앞의 자리 숫자는 두 수가 같다.`,
        `□ 자리와 그 뒤의 자리를 비교하면 □ 안에 들어갈 수 있는 숫자는 ${built.count}개이다.`,
      ],
      dedupeKey: `blank-digit-compare:${shown}${built.op}${built.right}`,
      difficulty,
    };
  },
  verify({ shown, hidden, op, right }, answer) {
    // □ 를 0 으로 둔 값과 자릿값으로 □ 의 경계를 닫힌 식으로 구한다.
    const width = shown.length;
    const base = Number(shown.replace('□', '0'));
    const place = 10 ** (width - 1 - hidden);
    const lo = hidden === 0 ? 1 : 0;
    const clamp = (v) => Math.min(10, Math.max(lo, v));
    const count = op === '<'
      ? clamp(Math.ceil((right - base) / place)) - lo
      : 10 - clamp(Math.floor((right - base) / place) + 1);
    return Number.isInteger(answer.value) && answer.value === count;
  },
};

// ---------------------------------------------------------------------------
// [2수01-02] 자릿값과 위치적 기수법
// ---------------------------------------------------------------------------

const UNIT_VALUES = [1000, 100, 10, 1];

const composeUnits = {
  id: 'math.g12.no.s02.compose-units',
  standardCode: '[2수01-02]',
  skill: '1000, 100, 10, 1이 몇 개인지로 수 만들기',
  format: 'short-answer',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 세 자리 수, 2는 빈 자리가 있을 수 있는 네 자리 수, 3은 100이나 10, 1이 10개 이상이어서 받아올려 나타내는 네 자리 수다.',
  generate(rng, { difficulty }) {
    let counts;
    if (difficulty === 1) {
      counts = [0, rng.int(1, 9), rng.int(0, 9), rng.int(0, 9)];
    } else if (difficulty === 2) {
      counts = [rng.int(1, 9), rng.int(0, 9), rng.int(0, 9), rng.int(0, 9)];
    } else {
      counts = rng.until(() => [rng.int(1, 7), rng.int(0, 25), rng.int(0, 45), rng.int(0, 45)], (c) => {
        const value = c.reduce((s, k, i) => s + k * UNIT_VALUES[i], 0);
        return value <= 9999 && c.slice(1).some((k) => k >= 10);
      });
    }
    const value = counts.reduce((s, k, i) => s + k * UNIT_VALUES[i], 0);
    // 1000(천), 100(백), 10(십), 1(일)은 모두 받침으로 끝나 '이'를 쓴다. 0개인 단위는 말하지 않는다.
    const parts = counts.map((k, i) => (k === 0 ? null : `${UNIT_VALUES[i]}이 ${k}개`)).filter(Boolean);
    return {
      params: { counts },
      instruction: '물음에 답하시오.',
      stem: `${parts.join(', ')}인 수는 얼마입니까?`,
      answer: { value, display: num(value), accepts: [num(value)] },
      solution: [
        counts.map((k, i) => (k === 0 ? null : `${UNIT_VALUES[i]}이 ${k}개이면 ${k * UNIT_VALUES[i]}`)).filter(Boolean).join(', ') + '이다.',
        `${counts.map((k, i) => k * UNIT_VALUES[i]).filter((v) => v > 0).join(' + ')} = ${value}이다.`,
      ],
      dedupeKey: `compose-units:${counts.join(':')}`,
      difficulty,
    };
  },
  verify({ counts }, answer) {
    // 답에서 1, 10, 100 의 개수를 차례로 덜어 내며 거꾸로 되짚는다.
    let rest = answer.value;
    if (!Number.isInteger(rest)) return false;
    for (let i = 3; i >= 1; i -= 1) {
      rest -= counts[i];
      if (rest < 0 || rest % 10 !== 0) return false;
      rest /= 10;
    }
    return rest === counts[0];
  },
};

// ---------------------------------------------------------------------------
// [2수01-03] 숫자 카드로 수 만들기
// ---------------------------------------------------------------------------

function cardNumbers(cards) {
  const out = new Set();
  const walk = (used, acc) => {
    if (acc.length === cards.length) {
      if (acc[0] !== 0) out.add(fromDigits(acc));
      return;
    }
    cards.forEach((d, i) => {
      if (!used[i]) {
        used[i] = true;
        walk(used, [...acc, d]);
        used[i] = false;
      }
    });
  };
  walk(cards.map(() => false), []);
  return [...out].sort((a, b) => a - b);
}

const sameCards = (n, cards) => {
  const s = String(n);
  return s.length === cards.length && [...s].map(Number).sort().join('') === [...cards].sort().join('');
};

const CARD_ASKS = {
  largest: '가장 큰 수',
  smallest: '가장 작은 수',
  'second-largest': '둘째로 큰 수',
  'second-smallest': '둘째로 작은 수',
};

const digitCards = {
  id: 'math.g12.no.s03.digit-cards',
  standardCode: '[2수01-03]',
  skill: '숫자 카드로 조건에 맞는 수 만들기',
  format: 'short-answer',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 카드 3장으로 세 자리 수, 2는 카드 4장으로 네 자리 수, 3은 카드 4장으로 만든 수 중 기준 수에 가장 가까운 수를 찾는다.',
  generate(rng, { difficulty }) {
    const size = difficulty === 1 ? 3 : 4;
    const cards = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, size);
    const made = cardNumbers(cards);
    let kind;
    let threshold = null;
    let value;
    if (difficulty < 3) {
      kind = rng.pick(Object.keys(CARD_ASKS));
      value = { largest: made.at(-1), smallest: made[0], 'second-largest': made.at(-2), 'second-smallest': made[1] }[kind];
    } else {
      kind = rng.pick(['least-above', 'greatest-below']);
      // 기준 수는 만들 수 있는 수 사이에서 고르되 만들 수 있는 수와 같지 않게 한다.
      threshold = rng.until(() => rng.int(made[0] + 1, made.at(-1) - 1), (t) => !made.includes(t));
      value = kind === 'least-above' ? made.find((n) => n > threshold) : made.filter((n) => n < threshold).at(-1);
    }
    const wordWidth = size === 3 ? '세 자리 수' : '네 자리 수';
    const shownCards = cards.slice(0, -1).join(', ') + `, ${numEul(cards.at(-1))}`;
    const ask = threshold === null
      ? `만들 수 있는 수 중에서 ${CARD_ASKS[kind]}${josaEun(CARD_ASKS[kind])} 무엇입니까?`
      : `만들 수 있는 수 중에서 ${threshold}보다 ${kind === 'least-above' ? '큰 수 가운데 가장 작은 수' : '작은 수 가운데 가장 큰 수'}는 무엇입니까?`;
    return {
      params: { cards, kind, threshold },
      instruction: '물음에 답하시오.',
      stem: `숫자 카드 ${shownCards} 한 번씩만 사용하여 ${wordWidth}를 만들려고 합니다. ${ask}`,
      answer: { value, display: num(value), accepts: [num(value)] },
      solution: [
        kind === 'largest' || kind === 'second-largest' || kind === 'greatest-below'
          ? '높은 자리에 큰 숫자를 놓을수록 큰 수가 된다.'
          : '높은 자리에 작은 숫자를 놓을수록 작은 수가 된다. 0은 맨 앞에 놓을 수 없다.',
        `조건에 맞는 수는 ${value}이다.`,
      ],
      dedupeKey: `digit-cards:${[...cards].sort().join('')}:${kind}:${threshold ?? ''}`,
      difficulty,
    };
  },
  verify({ cards, kind, threshold }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || !sameCards(v, cards)) return false;
    const width = cards.length;
    // 만들 수 있는 수인지 하나씩 확인하며 사이에 다른 수가 있는지 센다.
    const countBetween = (from, to) => {
      let c = 0;
      for (let n = from; n <= to; n += 1) if (sameCards(n, cards)) c += 1;
      return c;
    };
    const top = 10 ** width - 1;
    const bottom = 10 ** (width - 1);
    if (kind === 'largest') return countBetween(v + 1, top) === 0;
    if (kind === 'smallest') return countBetween(bottom, v - 1) === 0;
    if (kind === 'second-largest') return countBetween(v + 1, top) === 1;
    if (kind === 'second-smallest') return countBetween(bottom, v - 1) === 1;
    if (kind === 'least-above') return v > threshold && countBetween(threshold + 1, v - 1) === 0;
    return v < threshold && countBetween(v + 1, threshold - 1) === 0;
  },
};

// ---------------------------------------------------------------------------
// [2수01-08] 세 수의 덧셈과 뺄셈 · [2수01-09] □가 있는 세 수의 식
// ---------------------------------------------------------------------------

/**
 * 두 자리 수 범위의 세 수 계산. 중간 결과와 최종 결과가 0~99 사이에 있고,
 * 식에 나오는 가장 큰 수(처음 수, 중간 합 포함)가 난이도 범위에 든다.
 */
function threeTerms(rng, difficulty, shape) {
  const [lo, hi] = BANDS[difficulty];
  if (shape === '++') {
    const total = rng.int(lo, hi);
    const a = rng.int(1, total - 2);
    const b = rng.int(1, total - a - 1);
    return { a, b, c: total - a - b, ops: ['+', '+'], value: total };
  }
  if (shape === '+-') {
    const top = rng.int(lo, hi);
    const a = rng.int(1, top - 1);
    const c = rng.int(1, top - 1);
    return { a, b: top - a, c, ops: ['+', '-'], value: top - c };
  }
  if (shape === '--') {
    const a = rng.int(Math.max(lo, 3), hi);
    const b = rng.int(1, a - 2);
    const c = rng.int(1, a - b - 1);
    return { a, b, c, ops: ['-', '-'], value: a - b - c };
  }
  const a = rng.int(lo, hi);
  const b = rng.int(1, a - 1);
  const c = rng.int(1, hi - (a - b));
  return { a, b, c, ops: ['-', '+'], value: a - b + c };
}

const evalLeft = (a, ops, b, c) => {
  const first = ops[0] === '+' ? a + b : a - b;
  return ops[1] === '+' ? first + c : first - c;
};

const CONTAINERS = THINGS.filter((t) => ['주머니', '필통', '가방', '상자', '봉지', '바구니', '통'].includes(t.place));

const storyThree = {
  id: 'math.g12.no.s08.story-three',
  standardCode: '[2수01-08]',
  skill: '세 수의 덧셈과 뺄셈 문장제',
  format: 'write-expression',
  generate(rng, { difficulty }) {
    const shape = rng.pick(['++', '+-', '--', '-+']);
    const t = rng.until(() => threeTerms(rng, difficulty, shape), (x) => ![x.a, x.b, x.c].includes(x.value));
    const thing = rng.pick(CONTAINERS);
    const name = rng.pick(NAMES);
    const { noun: N, counter: C, place } = thing;
    const { a, b, c, ops, value } = t;
    const stems = {
      '++': `${name}${josaEun(name)} ${N}${josaEul(N)} ${a}${C} 가지고 있었습니다. 언니에게 ${b}${C}, 동생에게 ${c}${C}${josaEul(C)} 더 받았습니다.`
        + ` ${name}${josaI(name)} 지금 가진 ${N}${josaEun(N)} 모두 몇 ${C}입니까?`,
      '+-': `${place}에 ${N}${josaI(N)} ${a}${C} 있었습니다. ${b}${C}${josaEul(C)} 더 넣은 뒤 ${c}${C}${josaEul(C)} 꺼냈습니다.`
        + ` ${place}에 있는 ${N}${josaEun(N)} 몇 ${C}입니까?`,
      '--': `${place}에 ${N}${josaI(N)} ${a}${C} 있었습니다. 오전에 ${b}${C}, 오후에 ${c}${C}${josaEul(C)} 꺼냈습니다.`
        + ` ${place}에 남은 ${N}${josaEun(N)} 몇 ${C}입니까?`,
      '-+': `${place}에 ${N}${josaI(N)} ${a}${C} 있었습니다. ${b}${C}${josaEul(C)} 꺼낸 뒤 ${c}${C}${josaEul(C)} 다시 넣었습니다.`
        + ` ${place}에 있는 ${N}${josaEun(N)} 몇 ${C}입니까?`,
    };
    const expr = `${a} ${ops[0]} ${b} ${ops[1]} ${c} = ${value}`;
    const first = ops[0] === '+' ? a + b : a - b;
    return {
      params: { a, b, c, ops },
      instruction: '식을 쓰고 답을 구하시오.',
      stem: stems[shape],
      answer: { value, display: `${value}${C}`, accepts: [num(value), `${value}${C}`, expr, ...expressionAnswerForms([expr], value, C)] },
      solution: [
        `앞에서부터 차례로 계산하면 ${a} ${ops[0]} ${b} = ${first}, ${first} ${ops[1]} ${c} = ${value}이다.`,
        `답은 ${countIda(value, C)}.`,
      ],
      dedupeKey: `story-three:${a}${ops[0]}${b}${ops[1]}${c}`,
      difficulty,
    };
  },
  verify({ a, b, c, ops }, answer) {
    // 답에서 마지막 계산과 첫 계산을 차례로 되돌려 처음 수가 나오는지 본다.
    const v = answer.value;
    if (!Number.isInteger(v) || v < 0) return false;
    const beforeLast = ops[1] === '+' ? v - c : v + c;
    return (ops[0] === '+' ? beforeLast - b : beforeLast + b) === a;
  },
};

const boxThree = {
  id: 'math.g12.no.s09.box-three',
  standardCode: '[2수01-09]',
  skill: '□가 있는 세 수의 덧셈식·뺄셈식에서 □의 값 구하기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    const shape = rng.pick(['++', '+-', '--', '-+']);
    const position = rng.int(0, 2);
    const t = rng.until(() => threeTerms(rng, difficulty, shape), (x) => {
      const terms = [x.a, x.b, x.c];
      const hiddenValue = terms[position];
      return ![...terms.filter((_, i) => i !== position), x.value].includes(hiddenValue);
    });
    const terms = [t.a, t.b, t.c];
    const hiddenValue = terms[position];
    const shown = terms.map((v, i) => (i === position ? '□' : String(v)));
    const stem = `${shown[0]} ${t.ops[0]} ${shown[1]} ${t.ops[1]} ${shown[2]} = ${t.value}`;
    return {
      params: { shown, ops: t.ops, result: t.value },
      instruction: '□ 안에 알맞은 수를 써넣으시오.',
      stem,
      answer: { value: hiddenValue, display: num(hiddenValue), accepts: [num(hiddenValue)] },
      solution: [
        '□를 뺀 나머지 수끼리 먼저 계산하거나, 덧셈과 뺄셈의 관계를 이용해 거꾸로 계산한다.',
        `□ 자리에 ${numEul(hiddenValue)} 넣으면 ${terms[0]} ${t.ops[0]} ${terms[1]} ${t.ops[1]} ${terms[2]} = ${t.value}이다.`,
      ],
      dedupeKey: `box-three:${stem.replace(/ /g, '')}`,
      difficulty,
    };
  },
  verify({ shown, ops, result }, answer) {
    // □ 자리에 답을 넣고 앞에서부터 계산해 결과가 맞는지 본다.
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    const [a, b, c] = shown.map((s) => (s === '□' ? v : Number(s)));
    const first = ops[0] === '+' ? a + b : a - b;
    if (first < 0) return false;
    return evalLeft(a, ops, b, c) === result;
  },
};

// ---------------------------------------------------------------------------
// [2수02-01] 수 배열의 규칙 · [2수02-02] 정한 규칙에 따라 배열하기
// ---------------------------------------------------------------------------

function fillAndDiffs(shown, value) {
  const terms = shown.map((t) => (t === null ? value : t));
  return terms.slice(1).map((t, i) => t - terms[i]);
}

const alternatingSteps = {
  id: 'math.g12.pd.s01.alternating-steps',
  standardCode: '[2수02-01]',
  skill: '두 가지 계산이 번갈아 되풀이되는 수의 배열에서 빈칸 채우기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    const length = 7;
    let start;
    let s1;
    let s2;
    if (difficulty === 1) {
      // 한 자리 수만큼씩 커지고, 모든 수가 99 이하이다.
      s1 = rng.int(1, 9);
      s2 = rng.until(() => rng.int(1, 9), (v) => v !== s1);
      start = rng.int(1, 99 - 3 * (s1 + s2));
    } else if (difficulty === 2) {
      // 두 자리 수만큼씩 커지거나 작아지고, 모든 수가 1부터 99 사이에 있다.
      s1 = rng.int(11, 30);
      const offsetsOf = (b) => [0, s1, s1 + b, 2 * s1 + b, 2 * s1 + 2 * b, 3 * s1 + 2 * b, 3 * s1 + 3 * b];
      const spanOf = (b) => Math.max(...offsetsOf(b)) - Math.min(...offsetsOf(b));
      s2 = rng.pick(Array.from({ length: 71 }, (_, i) => i - 30).filter((b) => b !== 0 && b !== s1 && spanOf(b) <= 90));
      const offsets = offsetsOf(s2);
      start = rng.int(1 - Math.min(...offsets), 99 - Math.max(...offsets));
    } else {
      // 세 자리·네 자리 수에서는 한 자리의 숫자만 바뀌도록 몇·몇십·몇백·몇천씩 뛰어 센다.
      // 두 계산이 서로 다른 자리를 바꾸고, 받아올림·받아내림이 생기지 않는다.
      const width = rng.int(3, 4);
      const [p1, p2] = rng.shuffle(Array.from({ length: width }, (_, i) => i)).slice(0, 2);
      const digits = Array.from({ length: width }, (_, i) => rng.int(i === width - 1 ? 1 : 0, 9));
      const placeStep = (p) => {
        const lo = p === width - 1 ? 1 : 0;
        const k = rng.pick(p === width - 1 ? [-2, -1, 1, 2] : [-3, -2, -1, 1, 2, 3]);
        // 같은 계산이 세 번 되풀이되어도 그 자리의 숫자가 0~9(맨 앞자리는 1~9)에 머문다.
        digits[p] = k > 0 ? rng.int(lo, 9 - 3 * k) : rng.int(lo - 3 * k, 9);
        return k * 10 ** p;
      };
      s1 = placeStep(p1);
      s2 = placeStep(p2);
      start = digits.reduce((acc, d, p) => acc + d * 10 ** p, 0);
    }
    const terms = [start];
    for (let i = 1; i < length; i += 1) terms.push(terms[i - 1] + (i % 2 === 1 ? s1 : s2));
    const blank = rng.int(1, length - 1);
    const value = terms[blank];
    const shown = terms.map((t, i) => (i === blank ? null : t));
    const step = (s) => (s > 0 ? `${s}만큼 커지고` : `${-s}만큼 작아지고`);
    return {
      params: { shown },
      instruction: '규칙을 찾아 □ 안에 알맞은 수를 써넣으시오.',
      stem: shown.map((t) => (t === null ? '□' : String(t))).join(', '),
      answer: { value, display: num(value), accepts: [num(value)] },
      solution: [
        `수가 ${step(s1)}, ${step(s2).replace(/고$/, '는')} 것이 되풀이된다.`,
        `${ORDINALS[blank]} 수는 ${value}이다.`,
      ],
      dedupeKey: `alternating-steps:${start}:${s1}:${s2}:${blank}`,
      difficulty,
    };
  },
  verify({ shown }, answer) {
    // 빈칸을 채운 뒤 이웃한 수의 차가 두 값으로 번갈아 되풀이되는지 본다.
    if (!Number.isInteger(answer.value)) return false;
    const diffs = fillAndDiffs(shown, answer.value);
    return diffs[0] !== diffs[1] && diffs.every((d, i) => d === diffs[i % 2]);
  },
};

const growingStep = {
  id: 'math.g12.pd.s01.growing-step',
  standardCode: '[2수02-01]',
  skill: '이웃한 두 수의 차가 일정하게 커지거나 작아지는 수의 배열에서 빈칸 채우기',
  format: 'fill-blank',
  difficultyAxis: 'categorical',
  difficultyNote: '모든 수는 99 이하이다. 난이도 1은 커지는 양이 1씩 늘어나는 배열, 2는 커지는 양이 2~5씩 늘어나거나 줄어드는 배열, 3은 수가 작아지면서 작아지는 양이 일정하게 늘어나거나 줄어드는 배열이다.',
  generate(rng, { difficulty }) {
    const length = 6;
    // 차가 step, step+grow, ... 로 바뀌며 다섯 번 더해지므로 모두 합하면 5×step + 10×grow 이다.
    const grow = difficulty === 1 ? 1 : difficulty === 2 ? rng.int(2, 5) : rng.int(1, 5);
    const step = difficulty === 1 ? rng.int(1, 9) : rng.int(1, Math.floor((98 - 10 * grow) / 5));
    const shrinking = difficulty !== 1 && rng.bool();
    const up = difficulty !== 3;
    const mags = Array.from({ length: length - 1 }, (_, i) => step + grow * (shrinking ? length - 2 - i : i));
    const span = mags.reduce((s, m) => s + m, 0);
    const start = up ? rng.int(1, 99 - span) : rng.int(span + 1, 99);
    const terms = [start];
    for (let i = 1; i < length; i += 1) terms.push(terms[i - 1] + (up ? mags[i - 1] : -mags[i - 1]));
    const blank = rng.int(1, length - 1);
    const value = terms[blank];
    const shown = terms.map((t, i) => (i === blank ? null : t));
    const change = mags[1] - mags[0];
    return {
      params: { shown },
      instruction: '규칙을 찾아 □ 안에 알맞은 수를 써넣으시오.',
      stem: shown.map((t) => (t === null ? '□' : String(t))).join(', '),
      answer: { value, display: num(value), accepts: [num(value)] },
      solution: [
        `수가 차례로 ${mags.join(', ')}만큼 ${up ? '커지고' : '작아지고'}, ${up ? '커지는' : '작아지는'} 양이 ${Math.abs(change)}씩 ${change > 0 ? '커지는' : '작아지는'} 규칙이다.`,
        `${ORDINALS[blank]} 수는 ${terms[blank - 1]} ${up ? '+' : '-'} ${mags[blank - 1]} = ${value}이다.`,
      ],
      dedupeKey: `growing-step:${terms.join(',')}:${blank}`,
      difficulty,
    };
  },
  verify({ shown }, answer) {
    // 차의 차가 모두 같고 0이 아닌지 본다.
    if (!Number.isInteger(answer.value)) return false;
    const diffs = fillAndDiffs(shown, answer.value);
    const second = diffs.slice(1).map((d, i) => d - diffs[i]);
    return second[0] !== 0 && second.every((s) => s === second[0]);
  },
};

const ruleFirstOver = {
  id: 'math.g12.pd.s02.rule-first-over',
  standardCode: '[2수02-02]',
  skill: '정한 규칙대로 수를 늘어놓을 때 기준 수를 처음 넘는 수와 그 전까지의 개수 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    // 난이도 1·2는 기준 수가 99 이하라 두 자리 수의 덧셈으로 늘어놓는다.
    // 난이도 3은 세 자리·네 자리 수를 10, 100, 1000씩 뛰어 센다.
    let start;
    let step;
    let limit;
    if (difficulty === 3) {
      step = rng.pick([10, 100, 1000]);
      const n = rng.int(4, step === 1000 ? 8 : 14);
      start = rng.int(100, 9999 - step * (n + 1));
      limit = start + step * n - rng.int(0, step - 1);
    } else {
      step = difficulty === 1 ? rng.int(2, 9) : rng.int(11, 32);
      const n = rng.int(3, Math.min(12, Math.floor(98 / step)));
      const r = rng.int(0, step - 1);
      start = rng.int(1, Math.min(difficulty === 1 ? 30 : 60, 99 - step * n + r));
      limit = start + step * n - r;
    }
    const kind = rng.pick(['first-over', 'count-under']);
    // 처음으로 기준보다 커지는 수와, 기준보다 작은 수의 개수
    let k = 0;
    while (start + step * k <= limit) k += 1;
    const firstOver = start + step * k;
    let under = 0;
    while (start + step * under < limit) under += 1;
    const value = kind === 'first-over' ? firstOver : under;
    const rule = `${start}부터 시작하여 ${step}씩 커지게 수를 늘어놓습니다.`;
    const ask = kind === 'first-over'
      ? `처음으로 ${limit}보다 큰 수가 되는 수는 무엇입니까?`
      : `늘어놓은 수 중에서 ${limit}보다 작은 수는 모두 몇 개입니까?`;
    return {
      params: { kind, start, step, limit },
      instruction: '규칙에 따라 수를 늘어놓고 물음에 답하시오.',
      stem: `${rule} ${ask}`,
      answer: kind === 'first-over'
        ? { value, display: num(value), accepts: [num(value)] }
        : { value, display: `${value}개`, accepts: [num(value), `${value}개`] },
      solution: [
        `${start}, ${start + step}, ${start + 2 * step}, ...와 같이 ${step}씩 커진다.`,
        kind === 'first-over'
          ? `${numEun(firstOver - step)} ${limit}보다 크지 않고 ${numEun(firstOver)} ${limit}보다 크므로 답은 ${value}이다.`
          : `${limit}보다 작은 수는 ${start}부터 ${start + step * (under - 1)}까지 ${value}개이다.`,
      ],
      dedupeKey: `rule-first-over:${kind}:${start}:${step}:${limit}`,
      difficulty,
    };
  },
  verify({ kind, start, step, limit }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v)) return false;
    if (kind === 'first-over') return v > limit && v - step <= limit && v >= start && (v - start) % step === 0;
    // 개수 n 이면 n번째 수는 기준보다 작고 n+1번째 수는 기준 이상이다.
    return v >= 1 && start + step * (v - 1) < limit && start + step * v >= limit;
  },
};

// ---------------------------------------------------------------------------
// [2수03-11] 길이의 비교 · [2수03-13] 길이의 덧셈과 뺄셈 문장제
// ---------------------------------------------------------------------------

const formatMcm = (cm) => (cm % 100 === 0 ? `${cm / 100}m` : cm < 100 ? `${cm}cm` : `${Math.floor(cm / 100)}m ${cm % 100}cm`);

function parseLength(text) {
  const both = /^(\d+)m ?(\d+)cm$/.exec(text);
  if (both) return Number(both[2]) < 100 ? Number(both[1]) * 100 + Number(both[2]) : null;
  const m = /^(\d+)m$/.exec(text);
  if (m) return Number(m[1]) * 100;
  const cm = /^(\d+)cm$/.exec(text);
  if (cm) return Number(cm[1]);
  return /^\d+$/.test(text) ? Number(text) : null;
}

const LABELS = ['가', '나', '다'];

const compareLength = {
  id: 'math.g12.gm.s11.compare-length',
  standardCode: '[2수03-11]',
  skill: '몇 m 몇 cm와 몇 cm로 나타낸 길이를 비교하여 차 구하기',
  format: 'short-answer',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 1m와 3m 사이의 두 길이, 2는 10m보다 짧은 두 길이, 3은 세 길이에서 가장 긴 길이와 가장 짧은 길이를 찾아 비교한다.',
  generate(rng, { difficulty }) {
    const count = difficulty === 3 ? 3 : 2;
    const [lo, hi] = difficulty === 1 ? [101, 299] : [101, 999];
    // 난이도 1은 긴 길이의 cm 부분이 짧은 길이의 cm 부분보다 커서 받아내림이 없다.
    const noBorrow = (ls) => difficulty !== 1 || Math.max(...ls) % 100 > Math.min(...ls) % 100;
    const lengths = rng.until(
      () => Array.from({ length: count }, () => rng.int(lo, hi)),
      (ls) => new Set(ls).size === count && ls.every((l) => l % 100 !== 0) && noBorrow(ls),
    );
    // 적어도 하나는 몇 m 몇 cm, 하나는 몇 cm로 쓴다.
    const asCm = rng.int(0, count - 1);
    const shown = lengths.map((l, i) => (i === asCm ? `${l}cm` : formatMcm(l)));
    const longest = Math.max(...lengths);
    const shortest = Math.min(...lengths);
    const value = longest - shortest;
    const ask = count === 2 ? '두 길이의 차는 몇 cm입니까?' : '가장 긴 길이와 가장 짧은 길이의 차는 몇 cm입니까?';
    return {
      params: { shown },
      instruction: '물음에 답하시오.',
      stem: `${shown.map((s, i) => `${LABELS[i]}: ${s}`).join(', ')}\n${ask}`,
      answer: { value, display: `${value}cm`, accepts: [num(value), `${value}cm`] },
      solution: [
        `1m는 100cm이므로 모두 cm로 나타내면 ${lengths.map((l) => `${l}cm`).join(', ')}이다.`,
        `${longest} - ${shortest} = ${value}이므로 ${value}cm이다.`,
      ],
      dedupeKey: `compare-length:${shown.join('|')}`,
      difficulty,
    };
  },
  verify({ shown }, answer) {
    // 길이를 다시 읽어 정렬한 뒤, 가장 짧은 길이에 답을 더하면 가장 긴 길이가 되는지 본다.
    const ls = shown.map(parseLength).sort((a, b) => a - b);
    return Number.isInteger(answer.value) && ls[0] + answer.value === ls.at(-1);
  },
};

const lengthStory = {
  id: 'math.g12.gm.s13.length-story',
  standardCode: '[2수03-13]',
  skill: '길이의 덧셈과 뺄셈을 이용하는 문장제',
  format: 'short-answer',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 이어 붙인 길이(덧셈), 2는 잘라 내고 남은 길이(뺄셈), 3은 이어 붙인 뒤 잘라 내는 두 단계 계산이다.',
  generate(rng, { difficulty }) {
    const object = rng.pick(['끈', '리본', '색 테이프', '털실']);
    let x;
    let y;
    let z = null;
    let value;
    if (difficulty === 1) {
      x = rng.int(101, 699);
      y = rng.int(101, 999 - x);
      value = x + y;
    } else if (difficulty === 2) {
      x = rng.int(201, 999);
      y = rng.int(101, x - 50);
      value = x - y;
    } else {
      x = rng.int(101, 699);
      y = rng.int(101, 999 - x);
      z = rng.int(101, x + y - 50);
      value = x + y - z;
    }
    if ([x, y, z].includes(value)) value = null;
    // 난이도 1은 cm끼리 더해 100이 넘지 않아 받아올림이 없다.
    const carries = difficulty === 1 && (x % 100) + (y % 100) >= 100;
    if (value === null || carries || [x, y, z].some((v) => v !== null && v % 100 === 0) || value % 100 === 0) {
      return this.generate(rng, { difficulty });
    }
    const O = object;
    // 길이는 '미터'나 '센티미터'로 끝나므로 뒤에 '를'을 쓴다.
    const askUnit = value < 100 ? '몇 cm' : '몇 m 몇 cm';
    const stems = {
      1: `길이가 ${formatMcm(x)}인 ${O}에 ${formatMcm(y)}인 ${O}${josaEul(O)} 겹치지 않게 이어 붙였습니다. 이어 붙인 ${O}의 길이는 ${askUnit}입니까?`,
      2: `길이가 ${formatMcm(x)}인 ${O}에서 ${formatMcm(y)}를 잘라 썼습니다. 남은 ${O}의 길이는 ${askUnit}입니까?`,
      3: `길이가 ${formatMcm(x)}인 ${O}에 ${formatMcm(y)}인 ${O}${josaEul(O)} 겹치지 않게 이어 붙인 뒤 ${formatMcm(z ?? 0)}를 잘라 썼습니다. 남은 ${O}의 길이는 ${askUnit}입니까?`,
    };
    const display = formatMcm(value);
    return {
      params: { x, y, z, kind: difficulty },
      instruction: '물음에 답하시오.',
      stem: stems[difficulty],
      answer: { value: display, display, accepts: [display, display.replace(' ', ''), `${value}cm`] },
      solution: [
        difficulty === 1 ? '이어 붙인 길이는 두 길이를 더한다.' : difficulty === 2 ? '남은 길이는 처음 길이에서 잘라 쓴 길이를 뺀다.' : '이어 붙인 길이를 먼저 구하고, 잘라 쓴 길이를 뺀다.',
        difficulty === 1
          ? `${formatMcm(x)} + ${formatMcm(y)} = ${display}이다.`
          : difficulty === 2
            ? `${formatMcm(x)} - ${formatMcm(y)} = ${display}이다.`
            : `${formatMcm(x)} + ${formatMcm(y)} = ${formatMcm(x + y)}, ${formatMcm(x + y)} - ${formatMcm(z)} = ${display}이다.`,
      ],
      dedupeKey: `length-story:${difficulty}:${x}:${y}:${z ?? ''}`,
      difficulty,
    };
  },
  verify({ x, y, z, kind }, answer) {
    const v = parseLength(String(answer.value));
    if (v === null || /^\d+$/.test(String(answer.value))) return false;
    // 남은 길이에 잘라 쓴 길이를 다시 더해 처음 길이로 되돌린다.
    if (kind === 1) return v - y === x;
    if (kind === 2) return v + y === x;
    return v + z - y === x;
  },
};

// ---------------------------------------------------------------------------
// [2수03-09] 1일, 1주일, 1개월, 1년 사이의 관계 — 날짜 계산
// ---------------------------------------------------------------------------

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function addDays(month, day, n) {
  let m = month;
  let d = day + n;
  while (d > MONTH_DAYS[m - 1]) {
    d -= MONTH_DAYS[m - 1];
    m = m === 12 ? 1 : m + 1;
  }
  return { month: m, day: d };
}

function monthsCrossed(month, day, n) {
  const months = [month];
  let m = month;
  let d = day + n;
  while (d > MONTH_DAYS[m - 1]) {
    d -= MONTH_DAYS[m - 1];
    m = m === 12 ? 1 : m + 1;
    months.push(m);
  }
  return months;
}

const dateAfter = {
  id: 'math.g12.gm.s09.date-after',
  standardCode: '[2수03-09]',
  skill: '달마다 날수가 다름을 이용하여 며칠 뒤의 날짜와 지난 날수 구하기',
  format: 'short-answer',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 같은 달 안의 계산, 2는 다음 달로 한 번 넘어가는 계산, 3은 두 달 이상 넘어가는 계산이다.',
  generate(rng, { difficulty }) {
    const month = rng.int(1, 12);
    const len = MONTH_DAYS[month - 1];
    let day;
    let n;
    if (difficulty === 1) {
      day = rng.int(1, len - 2);
      n = rng.int(2, len - day);
    } else if (difficulty === 2) {
      day = rng.int(2, len);
      const next = MONTH_DAYS[month % 12];
      n = rng.int(len - day + 1, len - day + next);
    } else {
      day = rng.int(1, len);
      const next = MONTH_DAYS[month % 12];
      n = rng.int(len - day + next + 1, len - day + next + 28);
    }
    const end = addDays(month, day, n);
    const kind = rng.pick(['after', 'between']);
    const febNote = monthsCrossed(month, day, n).includes(2) ? ' 올해 2월은 28일까지 있습니다.' : '';
    const startText = `${month}월 ${day}일`;
    const endText = `${end.month}월 ${end.day}일`;
    const crossed = monthsCrossed(month, day, n);
    const solution = [
      crossed.length === 1
        ? `같은 달 안에서 날짜에 ${n}일을 더한다.`
        : `${crossed.slice(0, -1).map((m) => `${m}월은 ${MONTH_DAYS[m - 1]}일까지`).join(', ')} 있다.`,
      kind === 'after' ? `${startText}에서 ${n}일 뒤는 ${endText}이다.` : `${startText}에서 ${endText}까지는 ${n}일이 지난다.`,
    ];
    if (kind === 'after') {
      return {
        params: { kind, month, day, n },
        instruction: '물음에 답하시오.',
        stem: `오늘은 ${startText}입니다.${febNote} 오늘부터 ${n}일 뒤는 몇 월 며칠입니까?`,
        answer: { value: endText, display: endText, accepts: [endText, endText.replace(' ', '')] },
        solution,
        dedupeKey: `date-after:after:${month}:${day}:${n}`,
        difficulty,
      };
    }
    return {
      params: { kind, month, day, endMonth: end.month, endDay: end.day },
      instruction: '물음에 답하시오.',
      stem: `${startText}에서 며칠이 지나면 ${endText}이 됩니까?${febNote}`,
      answer: { value: n, display: `${n}일`, accepts: [num(n), `${n}일`] },
      solution,
      dedupeKey: `date-after:between:${month}:${day}:${n}`,
      difficulty,
    };
  },
  verify(params, answer) {
    // 하루씩 날짜를 넘기며 센다.
    const step = (m, d) => (d < MONTH_DAYS[m - 1] ? [m, d + 1] : [m === 12 ? 1 : m + 1, 1]);
    if (params.kind === 'after') {
      const match = /^(\d+)월 (\d+)일$/.exec(String(answer.value));
      if (!match) return false;
      let [m, d] = [params.month, params.day];
      for (let k = 0; k < params.n; k += 1) [m, d] = step(m, d);
      return Number(match[1]) === m && Number(match[2]) === d;
    }
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0 || v > 400) return false;
    let [m, d] = [params.month, params.day];
    for (let k = 0; k < v; k += 1) [m, d] = step(m, d);
    return m === params.endMonth && d === params.endDay;
  },
};

const formatClock = (t) => `${Math.floor(t / 60)}시 ${t % 60}분`;
const formatDuration = (m) => (m < 60 ? `${m}분` : m % 60 === 0 ? `${m / 60}시간` : `${Math.floor(m / 60)}시간 ${m % 60}분`);

const startOrDuration = {
  id: 'math.g12.gm.s09.start-or-duration',
  standardCode: '[2수03-09]',
  skill: '끝난 시각과 걸린 시간으로 시작한 시각, 두 시각으로 걸린 시간 구하기',
  format: 'short-answer',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 10분 단위로 1시간이 안 되는 시간, 2는 5분 단위로 2시간까지, 3은 1분 단위로 4시간까지의 시간을 다룬다.',
  generate(rng, { difficulty }) {
    const unit = difficulty === 1 ? 10 : difficulty === 2 ? 5 : 1;
    const maxDuration = difficulty === 1 ? 50 : difficulty === 2 ? 120 : 240;
    const duration = rng.until(() => rng.int(1, maxDuration / unit) * unit, (d) => d % 60 !== 0);
    // 시각은 1시부터 11시 59분 사이에서 고른다. 오전·오후가 바뀌지 않게 한다.
    const start = rng.until(() => rng.int(60 / unit, (12 * 60 - 1) / unit) * unit, (s) => s + duration < 12 * 60 && s % 60 !== 0 && (s + duration) % 60 !== 0);
    const end = start + duration;
    const kind = rng.pick(['start', 'duration']);
    const name = rng.pick(NAMES);
    const activity = rng.pick(['숙제를', '책 읽기를', '청소를', '줄넘기를', '그림 그리기를', '피아노 연습을']);
    if (kind === 'start') {
      const display = formatClock(start);
      return {
        params: { kind, end, duration },
        instruction: '물음에 답하시오.',
        stem: `${name}${josaEun(name)} ${activity} ${formatDuration(duration)} 동안 하고 ${formatClock(end)}에 마쳤습니다. ${activity} 시작한 시각은 몇 시 몇 분입니까?`,
        answer: { value: display, display, accepts: [display, display.replace(' ', '')] },
        solution: [`끝난 시각 ${formatClock(end)}에서 ${formatDuration(duration)} 전의 시각을 구한다.`, `시작한 시각은 ${display}이다.`],
        dedupeKey: `start-or-duration:start:${end}:${duration}`,
        difficulty,
      };
    }
    const display = formatDuration(duration);
    return {
      params: { kind, start, end },
      instruction: '물음에 답하시오.',
      stem: `${name}${josaEun(name)} ${formatClock(start)}에 ${activity} 시작해서 ${formatClock(end)}에 마쳤습니다. ${activity} 하는 데 걸린 시간은 ${duration < 60 ? '몇 분' : '몇 시간 몇 분'}입니까?`,
      answer: { value: display, display, accepts: [display, display.replace(' ', ''), `${duration}분`] },
      solution: [`${formatClock(start)}부터 ${formatClock(end)}까지 걸린 시간을 구한다.`, `걸린 시간은 ${display}이다.`],
      dedupeKey: `start-or-duration:duration:${start}:${end}`,
      difficulty,
    };
  },
  verify(params, answer) {
    const text = String(answer.value);
    if (params.kind === 'start') {
      const m = /^(\d+)시 (\d+)분$/.exec(text);
      if (!m || Number(m[2]) >= 60) return false;
      // 시작한 시각에 걸린 시간을 더해 끝난 시각이 되는지 본다.
      return Number(m[1]) * 60 + Number(m[2]) + params.duration === params.end;
    }
    const hm = /^(?:(\d+)시간)? ?(?:(\d+)분)?$/.exec(text);
    if (!hm || (hm[1] === undefined && hm[2] === undefined)) return false;
    const minutes = (hm[1] === undefined ? 0 : Number(hm[1]) * 60) + (hm[2] === undefined ? 0 : Number(hm[2]));
    if (hm[1] !== undefined && hm[2] !== undefined && Number(hm[2]) >= 60) return false;
    return params.start + minutes === params.end;
  },
};

// ---------------------------------------------------------------------------
// [2수04-01] 두 기준으로 분류하기 · [2수04-02] 표로 나타내기 · [2수04-03] ○를 이용한 그래프
// ---------------------------------------------------------------------------

const COLORS = ['빨간색', '파란색', '노란색'];
const SHAPES = ['삼각형', '사각형', '원'];

const twoCriteria = {
  id: 'math.g12.pd.s04-01.two-criteria',
  standardCode: '[2수04-01]',
  skill: '색깔과 모양 두 기준으로 분류하여 세기',
  format: 'short-answer',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 조각 8개, 2는 12개, 3은 16개를 두 기준으로 분류한다.',
  generate(rng, { difficulty }) {
    const size = difficulty === 1 ? 8 : difficulty === 2 ? 12 : 16;
    const pieces = Array.from({ length: size }, () => [rng.int(0, 2), rng.int(0, 2)]);
    const kind = rng.pick(['both', 'color-not-shape', 'shape-not-color']);
    const color = rng.int(0, 2);
    const shape = rng.int(0, 2);
    const list = pieces.map(([c, s]) => `${COLORS[c]} ${SHAPES[s]}`);
    const match = (c, s) => (kind === 'both' ? c === color && s === shape
      : kind === 'color-not-shape' ? c === color && s !== shape : s === shape && c !== color);
    const value = pieces.filter(([c, s]) => match(c, s)).length;
    if (value === 0) return this.generate(rng, { difficulty });
    const C = COLORS[color];
    const S = SHAPES[shape];
    const asks = {
      both: `${C} ${S}${josaEun(S)} 모두 몇 개입니까?`,
      'color-not-shape': `${C}이지만 ${S}${josaI(S)} 아닌 조각은 모두 몇 개입니까?`,
      'shape-not-color': `${S}이지만 ${C}이 아닌 조각은 모두 몇 개입니까?`,
    };
    return {
      params: { list, kind, color, shape },
      instruction: '조각을 색깔과 모양에 따라 분류하고 물음에 답하시오.',
      stem: `${list.join(', ')}\n${asks[kind]}`,
      answer: { value, display: `${value}개`, accepts: [num(value), `${value}개`] },
      solution: ['색깔을 먼저 보고, 그중에서 모양을 다시 본다.', `조건에 맞는 조각은 ${value}개이다.`],
      // 조각을 늘어놓은 순서가 아니라 색깔·모양 칸마다의 개수가 문제다.
      dedupeKey: `two-criteria:${COLORS.flatMap((_, c) => SHAPES.map((__, s) => pieces.filter(([pc, ps]) => pc === c && ps === s).length)).join('-')}:${kind}:${color}${shape}`,
      difficulty,
    };
  },
  verify({ list, kind, color, shape }, answer) {
    // 문구를 다시 읽어 색깔 낱말과 모양 낱말을 따로 세어 집합으로 나눈다.
    const withColor = list.filter((t) => t.startsWith(`${COLORS[color]} `));
    const withShape = list.filter((t) => t.endsWith(` ${SHAPES[shape]}`));
    const both = withColor.filter((t) => t.endsWith(` ${SHAPES[shape]}`)).length;
    const expected = kind === 'both' ? both : kind === 'color-not-shape' ? withColor.length - both : withShape.length - both;
    return Number.isInteger(answer.value) && answer.value === expected;
  },
};

const SURVEYS = [
  { topic: '좋아하는 색깔', categories: ['빨강', '노랑', '파랑', '초록', '보라'] },
  { topic: '좋아하는 과일', categories: ['사과', '포도', '딸기', '귤', '배'] },
  { topic: '좋아하는 동물', categories: ['강아지', '고양이', '토끼', '햄스터', '거북'] },
  { topic: '좋아하는 운동', categories: ['축구', '줄넘기', '피구', '달리기', '수영'] },
  { topic: '가고 싶은 곳', categories: ['바다', '산', '놀이공원', '동물원', '박물관'] },
];

const tableMissing = {
  id: 'math.g12.pd.s04-02.table-missing',
  standardCode: '[2수04-02]',
  skill: '합계를 이용하여 표의 빈칸을 채우고 표 해석하기',
  format: 'short-answer',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 세 항목 표의 빈칸, 2는 네 항목 표의 빈칸, 3은 다섯 항목 표의 빈칸을 먼저 구한 뒤 가장 많은 것과 가장 적은 것의 차를 구한다.',
  generate(rng, { difficulty }) {
    const size = difficulty + 2;
    const max = difficulty === 1 ? 9 : difficulty === 2 ? 15 : 20;
    const survey = rng.pick(SURVEYS);
    const categories = survey.categories.slice(0, size);
    const counts = difficulty === 3
      ? rng.until(() => categories.map(() => rng.int(1, max)), (c) => {
        const sorted = [...c].sort((a, b) => a - b);
        return sorted[0] !== sorted[1] && sorted.at(-1) !== sorted.at(-2);
      })
      : categories.map(() => rng.int(1, max));
    const missing = rng.int(0, size - 1);
    const total = counts.reduce((s, v) => s + v, 0);
    const kind = difficulty === 3 ? 'range' : 'missing';
    const value = kind === 'missing' ? counts[missing] : Math.max(...counts) - Math.min(...counts);
    const known = counts.map((c, i) => (i === missing ? null : c));
    const table = `${survey.topic} | ${categories.join(' | ')} | 합계\n학생 수(명) | ${known.map((c) => (c === null ? '□' : String(c))).join(' | ')} | ${total}`;
    const ask = kind === 'missing'
      ? `${categories[missing]}${josaEul(categories[missing])} 고른 학생은 몇 명입니까?`
      : '가장 많은 학생이 고른 것은 가장 적은 학생이 고른 것보다 몇 명 더 많습니까?';
    return {
      params: { known, total, kind },
      instruction: '표를 보고 물음에 답하시오.',
      stem: `${table}\n${ask}`,
      answer: { value, display: `${value}명`, accepts: [num(value), `${value}명`] },
      solution: [
        `□ = ${total} - ${known.filter((c) => c !== null).join(' - ')} = ${counts[missing]}이다.`,
        kind === 'missing'
          ? `${categories[missing]}${josaEul(categories[missing])} 고른 학생은 ${counts[missing]}명이다.`
          : `가장 많은 것은 ${Math.max(...counts)}명, 가장 적은 것은 ${Math.min(...counts)}명이므로 ${value}명 더 많다.`,
      ],
      dedupeKey: `table-missing:${known.map((c) => c ?? '_').join('-')}:${total}:${kind}`,
      difficulty,
    };
  },
  verify({ known, total, kind }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    let rest = total;
    for (const c of known) if (c !== null) rest -= c;
    if (kind === 'missing') return v === rest;
    const all = known.map((c) => (c === null ? rest : c));
    // 모든 값이 (가장 작은 값 + 답) 이하이고, 그 값과 같은 항목이 있어야 한다.
    const low = all.reduce((m, c) => (c < m ? c : m), Infinity);
    return all.every((c) => c <= low + v) && all.some((c) => c === low + v);
  },
};

const circleGraph = {
  id: 'math.g12.pd.s04-03.circle-graph',
  standardCode: '[2수04-03]',
  skill: '○로 나타낸 그래프를 보고 두 항목을 비교하거나 합치기',
  format: 'short-answer',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 세 항목 그래프, 2는 네 항목 그래프, 3은 다섯 항목 그래프에서 세어 비교한다.',
  generate(rng, { difficulty }) {
    const size = difficulty + 2;
    const max = difficulty === 1 ? 6 : difficulty === 2 ? 8 : 10;
    const survey = rng.pick(SURVEYS);
    const categories = survey.categories.slice(0, size);
    const counts = categories.map(() => rng.int(1, max));
    const kind = rng.pick(['sum', 'diff', 'total']);
    let i = rng.int(0, size - 1);
    let j = (i + rng.int(1, size - 1)) % size;
    // 차를 묻는데 두 항목이 같으면 문항이 성립하지 않는다. 한쪽을 하나 줄이거나 늘려 갈라 둔다.
    if (kind === 'diff' && counts[i] === counts[j]) counts[j] = counts[i] === 1 ? 2 : counts[i] - 1;
    if (kind === 'diff' && counts[i] < counts[j]) [i, j] = [j, i];
    const rows = categories.map((c, k) => `${c} | ${'○'.repeat(counts[k])}`);
    const value = kind === 'sum' ? counts[i] + counts[j] : kind === 'diff' ? counts[i] - counts[j] : counts.reduce((s, v) => s + v, 0);
    const A = categories[i];
    const B = categories[j];
    const asks = {
      sum: `${A}${josaGwa(A)} ${B}${josaEul(B)} 고른 학생은 모두 몇 명입니까?`,
      diff: `${A}${josaEul(A)} 고른 학생은 ${B}${josaEul(B)} 고른 학생보다 몇 명 더 많습니까?`,
      total: '조사한 학생은 모두 몇 명입니까?',
    };
    return {
      params: { rows, kind, i: kind === 'total' ? null : i, j: kind === 'total' ? null : j },
      instruction: '그래프를 보고 물음에 답하시오. ○ 하나는 학생 1명을 나타냅니다.',
      stem: `${survey.topic}별 학생 수\n${rows.join('\n')}\n${asks[kind]}`,
      answer: { value, display: `${value}명`, accepts: [num(value), `${value}명`] },
      solution: [
        kind === 'total' ? '○를 하나씩 빠짐없이 센다.' : `${A}${josaEun(A)} ${counts[i]}명, ${B}${josaEun(B)} ${counts[j]}명이다.`,
        kind === 'total' ? `${counts.join(' + ')} = ${value}이므로 모두 ${value}명이다.` : kind === 'sum' ? `두 수를 더하면 ${value}명이다.` : `${counts[i]} - ${counts[j]} = ${value}이므로 ${value}명 더 많다.`,
      ],
      dedupeKey: `circle-graph:${counts.join('-')}:${kind}:${kind === 'total' ? '' : `${i}-${j}`}`,
      difficulty,
    };
  },
  verify({ rows, kind, i, j }, answer) {
    // 그래프 줄의 ○를 다시 센다.
    const counts = rows.map((r) => [...r].filter((ch) => ch === '○').length);
    const v = answer.value;
    if (!Number.isInteger(v)) return false;
    if (kind === 'total') return v === counts.reduce((s, c) => s + c, 0);
    if (kind === 'sum') return v - counts[j] === counts[i];
    return v > 0 && v + counts[j] === counts[i];
  },
};

const josaGwa = (word) => particle(word, '과', '와');

export const generators = [
  blankDigitCompare,
  composeUnits,
  digitCards,
  storyThree,
  boxThree,
  alternatingSteps,
  growingStep,
  ruleFirstOver,
  compareLength,
  lengthStory,
  dateAfter,
  startOrDuration,
  twoCriteria,
  tableMissing,
  circleGraph,
];
