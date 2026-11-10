/**
 * 2022 개정 초등 수학 5~6학년군 확장 문항 생성기.
 *
 * 기존 생성기가 다루지 않던 표현 방식을 더한다. 최대공약수·최소공배수 문장제,
 * 범위 안의 배수 세기, 크기가 같은 분수의 빈칸, 대분수의 계산, 몫을 분수로 나타내는
 * 문장제, 분수와 소수의 비교와 바꾸기, 대응표, 백분율, 비례배분 문장제, 둘레·넓이·부피의
 * 역문제, 원주와 원의 넓이다.
 *
 * verify 는 generate 와 다른 경로(곱해서 되돌리기, 교차 곱, 다시 세기)로 답을 확인한다.
 */
import {
  fractionParticle, josaEul, josaEun, josaI, numberParticle, numEul, numGwa, numRo, particle, unitParticle,
} from '../../engine/korean-number.mjs';

const josaGwa = (w) => particle(w, '과', '와');

const num = (n) => String(n);

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x;
}
const lcm = (a, b) => (a / gcd(a, b)) * b;

/** 기약분수·대분수·자연수 중 알맞은 꼴의 문자열. */
function fmtRational(n, d) {
  const g = gcd(n, d);
  const rn = n / g;
  const rd = d / g;
  if (rd === 1) return `${rn}`;
  if (rn < rd) return `${rn}/${rd}`;
  return `${Math.floor(rn / rd)} ${rn % rd}/${rd}`;
}

/**
 * 기약 꼴로 쓴 답만 읽는다. 약분하지 않았거나 대분수로 바꾸지 않은 답은 null.
 * 학년군 문항은 답을 기약분수(대분수)로 쓰라고 하므로 꼴까지 검사 대상이다.
 */
function parseCanonical(text) {
  const t = String(text);
  let m = /^(\d+) (\d+)\/(\d+)$/.exec(t);
  if (m) {
    const [w, n, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (w === 0 || n === 0 || n >= d || gcd(n, d) !== 1) return null;
    return { n: w * d + n, d };
  }
  m = /^(\d+)\/(\d+)$/.exec(t);
  if (m) {
    const [n, d] = [Number(m[1]), Number(m[2])];
    if (n === 0 || n >= d || d === 1 || gcd(n, d) !== 1) return null;
    return { n, d };
  }
  m = /^\d+$/.exec(t);
  return m ? { n: Number(t), d: 1 } : null;
}

const sameValue = (p, n, d) => p !== null && p.n * d === n * p.d;

const mixedText = (w, n, d) => (w === 0 ? `${n}/${d}` : n === 0 ? `${w}` : `${w} ${n}/${d}`);

/** 0.01 단위 정수를 소수 문자열로. 끝의 0 은 쓰지 않는다. */
function fmtHundredths(h) {
  const whole = Math.floor(h / 100);
  const frac = h % 100;
  if (frac === 0) return `${whole}`;
  return `${whole}.${String(frac).padStart(2, '0')}`.replace(/0$/, '');
}

function parseHundredths(text) {
  if (!/^\d+(\.\d{1,2})?$/.test(String(text))) return null;
  const [w, f = ''] = String(text).split('.');
  return Number(w) * 100 + Number(f.padEnd(2, '0'));
}

// ---------------------------------------------------------------------------
// [6수01-04] 최대공약수 · [6수01-05] 배수와 최소공배수
// ---------------------------------------------------------------------------

const SHARE_PAIRS = [
  [['사과', '개'], ['배', '개']],
  [['연필', '자루'], ['지우개', '개']],
  [['초콜릿', '개'], ['사탕', '개']],
  [['공책', '권'], ['색연필', '자루']],
];

const gcdStory = {
  id: 'math.g56.no.s04.gcd-story',
  standardCode: '[6수01-04]',
  skill: '최대공약수를 이용하여 똑같이 나누어 주는 문제 해결하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const cap = difficulty === 1 ? 30 : difficulty === 2 ? 60 : 150;
    // 최대공약수를 먼저 정해 2만 나오는 치우침을 막는다.
    const { a, b } = rng.until(() => {
      const k = rng.int(2, Math.floor(cap / 3));
      return { a: k * rng.int(2, Math.floor(cap / k)), b: k * rng.int(2, Math.floor(cap / k)) };
    }, ({ a: x, b: y }) => x !== y && x % y !== 0 && y % x !== 0, 400);
    const [[p, pc], [q, qc]] = rng.pick(SHARE_PAIRS);
    const g = gcd(a, b);
    return {
      params: { a, b },
      instruction: '물음에 답하시오.',
      stem: `${p} ${a}${pc}${josaGwa(pc)} ${q} ${b}${qc}${josaEul(qc)} 될 수 있는 대로 많은 친구에게 남김없이 똑같이 나누어 주려고 합니다.`
        + ' 최대 몇 명에게 나누어 줄 수 있습니까?',
      answer: { value: g, display: `${g}명`, accepts: [num(g), `${g}명`] },
      solution: [
        `나누어 줄 수 있는 사람 수는 ${numGwa(a)} ${b}의 공약수이다.`,
        `가장 많은 사람 수는 최대공약수이므로 ${g}명이다.`,
      ],
      dedupeKey: `gcd-story:${Math.min(a, b)}:${Math.max(a, b)}`,
      difficulty,
    };
  },
  verify({ a, b }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v < 1 || a % v !== 0 || b % v !== 0) return false;
    // 나눈 몫끼리 1 말고 공약수가 없어야 더 많이 나눌 수 없다.
    for (let k = 2; k <= Math.min(a / v, b / v); k += 1) {
      if ((a / v) % k === 0 && (b / v) % k === 0) return false;
    }
    return true;
  },
};

const LCM_SCENES = [
  { what: '버스', verb: '출발합니다', past: '출발했다면', again: '동시에 출발하는 것', unit: '분' },
  { what: '기차', verb: '출발합니다', past: '출발했다면', again: '동시에 출발하는 것', unit: '분' },
  { what: '분수대', verb: '물을 뿜습니다', past: '물을 뿜었다면', again: '동시에 물을 뿜는 것', unit: '초' },
  { what: '신호등', verb: '깜박입니다', past: '깜박였다면', again: '동시에 깜박이는 것', unit: '초' },
  { what: '알람', verb: '울립니다', past: '울렸다면', again: '동시에 울리는 것', unit: '분' },
];

const lcmStory = {
  id: 'math.g56.no.s05.lcm-story',
  standardCode: '[6수01-05]',
  skill: '최소공배수를 이용하여 다시 동시에 일어나는 때 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const [lo, hi] = difficulty === 1 ? [2, 30] : difficulty === 2 ? [4, 45] : [6, 60];
    const { a, b } = rng.until(() => ({ a: rng.int(lo, hi), b: rng.int(lo, hi) }), ({ a: x, b: y }) => (
      x < y && y % x !== 0 && gcd(x, y) > 1
    ));
    const L = lcm(a, b);
    const scene = rng.pick(LCM_SCENES);
    const head = `가 ${scene.what}${josaEun(scene.what)} ${a}${scene.unit}마다, 나 ${scene.what}${josaEun(scene.what)} ${b}${scene.unit}마다 ${scene.verb}.`
      + ` 지금 두 ${scene.what}${josaI(scene.what)} 동시에 ${scene.past},`;
    // 난이도 2·3은 정해진 시간 동안 다시 함께 일어나는 횟수도 묻는다.
    if (difficulty !== 1 && rng.bool()) {
      const k = rng.int(2, difficulty === 2 ? 5 : 9);
      const T = L * k + rng.int(1, L - 1);
      return {
        params: { kind: 'count', a, b, T },
        instruction: '물음에 답하시오.',
        stem: `${head} 앞으로 ${T}${scene.unit} 동안 다시 ${scene.again}은 몇 번입니까? (지금은 세지 않습니다.)`,
        answer: { value: k, display: `${k}번`, accepts: [num(k), `${k}번`] },
        solution: [
          `다시 함께 일어나는 때는 ${numGwa(a)} ${b}의 공배수이고, 최소공배수는 ${L}이다.`,
          `${T}까지 ${L}의 배수는 ${T} ÷ ${L}의 몫인 ${k}개이므로 ${k}번이다.`,
        ],
        dedupeKey: `lcm-story:count:${a}:${b}:${T}`,
        difficulty,
      };
    }
    return {
      params: { kind: 'first', a, b },
      instruction: '물음에 답하시오.',
      stem: `${head} 처음으로 다시 ${scene.again}은 몇 ${scene.unit} 후입니까?`,
      answer: { value: L, display: `${L}${scene.unit} 후`, accepts: [num(L), `${L}${scene.unit}`, `${L}${scene.unit} 후`] },
      solution: [
        `다시 함께 일어나는 때는 ${numGwa(a)} ${b}의 공배수이다.`,
        `처음으로 함께 일어나는 때는 최소공배수인 ${L}${scene.unit} 후이다.`,
      ],
      dedupeKey: `lcm-story:${a}:${b}`,
      difficulty,
    };
  },
  verify({ kind, a, b, T }, answer) {
    const v = answer.value;
    if (kind === 'count') {
      if (!Number.isInteger(v) || v < 1) return false;
      // 1부터 T까지 두 수의 공배수를 하나씩 센다.
      let c = 0;
      for (let k = 1; k <= T; k += 1) if (k % a === 0 && k % b === 0) c += 1;
      return c === v;
    }
    if (!Number.isInteger(v) || v < 1 || v % a !== 0 || v % b !== 0) return false;
    // 더 작은 공배수가 없는지 하나씩 확인한다.
    for (let k = Math.max(a, b); k < v; k += 1) if (k % a === 0 && k % b === 0) return false;
    return true;
  },
};

const multiplesInRange = {
  id: 'math.g56.no.s05.multiples-in-range',
  standardCode: '[6수01-05]',
  skill: '주어진 범위에 있는 배수의 개수 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const k = difficulty === 1 ? rng.int(2, 9) : difficulty === 2 ? rng.int(3, 15) : rng.int(6, 25);
    const from = difficulty === 3 ? rng.int(10, 200) : 1;
    const to = from + (difficulty === 1 ? rng.int(20, 60) : difficulty === 2 ? rng.int(60, 200) : rng.int(100, 400));
    const count = Math.floor(to / k) - Math.floor((from - 1) / k);
    const first = Math.ceil(from / k) * k;
    const last = Math.floor(to / k) * k;
    return {
      params: { k, from, to },
      instruction: '물음에 답하시오.',
      stem: `${from}부터 ${to}까지의 수 중에서 ${k}의 배수는 모두 몇 개입니까?`,
      answer: { value: count, display: `${count}개`, accepts: [num(count), `${count}개`] },
      solution: [
        `가장 작은 ${k}의 배수는 ${first}이고 가장 큰 ${k}의 배수는 ${last}이다.`,
        `${first} = ${k} × ${first / k}, ${last} = ${k} × ${last / k}이므로 ${last / k} - ${first / k} + 1 = ${count}개이다.`,
      ],
      dedupeKey: `multiples-in-range:${k}:${from}:${to}`,
      difficulty,
    };
  },
  verify({ k, from, to }, answer) {
    // 범위의 수를 하나씩 세어 본다.
    let c = 0;
    for (let n = from; n <= to; n += 1) if (n % k === 0) c += 1;
    return answer.value === c;
  },
};

// ---------------------------------------------------------------------------
// [6수01-06] 크기가 같은 분수 · [6수01-08]~[6수01-11] 분수의 계산
// ---------------------------------------------------------------------------

const equivalentBlank = {
  id: 'math.g56.no.s06.equivalent-blank',
  standardCode: '[6수01-06]',
  skill: '크기가 같은 분수가 되도록 빈칸 채우기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    const d = difficulty === 1 ? rng.int(2, 6) : difficulty === 2 ? rng.int(3, 12) : rng.int(7, 20);
    const n = rng.until(() => rng.int(1, d - 1), (v) => gcd(v, d) === 1);
    const k = difficulty === 1 ? rng.int(2, 5) : difficulty === 2 ? rng.int(2, 9) : rng.int(4, 12);
    const parts = [n, d, n * k, d * k];
    const hide = rng.int(0, 3);
    const shown = parts.map((p, i) => (i === hide ? '□' : String(p)));
    const reducedFirst = rng.bool();
    const left = reducedFirst ? `${shown[0]}/${shown[1]}` : `${shown[2]}/${shown[3]}`;
    const right = reducedFirst ? `${shown[2]}/${shown[3]}` : `${shown[0]}/${shown[1]}`;
    const value = parts[hide];
    return {
      params: { shown },
      instruction: '크기가 같은 분수가 되도록 □ 안에 알맞은 수를 써넣으시오.',
      stem: `${left} = ${right}`,
      answer: { value, display: num(value), accepts: [num(value)] },
      solution: [
        '분모와 분자에 0이 아닌 같은 수를 곱하거나 같은 수로 나누면 크기가 같은 분수가 된다.',
        `${n}/${d}의 분모와 분자에 ${numEul(k)} 곱하면 ${n * k}/${d * k}이므로 □는 ${value}이다.`,
      ],
      dedupeKey: `equivalent:${n}:${d}:${k}:${hide}:${reducedFirst ? 'r' : 'e'}`,
      difficulty,
    };
  },
  verify({ shown }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v < 1) return false;
    const [a, b, c, e] = shown.map((s) => (s === '□' ? v : Number(s)));
    // 교차 곱이 같아야 크기가 같다.
    return a * e === b * c;
  },
};

function randomMixed(rng, d, wholeMax) {
  return { w: rng.int(1, wholeMax), n: rng.until(() => rng.int(1, d - 1), (v) => gcd(v, d) === 1), d };
}
const improper = ({ w, n, d }) => w * d + n;

const mixedAddSubUnlike = {
  id: 'math.g56.no.s08.mixed-add-sub',
  standardCode: '[6수01-08]',
  skill: '분모가 다른 대분수의 덧셈과 뺄셈',
  format: 'short-answer',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 한 분모가 다른 분모의 배수인 덧셈, 2는 두 분모의 최소공배수로 통분하는 덧셈, 3은 통분한 뒤 자연수에서 받아내림이 있는 뺄셈이다.',
  generate(rng, { difficulty }) {
    const isAdd = difficulty !== 3;
    const { x, y } = rng.until(() => {
      const d1 = rng.int(2, 8);
      const d2 = difficulty === 1 ? d1 * rng.int(2, 3) : rng.int(2, 12);
      return { x: randomMixed(rng, d1, 5), y: randomMixed(rng, d2, 4) };
    }, ({ x: p, y: q }) => {
      if (p.d === q.d || lcm(p.d, q.d) > 60) return false;
      if (difficulty === 2 && (p.d % q.d === 0 || q.d % p.d === 0)) return false;
      if (difficulty === 3) {
        const L = lcm(p.d, q.d);
        return p.w > q.w && (p.n * L) / p.d < (q.n * L) / q.d;
      }
      return true;
    }, 600);
    const L = lcm(x.d, y.d);
    const X = improper(x) * (L / x.d);
    const Y = improper(y) * (L / y.d);
    const R = isAdd ? X + Y : X - Y;
    const display = fmtRational(R, L);
    const op = isAdd ? '+' : '-';
    return {
      params: { x, y, isAdd },
      instruction: '계산하여 기약분수로 나타내시오.',
      stem: `${mixedText(x.w, x.n, x.d)} ${op} ${mixedText(y.w, y.n, y.d)}`,
      answer: { value: display, display, accepts: [display] },
      solution: [
        `두 분모 ${numGwa(x.d)} ${y.d}의 최소공배수 ${numRo(L)} 통분한다: ${mixedText(x.w, (x.n * L) / x.d, L)} ${op} ${mixedText(y.w, (y.n * L) / y.d, L)}`,
        isAdd ? '자연수끼리, 분수끼리 더하고 가분수는 대분수로 바꾼다.' : '분수끼리 뺄 수 없으면 자연수에서 1을 받아내려 뺀다.',
        `답은 ${display}이다.`,
      ],
      dedupeKey: `mixed-unlike:${x.w}.${x.n}/${x.d}${op}${y.w}.${y.n}/${y.d}`,
      difficulty,
    };
  },
  verify({ x, y, isAdd }, answer) {
    const p = parseCanonical(answer.value);
    if (p === null) return false;
    // 답에서 둘째 수를 되돌려 첫째 수가 나오는지 교차 곱으로 본다.
    const backN = isAdd ? p.n * y.d - improper(y) * p.d : p.n * y.d + improper(y) * p.d;
    return backN * x.d === improper(x) * p.d * y.d;
  },
};

const mixedTimes = {
  id: 'math.g56.no.s09.mixed-times',
  standardCode: '[6수01-09]',
  skill: '대분수의 곱셈',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const x = randomMixed(rng, rng.int(2, difficulty === 1 ? 5 : 9), difficulty === 1 ? 3 : 5);
    const y = difficulty === 1
      ? { w: rng.int(2, 9), n: 0, d: 1 }
      : difficulty === 2
        ? (() => { const d = rng.int(2, 9); return { w: 0, n: rng.until(() => rng.int(1, d - 1), (v) => gcd(v, d) === 1), d }; })()
        : randomMixed(rng, rng.int(2, 9), 4);
    const N = improper(x) * improper(y);
    const D = x.d * y.d;
    const display = fmtRational(N, D);
    const yText = y.d === 1 ? `${y.w}` : mixedText(y.w, y.n, y.d);
    return {
      params: { x, y },
      instruction: '계산하여 기약분수로 나타내시오.',
      stem: `${mixedText(x.w, x.n, x.d)} × ${yText}`,
      answer: { value: display, display, accepts: [display] },
      solution: [
        `대분수를 가분수로 바꾸면 ${improper(x)}/${x.d} × ${y.d === 1 ? y.w : `${improper(y)}/${y.d}`}이다.`,
        `분자끼리, 분모끼리 곱하면 ${N}/${D}이고, 기약분수로 나타내면 ${display}이다.`,
      ],
      dedupeKey: `mixed-times:${x.w}.${x.n}/${x.d}x${y.w}.${y.n}/${y.d}`,
      difficulty,
    };
  },
  verify({ x, y }, answer) {
    const p = parseCanonical(answer.value);
    if (p === null) return false;
    // 곱을 둘째 수로 나누면 첫째 수가 되어야 한다: p / (Y/y.d) = X/x.d
    return p.n * y.d * x.d === improper(x) * improper(y) * p.d;
  },
};

const SHARE_THINGS = [
  { noun: '끈', unit: 'm' },
  { noun: '주스', unit: 'L' },
  { noun: '찰흙', unit: 'kg' },
  { noun: '리본', unit: 'm' },
];

const shareStory = {
  id: 'math.g56.no.s10.share-story',
  standardCode: '[6수01-10]',
  skill: '똑같이 나누는 상황에서 몫을 분수로 나타내기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const people = difficulty === 1 ? rng.int(2, 9) : rng.int(3, 15);
    const amount = rng.until(
      () => (difficulty === 1 ? rng.int(1, people - 1) : difficulty === 2 ? rng.int(people + 1, people * 3) : rng.int(people * 2, 60)),
      (v) => v % people !== 0,
    );
    const t = rng.pick(SHARE_THINGS);
    const display = fmtRational(amount, people);
    return {
      params: { amount, people },
      instruction: '몫을 기약분수로 나타내시오.',
      stem: `${t.noun} ${amount}${t.unit}${unitParticle(t.unit, '을', '를')} ${people}명이 똑같이 나누어 가지려고 합니다.`
        + ` 한 사람이 가지는 ${t.noun}${josaEun(t.noun)} 몇 ${t.unit}입니까?`,
      answer: { value: display, display: `${display}${t.unit}`, accepts: [display, `${display}${t.unit}`] },
      solution: [`${amount} ÷ ${people}의 몫은 ${amount}/${people}이다.`, `기약분수로 나타내면 ${display}${t.unit}이다.`],
      dedupeKey: `share-story:${amount}:${people}:${t.unit}`,
      difficulty,
    };
  },
  verify({ amount, people }, answer) {
    const p = parseCanonical(answer.value);
    // 한 사람 몫에 사람 수를 곱하면 전체가 되어야 한다.
    return p !== null && p.n * people === amount * p.d;
  },
};

const mixedDivide = {
  id: 'math.g56.no.s11.mixed-divide',
  standardCode: '[6수01-11]',
  skill: '대분수를 분수로 나누기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const x = randomMixed(rng, rng.int(2, difficulty === 1 ? 5 : 9), difficulty === 3 ? 6 : 3);
    const y = difficulty === 3
      ? randomMixed(rng, rng.int(2, 9), 2)
      : (() => { const d = rng.int(2, difficulty === 1 ? 5 : 9); return { w: 0, n: rng.until(() => rng.int(1, d - 1), (v) => gcd(v, d) === 1), d }; })();
    const N = improper(x) * y.d;
    const D = x.d * improper(y);
    const display = fmtRational(N, D);
    return {
      params: { x, y },
      instruction: '계산하여 기약분수로 나타내시오.',
      stem: `${mixedText(x.w, x.n, x.d)} ÷ ${mixedText(y.w, y.n, y.d)}`,
      answer: { value: display, display, accepts: [display] },
      solution: [
        `가분수로 바꾸면 ${improper(x)}/${x.d} ÷ ${improper(y)}/${y.d}이다.`,
        `나누는 분수의 분모와 분자를 바꾸어 곱하면 ${improper(x)}/${x.d} × ${y.d}/${improper(y)} = ${N}/${D}이다.`,
        `기약분수로 나타내면 ${display}이다.`,
      ],
      dedupeKey: `mixed-divide:${x.w}.${x.n}/${x.d}:${y.w}.${y.n}/${y.d}`,
      difficulty,
    };
  },
  verify({ x, y }, answer) {
    const p = parseCanonical(answer.value);
    if (p === null) return false;
    // 몫에 나누는 수를 곱하면 나누어지는 수가 되어야 한다.
    return p.n * improper(y) * x.d === improper(x) * p.d * y.d;
  },
};

// ---------------------------------------------------------------------------
// [6수01-12] 분수와 소수의 관계
// ---------------------------------------------------------------------------

/** 소수 두 자리 안에서 나누어떨어지는 분모만 쓴다. 8·40은 소수 세 자리가 되어 풀이 표기가 깨진다. */
const FRIENDLY = { 1: [2, 4, 5, 10], 2: [2, 4, 5, 10, 20, 25], 3: [4, 5, 20, 25, 50] };

const compareFractionDecimal = {
  id: 'math.g56.no.s12.compare-fraction-decimal',
  standardCode: '[6수01-12]',
  skill: '분수와 소수의 크기 비교하기',
  format: 'compare',
  generate(rng, { difficulty }) {
    const d = rng.pick(FRIENDLY[difficulty]);
    const whole = difficulty === 3 ? rng.int(1, 5) : 0;
    const n = rng.until(() => rng.int(1, d - 1), (v) => gcd(v, d) === 1);
    const fracH = ((whole * d + n) * 100) / d;
    const exact = Number.isInteger(fracH);
    // 난이도 1은 소수 한 자리 수, 2·3은 소수 두 자리 수와 비교한다.
    const step = difficulty === 1 ? 10 : 1;
    const canEqual = exact && fracH % step === 0;
    const decH = rng.int(0, 2) === 0 && canEqual
      ? fracH
      : rng.until(() => whole * 100 + rng.int(1, 99 / step) * step, (v) => v !== fracH);
    const fracText = mixedText(whole, n, d);
    const decText = fmtHundredths(Math.round(decH));
    const fracLeft = rng.bool();
    const lv = fracLeft ? fracH : decH;
    const rv = fracLeft ? decH : fracH;
    const sign = lv > rv ? '>' : lv < rv ? '<' : '=';
    const left = fracLeft ? fracText : decText;
    const right = fracLeft ? decText : fracText;
    return {
      params: { whole, n, d, decimal: decText, fracLeft },
      instruction: '□ 안에 >, =, < 중 알맞은 것을 써넣으시오.',
      stem: `${left} □ ${right}`,
      answer: { value: sign, display: sign, accepts: [sign] },
      solution: [
        `${fracText}${fractionParticle(`${n}/${d}`, '을', '를')} 소수로 나타내면 ${fmtHundredths(fracH)}이다.`,
        `그러므로 ${left} ${sign} ${right}이다.`,
      ],
      dedupeKey: `cmp-frac-dec:${whole}:${n}/${d}:${decText}:${fracLeft ? 'f' : 'd'}`,
      difficulty,
    };
  },
  verify({ whole, n, d, decimal, fracLeft }, answer) {
    // 소수를 0.01 단위 정수로, 분수를 같은 단위로 교차 곱하여 비교한다.
    const h = parseHundredths(decimal);
    const diff = (whole * d + n) * 100 - h * d;
    const s = fracLeft ? Math.sign(diff) : -Math.sign(diff);
    return (s > 0 && answer.value === '>') || (s < 0 && answer.value === '<') || (s === 0 && answer.value === '=');
  },
};

const decimalToFraction = {
  id: 'math.g56.no.s12.decimal-to-fraction',
  standardCode: '[6수01-12]',
  skill: '소수를 기약분수로 나타내기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const scale = difficulty === 1 ? 1 : difficulty === 2 ? 2 : 3;
    const denom = 10 ** scale;
    const whole = difficulty === 3 ? rng.int(0, 4) : 0;
    const part = rng.until(() => rng.int(1, denom - 1), (v) => v % 10 !== 0 || scale === 1);
    const units = whole * denom + part;
    const text = `${whole}.${String(part).padStart(scale, '0')}`;
    const display = fmtRational(units, denom);
    return {
      params: { units, scale },
      instruction: '소수를 기약분수로 나타내시오.',
      stem: text,
      answer: { value: display, display, accepts: [display] },
      solution: [
        `${text}${numberParticle(Number(text.at(-1)), '은', '는')} ${units}/${denom}이다.`,
        gcd(units, denom) === 1
          ? `더 약분할 수 없으므로 답은 ${display}이다.`
          : `분모와 분자를 최대공약수 ${numRo(gcd(units, denom))} 나누면 ${display}이다.`,
      ],
      dedupeKey: `dec-to-frac:${units}:${scale}`,
      difficulty,
    };
  },
  verify({ units, scale }, answer) {
    const p = parseCanonical(answer.value);
    return p !== null && p.n * 10 ** scale === units * p.d;
  },
};

// ---------------------------------------------------------------------------
// [6수02-01] 대응 관계 · [6수02-03] 백분율 · [6수02-05] 비례배분
// ---------------------------------------------------------------------------

const ruleTable = {
  id: 'math.g56.rm.s02-01.rule-table',
  standardCode: '[6수02-01]',
  skill: '대응표에서 규칙을 찾아 다른 값 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = difficulty === 1 ? rng.pick(['mul', 'add']) : difficulty === 2 ? rng.pick(['mul', 'add', 'sub']) : 'mul-add';
    const a = rng.int(2, difficulty === 3 ? 9 : 12);
    const b = rng.int(1, 9);
    const f = (x) => (kind === 'mul' ? a * x : kind === 'add' ? x + a : kind === 'sub' ? x - a : a * x + b);
    const start = kind === 'sub' ? a + 1 : rng.int(1, 3);
    const xs = [0, 1, 2, 3].map((k) => start + k);
    const target = rng.int(xs[3] + 3, difficulty === 3 ? 50 : 30);
    const value = f(target);
    const rule = kind === 'mul' ? `□ = △ × ${a}` : kind === 'add' ? `□ = △ + ${a}` : kind === 'sub' ? `□ = △ - ${a}` : `□ = △ × ${a} + ${b}`;
    return {
      params: { xs, ys: xs.map(f), target },
      instruction: '표를 보고 물음에 답하시오.',
      stem: `△ | ${xs.join(' | ')}\n□ | ${xs.map(f).join(' | ')}\n△가 ${target}일 때 □는 얼마입니까?`,
      answer: { value, display: num(value), accepts: [num(value)] },
      solution: [`△와 □의 대응 관계를 식으로 나타내면 ${rule}이다.`, `△에 ${numEul(target)} 넣으면 □는 ${value}이다.`],
      dedupeKey: `rule-table:${kind}:${a}:${kind === 'mul-add' ? b : ''}:${start}:${target}`,
      difficulty,
    };
  },
  verify({ xs, ys, target }, answer) {
    // 표의 두 값으로 기울기와 절편을 다시 구하고 모든 칸에 맞는지 본다.
    const slope = (ys[1] - ys[0]) / (xs[1] - xs[0]);
    const intercept = ys[0] - slope * xs[0];
    if (xs.some((x, k) => slope * x + intercept !== ys[k])) return false;
    return answer.value === slope * target + intercept;
  },
};

const percentProblems = {
  id: 'math.g56.rm.s02-03.percent',
  standardCode: '[6수02-03]',
  skill: '비율을 백분율로 나타내고 백분율로 양 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = difficulty === 1 ? 'to-percent' : difficulty === 2 ? rng.pick(['to-percent', 'part']) : rng.pick(['part', 'sale']);
    if (kind === 'to-percent') {
      const total = rng.pick(difficulty === 1 ? [10, 20, 25, 50, 100] : [20, 25, 40, 50, 200, 250, 400, 500]);
      const part = rng.until(() => rng.int(1, total - 1), (v) => (v * 100) % total === 0);
      const pct = (part * 100) / total;
      const scene = rng.pick([['반 학생', '명', '안경을 쓴 학생'], ['공', '개', '빨간 공'], ['꽃', '송이', '장미']]);
      return {
        params: { kind, total, part },
        instruction: '물음에 답하시오.',
        stem: `${scene[0]} ${total}${scene[1]} 중에서 ${scene[2]}${josaEun(scene[2])} ${part}${scene[1]}입니다. 전체에 대한 ${scene[2]}의 비율을 백분율로 나타내시오.`,
        answer: { value: `${pct}%`, display: `${pct}%`, accepts: [`${pct}%`, `${pct}`] },
        solution: [`비율은 ${part}/${total}이다.`, `비율에 100을 곱하면 ${pct}이므로 ${pct}%이다.`],
        dedupeKey: `percent:to:${total}:${part}`,
        difficulty,
      };
    }
    const price = rng.int(difficulty === 2 ? 2 : 5, difficulty === 2 ? 50 : 200) * 100;
    const pct = rng.pick(difficulty === 2 ? [10, 20, 25, 50] : [5, 10, 15, 20, 25, 30, 40, 60, 75]);
    const off = (price * pct) / 100;
    if (!Number.isInteger(off)) return this.generate(rng, { difficulty });
    const isSale = kind === 'sale';
    const value = isSale ? price - off : off;
    return {
      params: { kind, price, pct },
      instruction: '물음에 답하시오.',
      stem: isSale
        ? `${price}원짜리 물건을 ${pct}% 할인하여 팔고 있습니다. 할인한 가격은 얼마입니까?`
        : `${price}원의 ${pct}%는 얼마입니까?`,
      answer: { value, display: `${value}원`, accepts: [num(value), `${value}원`] },
      solution: isSale
        ? [`할인 금액은 ${price} × ${pct}/100 = ${off}(원)이다.`, `할인한 가격은 ${price} - ${off} = ${value}(원)이다.`]
        : [`${pct}%는 ${pct}/100이므로 ${price} × ${pct}/100 = ${value}(원)이다.`],
      dedupeKey: `percent:${kind}:${price}:${pct}`,
      difficulty,
    };
  },
  verify(params, answer) {
    if (params.kind === 'to-percent') {
      const m = /^(\d+)%$/.exec(String(answer.value));
      // 백분율을 다시 전체에 곱해 부분이 되는지 본다.
      return m !== null && Number(m[1]) * params.total === params.part * 100;
    }
    const v = answer.value;
    if (!Number.isInteger(v)) return false;
    if (params.kind === 'part') return v * 100 === params.price * params.pct;
    return (params.price - v) * 100 === params.price * params.pct;
  },
};

const ratioShare = {
  id: 'math.g56.rm.s02-05.share-story',
  standardCode: '[6수02-05]',
  skill: '전체를 주어진 비로 비례배분하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const { a, b } = rng.until(() => ({ a: rng.int(1, 9), b: rng.int(1, 9) }), ({ a: x, b: y }) => x !== y && gcd(x, y) === 1);
    const unit = difficulty === 1 ? rng.int(2, 8) : difficulty === 2 ? rng.int(5, 25) : rng.int(20, 110);
    const total = unit * (a + b);
    const askFirst = rng.bool();
    const [p, q] = rng.pick([['형', '동생'], ['언니', '동생'], ['가 모둠', '나 모둠']]);
    const scene = rng.pick([['구슬', '개'], ['색종이', '장'], ['밤', '개']]);
    const value = askFirst ? unit * a : unit * b;
    const who = askFirst ? p : q;
    return {
      params: { total, a, b, askFirst },
      instruction: '물음에 답하시오.',
      stem: `${scene[0]} ${total}${scene[1]}${josaEul(scene[1])} ${p}${josaGwa(p)} ${q}에게 ${a} : ${numRo(b)} 나누어 주려고 합니다. ${who}에게 몇 ${scene[1]}${josaEul(scene[1])} 주어야 합니까?`,
      answer: { value, display: `${value}${scene[1]}`, accepts: [num(value), `${value}${scene[1]}`] },
      solution: [
        `${who}의 몫은 전체의 ${askFirst ? a : b}/${a + b}이다.`,
        `${total} × ${askFirst ? a : b}/${a + b} = ${value}이다.`,
      ],
      dedupeKey: `ratio-share:${total}:${a}:${b}:${askFirst ? 1 : 2}`,
      difficulty,
    };
  },
  verify({ total, a, b, askFirst }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0 || v >= total) return false;
    // 나머지 몫과의 비가 주어진 비와 같아야 한다.
    const rest = total - v;
    return askFirst ? v * b === rest * a : v * a === rest * b;
  },
};

// ---------------------------------------------------------------------------
// [6수03-11] 둘레 · [6수03-13]~[6수03-14] 넓이 · [6수03-16] 원 · [6수03-19] 부피
// ---------------------------------------------------------------------------

const POLYGON_NAMES = { 3: '정삼각형', 4: '정사각형', 5: '정오각형', 6: '정육각형', 7: '정칠각형', 8: '정팔각형', 9: '정구각형', 10: '정십각형' };

const perimeterInverse = {
  id: 'math.g56.rm.s03-11.perimeter-inverse',
  standardCode: '[6수03-11]',
  skill: '둘레를 알 때 변의 길이 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = difficulty === 1 ? 'regular' : difficulty === 2 ? rng.pick(['regular', 'rectangle']) : rng.pick(['rectangle', 'parallelogram']);
    if (kind === 'regular') {
      const sides = rng.int(3, 10);
      const side = rng.int(2, difficulty === 1 ? 15 : 40);
      return {
        params: { kind, sides, perimeter: sides * side },
        instruction: '물음에 답하시오.',
        stem: `둘레가 ${sides * side}cm인 ${POLYGON_NAMES[sides]}의 한 변은 몇 cm입니까?`,
        answer: { value: side, display: `${side}cm`, accepts: [num(side), `${side}cm`] },
        solution: [`${POLYGON_NAMES[sides]}${josaEun(POLYGON_NAMES[sides])} 변 ${sides}개의 길이가 모두 같다.`, `${sides * side} ÷ ${sides} = ${side}이므로 ${side}cm이다.`],
        dedupeKey: `perimeter-inv:regular:${sides}:${side}`,
        difficulty,
      };
    }
    const w = rng.int(3, difficulty === 3 ? 60 : 30);
    const h = rng.until(() => rng.int(2, difficulty === 3 ? 60 : 30), (v) => v !== w);
    const shape = kind === 'rectangle' ? '직사각형' : '평행사변형';
    // 평행사변형의 '다른 한 변'은 맞은편 변으로도 읽힌다. 이웃한 변을 묻는다고 밝힌다.
    const what = kind === 'rectangle' ? ['가로', '세로'] : ['한 변', '이 변과 이웃한 변'];
    return {
      params: { kind, perimeter: 2 * (w + h), known: w },
      instruction: '물음에 답하시오.',
      stem: `둘레가 ${2 * (w + h)}cm이고 ${what[0]}${josaI(what[0])} ${w}cm인 ${shape}이 있습니다. ${what[1]}${josaEun(what[1])} 몇 cm입니까?`,
      answer: { value: h, display: `${h}cm`, accepts: [num(h), `${h}cm`] },
      solution: [`${shape}의 둘레는 (${what[0]} + ${what[1]}) × 2이다.`, `${2 * (w + h)} ÷ 2 = ${w + h}, ${w + h} - ${w} = ${h}이므로 ${h}cm이다.`],
      dedupeKey: `perimeter-inv:${kind}:${w}:${h}`,
      difficulty,
    };
  },
  verify(params, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    if (params.kind === 'regular') return v * params.sides === params.perimeter;
    return (v + params.known) * 2 === params.perimeter;
  },
};

const rectangleInverse = {
  id: 'math.g56.rm.s03-13.rectangle-inverse',
  standardCode: '[6수03-13]',
  skill: '넓이를 알 때 직사각형의 변의 길이 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const square = difficulty === 1 ? false : rng.int(0, 3) === 0;
    // 정사각형의 한 변은 곱셈구구 감각으로 찾을 수 있게 15 이하로 둔다.
    const w = square ? rng.int(2, 15) : rng.int(2, difficulty === 1 ? 12 : difficulty === 2 ? 25 : 60);
    const h = square ? w : rng.until(() => rng.int(2, difficulty === 1 ? 12 : difficulty === 2 ? 25 : 60), (v) => v !== w);
    const area = w * h;
    return {
      params: { area, known: square ? null : w },
      instruction: '물음에 답하시오.',
      stem: square
        ? `넓이가 ${area}cm²인 정사각형의 한 변은 몇 cm입니까?`
        : `넓이가 ${area}cm²이고 가로가 ${w}cm인 직사각형이 있습니다. 세로는 몇 cm입니까?`,
      answer: { value: h, display: `${h}cm`, accepts: [num(h), `${h}cm`] },
      solution: square
        ? ['정사각형의 넓이는 (한 변) × (한 변)이다.', `${h} × ${h} = ${area}이므로 한 변은 ${h}cm이다.`]
        : ['직사각형의 넓이는 (가로) × (세로)이다.', `${area} ÷ ${w} = ${h}이므로 세로는 ${h}cm이다.`],
      dedupeKey: `rect-inv:${square ? 'sq' : 'rect'}:${w}:${h}`,
      difficulty,
    };
  },
  verify({ area, known }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    return known === null ? v * v === area : v * known === area;
  },
};

const AREA_SHAPES = {
  triangle: { name: '삼각형', known: '밑변', ask: '높이' },
  parallelogram: { name: '평행사변형', known: '밑변', ask: '높이' },
  trapezoid: { name: '사다리꼴', known: '윗변과 아랫변', ask: '높이' },
  rhombus: { name: '마름모', known: '한 대각선', ask: '다른 대각선' },
};

const areaInverse = {
  id: 'math.g56.rm.s03-14.area-inverse',
  standardCode: '[6수03-14]',
  skill: '넓이를 알 때 평행사변형·삼각형·사다리꼴·마름모의 길이 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = difficulty === 1 ? rng.pick(['parallelogram', 'triangle']) : difficulty === 2 ? rng.pick(['triangle', 'rhombus']) : 'trapezoid';
    const S = AREA_SHAPES[kind];
    const cap = difficulty === 3 ? 40 : 24;
    let known;
    let value;
    let area;
    let knownText;
    if (kind === 'trapezoid') {
      const top = rng.int(2, cap);
      const bottom = rng.until(() => rng.int(3, cap), (v) => v !== top);
      value = rng.until(() => rng.int(2, cap), (v) => ((top + bottom) * v) % 2 === 0);
      known = [top, bottom];
      area = ((top + bottom) * value) / 2;
      knownText = `윗변이 ${top}cm, 아랫변이 ${bottom}cm`;
    } else {
      const k = rng.int(2, cap);
      value = rng.until(() => rng.int(2, cap), (v) => kind === 'parallelogram' || (k * v) % 2 === 0);
      known = [k];
      area = kind === 'parallelogram' ? k * value : (k * value) / 2;
      knownText = `${S.known}${josaI(S.known)} ${k}cm`;
    }
    return {
      params: { kind, known, area },
      instruction: '물음에 답하시오.',
      stem: `넓이가 ${area}cm²이고 ${knownText}인 ${S.name}의 ${S.ask}${josaEun(S.ask)} 몇 cm입니까?`,
      answer: { value, display: `${value}cm`, accepts: [num(value), `${value}cm`] },
      solution: [
        kind === 'parallelogram' ? '평행사변형의 넓이는 (밑변) × (높이)이다.'
          : kind === 'triangle' ? '삼각형의 넓이는 (밑변) × (높이) ÷ 2이다.'
            : kind === 'trapezoid' ? '사다리꼴의 넓이는 (윗변 + 아랫변) × (높이) ÷ 2이다.'
              : '마름모의 넓이는 (한 대각선) × (다른 대각선) ÷ 2이다.',
        `넓이 ${area}cm²가 되도록 거꾸로 계산하면 ${value}cm이다.`,
      ],
      dedupeKey: `area-inv:${kind}:${known.join('-')}:${value}`,
      difficulty,
    };
  },
  verify({ kind, known, area }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    // 답을 넣어 넓이를 다시 계산한다. 나눗셈을 피하려고 두 배끼리 비교한다.
    if (kind === 'parallelogram') return known[0] * v === area;
    if (kind === 'trapezoid') return (known[0] + known[1]) * v === area * 2;
    return known[0] * v === area * 2;
  },
};

/** ro 는 원주율을 읽은 소리(삼, 삼 점 일, 삼 점 일사) 뒤에 붙는 조사다. */
const PI = {
  1: { h: 300, text: '3', ro: '으로' },
  2: { h: 310, text: '3.1', ro: '로' },
  3: { h: 314, text: '3.14', ro: '로' },
};

const circleMeasure = {
  id: 'math.g56.rm.s03-16.circle-measure',
  standardCode: '[6수03-16]',
  skill: '원주율을 이용하여 원주, 지름, 원의 넓이 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const pi = PI[difficulty];
    const kind = rng.pick(['circumference', 'diameter', 'radius', 'area']);
    const r = rng.int(1, difficulty === 1 ? 50 : difficulty === 2 ? 99 : 150);
    const d = 2 * r;
    if (kind === 'circumference') {
      const fromRadius = rng.bool();
      const value = fmtHundredths(d * pi.h);
      return {
        params: { kind, pi: pi.h, d },
        instruction: `원주율은 ${pi.text}${pi.ro} 계산하시오.`,
        stem: `${fromRadius ? `반지름이 ${r}cm` : `지름이 ${d}cm`}인 원의 원주는 몇 cm입니까?`,
        answer: { value, display: `${value}cm`, accepts: [value, `${value}cm`] },
        solution: ['원주는 (지름) × (원주율)이다.', `${d} × ${pi.text} = ${value}이므로 ${value}cm이다.`],
        dedupeKey: `circle:circ:${fromRadius ? 'r' : 'd'}:${r}:${pi.text}`,
        difficulty,
      };
    }
    if (kind === 'diameter') {
      const c = fmtHundredths(d * pi.h);
      return {
        params: { kind, pi: pi.h, circumference: c },
        instruction: `원주율은 ${pi.text}${pi.ro} 계산하시오.`,
        stem: `원주가 ${c}cm인 원의 지름은 몇 cm입니까?`,
        answer: { value: d, display: `${d}cm`, accepts: [num(d), `${d}cm`] },
        solution: ['지름은 (원주) ÷ (원주율)이다.', `${c} ÷ ${pi.text} = ${d}이므로 ${d}cm이다.`],
        dedupeKey: `circle:diam:${d}:${pi.text}`,
        difficulty,
      };
    }
    if (kind === 'radius') {
      const c = fmtHundredths(d * pi.h);
      return {
        params: { kind, pi: pi.h, circumference: c },
        instruction: `원주율은 ${pi.text}${pi.ro} 계산하시오.`,
        stem: `원주가 ${c}cm인 원의 반지름은 몇 cm입니까?`,
        answer: { value: r, display: `${r}cm`, accepts: [num(r), `${r}cm`] },
        solution: [`지름은 ${c} ÷ ${pi.text} = ${d}cm이다.`, `반지름은 지름의 반이므로 ${d} ÷ 2 = ${r}cm이다.`],
        dedupeKey: `circle:radius:${r}:${pi.text}`,
        difficulty,
      };
    }
    const value = fmtHundredths(r * r * pi.h);
    // 지름을 주면 반지름을 먼저 구해야 한다.
    const fromDiameter = rng.bool();
    return {
      params: { kind, pi: pi.h, r },
      instruction: `원주율은 ${pi.text}${pi.ro} 계산하시오.`,
      stem: `${fromDiameter ? `지름이 ${d}cm` : `반지름이 ${r}cm`}인 원의 넓이는 몇 cm²입니까?`,
      answer: { value, display: `${value}cm²`, accepts: [value, `${value}cm²`] },
      solution: ['원의 넓이는 (반지름) × (반지름) × (원주율)이다.', `${r} × ${r} × ${pi.text} = ${value}이므로 ${value}cm²이다.`],
      dedupeKey: `circle:area:${fromDiameter ? 'd:' : ''}${r}:${pi.text}`,
      difficulty,
    };
  },
  verify(params, answer) {
    if (params.kind === 'diameter') {
      // 지름에 원주율을 곱하면 주어진 원주가 되어야 한다.
      const v = answer.value;
      return Number.isInteger(v) && v * params.pi === parseHundredths(params.circumference);
    }
    if (params.kind === 'radius') {
      // 반지름의 두 배에 원주율을 곱하면 주어진 원주가 되어야 한다.
      const v = answer.value;
      return Number.isInteger(v) && v > 0 && 2 * v * params.pi === parseHundredths(params.circumference);
    }
    const h = parseHundredths(answer.value);
    if (h === null) return false;
    // 답을 원주율로 나누어 지름(또는 반지름의 제곱)이 정수로 되돌아오는지 본다.
    if (params.kind === 'circumference') return h % params.pi === 0 && h / params.pi === params.d;
    return h % params.pi === 0 && h / params.pi === params.r * params.r;
  },
};

const volumeInverse = {
  id: 'math.g56.rm.s03-19.volume-inverse',
  standardCode: '[6수03-19]',
  skill: '부피를 알 때 직육면체의 모서리 길이 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    // 정육면체는 세 번 곱해 부피가 되는 수를 어림해야 해서 더 어렵다. 난이도 2·3에만 둔다.
    const cube = difficulty !== 1 && rng.int(0, 3) === 0;
    const cap = cube ? 12 : difficulty === 3 ? 25 : 12;
    const w = rng.int(2, cap);
    const l = cube ? w : rng.int(2, cap);
    const h = cube ? w : rng.int(2, cap);
    const volume = w * l * h;
    return {
      params: { volume, known: cube ? null : [w, l] },
      instruction: '물음에 답하시오.',
      stem: cube
        ? `부피가 ${volume}cm³인 정육면체의 한 모서리는 몇 cm입니까?`
        : `부피가 ${volume}cm³이고 가로가 ${w}cm, 세로가 ${l}cm인 직육면체의 높이는 몇 cm입니까?`,
      answer: { value: h, display: `${h}cm`, accepts: [num(h), `${h}cm`] },
      solution: cube
        ? ['정육면체의 부피는 (한 모서리) × (한 모서리) × (한 모서리)이다.', `${h} × ${h} × ${h} = ${volume}이므로 ${h}cm이다.`]
        : ['직육면체의 부피는 (가로) × (세로) × (높이)이다.', `${volume} ÷ (${w} × ${l}) = ${h}이므로 높이는 ${h}cm이다.`],
      dedupeKey: `volume-inv:${cube ? 'cube' : 'cuboid'}:${w}:${l}:${h}`,
      difficulty,
    };
  },
  verify({ volume, known }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    return known === null ? v * v * v === volume : known[0] * known[1] * v === volume;
  },
};

export const generators = [
  gcdStory,
  lcmStory,
  multiplesInRange,
  equivalentBlank,
  mixedAddSubUnlike,
  mixedTimes,
  shareStory,
  mixedDivide,
  compareFractionDecimal,
  decimalToFraction,
  ruleTable,
  percentProblems,
  ratioShare,
  perimeterInverse,
  rectangleInverse,
  areaInverse,
  circleMeasure,
  volumeInverse,
];
