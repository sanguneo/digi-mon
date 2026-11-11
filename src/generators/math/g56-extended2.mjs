/**
 * 2022 개정 초등 수학 5~6학년군 확장 문항 생성기 (2차).
 *
 * 1차 확장에 없던 문항 유형을 더한다. 평균 문장제(기록의 평균, 다음 시험 점수, 두 모둠 비교,
 * 나머지 날의 평균), 띠그래프·원그래프 해석, 표를 여러 단계로 해석하기, 실험 결과로 가능성
 * 판단하기, 비례식 문장제와 소수·분수가 든 비례식, 상황에서 비 쓰기, 비율 문장제(타율·진하기·
 * 할인율·증가율·이자율), 비례배분의 역문제, 대응표의 역문제, 범위에 드는 자연수 세기, 어림 문장제,
 * 분모가 다른 분수의 크기 비교, 분수·소수 계산 문장제, (자연수)÷(자연수)의 몫을 소수로 나타내기,
 * 혼합 계산 문장제, 겉넓이·부피의 역문제와 단위 환산, 여러 도형을 합치거나 뺀 넓이, 직선으로 둘러싸인
 * 복합 도형의 둘레, 넓이 단위 문장제, 원주와 원의 넓이 활용이다.
 *
 * verify 는 generate 와 다른 경로(역연산, 대입, 다시 세기, 교차 곱)로 답을 확인한다.
 */
import {
  fractionParticle, josaEul, josaEun, josaI, numberParticle, numEul, numRo, particle, particleRo, sinoKoreanLarge,
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
const sumOf = (arr) => arr.reduce((s, v) => s + v, 0);

/** 기약분수·대분수·자연수 중 알맞은 꼴의 문자열. */
function fmtRational(n, d) {
  const g = gcd(n, d);
  const rn = n / g;
  const rd = d / g;
  if (rd === 1) return `${rn}`;
  if (rn < rd) return `${rn}/${rd}`;
  return `${Math.floor(rn / rd)} ${rn % rd}/${rd}`;
}

/** 기약 꼴로 쓴 답만 읽는다. 약분하지 않았거나 대분수로 바꾸지 않은 답은 null. */
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
  m = /^(0|[1-9]\d*)$/.exec(t);
  return m ? { n: Number(t), d: 1 } : null;
}

const mixedText = (w, n, d) => (w === 0 ? `${n}/${d}` : n === 0 ? `${w}` : `${w} ${n}/${d}`);
/** {n, d} 가분수를 대분수 표기로. 약분은 하지 않는다(문제에 주어진 꼴 그대로). */
const fracText = ({ n, d }) => (n % d === 0 ? `${n / d}` : n < d ? `${n}/${d}` : `${Math.floor(n / d)} ${n % d}/${d}`);

/** 10^scale 단위 정수를 소수 문자열로. 끝의 0 은 쓰지 않는다. */
function fmtDec(units, scale) {
  const s = String(units).padStart(scale + 1, '0');
  const w = s.slice(0, s.length - scale);
  const f = s.slice(s.length - scale).replace(/0+$/, '');
  return f ? `${w}.${f}` : w;
}

/** 소수 표기를 엄격히 읽는다. 끝의 0, 앞의 0, 단위가 붙은 답은 null. */
function parseDec(text) {
  const m = /^(0|[1-9]\d*)(?:\.(\d*[1-9]))?$/.exec(String(text));
  if (!m) return null;
  const f = m[2] ?? '';
  return { units: Number(m[1] + f), scale: f.length };
}

/** 소수 뒤 조사. 소수는 마지막 숫자를 마지막에 읽는다(2.5 -> 이 점 오). */
const decParticle = (t, withJong, withoutJong) => (String(t).includes('.')
  ? numberParticle(Number(String(t).at(-1)), withJong, withoutJong)
  : numberParticle(Number(t), withJong, withoutJong));
const decRo = (t) => `${t}${particleRo(sinoKoreanLarge(Number(String(t).includes('.') ? String(t).at(-1) : t)))}`;

/** [lo, hi] 에서 avoid 에 없는 정수 하나. 무작위 시작점에서 차례로 훑어 반드시 끝난다. */
function intAvoid(rng, lo, hi, avoid) {
  const span = hi - lo + 1;
  const start = rng.int(0, span - 1);
  for (let i = 0; i < span; i += 1) {
    const v = lo + ((start + i) % span);
    if (!avoid.includes(v)) return v;
  }
  throw new Error(`intAvoid: ${lo}..${hi} 에 후보가 없다`);
}

/** 서로 다르고 서로소인 두 수. */
function coprimePair(rng, lo, hi) {
  const a = rng.int(lo, hi);
  const cands = [];
  for (let b = lo; b <= hi; b += 1) if (b !== a && gcd(a, b) === 1) cands.push(b);
  return [a, rng.pick(cands)];
}

/** 기약인 진분수 {n, d}. */
function properFraction(rng, dLo, dHi) {
  const d = rng.int(dLo, dHi);
  const ns = [];
  for (let n = 1; n < d; n += 1) if (gcd(n, d) === 1) ns.push(n);
  return { n: rng.pick(ns), d };
}

/** 대분수 {n, d} (가분수 분자). 분수 부분은 기약이다. */
function mixedFraction(rng, dLo, dHi, wLo, wHi) {
  const f = properFraction(rng, dLo, dHi);
  return { n: rng.int(wLo, wHi) * f.d + f.n, d: f.d };
}

const NAMES = ['지우', '민준', '서연', '하준', '수아', '도윤', '예린', '시우', '은호', '다인'];

// ---------------------------------------------------------------------------
// [6수04-01] 평균
// ---------------------------------------------------------------------------

const RECORD_SCENES = [
  { what: '줄넘기 기록', unit: '회' },
  { what: '윗몸 말아 올리기 기록', unit: '회' },
  { what: '한 달 동안 읽은 책의 쪽수', unit: '쪽' },
  { what: '모은 빈 병의 수', unit: '개' },
  { what: '공 던지기 기록', unit: 'm' },
];

const averageRecords = {
  id: 'math.g56.rm.s04-01.average-records',
  standardCode: '[6수04-01]',
  skill: '여러 사람의 기록으로 평균 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const n = difficulty === 1 ? rng.int(4, 5) : difficulty === 2 ? rng.int(5, 6) : rng.pick([4, 5]);
    const [lo, hi] = difficulty === 1 ? [10, 60] : difficulty === 2 ? [100, 400] : [100, 999];
    const values = Array.from({ length: n }, () => rng.int(lo, hi));
    if (difficulty !== 3) {
      // 평균이 자연수가 되도록 마지막 기록을 조정한다.
      const r = sumOf(values) % n;
      if (r) values[n - 1] = values[n - 1] - r >= lo ? values[n - 1] - r : values[n - 1] + n - r;
    }
    // 평균이 주어진 기록 중 하나와 같으면 답이 문제에 드러난다. 한 기록을 n만큼 늘려 평균을 1 옮긴다.
    for (let guard = 0; guard <= n + 1; guard += 1) {
      const s = sumOf(values);
      if (s % n !== 0 || !values.includes(s / n)) break;
      values[0] += n;
    }
    const sum = sumOf(values);
    const units = (sum * 100) / n; // n 이 4·5·6 이므로 d1·d2 는 자연수, d3 는 소수 두 자리 이내
    // 공 던지기 기록은 수십 m 안에서만 쓴다.
    const s = rng.pick(RECORD_SCENES.filter((x) => difficulty === 1 || x.unit !== 'm'));
    const name = rng.pick(NAMES);
    const text = difficulty === 3 ? fmtDec(units, 2) : num(sum / n);
    const value = difficulty === 3 ? text : sum / n;
    return {
      params: { values, n },
      instruction: '물음에 답하시오.',
      stem: `${name}네 모둠 학생 ${n}명의 ${s.what}${josaEun(s.what)} ${values.map((v) => `${v}${s.unit}`).join(', ')}입니다.`
        + ` ${s.what}의 평균은 몇 ${s.unit}입니까?`,
      answer: { value, display: `${text}${s.unit}`, accepts: [text, `${text}${s.unit}`] },
      solution: [
        `기록의 합은 ${values.join(' + ')} = ${sum}이다.`,
        `학생이 ${n}명이므로 평균은 ${sum} ÷ ${n} = ${text}${s.unit}이다.`,
      ],
      dedupeKey: `avg-records:${values.join('-')}`,
      difficulty,
    };
  },
  verify({ values, n }, answer) {
    if (typeof answer.value === 'number' && !Number.isInteger(answer.value)) return false;
    const p = parseDec(String(answer.value));
    if (p === null) return false;
    // 평균 × 사람 수가 기록의 합과 같아야 한다.
    let total = 0;
    for (const v of values) total += v;
    return values.length === n && p.units * n === total * 10 ** p.scale;
  },
};

const averageTarget = {
  id: 'math.g56.rm.s04-01.average-target',
  standardCode: '[6수04-01]',
  skill: '목표 평균을 이루려면 다음에 받아야 할 점수 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const name = rng.pick(NAMES);
    if (difficulty !== 1 && rng.int(0, 3) === 0) {
      const k = rng.int(3, 6);
      const A = rng.int(60, 100 - (k + 1));
      const r = rng.int(1, Math.floor((100 - A) / (k + 1)));
      const need = A + r * (k + 1);
      return {
        params: { kind: 'raise', k, A, r },
        instruction: '물음에 답하시오.',
        stem: `${name}${josaEun(name)} 지금까지 수학 시험을 ${k}번 보았고 평균 점수는 ${A}점입니다.`
          + ` 다음 시험을 보고 평균 점수를 ${r}점 올리려면 다음 시험에서 몇 점을 받아야 합니까?`,
        answer: { value: need, display: `${need}점`, accepts: [num(need), `${need}점`] },
        solution: [
          `지금까지 점수의 합은 ${A} × ${k} = ${A * k}점이다.`,
          `${k + 1}번의 평균이 ${A + r}점이 되려면 합이 ${A + r} × ${k + 1} = ${(A + r) * (k + 1)}점이어야 한다.`,
          `따라서 ${(A + r) * (k + 1)} - ${A * k} = ${need}점을 받아야 한다.`,
        ],
        dedupeKey: `avg-raise:${k}:${A}:${r}`,
        difficulty,
      };
    }
    const k = difficulty === 1 ? 2 : difficulty === 2 ? 3 : rng.int(4, 5);
    const lo = difficulty === 1 ? 60 : difficulty === 2 ? 50 : 40;
    const scores = Array.from({ length: k }, () => rng.int(lo, 100));
    const S = sumOf(scores);
    const cands = [];
    for (let T = Math.ceil((S + 40) / (k + 1)); T <= Math.floor((S + 100) / (k + 1)); T += 1) {
      const need = T * (k + 1) - S;
      if (!scores.includes(need) && need !== T) cands.push(T);
    }
    const T = rng.pick(cands);
    const need = T * (k + 1) - S;
    return {
      params: { kind: 'target', scores, T, sum: S },
      instruction: '물음에 답하시오.',
      stem: `${name}의 수학 시험 점수는 ${scores.map((v) => `${v}점`).join(', ')}입니다.`
        + ` 다음 시험까지 ${k + 1}번의 평균 점수가 ${T}점이 되려면 다음 시험에서 몇 점을 받아야 합니까?`,
      answer: { value: need, display: `${need}점`, accepts: [num(need), `${need}점`] },
      solution: [
        `${k + 1}번의 평균이 ${T}점이 되려면 점수의 합이 ${T} × ${k + 1} = ${T * (k + 1)}점이어야 한다.`,
        `지금까지 점수의 합은 ${scores.join(' + ')} = ${S}점이므로 ${T * (k + 1)} - ${S} = ${need}점을 받아야 한다.`,
      ],
      dedupeKey: `avg-target:${scores.join('-')}:${T}`,
      difficulty,
    };
  },
  verify(params, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v < 0 || v > 100) return false;
    if (params.kind === 'raise') {
      const { k, A, r } = params;
      return A * k + v === (A + r) * (k + 1);
    }
    // 받은 점수를 하나씩 더한 뒤 평균을 다시 낸다.
    let total = v;
    for (const s of params.scores) total += s;
    return total === params.T * (params.scores.length + 1);
  },
};

const GROUP_SCENES = [
  { what: '줄넘기 기록', unit: '회', maxAvg: 999 },
  { what: '제기차기 기록', unit: '회', maxAvg: 999 },
  { what: '수학 점수', unit: '점', maxAvg: 100 },
];

/** a 에서 step 의 0 아닌 배수만큼 떨어지고 [lo, hi] 에 드는 수 하나. */
function shiftedInRange(rng, a, step, lo, hi) {
  const cands = [];
  for (let t = -Math.floor((hi - lo) / step); t <= Math.floor((hi - lo) / step); t += 1) {
    const v = a + step * t;
    if (t !== 0 && v >= lo && v <= hi) cands.push(v);
  }
  return rng.pick(cands);
}

const averageGroups = {
  id: 'math.g56.rm.s04-01.average-groups',
  standardCode: '[6수04-01]',
  skill: '두 모둠의 평균을 비교하거나 합치고, 평균으로 나머지 부분의 평균 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = difficulty === 1 ? 'compare' : difficulty === 2 ? rng.pick(['compare', 'combined']) : rng.pick(['combined', 'remaining']);
    const [lo, hi] = difficulty === 1 ? [10, 60] : difficulty === 2 ? [20, 95] : [40, 250];
    const s = rng.pick(GROUP_SCENES.filter((g) => g.maxAvg >= hi));
    if (kind === 'compare') {
      const n1 = rng.int(3, difficulty === 1 ? 6 : 9);
      const n2 = rng.int(3, difficulty === 1 ? 6 : 9);
      const a1 = rng.int(lo, hi);
      const a2 = intAvoid(rng, lo, hi, [a1, a1 + n1, a1 - n1, a1 + n2, a1 - n2]);
      const [t1, t2] = [a1 * n1, a2 * n2];
      const diff = Math.abs(a1 - a2);
      const winner = a1 > a2 ? '가' : '나';
      return {
        params: { kind, n1, n2, t1, t2 },
        instruction: '물음에 답하시오.',
        stem: `가 모둠 ${n1}명의 ${s.what} 합계는 ${t1}${s.unit}이고, 나 모둠 ${n2}명의 ${s.what} 합계는 ${t2}${s.unit}입니다.`
          + ` 평균이 더 높은 모둠은 다른 모둠보다 평균이 몇 ${s.unit} 더 높습니까?`,
        answer: { value: diff, display: `${diff}${s.unit}`, accepts: [num(diff), `${diff}${s.unit}`] },
        solution: [
          `가 모둠의 평균은 ${t1} ÷ ${n1} = ${a1}${s.unit}이고, 나 모둠의 평균은 ${t2} ÷ ${n2} = ${a2}${s.unit}이다.`,
          `${winner} 모둠의 평균이 ${Math.max(a1, a2)} - ${Math.min(a1, a2)} = ${diff}${s.unit} 더 높다.`,
        ],
        dedupeKey: `avg-groups:compare:${n1}:${t1}:${n2}:${t2}`,
        difficulty,
      };
    }
    if (kind === 'combined') {
      const n1 = rng.int(3, difficulty === 2 ? 12 : 20);
      const n2 = rng.int(3, difficulty === 2 ? 12 : 20);
      const a1 = rng.int(lo, hi);
      // 전체 평균이 자연수가 되려면 (n1 + n2) 가 n2 × (a2 - a1) 을 나누어야 한다.
      const a2 = shiftedInRange(rng, a1, (n1 + n2) / gcd(n2, n1 + n2), lo, hi);
      const M = a1 + (n2 * (a2 - a1)) / (n1 + n2);
      const tot = a1 * n1 + a2 * n2;
      return {
        params: { kind, n1, n2, a1, a2 },
        instruction: '물음에 답하시오.',
        stem: `가 모둠 ${n1}명의 ${s.what} 평균은 ${a1}${s.unit}이고, 나 모둠 ${n2}명의 ${s.what} 평균은 ${a2}${s.unit}입니다.`
          + ` 두 모둠 학생 전체의 ${s.what} 평균은 몇 ${s.unit}입니까?`,
        answer: { value: M, display: `${M}${s.unit}`, accepts: [num(M), `${M}${s.unit}`] },
        solution: [
          `가 모둠의 합계는 ${a1} × ${n1} = ${a1 * n1}, 나 모둠의 합계는 ${a2} × ${n2} = ${a2 * n2}이다.`,
          `전체 합계 ${numEul(tot)} 전체 학생 수 ${numRo(n1 + n2)} 나누면 ${M}${s.unit}이다.`,
        ],
        dedupeKey: `avg-groups:combined:${n1}:${a1}:${n2}:${a2}`,
        difficulty,
      };
    }
    const n = rng.int(6, 20);
    const m = rng.int(2, n - 2);
    const r = n - m;
    const y = rng.int(lo, hi);
    const z = shiftedInRange(rng, y, n / gcd(r, n), lo, hi);
    const x = y + (r * (z - y)) / n;
    const name = rng.pick(NAMES);
    const rest = x * n - y * m;
    return {
      params: { kind, n, m, x, y },
      instruction: '물음에 답하시오.',
      stem: `${name}${josaEun(name)} ${n}일 동안 책을 하루 평균 ${x}쪽씩 읽었습니다.`
        + ` 처음 ${m}일 동안 하루 평균 ${y}쪽씩 읽었다면, 나머지 날에는 하루 평균 몇 쪽씩 읽었습니까?`,
      answer: { value: z, display: `${z}쪽`, accepts: [num(z), `${z}쪽`] },
      solution: [
        `${n}일 동안 읽은 쪽수는 ${x} × ${n} = ${x * n}쪽이다.`,
        `처음 ${m}일 동안 읽은 쪽수는 ${y} × ${m} = ${y * m}쪽이다.`,
        `나머지 ${r}일 동안 ${x * n} - ${y * m} = ${rest}쪽을 읽었으므로 하루 평균 ${rest} ÷ ${r} = ${z}쪽이다.`,
      ],
      dedupeKey: `avg-groups:remaining:${n}:${x}:${m}:${y}`,
      difficulty,
    };
  },
  verify(params, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    if (params.kind === 'compare') {
      // 두 평균의 차를 분모를 맞추어 비교한다: |t1/n1 - t2/n2| = v
      const { n1, n2, t1, t2 } = params;
      return Math.abs(t1 * n2 - t2 * n1) === v * n1 * n2;
    }
    if (params.kind === 'combined') {
      const { n1, n2, a1, a2 } = params;
      return v * (n1 + n2) === a1 * n1 + a2 * n2;
    }
    const { n, m, x, y } = params;
    return v * (n - m) + y * m === x * n;
  },
};

// ---------------------------------------------------------------------------
// [6수04-02] 띠그래프·원그래프 해석 · [6수04-03] 표를 여러 단계로 해석하기
// ---------------------------------------------------------------------------

const SURVEY_TOPICS = [
  { topic: '운동', cats: ['축구', '야구', '농구', '배구', '수영'] },
  { topic: '과일', cats: ['사과', '포도', '귤', '딸기', '수박'] },
  { topic: '음식', cats: ['김밥', '떡볶이', '피자', '치킨', '라면'] },
  { topic: '계절', cats: ['봄', '여름', '가을', '겨울'] },
];

/** 합이 100이 되는 n개의 백분율. 모두 step 의 배수이고 step 이상이다. */
function makePercents(rng, n, step) {
  const M = 100 / step;
  const cuts = rng.shuffle(Array.from({ length: M - 1 }, (_, i) => i + 1)).slice(0, n - 1).sort((a, b) => a - b);
  const pts = [0, ...cuts, M];
  return pts.slice(1).map((p, i) => (p - pts[i]) * step);
}

const bandGraphRead = {
  id: 'math.g56.rm.s04-02.band-graph-read',
  standardCode: '[6수04-02]',
  skill: '띠그래프·원그래프의 백분율로 항목의 수, 차, 배, 전체 수, 띠의 길이 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const build = () => {
      const n = difficulty === 1 ? 4 : difficulty === 2 ? rng.int(4, 5) : 5;
      const step = difficulty === 1 ? 5 : difficulty === 2 ? rng.pick([1, 5]) : 1;
      const p = makePercents(rng, n, step);
      const T = step === 5
        ? 20 * intAvoid(rng, 2, difficulty === 1 ? 30 : 100, [5])
        : 100 * rng.int(2, difficulty === 2 ? 30 : 50);
      const kinds = difficulty === 1 ? ['count', 'missing'] : difficulty === 2 ? ['count', 'diff', 'times', 'length'] : ['total', 'times', 'diff', 'length'];
      let kind = rng.pick(kinds);
      const i = rng.int(0, n - 1);
      const pairs = [];
      for (let a = 0; a < n; a += 1) {
        for (let b = 0; b < n; b += 1) {
          if (p[a] > p[b] && (kind !== 'times' || (p[a] % p[b] === 0 && p[a] / p[b] >= 2))) pairs.push([a, b]);
        }
      }
      if ((kind === 'diff' || kind === 'times') && pairs.length === 0) kind = 'count';
      const [pi, pj] = kind === 'diff' || kind === 'times' ? rng.pick(pairs) : [i, -1];
      const L = kind === 'length' ? rng.int(10, difficulty === 2 ? 40 : 60) : 0;
      return { n, p, T, kind, i: pi, j: pj, L };
    };
    const answerOf = ({ p, T, kind, i, j, L }) => {
      if (kind === 'count') return (T * p[i]) / 100;
      if (kind === 'missing') return p[i];
      if (kind === 'diff') return (T * (p[i] - p[j])) / 100;
      if (kind === 'times') return p[i] / p[j];
      if (kind === 'length') return Number(fmtDec(L * p[i], 2));
      return T;
    };
    const stated = ({ p, T, kind, i, L }) => [
      ...p.filter((_, k) => kind !== 'missing' || k !== i),
      ...(kind === 'total' ? [(T * p[i]) / 100] : [T]),
      ...(L ? [L] : []),
    ];
    // 답이 문제에 주어진 수와 같으면 다시 만든다. 대부분 한 번에 통과한다.
    const c = rng.until(build, (x) => !stated(x).includes(answerOf(x)) && !(x.kind === 'missing' && x.p.filter((v) => v === x.p[x.i]).length > 1), 60);
    const { n, p, T, kind, i, j, L } = c;
    const t = rng.pick(SURVEY_TOPICS.filter((x) => x.cats.length >= n));
    const cats = t.cats.slice(0, n);
    const graph = kind === 'length' ? '띠그래프' : rng.pick(['띠그래프', '원그래프']);
    const list = cats.map((name, k) => (kind === 'missing' && k === i ? `${name} □%` : `${name} ${p[k]}%`)).join(', ');
    const ci = cats[i];
    const cj = j >= 0 ? cats[j] : '';
    const who = kind === 'total' ? '학생들이' : `학생 ${T}명이`;
    const head = `${who} 좋아하는 ${t.topic}${josaEul(t.topic)} 조사하여 ${graph}로 나타냈습니다. 각 항목의 백분율은 ${list}입니다.`;
    const v = kind === 'length' ? fmtDec(L * p[i], 2) : answerOf(c);
    let question;
    let unit;
    let solution;
    if (kind === 'count') {
      question = `${ci}${josaEul(ci)} 좋아하는 학생은 몇 명입니까?`;
      unit = '명';
      solution = [`${ci}${josaEun(ci)} 전체의 ${p[i]}%이다.`, `${T} × ${p[i]}/100 = ${v}이므로 ${v}명이다.`];
    } else if (kind === 'missing') {
      question = `${ci}${josaEul(ci)} 좋아하는 학생은 전체의 몇 %입니까?`;
      unit = '%';
      solution = ['모든 항목의 백분율을 더하면 100%이다.', `100 - (${p.filter((_, k) => k !== i).join(' + ')}) = ${v}이므로 ${v}%이다.`];
    } else if (kind === 'diff') {
      question = `${ci}${josaEul(ci)} 좋아하는 학생은 ${cj}${josaEul(cj)} 좋아하는 학생보다 몇 명 더 많습니까?`;
      unit = '명';
      solution = [
        `두 항목의 백분율 차는 ${p[i]} - ${p[j]} = ${p[i] - p[j]}(%)이다.`,
        `${T} × ${p[i] - p[j]}/100 = ${v}이므로 ${v}명 더 많다.`,
      ];
    } else if (kind === 'times') {
      question = `${ci}${josaEul(ci)} 좋아하는 학생 수는 ${cj}${josaEul(cj)} 좋아하는 학생 수의 몇 배입니까?`;
      unit = '배';
      solution = ['전체가 같으므로 학생 수의 비는 백분율의 비와 같다.', `${p[i]} ÷ ${p[j]} = ${v}이므로 ${v}배이다.`];
    } else if (kind === 'length') {
      question = `띠그래프의 전체 길이가 ${L}cm라면 ${ci}${josaI(ci)} 차지하는 부분의 길이는 몇 cm입니까?`;
      unit = 'cm';
      solution = [`${ci}${josaEun(ci)} 띠 전체 길이의 ${p[i]}%를 차지한다.`, `${L} × ${p[i]}/100 = ${v}이므로 ${v}cm이다.`];
    } else {
      const cnt = (T * p[i]) / 100;
      question = `${ci}${josaEul(ci)} 좋아하는 학생이 ${cnt}명이라면 조사한 학생은 모두 몇 명입니까?`;
      unit = '명';
      solution = [`${cnt}명이 전체의 ${p[i]}%이므로 전체의 1%는 ${cnt} ÷ ${p[i]}명이다.`, `전체는 ${cnt} ÷ ${p[i]} × 100 = ${v}명이다.`];
    }
    return {
      params: { kind, p, T, i, j, L },
      instruction: '물음에 답하시오.',
      stem: `${head} ${question}`,
      answer: { value: v, display: `${v}${unit}`, accepts: [num(v), `${v}${unit}`] },
      solution,
      dedupeKey: `band-read:${kind}:${p.join('-')}:${kind === 'missing' || kind === 'times' ? '' : T}:${i}:${j}:${L}`,
      difficulty,
    };
  },
  verify({ kind, p, T, i, j, L }, answer) {
    if (kind === 'length') {
      const q = parseDec(answer.value);
      // 띠의 길이를 전체 길이로 나누어 백분율이 되돌아오는지 본다.
      return q !== null && q.units * 100 === L * p[i] * 10 ** q.scale;
    }
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    if (kind === 'count') return v * 100 === T * p[i];
    if (kind === 'missing') {
      let total = v;
      for (let k = 0; k < p.length; k += 1) if (k !== i) total += p[k];
      return total === 100;
    }
    if (kind === 'diff') return v * 100 === T * (p[i] - p[j]);
    if (kind === 'times') return v * p[j] === p[i];
    return v * p[i] === ((T * p[i]) / 100) * 100;
  },
};

const TABLE_TOPICS = [
  {
    intro: '마을별 쌀 생산량', rowLabel: '마을', cats: ['해솔', '바다', '하늘', '들꽃', '솔빛'], valueLabel: '생산량(t)',
    unit: 't', measure: '쌀 생산량', place: '마을', counter: '곳', name: (c) => `${c} 마을`,
  },
  {
    intro: '월별 도서관 방문자 수', rowLabel: '월', cats: ['3월', '4월', '5월', '6월', '7월'], valueLabel: '방문자 수(명)',
    unit: '명', measure: '방문자 수', place: '달', counter: '달', name: (c) => c,
  },
  {
    intro: '반별로 모은 빈 병의 수', rowLabel: '반', cats: ['1반', '2반', '3반', '4반', '5반'], valueLabel: '빈 병의 수(개)',
    unit: '개', measure: '빈 병의 수', place: '반', counter: '반', name: (c) => c,
  },
];

const tableGraphSteps = {
  id: 'math.g56.rm.s04-03.table-steps',
  standardCode: '[6수04-03]',
  skill: '조사한 자료의 표를 보고 여러 단계로 해석하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kinds = difficulty === 1 ? ['max-min', 'above-avg'] : difficulty === 2 ? ['above-avg', 'percent', 'total-change'] : ['percent', 'increase'];
    const kind = rng.pick(kinds);
    const t = rng.pick(TABLE_TOPICS);
    const n = difficulty === 1 ? 4 : 5;
    const cats = t.cats.slice(0, n);
    const twoRows = kind === 'total-change' || kind === 'increase';
    const build = () => {
      const [lo, hi] = difficulty === 1 ? [10, 99] : difficulty === 2 ? [20, 500] : [40, 999];
      if (kind === 'percent') {
        const p = makePercents(rng, n, rng.pick([1, 5]));
        const T = 100 * rng.int(2, difficulty === 2 ? 20 : 60);
        const i = rng.int(0, n - 1);
        return { rows: [p.map((x) => (x * T) / 100)], i, v: p[i] };
      }
      if (kind === 'increase') {
        const i = rng.int(0, n - 1);
        const old = Array.from({ length: n }, () => rng.int(lo, hi));
        old[i] = 20 * rng.int(2, 50);
        const r = 5 * rng.int(1, 12);
        const now = old.map((o, k) => (k === i ? (o * (100 + r)) / 100 : o + rng.int(-Math.floor(o / 5), Math.floor(o / 3))));
        return { rows: [old, now], i, v: r };
      }
      const values = Array.from({ length: n }, () => rng.int(lo, hi));
      if (kind === 'max-min') return { rows: [values], i: -1, v: Math.max(...values) - Math.min(...values) };
      if (kind === 'above-avg') {
        const r = sumOf(values) % n;
        if (r) values[n - 1] = values[n - 1] - r >= lo ? values[n - 1] - r : values[n - 1] + n - r;
        const avg = sumOf(values) / n;
        return { rows: [values], i: -1, v: values.filter((x) => x > avg).length, avg };
      }
      const now = values.map((o) => o + rng.int(-Math.floor(o / 5), Math.floor(o / 2)));
      return { rows: [values, now], i: -1, v: sumOf(now) - sumOf(values) };
    };
    const c = rng.until(build, (x) => x.v > 0 && !x.rows.flat().includes(x.v) && x.rows.flat().every((y) => y > 0), 80);
    const { rows, i, v } = c;
    const tableText = twoRows
      ? `${t.rowLabel} | ${cats.join(' | ')}\n작년 ${t.valueLabel} | ${rows[0].join(' | ')}\n올해 ${t.valueLabel} | ${rows[1].join(' | ')}`
      : `${t.rowLabel} | ${cats.join(' | ')}\n${t.valueLabel} | ${rows[0].join(' | ')}`;
    const lead = twoRows ? `${t.intro}${josaEul(t.intro)} 작년과 올해 조사하여 표로 나타냈습니다.` : `${t.intro}${josaEul(t.intro)} 조사하여 표로 나타냈습니다.`;
    const ci = i >= 0 ? t.name(cats[i]) : '';
    let question;
    let unit;
    let solution;
    if (kind === 'max-min') {
      question = `${t.measure}${josaI(t.measure)} 가장 많은 ${t.place}${josaGwa(t.place)} 가장 적은 ${t.place}의 차는 몇 ${t.unit}입니까?`;
      unit = t.unit;
      solution = [`가장 많은 값은 ${Math.max(...rows[0])}, 가장 적은 값은 ${Math.min(...rows[0])}이다.`, `${Math.max(...rows[0])} - ${Math.min(...rows[0])} = ${v}이므로 ${v}${t.unit}이다.`];
    } else if (kind === 'above-avg') {
      question = `${t.measure}${josaI(t.measure)} 평균보다 많은 ${t.place}${josaEun(t.place)} 모두 몇 ${t.counter}입니까?`;
      unit = t.counter;
      solution = [
        `평균은 (${rows[0].join(' + ')}) ÷ ${n} = ${c.avg}이다.`,
        `${c.avg}보다 많은 값은 ${rows[0].filter((x) => x > c.avg).join(', ')}이므로 ${v}${t.counter}이다.`,
      ];
    } else if (kind === 'percent') {
      const T = sumOf(rows[0]);
      question = `${ci}의 ${t.measure}${josaEun(t.measure)} 전체의 몇 %입니까?`;
      unit = '%';
      solution = [`전체는 ${rows[0].join(' + ')} = ${T}이다.`, `${rows[0][i]} ÷ ${T} × 100 = ${v}이므로 ${v}%이다.`];
    } else if (kind === 'total-change') {
      question = `올해 전체 ${t.measure}${josaEun(t.measure)} 작년 전체보다 몇 ${t.unit} 늘었습니까?`;
      unit = t.unit;
      solution = [`작년 전체는 ${sumOf(rows[0])}, 올해 전체는 ${sumOf(rows[1])}이다.`, `${sumOf(rows[1])} - ${sumOf(rows[0])} = ${v}이므로 ${v}${t.unit} 늘었다.`];
    } else {
      question = `${ci}의 ${t.measure}${josaEun(t.measure)} 작년보다 몇 % 늘었습니까?`;
      unit = '%';
      solution = [
        `늘어난 양은 ${rows[1][i]} - ${rows[0][i]} = ${rows[1][i] - rows[0][i]}이다.`,
        `작년에 대한 늘어난 양의 비율은 ${rows[1][i] - rows[0][i]} ÷ ${rows[0][i]} × 100 = ${v}이므로 ${v}% 늘었다.`,
      ];
    }
    return {
      params: { kind, rows, i },
      instruction: '표를 보고 물음에 답하시오.',
      stem: `${lead}\n${tableText}\n${question}`,
      answer: { value: v, display: `${v}${unit}`, accepts: [num(v), `${v}${unit}`] },
      solution,
      dedupeKey: `table-steps:${kind}:${rows.map((r) => r.join('-')).join('/')}:${i}`,
      difficulty,
    };
  },
  verify({ kind, rows, i }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    const [a, b] = rows;
    if (kind === 'max-min') {
      // 모든 값이 [최소, 최소 + v] 안에 있고 양 끝이 실제로 나타나야 한다.
      const low = a.reduce((m, x) => (x < m ? x : m), Infinity);
      return a.every((x) => x - low <= v) && a.some((x) => x - low === v);
    }
    if (kind === 'above-avg') {
      let total = 0;
      for (const x of a) total += x;
      // 평균과 비교하는 대신 각 값 × 자료 수와 합을 비교한다.
      return a.filter((x) => x * a.length > total).length === v;
    }
    if (kind === 'percent') {
      let total = 0;
      for (const x of a) total += x;
      return v * total === a[i] * 100;
    }
    if (kind === 'total-change') {
      let diff = 0;
      for (let k = 0; k < a.length; k += 1) diff += b[k] - a[k];
      return diff === v;
    }
    return a[i] * (100 + v) === b[i] * 100;
  },
};

// ---------------------------------------------------------------------------
// [6수04-06] 실험 결과로 가능성 판단하기
// ---------------------------------------------------------------------------

const COLORS = ['빨강', '파랑', '노랑', '초록', '보라'];

const experimentJudge = {
  id: 'math.g56.rm.s04-06.experiment-judge',
  standardCode: '[6수04-06]',
  skill: '실험 결과를 보고 일이 일어날 가능성을 예상하고 판단하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    if (difficulty === 3 || (difficulty === 2 && rng.int(0, 2) === 0)) {
      const n1 = rng.int(20, difficulty === 3 ? 200 : 100);
      const n2 = intAvoid(rng, 20, difficulty === 3 ? 200 : 100, [n1]);
      const a = rng.int(1, n1 - 1);
      let b = rng.int(1, n2 - 1);
      if (a * n2 === b * n1) b = b + 1 < n2 ? b + 1 : b - 1;
      const correct = a * n2 > b * n1 ? '가 회전판' : '나 회전판';
      return {
        params: { kind: 'compare', n1, a, n2, b },
        instruction: '물음에 답하시오.',
        stem: `가 회전판을 ${n1}번 돌렸더니 빨강이 ${a}번 나왔고, 나 회전판을 ${n2}번 돌렸더니 빨강이 ${b}번 나왔습니다.`
          + ' 한 번 더 돌릴 때 빨강이 나올 가능성이 더 높을 것으로 예상되는 회전판은 어느 것입니까?',
        answer: { value: correct, display: correct, accepts: [correct, correct.slice(0, 1)] },
        solution: [
          `돌린 횟수가 다르므로 빨강이 나온 횟수의 비율을 비교한다: 가는 ${a}/${n1}, 나는 ${b}/${n2}이다.`,
          `통분하여 비교하면 ${correct}의 비율이 더 크므로 ${correct}에서 빨강이 나올 가능성이 더 높다고 예상할 수 있다.`,
        ],
        dedupeKey: `experiment:compare:${n1}:${a}:${n2}:${b}`,
        difficulty,
      };
    }
    const k = difficulty === 1 ? 3 : 4;
    const high = difficulty === 1 ? true : rng.bool();
    const colors = rng.shuffle(COLORS).slice(0, k);
    const counts = Array.from({ length: k }, () => rng.int(2, difficulty === 1 ? 30 : 60));
    // 가장 많은(적은) 색이 하나뿐이도록 같은 값을 하나만 남기고 한 칸 옮긴다.
    const ext = high ? Math.max(...counts) : Math.min(...counts);
    let kept = false;
    for (let x = 0; x < k; x += 1) {
      if (counts[x] === ext) {
        if (kept) counts[x] += high ? -1 : 1;
        kept = true;
      }
    }
    const idx = counts.indexOf(ext);
    const N = sumOf(counts);
    const word = high ? '높은' : '낮은';
    const answer = colors[idx];
    return {
      params: { kind: high ? 'high' : 'low', colors, counts },
      instruction: '물음에 답하시오.',
      stem: `회전판을 ${N}번 돌려 화살이 멈춘 색을 조사했더니 ${colors.map((c, x) => `${c} ${counts[x]}번`).join(', ')}이었습니다.`
        + ` 회전판을 한 번 더 돌릴 때 화살이 멈출 가능성이 가장 ${word} 색은 무엇입니까?`,
      answer: { value: answer, display: answer, accepts: [answer] },
      solution: [
        `실험에서 ${high ? '가장 많이' : '가장 적게'} 나온 색은 ${answer}(${ext}번)이다.`,
        `따라서 다음에 화살이 멈출 가능성이 가장 ${word} 색은 ${answer}${particle(answer, '이라고', '라고')} 예상할 수 있다.`,
      ],
      dedupeKey: `experiment:${high ? 'high' : 'low'}:${counts.join('-')}`,
      difficulty,
    };
  },
  verify(params, answer) {
    if (params.kind === 'compare') {
      const { n1, a, n2, b } = params;
      if (answer.value !== '가 회전판' && answer.value !== '나 회전판') return false;
      // 교차 곱으로 비율을 비교한다.
      return answer.value === '가 회전판' ? a * n2 > b * n1 : b * n1 > a * n2;
    }
    const { kind, colors, counts } = params;
    const at = colors.indexOf(answer.value);
    if (at < 0) return false;
    // 고른 색이 다른 모든 색보다 엄격히 많은지(적은지) 하나씩 비교한다.
    return counts.every((c, x) => x === at || (kind === 'high' ? counts[at] > c : counts[at] < c));
  },
};

// ---------------------------------------------------------------------------
// [6수02-01] 대응 관계 · [6수02-02] 비 · [6수02-03] 비율
// ---------------------------------------------------------------------------

const correspondenceInverse = {
  id: 'math.g56.rm.s02-01.correspondence-inverse',
  standardCode: '[6수02-01]',
  skill: '대응표에서 규칙을 찾아 식으로 나타내고 □의 값으로 △의 값 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    // [6수02-01]은 덧셈식·뺄셈식·곱셈식·나눗셈식 가운데 하나로 나타내는 간단한 대응 관계만 다룬다.
    // 난이도는 수의 크기와 나눗셈식으로 커진다.
    const op = rng.pick(difficulty === 1 ? ['+', '-', '×'] : ['+', '-', '×', '÷']);
    const [bLo, bHi] = difficulty === 1 ? [2, 30] : difficulty === 2 ? [10, 99] : [100, 999];
    const [aLo, aHi] = difficulty === 1 ? [2, 9] : difficulty === 2 ? [3, 19] : [11, 40];
    const span = difficulty === 1 ? 80 : difficulty === 2 ? 250 : 600;
    const k = op === '+' || op === '-' ? rng.int(bLo, bHi) : rng.int(aLo, aHi);
    // ÷는 △가 k의 배수인 칸만 쓰므로 □ 쪽 수로 표를 만든다.
    const lo = op === '-' ? k + 1 : 1;
    const start = lo + rng.int(0, difficulty === 3 ? 40 : 8);
    const base = [0, 1, 2, 3].map((j) => start + j);
    const xs = op === '÷' ? base.map((x) => x * k) : base;
    const f = { '+': (x) => x + k, '-': (x) => x - k, '×': (x) => x * k, '÷': (x) => x / k }[op];
    const ys = xs.map(f);
    const pivot = intAvoid(rng, start + 5, start + span, op === '÷' ? [] : ys);
    const X = op === '÷' ? pivot * k : pivot;
    const Y = f(X);
    const inverse = { '+': '-', '-': '+', '×': '÷', '÷': '×' }[op];
    const rule = `□ = △ ${op} ${k}`;
    const back = `△ = □ ${inverse} ${k}이므로 ${Y} ${inverse} ${k} = ${X}이다.`;
    return {
      params: { xs, ys, Y },
      instruction: '표를 보고 물음에 답하시오.',
      stem: `두 양 사이의 대응 관계를 나타낸 표입니다.\n△ | ${xs.join(' | ')}\n□ | ${ys.join(' | ')}\n□가 ${Y}일 때 △는 얼마입니까?`,
      answer: { value: X, display: num(X), accepts: [num(X)] },
      solution: [`△와 □의 대응 관계를 식으로 나타내면 ${rule}이다.`, back],
      dedupeKey: `corr-inv:${op}:${k}:${start}:${X}`,
      difficulty,
    };
  },
  verify({ xs, ys, Y }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    // 표의 모든 칸에서 일정한 차 또는 일정한 몫을 다시 찾아 v를 □로 바꾸어 본다.
    const diff = ys[0] - xs[0];
    if (xs.every((x, j) => ys[j] - x === diff)) return v + diff === Y;
    if (ys.every((y, j) => y % xs[j] === 0 && y / xs[j] === ys[0] / xs[0])) return v * (ys[0] / xs[0]) === Y;
    if (xs.every((x, j) => x % ys[j] === 0 && x / ys[j] === xs[0] / ys[0])) return Y * (xs[0] / ys[0]) === v;
    return false;
  },
};

const RATIO_SCENES = [
  { intro: (p, q) => `어느 학교 5학년 학생 중 남학생은 ${p}명, 여학생은 ${q}명입니다.`, P: '남학생 수', Q: '여학생 수', W: '전체 학생 수' },
  { intro: (p, q) => `주머니에 빨간 구슬 ${p}개와 파란 구슬 ${q}개가 들어 있습니다.`, P: '빨간 구슬 수', Q: '파란 구슬 수', W: '전체 구슬 수' },
  { intro: (p, q) => `포도 원액 ${p}mL와 물 ${q}mL를 섞어 포도 주스를 만들었습니다.`, P: '포도 원액의 양', Q: '물의 양', W: '포도 주스의 양' },
  { intro: (p, q) => `직사각형의 가로는 ${p}cm이고, 세로는 ${q}cm입니다.`, P: '가로', Q: '세로', W: null },
];
const RATIO_COMPLEMENT_SCENES = [
  { intro: (w, p) => `어느 ${w <= 40 ? '반' : w <= 300 ? '학년' : '학교'} 학생 ${w}명 중에서 안경을 쓴 학생은 ${p}명입니다.`, P: '안경을 쓴 학생 수', Q: '안경을 쓰지 않은 학생 수', W: '전체 학생 수' },
  { intro: (w, p) => `${w}쪽짜리 동화책을 ${p}쪽 읽었습니다.`, P: '읽은 쪽수', Q: '남은 쪽수', W: '전체 쪽수' },
];
const RATIO_FORMS = {
  f1: (X, Y) => `${Y}에 대한 ${X}의 비`,
  f2: (X, Y) => `${X}${josaGwa(X)} ${Y}의 비`,
  f3: (X, Y) => `${X}의 ${Y}에 대한 비`,
};

const ratioSituation = {
  id: 'math.g56.rm.s02-02.ratio-situation',
  standardCode: '[6수02-02]',
  skill: '두 양을 비교하는 상황에서 기준량을 찾아 비로 나타내기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const complement = difficulty === 3;
    let p;
    let q;
    let scene;
    let roles;
    if (complement) {
      scene = rng.pick(RATIO_COMPLEMENT_SCENES);
      const w = rng.int(20, 999);
      p = rng.int(1, w - 1);
      if (p * 2 === w) p += 1;
      q = w - p;
      roles = rng.pick([['Q', 'P'], ['P', 'Q'], ['Q', 'W'], ['W', 'Q']]);
    } else {
      const hi = difficulty === 1 ? 60 : 300;
      scene = rng.pick(RATIO_SCENES);
      p = rng.int(2, hi);
      q = intAvoid(rng, 2, hi, [p]);
      const pool = [['P', 'Q'], ['Q', 'P']];
      if (difficulty === 2 && scene.W) pool.push(['P', 'W'], ['Q', 'W'], ['W', 'P'], ['W', 'Q']);
      roles = rng.pick(pool);
    }
    const [X, Y] = roles;
    const vals = { P: p, Q: q, W: p + q };
    const label = { P: scene.P, Q: scene.Q, W: scene.W };
    // '…의 양의 …에 대한 비'처럼 '의'가 격히는 표현은 피하고 '…에 대한 …의 비'로 쓴다.
    const forms = label[X].includes('의 ') ? ['f1', 'f2'] : Object.keys(RATIO_FORMS);
    const form = rng.pick(forms);
    const phrase = RATIO_FORMS[form](label[X], label[Y]);
    const display = `${vals[X]} : ${vals[Y]}`;
    const intro = complement ? scene.intro(p + q, p) : scene.intro(p, q);
    const solution = [`'${phrase}'에서 기준량은 ${label[Y]}이고 비교하는 양은 ${label[X]}이다.`];
    if (X === 'W' || Y === 'W' || (complement && (X === 'Q' || Y === 'Q'))) {
      solution.push(complement ? `${label.Q}${josaEun(label.Q)} ${p + q} - ${p} = ${q}이다.` : `${label.W}${josaEun(label.W)} ${p} + ${q} = ${p + q}이다.`);
    }
    solution.push(`비교하는 양을 앞에, 기준량을 뒤에 써서 ${display}이다.`);
    return {
      params: { p, q, X, Y },
      instruction: '물음에 답하시오. 비는 간단히 하지 말고 두 양의 수를 그대로 써서 나타내시오.',
      stem: `${intro} ${phrase}를 쓰시오.`,
      answer: { value: display, display, accepts: [display, `${vals[X]}:${vals[Y]}`] },
      solution,
      dedupeKey: `ratio-sit:${complement ? 'cmp' : 'pq'}:${form}:${X}${Y}:${p}:${q}`,
      difficulty,
    };
  },
  verify({ p, q, X, Y }, answer) {
    const m = /^(\d+) ?: ?(\d+)$/.exec(String(answer.value));
    if (!m) return false;
    const pick = (role) => (role === 'P' ? p : role === 'Q' ? q : p + q);
    return Number(m[1]) === pick(X) && Number(m[2]) === pick(Y);
  },
};

const ITEMS_FOR_SALE = ['운동화', '가방', '모자', '필통', '시계'];

const rateStory = {
  id: 'math.g56.rm.s02-03.rate-story',
  standardCode: '[6수02-03]',
  skill: '타율·소금물의 진하기·할인율·증가율·이자율을 비율로 나타내기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kinds = difficulty === 1 ? ['batting', 'salt', 'discount', 'discount']
      : difficulty === 2 ? ['batting', 'salt', 'discount', 'increase']
        : ['interest', 'increase', 'salt-inverse', 'increase-inverse'];
    const kind = rng.pick(kinds);
    if (kind === 'batting') {
      const n = rng.pick(difficulty === 1 ? [10, 20, 25, 50] : [20, 25, 40, 50, 100, 125, 200, 250, 500]);
      const h = rng.int(1, Math.floor(n * 0.6));
      const v = fmtDec((h * 1000) / n, 3);
      const name = rng.pick(NAMES);
      return {
        params: { kind, n, h },
        instruction: '물음에 답하시오.',
        stem: `${name} 선수는 ${n}타수 중에서 안타를 ${h}개 쳤습니다. 전체 타수에 대한 안타 수의 비율인 타율을 소수로 나타내시오.`,
        answer: { value: v, display: v, accepts: [v] },
        solution: ['타율은 (안타 수) ÷ (전체 타수)이다.', `${h} ÷ ${n} = ${v}이다.`],
        dedupeKey: `rate:batting:${n}:${h}`,
        difficulty,
      };
    }
    if (kind === 'salt' || kind === 'salt-inverse') {
      const base = rng.pick([20, 25, 50, 100]);
      const T = base * rng.int(difficulty === 1 ? 5 : 3, difficulty === 1 ? 40 : 100);
      const stepP = 100 / base;
      const pMax = Math.floor((difficulty === 1 ? 30 : 50) / stepP);
      const p = stepP * rng.int(1, pMax);
      const s = (T * p) / 100;
      if (kind === 'salt') {
        return {
          params: { kind, s, w: T - s },
          instruction: '물음에 답하시오.',
          stem: `소금 ${s}g을 물 ${T - s}g에 녹여 소금물을 만들었습니다. 소금물의 양에 대한 소금의 양의 비율은 몇 %입니까?`,
          answer: { value: p, display: `${p}%`, accepts: [num(p), `${p}%`] },
          solution: [`소금물의 양은 ${s} + ${T - s} = ${T}(g)이다.`, `${s} ÷ ${T} × 100 = ${p}이므로 ${p}%이다.`],
          dedupeKey: `rate:salt:${s}:${T - s}`,
          difficulty,
        };
      }
      return {
        params: { kind, T, p },
        instruction: '물음에 답하시오.',
        stem: `소금물 ${T}g에 대한 소금의 양의 비율이 ${p}%입니다. 이 소금물에 녹아 있는 소금은 몇 g입니까?`,
        answer: { value: s, display: `${s}g`, accepts: [num(s), `${s}g`] },
        solution: [`${p}%를 분수로 나타내면 ${p}/100이다.`, `${T} × ${p}/100 = ${s}이므로 ${s}g이다.`],
        dedupeKey: `rate:salt-inv:${T}:${p}`,
        difficulty,
      };
    }
    if (kind === 'discount') {
      const P = 100 * rng.int(difficulty === 1 ? 10 : 20, difficulty === 1 ? 2000 : 2999);
      const r = difficulty === 1 ? 5 * rng.int(1, 12) : rng.int(1, 60);
      const Q = P - (P * r) / 100;
      const item = rng.pick(P > 50000 ? ['자전거', '책상', '텔레비전', '냉장고'] : ITEMS_FOR_SALE);
      return {
        params: { kind, P, Q },
        instruction: '물음에 답하시오.',
        stem: `${P}원짜리 ${item}${josaEul(item)} 할인하여 ${Q}원에 샀습니다. 원래 가격에 대한 할인 금액의 비율인 할인율은 몇 %입니까?`,
        answer: { value: r, display: `${r}%`, accepts: [num(r), `${r}%`] },
        solution: [`할인 금액은 ${P} - ${Q} = ${P - Q}(원)이다.`, `${P - Q} ÷ ${P} × 100 = ${r}이므로 ${r}%이다.`],
        dedupeKey: `rate:discount:${P}:${Q}`,
        difficulty,
      };
    }
    if (kind === 'interest') {
      const r = rng.int(1, 12);
      const P = 1000 * rng.int(10, 3000);
      const I = (P * r) / 100;
      return {
        params: { kind, P, I },
        instruction: '물음에 답하시오.',
        stem: `은행에 ${P}원을 1년 동안 맡겼더니 이자가 ${I}원 생겼습니다. 맡긴 돈에 대한 이자의 비율은 몇 %입니까?`,
        answer: { value: r, display: `${r}%`, accepts: [num(r), `${r}%`] },
        solution: ['이자율은 (이자) ÷ (맡긴 돈)이다.', `${I} ÷ ${P} × 100 = ${r}이므로 ${r}%이다.`],
        dedupeKey: `rate:interest:${P}:${I}`,
        difficulty,
      };
    }
    // 증가율: 작년 수가 100/gcd(r,100) 의 배수이면 늘어난 수가 자연수다.
    const r = rng.int(1, difficulty === 2 ? 50 : 80);
    const unitX = 100 / gcd(r, 100);
    const x = unitX * rng.int(Math.ceil(20 / unitX), Math.floor((difficulty === 2 ? 2000 : 9000) / unitX));
    const y = x + (x * r) / 100;
    if (kind === 'increase') {
      return {
        params: { kind, x, y },
        instruction: '물음에 답하시오.',
        stem: `작년에 ${x}명이던 동아리 회원 수가 올해는 ${y}명이 되었습니다. 회원 수는 작년보다 몇 % 늘었습니까?`,
        answer: { value: r, display: `${r}%`, accepts: [num(r), `${r}%`] },
        solution: [`늘어난 회원 수는 ${y} - ${x} = ${y - x}(명)이다.`, `${y - x} ÷ ${x} × 100 = ${r}이므로 ${r}% 늘었다.`],
        dedupeKey: `rate:increase:${x}:${y}`,
        difficulty,
      };
    }
    return {
      params: { kind, x, r },
      instruction: '물음에 답하시오.',
      stem: `작년에 ${x}명이던 동아리 회원 수가 올해는 작년보다 ${r}% 늘었습니다. 올해 회원 수는 몇 명입니까?`,
      answer: { value: y, display: `${y}명`, accepts: [num(y), `${y}명`] },
      solution: [`늘어난 회원 수는 ${x} × ${r}/100 = ${y - x}(명)이다.`, `올해 회원 수는 ${x} + ${y - x} = ${y}(명)이다.`],
      dedupeKey: `rate:increase-inv:${x}:${r}`,
      difficulty,
    };
  },
  verify(params, answer) {
    if (params.kind === 'batting') {
      const p = parseDec(answer.value);
      // 타율 × 타수 = 안타 수
      return p !== null && p.units * params.n === params.h * 10 ** p.scale;
    }
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    switch (params.kind) {
      case 'salt': return v * (params.s + params.w) === params.s * 100;
      case 'salt-inverse': return v * 100 === params.T * params.p;
      case 'discount': return (params.P - params.Q) * 100 === v * params.P;
      case 'interest': return params.I * 100 === v * params.P;
      case 'increase': return (params.y - params.x) * 100 === v * params.x;
      default: return (v - params.x) * 100 === params.x * params.r;
    }
  },
};

// ---------------------------------------------------------------------------
// [6수02-04] 비례식 · [6수02-05] 비례배분
// ---------------------------------------------------------------------------

const PROPORTION_SCENES = [
  {
    intro: (a, b) => `밀가루 ${a}g에 설탕 ${b}g을 넣어 반죽을 만듭니다.`,
    askB: (c) => `같은 비율로 밀가루 ${c}g에 설탕을 몇 g 넣어야 합니까?`,
    askA: (c) => `같은 비율로 설탕 ${c}g에 밀가루를 몇 g 넣어야 합니까?`,
    uA: 'g', uB: 'g', sA: 1, sB: 1,
  },
  {
    intro: (a, b) => `공책 ${a}권의 값이 ${b}원입니다.`,
    askB: (c) => `같은 공책 ${c}권의 값은 몇 원입니까?`,
    askA: (c) => `같은 공책을 ${c}원어치 사면 몇 권입니까?`,
    uA: '권', uB: '원', sA: 1, sB: 100,
  },
  {
    intro: (a, b) => `높이가 ${a}cm인 막대의 그림자 길이가 ${b}cm입니다.`,
    askB: (c) => `같은 시각에 높이가 ${c}cm인 나무의 그림자 길이는 몇 cm입니까?`,
    askA: (c) => `같은 시각에 그림자 길이가 ${c}cm인 나무의 높이는 몇 cm입니까?`,
    uA: 'cm', uB: 'cm', sA: 1, sB: 1,
  },
  {
    intro: (a, b) => `흰색 물감 ${a}mL와 파란색 물감 ${b}mL를 섞어 하늘색 물감을 만듭니다.`,
    askB: (c) => `같은 색을 만들려면 흰색 물감 ${c}mL에 파란색 물감을 몇 mL 섞어야 합니까?`,
    askA: (c) => `같은 색을 만들려면 파란색 물감 ${c}mL에 흰색 물감을 몇 mL 섞어야 합니까?`,
    uA: 'mL', uB: 'mL', sA: 1, sB: 1,
  },
];

const proportionStory = {
  id: 'math.g56.rm.s02-04.proportion-story',
  standardCode: '[6수02-04]',
  skill: '비례식을 세워 실생활 문제 해결하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const [xHi, kHi] = difficulty === 1 ? [9, 15] : difficulty === 2 ? [12, 40] : [20, 60];
    const s = rng.pick(PROPORTION_SCENES);
    // 공책은 한 권의 값이 자연수(100원 단위)가 되도록 1권당 값으로 비를 정한다.
    const [x, y] = s.sB === 100 ? [1, rng.int(5, difficulty === 1 ? 15 : 30)] : coprimePair(rng, 1, xHi);
    const k1 = rng.int(2, kHi);
    const askB = rng.bool();
    const a = x * k1 * s.sA;
    const b = y * k1 * s.sB;
    // 답이 주어진 수와 같아지는 경우를 건너뛰며 두 번째 배수를 정한다.
    let k2 = intAvoid(rng, 2, kHi + 1, [k1]);
    const make = (k) => (askB ? { c: x * k * s.sA, v: y * k * s.sB } : { c: y * k * s.sB, v: x * k * s.sA });
    for (let guard = 0; guard < 4 && [a, b, make(k2).c].includes(make(k2).v); guard += 1) k2 = k2 + 1 === k1 ? k2 + 2 : k2 + 1;
    const { c, v } = make(k2);
    const unit = askB ? s.uB : s.uA;
    const eq = askB ? `${a} : ${b} = ${c} : □` : `${a} : ${b} = □ : ${c}`;
    return {
      params: { a, b, c, askB },
      instruction: '비례식을 세워 답을 구하시오.',
      stem: `${s.intro(a, b)} ${askB ? s.askB(c) : s.askA(c)}`,
      answer: { value: v, display: `${v}${unit}`, accepts: [num(v), `${v}${unit}`] },
      solution: [
        `구하는 양을 □라 하면 ${eq}이다.`,
        askB ? `외항의 곱과 내항의 곱이 같으므로 ${a} × □ = ${b} × ${c}이다.` : `외항의 곱과 내항의 곱이 같으므로 ${a} × ${c} = ${b} × □이다.`,
        `□ = ${v}이므로 ${v}${unit}이다.`,
      ],
      dedupeKey: `prop-story:${askB ? 'B' : 'A'}:${a}:${b}:${c}`,
      difficulty,
    };
  },
  verify({ a, b, c, askB }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    // a : b = c : v 또는 a : b = v : c 에서 외항의 곱 = 내항의 곱
    return askB ? a * v === b * c : a * c === b * v;
  },
};

/** 항 하나를 화면 표기로. kind: int | dec | frac */
function termText(t) {
  if (t.kind === 'dec') return fmtDec(t.n, t.d === 10 ? 1 : 2);
  if (t.kind === 'frac') return `${t.n}/${t.d}`;
  return `${t.n}`;
}

const proportionMixedTerms = {
  id: 'math.g56.rm.s02-04.proportion-mixed-terms',
  standardCode: '[6수02-04]',
  skill: '소수나 분수가 든 비례식에서 □의 값 구하기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    const [x, y] = coprimePair(rng, 1, difficulty === 3 ? 15 : 12);
    let first;
    let X = x;
    let Y = y;
    if (difficulty === 2) {
      // 분수의 비 a/b : c/d 는 자연수의 비 a×d : c×b 와 같다.
      const f1 = properFraction(rng, 2, 9);
      let f2 = properFraction(rng, 2, 9);
      if (f1.n === f2.n && f1.d === f2.d) f2 = f1.d === 2 ? { n: 1, d: 3 } : { n: 1, d: 2 };
      const g = gcd(f1.n * f2.d, f2.n * f1.d);
      X = (f1.n * f2.d) / g;
      Y = (f2.n * f1.d) / g;
      first = [{ kind: 'frac', ...f1 }, { kind: 'frac', ...f2 }];
    } else {
      const scale = difficulty === 3 && rng.bool() ? 100 : 10;
      const m = intAvoid(rng, 1, scale === 10 ? 30 : 300, [scale, 2 * scale, 3 * scale]);
      first = [{ kind: 'dec', n: x * m, d: scale }, { kind: 'dec', n: y * m, d: scale }];
    }
    const k = rng.int(2, 30);
    const second = [{ kind: 'int', n: X * k, d: 1 }, { kind: 'int', n: Y * k, d: 1 }];
    // 난이도 3은 소수 쪽에 □를 두어 답이 소수가 된다.
    const blankInFirst = difficulty === 3;
    const hide = rng.int(0, 1);
    const swap = rng.bool();
    const terms = swap ? [...second, ...first] : [...first, ...second];
    const hideAt = (blankInFirst ? (swap ? 2 : 0) : (swap ? 0 : 2)) + hide;
    const shown = terms.map((t, i) => (i === hideAt ? '□' : termText(t)));
    const target = terms[hideAt];
    const ansText = target.kind === 'dec' ? fmtDec(target.n, target.d === 10 ? 1 : 2) : num(target.n);
    const value = target.kind === 'dec' ? ansText : target.n;
    const rational = terms.map((t, i) => (i === hideAt ? null : { n: t.n, d: t.d }));
    return {
      params: { rational, hideAt },
      instruction: '□ 안에 알맞은 수를 써넣으시오.',
      stem: `${shown[0]} : ${shown[1]} = ${shown[2]} : ${shown[3]}`,
      answer: { value, display: ansText, accepts: [ansText] },
      solution: [
        '비례식에서 외항의 곱과 내항의 곱은 같다.',
        `${shown.filter((_, i) => i === 0 || i === 3).join(' × ')} = ${shown.filter((_, i) => i === 1 || i === 2).join(' × ')}이다.`,
        `따라서 □ = ${ansText}이다.`,
      ],
      dedupeKey: `prop-mixed:${shown.join(':')}`,
      difficulty,
    };
  },
  verify({ rational, hideAt }, answer) {
    let t;
    if (typeof answer.value === 'number') {
      if (!Number.isInteger(answer.value) || answer.value <= 0) return false;
      t = { n: answer.value, d: 1 };
    } else {
      const p = parseDec(answer.value);
      if (p === null || p.units === 0) return false;
      t = { n: p.units, d: 10 ** p.scale };
    }
    const r = rational.map((x, i) => (i === hideAt ? t : x));
    // 외항의 곱과 내항의 곱을 분모까지 곱해 정수로 비교한다.
    return r[0].n * r[3].n * r[1].d * r[2].d === r[1].n * r[2].n * r[0].d * r[3].d;
  },
};

const SHARE_THINGS = [['구슬', '개'], ['색종이', '장'], ['딱지', '장'], ['사탕', '개']];
const SHARE_PEOPLE = [['형', '동생'], ['언니', '동생'], ['지민', '수호'], ['가 모둠', '나 모둠']];

const shareAdvanced = {
  id: 'math.g56.rm.s02-05.share-advanced',
  standardCode: '[6수02-05]',
  skill: '비례배분의 역문제와 소수·분수의 비로 비례배분하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kinds = difficulty === 1 ? ['total', 'other'] : difficulty === 2 ? ['difference', 'decimal'] : ['fraction', 'difference', 'total'];
    const kind = rng.pick(kinds);
    const [P, Q] = rng.pick(SHARE_PEOPLE);
    const [thing, cnt] = rng.pick(SHARE_THINGS);
    const firstAsk = rng.bool();
    let a;
    let b;
    let ratioText;
    let ratioNote = '';
    if (kind === 'decimal') {
      const [x, y] = coprimePair(rng, 1, 12);
      const m = intAvoid(rng, 1, 9, []);
      a = x;
      b = y;
      const [da, db] = [fmtDec(x * m, 1), fmtDec(y * m, 1)];
      ratioText = `${da} : ${decRo(db)}`;
      ratioNote = `${da} : ${db}의 각 항에 10을 곱하고 ${numRo(m)} 나누면 ${a} : ${b}이다.`;
    } else if (kind === 'fraction') {
      const f1 = properFraction(rng, 2, 9);
      let f2 = properFraction(rng, 2, 9);
      if (f1.n === f2.n && f1.d === f2.d) f2 = f1.d === 2 ? { n: 1, d: 3 } : { n: 1, d: 2 };
      const g = gcd(f1.n * f2.d, f2.n * f1.d);
      a = (f1.n * f2.d) / g;
      b = (f2.n * f1.d) / g;
      ratioText = `${f1.n}/${f1.d} : ${f2.n}/${f2.d}${particleRo(sinoKoreanLarge(f2.n))}`;
      ratioNote = `두 분모의 곱 ${f1.d * f2.d}${numberParticle(f1.d * f2.d, '을', '를')} 각 항에 곱하여 간단히 하면 ${a} : ${b}이다.`;
    } else {
      [a, b] = coprimePair(rng, 1, difficulty === 1 ? 12 : 15);
      if (kind === 'difference' && a === b) b += 1;
      ratioText = `${a} : ${numRo(b)}`;
    }
    const u = rng.int(difficulty === 1 ? 2 : 5, difficulty === 1 ? 60 : difficulty === 2 ? 100 : 150);
    const T = (a + b) * u;
    const [sa, sb] = [a * u, b * u];
    let stem;
    let v;
    let solution;
    const who = firstAsk ? P : Q;
    const other = firstAsk ? Q : P;
    const whoShare = firstAsk ? sa : sb;
    const otherShare = firstAsk ? sb : sa;
    const copula = (n, c) => `${n}${c}${particle(c, '이었습니다.', '였습니다.')}`;
    if (kind === 'total') {
      stem = `${P}${josaGwa(P)} ${Q}${josaI(Q)} ${thing}${josaEul(thing)} ${ratioText} 나누어 가졌더니 ${who}${josaI(who)} 가진 ${thing}${josaI(thing)} ${copula(whoShare, cnt)}`
        + ` 처음에 있던 ${thing}${josaEun(thing)} 모두 몇 ${cnt}입니까?`;
      v = T;
      solution = [`${who}의 몫은 전체의 ${firstAsk ? a : b}/${a + b}이다.`, `전체는 ${whoShare} ÷ ${firstAsk ? a : b} × ${a + b} = ${T}${cnt}이다.`];
    } else if (kind === 'other') {
      stem = `${P}${josaGwa(P)} ${Q}${josaI(Q)} ${thing}${josaEul(thing)} ${ratioText} 나누어 가졌더니 ${who}${josaI(who)} 가진 ${thing}${josaI(thing)} ${copula(whoShare, cnt)}`
        + ` ${other}${josaI(other)} 가진 ${thing}${josaEun(thing)} 몇 ${cnt}입니까?`;
      v = otherShare;
      solution = [`한 묶음은 ${whoShare} ÷ ${firstAsk ? a : b} = ${u}${cnt}이다.`, `${other}${josaEun(other)} ${firstAsk ? b : a}묶음이므로 ${u} × ${firstAsk ? b : a} = ${v}${cnt}이다.`];
    } else if (kind === 'difference') {
      stem = `${thing} ${T}${cnt}${josaEul(cnt)} ${P}${josaGwa(P)} ${Q}에게 ${ratioText} 나누어 주려고 합니다. ${P.endsWith('모둠') ? '두 모둠이' : '두 사람이'} 받는 ${thing} 수의 차는 몇 ${cnt}입니까?`;
      v = Math.abs(sa - sb);
      solution = [`${P}${josaEun(P)} ${T} × ${a}/${a + b} = ${sa}${cnt}, ${Q}${josaEun(Q)} ${T} × ${b}/${a + b} = ${sb}${cnt}${josaEul(cnt)} 받는다.`, `차는 ${Math.max(sa, sb)} - ${Math.min(sa, sb)} = ${v}${cnt}이다.`];
    } else {
      stem = `${thing} ${T}${cnt}${josaEul(cnt)} ${P}${josaGwa(P)} ${Q}에게 ${ratioText} 나누어 주려고 합니다. ${who}에게 몇 ${cnt}${josaEul(cnt)} 주어야 합니까?`;
      v = whoShare;
      solution = [ratioNote, `${who}의 몫은 ${T} × ${firstAsk ? a : b}/${a + b} = ${v}${cnt}이다.`];
    }
    return {
      params: { kind, a, b, T, firstAsk, known: kind === 'total' || kind === 'other' ? whoShare : 0 },
      instruction: '물음에 답하시오.',
      stem,
      answer: { value: v, display: `${v}${cnt}`, accepts: [num(v), `${v}${cnt}`] },
      solution,
      dedupeKey: `share-adv:${kind}:${ratioText.replace(/[^\d/:. ]/g, '')}:${kind === 'total' || kind === 'other' ? whoShare : T}:${firstAsk ? 1 : 2}`,
      difficulty,
    };
  },
  verify({ kind, a, b, T, firstAsk, known }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    const [wa, wb] = firstAsk ? [a, b] : [b, a];
    if (kind === 'total') return known * (a + b) === v * wa && v > known;
    if (kind === 'other') return known * wb === v * wa;
    if (kind === 'difference') {
      // 한 사람 몫을 x 라 하면 다른 몫은 T - x 이고 둘의 비가 a : b 이다.
      for (let x = 1; x < T; x += 1) if (x * b === (T - x) * a) return Math.abs(T - 2 * x) === v;
      return false;
    }
    return v < T && v * wb === (T - v) * wa;
  },
};

// ---------------------------------------------------------------------------
// [6수01-01] 혼합 계산 문장제 · [6수01-02] 수의 범위 · [6수01-03] 어림
// ---------------------------------------------------------------------------

const mixedOpsStory = {
  id: 'math.g56.no.s01.mixed-ops-story',
  standardCode: '[6수01-01]',
  skill: '여러 단계의 문장제를 하나의 혼합 계산식으로 나타내어 해결하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = rng.pick(difficulty === 1 ? ['group', 'share'] : difficulty === 2 ? ['shop', 'save', 'share'] : ['shop', 'factory', 'save']);
    const name = rng.pick(NAMES);
    let stem;
    let expr;
    let v;
    let params;
    if (kind === 'group') {
      const g = rng.int(3, 8);
      const groups = rng.int(3, 15);
      const total = g * groups;
      const m = rng.int(Math.max(2, total - 60), total - 2);
      const f = total - m;
      const h = rng.int(2, 20);
      v = groups * h;
      expr = `(${m} + ${f}) ÷ ${g} × ${h}`;
      stem = `남학생 ${m}명과 여학생 ${f}명이 한 모둠에 ${g}명씩 모둠을 만들었습니다. 모둠마다 색종이를 ${h}장씩 나누어 주려면 색종이는 모두 몇 장 필요합니까?`;
      params = { kind, m, f, g, h };
    } else if (kind === 'share') {
      const c = rng.int(2, 9);
      const q = rng.int(3, difficulty === 1 ? 30 : 60);
      const total = c * q;
      const divs = [];
      for (let k = 2; k <= Math.min(20, total / 2); k += 1) if (total % k === 0) divs.push(k);
      const bags = rng.pick(divs);
      const per = total / bags;
      const d = rng.int(1, 9);
      v = q + d;
      expr = `${per} × ${bags} ÷ ${c} + ${d}`;
      stem = `사탕이 한 봉지에 ${per}개씩 ${bags}봉지 있습니다. 이 사탕을 ${c}명에게 똑같이 나누어 준 다음, 한 사람에게 ${d}개씩 더 주었습니다. 한 사람이 받은 사탕은 모두 몇 개입니까?`;
      params = { kind, per, bags, c, d };
    } else if (kind === 'shop') {
      const a = 100 * rng.int(5, difficulty === 3 ? 90 : 30);
      const b = rng.int(2, 9);
      const c = 50 * rng.int(2, difficulty === 3 ? 100 : 30);
      const d = rng.int(2, 9);
      const cost = a * b + c * d;
      const x = (Math.floor(cost / 1000) + rng.int(1, difficulty === 3 ? 20 : 5)) * 1000;
      v = x - cost;
      expr = `${x} - (${a} × ${b} + ${c} × ${d})`;
      stem = `${name}${josaEun(name)} ${x}원을 가지고 ${a}원짜리 공책 ${b}권과 ${c}원짜리 연필 ${d}자루를 샀습니다. 남은 돈은 얼마입니까?`;
      params = { kind, x, a, b, c, d };
    } else if (kind === 'save') {
      const a = 100 * rng.int(5, difficulty === 3 ? 100 : 50);
      const b = rng.int(3, difficulty === 3 ? 20 : 10);
      const c = 100 * rng.int(Math.ceil((a * b) / 300), Math.floor((a * b * 9) / 1000));
      v = (a * b - c) / 2;
      expr = `(${a} × ${b} - ${c}) ÷ 2`;
      stem = `${name}${josaEun(name)} 매주 ${a}원씩 ${b}주 동안 돈을 모았습니다. 그중 ${c}원으로 책을 사고, 남은 돈을 동생과 똑같이 나누어 가졌습니다. ${name}${josaI(name)} 가진 돈은 얼마입니까?`;
      params = { kind, a, b, c };
    } else {
      const a = rng.int(20, 90);
      const b = rng.int(2, 9);
      const c = rng.int(2, 12);
      const e = rng.int(5, 30);
      const total = a * b * c;
      const d = (total % e) + e * rng.int(total % e === 0 ? 1 : 0, 3);
      v = (total - d) / e;
      expr = `(${a} × ${b} × ${c} - ${d}) ÷ ${e}`;
      stem = `한 시간에 ${a}개씩 물건을 만드는 기계 ${b}대가 ${c}시간 동안 만든 물건 중 ${d}개가 불량품이었습니다. 불량품이 아닌 물건을 한 상자에 ${e}개씩 담으면 몇 상자가 됩니까?`;
      params = { kind, a, b, c, d, e };
    }
    const unit = kind === 'shop' || kind === 'save' ? '원' : kind === 'factory' ? '상자' : kind === 'group' ? '장' : '개';
    return {
      params,
      instruction: '하나의 식으로 나타내어 답을 구하시오.',
      stem,
      answer: { value: v, display: `${v}${unit}`, accepts: [num(v), `${v}${unit}`] },
      solution: [
        `하나의 식으로 나타내면 ${expr}이다.`,
        '괄호 안을 먼저 계산하고, 곱셈과 나눗셈을 덧셈과 뺄셈보다 먼저 계산한다.',
        `${expr} = ${v}이므로 ${v}${unit}이다.`,
      ],
      dedupeKey: `mixed-story:${kind}:${Object.values(params).slice(1).join(':')}`,
      difficulty,
    };
  },
  verify(params, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    // 답에서 거꾸로 계산해 문제에 주어진 수가 되돌아오는지 본다.
    switch (params.kind) {
      case 'group': return v % params.h === 0 && (v / params.h) * params.g === params.m + params.f;
      case 'share': return (v - params.d) * params.c === params.per * params.bags;
      case 'shop': return v + params.a * params.b + params.c * params.d === params.x;
      case 'save': return v * 2 + params.c === params.a * params.b;
      default: return v * params.e + params.d === params.a * params.b * params.c;
    }
  },
};

const RANGE_TESTS = {
  이상: (n, b) => n >= b,
  초과: (n, b) => n > b,
  이하: (n, b) => n <= b,
  미만: (n, b) => n < b,
};

const rangeCount = {
  id: 'math.g56.no.s02.range-count',
  standardCode: '[6수01-02]',
  skill: '이상·이하·초과·미만으로 나타낸 범위에 드는 자연수의 개수 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const lowWord = () => rng.pick(['이상', '초과']);
    const highWord = () => rng.pick(['이하', '미만']);
    const lo = (a, w) => (w === '이상' ? a : a + 1);
    const hi = (b, w) => (w === '이하' ? b : b - 1);
    if (difficulty === 3) {
      // 두 범위가 겹치는 부분을 센다: a1 < a2 < b1 < b2
      const a1 = rng.int(1, 1500);
      const a2 = a1 + rng.int(3, 300);
      const b1 = a2 + rng.int(3, 300);
      const b2 = b1 + rng.int(3, 300);
      const conds = [[a1, lowWord(), b1, highWord()], [a2, lowWord(), b2, highWord()]];
      if (rng.bool()) conds.reverse();
      const from = Math.max(lo(conds[0][0], conds[0][1]), lo(conds[1][0], conds[1][1]));
      const to = Math.min(hi(conds[0][2], conds[0][3]), hi(conds[1][2], conds[1][3]));
      const v = to - from + 1;
      const t = (c) => `${c[0]} ${c[1]} ${c[2]} ${c[3]}`;
      return {
        params: { conds },
        instruction: '물음에 답하시오.',
        stem: `${t(conds[0])}인 수이면서 ${t(conds[1])}인 자연수는 모두 몇 개입니까?`,
        answer: { value: v, display: `${v}개`, accepts: [num(v), `${v}개`] },
        solution: [
          `두 조건을 모두 만족하는 자연수는 ${from}부터 ${to}까지이다.`,
          `${to} - ${from} + 1 = ${v}이므로 ${v}개이다.`,
        ],
        dedupeKey: `range-count:${conds.flat().join(':')}`,
        difficulty,
      };
    }
    const a = rng.int(1, difficulty === 1 ? 50 : 500);
    const w1 = lowWord();
    const w2 = highWord();
    let b = a + rng.int(5, difficulty === 1 ? 60 : 500);
    let v = hi(b, w2) - lo(a, w1) + 1;
    if (v === a) { b += 1; v += 1; }
    if (v === b) { b += 1; v += 1; }
    return {
      params: { conds: [[a, w1, b, w2]] },
      instruction: '물음에 답하시오.',
      stem: `${a} ${w1} ${b} ${w2}인 자연수는 모두 몇 개입니까?`,
      answer: { value: v, display: `${v}개`, accepts: [num(v), `${v}개`] },
      solution: [
        `${a} ${w1}${w1 === '이상' ? `은 ${numEul(a)} 포함하고` : `는 ${numEul(a)} 포함하지 않고`}, ${b} ${w2}${w2 === '이하' ? `는 ${numEul(b)} 포함한다` : `은 ${numEul(b)} 포함하지 않는다`}.`,
        `범위에 드는 수는 ${lo(a, w1)}부터 ${hi(b, w2)}까지이므로 ${hi(b, w2)} - ${lo(a, w1)} + 1 = ${v}개이다.`,
      ],
      dedupeKey: `range-count:${a}:${w1}:${b}:${w2}`,
      difficulty,
    };
  },
  verify({ conds }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v < 0) return false;
    // 1부터 차례로 모든 조건을 확인하며 센다.
    const top = Math.max(...conds.map((c) => c[2]));
    let count = 0;
    for (let n = 1; n <= top; n += 1) {
      if (conds.every(([a, w1, b, w2]) => RANGE_TESTS[w1](n, a) && RANGE_TESTS[w2](n, b))) count += 1;
    }
    return count === v;
  },
};

const PRODUCE = ['귤', '사과', '감자', '달걀', '공책'];

const roundingStory = {
  id: 'math.g56.no.s03.rounding-story',
  standardCode: '[6수01-03]',
  skill: '올림·버림·반올림을 실생활 문제에 활용하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kinds = difficulty === 1 ? ['box-up', 'sell-down', 'bill-up']
      : difficulty === 2 ? ['box-up', 'sell-down', 'bill-up', 'exchange-down', 'round-count']
        : ['exchange-down', 'bill-up', 'round-count', 'round-decimal'];
    const kind = rng.pick(kinds);
    const thing = rng.pick(PRODUCE);
    const notMultiple = (lo2, hi2, unit) => {
      const x = rng.int(lo2, hi2);
      return x % unit === 0 ? x + rng.int(1, unit - 1) : x;
    };
    if (kind === 'box-up' || kind === 'sell-down') {
      const unit = difficulty === 1 ? 10 : 100;
      const n = notMultiple(unit + 1, unit * 999, unit);
      const up = kind === 'box-up';
      const v = up ? Math.ceil(n / unit) : Math.floor(n / unit);
      const counter = up ? '상자' : '봉지';
      return {
        params: { kind, n, unit },
        instruction: '물음에 답하시오.',
        stem: up
          ? `${thing} ${n}개를 한 상자에 ${unit}개씩 담아 모두 포장하려고 합니다. 상자는 적어도 몇 상자 필요합니까?`
          : `${thing} ${n}개를 한 봉지에 ${unit}개씩 담아 팔려고 합니다. 팔 수 있는 봉지는 최대 몇 봉지입니까?`,
        answer: { value: v, display: `${v}${counter}`, accepts: [num(v), `${v}${counter}`] },
        solution: up
          ? [`남는 ${thing}도 담아야 하므로 ${numEul(n)} ${unit === 10 ? '십' : '백'}의 자리까지 올림한다.`, `${n} -> ${v * unit}이므로 ${v}상자가 필요하다.`]
          : [`${unit}개가 안 되는 ${thing}${josaEun(thing)} 팔 수 없으므로 ${numEul(n)} ${unit === 10 ? '십' : '백'}의 자리까지 버림한다.`, `${n} -> ${v * unit}이므로 ${v}봉지를 팔 수 있다.`],
        dedupeKey: `rounding-story:${kind}:${n}:${unit}`,
        difficulty,
      };
    }
    if (kind === 'bill-up' || kind === 'exchange-down') {
      const unit = difficulty === 3 ? 10000 : 1000;
      const x = notMultiple(unit + 1, difficulty === 1 ? 9999 : unit * 99, unit);
      const up = kind === 'bill-up';
      const v = up ? Math.ceil(x / unit) * unit : Math.floor(x / unit) * unit;
      const bill = unit === 1000 ? '1000원짜리' : '10000원짜리';
      const item = rng.pick(ITEMS_FOR_SALE);
      return {
        params: { kind, x, unit },
        instruction: '물음에 답하시오.',
        stem: up
          ? `${x}원짜리 ${item}${josaEul(item)} ${bill} 지폐로만 사려고 합니다. 적어도 얼마를 내야 합니까?`
          : `저금통에 모은 동전 ${x}원을 ${bill} 지폐로 바꾸려고 합니다. 지폐로 최대 얼마까지 바꿀 수 있습니까?`,
        answer: { value: v, display: `${v}원`, accepts: [num(v), `${v}원`] },
        solution: up
          ? [`모자라지 않게 내야 하므로 ${numEul(x)} ${unit === 1000 ? '천' : '만'}의 자리까지 올림한다.`, `${x} -> ${v}이므로 ${v}원을 내야 한다.`]
          : [`${bill} 지폐로 바꿀 수 없는 나머지는 남으므로 ${numEul(x)} ${unit === 1000 ? '천' : '만'}의 자리까지 버림한다.`, `${x} -> ${v}이므로 ${v}원까지 바꿀 수 있다.`],
        dedupeKey: `rounding-story:${kind}:${x}:${unit}`,
        difficulty,
      };
    }
    if (kind === 'round-count') {
      const unit = difficulty === 2 ? rng.pick([100, 1000]) : 10000;
      const x = notMultiple(unit + 1, unit * 99, unit);
      const r = x % unit;
      const v = r * 2 >= unit ? x - r + unit : x - r;
      const place = unit === 100 ? '백' : unit === 1000 ? '천' : '만';
      return {
        params: { kind, x, unit },
        instruction: '물음에 답하시오.',
        stem: `어느 축제에 다녀간 사람은 ${x}명입니다. 다녀간 사람 수를 반올림하여 ${place}의 자리까지 나타내면 몇 명입니까?`,
        answer: { value: v, display: `${v}명`, accepts: [num(v), `${v}명`] },
        solution: [`${place}의 자리 바로 아래 자리의 숫자가 ${r * 2 >= unit ? '5 이상이므로 올린다' : '4 이하이므로 버린다'}.`, `${x} -> ${v}이므로 ${v}명이다.`],
        dedupeKey: `rounding-story:${kind}:${x}:${unit}`,
        difficulty,
      };
    }
    // 소수 두 자리 길이를 반올림하여 소수 첫째 자리까지 나타낸다.
    const h = notMultiple(101, 9999, 10);
    const r = h % 10;
    const tenths = r >= 5 ? (h - r) / 10 + 1 : (h - r) / 10;
    // 소수 첫째 자리까지 나타내라고 했으므로 그 자릿수 표기(29.0)를 정답으로 내고, 같은 값(29)도 받는다.
    const v = (tenths / 10).toFixed(1);
    const short = fmtDec(tenths, 1);
    const x = fmtDec(h, 2);
    return {
      params: { kind, h },
      instruction: '물음에 답하시오.',
      stem: `철사의 길이를 재었더니 ${x}m였습니다. 철사의 길이를 반올림하여 소수 첫째 자리까지 나타내면 몇 m입니까?`,
      answer: { value: v, display: `${v}m`, accepts: [...new Set([v, `${v}m`, short, `${short}m`])] },
      solution: [`소수 둘째 자리 숫자가 ${r}${r >= 5 ? '이므로 올린다' : '이므로 버린다'}.`, `${x} -> ${v}이므로 ${v}m이다.`],
      dedupeKey: `rounding-story:${kind}:${h}`,
      difficulty,
    };
  },
  verify(params, answer) {
    if (params.kind === 'round-decimal') {
      // 소수 첫째 자리까지의 답만 읽는다. 끝자리 0(29.0)은 자릿수를 밝힌 표기이므로 받는다.
      const m = /^(0|[1-9]\d*)(?:\.(\d))?$/.exec(String(answer.value));
      if (m === null) return false;
      // 답(0.1 단위)과 원래 길이(0.01 단위)의 차가 0.05 미만이거나, 정확히 0.05 아래에서 올린 경우만 허용한다.
      const diff = (Number(m[1]) * 10 + Number(m[2] ?? 0)) * 10 - params.h;
      return diff > -5 && diff <= 5;
    }
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    const { kind, unit } = params;
    if (kind === 'box-up') return v * unit >= params.n && (v - 1) * unit < params.n;
    if (kind === 'sell-down') return v * unit <= params.n && (v + 1) * unit > params.n;
    if (v % unit !== 0) return false;
    if (kind === 'bill-up') return v >= params.x && v - unit < params.x;
    if (kind === 'exchange-down') return v <= params.x && v + unit > params.x;
    const diff2 = 2 * (v - params.x);
    return diff2 > -unit && diff2 <= unit;
  },
};

// ---------------------------------------------------------------------------
// [6수01-07] 분수의 크기 비교 · [6수01-08]·[6수01-09]·[6수01-11] 분수 문장제
// ---------------------------------------------------------------------------

const compareFractionsSet = {
  id: 'math.g56.no.s07.compare-set',
  standardCode: '[6수01-07]',
  skill: '분모가 다른 여러 분수의 크기를 비교하여 가장 큰(작은) 분수 찾기와 범위에 드는 분자 세기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    if (difficulty === 3) {
      // a/b < □/c < d/e 를 만족하는 자연수 □의 개수. 개수가 0인 문항은 다시 만든다.
      const countIn = ({ pair, c }) => {
        let count = 0;
        for (let k = 1; k < c; k += 1) if (k * pair[0].d > pair[0].n * c && k * pair[1].d < pair[1].n * c) count += 1;
        return count;
      };
      const { pair, c } = rng.until(() => {
        const f1 = properFraction(rng, 2, 12);
        const f2 = properFraction(rng, 2, 12);
        return { pair: f1.n * f2.d < f2.n * f1.d ? [f1, f2] : [f2, f1], c: intAvoid(rng, 6, 40, [f1.d, f2.d]) };
      }, (x) => countIn(x) > 0, 100);
      const v = countIn({ pair, c });
      const lowN = Math.floor((pair[0].n * c) / pair[0].d) + 1;
      const highN = Math.ceil((pair[1].n * c) / pair[1].d) - 1;
      const L3 = lcm(lcm(pair[0].d, pair[1].d), c);
      return {
        params: { kind: 'count', lo: pair[0], hi: pair[1], c },
        instruction: '물음에 답하시오.',
        stem: `${pair[0].n}/${pair[0].d} < □/${c} < ${pair[1].n}/${pair[1].d}에서 □ 안에 들어갈 수 있는 자연수는 모두 몇 개입니까?`,
        answer: { value: v, display: `${v}개`, accepts: [num(v), `${v}개`] },
        solution: [
          `세 분수를 분모 ${numRo(L3)} 통분하여 분자를 비교한다.`,
          `□/${c}의 분자는 ${lowN}부터 ${highN}까지이므로 ${v}개이다.`,
        ],
        dedupeKey: `cmp-set:count:${pair[0].n}/${pair[0].d}:${c}:${pair[1].n}/${pair[1].d}`,
        difficulty,
      };
    }
    const k = difficulty === 1 ? 3 : 4;
    const dHi = difficulty === 1 ? 12 : 15;
    const fracs = [];
    const usedD = [];
    while (fracs.length < k) {
      const d = intAvoid(rng, 2, dHi, usedD);
      const n = properFraction(rng, d, d).n;
      if (fracs.some((f) => f.n * d === n * f.d)) {
        usedD.push(d);
        continue;
      }
      usedD.push(d);
      fracs.push({ n, d });
    }
    const largest = rng.bool();
    const best = fracs.reduce((m, f) => ((largest ? f.n * m.d > m.n * f.d : f.n * m.d < m.n * f.d) ? f : m));
    const list = fracs.map((f) => `${f.n}/${f.d}`);
    const v = `${best.n}/${best.d}`;
    const L = fracs.reduce((acc, f) => lcm(acc, f.d), 1);
    return {
      params: { kind: largest ? 'largest' : 'smallest', list },
      instruction: '물음에 답하시오.',
      stem: `${list.join(', ')} 중에서 가장 ${largest ? '큰' : '작은'} 분수를 쓰시오.`,
      answer: { value: v, display: v, accepts: [v] },
      solution: [
        `분모의 최소공배수 ${numRo(L)} 통분하면 ${fracs.map((f) => `${(f.n * L) / f.d}/${L}`).join(', ')}이다.`,
        `분자가 가장 ${largest ? '큰' : '작은'} 것은 ${v}이다.`,
      ],
      dedupeKey: `cmp-set:${largest ? 'max' : 'min'}:${[...list].sort().join(',')}`,
      difficulty,
    };
  },
  verify(params, answer) {
    if (params.kind === 'count') {
      const v = answer.value;
      if (!Number.isInteger(v) || v < 0) return false;
      const { lo, hi, c } = params;
      // 분자를 하나씩 넣어 두 부등식을 교차 곱으로 확인하며 센다.
      let count = 0;
      for (let k = 1; k <= c; k += 1) if (k * lo.d > lo.n * c && k * hi.d < hi.n * c) count += 1;
      return count === v;
    }
    const at = params.list.indexOf(answer.value);
    if (at < 0) return false;
    const [n, d] = params.list[at].split('/').map(Number);
    return params.list.every((s, i) => {
      if (i === at) return true;
      const [n2, d2] = s.split('/').map(Number);
      return params.kind === 'largest' ? n * d2 > n2 * d : n * d2 < n2 * d;
    });
  },
};

/** 가분수 분자끼리 더하거나 빼기 위해 두 분모의 곱으로 맞춘다(통분은 최소공배수로 했으므로 다른 경로). */
function ratAdd(x, y, sign = 1) {
  return { n: x.n * y.d + sign * y.n * x.d, d: x.d * y.d };
}
const ratEq = (p, r) => p !== null && p.n * r.d === r.n * p.d;

const FRACTION_ADD_SCENES = {
  total: (x, y, u) => `우유를 어제는 ${x}${u}, 오늘은 ${y}${u} 마셨습니다. 이틀 동안 마신 우유는 모두 몇 ${u}입니까?`,
  remain: (x, y, u) => `끈 ${x}${u} 중에서 ${y}${u}${particle('미터', '을', '를')} 사용했습니다. 남은 끈은 몇 ${u}입니까?`,
  diff: (x, y, u) => `빨간 리본은 ${x}${u}이고, 파란 리본은 ${y}${u}입니다. 빨간 리본은 파란 리본보다 몇 ${u} 더 깁니까?`,
};

const fractionAddSubStory = {
  id: 'math.g56.no.s08.fraction-story',
  standardCode: '[6수01-08]',
  skill: '분모가 다른 분수의 덧셈과 뺄셈 문장제 해결하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    // 분모를 먼저 서로 다르게 정한 뒤 분수를 만든다.
    const withDen = (d) => {
      const ns = [];
      for (let n = 1; n < d; n += 1) if (gcd(n, d) === 1) ns.push(n);
      const w = difficulty === 1 ? 0 : rng.int(1, difficulty === 2 ? 6 : 9);
      return { n: w * d + rng.pick(ns), d };
    };
    const dMax = difficulty === 1 ? 15 : 12;
    const d1 = rng.int(2, dMax);
    const d2 = intAvoid(rng, 2, dMax, [d1]);
    if (difficulty === 3 && rng.bool()) {
      const x = withDen(d1);
      const y = withDen(d2);
      let z = withDen(rng.int(2, 12));
      const sum = ratAdd(x, y);
      if (z.n * sum.d >= sum.n * z.d) z = { n: z.n % z.d, d: z.d };
      const r = ratAdd(sum, z, -1);
      const display = fmtRational(r.n, r.d);
      const [tx, ty, tz] = [x, y, z].map(fracText);
      return {
        params: { kind: 'three', terms: [x, y, z], signs: [1, 1, -1] },
        instruction: '답을 기약분수로 나타내시오.',
        stem: `물통에 물이 ${tx}L 들어 있었습니다. 물을 ${ty}L 더 부은 뒤 ${tz}L${particle('리터', '을', '를')} 사용했습니다. 물통에 남은 물은 몇 L입니까?`,
        answer: { value: display, display: `${display}L`, accepts: [display, `${display}L`] },
        solution: [
          `식으로 나타내면 ${tx} + ${ty} - ${tz}이다.`,
          `대분수를 가분수로 바꾸면 ${x.n}/${x.d} + ${y.n}/${y.d} - ${z.n}/${z.d}이다.`,
          '분모를 통분하여 앞에서부터 차례로 계산한다.',
          `남은 물은 ${display}L이다.`,
        ],
        dedupeKey: `frac-story:three:${tx}+${ty}-${tz}`,
        difficulty,
      };
    }
    const kind = rng.pick(['total', 'remain', 'diff']);
    let [p, q] = [withDen(d1), withDen(d2)];
    // 분모가 다르고 분수 부분이 기약이므로 두 수는 같을 수 없다.
    if (kind !== 'total' && p.n * q.d < q.n * p.d) [p, q] = [q, p];
    const r = ratAdd(p, q, kind === 'total' ? 1 : -1);
    const display = fmtRational(r.n, r.d);
    const unit = kind === 'total' ? 'L' : 'm';
    const [tp, tq] = [fracText(p), fracText(q)];
    const L = lcm(p.d, q.d);
    return {
      params: { kind, terms: [p, q], signs: [1, kind === 'total' ? 1 : -1] },
      instruction: '답을 기약분수로 나타내시오.',
      stem: FRACTION_ADD_SCENES[kind](tp, tq, unit),
      answer: { value: display, display: `${display}${unit}`, accepts: [display, `${display}${unit}`] },
      solution: [
        `식으로 나타내면 ${tp} ${kind === 'total' ? '+' : '-'} ${tq}이다.`,
        ...(difficulty === 1 ? [] : [`대분수를 가분수로 바꾸면 ${p.n}/${p.d} ${kind === 'total' ? '+' : '-'} ${q.n}/${q.d}이다.`]),
        `두 분모의 최소공배수 ${numRo(L)} 통분하여 계산한다.`,
        `답은 ${display}${unit}이다.`,
      ],
      dedupeKey: `frac-story:${kind}:${tp}:${tq}`,
      difficulty,
    };
  },
  verify({ terms, signs }, answer) {
    const p = parseCanonical(answer.value);
    if (p === null) return false;
    let acc = { n: 0, d: 1 };
    terms.forEach((t, i) => { acc = ratAdd(acc, t, signs[i]); });
    return acc.n > 0 && ratEq(p, acc);
  },
};

const fractionTimesStory = {
  id: 'math.g56.no.s09.fraction-times-story',
  standardCode: '[6수01-09]',
  skill: '분수의 곱셈 문장제 해결하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = rng.pick(difficulty === 1 ? ['per-unit', 'of-whole'] : difficulty === 2 ? ['per-unit', 'part-of-part'] : ['per-unit', 'area']);
    let x;
    let y;
    let stem;
    let unit = '';
    if (kind === 'of-whole') {
      const f = properFraction(rng, 2, 15);
      const total = f.d * rng.int(2, 60);
      x = { n: total, d: 1 };
      y = f;
      const fx = `${f.n}/${f.d}`;
      stem = `어느 학교 학생 ${total}명 중 ${fx}${fractionParticle(fx, '이', '가')} 안경을 썼습니다. 안경을 쓴 학생은 몇 명입니까?`;
      unit = '명';
    } else if (kind === 'part-of-part') {
      x = properFraction(rng, 2, 15);
      y = properFraction(rng, 2, 15);
      stem = `밭 전체의 ${x.n}/${x.d}에 채소를 심고, 채소를 심은 부분의 ${y.n}/${y.d}에 배추를 심었습니다. 배추를 심은 부분은 밭 전체의 얼마입니까?`;
    } else if (kind === 'area') {
      x = mixedFraction(rng, 2, 12, 1, 9);
      y = mixedFraction(rng, 2, 12, 1, 9);
      stem = `가로가 ${fracText(x)}m, 세로가 ${fracText(y)}m인 직사각형 모양 꽃밭의 넓이는 몇 m²입니까?`;
      unit = 'm²';
    } else {
      x = difficulty === 1 ? properFraction(rng, 2, 15) : mixedFraction(rng, 2, 12, 1, difficulty === 2 ? 6 : 9);
      y = difficulty === 1 ? { n: rng.int(2, 50), d: 1 } : difficulty === 2 ? properFraction(rng, 2, 15) : mixedFraction(rng, 2, 12, 1, 9);
      stem = `1m의 무게가 ${fracText(x)}kg인 철근이 있습니다. 이 철근 ${fracText(y)}m의 무게는 몇 kg입니까?`;
      unit = 'kg';
    }
    const display = fmtRational(x.n * y.n, x.d * y.d);
    const whole = (x.n * y.n) % (x.d * y.d) === 0;
    return {
      params: { kind, x, y },
      instruction: whole ? '물음에 답하시오.' : '답을 기약분수로 나타내시오.',
      stem,
      answer: { value: display, display: `${display}${unit}`, accepts: unit ? [display, `${display}${unit}`] : [display] },
      solution: [
        `식으로 나타내면 ${fracText(x)} × ${fracText(y)}이다.`,
        ...([x, y].some((t) => t.d > 1 && t.n > t.d) ? [`대분수를 가분수로 바꾸면 ${x.n}/${x.d} × ${y.d === 1 ? y.n : `${y.n}/${y.d}`}이다.`] : []),
        '분자끼리, 분모끼리 곱한다.',
        `${x.n * y.n}/${x.d * y.d}${fractionParticle(`${x.n * y.n}/${x.d * y.d}`, '을', '를')} ${whole ? '자연수로' : '기약분수로'} 나타내면 ${display}이다.`,
      ],
      dedupeKey: `frac-times:${kind}:${fracText(x)}:${fracText(y)}`,
      difficulty,
    };
  },
  verify({ x, y }, answer) {
    const p = parseCanonical(answer.value);
    if (p === null) return false;
    // 곱을 한 수로 나누면 다른 수가 되어야 한다: p ÷ y = x
    return p.n * y.d * x.d === x.n * y.n * p.d;
  },
};

const fractionDivideStory = {
  id: 'math.g56.no.s11.fraction-divide-story',
  standardCode: '[6수01-11]',
  skill: '분수의 나눗셈 문장제 해결하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = rng.pick(difficulty === 1 ? ['containers', 'cut'] : difficulty === 2 ? ['by-natural', 'per-one'] : ['per-one', 'unknown']);
    let dividend;
    let divisor;
    let stem;
    let unit = '';
    if (kind === 'containers') {
      divisor = properFraction(rng, 2, 15);
      const k = rng.int(2, 40);
      dividend = { n: divisor.n * k, d: divisor.d };
      const g = gcd(dividend.n, dividend.d);
      dividend = { n: dividend.n / g, d: dividend.d / g };
      stem = `주스 ${fracText(dividend)}L${particle('리터', '을', '를')} 한 병에 ${divisor.n}/${divisor.d}L씩 나누어 담으면 몇 병이 됩니까?`;
      unit = '병';
    } else if (kind === 'cut') {
      divisor = properFraction(rng, 2, 15);
      const n = divisor.n * rng.int(1, 30);
      dividend = { n, d: 1 };
      if (n === divisor.n) dividend = { n: n * 2, d: 1 };
      stem = `끈 ${dividend.n}m를 ${divisor.n}/${divisor.d}m씩 자르면 몇 도막이 됩니까?`;
      unit = '도막';
    } else if (kind === 'by-natural') {
      dividend = rng.bool() ? properFraction(rng, 2, 15) : mixedFraction(rng, 2, 12, 1, 6);
      divisor = { n: rng.int(2, 20), d: 1 };
      stem = `찰흙 ${fracText(dividend)}kg을 ${divisor.n}명이 똑같이 나누어 가지면 한 명이 가지는 찰흙은 몇 kg입니까?`;
      unit = 'kg';
    } else if (kind === 'per-one') {
      divisor = difficulty === 2 ? properFraction(rng, 2, 15) : mixedFraction(rng, 2, 12, 1, 6);
      dividend = difficulty === 2 ? properFraction(rng, 2, 15) : mixedFraction(rng, 2, 12, 1, 9);
      stem = `길이가 ${fracText(divisor)}m인 막대의 무게가 ${fracText(dividend)}kg입니다. 이 막대 1m의 무게는 몇 kg입니까?`;
      unit = 'kg';
    } else {
      divisor = rng.bool() ? properFraction(rng, 2, 15) : mixedFraction(rng, 2, 12, 1, 5);
      dividend = mixedFraction(rng, 2, 12, 1, 12);
      const fs = fracText(divisor);
      const gs = fracText(dividend);
      stem = `어떤 수에 ${fs}${fractionParticle(fs, '을', '를')} 곱했더니 ${gs}${fractionParticle(gs, '이', '가')} 되었습니다. 어떤 수는 얼마입니까?`;
    }
    const display = fmtRational(dividend.n * divisor.d, dividend.d * divisor.n);
    const whole = (dividend.n * divisor.d) % (dividend.d * divisor.n) === 0;
    return {
      params: { kind, dividend, divisor },
      instruction: whole ? '물음에 답하시오.' : '답을 기약분수로 나타내시오.',
      stem,
      answer: { value: display, display: `${display}${unit}`, accepts: unit ? [display, `${display}${unit}`] : [display] },
      solution: [
        `식으로 나타내면 ${fracText(dividend)} ÷ ${fracText(divisor)}이다.`,
        ...([dividend, divisor].some((t) => t.d > 1 && t.n > t.d) ? [`대분수를 가분수로 바꾸면 ${dividend.n}/${dividend.d} ÷ ${divisor.d === 1 ? divisor.n : `${divisor.n}/${divisor.d}`}이다.`] : []),
        '나누는 수의 분모와 분자를 바꾸어 곱한다.',
        `계산하여 ${whole ? '자연수로' : '기약분수로'} 나타내면 ${display}이다.`,
      ],
      dedupeKey: `frac-div:${kind}:${fracText(dividend)}:${fracText(divisor)}`,
      difficulty,
    };
  },
  verify({ dividend, divisor }, answer) {
    const p = parseCanonical(answer.value);
    if (p === null) return false;
    // 몫 × 나누는 수 = 나누어지는 수
    return p.n * divisor.n * dividend.d === dividend.n * p.d * divisor.d;
  },
};

// ---------------------------------------------------------------------------
// [6수01-13] 소수의 곱셈 · [6수01-14] (자연수)÷(자연수)를 소수로 · [6수01-15] 소수의 나눗셈
// ---------------------------------------------------------------------------

/** 0으로 끝나지 않는 소수 단위 정수. */
const decUnits = (rng, lo, hi) => {
  const u = rng.int(lo, hi);
  return u % 10 === 0 ? u + rng.int(1, 9) : u;
};

const decimalTimesStory = {
  id: 'math.g56.no.s13.decimal-times-story',
  standardCode: '[6수01-13]',
  skill: '소수의 곱셈 문장제 해결하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = rng.pick(['per-meter', 'area', 'times', 'speed']);
    let x;
    let y;
    if (difficulty === 1) {
      x = { u: decUnits(rng, 11, 999), s: rng.pick([1, 2]) };
      y = { u: rng.int(2, 30), s: 0 };
    } else if (difficulty === 2) {
      x = { u: decUnits(rng, 11, 999), s: 1 };
      y = { u: decUnits(rng, 11, 99), s: 1 };
    } else {
      x = { u: decUnits(rng, 101, 9999), s: 2 };
      y = { u: decUnits(rng, 11, 999), s: rng.pick([1, 2]) };
    }
    if (kind === 'times' && y.s === 0) y = { u: y.u * 10 + rng.int(1, 9), s: 1 };
    // 철근 1m의 무게는 0.1kg~10kg 안에서 정한다.
    if (kind === 'per-meter') x = { u: decUnits(rng, x.s === 1 ? 11 : 101, x.s === 1 ? 99 : 999), s: x.s };
    const tx = fmtDec(x.u, x.s);
    const ty = fmtDec(y.u, y.s);
    const v = fmtDec(x.u * y.u, x.s + y.s);
    const S = {
      'per-meter': [`1m의 무게가 ${tx}kg인 철근이 있습니다. 이 철근 ${ty}m의 무게는 몇 kg입니까?`, 'kg'],
      area: [`가로가 ${tx}m, 세로가 ${ty}m인 직사각형 모양 텃밭의 넓이는 몇 m²입니까?`, 'm²'],
      times: [`가방의 무게는 ${tx}kg이고, 상자의 무게는 가방 무게의 ${ty}배입니다. 상자의 무게는 몇 kg입니까?`, 'kg'],
      speed: [`한 시간에 ${tx}km를 가는 자전거가 같은 빠르기로 ${ty}시간 동안 가는 거리는 몇 km입니까?`, 'km'],
    }[kind];
    return {
      params: { x, y },
      instruction: '물음에 답하시오.',
      stem: S[0],
      answer: { value: v, display: `${v}${S[1]}`, accepts: [v, `${v}${S[1]}`] },
      solution: [
        `식으로 나타내면 ${tx} × ${ty}이다.`,
        `자연수처럼 ${x.u} × ${y.u} = ${numEul(x.u * y.u)} 계산하고, 소수점 아래 자리 수 ${x.s} + ${y.s} = ${x.s + y.s}만큼 소수점을 옮긴다.`,
        `답은 ${v}${S[1]}이다.`,
      ],
      dedupeKey: `dec-times:${kind}:${tx}:${ty}`,
      difficulty,
    };
  },
  verify({ x, y }, answer) {
    const p = parseDec(answer.value);
    if (p === null) return false;
    // 답 ÷ 곱하는 수 = 곱해지는 수 를 정수로 바꾸어 확인한다.
    return p.units * 10 ** (x.s + y.s) === x.u * y.u * 10 ** p.scale;
  },
};

const naturalQuotientDecimal = {
  id: 'math.g56.no.s14.natural-quotient-decimal',
  standardCode: '[6수01-14]',
  skill: '(자연수)÷(자연수)의 몫을 소수로 나타내기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const b = rng.pick(difficulty === 1 ? [2, 4, 5] : difficulty === 2 ? [4, 5, 8, 20, 25, 40, 50] : [8, 16, 25, 40, 80, 125]);
    const aRaw = rng.int(difficulty === 1 ? 3 : 10, difficulty === 1 ? 5000 : difficulty === 2 ? 9999 : 99999);
    const a = aRaw % b === 0 ? aRaw + 1 : aRaw;
    let scale = 0;
    while ((a * 10 ** scale) % b !== 0) scale += 1;
    const v = fmtDec((a * 10 ** scale) / b, scale);
    const story = difficulty === 3 || rng.bool();
    const stem = story
      ? `길이가 ${a}cm인 리본을 ${b}명이 똑같이 나누어 가지려고 합니다. 한 명이 가지는 리본은 몇 cm입니까?`
      : `${a} ÷ ${b}의 몫을 소수로 나타내시오.`;
    return {
      params: { a, b },
      instruction: story ? '몫을 소수로 나타내어 답을 구하시오.' : '계산하시오.',
      stem,
      answer: { value: v, display: story ? `${v}cm` : v, accepts: story ? [v, `${v}cm`] : [v] },
      solution: [
        `${a} ÷ ${b}에서 나누어떨어지지 않으면 ${a}${numberParticle(a, '을', '를')} ${a}.0, ${a}.00처럼 생각하여 계속 나눈다.`,
        `몫은 ${v}이다.`,
      ],
      dedupeKey: `nat-quot-dec:${a}:${b}:${story ? 's' : 'e'}`,
      difficulty,
    };
  },
  verify({ a, b }, answer) {
    const p = parseDec(answer.value);
    // 몫 × 나누는 수 = 나누어지는 수
    return p !== null && p.units * b === a * 10 ** p.scale;
  },
};

const decimalDivideStory = {
  id: 'math.g56.no.s15.decimal-divide-story',
  standardCode: '[6수01-15]',
  skill: '소수의 나눗셈 문장제 해결하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = rng.pick(difficulty === 1 ? ['share', 'count'] : difficulty === 2 ? ['per-unit', 'count', 'cut'] : ['per-unit', 'speed', 'cut']);
    let dividend;
    let divisor;
    let q;
    if (kind === 'share') {
      q = { u: decUnits(rng, 11, 499), s: 1 };
      divisor = { u: rng.int(2, 20), s: 0 };
    } else if (kind === 'count') {
      divisor = { u: decUnits(rng, 2, difficulty === 1 ? 50 : 99), s: 1 };
      q = { u: rng.int(2, difficulty === 1 ? 40 : 99), s: 0 };
    } else if (kind === 'cut') {
      // 자연수 ÷ 소수: 몫 × 나누는 수가 자연수가 되도록 몫을 고른다.
      divisor = { u: decUnits(rng, 2, difficulty === 3 ? 99 : 49), s: 1 };
      const step = 10 / gcd(divisor.u, 10);
      q = { u: step * rng.int(1, Math.floor((difficulty === 3 ? 400 : 80) / step) + 1), s: 0 };
    } else {
      divisor = { u: decUnits(rng, 11, 99), s: 1 };
      q = { u: decUnits(rng, 11, difficulty === 3 ? 9999 : 999), s: difficulty === 3 ? 2 : 1 };
    }
    dividend = { u: q.u * divisor.u, s: q.s + divisor.s };
    if (kind === 'cut') {
      // 나누어지는 수를 자연수 꼴로 정리한다.
      while (dividend.s > 0 && dividend.u % 10 === 0) dividend = { u: dividend.u / 10, s: dividend.s - 1 };
    }
    const tA = fmtDec(dividend.u, dividend.s);
    const tB = fmtDec(divisor.u, divisor.s);
    const v = fmtDec(q.u, q.s);
    const S = {
      share: [`우유 ${tA}L${particle('리터', '을', '를')} ${tB}명이 똑같이 나누어 마시면 한 명이 마시는 우유는 몇 L입니까?`, 'L'],
      count: [`물 ${tA}L${particle('리터', '을', '를')} 한 병에 ${tB}L씩 나누어 담으면 몇 병이 됩니까?`, '병'],
      cut: [`끈 ${tA}m${particle('미터', '을', '를')} ${tB}m씩 자르면 몇 도막이 됩니까?`, '도막'],
      'per-unit': [`길이가 ${tB}m인 막대의 무게가 ${tA}kg입니다. 이 막대 1m의 무게는 몇 kg입니까?`, 'kg'],
      speed: [`자동차가 같은 빠르기로 ${tB}시간 동안 ${tA}km를 갔습니다. 이 자동차가 한 시간 동안 간 거리는 몇 km입니까?`, 'km'],
    }[kind];
    return {
      params: { dividend, divisor },
      instruction: '물음에 답하시오.',
      stem: S[0],
      answer: { value: v, display: `${v}${S[1]}`, accepts: [v, `${v}${S[1]}`] },
      solution: [
        `식으로 나타내면 ${tA} ÷ ${tB}이다.`,
        divisor.s > 0 ? '나누는 수가 자연수가 되도록 두 수의 소수점을 같은 자리만큼 옮겨 계산한다.' : '나누어지는 수의 소수점 위치에 맞추어 몫의 소수점을 찍는다.',
        `답은 ${v}${S[1]}이다.`,
      ],
      dedupeKey: `dec-div:${kind}:${tA}:${tB}`,
      difficulty,
    };
  },
  verify({ dividend, divisor }, answer) {
    const p = parseDec(answer.value);
    if (p === null) return false;
    // 몫 × 나누는 수 = 나누어지는 수 (모두 정수 단위로 맞춘다)
    return p.units * divisor.u * 10 ** dividend.s === dividend.u * 10 ** (p.scale + divisor.s);
  },
};

// ---------------------------------------------------------------------------
// [6수03-11] 둘레 · [6수03-12] 넓이 단위 · [6수03-14] 여러 도형의 넓이
// ---------------------------------------------------------------------------

const rectilinearPerimeter = {
  id: 'math.g56.rm.s03-11.rectilinear-perimeter',
  standardCode: '[6수03-11]',
  skill: '직사각형을 자르거나 이어 붙인 도형의 둘레 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = rng.pick(difficulty === 1 ? ['corner'] : difficulty === 2 ? ['join', 'notch'] : ['notch', 'notch-inverse', 'join']);
    const hi = difficulty === 1 ? 40 : difficulty === 2 ? 70 : 120;
    if (kind === 'corner') {
      const W = rng.int(6, hi);
      const H = rng.int(6, hi);
      const a = rng.int(1, W - 1);
      const b = rng.int(1, H - 1);
      const v = 2 * (W + H);
      return {
        params: { kind, segments: [W, H, W - a, b, a, H - b] },
        instruction: '물음에 답하시오.',
        stem: `가로가 ${W}cm, 세로가 ${H}cm인 직사각형의 한 귀퉁이에서 가로가 ${a}cm, 세로가 ${b}cm인 직사각형을 잘라 냈습니다. 남은 도형의 둘레는 몇 cm입니까?`,
        answer: { value: v, display: `${v}cm`, accepts: [num(v), `${v}cm`] },
        solution: ['잘라 낸 부분의 두 변을 옮기면 처음 직사각형의 둘레와 같다.', `(${W} + ${H}) × 2 = ${v}이므로 ${v}cm이다.`],
        dedupeKey: `rect-perim:corner:${W}:${H}:${a}:${b}`,
        difficulty,
      };
    }
    if (kind === 'join') {
      const a = rng.int(3, hi);
      const b = rng.int(3, hi);
      const h1 = rng.int(3, hi);
      const h2 = intAvoid(rng, 3, hi, [h1]);
      const v = 2 * (a + b) + 2 * Math.max(h1, h2);
      return {
        params: { kind, segments: [a, h1, a, b, h2, b, Math.abs(h1 - h2), h1 > h2 ? h1 : h2] },
        instruction: '물음에 답하시오.',
        stem: `가로가 ${a}cm, 세로가 ${h1}cm인 직사각형과 가로가 ${b}cm, 세로가 ${h2}cm인 직사각형을 아랫변이 한 직선 위에 놓이도록 겹치지 않게 이어 붙였습니다. 만든 도형의 둘레는 몇 cm입니까?`,
        answer: { value: v, display: `${v}cm`, accepts: [num(v), `${v}cm`] },
        solution: [
          `두 직사각형의 둘레의 합은 (${a} + ${h1}) × 2 + (${b} + ${h2}) × 2 = ${2 * (a + h1) + 2 * (b + h2)}cm이다.`,
          `맞닿은 ${Math.min(h1, h2)}cm는 둘레가 아니므로 두 번 빼면 ${v}cm이다.`,
        ],
        dedupeKey: `rect-perim:join:${a}:${h1}:${b}:${h2}`,
        difficulty,
      };
    }
    const W = rng.int(8, hi);
    const H = rng.int(5, hi);
    const a = rng.int(1, W - 4);
    const b = rng.int(1, H - 1);
    const P = 2 * (W + H) + 2 * b;
    const segments = [W, H, W - a, b, a, b, H];
    if (kind === 'notch') {
      return {
        params: { kind, segments },
        instruction: '물음에 답하시오.',
        stem: `가로가 ${W}cm, 세로가 ${H}cm인 직사각형의 윗변에서 귀퉁이에 닿지 않게 가로가 ${a}cm, 세로가 ${b}cm인 직사각형을 잘라 냈습니다. 남은 도형의 둘레는 몇 cm입니까?`,
        answer: { value: P, display: `${P}cm`, accepts: [num(P), `${P}cm`] },
        solution: [
          `잘라 낸 아랫변은 윗변의 빈 곳을 채우므로 처음 직사각형의 둘레 (${W} + ${H}) × 2 = ${2 * (W + H)}cm가 그대로 남는다.`,
          `안쪽으로 생긴 세로 ${b}cm인 변 2개를 더하면 ${2 * (W + H)} + ${b} × 2 = ${P}cm이다.`,
        ],
        dedupeKey: `rect-perim:notch:${W}:${H}:${a}:${b}`,
        difficulty,
      };
    }
    return {
      params: { kind, W, H, P },
      instruction: '물음에 답하시오.',
      stem: `가로가 ${W}cm, 세로가 ${H}cm인 직사각형의 윗변에서 귀퉁이에 닿지 않게 가로가 ${a}cm인 직사각형을 잘라 냈더니 남은 도형의 둘레가 ${P}cm가 되었습니다. 잘라 낸 직사각형의 세로는 몇 cm입니까?`,
      answer: { value: b, display: `${b}cm`, accepts: [num(b), `${b}cm`] },
      solution: [
        `처음 직사각형의 둘레는 (${W} + ${H}) × 2 = ${2 * (W + H)}cm이다.`,
        `늘어난 ${P} - ${2 * (W + H)} = ${P - 2 * (W + H)}cm는 잘라 낸 직사각형의 세로 2개이므로 ${P - 2 * (W + H)} ÷ 2 = ${b}cm이다.`,
      ],
      dedupeKey: `rect-perim:notch-inv:${W}:${H}:${a}:${P}`,
      difficulty,
    };
  },
  verify(params, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    if (params.kind === 'notch-inverse') {
      const { W, H, P } = params;
      // 세로를 넣어 변을 하나씩 더해 둘레를 다시 만든다.
      return v < H && W + H + W + H + v + v === P;
    }
    // 도형의 변을 한 바퀴 돌며 더한다. 같은 길이의 맞은편 변은 목록의 앞쪽 값으로 대신한다.
    const s = params.segments;
    if (params.kind === 'corner') return s[0] + s[1] + s[2] + s[3] + s[4] + s[5] === v;
    if (params.kind === 'join') return s[0] + s[1] + s[3] + s[4] + (s[0] + s[3]) + s[6] === v;
    return s[0] + s[1] + s[1] + s[2] + s[3] + s[4] + s[5] === v;
  },
};

const areaUnitStory = {
  id: 'math.g56.rm.s03-12.area-unit-story',
  standardCode: '[6수03-12]',
  skill: '길이의 단위가 섞인 직사각형의 넓이를 cm²·m²·km²로 나타내기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = rng.pick(difficulty === 1 ? ['cm-to-m2', 'm-to-cm2'] : difficulty === 2 ? ['m-to-km2', 'km-m-to-m2', 'cm-to-m2'] : ['convert-m2', 'convert-cm2', 'convert-km2', 'm-to-km2']);
    const thing = rng.pick(['종이', '돗자리', '게시판', '유리판']);
    if (kind === 'cm-to-m2' || kind === 'm-to-cm2') {
      const x = 10 * rng.int(5, 150);
      const y = 10 * rng.int(5, 150);
      if (kind === 'cm-to-m2') {
        const v = fmtDec((x * y) / 100, 2);
        return {
          params: { kind, x, y },
          instruction: '물음에 답하시오.',
          stem: `가로가 ${x}cm, 세로가 ${y}cm인 직사각형 모양 ${thing}의 넓이는 몇 m²입니까?`,
          answer: { value: v, display: `${v}m²`, accepts: [v, `${v}m²`] },
          solution: [`${x}cm = ${fmtDec(x, 2)}m, ${y}cm = ${fmtDec(y, 2)}m이다.`, `${fmtDec(x, 2)} × ${fmtDec(y, 2)} = ${v}이므로 ${v}m²이다.`],
          dedupeKey: `area-unit-story:${kind}:${x}:${y}`,
          difficulty,
        };
      }
      const v = x * y;
      return {
        params: { kind, x, y },
        instruction: '물음에 답하시오.',
        stem: `가로가 ${fmtDec(x, 2)}m, 세로가 ${fmtDec(y, 2)}m인 직사각형 모양 ${thing}의 넓이는 몇 cm²입니까?`,
        answer: { value: v, display: `${v}cm²`, accepts: [num(v), `${v}cm²`] },
        solution: [`${fmtDec(x, 2)}m = ${x}cm, ${fmtDec(y, 2)}m = ${y}cm이다.`, `${x} × ${y} = ${v}이므로 ${v}cm²이다.`],
        dedupeKey: `area-unit-story:${kind}:${x}:${y}`,
        difficulty,
      };
    }
    if (kind === 'm-to-km2') {
      const x = 100 * rng.int(1, difficulty === 2 ? 50 : 90);
      const y = 100 * intAvoid(rng, 1, difficulty === 2 ? 50 : 90, [10, 20, 30, 40, 50, 60, 70, 80, 90]);
      const v = fmtDec((x * y) / 10000, 2);
      return {
        params: { kind, x, y },
        instruction: '물음에 답하시오.',
        stem: `가로가 ${x}m, 세로가 ${y}m인 직사각형 모양 땅의 넓이는 몇 km²입니까?`,
        answer: { value: v, display: `${v}km²`, accepts: [v, `${v}km²`] },
        solution: [`${x}m = ${fmtDec(x / 10, 2)}km, ${y}m = ${fmtDec(y / 10, 2)}km이다.`, `${fmtDec(x / 10, 2)} × ${fmtDec(y / 10, 2)} = ${v}이므로 ${v}km²이다.`],
        dedupeKey: `area-unit-story:${kind}:${x}:${y}`,
        difficulty,
      };
    }
    if (kind === 'km-m-to-m2') {
      const x = 100 * rng.int(1, 50);
      const y = 10 * rng.int(1, 500);
      const v = x * y;
      return {
        params: { kind, x, y },
        instruction: '물음에 답하시오.',
        stem: `가로가 ${fmtDec(x / 100, 1)}km, 세로가 ${y}m인 직사각형 모양 땅의 넓이는 몇 m²입니까?`,
        answer: { value: v, display: `${v}m²`, accepts: [num(v), `${v}m²`] },
        solution: [`${fmtDec(x / 100, 1)}km = ${x}m이다.`, `${x} × ${y} = ${v}이므로 ${v}m²이다.`],
        dedupeKey: `area-unit-story:${kind}:${x}:${y}`,
        difficulty,
      };
    }
    // 단위 바꾸기: 1m² = 10000cm², 1km² = 1000000m²
    if (kind === 'convert-m2') {
      const h = decUnits(rng, 101, 99999);
      const v = h * 100;
      return {
        params: { kind, h },
        instruction: '□ 안에 알맞은 수를 써넣으시오.',
        stem: `${fmtDec(h, 2)}m² = □cm²`,
        answer: { value: v, display: `${v}cm²`, accepts: [num(v), `${v}cm²`] },
        solution: ['1m² = 10000cm²이다.', `${fmtDec(h, 2)} × 10000 = ${v}이다.`],
        dedupeKey: `area-unit-story:${kind}:${h}`,
        difficulty,
      };
    }
    if (kind === 'convert-cm2') {
      const c = 100 * decUnits(rng, 11, 99999);
      const v = fmtDec(c / 100, 2);
      return {
        params: { kind, c },
        instruction: '□ 안에 알맞은 수를 써넣으시오.',
        stem: `${c}cm² = □m²`,
        answer: { value: v, display: `${v}m²`, accepts: [v, `${v}m²`] },
        solution: ['10000cm² = 1m²이다.', `${c} ÷ 10000 = ${v}이다.`],
        dedupeKey: `area-unit-story:${kind}:${c}`,
        difficulty,
      };
    }
    const h = decUnits(rng, 11, 9999);
    const v = h * 10000;
    return {
      params: { kind, h },
      instruction: '□ 안에 알맞은 수를 써넣으시오.',
      stem: `${fmtDec(h, 2)}km² = □m²`,
      answer: { value: v, display: `${v}m²`, accepts: [num(v), `${v}m²`] },
      solution: ['1km² = 1000000m²이다.', `${fmtDec(h, 2)} × 1000000 = ${v}이다.`],
      dedupeKey: `area-unit-story:${kind}:${h}`,
      difficulty,
    };
  },
  verify(params, answer) {
    const { kind } = params;
    if (kind === 'cm-to-m2' || kind === 'm-to-km2' || kind === 'convert-cm2') {
      const p = parseDec(answer.value);
      if (p === null) return false;
      // 답을 작은 단위로 되돌려 넓이와 비교한다. (m²·km² 0.01 단위)
      const hundredths = kind === 'convert-cm2' ? params.c / 100 : (params.x * params.y) / (kind === 'cm-to-m2' ? 100 : 10000);
      return p.units * 100 === hundredths * 10 ** p.scale;
    }
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    if (kind === 'm-to-cm2' || kind === 'km-m-to-m2') return v % params.x === 0 && v / params.x === params.y;
    if (kind === 'convert-m2') return v % 100 === 0 && v / 100 === params.h;
    return v % 10000 === 0 && v / 10000 === params.h;
  },
};

const compositePolygonArea = {
  id: 'math.g56.rm.s03-14.composite-polygon-area',
  standardCode: '[6수03-14]',
  skill: '평행사변형·삼각형·사다리꼴·마름모를 합치거나 뺀 넓이와 넓이가 같은 도형의 길이 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = rng.pick(difficulty === 1 ? ['rhombus-in-rect', 'para-plus-tri'] : difficulty === 2 ? ['rect-minus-tri', 'para-plus-tri', 'trap-base'] : ['trap-base', 'equal-area', 'rect-minus-tri']);
    const hi = difficulty === 1 ? 40 : difficulty === 2 ? 50 : 90;
    if (kind === 'rhombus-in-rect') {
      const W = rng.int(4, hi);
      const H0 = rng.int(4, hi);
      const H = (W * H0) % 2 === 0 ? H0 : H0 + 1;
      const v = (W * H) / 2;
      return {
        params: { kind, nums: [W, H] },
        instruction: '물음에 답하시오.',
        stem: `가로가 ${W}cm, 세로가 ${H}cm인 직사각형의 네 변의 가운데 점을 차례로 이어 마름모를 그렸습니다. 마름모의 넓이는 몇 cm²입니까?`,
        answer: { value: v, display: `${v}cm²`, accepts: [num(v), `${v}cm²`] },
        solution: [`마름모의 두 대각선은 ${W}cm, ${H}cm이다.`, `${W} × ${H} ÷ 2 = ${v}이므로 ${v}cm²이다.`],
        dedupeKey: `poly-area:rhombus:${W}:${H}`,
        difficulty,
      };
    }
    if (kind === 'para-plus-tri') {
      const a = rng.int(3, hi);
      const h = rng.int(3, hi);
      const c0 = rng.int(3, hi);
      const c = (c0 * h) % 2 === 0 ? c0 : c0 + 1;
      const v = a * h + (c * h) / 2;
      return {
        params: { kind, nums: [a, h, c] },
        instruction: '물음에 답하시오.',
        stem: `밑변이 ${a}cm, 높이가 ${h}cm인 평행사변형과 밑변이 ${c}cm, 높이가 ${h}cm인 삼각형을 겹치지 않게 붙여 만든 도형의 넓이는 몇 cm²입니까?`,
        answer: { value: v, display: `${v}cm²`, accepts: [num(v), `${v}cm²`] },
        solution: [`평행사변형의 넓이는 ${a} × ${h} = ${a * h}cm², 삼각형의 넓이는 ${c} × ${h} ÷ 2 = ${(c * h) / 2}cm²이다.`, `${a * h} + ${(c * h) / 2} = ${v}이므로 ${v}cm²이다.`],
        dedupeKey: `poly-area:para-tri:${a}:${h}:${c}`,
        difficulty,
      };
    }
    if (kind === 'rect-minus-tri') {
      const W = rng.int(6, hi);
      const H = rng.int(6, hi);
      const b = rng.int(2, W);
      const h0 = rng.int(2, H);
      const h = (b * h0) % 2 === 0 ? h0 : h0 === H ? h0 - 1 : h0 + 1;
      const v = W * H - (b * h) / 2;
      return {
        params: { kind, nums: [W, H, b, h] },
        instruction: '물음에 답하시오.',
        stem: `가로가 ${W}cm, 세로가 ${H}cm인 직사각형 모양 종이에서 밑변이 ${b}cm, 높이가 ${h}cm인 삼각형 모양을 잘라 냈습니다. 남은 종이의 넓이는 몇 cm²입니까?`,
        answer: { value: v, display: `${v}cm²`, accepts: [num(v), `${v}cm²`] },
        solution: [`직사각형의 넓이는 ${W} × ${H} = ${W * H}cm², 삼각형의 넓이는 ${b} × ${h} ÷ 2 = ${(b * h) / 2}cm²이다.`, `${W * H} - ${(b * h) / 2} = ${v}이므로 ${v}cm²이다.`],
        dedupeKey: `poly-area:rect-tri:${W}:${H}:${b}:${h}`,
        difficulty,
      };
    }
    if (kind === 'trap-base') {
      const a = rng.int(2, hi);
      const b = rng.int(a + 1, hi + 10);
      const h0 = rng.int(2, hi);
      const h = ((a + b) * h0) % 2 === 0 ? h0 : h0 + 1;
      const S = ((a + b) * h) / 2;
      return {
        params: { kind, nums: [S, a, h] },
        instruction: '물음에 답하시오.',
        stem: `넓이가 ${S}cm²이고 윗변이 ${a}cm, 높이가 ${h}cm인 사다리꼴의 아랫변은 몇 cm입니까?`,
        answer: { value: b, display: `${b}cm`, accepts: [num(b), `${b}cm`] },
        solution: [`(윗변 + 아랫변) = ${S} × 2 ÷ ${h} = ${a + b}cm이다.`, `아랫변은 ${a + b} - ${a} = ${b}cm이다.`],
        dedupeKey: `poly-area:trap-base:${S}:${a}:${h}`,
        difficulty,
      };
    }
    // 평행사변형과 넓이가 같은 삼각형의 밑변: 밑변 × 높이 ÷ 2 = a × h
    const a = rng.int(3, hi);
    const h = rng.int(3, hi);
    const divs = [];
    for (let k = 2; k <= Math.min(2 * a * h, 200); k += 1) if ((2 * a * h) % k === 0 && k !== h && (2 * a * h) / k !== a) divs.push(k);
    const h2 = rng.pick(divs);
    const v = (2 * a * h) / h2;
    return {
      params: { kind, nums: [a, h, h2] },
      instruction: '물음에 답하시오.',
      stem: `밑변이 ${a}cm, 높이가 ${h}cm인 평행사변형과 넓이가 같은 삼각형이 있습니다. 삼각형의 높이가 ${h2}cm라면 밑변은 몇 cm입니까?`,
      answer: { value: v, display: `${v}cm`, accepts: [num(v), `${v}cm`] },
      solution: [`평행사변형의 넓이는 ${a} × ${h} = ${a * h}cm²이다.`, `삼각형의 밑변은 ${a * h} × 2 ÷ ${h2} = ${v}cm이다.`],
      dedupeKey: `poly-area:equal:${a}:${h}:${h2}`,
      difficulty,
    };
  },
  verify({ kind, nums }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    // 넓이 공식을 두 배 꼴로 바꾸어 나눗셈 없이 확인한다.
    if (kind === 'rhombus-in-rect') return v * 2 === nums[0] * nums[1];
    if (kind === 'para-plus-tri') return v * 2 === 2 * nums[0] * nums[1] + nums[2] * nums[1];
    if (kind === 'rect-minus-tri') return v * 2 + nums[2] * nums[3] === 2 * nums[0] * nums[1];
    if (kind === 'trap-base') return (nums[1] + v) * nums[2] === nums[0] * 2 && v > nums[1];
    return v * nums[2] === 2 * nums[0] * nums[1];
  },
};

// ---------------------------------------------------------------------------
// [6수03-16] 원의 활용 · [6수03-17] 겉넓이 · [6수03-19] 부피
// ---------------------------------------------------------------------------

const circleApplied = {
  id: 'math.g56.rm.s03-16.circle-applied',
  standardCode: '[6수03-16]',
  skill: '굴러간 바퀴, 반원의 둘레, 두 원 사이의 넓이, 원주·넓이로 반지름 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = rng.pick(difficulty === 1 ? ['wheel-distance', 'radius-from-circ'] : difficulty === 2 ? ['wheel-distance', 'wheel-turns', 'semicircle'] : ['ring', 'radius-from-area', 'wheel-turns']);
    if (kind === 'wheel-distance' || kind === 'wheel-turns') {
      const d = rng.int(10, difficulty === 1 ? 99 : 150);
      const n = rng.int(2, difficulty === 1 ? 50 : 99);
      const dist = fmtDec(d * 314 * n, 2);
      if (kind === 'wheel-distance') {
        // 반지름을 주면 지름을 먼저 구하는 단계가 하나 더 있다.
        const byRadius = d % 2 === 0 && rng.bool();
        return {
          params: { kind, d, n },
          instruction: '원주율은 3.14로 계산하시오.',
          stem: `${byRadius ? `반지름이 ${d / 2}cm` : `지름이 ${d}cm`}인 바퀴가 ${n}바퀴 굴러간 거리는 몇 cm입니까?`,
          answer: { value: dist, display: `${dist}cm`, accepts: [dist, `${dist}cm`] },
          solution: [`바퀴가 한 바퀴 굴러간 거리는 원주이므로 ${d} × 3.14 = ${fmtDec(d * 314, 2)}cm이다.`, `${fmtDec(d * 314, 2)} × ${n} = ${dist}이므로 ${dist}cm이다.`],
          dedupeKey: `circle-app:wheel:${byRadius ? 'r' : 'd'}:${d}:${n}`,
          difficulty,
        };
      }
      return {
        params: { kind, d, distH: d * 314 * n },
        instruction: '원주율은 3.14로 계산하시오.',
        stem: `지름이 ${d}cm인 바퀴를 굴려 ${dist}cm${particle('미터', '을', '를')} 갔습니다. 바퀴는 몇 바퀴 굴렀습니까?`,
        answer: { value: n, display: `${n}바퀴`, accepts: [num(n), `${n}바퀴`] },
        solution: [`한 바퀴 굴러간 거리는 ${d} × 3.14 = ${fmtDec(d * 314, 2)}cm이다.`, `${dist} ÷ ${fmtDec(d * 314, 2)} = ${n}이므로 ${n}바퀴이다.`],
        dedupeKey: `circle-app:turns:${d}:${n}`,
        difficulty,
      };
    }
    if (kind === 'radius-from-circ') {
      const r = rng.int(2, 99);
      const C = fmtDec(2 * r * 314, 2);
      return {
        params: { kind, cH: 2 * r * 314 },
        instruction: '원주율은 3.14로 계산하시오.',
        stem: `원주가 ${C}cm인 원의 반지름은 몇 cm입니까?`,
        answer: { value: r, display: `${r}cm`, accepts: [num(r), `${r}cm`] },
        solution: [`지름은 ${C} ÷ 3.14 = ${2 * r}cm이다.`, `반지름은 ${2 * r} ÷ 2 = ${r}cm이다.`],
        dedupeKey: `circle-app:r-from-c:${r}`,
        difficulty,
      };
    }
    if (kind === 'semicircle') {
      const d = 2 * rng.int(2, 99);
      const v = fmtDec(d * 157 + d * 100, 2);
      return {
        params: { kind, d },
        instruction: '원주율은 3.14로 계산하시오.',
        stem: `지름이 ${d}cm인 반원의 둘레는 몇 cm입니까?`,
        answer: { value: v, display: `${v}cm`, accepts: [v, `${v}cm`] },
        solution: [`반원의 곡선 부분은 원주의 반이므로 ${d} × 3.14 ÷ 2 = ${fmtDec(d * 157, 2)}cm이다.`, `지름 ${d}cm를 더하면 ${v}cm이다.`],
        dedupeKey: `circle-app:semi:${d}`,
        difficulty,
      };
    }
    if (kind === 'ring') {
      const R = rng.int(3, 150);
      const r = rng.int(1, R - 1);
      const v = fmtDec((R * R - r * r) * 314, 2);
      return {
        params: { kind, R, r },
        instruction: '원주율은 3.14로 계산하시오.',
        stem: `반지름이 ${R}cm인 원 안에 중심이 같고 반지름이 ${r}cm인 원을 그렸습니다. 두 원 사이의 넓이는 몇 cm²입니까?`,
        answer: { value: v, display: `${v}cm²`, accepts: [v, `${v}cm²`] },
        solution: [
          `큰 원의 넓이는 ${R} × ${R} × 3.14 = ${fmtDec(R * R * 314, 2)}cm², 작은 원의 넓이는 ${r} × ${r} × 3.14 = ${fmtDec(r * r * 314, 2)}cm²이다.`,
          `두 넓이의 차는 ${v}cm²이다.`,
        ],
        dedupeKey: `circle-app:ring:${R}:${r}`,
        difficulty,
      };
    }
    // 제곱근을 배우지 않으므로 같은 수를 두 번 곱한 값을 쉽게 떠올릴 수 있는 반지름(2~15, 또는 몇십)만 쓴다.
    const r = rng.bool() ? rng.int(2, 15) : 10 * rng.int(2, 9);
    const S = fmtDec(r * r * 314, 2);
    const askD = rng.bool();
    const v = askD ? 2 * r : r;
    return {
      params: { kind, sH: r * r * 314, askD },
      instruction: '원주율은 3.14로 계산하시오.',
      stem: `넓이가 ${S}cm²인 원의 ${askD ? '지름' : '반지름'}은 몇 cm입니까?`,
      answer: { value: v, display: `${v}cm`, accepts: [num(v), `${v}cm`] },
      solution: [
        `(반지름) × (반지름) = ${S} ÷ 3.14 = ${r * r}이다.`,
        `${r} × ${r} = ${r * r}이므로 반지름은 ${r}cm이다.`,
        ...(askD ? [`지름은 ${r} × 2 = ${v}cm이다.`] : []),
      ],
      dedupeKey: `circle-app:r-from-s:${askD ? 'd' : 'r'}:${r}`,
      difficulty,
    };
  },
  verify(params, answer) {
    const { kind } = params;
    if (kind === 'wheel-turns' || kind === 'radius-from-circ' || kind === 'radius-from-area') {
      const v = answer.value;
      if (!Number.isInteger(v) || v <= 0) return false;
      if (kind === 'wheel-turns') return v * params.d * 314 === params.distH;
      if (kind === 'radius-from-circ') return (v + v) * 314 === params.cH;
      if (params.askD) return v % 2 === 0 && (v / 2) * (v / 2) * 314 === params.sH;
      return v * v * 314 === params.sH;
    }
    const p = parseDec(answer.value);
    if (p === null) return false;
    const h = p.units * 10 ** (2 - p.scale);
    if (p.scale > 2) return false;
    // 0.01 단위로 바꾸어 원주율 3.14(=314/100)로 나누어 되돌린다.
    if (kind === 'wheel-distance') return h % (params.d * 314) === 0 && h / (params.d * 314) === params.n;
    if (kind === 'semicircle') return h === params.d * 257;
    return h % 314 === 0 && h / 314 + params.r * params.r === params.R * params.R;
  },
};

const surfaceAreaPlus = {
  id: 'math.g56.rm.s03-17.surface-area-plus',
  standardCode: '[6수03-17]',
  skill: '겉넓이로 모서리 길이 구하기와 뚜껑 없는 상자의 겉넓이 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = rng.pick(difficulty === 1 ? ['cube-edge', 'open-box'] : difficulty === 2 ? ['open-box', 'cuboid-height'] : ['cuboid-height', 'open-box']);
    const hi = difficulty === 1 ? 30 : difficulty === 2 ? 40 : 70;
    if (kind === 'cube-edge') {
      // 제곱근을 쓰지 않도록 모서리는 2~15cm 또는 몇십cm만 쓴다.
      const e = rng.bool() ? rng.int(2, 15) : 10 * rng.int(2, 6);
      const S = 6 * e * e;
      return {
        params: { kind, S },
        instruction: '물음에 답하시오.',
        stem: `겉넓이가 ${S}cm²인 정육면체의 한 모서리는 몇 cm입니까?`,
        answer: { value: e, display: `${e}cm`, accepts: [num(e), `${e}cm`] },
        solution: [`정육면체는 넓이가 같은 면 6개로 이루어지므로 한 면의 넓이는 ${S} ÷ 6 = ${e * e}cm²이다.`, `${e} × ${e} = ${e * e}이므로 한 모서리는 ${e}cm이다.`],
        dedupeKey: `surface-plus:cube:${e}`,
        difficulty,
      };
    }
    if (kind === 'open-box') {
      const a = rng.int(2, hi);
      const b = rng.int(2, hi);
      const h = rng.int(2, hi);
      const v = a * b + 2 * h * (a + b);
      return {
        params: { kind, a, b, h },
        instruction: '물음에 답하시오.',
        stem: `가로가 ${a}cm, 세로가 ${b}cm, 높이가 ${h}cm인 뚜껑이 없는 직육면체 모양 상자가 있습니다. 상자의 바깥쪽 면의 넓이의 합은 몇 cm²입니까?`,
        answer: { value: v, display: `${v}cm²`, accepts: [num(v), `${v}cm²`] },
        solution: [
          `뚜껑이 없으므로 밑면 1개와 옆면 4개의 넓이만 더한다.`,
          `${a} × ${b} + (${a} + ${b} + ${a} + ${b}) × ${h} = ${v}이므로 ${v}cm²이다.`,
        ],
        dedupeKey: `surface-plus:open:${a}:${b}:${h}`,
        difficulty,
      };
    }
    const a = rng.int(2, hi);
    const b = rng.int(2, hi);
    const h = rng.int(2, hi);
    const S = 2 * (a * b + b * h + h * a);
    return {
      params: { kind, a, b, S },
      instruction: '물음에 답하시오.',
      stem: `겉넓이가 ${S}cm²이고 가로가 ${a}cm, 세로가 ${b}cm인 직육면체의 높이는 몇 cm입니까?`,
      answer: { value: h, display: `${h}cm`, accepts: [num(h), `${h}cm`] },
      solution: [
        `두 밑면의 넓이의 합은 ${a} × ${b} × 2 = ${2 * a * b}cm²이므로 옆면의 넓이는 ${S} - ${2 * a * b} = ${S - 2 * a * b}cm²이다.`,
        `옆면은 가로가 밑면의 둘레 ${2 * (a + b)}cm인 직사각형이므로 높이는 ${S - 2 * a * b} ÷ ${2 * (a + b)} = ${h}cm이다.`,
      ],
      dedupeKey: `surface-plus:height:${a}:${b}:${h}`,
      difficulty,
    };
  },
  verify(params, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    if (params.kind === 'cube-edge') return v * v * 6 === params.S;
    if (params.kind === 'open-box') {
      const { a, b, h } = params;
      // 다섯 면을 하나씩 더한다.
      return [a * b, a * h, a * h, b * h, b * h].reduce((s, x) => s + x, 0) === v;
    }
    const { a, b, S } = params;
    return 2 * (a * b + b * v + v * a) === S;
  },
};

const volumeMixedUnits = {
  id: 'math.g56.rm.s03-19.volume-mixed-units',
  standardCode: '[6수03-19]',
  skill: '단위가 섞인 직육면체의 부피를 m³·cm³로 구하고 부피로 모서리 길이 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = rng.pick(difficulty === 1 ? ['to-m3'] : difficulty === 2 ? ['to-m3', 'to-cm3'] : ['inverse', 'to-cm3', 'to-m3']);
    const hi = difficulty === 1 ? 40 : difficulty === 2 ? 50 : 60;
    const [a, b, c] = [0, 0, 0].map(() => 10 * rng.int(1, hi));
    // 100의 배수인 길이는 m로 바꾸어 보여 줄 수 있다(난이도 2 이상).
    const show = (x) => (difficulty > 1 && x % 100 === 0 && rng.bool() ? `${x / 100}m` : `${x}cm`);
    if (kind === 'to-m3') {
      const v = fmtDec((a * b * c) / 1000, 3);
      const [ta, tb, tc] = [a, b, c].map(show);
      return {
        params: { kind, a, b, c },
        instruction: '물음에 답하시오.',
        stem: `가로가 ${ta}, 세로가 ${tb}, 높이가 ${tc}인 직육면체의 부피는 몇 m³입니까?`,
        answer: { value: v, display: `${v}m³`, accepts: [v, `${v}m³`] },
        solution: [
          `모서리의 길이를 m로 나타내면 ${fmtDec(a, 2)}m, ${fmtDec(b, 2)}m, ${fmtDec(c, 2)}m이다.`,
          `${fmtDec(a, 2)} × ${fmtDec(b, 2)} × ${fmtDec(c, 2)} = ${v}이므로 ${v}m³이다.`,
        ],
        dedupeKey: `vol-units:to-m3:${a}:${b}:${c}`,
        difficulty,
      };
    }
    if (kind === 'to-cm3') {
      const v = a * b * c;
      return {
        params: { kind, a, b, c },
        instruction: '물음에 답하시오.',
        stem: `가로가 ${fmtDec(a, 2)}m, 세로가 ${fmtDec(b, 2)}m, 높이가 ${fmtDec(c, 2)}m인 직육면체의 부피는 몇 cm³입니까?`,
        answer: { value: v, display: `${v}cm³`, accepts: [num(v), `${v}cm³`] },
        solution: [`모서리의 길이를 cm로 나타내면 ${a}cm, ${b}cm, ${c}cm이다.`, `${a} × ${b} × ${c} = ${v}이므로 ${v}cm³이다.`],
        dedupeKey: `vol-units:to-cm3:${a}:${b}:${c}`,
        difficulty,
      };
    }
    const V = fmtDec((a * b * c) / 1000, 3);
    return {
      params: { kind, a, b, vThousandths: (a * b * c) / 1000 },
      instruction: '물음에 답하시오.',
      stem: `부피가 ${V}m³인 직육면체의 가로가 ${a}cm, 세로가 ${b}cm일 때 높이는 몇 cm입니까?`,
      answer: { value: c, display: `${c}cm`, accepts: [num(c), `${c}cm`] },
      solution: [`${V}m³ = ${a * b * c}cm³이다.`, `높이는 ${a * b * c} ÷ (${a} × ${b}) = ${c}cm이다.`],
      dedupeKey: `vol-units:inverse:${a}:${b}:${c}`,
      difficulty,
    };
  },
  verify(params, answer) {
    if (params.kind === 'to-m3') {
      const p = parseDec(answer.value);
      // m³ 답을 cm³로 되돌려(× 1000000) 세 모서리의 곱과 비교한다.
      return p !== null && p.units * 1000000 === params.a * params.b * params.c * 10 ** p.scale;
    }
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    if (params.kind === 'to-cm3') return v % (params.a * params.b) === 0 && v / (params.a * params.b) === params.c;
    return params.a * params.b * v === params.vThousandths * 1000;
  },
};

export const generators = [
  averageRecords,
  averageTarget,
  averageGroups,
  bandGraphRead,
  tableGraphSteps,
  experimentJudge,
  correspondenceInverse,
  ratioSituation,
  rateStory,
  proportionStory,
  proportionMixedTerms,
  shareAdvanced,
  mixedOpsStory,
  rangeCount,
  roundingStory,
  compareFractionsSet,
  fractionAddSubStory,
  fractionTimesStory,
  fractionDivideStory,
  decimalTimesStory,
  naturalQuotientDecimal,
  decimalDivideStory,
  rectilinearPerimeter,
  areaUnitStory,
  compositePolygonArea,
  circleApplied,
  surfaceAreaPlus,
  volumeMixedUnits,
];
