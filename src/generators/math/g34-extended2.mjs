/**
 * 2022 개정 초등 수학 3~4학년군 2차 확장 문항 생성기.
 *
 * 1차 확장이 다루지 않던 문제 유형을 더한다. 그림그래프·막대그래프 비교,
 * 꺾은선그래프의 구간 변화, 표의 빠진 값과 두 자료 비교, 바깥쪽 각으로 내각 구하기,
 * 이등변삼각형·사각형·정다각형의 변의 길이, 줄지어 그린 원, 초 단위 시간 문장제,
 * 길이·들이·무게·t 단위가 섞인 여러 단계 문장제, 큰 수 만들기와 뛰어 세기,
 * □ 안에 들어갈 숫자 세기, 두 자리 수로 나누는 문장제, 잘못 계산한 나눗셈,
 * 어림셈으로 판단하기, 소수 만들기, 분수·소수 문장제, 등호 양쪽 맞추기,
 * 대응 관계 표, 계산 결과로 몇 번째 계산식인지 찾기다.
 *
 * verify 는 generate 와 다른 경로(역연산, 대입, 다시 세기)로 답을 확인한다.
 */
import {
  josaEul, josaEun, josaI, numberParticle, numEul, numEun, numI, numRo, particle, particleRo, unitParticle,
} from '../../engine/korean-number.mjs';
import { reducedFractionForms } from '../../engine/rational.mjs';

const num = (n) => String(n);
const UNIT_SYMBOLS = new Set(['cm', 'mm', 'm', 'km', 'g', 'kg', 't', 'L', 'mL']);
/** 단위 기호는 읽는 소리로, 단위명사는 낱말 그대로 조사를 고른다. */
const pj = (unit, withJong, withoutJong) => (UNIT_SYMBOLS.has(unit)
  ? unitParticle(unit, withJong, withoutJong)
  : particle(unit, withJong, withoutJong));
const gwa = (w) => particle(w, '과', '와');
const idaUnit = (value, unit) => `${value}${unit}${pj(unit, '이다', '다')}`;
const unitAnswer = (value, unit) => ({ value, display: `${value}${unit}`, accepts: [num(value), `${value}${unit}`] });
const sum = (xs) => xs.reduce((s, x) => s + x, 0);

/** lo..hi 에서 서로 다른 정수 k 개를 뽑아 mult 배 한다. */
function distinctInts(rng, k, lo, hi, mult = 1) {
  const out = [];
  while (out.length < k) {
    const v = rng.int(lo, hi) * mult;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

// ---------------------------------------------------------------------------
// [4수04-01] 그림그래프 · 막대그래프
// ---------------------------------------------------------------------------

const PICTURE_CONTEXTS = [
  { topic: '마을별 사과 생산량', cats: ['가 마을', '나 마을', '다 마을', '라 마을'], what: '사과 생산량', unit: 'kg' },
  { topic: '과수원별 귤 수확량', cats: ['햇살 과수원', '바람 과수원', '푸른 과수원', '하늘 과수원'], what: '귤 수확량', unit: 'kg' },
  { topic: '농장별 기르는 닭의 수', cats: ['가 농장', '나 농장', '다 농장', '라 농장'], what: '닭의 수', unit: '마리' },
  { topic: '학교별 학생 수', cats: ['가 학교', '나 학교', '다 학교', '라 학교'], what: '학생 수', unit: '명' },
];
const PICTURE_SCALE = { 1: [10, 1], 2: [100, 10], 3: [1000, 100] };

const pictureGraph = {
  id: 'math.g34.gd.s04-01.picture-graph',
  standardCode: '[4수04-01]',
  skill: '그림그래프에서 큰 그림과 작은 그림을 읽어 합과 차 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const c = rng.pick(PICTURE_CONTEXTS);
    const [B, S] = PICTURE_SCALE[difficulty];
    const big = c.cats.map(() => rng.int(1, 9));
    const small = c.cats.map(() => rng.int(0, 9));
    const kind = rng.pick(difficulty === 1 ? ['read', 'sum2'] : difficulty === 2 ? ['read', 'sum2', 'diff'] : ['total', 'diff', 'max-min']);
    const i = rng.int(0, 3);
    const j = (i + rng.int(1, 3)) % 4;
    const valueOf = (k) => big[k] * B + small[k] * S;
    // 같은 값끼리 빼면 답이 0이 된다. 작은 그림 하나를 바꾸어 피한다.
    if (kind === 'diff' && valueOf(i) === valueOf(j)) small[j] = (small[j] + 1) % 10;
    if (kind === 'max-min' && new Set([0, 1, 2, 3].map(valueOf)).size === 1) small[0] = (small[0] + 1) % 10;
    const values = [0, 1, 2, 3].map(valueOf);
    const { unit, what, cats } = c;
    const [ci, cj] = [cats[i], cats[j]];
    const hi = Math.max(values[i], values[j]);
    const lo = Math.min(values[i], values[j]);
    let value;
    let ask;
    let calc;
    if (kind === 'read') {
      value = values[i];
      ask = `${ci}의 ${what}${josaEun(what)} 몇 ${unit}입니까?`;
      calc = `${B} × ${big[i]} + ${S} × ${small[i]} = ${value}`;
    } else if (kind === 'sum2') {
      value = values[i] + values[j];
      ask = `${ci}${gwa(ci)} ${cj}의 ${what}${josaEul(what)} 합하면 몇 ${unit}입니까?`;
      calc = `${values[i]} + ${values[j]} = ${value}`;
    } else if (kind === 'diff') {
      value = hi - lo;
      ask = `${ci}${gwa(ci)} ${cj}의 ${what}의 차는 몇 ${unit}입니까?`;
      calc = `${hi} - ${lo} = ${value}`;
    } else if (kind === 'total') {
      value = sum(values);
      ask = `네 곳의 ${what}${josaEul(what)} 모두 합하면 몇 ${unit}입니까?`;
      calc = `${values.join(' + ')} = ${value}`;
    } else {
      value = Math.max(...values) - Math.min(...values);
      ask = `${what}${josaI(what)} 가장 많은 곳은 가장 적은 곳보다 몇 ${unit} 더 많습니까?`;
      calc = `${Math.max(...values)} - ${Math.min(...values)} = ${value}`;
    }
    const rows = cats.map((cat, k) => `${cat}: 큰 그림 ${big[k]}개, 작은 그림 ${small[k]}개`).join('\n');
    const pos = kind === 'read' ? `${i}` : ['sum2', 'diff'].includes(kind) ? `${Math.min(i, j)}${Math.max(i, j)}` : '';
    return {
      params: { B, S, big, small, kind, i, j },
      instruction: '그림그래프를 보고 물음에 답하시오.',
      stem: `${c.topic}${josaEul(c.topic)} 그림그래프로 나타냈습니다. 큰 그림 1개는 ${B}${unit}, 작은 그림 1개는 ${S}${unit}${pj(unit, '을', '를')} 나타냅니다.\n${rows}\n${ask}`,
      answer: unitAnswer(value, unit),
      solution: [
        `큰 그림 1개는 ${B}${unit}, 작은 그림 1개는 ${idaUnit(S, unit)}.`,
        `${cats.slice(0, 3).map((cat, k) => `${cat} ${values[k]}${unit}`).join(', ')}, ${cats[3]} ${idaUnit(values[3], unit)}.`,
        `${calc}이므로 답은 ${idaUnit(value, unit)}.`,
      ],
      dedupeKey: `picture-graph:${B}:${big.join('')}:${small.join('')}:${kind}:${pos}`,
      difficulty,
    };
  },
  verify({ B, S, big, small, kind, i, j }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v < 0) return false;
    // 작은 그림 단위로 모두 바꾸어 센 뒤 작은 그림 하나의 양을 곱한다.
    const vals = big.map((b, k) => (b * (B / S) + small[k]) * S);
    if (kind === 'read') return v === vals[i];
    if (kind === 'sum2') return v - vals[j] === vals[i];
    if (kind === 'diff') return v > 0 && Math.min(vals[i], vals[j]) + v === Math.max(vals[i], vals[j]);
    if (kind === 'total') return vals.reduce((s, x) => s - x, v) === 0;
    return v > 0 && Math.min(...vals) + v === Math.max(...vals);
  },
};

const BAR_CONTEXTS = [
  { topic: '좋아하는 과일별 학생 수', cats: ['사과', '배', '포도', '귤', '딸기'], what: '학생 수', unit: '명' },
  { topic: '반별 모은 빈 병의 수', cats: ['1반', '2반', '3반', '4반', '5반'], what: '빈 병의 수', unit: '개' },
  { topic: '요일별 도서관 방문자 수', cats: ['월요일', '화요일', '수요일', '목요일', '금요일'], what: '방문자 수', unit: '명' },
  { topic: '마을별 심은 나무의 수', cats: ['가 마을', '나 마을', '다 마을', '라 마을', '마 마을'], what: '나무의 수', unit: '그루' },
];

const barCompare = {
  id: 'math.g34.gd.s04-01.bar-compare',
  standardCode: '[4수04-01]',
  skill: '막대그래프에서 두 항목의 차·합·몇 배를 구하고 조건에 맞는 항목 찾기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const c = rng.pick(BAR_CONTEXTS);
    const step = difficulty === 1 ? 1 : difficulty === 2 ? rng.pick([2, 5]) : rng.pick([10, 20, 50]);
    const counts = c.cats.map(() => step * rng.int(1, 20));
    const kind = rng.pick(difficulty === 1 ? ['diff', 'sum2'] : difficulty === 2 ? ['diff', 'sum2', 'times'] : ['times', 'more-by', 'sum-vs']);
    const i = rng.int(0, 4);
    const j = (i + rng.int(1, 4)) % 5;
    let k = (j + 1) % 5 === i ? (j + 2) % 5 : (j + 1) % 5;
    let N = 0;
    if (kind === 'diff' && counts[i] === counts[j]) counts[j] += counts[j] === 20 * step ? -step : step;
    if (kind === 'times') {
      N = rng.int(2, 4);
      counts[j] = step * rng.int(1, Math.floor(20 / N));
      counts[i] = counts[j] * N;
    }
    if (kind === 'more-by') {
      const m = rng.int(1, 5);
      N = m * step;
      counts[i] = step * rng.int(1, 20 - m);
      counts[j] = counts[i] + N;
      // 조건에 맞는 항목이 하나뿐이도록 다른 막대를 한 칸 낮춘다.
      for (let x = 0; x < 5; x += 1) if (x !== j && counts[x] === counts[j]) counts[x] -= step;
    }
    if (kind === 'sum-vs' && counts[i] + counts[j] <= counts[k]) {
      counts[k] = step * rng.int(1, (counts[i] + counts[j]) / step - 1);
    }
    if (kind !== 'sum-vs') k = -1;
    const { cats, unit, what } = c;
    const [ci, cj] = [cats[i], cats[j]];
    let value;
    let ask;
    let calc;
    if (kind === 'diff') {
      value = Math.abs(counts[i] - counts[j]);
      ask = `${ci}${gwa(ci)} ${cj}의 ${what}의 차는 몇 ${unit}입니까?`;
      calc = `${Math.max(counts[i], counts[j])} - ${Math.min(counts[i], counts[j])} = ${value}`;
    } else if (kind === 'sum2') {
      value = counts[i] + counts[j];
      ask = `${ci}${gwa(ci)} ${cj}의 ${what}${josaEul(what)} 합하면 몇 ${unit}입니까?`;
      calc = `${counts[i]} + ${counts[j]} = ${value}`;
    } else if (kind === 'times') {
      value = N;
      ask = `${ci}의 ${what}${josaEun(what)} ${cj}의 ${what}의 몇 배입니까?`;
      calc = `${counts[i]} ÷ ${counts[j]} = ${value}`;
    } else if (kind === 'more-by') {
      value = cj;
      ask = `${ci}보다 ${N}${unit} 더 많은 것은 어느 것입니까?`;
      calc = `${counts[i]} + ${N} = ${counts[j]}`;
    } else {
      value = counts[i] + counts[j] - counts[k];
      ask = `${ci}${gwa(ci)} ${cj}의 ${what}${josaEul(what)} 합하면 ${cats[k]}의 ${what}보다 몇 ${unit} 더 많습니까?`;
      calc = `${counts[i]} + ${counts[j]} - ${counts[k]} = ${value}`;
    }
    const answer = kind === 'more-by' ? { value, display: value, accepts: [value] }
      : kind === 'times' ? { value, display: `${value}배`, accepts: [num(value), `${value}배`] }
        : unitAnswer(value, unit);
    return {
      params: { cats, counts, step, kind, i, j, k, N },
      instruction: '막대그래프를 보고 물음에 답하시오.',
      stem: ask,
      figure: {
        kind: 'data.bar-graph',
        spec: { categories: cats, counts, step, unitLabel: `(${unit})` },
        altText: `${c.topic} 막대그래프. 세로축 한 칸은 ${step}${unit}이고 ${cats.map((x, n) => `${x} ${counts[n]}`).join(', ')}이다.`,
        prompt: { ko: `흰 배경에 검은 선으로 그린 막대그래프. 가로축에 ${cats.join(', ')}, 세로축 한 칸은 ${step}. 막대 높이는 ${counts.join(', ')}. 초등 수학 교재용. AR 16:9` },
      },
      answer,
      solution: [
        `세로 눈금 한 칸은 ${idaUnit(step, unit)}.`,
        `${cats.slice(0, 4).map((x, n) => `${x} ${counts[n]}${unit}`).join(', ')}, ${cats[4]} ${idaUnit(counts[4], unit)}.`,
        `${calc}이므로 답은 ${kind === 'more-by' ? `${value}${particle(value, '이다', '다')}` : kind === 'times' ? `${value}배이다` : idaUnit(value, unit)}.`,
      ],
      dedupeKey: `bar-compare:${c.topic}:${step}:${counts.join('-')}:${kind}:${i}:${j}:${k}:${N}`,
      difficulty,
    };
  },
  verify({ cats, counts, kind, i, j, k, N }, answer) {
    const v = answer.value;
    if (kind === 'more-by') {
      const at = cats.indexOf(v);
      // 답한 항목에서 기준 항목을 빼 조건의 차가 나오는지, 그런 항목이 하나뿐인지 본다.
      return at >= 0 && counts[at] - counts[i] === N && counts.filter((x) => x - counts[i] === N).length === 1;
    }
    if (!Number.isInteger(v) || v <= 0) return false;
    if (kind === 'diff') return Math.min(counts[i], counts[j]) + v === Math.max(counts[i], counts[j]);
    if (kind === 'sum2') return v - counts[j] === counts[i];
    if (kind === 'times') return counts[j] * v === counts[i];
    return v + counts[k] - counts[j] === counts[i];
  },
};

// ---------------------------------------------------------------------------
// [4수04-02] 꺾은선그래프의 구간 변화
// ---------------------------------------------------------------------------

const LINE_CONTEXTS = [
  {
    topic: '시각별 운동장의 기온', labels: ['오전 9시', '오전 10시', '오전 11시', '낮 12시', '오후 1시', '오후 2시'],
    unit: '°C', subj: '기온은', subjI: '기온이', up: '올라갔습니까', down: '내려갔습니까', rise: '올라간', fall: '내려간', continuous: true,
  },
  {
    topic: '월별 도서관에서 빌려 간 책의 수', labels: ['3월', '4월', '5월', '6월', '7월', '8월'],
    unit: '권', subj: '빌려 간 책의 수는', subjI: '빌려 간 책의 수가', up: '늘었습니까', down: '줄었습니까', rise: '늘어난', fall: '줄어든', continuous: false,
  },
  {
    topic: '연도별 마을 도서관 회원 수', labels: ['2020년', '2021년', '2022년', '2023년', '2024년', '2025년'],
    unit: '명', subj: '회원 수는', subjI: '회원 수가', up: '늘었습니까', down: '줄었습니까', rise: '늘어난', fall: '줄어든', continuous: false,
  },
];

const lineChange = {
  id: 'math.g34.gd.s04-02.line-change',
  standardCode: '[4수04-02]',
  skill: '꺾은선그래프에서 떨어진 두 때의 변화량, 가장 많이 줄어든 구간, 중간 시각의 값 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const c = rng.pick(LINE_CONTEXTS);
    const step = c.continuous ? 1 : difficulty === 1 ? 1 : difficulty === 2 ? 5 : 10;
    const kinds = difficulty === 1 ? ['span-change', 'total-change']
      : difficulty === 2 ? ['max-drop', 'span-change', ...(c.continuous ? ['midpoint'] : [])]
        : ['max-drop', 'rise-total', c.continuous ? 'midpoint' : 'span-change'];
    const kind = rng.pick(kinds);
    const maxStep = c.continuous ? 4 : 6;
    const deltas = [0, 1, 2, 3, 4].map(() => (rng.bool() ? 1 : -1) * rng.int(1, maxStep) * step);
    let i = -1;
    let j = -1;
    let t = -1;
    if (kind === 'span-change' || kind === 'total-change') {
      i = kind === 'total-change' ? 0 : rng.int(0, 3);
      j = kind === 'total-change' ? 5 : rng.int(i + 2, 5);
      if (sum(deltas.slice(i, j)) === 0) deltas[j - 1] += deltas[j - 1] > 0 ? step : -step;
    } else if (kind === 'max-drop') {
      t = rng.int(0, 4);
      const others = deltas.filter((_, n) => n !== t).map((d) => (d < 0 ? -d : 0));
      deltas[t] = -(Math.max(...others) + step * rng.int(1, 2));
    } else if (kind === 'midpoint') {
      t = rng.int(0, 4);
      if (deltas[t] % 2 !== 0) deltas[t] += deltas[t] > 0 ? step : -step;
    } else if (deltas.every((d) => d > 0) || deltas.every((d) => d < 0)) {
      deltas[0] = -deltas[0];
    }
    const prefix = [0];
    for (const d of deltas) prefix.push(prefix.at(-1) + d);
    const low = c.continuous ? 3 : step * 5;
    const start = low - Math.min(...prefix) + step * rng.int(0, c.continuous ? 15 : 25);
    const values = prefix.map((p) => start + p);
    const { labels, unit } = c;
    let value;
    let ask;
    let solution;
    if (kind === 'span-change' || kind === 'total-change') {
      value = Math.abs(values[j] - values[i]);
      ask = `${labels[i]}부터 ${labels[j]}까지 ${c.subj} 몇 ${unit} ${values[j] > values[i] ? c.up : c.down}?`;
      solution = [`${labels[i]}에는 ${values[i]}${unit}, ${labels[j]}에는 ${values[j]}${unit}이다.`, `${Math.max(values[i], values[j])} - ${Math.min(values[i], values[j])} = ${value}이다.`];
    } else if (kind === 'max-drop') {
      value = `${labels[t]}~${labels[t + 1]}`;
      ask = `${c.subjI} 가장 많이 ${c.fall} 때는 언제부터 언제까지입니까?`;
      solution = [`선이 오른쪽 아래로 가장 많이 기울어진 구간을 찾는다.`, `${labels[t]}에서 ${labels[t + 1]}까지 ${values[t] - values[t + 1]}${unit} ${c.fall} 것이 가장 크므로 답은 ${value}이다.`];
    } else if (kind === 'midpoint') {
      value = (values[t] + values[t + 1]) / 2;
      ask = `${labels[t]} 30분의 기온은 약 몇 ${unit}였겠습니까?`;
      solution = [`${labels[t]} 30분은 ${labels[t]}${gwa(labels[t])} ${labels[t + 1]}의 한가운데이다.`, `두 값 ${values[t]}${unit}, ${values[t + 1]}${unit}의 한가운데 값은 ${value}${unit}이다.`];
    } else {
      const rises = deltas.filter((d) => d > 0);
      value = sum(rises);
      ask = `${c.subjI} ${c.rise} 구간의 변화량을 모두 더하면 몇 ${unit}입니까?`;
      solution = [`${c.rise} 구간의 변화량은 ${rises.map((d) => `${d}${unit}`).join(', ')}이다.`, `${rises.join(' + ')} = ${value}이다.`];
    }
    const points = labels.map((l, n) => `${l}(${values[n]}${unit})`).join(' ─ ');
    const answer = kind === 'max-drop'
      ? { value, display: value, accepts: [value, `${labels[t]}부터 ${labels[t + 1]}까지`] }
      : unitAnswer(value, unit);
    return {
      params: { labels, values, kind, i, j, t },
      instruction: '꺾은선그래프를 보고 물음에 답하시오.',
      stem: `${c.topic} 꺾은선그래프의 점: ${points}\n${ask}`,
      answer,
      solution,
      dedupeKey: `line-change:${c.topic}:${values.join('-')}:${kind === 'total-change' ? 'span-change' : kind}:${i}:${j}:${t}`,
      difficulty,
    };
  },
  verify({ labels, values, kind, i, j, t }, answer) {
    const v = answer.value;
    const diffs = values.slice(1).map((x, n) => x - values[n]);
    if (kind === 'max-drop') {
      const m = /^(.+)~(.+)$/.exec(String(v));
      if (!m) return false;
      const a = labels.indexOf(m[1]);
      if (a < 0 || labels[a + 1] !== m[2]) return false;
      // 답한 구간의 감소량이 다른 모든 구간보다 커야 한다.
      return diffs[a] < 0 && diffs.every((d, n) => n === a || d > diffs[a]);
    }
    if (!Number.isInteger(v) || v <= 0) return false;
    if (kind === 'midpoint') return 2 * v === values[t] + values[t + 1];
    if (kind === 'rise-total') return diffs.filter((d) => d > 0).reduce((s, d) => s - d, v) === 0;
    // 이웃한 구간의 변화를 이어 더해 두 때의 차를 다시 구한다.
    return v === Math.abs(sum(diffs.slice(i, j)));
  },
};

// ---------------------------------------------------------------------------
// [4수04-03] 표의 빠진 값 · 두 자료 비교
// ---------------------------------------------------------------------------

const TABLE_CONTEXTS = [
  { topic: '좋아하는 운동', cats: ['축구', '야구', '농구', '피구', '배구'], what: '학생 수', unit: '명' },
  { topic: '반별 안경 쓴 학생 수', cats: ['1반', '2반', '3반', '4반'], what: '학생 수', unit: '명' },
  { topic: '종류별 팔린 빵의 수', cats: ['단팥빵', '크림빵', '식빵', '소보로빵'], what: '수', whatAlone: '팔린 빵의 수', unit: '개' },
  { topic: '마을별 가로등의 수', cats: ['가 마을', '나 마을', '다 마을', '라 마을', '마 마을'], what: '가로등의 수', unit: '개' },
];

const tableMissing = {
  id: 'math.g34.gd.s04-03.table-missing',
  standardCode: '[4수04-03]',
  skill: '합계로 표의 빠진 값을 구하고 그래프로 나타내거나 해석하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const c = rng.pick(TABLE_CONTEXTS);
    const n = c.cats.length;
    const kind = rng.pick(difficulty === 1 ? ['missing'] : difficulty === 2 ? ['missing-diff', 'bar-cells'] : ['max-min', 'rank2']);
    const cell = kind === 'bar-cells' ? rng.pick([2, 5]) : 1;
    const counts = kind === 'bar-cells' ? distinctInts(rng, n, 1, 30, cell)
      : difficulty === 1 ? distinctInts(rng, n, 1, 40)
        : difficulty === 2 ? distinctInts(rng, n, 5, 99) : distinctInts(rng, n, 10, 300);
    const order = counts.map((_, k) => k).sort((a, b) => counts[b] - counts[a]);
    let mi = rng.int(0, n - 1);
    if (kind === 'max-min') mi = rng.pick([order[0], order[n - 1]]);
    if (kind === 'rank2') mi = order[1];
    const oj = (mi + rng.int(1, n - 1)) % n;
    const total = sum(counts);
    const shown = counts.map((x, k) => (k === mi ? '□' : String(x)));
    const { cats, unit, what } = c;
    // 항목 이름 없이 쓸 때의 말(예: '팔린 빵의 수')이 따로 있으면 그것을 쓴다.
    const lone = c.whatAlone ?? what;
    const m = counts[mi];
    const findLine = `${cats[mi]}의 ${what}${josaEun(what)} ${total} - (${counts.filter((_, k) => k !== mi).join(' + ')}) = ${idaUnit(m, unit)}`;
    let value;
    let ask;
    let last;
    if (kind === 'missing') {
      value = m;
      ask = `${cats[mi]}의 ${what}${josaEun(what)} 몇 ${unit}입니까?`;
      last = `답은 ${idaUnit(m, unit)}.`;
    } else if (kind === 'missing-diff') {
      value = Math.abs(m - counts[oj]);
      ask = `${cats[mi]}${gwa(cats[mi])} ${cats[oj]}의 ${what}의 차는 몇 ${unit}입니까?`;
      last = `${Math.max(m, counts[oj])} - ${Math.min(m, counts[oj])} = ${value}이다.`;
    } else if (kind === 'bar-cells') {
      value = m / cell;
      ask = `세로 눈금 한 칸을 ${cell}${unit}${particleRo(unit)} 하여 막대그래프를 그리면 ${cats[mi]}의 막대는 몇 칸으로 그려야 합니까?`;
      last = `${m} ÷ ${cell} = ${value}이므로 ${value}칸이다.`;
    } else if (kind === 'max-min') {
      value = counts[order[0]] - counts[order[n - 1]];
      ask = `${lone}${josaI(lone)} 가장 많은 것과 가장 적은 것의 차는 몇 ${unit}입니까?`;
      last = `${counts[order[0]]} - ${counts[order[n - 1]]} = ${value}이다.`;
    } else {
      value = cats[mi];
      ask = `${lone}${josaI(lone)} 두 번째로 많은 것은 무엇입니까?`;
      last = `큰 수부터 차례로 ${order.map((k) => counts[k]).join(', ')}이므로 답은 ${value}이다.`;
    }
    const answer = kind === 'rank2' ? { value, display: value, accepts: [value] }
      : kind === 'bar-cells' ? { value, display: `${value}칸`, accepts: [num(value), `${value}칸`] }
        : unitAnswer(value, unit);
    return {
      params: { counts: shown.map((x) => (x === '□' ? null : Number(x))), total, cats, kind, mi, oj, cell },
      instruction: '표를 보고 물음에 답하시오.',
      stem: `${c.topic}${josaEul(c.topic)} 조사하여 표로 나타냈습니다. ${ask}`,
      figure: {
        kind: 'data.table',
        spec: { headers: [...cats, '합계'], values: [...shown, String(total)], headerLabel: c.topic, valueLabel: `수(${unit})` },
        altText: `${c.topic}${josaEul(c.topic)} 조사한 표. ${cats.map((x, k) => `${x} ${shown[k]}`).join(', ')}, 합계 ${total}.`,
        prompt: { ko: `흰 배경에 검은 선으로 그린 2행 표. 머리글은 ${cats.join(', ')}, 합계, 값은 ${shown.join(', ')}, ${total}. 초등 수학 교재용. AR 16:9` },
      },
      answer,
      solution: [`${findLine}.`, last],
      dedupeKey: `table-missing:${c.topic}:${counts.join('-')}:${mi}:${kind}:${kind === 'missing-diff' ? oj : ''}:${cell}`,
      difficulty,
    };
  },
  verify({ counts, total, cats, kind, mi, oj, cell }, answer) {
    const v = answer.value;
    // 합계에서 아는 값을 빼서 빠진 값을 다시 구한다.
    const filled = counts.map((x, k) => (k === mi ? total - sum(counts.filter((y) => y !== null)) : x));
    if (kind === 'rank2') {
      const at = cats.indexOf(v);
      return at >= 0 && filled.filter((x) => x > filled[at]).length === 1;
    }
    if (!Number.isInteger(v) || v <= 0) return false;
    if (kind === 'missing') return v === filled[mi];
    if (kind === 'missing-diff') return Math.min(filled[mi], filled[oj]) + v === Math.max(filled[mi], filled[oj]);
    if (kind === 'bar-cells') return v * cell === filled[mi];
    return Math.min(...filled) + v === Math.max(...filled);
  },
};

const SERIES_CONTEXTS = [
  { names: ['1반', '2반'], labels: ['3월', '4월', '5월', '6월'], what: '읽은 책의 수', unit: '권' },
  { names: ['형', '동생'], labels: ['월요일', '화요일', '수요일', '목요일', '금요일'], what: '줄넘기 횟수', unit: '번' },
  { names: ['가 가게', '나 가게'], labels: ['첫째 주', '둘째 주', '셋째 주', '넷째 주'], what: '팔린 빵의 수', unit: '개' },
];

const twoSeries = {
  id: 'math.g34.gd.s04-03.two-series',
  standardCode: '[4수04-03]',
  skill: '두 자료를 함께 정리하여 차가 가장 큰 때, 합계의 차 등 비교하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const c = rng.pick(SERIES_CONTEXTS);
    const [lo, hi] = difficulty === 1 ? [1, 40] : difficulty === 2 ? [10, 150] : [100, 600];
    const n = c.labels.length;
    const a = c.labels.map(() => rng.int(lo, hi));
    const b = c.labels.map(() => rng.int(lo, hi));
    const kind = rng.pick(difficulty === 1 ? ['gap-at', 'series-total'] : difficulty === 2 ? ['total-diff', 'max-gap', 'gap-at'] : ['max-gap', 'total-diff', 'combined-max']);
    let t = rng.int(0, n - 1);
    const who = rng.int(0, 1);
    if (kind === 'gap-at' && a[t] === b[t]) a[t] += 1;
    if (kind === 'total-diff' && sum(a) === sum(b)) a[0] += 1;
    if (kind === 'max-gap') {
      const gaps = a.map((x, k) => Math.abs(x - b[k]));
      t = gaps.indexOf(Math.max(...gaps));
      // 가장 큰 차가 하나뿐이도록 그 때의 큰 값을 1 키운다.
      if (a[t] >= b[t]) a[t] += 1; else b[t] += 1;
    }
    if (kind === 'combined-max') {
      const sums = a.map((x, k) => x + b[k]);
      t = sums.indexOf(Math.max(...sums));
      a[t] += 1;
    }
    if (kind === 'series-total') t = -1;
    const [n0, n1] = c.names;
    const { unit, what, labels } = c;
    let value;
    let ask;
    let calc;
    if (kind === 'gap-at') {
      value = Math.abs(a[t] - b[t]);
      ask = `${labels[t]}에 ${n0}${gwa(n0)} ${n1}의 ${what}의 차는 몇 ${unit}입니까?`;
      calc = `${Math.max(a[t], b[t])} - ${Math.min(a[t], b[t])} = ${value}이다.`;
    } else if (kind === 'series-total') {
      const xs = who === 0 ? a : b;
      value = sum(xs);
      ask = `${c.names[who]}의 ${what}${josaEul(what)} 모두 더하면 몇 ${unit}입니까?`;
      calc = `${xs.join(' + ')} = ${value}이다.`;
    } else if (kind === 'total-diff') {
      value = Math.abs(sum(a) - sum(b));
      ask = `${n0}${gwa(n0)} ${n1}의 ${what}${josaEul(what)} 각각 모두 더했을 때 두 합의 차는 몇 ${unit}입니까?`;
      calc = `${n0}의 합은 ${sum(a)}, ${n1}의 합은 ${sum(b)}이므로 차는 ${value}이다.`;
    } else if (kind === 'max-gap') {
      value = labels[t];
      ask = `${n0}${gwa(n0)} ${n1}의 ${what}의 차가 가장 큰 때는 언제입니까?`;
      calc = `때별 차는 ${a.map((x, k) => Math.abs(x - b[k])).join(', ')}이므로 답은 ${value}이다.`;
    } else {
      value = labels[t];
      ask = `${n0}${gwa(n0)} ${n1}의 ${what}${josaEul(what)} 합한 값이 가장 큰 때는 언제입니까?`;
      calc = `때별 합은 ${a.map((x, k) => x + b[k]).join(', ')}이므로 답은 ${value}이다.`;
    }
    const line = (name, xs) => `${name}: ${labels.map((l, k) => `${l} ${xs[k]}${unit}`).join(', ')}`;
    const answer = typeof value === 'string' ? { value, display: value, accepts: [value] } : unitAnswer(value, unit);
    return {
      params: { labels, a, b, kind, t, who },
      instruction: '자료를 보고 물음에 답하시오.',
      stem: `${what}${josaEul(what)} 조사하여 정리했습니다.\n${line(n0, a)}\n${line(n1, b)}\n${ask}`,
      answer,
      solution: [`${n0}${gwa(n0)} ${n1}의 자료를 때별로 나란히 놓고 비교한다.`, calc],
      dedupeKey: `two-series:${a.join('-')}:${b.join('-')}:${kind}:${kind === 'gap-at' ? t : ''}:${kind === 'series-total' ? who : ''}`,
      difficulty,
    };
  },
  verify({ labels, a, b, kind, t, who }, answer) {
    const v = answer.value;
    if (kind === 'max-gap' || kind === 'combined-max') {
      const at = labels.indexOf(v);
      if (at < 0) return false;
      const score = a.map((x, k) => (kind === 'max-gap' ? Math.abs(x - b[k]) : x + b[k]));
      return score.every((s, k) => k === at || s < score[at]);
    }
    if (!Number.isInteger(v) || v <= 0) return false;
    if (kind === 'gap-at') return Math.min(a[t], b[t]) + v === Math.max(a[t], b[t]);
    if (kind === 'series-total') return (who === 0 ? a : b).reduce((s, x) => s - x, v) === 0;
    // 때별 차를 모두 더해도 합계의 차가 된다.
    return Math.abs(sum(a.map((x, k) => x - b[k]))) === v;
  },
};

// ---------------------------------------------------------------------------
// [4수03-25] 바깥쪽 각을 이용해 삼각형·사각형의 각 구하기
// ---------------------------------------------------------------------------

function triangleAngles(rng) {
  const A = rng.int(10, 160);
  const B = rng.int(10, 170 - A);
  return [A, B, 180 - A - B];
}

function quadAngles(rng) {
  const A = rng.int(50, 150);
  const B = rng.int(50, 150);
  const rest = 360 - A - B;
  const C = rng.int(Math.max(30, rest - 170), Math.min(170, rest - 30));
  return [A, B, C, rest - C];
}

const missingAngleExterior = {
  id: 'math.g34.gd.s25.exterior-angle',
  standardCode: '[4수03-25]',
  skill: '변을 늘인 직선 위의 각을 이용해 삼각형·사각형의 나머지 각 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = rng.pick(difficulty === 1 ? ['tri-ext-interior', 'tri-ext-third'] : difficulty === 2 ? ['quad-one-ext', 'quad-one-ext', 'quad-one-ext', 'iso-ext'] : ['quad-two-ext', 'tri-two-ext']);
    const item = rng.until(() => {
      if (kind === 'iso-ext') {
        const base = rng.int(30, 80);
        const e = 180 - base;
        return {
          shown: [e], value: 180 - 2 * base,
          stem: `변 ㄱㄴ과 변 ㄱㄷ의 길이가 같은 이등변삼각형 ㄱㄴㄷ에서 변 ㄷㄴ을 늘인 직선 위에 점 ㄹ을 찍었습니다. 각 ㄱㄴㄹ이 ${e}°일 때 각 ㄴㄱㄷ은 몇 도입니까?`,
          solution: [`각 ㄱㄴㄷ은 180° - ${e}° = ${base}°이다.`, `이등변삼각형의 두 밑각은 같으므로 각 ㄱㄷㄴ도 ${base}°이다.`, `각 ㄴㄱㄷ은 180° - ${base}° - ${base}° = ${180 - 2 * base}°이다.`],
          sumTo: 180, known: [base, base],
        };
      }
      if (kind.startsWith('tri')) {
        const [A, B, C] = triangleAngles(rng);
        if (kind === 'tri-ext-interior') {
          return {
            shown: [A, 180 - B], value: C,
            stem: `삼각형 ㄱㄴㄷ에서 변 ㄷㄴ을 늘인 직선 위에 점 ㄹ을 찍었습니다. 각 ㄴㄱㄷ은 ${A}°이고, 각 ㄱㄴㄹ은 ${180 - B}°입니다. 각 ㄱㄷㄴ은 몇 도입니까?`,
            solution: [`각 ㄱㄴㄷ은 180° - ${180 - B}° = ${B}°이다.`, `각 ㄱㄷㄴ은 180° - ${A}° - ${B}° = ${C}°이다.`],
            sumTo: 180, known: [A, B],
          };
        }
        if (kind === 'tri-ext-third') {
          return {
            shown: [A, 180 - B], value: 180 - C,
            stem: `삼각형 ㄱㄴㄷ에서 변 ㄷㄴ을 늘인 직선 위에 점 ㄹ을, 변 ㄴㄷ을 늘인 직선 위에 점 ㅁ을 찍었습니다. 각 ㄴㄱㄷ은 ${A}°이고, 각 ㄱㄴㄹ은 ${180 - B}°입니다. 각 ㄱㄷㅁ은 몇 도입니까?`,
            solution: [`각 ㄱㄴㄷ은 180° - ${180 - B}° = ${B}°이다.`, `각 ㄱㄷㄴ은 180° - ${A}° - ${B}° = ${C}°이다.`, `각 ㄱㄷㅁ은 180° - ${C}° = ${180 - C}°이다.`],
            sumTo: 180, known: [A, B], exterior: true,
          };
        }
        return {
          shown: [180 - B, 180 - C], value: A,
          stem: `삼각형 ㄱㄴㄷ에서 변 ㄷㄴ을 늘인 직선 위에 점 ㄹ을, 변 ㄴㄷ을 늘인 직선 위에 점 ㅁ을 찍었습니다. 각 ㄱㄴㄹ은 ${180 - B}°이고, 각 ㄱㄷㅁ은 ${180 - C}°입니다. 각 ㄴㄱㄷ은 몇 도입니까?`,
          solution: [`각 ㄱㄴㄷ은 180° - ${180 - B}° = ${B}°이다.`, `각 ㄱㄷㄴ은 180° - ${180 - C}° = ${C}°이다.`, `각 ㄴㄱㄷ은 180° - ${B}° - ${C}° = ${A}°이다.`],
          sumTo: 180, known: [B, C],
        };
      }
      const [A, B, C, D] = quadAngles(rng);
      if (kind === 'quad-one-ext') {
        return {
          shown: [A, B, 180 - C], value: D,
          stem: `사각형 ㄱㄴㄷㄹ에서 각 ㄹㄱㄴ은 ${A}°, 각 ㄱㄴㄷ은 ${B}°입니다. 변 ㄴㄷ을 늘인 직선 위에 점 ㅁ을 찍었더니 각 ㄹㄷㅁ이 ${180 - C}°였습니다. 각 ㄷㄹㄱ은 몇 도입니까?`,
          solution: [`각 ㄴㄷㄹ은 180° - ${180 - C}° = ${C}°이다.`, `사각형의 네 각의 크기의 합은 360°이다.`, `각 ㄷㄹㄱ은 360° - ${A}° - ${B}° - ${C}° = ${D}°이다.`],
          sumTo: 360, known: [A, B, C],
        };
      }
      return {
        shown: [A, 180 - B, 180 - C], value: D,
        stem: `사각형 ㄱㄴㄷㄹ에서 변 ㄱㄴ을 늘인 직선 위에 점 ㅁ을, 변 ㄴㄷ을 늘인 직선 위에 점 ㅂ을 찍었습니다. 각 ㄹㄱㄴ은 ${A}°, 각 ㄷㄴㅁ은 ${180 - B}°, 각 ㄹㄷㅂ은 ${180 - C}°입니다. 각 ㄷㄹㄱ은 몇 도입니까?`,
        solution: [`각 ㄱㄴㄷ은 180° - ${180 - B}° = ${B}°이다.`, `각 ㄴㄷㄹ은 180° - ${180 - C}° = ${C}°이다.`, `각 ㄷㄹㄱ은 360° - ${A}° - ${B}° - ${C}° = ${D}°이다.`],
        sumTo: 360, known: [A, B, C],
      };
    }, (x) => !x.shown.includes(x.value) && x.value !== 90);
    const [p1, p2, p3 = 0] = item.shown;
    return {
      params: { kind, p1, p2, p3, sumTo: item.sumTo, known: item.known, exterior: item.exterior === true },
      instruction: '물음에 답하시오.',
      stem: item.stem,
      answer: { value: item.value, display: `${item.value}°`, accepts: [num(item.value), `${item.value}°`] },
      solution: item.solution,
      dedupeKey: `exterior-angle:${kind}:${item.shown.join('-')}`,
      difficulty,
    };
  },
  verify({ sumTo, known, exterior }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0 || v >= 180) return false;
    // 구한 각을 넣어 내각의 합이 180° 또는 360°가 되는지 대입해 본다.
    const interior = exterior ? 180 - v : v;
    return sum(known) + interior === sumTo;
  },
};

// ---------------------------------------------------------------------------
// [4수03-08] 이등변삼각형과 정삼각형의 변의 길이
// ---------------------------------------------------------------------------

const isoscelesSides = {
  id: 'math.g34.gd.s08.iso-equi-sides',
  standardCode: '[4수03-08]',
  skill: '이등변삼각형·정삼각형의 성질로 변의 길이와 세 변의 길이의 합 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const [lo, hi] = difficulty === 1 ? [3, 60] : difficulty === 2 ? [10, 150] : [100, 400];
    const kind = rng.pick(difficulty === 1 ? ['iso-leg', 'iso-base', 'equi-side'] : difficulty === 2 ? ['iso-leg', 'iso-base', 'iso-to-equi', 'equi-to-iso'] : ['iso-to-equi', 'equi-to-iso', 'iso-leg']);
    const item = rng.until(() => {
      if (kind === 'equi-to-iso') {
        const s = rng.int(lo, hi);
        let b = rng.int(1, Math.floor((3 * s - 1) / 2));
        if ((3 * s - b) % 2 !== 0) b = b > 1 ? b - 1 : b + 1;
        const L = (3 * s - b) / 2;
        return {
          shown: [s, b], value: L, P: 3 * s, base: b, legs: true,
          stem: `한 변이 ${s}cm인 정삼각형과 세 변의 길이의 합이 같은 이등변삼각형이 있습니다. 이등변삼각형의 길이가 다른 한 변이 ${b}cm일 때, 길이가 같은 두 변 중 한 변은 몇 cm입니까?`,
          solution: [`정삼각형의 세 변의 길이의 합은 ${s} × 3 = ${3 * s}cm이다.`, `(${3 * s} - ${b}) ÷ 2 = ${L}이므로 ${L}cm이다.`],
        };
      }
      const L = rng.int(lo, hi);
      let b = rng.int(1, 2 * L - 1);
      if (kind === 'iso-to-equi') {
        b += (3 - ((2 * L + b) % 3)) % 3;
        if (b >= 2 * L) b -= 3;
        const s = (2 * L + b) / 3;
        return {
          shown: [L, b], value: s, P: 2 * L + b, equi: true,
          stem: `길이가 같은 두 변이 각각 ${L}cm, 나머지 한 변이 ${b}cm인 이등변삼각형이 있습니다. 이 삼각형과 세 변의 길이의 합이 같은 정삼각형의 한 변은 몇 cm입니까?`,
          solution: [`이등변삼각형의 세 변의 길이의 합은 ${L} + ${L} + ${b} = ${2 * L + b}cm이다.`, `${2 * L + b} ÷ 3 = ${s}이므로 ${s}cm이다.`],
        };
      }
      if (kind === 'equi-side') {
        return {
          shown: [3 * L], value: L, P: 3 * L, equi: true,
          stem: `세 변의 길이의 합이 ${3 * L}cm인 정삼각형의 한 변은 몇 cm입니까?`,
          solution: ['정삼각형은 세 변의 길이가 모두 같다.', `${3 * L} ÷ 3 = ${L}이므로 ${L}cm이다.`],
        };
      }
      const P = 2 * L + b;
      if (kind === 'iso-leg') {
        return {
          shown: [P, b], value: L, P, base: b, legs: true,
          stem: `세 변의 길이의 합이 ${P}cm인 이등변삼각형이 있습니다. 길이가 다른 한 변이 ${b}cm일 때, 길이가 같은 두 변 중 한 변은 몇 cm입니까?`,
          solution: [`길이가 같은 두 변의 합은 ${P} - ${b} = ${2 * L}cm이다.`, `${2 * L} ÷ 2 = ${L}이므로 ${L}cm이다.`],
        };
      }
      return {
        shown: [L, P], value: b, P, leg: L,
        stem: `길이가 같은 두 변이 각각 ${L}cm이고 세 변의 길이의 합이 ${P}cm인 이등변삼각형이 있습니다. 나머지 한 변은 몇 cm입니까?`,
        solution: [`길이가 같은 두 변의 합은 ${L} × 2 = ${2 * L}cm이다.`, `${P} - ${2 * L} = ${b}이므로 ${b}cm이다.`],
      };
    }, (x) => !x.shown.includes(x.value) && x.value > 0);
    const [p1, p2 = 0] = item.shown;
    return {
      params: { kind, p1, p2, P: item.P, base: item.base ?? null, leg: item.leg ?? null },
      instruction: '물음에 답하시오.',
      stem: item.stem,
      answer: unitAnswer(item.value, 'cm'),
      solution: item.solution,
      dedupeKey: `iso-equi:${kind}:${item.shown.join('-')}`,
      difficulty,
    };
  },
  verify({ kind, P, base, leg }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    // 답을 넣어 세 변의 길이의 합을 다시 만들고 삼각형이 되는지 본다.
    if (kind === 'iso-leg' || kind === 'equi-to-iso') return v + v + base === P && base < 2 * v;
    if (kind === 'iso-base') return leg + leg + v === P && v < 2 * leg;
    return v * 3 === P;
  },
};

// ---------------------------------------------------------------------------
// [4수03-10] 여러 가지 사각형의 성질 활용
// ---------------------------------------------------------------------------

const quadProperties = {
  id: 'math.g34.gd.s10.quad-properties',
  standardCode: '[4수03-10]',
  skill: '평행사변형·마름모·직사각형·정사각형의 성질로 각과 변의 길이 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const [lo, hi] = difficulty === 1 ? [2, 99] : difficulty === 2 ? [10, 299] : [100, 500];
    const kind = rng.pick(difficulty === 1 ? ['para-adjacent', 'rhombus-side', 'rect-side'] : difficulty === 2 ? ['para-side', 'rect-side', 'para-adjacent', 'rhombus-side'] : ['para-side', 'rect-to-square', 'rect-side']);
    const item = rng.until(() => {
      if (kind === 'para-adjacent') {
        const a = rng.int(20, 160);
        return {
          shown: [a], value: 180 - a, unit: '°', check: { total: 180, given: a },
          stem: `평행사변형 ㄱㄴㄷㄹ에서 각 ㄱㄴㄷ이 ${a}°입니다. 각 ㄴㄷㄹ은 몇 도입니까?`,
          solution: ['평행사변형에서 이웃한 두 각의 크기의 합은 180°이다.', `180° - ${a}° = ${180 - a}°이다.`],
        };
      }
      if (kind === 'rhombus-side') {
        const s = rng.int(lo, hi);
        return {
          shown: [4 * s], value: s, unit: 'cm', check: { times: 4, total: 4 * s },
          stem: `네 변의 길이의 합이 ${4 * s}cm인 마름모의 한 변은 몇 cm입니까?`,
          solution: ['마름모는 네 변의 길이가 모두 같다.', `${4 * s} ÷ 4 = ${s}이므로 ${s}cm이다.`],
        };
      }
      if (kind === 'rect-to-square') {
        const w = rng.int(lo, hi);
        let h = rng.int(lo, hi);
        if ((w + h) % 2 !== 0) h += h < hi ? 1 : -1;
        const s = (w + h) / 2;
        return {
          shown: [w, h], value: s, unit: 'cm', check: { times: 4, total: 2 * (w + h) },
          stem: `가로가 ${w}cm, 세로가 ${h}cm인 직사각형과 네 변의 길이의 합이 같은 정사각형의 한 변은 몇 cm입니까?`,
          solution: [`직사각형의 네 변의 길이의 합은 (${w} + ${h}) × 2 = ${2 * (w + h)}cm이다.`, `${2 * (w + h)} ÷ 4 = ${s}이므로 ${s}cm이다.`],
        };
      }
      const a = rng.int(lo, hi);
      const b = rng.int(lo, hi);
      const P = 2 * (a + b);
      const shape = kind === 'para-side' ? '평행사변형' : '직사각형';
      return {
        shown: [P, a], value: b, unit: 'cm', check: { pair: a, total: P },
        stem: kind === 'para-side'
          ? `네 변의 길이의 합이 ${P}cm인 평행사변형의 한 변이 ${a}cm입니다. 이 변과 이웃한 변은 몇 cm입니까?`
          : `네 변의 길이의 합이 ${P}cm인 직사각형의 가로가 ${a}cm입니다. 세로는 몇 cm입니까?`,
        solution: [`${shape}${josaEun(shape)} 마주 보는 두 변의 길이가 같다.`, `이웃한 두 변의 길이의 합은 ${P} ÷ 2 = ${a + b}cm이다.`, `${a + b} - ${a} = ${b}이므로 ${b}cm이다.`],
      };
    }, (x) => !x.shown.includes(x.value) && x.value !== 90);
    const [p1, p2 = 0] = item.shown;
    return {
      params: { kind, p1, p2, ...item.check },
      instruction: '물음에 답하시오.',
      stem: item.stem,
      answer: unitAnswer(item.value, item.unit),
      solution: item.solution,
      dedupeKey: `quad-props:${kind}:${item.shown.join('-')}`,
      difficulty,
    };
  },
  verify({ kind, total, given, times, pair }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    if (kind === 'para-adjacent') return v + given === total && v < 180;
    if (times) return v * times === total;
    // 이웃한 두 변을 두 번씩 더해 둘레가 되는지 본다.
    return (v + pair) * 2 === total;
  },
};

// ---------------------------------------------------------------------------
// [4수03-11] 정다각형의 변의 길이와 둘레
// ---------------------------------------------------------------------------

const POLYGONS = [[3, '정삼각형'], [4, '정사각형'], [5, '정오각형'], [6, '정육각형'], [7, '정칠각형'], [8, '정팔각형'], [9, '정구각형'], [10, '정십각형'], [12, '정십이각형']];
const gcd = (x, y) => (y === 0 ? x : gcd(y, x % y));

const regularPolygonSides = {
  id: 'math.g34.gd.s11.regular-sides',
  standardCode: '[4수03-11]',
  skill: '정다각형의 성질로 모든 변의 길이의 합과 한 변의 길이 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = rng.pick(difficulty === 1 ? ['perimeter', 'side', 'wire-left'] : difficulty === 2 ? ['wire-left', 'side', 'perimeter'] : ['same-perimeter', 'wire-two']);
    const [n, name] = rng.pick(POLYGONS);
    const [lo, hi] = difficulty === 1 ? [2, 50] : difficulty === 2 ? [10, 150] : [5, 60];
    const item = rng.until(() => {
      const a = rng.int(lo, hi);
      if (kind === 'perimeter') {
        return {
          shown: [a], value: n * a, check: { n, a },
          stem: `한 변이 ${a}cm인 ${name}의 모든 변의 길이의 합은 몇 cm입니까?`,
          solution: [`${name}${josaEun(name)} 변이 ${n}개이고 길이가 모두 같다.`, `${a} × ${n} = ${n * a}이므로 ${n * a}cm이다.`],
        };
      }
      if (kind === 'side') {
        return {
          shown: [n * a], value: a, check: { n, P: n * a },
          stem: `모든 변의 길이의 합이 ${n * a}cm인 ${name}의 한 변은 몇 cm입니까?`,
          solution: [`${name}${josaEun(name)} 변이 ${n}개이고 길이가 모두 같다.`, `${n * a} ÷ ${n} = ${a}이므로 ${a}cm이다.`],
        };
      }
      if (kind === 'wire-left') {
        const rest = rng.int(1, difficulty === 1 ? 30 : 99);
        const W = n * a + rest;
        return {
          shown: [W, a], value: rest, check: { W, used: [[n, a]] },
          stem: `길이가 ${W}cm인 철사로 한 변이 ${a}cm인 ${name} 1개를 만들었습니다. 남은 철사는 몇 cm입니까?`,
          solution: [`${name}${josaEul(name)} 만드는 데 ${a} × ${n} = ${n * a}cm를 썼다.`, `${W} - ${n * a} = ${rest}이므로 ${rest}cm이다.`],
        };
      }
      const [m, other] = rng.pick(POLYGONS.filter(([k]) => k !== n));
      if (kind === 'same-perimeter') {
        const x = (n / gcd(n, m)) * rng.int(2, 40);
        const sn = (m * x) / n;
        return {
          shown: [sn], value: x, check: { n, m, sn },
          stem: `한 변이 ${sn}cm인 ${name}${gwa(name)} 모든 변의 길이의 합이 같은 ${other}${josaI(other)} 있습니다. ${other}의 한 변은 몇 cm입니까?`,
          solution: [`${name}의 모든 변의 길이의 합은 ${sn} × ${n} = ${sn * n}cm이다.`, `${other}의 한 변은 ${sn * n} ÷ ${m} = ${x}cm이다.`],
        };
      }
      const b = rng.int(lo, hi);
      const rest = rng.int(1, 99);
      const W = n * a + m * b + rest;
      return {
        shown: [W, a, b], value: rest, check: { W, used: [[n, a], [m, b]] },
        stem: `길이가 ${W}cm인 철사로 한 변이 ${a}cm인 ${name} 1개와 한 변이 ${b}cm인 ${other} 1개를 만들었습니다. 남은 철사는 몇 cm입니까?`,
        solution: [`${name}에 ${a} × ${n} = ${n * a}cm, ${other}에 ${b} × ${m} = ${m * b}cm를 썼다.`, `${W} - ${n * a} - ${m * b} = ${rest}이므로 ${rest}cm이다.`],
      };
    }, (x) => !x.shown.includes(x.value));
    const [p1, p2 = 0, p3 = 0] = item.shown;
    return {
      params: { kind, p1, p2, p3, ...item.check },
      instruction: '물음에 답하시오.',
      stem: item.stem,
      answer: unitAnswer(item.value, 'cm'),
      solution: item.solution,
      dedupeKey: `regular-sides:${kind}:${n}:${item.shown.join('-')}:${item.check.m ?? ''}${item.check.used?.map((u) => u[0]).join('') ?? ''}`,
      difficulty,
    };
  },
  verify({ kind, n, a, P, W, used, m, sn }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    if (kind === 'perimeter') return v % n === 0 && v / n === a;
    if (kind === 'side') return v * n === P;
    if (kind === 'same-perimeter') return v * m === sn * n;
    // 쓴 길이와 남은 길이를 더하면 처음 철사가 된다.
    return used.reduce((s, [k, len]) => s + k * len, v) === W;
  },
};

// ---------------------------------------------------------------------------
// [4수03-06] 원의 반지름과 지름 여러 단계 활용
// ---------------------------------------------------------------------------

const circlesInRow = {
  id: 'math.g34.gd.s06.circles-in-row',
  standardCode: '[4수03-06]',
  skill: '맞닿게 그린 여러 원과 둘러싼 직사각형에서 반지름·지름의 성질로 길이 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = rng.pick(difficulty === 1 ? ['row-long', 'centers', 'radius-from-long'] : difficulty === 2 ? ['row-perimeter', 'radius-from-long', 'two-sizes', 'centers'] : ['grid-perimeter', 'grid-radius', 'two-sizes', 'big-circle']);
    const rMax = difficulty === 1 ? 40 : difficulty === 2 ? 80 : 90;
    const item = rng.until(() => {
      const r = rng.int(2, rMax);
      const n = rng.int(2, difficulty === 1 ? 6 : 9);
      const intro = `반지름이 ${r}cm인 원 ${n}개를 한 줄로 맞닿게 그렸습니다.`;
      if (kind === 'row-long') {
        return {
          shown: [r, n], value: 2 * r * n, check: { r, perR: 2 * n },
          stem: `${intro} 원을 꼭 맞게 둘러싸는 직사각형을 그릴 때 직사각형의 긴 변은 몇 cm입니까?`,
          solution: [`원의 지름은 ${r} × 2 = ${2 * r}cm이다.`, `긴 변은 지름 ${n}개를 이은 길이와 같으므로 ${2 * r} × ${n} = ${2 * r * n}cm이다.`],
        };
      }
      if (kind === 'centers') {
        return {
          shown: [r, n], value: 2 * r * (n - 1), check: { r, perR: 2 * (n - 1) },
          stem: `${intro} 첫째 원의 중심과 마지막 원의 중심을 이은 선분은 몇 cm입니까?`,
          solution: [`이웃한 두 원의 중심 사이는 지름과 같은 ${2 * r}cm이다.`, `중심 사이가 ${n - 1}번 있으므로 ${2 * r} × ${n - 1} = ${2 * r * (n - 1)}cm이다.`],
        };
      }
      if (kind === 'row-perimeter') {
        return {
          shown: [r, n], value: 4 * r * (n + 1), check: { r, perR: 4 * (n + 1) },
          stem: `${intro} 원을 꼭 맞게 둘러싸는 직사각형의 네 변의 길이의 합은 몇 cm입니까?`,
          solution: [`직사각형의 긴 변은 ${2 * r} × ${n} = ${2 * r * n}cm, 짧은 변은 지름인 ${2 * r}cm이다.`, `(${2 * r * n} + ${2 * r}) × 2 = ${4 * r * (n + 1)}cm이다.`],
        };
      }
      if (kind === 'radius-from-long') {
        return {
          shown: [2 * r * n, n], value: r, check: { total: 2 * r * n, perR: 2 * n },
          stem: `크기가 같은 원 ${n}개를 한 줄로 맞닿게 그리고 꼭 맞게 둘러싸는 직사각형을 그렸더니 긴 변이 ${2 * r * n}cm였습니다. 원의 반지름은 몇 cm입니까?`,
          solution: [`긴 변은 지름 ${n}개를 이은 길이와 같으므로 지름은 ${2 * r * n} ÷ ${n} = ${2 * r}cm이다.`, `반지름은 ${2 * r} ÷ 2 = ${r}cm이다.`],
        };
      }
      if (kind === 'big-circle') {
        return {
          shown: [r * n, n], value: r, check: { total: r * n, perR: n },
          stem: `큰 원 안에 크기가 같은 작은 원 ${n}개를 큰 원의 지름 위에 한 줄로 맞닿게 그렸더니 양 끝의 작은 원이 큰 원에 꼭 맞게 닿았습니다. 큰 원의 반지름이 ${r * n}cm일 때 작은 원의 반지름은 몇 cm입니까?`,
          solution: [`큰 원의 지름 ${2 * r * n}cm는 작은 원의 지름 ${n}개의 길이와 같다.`, `작은 원의 지름은 ${2 * r * n} ÷ ${n} = ${2 * r}cm이므로 반지름은 ${r}cm이다.`],
        };
      }
      if (kind === 'two-sizes') {
        const R = rng.int(2, rMax);
        const p = rng.int(1, 5);
        const q = rng.int(1, 5);
        const len = 2 * (R * p + r * q);
        return {
          shown: [R, p, r, q], value: len, check: { parts: [[R, p], [r, q]] },
          stem: `반지름이 ${R}cm인 원 ${p}개와 반지름이 ${r}cm인 원 ${q}개를 한 줄로 맞닿게 그렸습니다. 원을 모두 지나는 가장 긴 선분의 길이는 몇 cm입니까?`,
          solution: [`반지름이 ${R}cm인 원 ${p}개의 지름의 합은 ${2 * R} × ${p} = ${2 * R * p}cm이다.`, `반지름이 ${r}cm인 원 ${q}개의 지름의 합은 ${2 * r} × ${q} = ${2 * r * q}cm이다.`, `${2 * R * p} + ${2 * r * q} = ${len}cm이다.`],
        };
      }
      const m = rng.int(2, 5);
      const P = 4 * r * (n + m);
      if (kind === 'grid-perimeter') {
        return {
          shown: [r, n, m], value: P, check: { r, perR: 4 * (n + m) },
          stem: `반지름이 ${r}cm인 원을 가로로 ${n}개, 세로로 ${m}개씩 맞닿게 그리고 꼭 맞게 둘러싸는 직사각형을 그렸습니다. 직사각형의 네 변의 길이의 합은 몇 cm입니까?`,
          solution: [`가로는 ${2 * r} × ${n} = ${2 * r * n}cm, 세로는 ${2 * r} × ${m} = ${2 * r * m}cm이다.`, `(${2 * r * n} + ${2 * r * m}) × 2 = ${P}cm이다.`],
        };
      }
      return {
        shown: [n, m, P], value: r, check: { total: P, perR: 4 * (n + m) },
        stem: `크기가 같은 원을 가로로 ${n}개, 세로로 ${m}개씩 맞닿게 그리고 꼭 맞게 둘러싸는 직사각형을 그렸더니 네 변의 길이의 합이 ${P}cm였습니다. 원의 반지름은 몇 cm입니까?`,
        solution: [`네 변의 길이의 합은 지름 (${n} + ${m}) × 2 = ${2 * (n + m)}개를 이은 길이와 같다.`, `지름은 ${P} ÷ ${2 * (n + m)} = ${2 * r}cm이므로 반지름은 ${r}cm이다.`],
      };
    }, (x) => !x.shown.includes(x.value));
    const [p1, p2, p3 = 0] = item.shown;
    return {
      params: { kind, p1, p2, p3, ...item.check },
      instruction: '물음에 답하시오.',
      stem: item.stem,
      answer: unitAnswer(item.value, 'cm'),
      solution: item.solution,
      dedupeKey: `circles-row:${kind}:${item.shown.join('-')}`,
      difficulty,
    };
  },
  verify({ r, perR, total, parts }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    if (parts) return parts.reduce((s, [rad, cnt]) => s - 2 * rad * cnt, v) === 0;
    // 반지름을 구하는 문제는 다시 곱해 전체 길이가 되는지, 길이를 구하는 문제는 나누어 반지름이 되는지 본다.
    if (total !== undefined) return v * perR === total;
    return v % perR === 0 && v / perR === r;
  },
};

// ---------------------------------------------------------------------------
// [4수03-14] 초 단위까지의 시간 문장제
// ---------------------------------------------------------------------------

const toHms = (sec) => [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), sec % 60];
const fmtClock = (sec) => { const [h, m, s] = toHms(sec); return `${h}시 ${m}분 ${s}초`; };
const fmtSpan = (sec) => { const [h, m, s] = toHms(sec); return `${h > 0 ? `${h}시간 ` : ''}${m}분 ${s}초`; };
const ACTIVITIES = ['줄넘기', '독서', '피아노 연습', '청소', '달리기', '숙제', '그림 그리기'];

const timeStory = {
  id: 'math.g34.mr.s03-14.time-story',
  standardCode: '[4수03-14]',
  skill: '시작 시각·걸린 시간·끝난 시각 중 모르는 것을 초 단위까지 구하는 문장제',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = rng.pick(['end', 'duration', 'start']);
    const A = rng.pick(ACTIVITIES);
    const { start, dur, end } = rng.until(() => {
      const st = rng.int(1, 8) * 3600 + rng.int(1, 59) * 60 + rng.int(1, 59);
      const hours = difficulty === 1 ? 0 : difficulty === 2 ? rng.int(0, 1) : rng.int(1, 3);
      const du = hours * 3600 + rng.int(1, 59) * 60 + rng.int(1, 59);
      return { start: st, dur: du, end: st + du };
    }, ({ end: e }) => toHms(e)[1] > 0 && toHms(e)[2] > 0);
    const Aeul = `${A}${josaEul(A)}`;
    let value;
    let stem;
    let solution;
    if (kind === 'end') {
      value = fmtClock(end);
      stem = `${Aeul} ${fmtClock(start)}에 시작해서 ${fmtSpan(dur)} 동안 했습니다. ${Aeul} 끝낸 시각은 몇 시 몇 분 몇 초입니까?`;
      solution = ['끝낸 시각은 시작한 시각에 걸린 시간을 더해서 구한다.', `${fmtClock(start)} + ${fmtSpan(dur)} = ${fmtClock(end)}이다.`];
    } else if (kind === 'duration') {
      value = fmtSpan(dur);
      stem = `${Aeul} ${fmtClock(start)}에 시작해서 ${fmtClock(end)}에 끝냈습니다. ${Aeul} 한 시간은 몇 ${dur >= 3600 ? '시간 몇 ' : ''}분 몇 초입니까?`;
      solution = ['걸린 시간은 끝낸 시각에서 시작한 시각을 빼서 구한다.', `${fmtClock(end)} - ${fmtClock(start)} = ${fmtSpan(dur)}이다.`];
    } else {
      value = fmtClock(start);
      stem = `${Aeul} ${fmtSpan(dur)} 동안 해서 ${fmtClock(end)}에 끝냈습니다. ${Aeul} 시작한 시각은 몇 시 몇 분 몇 초입니까?`;
      solution = ['시작한 시각은 끝낸 시각에서 걸린 시간을 빼서 구한다.', `${fmtClock(end)} - ${fmtSpan(dur)} = ${fmtClock(start)}이다.`];
    }
    return {
      params: { kind, start, dur, end },
      instruction: '물음에 답하시오.',
      stem,
      answer: { value, display: value, accepts: [value, value.replace(/ /g, '')] },
      solution,
      dedupeKey: `time-story:${kind}:${start}:${dur}`,
      difficulty,
    };
  },
  verify({ kind, start, dur, end }, answer) {
    const text = String(answer.value);
    const clock = /^(\d{1,2})시 ?(\d{1,2})분 ?(\d{1,2})초$/.exec(text);
    const span = /^(?:(\d+)시간 ?)?(\d{1,2})분 ?(\d{1,2})초$/.exec(text);
    const m = kind === 'duration' ? span : clock;
    if (!m || Number(m[2]) >= 60 || Number(m[3]) >= 60) return false;
    const sec = Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    // 시각과 시간의 관계(시작 + 걸린 시간 = 끝)를 각 경우의 역연산으로 확인한다.
    if (kind === 'end') return sec - dur === start;
    if (kind === 'duration') return start + sec === end;
    return sec + dur === end;
  },
};

// ---------------------------------------------------------------------------
// [4수03-16] [4수03-19] [4수03-23] 두 단위가 섞인 여러 단계 문장제
// ---------------------------------------------------------------------------

function mixedFmt(v, P) {
  const hi = Math.floor(v / P.rate);
  const lo = v % P.rate;
  if (hi === 0) return `${lo}${P.small}`;
  if (lo === 0) return `${hi}${P.big}`;
  return `${hi}${P.big} ${lo}${P.small}`;
}

function parseMixed(text, P) {
  const both = new RegExp(`^(\\d+)${P.big} ?(\\d+)${P.small}$`).exec(text);
  if (both) {
    const lo = Number(both[2]);
    return Number(both[1]) > 0 && lo > 0 && lo < P.rate ? Number(both[1]) * P.rate + lo : null;
  }
  const onlyBig = new RegExp(`^(\\d+)${P.big}$`).exec(text);
  if (onlyBig) return Number(onlyBig[1]) * P.rate;
  const onlySmall = new RegExp(`^(\\d+)${P.small}$`).exec(text);
  return onlySmall ? Number(onlySmall[1]) : null;
}

/** 큰 단위 hi 범위와 작은 단위 1..rate-1 로 섞인 양을 뽑는다. */
const mixedValue = (rng, P, lo, hi) => rng.int(lo, hi) * P.rate + rng.int(1, P.rate - 1);

/**
 * 단위가 섞인 문장제 생성기를 만든다. 각 kind 는 더하는 양(plus)과 빼는 양(minus),
 * 문장을 만드는 render 를 돌려준다. 답이 큰 단위로 나누어떨어지는 경우는 다시 뽑아
 * 문장·params·답이 모두 같은 수에서 나오게 한다.
 */
function makeMeasureStory({ id, standardCode, skill, systems, kinds, build }) {
  return {
    id,
    standardCode,
    skill,
    format: 'short-answer',
    generate(rng, { difficulty }) {
      const P = systems(difficulty);
      const kind = rng.pick(kinds[difficulty]);
      const made = rng.until(() => build[kind](rng, P, difficulty), (x) => {
        const diff = sum(x.plus) - sum(x.minus);
        return diff > 0 && diff % P.rate !== 0;
      });
      const { plus, minus } = made;
      const v = sum(plus) - sum(minus);
      const M = (x) => mixedFmt(x, P);
      const ask = v >= P.rate ? `몇 ${P.big} 몇 ${P.small}` : `몇 ${P.small}`;
      const display = M(v);
      const expr = `${plus.map(M).join(' + ')}${minus.map((x) => ` - ${M(x)}`).join('')}`;
      return {
        params: { rate: P.rate, big: P.big, small: P.small, kind, plus, minus, scale: sum(plus) },
        instruction: '물음에 답하시오.',
        stem: made.render(M, ask, (w1, w2) => pj(P.small, w1, w2)),
        answer: { value: display, display, accepts: [display, display.replace(' ', ''), `${v}${P.small}`] },
        solution: [
          `1${P.big}${pj(P.big, '은', '는')} ${P.rate}${P.small}이므로 같은 단위끼리 계산한다.`,
          `${expr} = ${display}${pj(P.small, '이다', '다')}.`,
          `답은 ${display}${pj(P.small, '이다', '다')}.`,
        ],
        dedupeKey: `measure-story:${P.small}:${kind}:${plus.join('+')}:${minus.join('-')}${made.keyPart ? `:${made.keyPart}` : ''}`,
        difficulty,
      };
    },
    verify({ rate, big, small, plus, minus }, answer) {
      const x = parseMixed(String(answer.value), { rate, big, small });
      if (x === null || x <= 0) return false;
      // 남은 양에 덜어 낸 양을 다시 더하면 처음 양들의 합이 되어야 한다.
      return x + sum(minus) === sum(plus);
    },
  };
}

const CM_MM = { rate: 10, big: 'cm', small: 'mm' };
const KM_M = { rate: 1000, big: 'km', small: 'm' };
const L_ML = { rate: 1000, big: 'L', small: 'mL' };
const KG_G = { rate: 1000, big: 'kg', small: 'g' };

const lengthStory = makeMeasureStory({
  id: 'math.g34.mr.s03-16.length-story',
  standardCode: '[4수03-16]',
  skill: '몇 cm 몇 mm, 몇 km 몇 m가 섞인 길이 문장제를 여러 단계로 풀기',
  systems: (d) => (d === 1 ? CM_MM : KM_M),
  kinds: { 1: ['ribbon-total', 'ribbon-left'], 2: ['route-total', 'remaining'], 3: ['route-compare', 'round-trip', 'remaining'] },
  build: {
    'ribbon-total': (rng, P) => {
      const a = mixedValue(rng, P, 5, 40);
      const b = mixedValue(rng, P, 5, 40);
      return { plus: [a, b], minus: [], render: (M, ask, j) => `빨간 리본 ${M(a)}${j('과', '와')} 파란 리본 ${M(b)}${j('을', '를')} 겹치지 않게 이었습니다. 이은 리본의 길이는 ${ask}입니까?` };
    },
    'ribbon-left': (rng, P) => {
      const b = mixedValue(rng, P, 3, 30);
      const a = b + rng.int(11, 400);
      return { plus: [a], minus: [b], render: (M, ask, j) => `길이가 ${M(a)}인 리본에서 ${M(b)}${j('을', '를')} 잘라 썼습니다. 남은 리본의 길이는 ${ask}입니까?` };
    },
    'route-total': (rng, P) => {
      const a = mixedValue(rng, P, 1, 3);
      const b = rng.int(101, 999);
      return { plus: [a, b], minus: [], render: (M, ask) => `집에서 학교까지는 ${M(a)}이고, 학교에서 도서관까지는 ${M(b)}입니다. 집에서 학교를 거쳐 도서관까지 가는 거리는 ${ask}입니까?` };
    },
    remaining: (rng, P, d) => {
      const a = mixedValue(rng, P, 1, d === 2 ? 2 : 4);
      const b = d === 2 ? rng.int(101, 999) : mixedValue(rng, P, 1, 3);
      const T = a + b + rng.int(11, 2999);
      return { plus: [T], minus: [a, b], render: (M, ask, j) => `길이가 ${M(T)}인 둘레길을 걷고 있습니다. 오전에 ${M(a)}, 오후에 ${M(b)}${j('을', '를')} 걸었습니다. 남은 거리는 ${ask}입니까?` };
    },
    'route-compare': (rng, P) => {
      const a = mixedValue(rng, P, 1, 5);
      const b = mixedValue(rng, P, 1, 4);
      const c = mixedValue(rng, P, 2, 9);
      const longer = a + b > c;
      return {
        plus: longer ? [a, b] : [c],
        minus: longer ? [c] : [a, b],
        render: (M, ask, j) => `가 길은 ${M(a)}${j('과', '와')} ${M(b)}${j('을', '를')} 이은 길이고, 나 길은 ${M(c)}인 길입니다. 두 길의 길이의 차는 ${ask}입니까?`,
      };
    },
    'round-trip': (rng, P) => {
      const a = mixedValue(rng, P, 1, 4);
      const b = rng.int(101, 999);
      return { plus: [a, a, b], minus: [], render: (M, ask, j) => `집에서 공원까지의 거리는 ${M(a)}입니다. 집에서 공원까지 갔다가 집으로 돌아온 뒤 ${M(b)}${j('을', '를')} 더 걸었습니다. 모두 걸은 거리는 ${ask}입니까?` };
    },
  },
});

const capacityStory = makeMeasureStory({
  id: 'math.g34.mr.s03-19.capacity-story',
  standardCode: '[4수03-19]',
  skill: '몇 L 몇 mL가 섞인 들이 문장제를 여러 단계로 풀기',
  systems: () => L_ML,
  kinds: { 1: ['combine', 'more-needed'], 2: ['pour-twice', 'compare-two'], 3: ['combine-then-pour', 'pour-twice'] },
  build: {
    combine: (rng, P) => {
      const a = mixedValue(rng, P, 1, 3);
      const b = rng.bool() ? rng.int(101, 999) : mixedValue(rng, P, 1, 2);
      return { plus: [a, b], minus: [], render: (M, ask, j) => `물통에 물이 ${M(a)} 들어 있습니다. 여기에 물 ${M(b)}${j('을', '를')} 더 부었습니다. 물통에 들어 있는 물은 모두 ${ask}입니까?` };
    },
    'more-needed': (rng, P) => {
      const T = rng.int(2, 5);
      const a = mixedValue(rng, P, 1, T - 1);
      return { plus: [T * P.rate], minus: [a], render: (M, ask) => `들이가 ${T}L인 수조에 물이 ${M(a)} 들어 있습니다. 수조를 가득 채우려면 물을 ${ask} 더 부어야 합니까?` };
    },
    'pour-twice': (rng, P, d) => {
      const a = mixedValue(rng, P, d === 2 ? 2 : 4, d === 2 ? 6 : 9);
      const b = rng.int(101, 999);
      const c = d === 2 ? rng.int(101, 999) : mixedValue(rng, P, 1, 2);
      return { plus: [a], minus: [b, c], render: (M, ask, j) => `주스 ${M(a)} 중에서 오전에 ${M(b)}, 오후에 ${M(c)}${j('을', '를')} 마셨습니다. 남은 주스는 ${ask}입니까?` };
    },
    'compare-two': (rng, P) => {
      const a = mixedValue(rng, P, 1, 6);
      const b = rng.int(1001, 6999);
      const big = Math.max(a, b);
      const small = Math.min(a, b);
      return { plus: [big], minus: [small], keyPart: `${a}:${b}`, render: (M, ask) => `가 그릇에는 물이 ${M(a)}, 나 그릇에는 물이 ${b}mL 들어 있습니다. 두 그릇에 들어 있는 물의 양의 차는 ${ask}입니까?` };
    },
    'combine-then-pour': (rng, P) => {
      const a = mixedValue(rng, P, 2, 9);
      const b = mixedValue(rng, P, 2, 9);
      const c = mixedValue(rng, P, 1, 3);
      return { plus: [a, b], minus: [c], render: (M, ask, j) => `물 ${M(a)}${j('과', '와')} ${M(b)}${j('을', '를')} 큰 통에 모두 부은 뒤 ${M(c)}${j('을', '를')} 덜어 냈습니다. 큰 통에 남은 물은 ${ask}입니까?` };
    },
  },
});

const weightStory = makeMeasureStory({
  id: 'math.g34.mr.s03-23.weight-story',
  standardCode: '[4수03-23]',
  skill: '몇 kg 몇 g이 섞인 무게 문장제를 여러 단계로 풀기',
  systems: () => KG_G,
  kinds: { 1: ['net', 'add2'], 2: ['balance-diff', 'remove-two'], 3: ['add3', 'remove-two', 'net'] },
  build: {
    net: (rng, P, d) => {
      const fruit = mixedValue(rng, P, 1, d === 1 ? 3 : 9);
      const basket = rng.int(101, 999);
      const a = fruit + basket;
      return { plus: [a], minus: [basket], render: (M, ask) => `사과를 담은 바구니의 무게는 ${M(a)}이고, 빈 바구니의 무게는 ${M(basket)}입니다. 사과만의 무게는 ${ask}입니까?` };
    },
    add2: (rng, P) => {
      const a = mixedValue(rng, P, 1, 3);
      const b = rng.int(101, 999);
      return { plus: [a, b], minus: [], render: (M, ask) => `가방의 무게는 ${M(a)}입니다. 이 가방에 무게가 ${M(b)}인 책을 넣었습니다. 책을 넣은 가방의 무게는 ${ask}입니까?` };
    },
    'balance-diff': (rng, P) => {
      const a = mixedValue(rng, P, 1, 6);
      const b = mixedValue(rng, P, 1, 6);
      return {
        plus: [Math.max(a, b)], minus: [Math.min(a, b)],
        render: (M, ask) => `고구마 한 상자는 ${M(a)}이고, 감자 한 상자는 ${M(b)}입니다. 두 상자의 무게의 차는 ${ask}입니까?`,
      };
    },
    'remove-two': (rng, P, d) => {
      const a = mixedValue(rng, P, d === 2 ? 2 : 4, d === 2 ? 5 : 9);
      const b = rng.int(101, 999);
      const c = d === 2 ? rng.int(101, 999) : mixedValue(rng, P, 1, 2);
      return { plus: [a], minus: [b, c], render: (M, ask, j) => `${M(a)}인 밀가루 포대에서 빵을 만드느라 ${M(b)}, 과자를 만드느라 ${M(c)}${j('을', '를')} 덜어 냈습니다. 남은 밀가루는 ${ask}입니까?` };
    },
    add3: (rng, P) => {
      const a = mixedValue(rng, P, 2, 9);
      const b = mixedValue(rng, P, 1, 5);
      const c = rng.int(101, 999);
      return { plus: [a, b, c], minus: [], render: (M, ask) => `택배 상자에 ${M(a)}인 쌀, ${M(b)}인 콩, ${M(c)}인 깨를 넣었습니다. 넣은 물건의 무게는 모두 ${ask}입니까?` };
    },
  },
});

// ---------------------------------------------------------------------------
// [4수03-22] t 과 kg 의 관계를 이용한 문장제
// ---------------------------------------------------------------------------

const T_KG = { rate: 1000, big: 't', small: 'kg' };

const tonStory = {
  id: 'math.g34.mr.s03-22.ton-story',
  standardCode: '[4수03-22]',
  skill: '1t과 1kg의 관계를 이용해 실을 수 있는 무게와 상자 수 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = rng.pick(difficulty === 1 ? ['remaining-kg', 'compare'] : difficulty === 2 ? ['boxes', 'remaining-kg', 'compare'] : ['boxes-loaded', 'compare']);
    const M = (x) => mixedFmt(x, T_KG);
    const item = rng.until(() => {
      if (kind === 'remaining-kg') {
        const T = rng.int(difficulty === 1 ? 1 : 3, difficulty === 1 ? 3 : 9);
        const A = mixedValue(rng, T_KG, 0, T - 1);
        return {
          check: { cap: T * 1000, loaded: A }, value: T * 1000 - A, unit: 'kg', shown: [T, A],
          stem: `최대 ${T}t까지 실을 수 있는 트럭에 ${M(A)}의 짐을 실었습니다. 짐을 몇 kg 더 실을 수 있습니까?`,
          solution: [`${T}t = ${T * 1000}kg이고 ${M(A)} = ${A}kg이다.`, `${T * 1000} - ${A} = ${T * 1000 - A}이므로 ${T * 1000 - A}kg이다.`],
        };
      }
      if (kind === 'compare') {
        // 하마는 1500~3000kg, 코끼리는 그보다 무거운 3t~7t 로 둔다.
        const a = mixedValue(rng, T_KG, difficulty === 1 ? 3 : 5, difficulty === 1 ? 4 : 6);
        const b = rng.int(1500, 3000);
        return {
          check: { pair: [a, b] }, value: Math.abs(a - b), unit: 'kg', shown: [a, b],
          stem: `코끼리의 무게는 ${M(a)}이고, 하마의 무게는 ${b}kg입니다. 두 동물의 무게의 차는 몇 kg입니까?`,
          solution: [`${M(a)} = ${a}kg이다.`, `${Math.max(a, b)} - ${Math.min(a, b)} = ${Math.abs(a - b)}이므로 ${Math.abs(a - b)}kg이다.`],
        };
      }
      const T = rng.int(1, 9);
      const w = rng.int(11, difficulty === 2 ? 199 : 99);
      const A = kind === 'boxes-loaded' ? mixedValue(rng, T_KG, 0, T - 1) : 0;
      const room = T * 1000 - A;
      const boxes = Math.floor(room / w);
      return {
        check: { room, w }, value: boxes, unit: '개', shown: [T, w, A],
        stem: kind === 'boxes'
          ? `최대 ${T}t까지 실을 수 있는 트럭에 한 상자의 무게가 ${w}kg인 상자를 실으려고 합니다. 상자를 최대 몇 개까지 실을 수 있습니까?`
          : `최대 ${T}t까지 실을 수 있는 트럭에 이미 ${M(A)}의 짐을 실었습니다. 한 상자의 무게가 ${w}kg인 상자를 더 실으려면 최대 몇 개까지 실을 수 있습니까?`,
        solution: [
          A > 0 ? `더 실을 수 있는 무게는 ${T * 1000} - ${A} = ${room}kg이다.` : `${T}t = ${room}kg이다.`,
          `${room} ÷ ${w} = ${boxes} ··· ${room % w}이므로 최대 ${boxes}개이다.`,
        ],
      };
    }, (x) => x.value > 0 && !x.shown.includes(x.value));
    const [p1, p2, p3 = 0] = item.shown;
    return {
      params: { kind, p1, p2, p3, ...item.check },
      instruction: '물음에 답하시오.',
      stem: item.stem,
      answer: unitAnswer(item.value, item.unit),
      solution: item.solution,
      dedupeKey: `ton-story:${kind}:${item.shown.join('-')}`,
      difficulty,
    };
  },
  verify({ kind, cap, loaded, pair, room, w }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    if (kind === 'remaining-kg') return v + loaded === cap;
    if (kind === 'compare') return Math.min(...pair) + v === Math.max(...pair);
    // 상자 v 개는 실을 수 있고 하나 더는 실을 수 없어야 한다.
    return v * w <= room && (v + 1) * w > room;
  },
};

// ---------------------------------------------------------------------------
// [4수01-01] 큰 수 만들기 · [4수01-02] 뛰어 세기와 크기 비교
// ---------------------------------------------------------------------------

const BIG_PARTS = {
  1: [[10000, numI(10000)], [1000, numI(1000)], [100, numI(100)], [10, numI(10)], [1, numI(1)]],
  2: [[100000000, '1억이'], [10000000, '1000만이'], [10000, '1만이'], [1, '1이']],
  3: [[1000000000000, '1조가'], [100000000, '1억이'], [10000, '1만이']],
};
const COUNT_UNITS = {
  1: [[100, numI(100)], [1000, numI(1000)]],
  2: [[10000, '1만이'], [100000, '10만이']],
  3: [[100000000, '1억이'], [1000000000, '10억이']],
};

const composeBig = {
  id: 'math.g34.no.s01.compose-big',
  standardCode: '[4수01-01]',
  skill: '자릿값 단위의 개수로 큰 수를 만들고, 큰 수가 어떤 단위의 몇 개인지 알기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = rng.pick(['compose', 'compose', 'count-of']);
    if (kind === 'count-of') {
      const [U, label] = rng.pick(COUNT_UNITS[difficulty]);
      const k = rng.int(difficulty === 1 ? 11 : 101, difficulty === 1 ? 9999 : 99999);
      const N = U * k;
      return {
        params: { kind, U, N, counts: [] },
        instruction: '물음에 답하시오.',
        stem: `${numEun(N)} ${label} 몇 개인 수입니까?`,
        answer: { value: k, display: `${k}개`, accepts: [num(k), `${k}개`] },
        solution: [`${N}에서 ${U}의 자리 아래는 모두 0이다.`, `${N} ÷ ${U} = ${k}이므로 ${label} ${k}개인 수이다.`],
        dedupeKey: `compose-big:count:${U}:${k}`,
        difficulty,
      };
    }
    const parts = BIG_PARTS[difficulty];
    const caps = { 1: [9, 39, 39, 39, 39], 2: [99, 19, 9999, 9999], 3: [999, 99999, 9999] }[difficulty];
    const counts = caps.map((cap, k) => (k === 0 ? rng.int(1, cap) : rng.int(0, cap)));
    if (counts.slice(1).every((c) => c === 0)) counts[counts.length - 1] = 1;
    const value = sum(counts.map((c, k) => c * parts[k][0]));
    const shownParts = parts.map(([, label], k) => `${label} ${counts[k]}개`).filter((_, k) => counts[k] > 0);
    return {
      params: { kind, units: parts.map(([u]) => u), counts, U: 0, N: 0 },
      instruction: '물음에 답하시오.',
      stem: `${shownParts.join(', ')}인 수는 얼마입니까?`,
      answer: { value, display: num(value), accepts: [num(value)] },
      solution: [
        `${parts.map(([u], k) => `${u} × ${counts[k]}`).filter((_, k) => counts[k] > 0).join(' + ')}의 값을 구한다.`,
        `${parts.map(([u], k) => u * counts[k]).filter((_, k) => counts[k] > 0).join(' + ')} = ${value}이다.`,
      ],
      dedupeKey: `compose-big:compose:${difficulty === 1 ? 'man' : difficulty === 2 ? 'eok' : 'jo'}:${counts.join('-')}`,
      difficulty,
    };
  },
  verify({ kind, units, counts, U, N }, answer) {
    const v = answer.value;
    if (!Number.isSafeInteger(v) || v <= 0) return false;
    if (kind === 'count-of') return v * U === N;
    // 큰 단위부터 개수만큼 덜어 내면 정확히 0이 남아야 한다.
    let rest = v;
    for (let k = 0; k < units.length; k += 1) rest -= units[k] * counts[k];
    return rest === 0;
  },
};

const SKIP_STEPS = {
  1: [[1000, '1000'], [10000, '1만']],
  2: [[100000, '10만'], [1000000, '100만']],
  3: [[10000000, '1000만'], [100000000, '1억'], [1000000000, '10억']],
};

const skipCount = {
  id: 'math.g34.no.s02.skip-count',
  standardCode: '[4수01-02]',
  skill: '큰 수를 1만·10만·1억 등으로 여러 번 뛰어 세기와 뛰어 센 크기 찾기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = rng.pick(['forward', 'backward', 'find-step', 'count-skips']);
    const [S, SL] = rng.pick(SKIP_STEPS[difficulty]);
    const k = rng.int(2, 9);
    const scale = difficulty === 1 ? 1000 : difficulty === 2 ? 100000 : 10000000;
    const N = rng.int(10 + k * S / scale, 999) * scale + rng.int(1, scale - 1);
    const end = kind === 'backward' ? N - k * S : N + k * S;
    let value;
    let stem;
    if (kind === 'forward') {
      value = end;
      stem = `${N}에서 ${SL}씩 ${k}번 뛰어 센 수는 얼마입니까?`;
    } else if (kind === 'backward') {
      value = end;
      stem = `${N}에서 ${SL}씩 거꾸로 ${k}번 뛰어 센 수는 얼마입니까?`;
    } else if (kind === 'find-step') {
      value = S;
      stem = `${N}에서 일정한 크기로 ${k}번 뛰어 세었더니 ${end}${numberParticle(end, '이', '가')} 되었습니다. 몇씩 뛰어 센 것입니까?`;
    } else {
      value = k;
      stem = `${N}에서 ${SL}씩 몇 번 뛰어 세면 ${end}${numberParticle(end, '이', '가')} 됩니까?`;
    }
    const display = kind === 'count-skips' ? `${k}번` : num(value);
    return {
      params: { kind, N, S, k, end },
      instruction: '물음에 답하시오.',
      stem,
      answer: { value, display, accepts: kind === 'count-skips' ? [num(k), `${k}번`] : [num(value)] },
      solution: [
        `${SL}씩 뛰어 세면 ${S}씩 ${kind === 'backward' ? '작아진다' : '커진다'}.`,
        kind === 'forward' || kind === 'find-step' || kind === 'count-skips'
          ? `${N} + ${S} × ${k} = ${N + k * S}이다.`
          : `${N} - ${S} × ${k} = ${N - k * S}이다.`,
      ],
      dedupeKey: `skip-count:${kind}:${N}:${S}:${k}`,
      difficulty,
    };
  },
  verify({ kind, N, S, k, end }, answer) {
    const v = answer.value;
    if (!Number.isSafeInteger(v) || v <= 0) return false;
    if (kind === 'forward') return v - S * k === N;
    if (kind === 'backward') return v + S * k === N;
    if (kind === 'find-step') return (end - N) % v === 0 && (end - N) / v === k;
    // 한 번씩 뛰어 세어 끝 수에 닿는 횟수를 센다.
    let x = N;
    let count = 0;
    while (x < end) { x += S; count += 1; }
    return x === end && count === v;
  },
};

const blankDigitCompare = {
  id: 'math.g34.no.s02.blank-digit-count',
  standardCode: '[4수01-02]',
  skill: '큰 수의 크기 비교에서 □ 안에 들어갈 수 있는 숫자의 개수 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const len = difficulty === 1 ? rng.int(5, 6) : difficulty === 2 ? rng.int(7, 8) : rng.int(9, 12);
    const p = rng.int(0, len - 2);
    const op = rng.pick(['>', '<']);
    const a = Array.from({ length: len }, (_, k) => (k === 0 ? rng.int(1, 9) : rng.int(0, 9)));
    const b = [...a];
    b[p] = p === 0 ? rng.int(2, 8) : rng.int(1, 8);
    for (let k = p + 1; k < len; k += 1) b[k] = rng.int(0, 9);
    const tailA = a.slice(p + 1).join('');
    const tailB = b.slice(p + 1).join('');
    const lowest = p === 0 ? 1 : 0;
    const bp = b[p];
    // 자리별 비교: □가 b 의 같은 자리 숫자보다 크면(작으면) 정해지고, 같으면 뒷자리가 정한다.
    const strict = op === '>' ? 9 - bp : bp - lowest;
    const tie = op === '>' ? tailA > tailB : tailA < tailB;
    const value = strict + (tie ? 1 : 0);
    const shownA = a.map((x, k) => (k === p ? '□' : String(x))).join('');
    const B = b.join('');
    return {
      params: { shownA, B, op },
      instruction: '물음에 답하시오.',
      stem: `${shownA} ${op} ${B}\n${lowest}부터 9까지의 숫자 중 □ 안에 들어갈 수 있는 숫자는 모두 몇 개입니까?`,
      answer: { value, display: `${value}개`, accepts: [num(value), `${value}개`] },
      solution: [
        `□ 앞의 자리 숫자는 같으므로 □가 있는 자리부터 비교한다.`,
        `□ 자리의 숫자 ${bp}${op === '>' ? '보다 큰' : '보다 작은'} 숫자는 ${strict}개이다.`,
        tie ? `□가 ${bp}일 때도 뒷자리를 비교하면 성립하므로 모두 ${value}개이다.` : `□가 ${bp}일 때는 성립하지 않으므로 모두 ${value}개이다.`,
      ],
      dedupeKey: `blank-digit:${shownA}${op}${B}`,
      difficulty,
    };
  },
  verify({ shownA, B, op }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v)) return false;
    // 0부터 9까지 하나씩 넣어 보며 실제로 성립하는 경우를 센다.
    let count = 0;
    for (let x = 0; x <= 9; x += 1) {
      if (x === 0 && shownA.startsWith('□')) continue;
      const A = Number(shownA.replace('□', String(x)));
      if (op === '>' ? A > Number(B) : A < Number(B)) count += 1;
    }
    return count === v;
  },
};

// ---------------------------------------------------------------------------
// [4수01-06] 잘못 계산한 나눗셈 · [4수01-07] 두 자리 수로 나누는 문장제
// ---------------------------------------------------------------------------

const DIVIDE2_CONTEXTS = [
  {
    intro: (t, d) => `학생 ${t}명이 한 대에 ${d}명씩 탈 수 있는 버스를 타려고 합니다.`,
    asks: {
      full: (d) => `${d}명씩 꽉 채워 탄 버스는 몇 대입니까?`,
      left: (d) => `${d}명씩 꽉 채워 탈 때 버스에 타지 못하는 학생은 몇 명입니까?`,
      'at-least': () => '학생이 모두 타려면 버스는 적어도 몇 대 필요합니까?',
      'more-needed': () => '모든 버스를 꽉 채우려면 학생이 적어도 몇 명 더 있어야 합니까?',
    },
    units: { full: '대', left: '명', 'at-least': '대', 'more-needed': '명' },
  },
  {
    intro: (t, d) => `구슬 ${t}개를 한 봉지에 ${d}개씩 담으려고 합니다.`,
    asks: {
      full: (d) => `${d}개씩 가득 담은 봉지는 몇 봉지입니까?`,
      left: () => '봉지에 담고 남는 구슬은 몇 개입니까?',
      'at-least': () => '구슬을 남김없이 모두 담으려면 봉지는 적어도 몇 봉지 필요합니까?',
      'more-needed': () => '남는 구슬 없이 모든 봉지를 가득 채우려면 구슬이 적어도 몇 개 더 있어야 합니까?',
    },
    units: { full: '봉지', left: '개', 'at-least': '봉지', 'more-needed': '개' },
  },
  {
    intro: (t, d) => `색종이 ${t}장을 ${d}명에게 똑같이 나누어 주려고 합니다.`,
    asks: {
      full: () => '한 명에게 최대 몇 장씩 줄 수 있습니까?',
      left: () => '똑같이 나누어 주고 남는 색종이는 몇 장입니까?',
      'at-least': () => '한 명에게 한 장씩 더 주려면 색종이가 적어도 몇 장 더 있어야 합니까?',
      'more-needed': () => '남김없이 똑같이 나누어 주려면 색종이가 적어도 몇 장 더 있어야 합니까?',
    },
    units: { full: '장', left: '장', 'at-least': '장', 'more-needed': '장' },
  },
];

const divide2Story = {
  id: 'math.g34.no.s07.story-two-digit',
  standardCode: '[4수01-07]',
  skill: '두 자리 수로 나누는 나눗셈 상황에서 몫과 나머지로 답 정하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const c = rng.pick(DIVIDE2_CONTEXTS);
    const kind = rng.pick(['full', 'left', 'at-least', 'more-needed']);
    const { total, d } = rng.until(() => {
      const dd = difficulty === 1 ? rng.int(11, 29) : difficulty === 2 ? rng.int(11, 49) : rng.int(50, 99);
      const tt = difficulty === 1 ? rng.int(100, 399) : rng.int(300, 999);
      return { total: tt, d: dd };
    }, (x) => x.total % x.d !== 0);
    const q = Math.floor(total / d);
    const r = total % d;
    // 색종이 맥락의 '한 장씩 더' 는 사람 수에서 나머지를 뺀 만큼이 필요하다.
    const atLeastValue = c === DIVIDE2_CONTEXTS[2] ? d - r : q + 1;
    const value = kind === 'full' ? q : kind === 'left' ? r : kind === 'at-least' ? atLeastValue : d - r;
    const mode = kind === 'at-least' && c === DIVIDE2_CONTEXTS[2] ? 'more-needed' : kind;
    const unit = c.units[kind];
    return {
      params: { mode, total, d },
      instruction: '물음에 답하시오.',
      stem: `${c.intro(total, d)} ${c.asks[kind](d)}`,
      answer: unitAnswer(value, unit),
      solution: [
        `${total} ÷ ${d} = ${q} ··· ${r}이다.`,
        mode === 'full' ? `몫 ${numI(q)} 답이 된다.`
          : mode === 'left' ? `나머지 ${numI(r)} 답이 된다.`
            : mode === 'at-least' ? `남는 ${r}${c.units.left}도 있어야 하므로 몫보다 1 큰 ${q + 1}${unit}가 필요하다.`.replace(`${unit}가`, `${unit}${josaI(unit)}`)
              : `${d} - ${r} = ${d - r}만큼 더 있으면 나머지 없이 나누어떨어진다.`,
      ],
      dedupeKey: `divide2-story:${c === DIVIDE2_CONTEXTS[2] ? 'share' : 'group'}:${mode}:${total}:${d}`,
      difficulty,
    };
  },
  verify({ mode, total, d }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    // 곱셈으로 되짚어 몫·나머지의 범위를 확인한다.
    if (mode === 'full') return v * d <= total && total < (v + 1) * d;
    if (mode === 'left') return v < d && (total - v) % d === 0;
    if (mode === 'at-least') return (v - 1) * d < total && total <= v * d;
    return v < d && (total + v) % d === 0;
  },
};

const wrongDivision = {
  id: 'math.g34.no.s06.wrong-calc',
  standardCode: '[4수01-06]',
  skill: '잘못 계산한 식에서 어떤 수를 찾아 바르게 나눗셈하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kinds = difficulty === 3 ? ['mul', 'add', 'regroup'] : ['mul', 'add'];
    const kind = rng.pick(kinds);
    const ask = rng.pick(['q', 'r']);
    const d = rng.int(2, 9);
    let x = difficulty === 1 ? rng.int(20, 99) : difficulty === 2 ? rng.int(100, 499) : rng.int(500, 999);
    if (x % d === 0) x += x === 999 ? -1 : 1;
    let stem;
    let find;
    let a = 0;
    if (kind === 'mul') {
      stem = `어떤 수를 ${numRo(d)} 나누어야 할 것을 잘못하여 ${numEul(d)} 곱했더니 ${x * d}${numberParticle(x * d, '이', '가')} 되었습니다.`;
      find = `어떤 수는 ${x * d} ÷ ${d} = ${x}이다.`;
    } else if (kind === 'add') {
      stem = `어떤 수를 ${numRo(d)} 나누어야 할 것을 잘못하여 ${numEul(d)} 더했더니 ${x + d}${numberParticle(x + d, '이', '가')} 되었습니다.`;
      find = `어떤 수는 ${x + d} - ${d} = ${x}이다.`;
    } else {
      const others = [2, 3, 4, 5, 6, 7, 8, 9].filter((y) => y !== d);
      const withRest = others.filter((y) => x % y !== 0);
      a = rng.pick(withRest.length > 0 ? withRest : others);
      stem = `어떤 수를 ${numRo(a)} 나누었더니 몫이 ${Math.floor(x / a)}이고 나머지가 ${x % a}${numberParticle(x % a, '이었습니다', '였습니다')}. 이 수를 ${numRo(d)} 나누려고 합니다.`;
      find = `어떤 수는 ${a} × ${Math.floor(x / a)} + ${x % a} = ${x}이다.`;
    }
    const q = Math.floor(x / d);
    const r = x % d;
    const value = ask === 'q' ? q : r;
    return {
      params: { kind, ask, d, a, shown: kind === 'mul' ? x * d : kind === 'add' ? x + d : [Math.floor(x / a), x % a] },
      instruction: '물음에 답하시오.',
      stem: `${stem} 바르게 계산했을 때의 ${ask === 'q' ? '몫' : '나머지'}${ask === 'q' ? '은' : '는'} 얼마입니까?`,
      answer: { value, display: num(value), accepts: [num(value)] },
      solution: [find, `${x} ÷ ${d} = ${q} ··· ${r}이므로 ${ask === 'q' ? '몫' : '나머지'}${ask === 'q' ? '은' : '는'} ${value}이다.`],
      dedupeKey: `wrong-calc:${kind}:${ask}:${x}:${d}:${a}`,
      difficulty,
    };
  },
  verify({ kind, ask, d, a, shown }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v < 0) return false;
    // 잘못한 계산을 거꾸로 되돌려 어떤 수를 찾는다.
    const x = kind === 'mul' ? shown / d : kind === 'add' ? shown - d : a * shown[0] + shown[1];
    if (ask === 'r') return v < d && (x - v) % d === 0;
    return v * d <= x && x < (v + 1) * d;
  },
};

// ---------------------------------------------------------------------------
// [4수01-08] 어림셈으로 판단하기
// ---------------------------------------------------------------------------

const ITEMS = ['공책', '색연필', '지우개', '자', '풀', '스케치북', '물감'];
/** 몇천 원으로 어림하는 난이도 3에는 값이 그만한 물건을 쓴다. */
const BIG_ITEMS = ['필통', '책', '모자', '우산', '장난감', '물병', '퍼즐'];

const estimateBuy = {
  id: 'math.g34.no.s08.estimate-decide',
  standardCode: '[4수01-08]',
  skill: '값을 몇백·몇천으로 어림하여 곱을 어림하고 살 수 있는지 판단하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = rng.pick(difficulty === 1 ? ['product', 'can-buy'] : ['product', 'can-buy', 'sum-enough']);
    const U = difficulty === 3 ? 1000 : 100;
    const near = (H, plus) => H * U + (plus ? 1 : -1) * rng.int(1, U === 100 ? 30 : 300);
    const unitName = U === 100 ? '몇백' : '몇천';
    if (kind === 'product') {
      const H = rng.int(1, 9);
      const a = near(H, rng.bool());
      const b = difficulty === 1 ? rng.int(2, 9) : rng.int(11, 99);
      const value = H * U * b;
      const item = rng.pick(U === 1000 ? BIG_ITEMS : ITEMS);
      return {
        params: { kind, a, b, U },
        instruction: '어림하여 물음에 답하시오.',
        stem: `한 개에 ${a}원인 ${item} ${b}개의 값을 ${a}${numberParticle(a, '을', '를')} ${unitName}으로 어림하여 구하면 약 몇 원입니까?`,
        answer: { value, display: `${value}원`, accepts: [num(value), `${value}원`, `약 ${value}원`] },
        solution: [`${numEun(a)} ${unitName}으로 어림하면 ${H * U}이다.`, `${H * U} × ${b} = ${value}이므로 약 ${value}원이다.`],
        dedupeKey: `estimate-decide:product:${U}:${a}:${b}`,
        difficulty,
      };
    }
    const enough = rng.bool();
    const k = kind === 'can-buy' ? 1 : 3;
    const Hs = Array.from({ length: k }, () => rng.int(1, difficulty === 3 ? 4 : 9));
    const prices = Hs.map((H) => near(H, !enough));
    const b = kind === 'can-buy' ? (difficulty === 1 ? rng.int(2, 9) : rng.int(11, 40)) : 1;
    const est = sum(Hs) * U * b;
    const m = enough ? rng.int(0, 5) : rng.int(1, Math.min(5, sum(Hs) * b - 1));
    const budget = est + (enough ? m : -m) * (U === 100 ? 100 : 1000);
    const value = enough ? '예' : '아니요';
    const items = rng.shuffle([...(U === 1000 ? BIG_ITEMS : ITEMS)]).slice(0, k);
    const stem = kind === 'can-buy'
      ? `${budget}원으로 한 개에 ${prices[0]}원인 ${items[0]}${josaEul(items[0])} ${b}개 살 수 있습니까? 살 수 있으면 '예', 살 수 없으면 '아니요'라고 쓰시오.`
      : `${budget}원으로 ${items.map((it, n) => `${prices[n]}원인 ${it}`).join(', ')}${particle(items[2], '을', '를')} 한 개씩 모두 살 수 있습니까? 살 수 있으면 '예', 살 수 없으면 '아니요'라고 쓰시오.`;
    return {
      params: { kind, prices, b, budget, U },
      instruction: '어림하여 물음에 답하시오.',
      stem,
      answer: { value, display: value, accepts: [value] },
      solution: [
        `값을 ${unitName}으로 어림하면 ${prices.map((p, n) => `${Hs[n] * U}`).join(', ')}이고 값은 모두 ${enough ? '어림한 값보다 작다' : '어림한 값보다 크다'}.`,
        `어림한 값은 ${kind === 'can-buy' ? `${Hs[0] * U} × ${b}` : Hs.map((H) => H * U).join(' + ')} = ${est}원이다.`,
        enough ? `실제 값은 어림한 ${est}원보다 적고 가진 돈 ${budget}원은 어림한 값 이상이므로 살 수 있다.` : `실제 값은 어림한 ${est}원보다 많고 가진 돈 ${budget}원은 어림한 값보다 적으므로 살 수 없다.`,
      ],
      dedupeKey: `estimate-decide:${kind}:${prices.join('-')}:${b}:${budget}`,
      difficulty,
    };
  },
  verify({ kind, a, b, U, prices, budget }, answer) {
    const v = answer.value;
    if (kind === 'product') {
      // 반올림해 어림한 값과 곱이 맞는지 본다.
      return Number.isInteger(v) && v === Math.round(a / U) * U * b;
    }
    // 실제 값을 정확히 계산해 판단과 비교한다.
    const exact = sum(prices) * b;
    if (v === '예') return exact <= budget;
    if (v === '아니요') return exact > budget;
    return false;
  },
};

// ---------------------------------------------------------------------------
// [4수01-13] 소수 만들기 · [4수01-15] 분수 문장제 · [4수01-16] 소수 문장제
// ---------------------------------------------------------------------------

/** 정수 v 를 10^places 로 나눈 소수 문자열. 끝자리 0은 지운다. */
function fmtDec(v, places) {
  const s = (v / 10 ** places).toFixed(places);
  return places === 0 ? s : s.replace(/0+$/, '').replace(/\.$/, '');
}

/** 소수 문자열을 10^places 단위 정수로 바꾼다. 자릿수가 넘치면 null. */
function parseDec(text, places) {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(String(text));
  if (!m || (m[2] && m[2].length > places)) return null;
  return Number(m[1]) * 10 ** places + Number((m[2] ?? '').padEnd(places, '0') || '0');
}

const decParticle = (text, a, b) => numberParticle(Number(String(text).split('.').pop()), a, b);

const decimalCompose = {
  id: 'math.g34.no.s13.decimal-compose',
  standardCode: '[4수01-13]',
  skill: '1, 0.1, 0.01, 0.001의 개수로 소수를 만들고 소수가 0.001(0.01)이 몇 개인지 알기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = difficulty === 3 ? rng.pick(['compose', 'count-of']) : 'compose';
    if (kind === 'count-of') {
      const places = rng.pick([2, 3]);
      let units = rng.int(101, 99999);
      if (units % 10 === 0) units += 1;
      const text = fmtDec(units, places);
      const unitText = places === 2 ? '0.01' : '0.001';
      return {
        params: { kind, text, places, parts: [], counts: [] },
        instruction: '물음에 답하시오.',
        stem: `${text}${decParticle(text, '은', '는')} ${unitText}이 몇 개인 수입니까?`,
        answer: { value: units, display: `${units}개`, accepts: [num(units), `${units}개`] },
        solution: [`${unitText}이 10개이면 ${places === 2 ? '0.1' : '0.01'}, 100개이면 ${places === 2 ? '1' : '0.1'}이다.`, `${text}${decParticle(text, '은', '는')} ${unitText}이 ${units}개인 수이다.`],
        dedupeKey: `decimal-compose:count:${places}:${units}`,
        difficulty,
      };
    }
    const spec = {
      1: { parts: [[1, '1'], [0.1, '0.1'], [0.01, '0.01']], caps: [9, 49, 49], places: 2 },
      2: { parts: [[1, '1'], [0.1, '0.1'], [0.01, '0.01'], [0.001, '0.001']], caps: [9, 19, 19, 29], places: 3 },
      3: { parts: [[10, '10'], [1, '1'], [0.1, '0.1'], [0.01, '0.01'], [0.001, '0.001']], caps: [9, 19, 39, 39, 99], places: 3 },
    }[difficulty];
    const counts = spec.caps.map((cap, k) => (k === 0 ? rng.int(1, cap) : rng.int(0, cap)));
    const scale = 10 ** spec.places;
    const unitsOf = spec.parts.map(([u]) => Math.round(u * scale));
    let total = sum(counts.map((c, k) => c * unitsOf[k]));
    if (total % 10 === 0) { counts[counts.length - 1] += 1; total += unitsOf.at(-1); }
    const value = fmtDec(total, spec.places);
    const shown = spec.parts.map(([, label], k) => `${label}이 ${counts[k]}개`).filter((_, k) => counts[k] > 0);
    return {
      params: { kind, parts: spec.parts.map(([, l]) => l), counts, places: spec.places, text: '' },
      instruction: '물음에 답하시오.',
      stem: `${shown.join(', ')}인 수를 소수로 나타내시오.`,
      answer: { value, display: value, accepts: [value] },
      solution: [
        `${spec.parts.map(([, l], k) => `${l} × ${counts[k]}`).filter((_, k) => counts[k] > 0).join(' + ')}의 값을 구한다.`,
        `${spec.parts.map(([, l], k) => fmtDec(Math.round(Number(l) * scale) * counts[k], spec.places)).filter((_, k) => counts[k] > 0).join(' + ')} = ${value}이다.`,
      ],
      dedupeKey: `decimal-compose:compose:${spec.parts.length}:${counts.join('-')}`,
      difficulty,
    };
  },
  verify({ kind, text, places, parts, counts }, answer) {
    if (kind === 'count-of') {
      const v = answer.value;
      // 개수만큼 단위를 모으면 원래 소수가 되어야 한다.
      return Number.isInteger(v) && v > 0 && fmtDec(v, places) === text;
    }
    const x = parseDec(answer.value, places);
    if (x === null) return false;
    const unitsOf = parts.map((l) => {
      const [w, f = ''] = l.split('.');
      return Number(w) * 10 ** places + Number(f.padEnd(places, '0') || '0');
    });
    return unitsOf.reduce((s, u, k) => s - u * counts[k], x) === 0;
  },
};

const mixedText = (whole, n, d) => (n === 0 ? `${whole}` : whole === 0 ? `${n}/${d}` : `${whole} ${n}/${d}`);
const fracOf = (top, d) => mixedText(Math.floor(top / d), top % d, d);

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

const AMOUNT_CONTEXTS = [
  { A: '빨간 끈', B: '파란 끈', all: '끈', unit: 'm', use: '사용했습니다', get: '더 샀습니다' },
  { A: '흰 우유', B: '초코 우유', all: '우유', unit: 'L', use: '마셨습니다', get: '더 샀습니다' },
  { A: '어제 캔 감자', B: '오늘 캔 감자', all: '감자', unit: 'kg', use: '먹었습니다', get: '더 캤습니다' },
];

/** 더하고 빼는 양의 문장을 만든다. vals 는 표시용 문자열. */
function amountStem(c, kind, vals) {
  const u = c.unit;
  const j = (a, b) => pj(u, a, b);
  if (kind === 'total') return `${c.A} ${vals[0]}${u}${j('과', '와')} ${c.B} ${vals[1]}${u}${j('이', '가')} 있습니다. ${c.all}${josaEun(c.all)} 모두 몇 ${u}입니까?`;
  if (kind === 'left') return `${c.all} ${vals[0]}${u} 중에서 ${vals[1]}${u}${j('을', '를')} ${c.use}. 남은 ${c.all}${josaEun(c.all)} 몇 ${u}입니까?`;
  return `${c.all} ${vals[0]}${u}${j('이', '가')} 있었습니다. 그중 ${vals[2]}${u}${j('을', '를')} ${c.use.replace('습니다', '고')}, ${vals[1]}${u}${j('을', '를')} ${c.get}. 지금 있는 ${c.all}${josaEun(c.all)} 몇 ${u}입니까?`;
}

const fractionStory = {
  id: 'math.g34.no.s15.fraction-story',
  standardCode: '[4수01-15]',
  skill: '분모가 같은 분수의 덧셈과 뺄셈 문장제',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const c = rng.pick(AMOUNT_CONTEXTS);
    const kind = difficulty === 3 ? 'two-step' : rng.pick(['total', 'left']);
    const d = difficulty === 1 ? rng.int(5, 15) : rng.int(3, 20);
    const pick = () => (difficulty === 1 ? rng.int(1, d - 1) : rng.int(1, 9) * d + rng.int(1, d - 1));
    const { a, b, e } = rng.until(() => ({ a: pick(), b: pick(), e: pick() }), ({ a: x, b: y, e: z }) => {
      const r = kind === 'total' ? x + y : kind === 'left' ? x - y : x - z + y;
      if (r <= 0 || r % d === 0 || [x, y, kind === 'two-step' ? z : x].includes(r)) return false;
      if (kind === 'two-step' && x - z <= 0) return false;
      return difficulty !== 1 || r < d;
    });
    const plus = kind === 'total' ? [a, b] : kind === 'left' ? [a] : [a, b];
    const minus = kind === 'total' ? [] : kind === 'left' ? [b] : [e];
    const R = sum(plus) - sum(minus);
    const display = fracOf(R, d);
    const vals = [a, b, e].map((x) => fracOf(x, d));
    const expr = kind === 'total' ? `${vals[0]} + ${vals[1]}` : kind === 'left' ? `${vals[0]} - ${vals[1]}` : `${vals[0]} - ${vals[2]} + ${vals[1]}`;
    return {
      params: { d, plus, minus },
      instruction: '식을 세워 답을 구하시오.',
      stem: amountStem(c, kind, vals),
      answer: {
        value: display,
        display,
        accepts: [...new Set([display, `${display}${c.unit}`, `${R}/${d}`, ...reducedFractionForms({ n: R, d }, c.unit)])],
      },
      solution: [
        `분모가 같으므로 분자끼리 계산한다.`,
        `${expr} = ${display}이다.`,
      ],
      dedupeKey: `fraction-story:${kind}:${d}:${a}:${b}:${kind === 'two-step' ? e : ''}`,
      difficulty,
    };
  },
  verify({ d, plus, minus }, answer) {
    const R = toNumerator(String(answer.value), d);
    if (R === null || R <= 0) return false;
    // 남은 양에 뺀 양을 되돌려 더하면 처음 양들의 합이 된다.
    return R + sum(minus) === sum(plus);
  },
};

const decimalStory = {
  id: 'math.g34.no.s16.decimal-story',
  standardCode: '[4수01-16]',
  skill: '단위가 있는 소수의 덧셈과 뺄셈 문장제',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const c = rng.pick(AMOUNT_CONTEXTS);
    const kind = difficulty === 3 ? 'two-step' : rng.pick(['total', 'left']);
    const places = difficulty === 1 ? 1 : 2;
    const draw = () => {
      if (difficulty === 1) return rng.int(11, 199);
      if (difficulty === 2) return rng.bool() ? rng.int(11, 99) * 10 : rng.int(101, 999);
      return rng.int(101, 1999);
    };
    const { a, b, e } = rng.until(() => ({ a: draw(), b: draw(), e: draw() }), ({ a: x, b: y, e: z }) => {
      const r = kind === 'total' ? x + y : kind === 'left' ? x - y : x - z + y;
      if (r <= 0 || r % 10 ** places === 0 || [x, y, kind === 'two-step' ? z : x].includes(r)) return false;
      return kind !== 'two-step' || x - z > 0;
    });
    const plus = kind === 'left' ? [a] : [a, b];
    const minus = kind === 'total' ? [] : kind === 'left' ? [b] : [e];
    const R = sum(plus) - sum(minus);
    const display = fmtDec(R, places);
    // 끝자리 0을 붙여 자릿수를 맞춘 표기(14.40)도 같은 값이므로 받는다.
    const padded = (R / 10 ** places).toFixed(places);
    const vals = [a, b, e].map((x) => fmtDec(x, places));
    const expr = kind === 'total' ? `${vals[0]} + ${vals[1]}` : kind === 'left' ? `${vals[0]} - ${vals[1]}` : `${vals[0]} - ${vals[2]} + ${vals[1]}`;
    return {
      params: { places, plus, minus, scale: sum(plus) },
      instruction: '식을 세워 답을 구하시오.',
      stem: amountStem(c, kind, vals),
      answer: { value: display, display: `${display}${c.unit}`, accepts: [...new Set([display, `${display}${c.unit}`, padded, `${padded}${c.unit}`])] },
      solution: ['소수점의 자리를 맞추어 같은 자리끼리 계산한다.', `${expr} = ${display}이다.`],
      dedupeKey: `decimal-story:${kind}:${places}:${a}:${b}:${kind === 'two-step' ? e : ''}`,
      difficulty,
    };
  },
  verify({ places, plus, minus }, answer) {
    const x = parseDec(answer.value, places);
    if (x === null || x <= 0) return false;
    return x + sum(minus) === sum(plus);
  },
};

// ---------------------------------------------------------------------------
// [4수02-01] 대응 관계 표 · [4수02-02] 계산식 배열 · [4수02-03] 등호
// ---------------------------------------------------------------------------

const ORDINALS = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째', '여덟째', '아홉째', '열째'];
const PATTERN_CONTEXTS = {
  grow: [
    { intro: '규칙에 따라 바둑돌을 놓으면서 순서별 바둑돌의 수를 표로 나타냈습니다.', noun: '바둑돌의 수', unit: '개' },
    { intro: '규칙에 따라 성냥개비로 모양을 만들면서 순서별 성냥개비의 수를 표로 나타냈습니다.', noun: '성냥개비의 수', unit: '개' },
    { intro: '규칙에 따라 쌓기나무를 쌓으면서 순서별 쌓기나무의 수를 표로 나타냈습니다.', noun: '쌓기나무의 수', unit: '개' },
  ],
  shrink: [
    { intro: '색종이를 날마다 같은 수만큼 쓰면서 순서별 남은 색종이의 수를 표로 나타냈습니다.', noun: '남은 색종이의 수', unit: '장' },
    { intro: '구슬을 날마다 같은 수만큼 나누어 주면서 순서별 남은 구슬의 수를 표로 나타냈습니다.', noun: '남은 구슬의 수', unit: '개' },
  ],
};
const stepOnce = (op, x, step) => (op === '+' ? x + step : op === '-' ? x - step : x * step);

const correspondenceTable = {
  id: 'math.g34.mr.s02-01.correspondence-table',
  standardCode: '[4수02-01]',
  skill: '순서에 따라 한 가지 계산(+, -, ×)으로 변하는 규칙을 표에서 찾아 빈칸이나 다음 값 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const op = difficulty === 1 ? '+' : difficulty === 2 ? rng.pick(['+', '-']) : rng.pick(['+', '-', '+', '-', '×']);
    // 표에는 다섯째까지 보이고, 묻는 칸은 표 안의 빈칸(둘째~다섯째)이거나 표 뒤로 이어지는 칸이다.
    const lastTarget = difficulty === 1 ? 5 : difficulty === 2 ? 7 : op === '×' ? 5 : 9;
    const target = rng.int(1, lastTarget);
    let step;
    let start;
    if (op === '×') {
      step = rng.pick([2, 3]);
      start = rng.int(2, step === 2 ? 60 : 8);
    } else if (difficulty === 1) {
      step = rng.int(2, 40);
      start = rng.int(1, 99);
    } else {
      const [sLo, sHi, vLo, vHi] = difficulty === 2 ? [11, 99, 100, 999] : [101, 999, 1000, 9999];
      step = rng.int(sLo, sHi);
      // 빼는 규칙은 묻는 칸까지 수가 0보다 크게 남도록 시작 수를 정한다.
      start = op === '-' ? rng.int(Math.max(vLo, step * Math.max(target, 4) + 1), vHi) : rng.int(vLo, vHi);
    }
    const seq = [start];
    for (let k = 1; k <= Math.max(target, 4); k += 1) seq.push(stepOnce(op, seq[k - 1], step));
    const value = seq[target];
    const shownVals = seq.slice(0, 5).map((x, k) => (k === target ? null : x));
    const cells = shownVals.map((x) => (x === null ? '□' : String(x)));
    const c = rng.pick(op === '-' ? PATTERN_CONTEXTS.shrink : PATTERN_CONTEXTS.grow);
    const rule = op === '+' ? `${step}씩 커지는` : op === '-' ? `${step}씩 작아지는` : `${step}배씩 커지는`;
    const ask = target <= 4 ? `□ 안에 알맞은 ${c.noun}는 몇 ${c.unit}입니까?` : `같은 규칙으로 계속할 때 ${ORDINALS[target]}의 ${c.noun}는 몇 ${c.unit}입니까?`;
    const sym = op === '×' ? '×' : op;
    const work = target <= 4
      ? `□ 바로 앞 칸인 ${ORDINALS[target - 1]}의 수가 ${seq[target - 1]}이므로 □는 ${seq[target - 1]} ${sym} ${step} = ${value}이다.`
      : `다섯째의 수 ${seq[4]}에서 규칙대로 이어 가면 ${seq.slice(5, target + 1).join(', ')}이므로 ${ORDINALS[target]}의 수는 ${value}이다.`;
    return {
      params: { op, shown: shownVals, target },
      instruction: '표를 보고 물음에 답하시오.',
      stem: `${c.intro}\n순서: ${ORDINALS.slice(0, 5).join(', ')}\n${c.noun}(${c.unit}): ${cells.join(', ')}\n${ask}`,
      figure: {
        kind: 'data.table',
        spec: { headers: ORDINALS.slice(0, 5), values: cells, headerLabel: '순서', valueLabel: `${c.noun}(${c.unit})` },
        altText: `순서별 ${c.noun}를 나타낸 표. 첫째부터 다섯째까지 차례로 ${cells.join(', ')}이다.`,
        prompt: { ko: `흰 배경에 검은 선으로 그린 2행 표. 위 행은 ${ORDINALS.slice(0, 5).join(', ')}, 아래 행은 ${cells.join(', ')}. 초등 수학 교재용. AR 16:9` },
      },
      answer: unitAnswer(value, c.unit),
      solution: [`순서가 하나씩 늘어날 때마다 ${c.noun}가 ${rule} 규칙이다.`, work],
      dedupeKey: `corr-table:${op}:${start}:${step}:${target}`,
      difficulty,
    };
  },
  verify({ op, shown, target }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0) return false;
    // 빈칸이 아닌 이웃한 두 칸에서 규칙(더하는 수, 빼는 수, 곱하는 수)을 다시 읽는다.
    const k0 = shown.findIndex((x, k) => x !== null && shown[k + 1] !== null && shown[k + 1] !== undefined);
    const [x0, x1] = [shown[k0], shown[k0 + 1]];
    const step = op === '+' ? x1 - x0 : op === '-' ? x0 - x1 : x1 / x0;
    if (!Number.isInteger(step) || step <= (op === '×' ? 1 : 0)) return false;
    const seq = shown.map((x) => (x === null ? v : x));
    if (target >= seq.length) {
      // 표 뒤의 칸이면 다섯째부터 거꾸로 되돌아가 다섯째 수가 되는지 본다.
      let back = v;
      for (let k = target; k > 4; k -= 1) back = op === '+' ? back - step : op === '-' ? back + step : back / step;
      if (back !== seq[4]) return false;
    } else if (shown[target] !== null) return false;
    // 답을 빈칸에 넣었을 때 이웃한 모든 칸이 같은 규칙을 따라야 한다.
    return seq.every((x, k) => k === 0 || stepOnce(op, seq[k - 1], step) === x);
  },
};

const resultToRow = {
  id: 'math.g34.mr.s02-02.find-row',
  standardCode: '[4수02-02]',
  skill: '계산식 배열의 규칙으로 주어진 결과가 나오는 계산식의 순서 찾기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const op = difficulty === 1 ? '+' : difficulty === 2 ? rng.pick(['+', '-']) : rng.pick(['×', '-']);
    let rowOf;
    if (op === '×') {
      const a = rng.int(11, 99);
      const b = rng.int(2, 30);
      rowOf = (k) => [a, b + k - 1];
    } else {
      const [lo, hi] = difficulty === 1 ? [10, 99] : [100, 999];
      const a = rng.int(lo, hi);
      const b = rng.int(lo, hi);
      const s = rng.int(1, difficulty === 1 ? 9 : 99);
      let t = rng.int(1, difficulty === 1 ? 9 : 99);
      if (op === '-' && t >= s) t = s > 1 ? rng.int(0, s - 1) : 0;
      const start = op === '-' ? Math.max(a, b + 1) : a;
      rowOf = (k) => [start + s * (k - 1), b + t * (k - 1)];
    }
    const calc = ([x, y]) => (op === '+' ? x + y : op === '-' ? x - y : x * y);
    const K = rng.int(6, difficulty === 1 ? 12 : difficulty === 2 ? 15 : 20);
    const shownRows = [1, 2, 3, 4].map(rowOf);
    const results = shownRows.map(calc);
    const X = calc(rowOf(K));
    return {
      params: { results, X, op },
      instruction: '계산식의 배열을 보고 물음에 답하시오.',
      stem: `${shownRows.map((r, n) => `${r[0]} ${op} ${r[1]} = ${results[n]}`).join('\n')}\n같은 규칙으로 계산식을 계속 쓸 때, 계산 결과가 ${X}인 계산식은 몇 번째 계산식입니까?`,
      answer: { value: K, display: `${K}번째`, accepts: [num(K), `${K}번째`] },
      solution: [
        `계산 결과가 ${results[1] - results[0]}씩 커진다.`,
        `${X} - ${results[0]} = ${X - results[0]}, ${X - results[0]} ÷ ${results[1] - results[0]} = ${K - 1}이므로 첫째 계산식에서 ${K - 1}번 더 간 ${K}번째 계산식이다.`,
      ],
      dedupeKey: `find-row:${op}:${shownRows[0].join(',')}:${shownRows[1].join(',')}:${K}`,
      difficulty,
    };
  },
  verify({ results, X }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 4) return false;
    const step = results[1] - results[0];
    if (step <= 0 || results.some((r, k) => k > 0 && r - results[k - 1] !== step)) return false;
    // 넷째 결과에서 한 줄씩 이어 가며 v 번째 결과를 만든다.
    let r = results[3];
    for (let k = 5; k <= v; k += 1) r += step;
    return r === X;
  },
};

// 한쪽 식의 값이 V 가 되도록 항을 만든다. 모든 수와 중간 계산 결과는 두 자리 수(99) 이하이다.
const SIDE_MAKERS = {
  'a+b': (rng, V) => { const a = rng.int(2, V - 2); return { signs: [1, 1], vals: [a, V - a] }; },
  'a-b': (rng, V) => { const a = rng.int(V + 2, 99); return { signs: [1, -1], vals: [a, a - V] }; },
  'a+b-c': (rng, V) => {
    const S = rng.int(V + 2, 99);
    const a = rng.int(2, S - 2);
    return { signs: [1, 1, -1], vals: [a, S - a, S - V] };
  },
  'a-b+c': (rng, V) => {
    const t = rng.int(2, V - 2);
    const a = rng.int(t + 2, 99);
    return { signs: [1, -1, 1], vals: [a, a - t, V - t] };
  },
  'a+b+c': (rng, V) => {
    const a = rng.int(2, V - 4);
    const b = rng.int(2, V - a - 2);
    return { signs: [1, 1, 1], vals: [a, b, V - a - b] };
  },
};
// 곱셈구구로 두 가지 이상 나타낼 수 있는 곱
const MULTI_PRODUCTS = [[12, [[2, 6], [3, 4]]], [16, [[2, 8], [4, 4]]], [18, [[2, 9], [3, 6]]], [24, [[3, 8], [4, 6]]], [36, [[4, 9], [6, 6]]]];
const BALANCE_TEMPLATES = {
  1: [['a+b', 'a+b'], ['a+b', 'a-b'], ['a-b', 'a+b'], ['a-b', 'a-b']],
  2: [['a+b', 'a+b'], ['a+b', 'a-b'], ['a-b', 'a+b'], ['a-b', 'a-b'], ['a×b', 'a+b'], ['a×b', 'a-b'], ['a+b', 'a×b'], ['a-b', 'a×b']],
  3: [['a+b-c', 'a+b'], ['a-b+c', 'a-b'], ['a+b+c', 'a+b'], ['a+b', 'a+b-c'], ['a-b', 'a-b+c'], ['a+b+c', 'a-b'], ['a-b+c', 'a+b'], ['a×b', 'a+b-c'], ['a×b', 'a-b+c'], ['a×b', 'a×b']],
};
const sideText = (side, blank) => {
  const xs = side.vals.map((x, k) => (k === blank ? '□' : String(x)));
  if (side.mul) return `${xs[0]} × ${xs[1]}`;
  return xs.map((x, k) => (k === 0 ? x : `${side.signs[k] > 0 ? '+' : '-'} ${x}`)).join(' ');
};

const balanceEquation = {
  id: 'math.g34.mr.s02-03.balance-ops',
  standardCode: '[4수02-03]',
  skill: '두 자리 수 범위의 덧셈·뺄셈·곱셈구구 식에서 등호의 양쪽이 같도록 □ 구하기',
  format: 'fill-blank',
  difficultyAxis: 'categorical',
  difficultyNote: '수는 모두 99 이하로 같고, 1단계는 덧셈·뺄셈 두 항씩이며 □가 오른쪽에만, 2단계는 □가 양쪽 어디에나 오고 곱셈구구 곱이 들어가기도 하며, 3단계는 한쪽이 세 항이거나 곱셈구구 곱을 두 가지로 나타낸다.',
  generate(rng, { difficulty }) {
    const [lShape, rShape] = rng.pick(BALANCE_TEMPLATES[difficulty]);
    const item = rng.until(() => {
      let left;
      let right;
      if (lShape === 'a×b' && rShape === 'a×b') {
        const [, pairs] = rng.pick(MULTI_PRODUCTS);
        const [p, q] = rng.bool() ? pairs : [pairs[1], pairs[0]];
        left = { mul: true, vals: rng.bool() ? [...p] : [p[1], p[0]] };
        right = { mul: true, vals: rng.bool() ? [...q] : [q[1], q[0]] };
      } else {
        const hasMul = lShape === 'a×b' || rShape === 'a×b';
        const mulVals = [rng.int(2, 9), rng.int(3, 9)];
        if (rng.bool()) mulVals.reverse();
        const V = hasMul ? mulVals[0] * mulVals[1] : rng.int(12, 95);
        const make = (shape) => (shape === 'a×b' ? { mul: true, vals: mulVals } : SIDE_MAKERS[shape](rng, V));
        left = make(lShape);
        right = make(rShape);
      }
      const side = difficulty === 1 ? 'R' : rng.pick(['L', 'R']);
      const blankSide = side === 'L' ? left : right;
      const idx = rng.int(0, blankSide.vals.length - 1);
      const value = blankSide.vals[idx];
      const others = [...left.vals, ...right.vals];
      others.splice((side === 'L' ? 0 : left.vals.length) + idx, 1);
      return { left, right, side, idx, value, others };
    }, (x) => x.value > 0 && !x.others.includes(x.value));
    const { left, right, side, idx, value } = item;
    const leftText = sideText(left, side === 'L' ? idx : -1);
    const rightText = sideText(right, side === 'R' ? idx : -1);
    const known = side === 'L' ? right : left;
    const knownText = side === 'L' ? rightText : leftText;
    const blankText = side === 'L' ? leftText : rightText;
    const V = known.mul ? known.vals[0] * known.vals[1] : known.vals.reduce((acc, x, k) => acc + known.signs[k] * x, 0);
    const hide = (s, on) => ({ ...s, vals: s.vals.map((x, k) => (on && k === idx ? null : x)) });
    return {
      params: { left: hide(left, side === 'L'), right: hide(right, side === 'R') },
      instruction: '등호(=)의 양쪽이 같도록 □ 안에 알맞은 수를 써넣으시오.',
      stem: `${leftText} = ${rightText}`,
      answer: { value, display: num(value), accepts: [num(value)] },
      solution: [
        `□가 없는 쪽을 계산하면 ${knownText} = ${V}이다.`,
        `${blankText} = ${V}${numberParticle(V, '이', '가')} 되어야 하므로 □ = ${value}이다.`,
      ],
      dedupeKey: `balance-ops:${leftText}=${rightText}`,
      difficulty,
    };
  },
  verify({ left, right }, answer) {
    const v = answer.value;
    if (!Number.isInteger(v) || v <= 0 || v > 99) return false;
    // □ 자리에 답을 넣어 양쪽 값을 각각 계산해 비교한다.
    const evalSide = (s) => {
      const xs = s.vals.map((x) => (x === null ? v : x));
      return s.mul ? xs[0] * xs[1] : xs.reduce((acc, x, k) => acc + s.signs[k] * x, 0);
    };
    return evalSide(left) === evalSide(right);
  },
};

export const generators = [
  pictureGraph,
  barCompare,
  lineChange,
  tableMissing,
  twoSeries,
  missingAngleExterior,
  isoscelesSides,
  quadProperties,
  regularPolygonSides,
  circlesInRow,
  timeStory,
  lengthStory,
  capacityStory,
  weightStory,
  tonStory,
  composeBig,
  skipCount,
  blankDigitCompare,
  divide2Story,
  wrongDivision,
  estimateBuy,
  decimalCompose,
  fractionStory,
  decimalStory,
  correspondenceTable,
  resultToRow,
  balanceEquation,
];
