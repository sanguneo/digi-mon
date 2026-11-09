/**
 * 2022 개정 초등 수학 1~2학년군 확장 문항 생성기.
 *
 * 기존 생성기가 다루지 않던 표현 방식을 더한다. 빈칸 위치를 바꾼 역문제, 식끼리의
 * 크기 비교, 문장제의 처음 수·바뀐 수 구하기, 반복 규칙, 수 배열표, 시각과 시간,
 * 길이의 덧셈과 뺄셈, 자료 세기다.
 *
 * 각 생성기는 params 로 문항을 완전히 결정하고, verify 는 generate 와 다른 경로
 * (역연산, 대입, 다시 세기)로 답을 확인한다.
 */
import { NAMES, THINGS } from '../corpus.mjs';
import {
  countIda, josaEul, josaEun, josaI, numEul, numGwa, numI, numRo,
} from '../../engine/korean-number.mjs';

const num = (n) => String(n);
const WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const ORDINALS = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째', '여덟째', '아홉째', '열째'];

// ---------------------------------------------------------------------------
// [2수01-06] 두 자리 수 범위의 덧셈과 뺄셈
// ---------------------------------------------------------------------------

/** 받아올림·받아내림 조건에 맞는 두 자리 수 두 개와 결과를 만든다. */
function twoDigitPair(rng, difficulty) {
  if (difficulty === 1) {
    if (rng.bool()) {
      const aT = rng.int(1, 8);
      const aO = rng.int(0, 8);
      const bT = rng.int(1, 9 - aT);
      const bO = rng.int(0, 9 - aO);
      return { a: aT * 10 + aO, op: '+', b: bT * 10 + bO };
    }
    const aT = rng.int(2, 9);
    const aO = rng.int(1, 9);
    return { a: aT * 10 + aO, op: '-', b: rng.int(1, aT - 1) * 10 + rng.int(0, aO) };
  }
  if (difficulty === 2) {
    const aO = rng.int(1, 9);
    const bO = rng.int(10 - aO, 9);
    const aT = rng.int(1, 7);
    const bT = rng.int(1, 8 - aT);
    return { a: aT * 10 + aO, op: '+', b: bT * 10 + bO };
  }
  const aT = rng.int(2, 9);
  const aO = rng.int(0, 8);
  return { a: aT * 10 + aO, op: '-', b: rng.int(1, aT - 1) * 10 + rng.int(aO + 1, 9) };
}

const evalOp = (a, op, b) => (op === '+' ? a + b : a - b);

const missingDigit = {
  id: 'math.g12.no.s06.missing-digit',
  standardCode: '[2수01-06]',
  skill: '덧셈식·뺄셈식에서 빈 자리 숫자 찾기',
  format: 'fill-blank',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 받아올림·받아내림이 없는 계산, 2는 받아올림이 있는 덧셈, 3은 받아내림이 있는 뺄셈이다.',
  generate(rng, { difficulty }) {
    const { a, op, b } = twoDigitPair(rng, difficulty);
    const r = evalOp(a, op, b);
    const terms = [a, b, r];
    // 결과가 한 자리면 십의 자리가 없으므로 그 항에서는 일의 자리만 가린다.
    const term = rng.int(0, 2);
    const place = terms[term] < 10 ? 0 : rng.int(0, 1);
    const text = terms.map(String);
    const digits = text[term].split('');
    const at = digits.length - 1 - place;
    const hidden = Number(digits[at]);
    digits[at] = '□';
    text[term] = digits.join('');
    const whole = terms[term];
    const how = term === 2
      ? `${a} ${op} ${b} = ${r}`
      : term === 0
        ? (op === '+' ? `${r} - ${b} = ${a}` : `${r} + ${b} = ${a}`)
        : (op === '+' ? `${r} - ${a} = ${b}` : `${a} - ${r} = ${b}`);
    return {
      params: { shown: text, op, term, place },
      instruction: '□ 안에 알맞은 숫자를 써넣으시오.',
      stem: `${text[0]} ${op} ${text[1]} = ${text[2]}`,
      answer: { value: hidden, display: num(hidden), accepts: [num(hidden)] },
      solution: [
        `□가 있는 수는 나머지 두 수로 구할 수 있다: ${how}`,
        `따라서 □가 있는 수는 ${whole}이고, □에 알맞은 숫자는 ${hidden}이다.`,
      ],
      dedupeKey: `missing-digit:${a}${op}${b}:${term}:${place}`,
      difficulty,
    };
  },
  verify({ shown, op }, answer) {
    if (!Number.isInteger(answer.value) || answer.value < 0 || answer.value > 9) return false;
    const filled = shown.map((t) => Number(t.replace('□', String(answer.value))));
    return evalOp(filled[0], op, filled[1]) === filled[2];
  },
};

function twoDigitExpression(rng, difficulty) {
  if (difficulty === 1) {
    return rng.bool()
      ? { a: rng.int(1, 9), op: '+', b: rng.int(1, 9) }
      : (() => { const a = rng.int(10, 18); return { a, op: '-', b: rng.int(a - 9, 9) }; })();
  }
  return twoDigitPair(rng, difficulty === 2 ? 1 : rng.pick([2, 3]));
}

/** 값이 lv 인 다른 식을 만든다. 같은 식을 양쪽에 두지 않는다. */
function sameValueExpression(rng, lv, left) {
  const options = [];
  for (let k = 1; k <= Math.min(lv - 1, 30); k += 1) options.push({ a: lv - k, op: '+', b: k });
  for (let k = 1; k <= Math.min(99 - lv, 30); k += 1) options.push({ a: lv + k, op: '-', b: k });
  return rng.pick(options.filter((e) => !(e.a === left.a && e.b === left.b && e.op === left.op)));
}

const compareExpressions = {
  id: 'math.g12.no.s06.compare-expressions',
  standardCode: '[2수01-06]',
  skill: '두 식의 계산 결과 크기 비교하기',
  format: 'compare',
  generate(rng, { difficulty }) {
    const left = twoDigitExpression(rng, difficulty);
    const lv = evalOp(left.a, left.op, left.b);
    // 세 번에 한 번은 결과가 같은 식을 만들어 = 도 답이 되게 한다.
    const right = rng.int(0, 2) === 0
      ? sameValueExpression(rng, lv, left)
      : rng.until(() => twoDigitExpression(rng, difficulty), (e) => evalOp(e.a, e.op, e.b) !== lv);
    const rv = evalOp(right.a, right.op, right.b);
    const sign = lv > rv ? '>' : lv < rv ? '<' : '=';
    const L = `${left.a} ${left.op} ${left.b}`;
    const R = `${right.a} ${right.op} ${right.b}`;
    return {
      params: { left, right },
      instruction: '□ 안에 >, =, < 중 알맞은 것을 써넣으시오.',
      stem: `${L} □ ${R}`,
      answer: { value: sign, display: sign, accepts: [sign] },
      solution: [
        `왼쪽 식을 계산하면 ${L} = ${lv}이다.`,
        `오른쪽 식을 계산하면 ${R} = ${rv}이다.`,
        `${numGwa(lv)} ${numEul(rv)} 비교하면 ${L} ${sign} ${R}이다.`,
      ],
      dedupeKey: `compare-expr:${left.a}${left.op}${left.b}:${right.a}${right.op}${right.b}`,
      difficulty,
    };
  },
  verify({ left, right }, answer) {
    // 두 식의 차가 0보다 큰지 작은지로 판정한다.
    const diff = (left.op === '+' ? left.a + left.b : left.a - left.b)
      - (right.op === '+' ? right.a + right.b : right.a - right.b);
    return (diff > 0 && answer.value === '>') || (diff < 0 && answer.value === '<')
      || (diff === 0 && answer.value === '=');
  },
};

// ---------------------------------------------------------------------------
// [2수01-09] □가 사용된 덧셈식과 뺄셈식
// ---------------------------------------------------------------------------

const storyBox = {
  id: 'math.g12.no.s09.story-box',
  standardCode: '[2수01-09]',
  skill: '문장제에서 처음 수나 바뀐 수를 □로 놓고 구하기',
  format: 'write-expression',
  generate(rng, { difficulty }) {
    const cap = difficulty === 1 ? 20 : difficulty === 2 ? 60 : 99;
    const kind = rng.pick(['start-add', 'change-add', 'start-sub', 'change-sub']);
    const thing = rng.pick(THINGS);
    const name = rng.pick(NAMES);
    const N = thing.noun;
    const { counter: C, place } = thing;
    let a;
    let b;
    let c;
    if (kind.endsWith('add')) {
      c = rng.int(Math.max(5, Math.floor(cap / 2)), cap);
      // 두 부분이 같으면 답이 문제에 그대로 보인다.
      a = rng.until(() => rng.int(1, c - 1), (v) => v * 2 !== c);
      b = c - a;
    } else {
      a = rng.int(Math.max(5, Math.floor(cap / 2)), cap);
      b = rng.until(() => rng.int(1, a - 1), (v) => v * 2 !== a);
      c = a - b;
    }
    const stories = {
      'start-add': {
        stem: `${name}${josaEun(name)} ${N}${josaEul(N)} 몇 ${C} 가지고 있었습니다.`
          + ` 친구에게 ${b}${C}${josaEul(C)} 더 받았더니 모두 ${c}${C}${josaI(C)} 되었습니다.`
          + ` 처음에 가지고 있던 ${N}${josaEun(N)} 몇 ${C}입니까?`,
        expr: `□ + ${b} = ${c}`,
        undo: `${c} - ${b} = ${numRo(a)}`,
        answer: a,
      },
      'change-add': {
        stem: `${name}${josaEun(name)} ${N}${josaEul(N)} ${a}${C} 가지고 있었습니다.`
          + ` 친구에게 몇 ${C}${josaEul(C)} 더 받았더니 모두 ${c}${C}${josaI(C)} 되었습니다.`
          + ` 친구에게 받은 ${N}${josaEun(N)} 몇 ${C}입니까?`,
        expr: `${a} + □ = ${c}`,
        undo: `${c} - ${a} = ${numRo(b)}`,
        answer: b,
      },
      'start-sub': {
        stem: `${place}에 ${N}${josaI(N)} 몇 ${C} 있었습니다.`
          + ` 그중 ${b}${C}${josaEul(C)} 다른 곳으로 옮겼더니 ${c}${C}${josaI(C)} 남았습니다.`
          + ` 처음 ${place}에 있던 ${N}${josaEun(N)} 몇 ${C}입니까?`,
        expr: `□ - ${b} = ${c}`,
        undo: `${c} + ${b} = ${numRo(a)}`,
        answer: a,
      },
      'change-sub': {
        stem: `${place}에 ${N}${josaI(N)} ${a}${C} 있었습니다.`
          + ` 그중 몇 ${C}${josaEul(C)} 다른 곳으로 옮겼더니 ${c}${C}${josaI(C)} 남았습니다.`
          + ` 다른 곳으로 옮긴 ${N}${josaEun(N)} 몇 ${C}입니까?`,
        expr: `${a} - □ = ${c}`,
        undo: `${a} - ${c} = ${numRo(b)}`,
        answer: b,
      },
    };
    const story = stories[kind];
    const ans = story.answer;
    return {
      params: { kind, a: kind.startsWith('change') ? a : null, b: kind.startsWith('start') ? b : null, c },
      instruction: '모르는 수를 □로 하여 식을 쓰고 답을 구하시오.',
      stem: story.stem,
      answer: { value: ans, display: `${ans}${C}`, accepts: [num(ans), `${ans}${C}`] },
      solution: [`모르는 수를 □로 놓으면 ${story.expr}이다.`, `□는 ${story.undo} 구한다.`, `답은 ${countIda(ans, C)}.`],
      dedupeKey: `story-box:${kind}:${a}:${b}:${N}`,
      difficulty,
    };
  },
  verify({ kind, a, b, c }, answer) {
    const x = answer.value;
    if (!Number.isInteger(x) || x <= 0) return false;
    // □ 자리에 답을 넣어 식이 성립하는지 본다.
    if (kind === 'start-add') return x + b === c;
    if (kind === 'change-add') return a + x === c;
    if (kind === 'start-sub') return x - b === c;
    return a - x === c;
  },
};

// ---------------------------------------------------------------------------
// [2수01-11] 곱셈구구
// ---------------------------------------------------------------------------

const timesCompare = {
  id: 'math.g12.no.s11.times-compare',
  standardCode: '[2수01-11]',
  skill: '두 곱셈식의 곱 크기 비교하기',
  format: 'compare',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 2단과 5단, 2는 2단부터 5단까지, 3은 2단부터 9단까지의 곱을 비교한다.',
  generate(rng, { difficulty }) {
    const tables = difficulty === 1 ? [2, 5] : difficulty === 2 ? [2, 3, 4, 5] : [2, 3, 4, 5, 6, 7, 8, 9];
    const make = () => ({ a: rng.pick(tables), b: rng.int(difficulty === 3 ? 2 : 1, 9) });
    const left = make();
    const right = rng.int(0, 3) === 0
      ? (() => {
        const same = [];
        for (const a of tables) for (let b = 1; b <= 9; b += 1) {
          if (a * b === left.a * left.b && !(a === left.a && b === left.b)) same.push({ a, b });
        }
        return same.length > 0 ? rng.pick(same) : rng.until(make, (e) => e.a * e.b !== left.a * left.b);
      })()
      : rng.until(make, (e) => e.a * e.b !== left.a * left.b);
    const lv = left.a * left.b;
    const rv = right.a * right.b;
    const sign = lv > rv ? '>' : lv < rv ? '<' : '=';
    return {
      params: { left, right },
      instruction: '□ 안에 >, =, < 중 알맞은 것을 써넣으시오.',
      stem: `${left.a} × ${left.b} □ ${right.a} × ${right.b}`,
      answer: { value: sign, display: sign, accepts: [sign] },
      solution: [
        `${left.a} × ${left.b} = ${lv}, ${right.a} × ${right.b} = ${rv}이다.`,
        `그러므로 ${left.a} × ${left.b} ${sign} ${right.a} × ${right.b}이다.`,
      ],
      dedupeKey: `times-compare:${left.a}x${left.b}:${right.a}x${right.b}`,
      difficulty,
    };
  },
  verify({ left, right }, answer) {
    // 곱셈 연산자 없이 같은 수 거듭 더하기로 곱을 구해 비교한다.
    const rep = ({ a, b }) => { let s = 0; for (let k = 0; k < b; k += 1) s += a; return s; };
    const diff = rep(left) - rep(right);
    return (diff > 0 && answer.value === '>') || (diff < 0 && answer.value === '<')
      || (diff === 0 && answer.value === '=');
  },
};

// ---------------------------------------------------------------------------
// [2수02-01] 규칙 찾기 · [2수02-02] 규칙에 따라 배열하기
// ---------------------------------------------------------------------------

const repeatPattern = {
  id: 'math.g12.pd.s01.repeat-pattern',
  standardCode: '[2수02-01]',
  skill: '되풀이되는 수의 배열에서 빈칸 채우기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    const length = difficulty === 1 ? 2 : difficulty === 2 ? 3 : 4;
    const top = difficulty === 1 ? 9 : difficulty === 2 ? 20 : 50;
    const unit = rng.until(
      () => Array.from({ length }, () => rng.int(1, top)),
      // 한 마디 안에서 더 짧게 되풀이되면 규칙의 길이가 달라진다.
      (u) => new Set(u).size > 1 && !(length === 4 && u[0] === u[2] && u[1] === u[3]),
    );
    const terms = Array.from({ length: length * 3 }, (_, k) => unit[k % length]);
    const hide = rng.int(length, terms.length - 1);
    const shown = terms.map((t, k) => (k === hide ? '□' : String(t)));
    return {
      params: { shown, period: length },
      instruction: '규칙을 찾아 □에 알맞은 수를 써넣으시오.',
      stem: shown.join(', '),
      answer: { value: terms[hide], display: num(terms[hide]), accepts: [num(terms[hide])] },
      solution: [
        `${[...unit.slice(0, -1), numI(unit.at(-1))].join(', ')} 되풀이되는 규칙이다.`,
        `□는 ${length}칸 앞의 수와 같으므로 ${terms[hide]}이다.`,
      ],
      dedupeKey: `repeat-pattern:${unit.join('-')}:${hide}`,
      difficulty,
    };
  },
  verify({ shown, period }, answer) {
    const at = shown.indexOf('□');
    const before = shown[at - period];
    const after = shown[at + period];
    return Number(before) === answer.value && (after === undefined || Number(after) === answer.value);
  },
};

const DIRECTIONS = {
  right: { label: '오른쪽', dr: 0, dc: 1 },
  left: { label: '왼쪽', dr: 0, dc: -1 },
  down: { label: '아래쪽', dr: 1, dc: 0 },
  up: { label: '위쪽', dr: -1, dc: 0 },
};

const hundredChart = {
  id: 'math.g12.pd.s01.hundred-chart',
  standardCode: '[2수02-01]',
  skill: '수 배열표의 규칙으로 수 찾기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const moves = difficulty === 1
      ? [{ dir: rng.pick(Object.keys(DIRECTIONS)), steps: 1 }]
      : difficulty === 2
        ? [{ dir: rng.pick(Object.keys(DIRECTIONS)), steps: rng.int(2, 4) }]
        : [
          { dir: rng.pick(['up', 'down']), steps: rng.int(1, 4) },
          { dir: rng.pick(['left', 'right']), steps: rng.int(1, 4) },
        ];
    const dr = moves.reduce((s, m) => s + DIRECTIONS[m.dir].dr * m.steps, 0);
    const dc = moves.reduce((s, m) => s + DIRECTIONS[m.dir].dc * m.steps, 0);
    const start = rng.until(() => rng.int(1, 100), (n) => {
      const row = Math.floor((n - 1) / 10) + dr;
      const col = ((n - 1) % 10) + dc;
      return row >= 0 && row <= 9 && col >= 0 && col <= 9;
    });
    const target = start + dr * 10 + dc;
    const path = moves.map((m) => `${DIRECTIONS[m.dir].label}으로 ${m.steps}칸`).join(', ');
    return {
      params: { start, moves },
      instruction: '물음에 답하시오.',
      stem: '1부터 100까지의 수 배열표에서 오른쪽으로 한 칸 가면 1씩 커지고, 아래쪽으로 한 칸 가면 10씩 커집니다.'
        + ` ${numI(start)} 있는 칸에서 ${path} 간 곳에 있는 수는 무엇입니까?`,
      answer: { value: target, display: num(target), accepts: [num(target)] },
      solution: [
        '오른쪽은 1씩 커지고 왼쪽은 1씩 작아진다. 아래쪽은 10씩 커지고 위쪽은 10씩 작아진다.',
        `${start}에서 ${path} 가면 ${target}이다.`,
      ],
      dedupeKey: `hundred-chart:${start}:${moves.map((m) => `${m.dir}${m.steps}`).join('-')}`,
      difficulty,
    };
  },
  verify({ start, moves }, answer) {
    const n = answer.value;
    if (!Number.isInteger(n) || n < 1 || n > 100) return false;
    // 줄과 칸 번호로 바꾸어 움직인 만큼 차이가 나는지 본다.
    const pos = (v) => [Math.floor((v - 1) / 10), (v - 1) % 10];
    const [r0, c0] = pos(start);
    const [r1, c1] = pos(n);
    let dr = 0;
    let dc = 0;
    for (const m of moves) {
      dr += DIRECTIONS[m.dir].dr * m.steps;
      dc += DIRECTIONS[m.dir].dc * m.steps;
    }
    return r1 - r0 === dr && c1 - c0 === dc;
  },
};

const ownRule = {
  id: 'math.g12.pd.s02.own-rule',
  standardCode: '[2수02-02]',
  skill: '정한 규칙에 따라 수를 늘어놓고 몇째 수 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const step = difficulty === 1 ? rng.pick([1, 2, 5, 10]) : rng.int(2, 9);
    const position = difficulty === 1 ? rng.int(3, 5) : difficulty === 2 ? rng.int(4, 7) : rng.int(6, 10);
    const growing = difficulty === 3 ? rng.bool() : true;
    const span = step * (position - 1);
    const start = growing ? rng.int(1, 100 - span) : rng.int(span + 1, 100);
    const value = growing ? start + span : start - span;
    const name = rng.pick(NAMES);
    return {
      params: { start, step, position, growing },
      instruction: '물음에 답하시오.',
      stem: `${name}${josaEun(name)} ${start}부터 시작하여 ${step}씩 ${growing ? '커지게' : '작아지게'} 수를 늘어놓기로 했습니다.`
        + ` ${ORDINALS[position - 1]}에 놓을 수는 무엇입니까?`,
      answer: { value, display: num(value), accepts: [num(value)] },
      solution: [
        `첫째 수는 ${start}이고, 한 번 놓을 때마다 ${step}씩 ${growing ? '커진다' : '작아진다'}.`,
        `${ORDINALS[position - 1]} 수는 ${start}에서 ${step}씩 ${position - 1}번 ${growing ? '커진' : '작아진'} ${value}이다.`,
      ],
      dedupeKey: `own-rule:${start}:${step}:${position}:${growing ? 'up' : 'down'}`,
      difficulty,
    };
  },
  verify({ start, step, position, growing }, answer) {
    // 답에서 첫째 수까지 거꾸로 한 번씩 되돌아가 본다.
    let v = answer.value;
    for (let k = 1; k < position; k += 1) v = growing ? v - step : v + step;
    return v === start;
  },
};

// ---------------------------------------------------------------------------
// [2수03-08] 1시간과 1분 · [2수03-09] 시간 사이의 관계
// ---------------------------------------------------------------------------

const hoursMinutes = {
  id: 'math.g12.gm.s08.hours-minutes',
  standardCode: '[2수03-08]',
  skill: '시간을 몇 분 또는 몇 시간 몇 분으로 나타내기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const hours = difficulty === 1 ? 1 : difficulty === 2 ? rng.int(1, 2) : rng.int(2, 4);
    const minutes = difficulty === 1 ? rng.int(1, 11) * 5 : rng.int(1, 59);
    const total = hours * 60 + minutes;
    const toMinutes = rng.bool();
    if (toMinutes) {
      return {
        params: { kind: 'to-minutes', hours, minutes },
        instruction: '물음에 답하시오.',
        stem: `${hours}시간 ${minutes}분은 몇 분입니까?`,
        answer: { value: total, display: `${total}분`, accepts: [num(total), `${total}분`] },
        solution: [
          hours === 1 ? '1시간은 60분이다.' : `1시간은 60분이므로 ${hours}시간은 ${hours * 60}분이다.`,
          `${hours * 60}분 + ${minutes}분 = ${total}분이다.`,
        ],
        dedupeKey: `hours-minutes:to-min:${total}`,
        difficulty,
      };
    }
    const display = `${hours}시간 ${minutes}분`;
    return {
      params: { kind: 'to-hours', total },
      instruction: '물음에 답하시오.',
      stem: `${total}분은 몇 시간 몇 분입니까?`,
      answer: { value: display, display, accepts: [display, `${hours}시간${minutes}분`] },
      solution: [`60분이 1시간이므로 ${total}분에서 60분씩 묶는다.`, `60분 묶음이 ${hours}개, 남는 분이 ${minutes}분이므로 ${display}이다.`],
      dedupeKey: `hours-minutes:to-hours:${total}`,
      difficulty,
    };
  },
  verify(params, answer) {
    if (params.kind === 'to-minutes') {
      return Number.isInteger(answer.value) && answer.value - params.minutes === params.hours * 60;
    }
    const m = /^(\d+)시간 (\d+)분$/.exec(String(answer.value));
    if (!m) return false;
    const h = Number(m[1]);
    const min = Number(m[2]);
    return min < 60 && h * 60 + min === params.total;
  },
};

const ACTIVITIES = ['숙제를', '책 읽기를', '청소를', '줄넘기를', '그림 그리기를', '피아노 연습을'];

const formatClock = (t) => `${Math.floor(t / 60)}시 ${t % 60}분`;

const elapsedTime = {
  id: 'math.g12.gm.s09.elapsed-time',
  standardCode: '[2수03-09]',
  skill: '시작한 시각과 걸린 시간으로 끝난 시각 구하기',
  format: 'short-answer',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 10분 단위로 시가 바뀌지 않는 계산, 2는 5분 단위로 시가 바뀔 수 있는 계산, 3은 1분 단위로 시가 바뀌는 계산이다.',
  generate(rng, { difficulty }) {
    const unit = difficulty === 1 ? 10 : difficulty === 2 ? 5 : 1;
    const startHour = rng.int(1, 10);
    const { startMinute, duration } = rng.until(() => ({
      startMinute: rng.int(1, Math.floor(55 / unit)) * unit,
      duration: rng.int(1, Math.floor((difficulty === 3 ? 100 : 55) / unit)) * unit,
    }), ({ startMinute: s, duration: d }) => {
      const end = s + d;
      if (end % 60 === 0) return false;
      if (difficulty === 1) return end < 60;
      if (difficulty === 3) return end > 60;
      return true;
    });
    const start = startHour * 60 + startMinute;
    const end = start + duration;
    const name = rng.pick(NAMES);
    const activity = rng.pick(ACTIVITIES);
    const display = formatClock(end);
    return {
      params: { start, duration },
      instruction: '물음에 답하시오.',
      stem: `${name}${josaEun(name)} ${formatClock(start)}에 ${activity} 시작해서 ${duration}분 동안 했습니다.`
        + ' 끝난 시각은 몇 시 몇 분입니까?',
      answer: { value: display, display, accepts: [display, display.replace(' ', '')] },
      solution: [
        `${formatClock(start)}에서 ${duration}분이 지난 시각을 구한다.`,
        startMinute + duration >= 60
          ? `${startMinute}분 + ${duration}분 = ${startMinute + duration}분이고, ${Math.floor((startMinute + duration) / 60) * 60}분은 ${Math.floor((startMinute + duration) / 60)}시간이므로 ${display}이다.`
          : `${startMinute}분 + ${duration}분 = ${startMinute + duration}분이므로 ${display}이다.`,
      ],
      dedupeKey: `elapsed:${start}:${duration}`,
      difficulty,
    };
  },
  verify({ start, duration }, answer) {
    const m = /^(\d+)시 (\d+)분$/.exec(String(answer.value));
    if (!m) return false;
    const minute = Number(m[2]);
    // 끝난 시각에서 걸린 시간을 거꾸로 빼면 시작 시각이 나와야 한다.
    return minute < 60 && Number(m[1]) * 60 + minute - duration === start;
  },
};

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const weekdayOfDate = {
  id: 'math.g12.gm.s09.weekday',
  standardCode: '[2수03-09]',
  skill: '1주일이 7일임을 이용하여 같은 달 날짜의 요일 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const month = rng.int(1, 12);
    const last = MONTH_DAYS[month - 1];
    const weekday = rng.int(0, 6);
    const { from, to } = rng.until(() => ({ from: rng.int(1, last), to: rng.int(1, last) }), ({ from: f, to: t }) => {
      if (f === t) return false;
      if (difficulty === 1) return t > f && t - f <= 6;
      if (difficulty === 2) return t > f && t - f >= 7 && t - f <= 21;
      return Math.abs(t - f) >= 7 && (t < f || t - f > 21);
    });
    const target = WEEKDAYS[(((weekday + to - from) % 7) + 7) % 7];
    return {
      params: { from, weekday, to },
      instruction: '물음에 답하시오.',
      stem: `${month}월 ${from}일은 ${WEEKDAYS[weekday]}입니다. 같은 달 ${to}일은 무슨 요일입니까?`,
      answer: { value: target, display: target, accepts: [target] },
      solution: [
        '1주일은 7일이므로 7일마다 같은 요일이 돌아온다.',
        `${from}일과 ${to}일은 ${Math.abs(to - from)}일 차이가 나므로 ${to}일은 ${target}이다.`,
      ],
      dedupeKey: `weekday:${month}:${from}:${weekday}:${to}`,
      difficulty,
    };
  },
  verify({ from, weekday, to }, answer) {
    // 하루씩 요일을 넘기며 세어 본다.
    let w = weekday;
    const stepDir = to > from ? 1 : -1;
    for (let d = from; d !== to; d += stepDir) w = (w + stepDir + 7) % 7;
    return answer.value === WEEKDAYS[w];
  },
};

const PERIODS = [
  { big: '주일', small: '일', rate: 7, bigMax: 5 },
  { big: '년', small: '개월', rate: 12, bigMax: 4 },
  { big: '일', small: '시간', rate: 24, bigMax: 3 },
  { big: '시간', small: '분', rate: 60, bigMax: 3 },
];

const weeksDays = {
  id: 'math.g12.gm.s09.period-convert',
  standardCode: '[2수03-09]',
  skill: '1주일·1년·1일·1시간의 관계로 기간 바꾸어 나타내기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const period = difficulty === 1 ? PERIODS[0] : difficulty === 2 ? rng.pick(PERIODS.slice(0, 2)) : rng.pick(PERIODS);
    const big = rng.int(1, period.bigMax);
    const small = rng.int(1, period.rate - 1);
    const total = big * period.rate + small;
    const pair = `${big}${period.big} ${small}${period.small}`;
    // '일'을 물을 때는 '몇 일'이 아니라 '며칠'이 표준어다.
    const smallWord = period.small === '일' ? '며칠' : `몇 ${period.small}`;
    const bigWord = period.big === '일' ? '며칠' : `몇 ${period.big}`;
    if (rng.bool()) {
      return {
        params: { kind: 'to-small', rate: period.rate, big, small },
        instruction: '물음에 답하시오.',
        stem: `${pair}은 ${smallWord}입니까?`,
        answer: { value: total, display: `${total}${period.small}`, accepts: [num(total), `${total}${period.small}`] },
        solution: [`1${period.big}은 ${period.rate}${period.small}이다.`, `${big} × ${period.rate} + ${small} = ${total}이므로 ${total}${period.small}이다.`],
        dedupeKey: `period:${period.big}:to-small:${total}`,
        difficulty,
      };
    }
    return {
      params: { kind: 'to-pair', rate: period.rate, total, bigUnit: period.big, smallUnit: period.small },
      instruction: '물음에 답하시오.',
      stem: `${total}${period.small}은 ${bigWord} ${smallWord}입니까?`,
      answer: { value: pair, display: pair, accepts: [pair, pair.replace(' ', '')] },
      solution: [`${period.rate}${period.small}이 1${period.big}이다.`, `${total}${period.small}에서 ${period.rate}${period.small}씩 ${big}번 묶으면 ${small}${period.small}이 남으므로 ${pair}이다.`],
      dedupeKey: `period:${period.big}:to-pair:${total}`,
      difficulty,
    };
  },
  verify(params, answer) {
    if (params.kind === 'to-small') {
      return Number.isInteger(answer.value) && answer.value - params.small === params.big * params.rate;
    }
    const m = new RegExp(`^(\\d+)${params.bigUnit} (\\d+)${params.smallUnit}$`).exec(String(answer.value));
    if (!m) return false;
    const small = Number(m[2]);
    return small < params.rate && Number(m[1]) * params.rate + small === params.total;
  },
};

// ---------------------------------------------------------------------------
// [2수03-13] 길이의 덧셈과 뺄셈
// ---------------------------------------------------------------------------

const formatMcm = (cm) => `${Math.floor(cm / 100)}m ${cm % 100}cm`;

function parseMcm(text) {
  const pair = /^(\d+)m ?(\d+)cm$/.exec(text);
  if (pair) return Number(pair[2]) < 100 ? Number(pair[1]) * 100 + Number(pair[2]) : null;
  const only = /^(\d+)cm$/.exec(text);
  return only ? Number(only[1]) : null;
}

const lengthAddSub = {
  id: 'math.g12.gm.s13.length-add-sub',
  standardCode: '[2수03-13]',
  skill: '몇 m 몇 cm의 덧셈과 뺄셈',
  format: 'short-answer',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 cm끼리 받아올림·받아내림이 없고, 2는 cm끼리 더해 100cm를 넘는 덧셈, 3은 cm에서 받아내림이 있는 뺄셈이다.',
  generate(rng, { difficulty }) {
    const isAdd = difficulty === 2 || (difficulty === 1 && rng.bool());
    const pick = () => {
      const am = rng.int(1, 8);
      const bm = rng.int(1, 8);
      const ac = rng.int(1, 99);
      const bc = rng.int(1, 99);
      return { a: am * 100 + ac, b: bm * 100 + bc };
    };
    const { a, b } = rng.until(pick, ({ a: x, b: y }) => {
      const xc = x % 100;
      const yc = y % 100;
      if (isAdd) {
        const r = x + y;
        if (r % 100 === 0 || r >= 1000) return false;
        return difficulty === 1 ? xc + yc < 100 : xc + yc > 100;
      }
      if (x - y < 100 || (x - y) % 100 === 0 || x === 2 * y) return false;
      return difficulty === 1 ? xc > yc : xc < yc;
    }, 400);
    const result = isAdd ? a + b : a - b;
    const story = rng.bool();
    const name = rng.pick(NAMES);
    const op = isAdd ? '+' : '-';
    const stem = story
      ? (isAdd
        ? `${name}${josaEun(name)} 길이가 ${formatMcm(a)}인 끈과 ${formatMcm(b)}인 끈을 겹치지 않게 이었습니다. 이은 끈의 길이는 몇 m 몇 cm입니까?`
        : `길이가 ${formatMcm(a)}인 리본에서 ${formatMcm(b)}를 잘라 썼습니다. 남은 리본의 길이는 몇 m 몇 cm입니까?`)
      : `${formatMcm(a)} ${op} ${formatMcm(b)} = □m □cm`;
    const display = formatMcm(result);
    const ac = a % 100;
    const bc = b % 100;
    return {
      params: { a, b, isAdd },
      instruction: story ? '물음에 답하시오.' : '□ 안에 알맞은 수를 써넣으시오.',
      stem,
      answer: { value: display, display, accepts: [display, display.replace(' ', ''), `${result}cm`] },
      solution: isAdd
        ? [
          `cm끼리 더하면 ${ac} + ${bc} = ${ac + bc}(cm)이다.`,
          ac + bc >= 100 ? `100cm는 1m이므로 m 자리로 1을 받아올린다.` : 'm끼리 더한다.',
          `${formatMcm(a)} + ${formatMcm(b)} = ${display}이다.`,
        ]
        : [
          ac < bc ? `cm끼리 뺄 수 없으므로 1m를 100cm로 바꾸어 ${ac + 100} - ${bc} = ${ac + 100 - bc}(cm)를 구한다.` : `cm끼리 빼면 ${ac} - ${bc} = ${ac - bc}(cm)이다.`,
          `${formatMcm(a)} - ${formatMcm(b)} = ${display}이다.`,
        ],
      dedupeKey: `length-m-cm:${a}${op}${b}:${story ? 'story' : 'expr'}`,
      difficulty,
    };
  },
  verify({ a, b, isAdd }, answer) {
    const cm = parseMcm(String(answer.value));
    if (cm === null) return false;
    // 역연산으로 처음 길이가 되돌아오는지 본다.
    return isAdd ? cm - b === a : cm + b === a;
  },
};

// ---------------------------------------------------------------------------
// [2수04-02] 자료를 분류하여 표로 나타내기
// ---------------------------------------------------------------------------

const SURVEYS = [
  { topic: '좋아하는 과일', unit: '명', options: ['사과', '배', '귤', '포도', '딸기'] },
  { topic: '좋아하는 계절', unit: '명', options: ['봄', '여름', '가을', '겨울'] },
  { topic: '좋아하는 동물', unit: '명', options: ['강아지', '고양이', '토끼', '햄스터', '거북'] },
  { topic: '좋아하는 색깔', unit: '명', options: ['빨강', '노랑', '파랑', '초록', '보라'] },
];

const tallySurvey = {
  id: 'math.g12.pd.s04-02.tally',
  standardCode: '[2수04-02]',
  skill: '조사한 자료를 분류하여 세고 비교하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const survey = rng.pick(SURVEYS);
    const kinds = rng.shuffle(survey.options).slice(0, difficulty === 1 ? 3 : 4);
    const counts = kinds.map(() => rng.int(1, difficulty === 1 ? 4 : difficulty === 2 ? 6 : 8));
    const list = rng.shuffle(kinds.flatMap((k, idx) => Array(counts[idx]).fill(k)));
    const ask = rng.pick(difficulty === 1 ? ['count'] : difficulty === 2 ? ['count', 'total'] : ['difference', 'total']);
    const [p, q] = rng.shuffle(kinds.map((_, idx) => idx)).slice(0, 2);
    let stemTail;
    let value;
    if (ask === 'count') {
      stemTail = `${survey.topic}${josaI(survey.topic)} ${kinds[p]}인 학생은 몇 명입니까?`;
      value = counts[p];
    } else if (ask === 'total') {
      stemTail = '조사한 학생은 모두 몇 명입니까?';
      value = list.length;
    } else {
      const [hi, lo] = counts[p] >= counts[q] ? [p, q] : [q, p];
      stemTail = `${survey.topic}${josaI(survey.topic)} ${kinds[hi]}인 학생은 ${kinds[lo]}인 학생보다 몇 명 더 많습니까?`;
      value = counts[hi] - counts[lo];
    }
    if (ask === 'difference' && value === 0) return this.generate(rng, { difficulty });
    return {
      params: { list, ask, p: kinds[p], q: kinds[q] },
      instruction: '조사한 자료를 보고 물음에 답하시오.',
      stem: `우리 반 학생들이 ${survey.topic}${josaEul(survey.topic)} 조사했습니다.\n${list.join(', ')}\n${stemTail}`,
      answer: { value, display: `${value}명`, accepts: [num(value), `${value}명`] },
      solution: [
        `종류별로 세면 ${kinds.map((k, idx) => `${k} ${counts[idx]}명`).join(', ')}이다.`,
        ask === 'total' ? `모두 더하면 ${list.length}명이다.` : `답은 ${value}명이다.`,
      ],
      dedupeKey: `tally:${survey.topic}:${list.join('-')}:${ask}:${kinds[p]}:${ask === 'difference' ? kinds[q] : ''}`,
      difficulty,
    };
  },
  verify({ list, ask, p, q }, answer) {
    // 자료를 처음부터 다시 센다.
    const count = (k) => list.filter((x) => x === k).length;
    if (ask === 'count') return answer.value === count(p);
    if (ask === 'total') return answer.value === list.length;
    return answer.value === Math.abs(count(p) - count(q)) && answer.value > 0;
  },
};

export const generators = [
  missingDigit,
  compareExpressions,
  storyBox,
  timesCompare,
  repeatPattern,
  hundredChart,
  ownRule,
  hoursMinutes,
  elapsedTime,
  weekdayOfDate,
  weeksDays,
  lengthAddSub,
  tallySurvey,
];
