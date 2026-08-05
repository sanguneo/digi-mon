/**
 * 2022 개정 초등 수학 5~6학년군
 *   '변화와 관계' [6수02-01~05]
 *   '도형과 측정' [6수03-01~19]
 *   '자료와 가능성' [6수04-01~06]
 *
 * 넓이·부피·원주는 전부 정수 또는 고정소수점 정수로 계산한다.
 * 원주율은 교육과정 표기대로 3.14 를 쓰고, 3.14 를 100분의 314 정수로 다룬다.
 */
import { buildChoices } from '../../engine/item.mjs';
import { fracEul, josaEul, josaEun, josaI, numEul, numEun, numI } from '../../engine/korean-number.mjs';
import {
  formatDecimal,
  formatDecimalTrimmed,
  formatFraction,
  gcd,
  makeDecimal,
  makeFraction,
  reduceFraction,
} from '../../engine/rational.mjs';

const num = (n) => String(n);
const MARKS = ['㉠', '㉡', '㉢', '㉣'];

/** 원주율. 100배 정수로 들고 다녀 부동소수점을 피한다. */
const PI_HUNDREDTHS = 314;

function distractors(correct, candidates) {
  const out = [];
  for (const c of candidates) {
    if (c === correct || out.includes(c) || !Number.isFinite(c) || c <= 0) continue;
    out.push(c);
  }
  return out;
}

// ---------------------------------------------------------------------------
// [6수02-01] 대응 관계
// ---------------------------------------------------------------------------

const correspondence = {
  id: 'math.g56.rm.s02-01.correspondence',
  standardCode: '[6수02-01]',
  skill: '두 양의 대응 관계를 식으로 나타내기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    // y = ax 또는 y = ax + b 형태의 대응 관계를 찾는 문항이다.
    const a = difficulty === 1 ? rng.int(2, 5) : rng.int(2, 9);
    const b = difficulty === 1 ? 0 : rng.int(1, 9);
    const rows = [1, 2, 3, 4].map((x) => ({ x, y: a * x + b }));
    const askX = difficulty === 1 ? rng.int(5, 8) : rng.int(6, 15);
    const answer = a * askX + b;
    return {
      params: { a, b, askX },
      instruction: '표를 보고 □에 알맞은 수를 구하시오.',
      stem: `${rows.map((r) => `${r.x} -> ${r.y}`).join(', ')}\n    ${askX} -> □`,
      figure: {
        kind: 'data.table',
        spec: {
          headers: [...rows.map((r) => String(r.x)), String(askX)],
          values: [...rows.map((r) => String(r.y)), '□'],
          headerLabel: '＊',
          valueLabel: '☆',
        },
        altText: `대응 관계 표. ${rows.map((r) => `${numEun(r.x)} ${r.y}`).join(', ')}이고 ${numEun(askX)} 빈칸이다.`,
        prompt: { ko: `흰 배경에 검은 선으로 그린 2행 대응 관계 표. 위 행은 ${rows.map((r) => r.x).join(', ')}, ${askX}, 아래 행은 ${rows.map((r) => r.y).join(', ')}, 빈칸. 초등 수학 교재용. AR 16:9` },
      },
      answer: { value: answer, display: num(answer), accepts: [num(answer)] },
      solution: [
        b === 0 ? `＊에 ${numEul(a)} 곱하면 ☆가 된다. ☆ = ＊ × ${a}` : `＊에 ${numEul(a)} 곱하고 ${numEul(b)} 더하면 ☆가 된다. ☆ = ＊ × ${a} + ${b}`,
        `${askX} × ${a}${b === 0 ? '' : ` + ${b}`} = ${answer}`,
      ],
      dedupeKey: `correspondence:${a}:${b}:${askX}`,
      difficulty,
    };
  },
  verify({ a, b, askX }, answer) {
    // 반복 덧셈으로 재구성한다.
    let value = b;
    for (let k = 0; k < askX; k += 1) value += a;
    return value === answer.value;
  },
};

// ---------------------------------------------------------------------------
// [6수02-02~03] 비와 비율
// ---------------------------------------------------------------------------

const ratioBasics = {
  id: 'math.g56.rm.s02-02.ratio',
  standardCode: '[6수02-02]',
  skill: '비를 쓰고 읽기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const a = rng.int(2, difficulty === 1 ? 9 : 30);
    const b = rng.int(2, difficulty === 1 ? 9 : 30);
    const asRatio = rng.bool();
    const ratioText = `${a}:${b}`;
    const reading = `${b}에 대한 ${a}의 비`;
    if (asRatio) {
      return {
        params: { a, b, direction: 'to-ratio' },
        instruction: '비로 나타내시오.',
        stem: reading,
        answer: { value: ratioText, display: ratioText, accepts: [ratioText, `${a} : ${b}`] },
        solution: [`'${b}에 대한 ${a}의 비'는 기준이 ${b}이므로 ${ratioText}이다.`],
        dedupeKey: `ratio-write:${a}:${b}`,
        difficulty,
      };
    }
    return {
      params: { a, b, direction: 'to-reading' },
      instruction: '비를 읽는 방법을 쓰시오.',
      stem: ratioText,
      answer: { value: reading, display: reading, accepts: [reading, `${a} 대 ${b}`] },
      solution: [`${ratioText}에서 기준은 뒤의 수 ${b}이다.`, reading],
      dedupeKey: `ratio-read:${a}:${b}`,
      difficulty,
    };
  },
  verify({ a, b, direction }, answer) {
    if (direction === 'to-ratio') {
      const m = /^(\d+)\s*:\s*(\d+)$/.exec(answer.value);
      return Boolean(m) && Number(m[1]) === a && Number(m[2]) === b;
    }
    // 읽은 말에서 두 수를 되짚는다. 기준이 뒤의 수여야 한다.
    const m = /^(\d+)에 대한 (\d+)의 비$/.exec(answer.value);
    if (m) return Number(m[1]) === b && Number(m[2]) === a;
    const m2 = /^(\d+) 대 (\d+)$/.exec(answer.value);
    return Boolean(m2) && Number(m2[1]) === a && Number(m2[2]) === b;
  },
};

const ratioValue = {
  id: 'math.g56.rm.s02-03.ratio-value',
  standardCode: '[6수02-03]',
  skill: '비율을 분수·소수·백분율로 나타내기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const form = rng.pick(difficulty === 1 ? ['fraction', 'percent'] : ['fraction', 'decimal', 'percent']);
    // 백분율·소수 두 자리로 딱 떨어지는 기준량만 쓴다. 모두 100의 약수다.
    const base = rng.pick([10, 20, 25, 50, 100]);
    const compared = rng.int(1, base - 1);
    // 정수 나눗셈만 쓴다. 실수 나눗셈을 연쇄하면 56이 56.00000000000001 이 된다.
    const hundredths = (compared * 100) / base;
    const percent = hundredths;

    if (form === 'fraction') {
      const reduced = reduceFraction(makeFraction(compared, base));
      const display = formatFraction(reduced);
      return {
        params: { compared, base, form },
        instruction: '비율을 기약분수로 나타내시오.',
        stem: `${base}에 대한 ${compared}의 비율`,
        answer: { value: display, display, accepts: [display] },
        solution: ['비율은 (비교하는 양) ÷ (기준량)이다.', `${fracEul(`${compared}/${base}`)} 약분하면 ${display}이다.`],
        dedupeKey: `ratio-frac:${compared}:${base}`,
        difficulty,
      };
    }
    if (form === 'percent') {
      return {
        params: { compared, base, form },
        instruction: '비율을 백분율로 나타내시오.',
        stem: `${base}에 대한 ${compared}의 비율`,
        answer: { value: percent, display: `${percent}%`, accepts: [num(percent), `${percent}%`] },
        solution: [`비율은 ${compared} ÷ ${base}이다.`, '백분율은 비율에 100을 곱한다.' + ` ${percent}%`],
        dedupeKey: `ratio-percent:${compared}:${base}`,
        difficulty,
      };
    }
    const display = formatDecimal(makeDecimal(hundredths, 2));
    return {
      params: { compared, base, form },
      instruction: '비율을 소수로 나타내시오.',
      stem: `${base}에 대한 ${compared}의 비율`,
      answer: { value: display, display, accepts: [display] },
      solution: [`비율은 ${compared} ÷ ${base}이다.`, `소수로 나타내면 ${display}이다.`],
      dedupeKey: `ratio-decimal:${compared}:${base}`,
      difficulty,
    };
  },
  verify({ compared, base, form }, answer) {
    if (form === 'percent') {
      // 백분율 × 기준량 = 비교하는 양 × 100 이라는 관계로 확인한다.
      return answer.value * base === compared * 100;
    }
    if (form === 'fraction') {
      const m = /^(\d+)\/(\d+)$/.exec(answer.value);
      if (!m) return false;
      return Number(m[1]) * base === compared * Number(m[2]) && gcd(Number(m[1]), Number(m[2])) === 1;
    }
    const units = Number(answer.value.replace('.', ''));
    return units * base === compared * 100;
  },
};

// ---------------------------------------------------------------------------
// [6수02-04~05] 비례식과 비례배분
// ---------------------------------------------------------------------------

const proportionEquation = {
  id: 'math.g56.rm.s02-04.proportion',
  standardCode: '[6수02-04]',
  skill: '비례식의 성질로 빈칸 구하기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    const a = rng.int(2, 9);
    const b = rng.int(2, 9);
    const k = difficulty === 1 ? rng.int(2, 5) : difficulty === 2 ? rng.int(4, 14) : rng.int(8, 25);
    const c = a * k;
    const d = b * k;
    const hide = rng.int(0, 3);
    const terms = [a, b, c, d];
    const shown = terms.map((t, i) => (i === hide ? '□' : String(t)));
    return {
      params: { terms, hide },
      instruction: '□에 알맞은 수를 구하시오.',
      stem: `${shown[0]} : ${shown[1]} = ${shown[2]} : ${shown[3]}`,
      answer: { value: terms[hide], display: num(terms[hide]), accepts: [num(terms[hide])] },
      solution: [
        '비례식에서 외항의 곱과 내항의 곱은 같다.',
        `${a} × ${d} = ${b} × ${c} = ${a * d}`,
        `□ = ${terms[hide]}`,
      ],
      dedupeKey: `proportion:${terms.join('-')}:${hide}`,
      difficulty,
    };
  },
  verify({ terms, hide }, answer) {
    // 답을 넣은 뒤 외항의 곱과 내항의 곱이 같은지 확인한다.
    const t = [...terms];
    t[hide] = answer.value;
    return t[0] * t[3] === t[1] * t[2] && t.every((v) => v > 0);
  },
};

const proportionalDistribution = {
  id: 'math.g56.rm.s02-05.distribution',
  standardCode: '[6수02-05]',
  skill: '비례배분',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const r1 = rng.int(1, difficulty === 1 ? 4 : 8);
    const r2 = rng.until(() => rng.int(1, difficulty === 1 ? 4 : 8), (v) => gcd(v, r1) === 1);
    const unit = difficulty === 1 ? rng.int(2, 9) : rng.int(3, 20);
    const total = (r1 + r2) * unit;
    const share = r1 * unit;
    const thing = rng.pick(['사탕', '공책', '색종이', '구슬', '스티커']);
    return {
      params: { r1, r2, total, share },
      instruction: '□에 알맞은 수를 구하시오.',
      stem: `${thing} ${total}개를 ${r1} : ${r2}로 나누어 가지려고 합니다. 앞사람이 가지는 ${thing}${josaEun(thing)} 몇 개입니까?`,
      answer: { value: share, display: `${share}개`, accepts: [num(share), `${share}개`] },
      solution: [
        `전체를 ${r1} + ${r2} = ${r1 + r2}묶음으로 나눈다.`,
        `한 묶음은 ${total} ÷ ${r1 + r2} = ${unit}개다.`,
        `앞사람은 ${r1}묶음이므로 ${unit} × ${r1} = ${share}개다.`,
      ],
      dedupeKey: `distribution:${r1}:${r2}:${total}`,
      difficulty,
    };
  },
  verify({ r1, r2, total }, answer) {
    // 두 사람 몫의 합이 전체이고, 몫의 비가 주어진 비와 같아야 한다.
    const other = total - answer.value;
    return answer.value > 0 && other > 0 && answer.value * r2 === other * r1;
  },
};

// ---------------------------------------------------------------------------
// [6수03-01~02] 합동과 대칭
// ---------------------------------------------------------------------------

const congruence = {
  id: 'math.g56.rm.s03-01.congruence',
  standardCode: '[6수03-01]',
  skill: '합동인 도형의 대응변·대응각',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const sides = [rng.int(3, 12), rng.int(4, 15), rng.int(5, 18)];
    const angles = (() => {
      const a = rng.int(40, 90);
      const b = rng.int(30, 170 - a);
      return [a, b, 180 - a - b];
    })();
    const askSide = rng.bool();
    const idx = rng.int(0, 2);
    const value = askSide ? sides[idx] : angles[idx];
    const label = ['ㄱㄴ', 'ㄴㄷ', 'ㄷㄱ'][idx];
    const target = ['ㄹㅁ', 'ㅁㅂ', 'ㅂㄹ'][idx];
    const angleLabel = ['ㄱ', 'ㄴ', 'ㄷ'][idx];
    const angleTarget = ['ㄹ', 'ㅁ', 'ㅂ'][idx];
    return {
      params: { value, askSide, angles, sides },
      instruction: '물음에 답하시오.',
      stem: askSide
        ? `삼각형 ㄱㄴㄷ과 삼각형 ㄹㅁㅂ이 서로 합동입니다. 변 ${label}의 길이가 ${value}cm일 때 변 ${target}의 길이는 몇 cm입니까?`
        : `삼각형 ㄱㄴㄷ과 삼각형 ㄹㅁㅂ이 서로 합동입니다. 각 ${angleLabel}의 크기가 ${value}°일 때 각 ${angleTarget}의 크기는 몇 도입니까?`,
      answer: askSide
        ? { value, display: `${value}cm`, accepts: [num(value), `${value}cm`] }
        : { value, display: `${value}°`, accepts: [num(value), `${value}°`, `${value}도`] },
      solution: [
        '합동인 두 도형에서 대응하는 변의 길이와 대응하는 각의 크기는 각각 같다.',
        askSide ? `변 ${target}는 변 ${label}의 대응변이므로 ${value}cm다.` : `각 ${angleTarget}는 각 ${angleLabel}의 대응각이므로 ${value}°다.`,
      ],
      dedupeKey: `congruence:${askSide ? 's' : 'a'}:${value}:${idx}`,
      difficulty,
    };
  },
  verify({ value, askSide, angles }, answer) {
    // 합동이면 대응 요소가 같다. 각이면 세 각의 합이 180도인지도 함께 본다.
    if (answer.value !== value) return false;
    return askSide ? value > 0 : angles.reduce((s, v) => s + v, 0) === 180;
  },
};

const symmetryAxes = {
  id: 'math.g56.rm.s03-02.symmetry',
  standardCode: '[6수03-02]',
  skill: '선대칭도형의 대칭축 수 세기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    // 정n각형의 대칭축은 n개다. 원은 무수히 많으므로 문항에 넣지 않는다.
    const SHAPES = [
      { name: '정삼각형', axes: 3, sides: 'triangle' },
      { name: '정사각형', axes: 4, sides: 'quadrilateral' },
      { name: '정오각형', axes: 5, sides: 'pentagon' },
      { name: '정육각형', axes: 6, sides: 'hexagon' },
    ];
    const shape = rng.pick(difficulty === 1 ? SHAPES.slice(0, 2) : SHAPES);
    return {
      params: { axes: shape.axes, name: shape.name },
      instruction: '대칭축은 모두 몇 개입니까?',
      stem: `${shape.name}의 대칭축의 수를 구하시오.`,
      figure: {
        kind: 'geometry.plane-shape',
        spec: { shape: shape.sides },
        altText: `${shape.name} 한 개가 그려져 있다.`,
        prompt: { ko: `흰 배경에 검은 윤곽선만으로 그린 ${shape.name}. 초등 수학 교재용 단순 도해. AR 1:1` },
      },
      answer: { value: shape.axes, display: `${shape.axes}개`, accepts: [num(shape.axes), `${shape.axes}개`] },
      solution: [
        '선대칭도형을 접어서 완전히 겹치게 하는 직선이 대칭축이다.',
        `${shape.name}은 변의 수와 같은 ${shape.axes}개의 대칭축을 가진다.`,
      ],
      dedupeKey: `symmetry-axes:${shape.name}`,
      difficulty,
    };
  },
  verify({ axes, name }, answer) {
    // 정n각형의 대칭축 수는 n이다. 이름에서 변의 수를 되짚는다.
    const SIDES = { 정삼각형: 3, 정사각형: 4, 정오각형: 5, 정육각형: 6 };
    return answer.value === SIDES[name] && answer.value === axes;
  },
};

// ---------------------------------------------------------------------------
// [6수03-03~04] 직육면체와 정육면체
// ---------------------------------------------------------------------------

const cuboidElements = {
  id: 'math.g56.rm.s03-03.cuboid',
  standardCode: '[6수03-03]',
  skill: '직육면체의 면·모서리·꼭짓점 수',
  format: 'short-answer',
  // 면 6, 모서리 12, 꼭짓점 8 은 고정값이다. 어려운 버전이 없다.
  difficultyAxis: 'single',
  difficulties: [1],
  generate(rng, { difficulty }) {
    const FACTS = [
      { part: '면', count: 6, basis: '직육면체는 직사각형 모양의 면 6개로 둘러싸여 있다.' },
      { part: '모서리', count: 12, basis: '면과 면이 만나는 선분이 모서리이고 12개다.' },
      { part: '꼭짓점', count: 8, basis: '모서리와 모서리가 만나는 점이 꼭짓점이고 8개다.' },
    ];
    const fact = rng.pick(FACTS);
    const shapeName = difficulty === 1 ? '직육면체' : rng.pick(['직육면체', '정육면체']);
    return {
      params: { part: fact.part, count: fact.count },
      instruction: '물음에 답하시오.',
      stem: `${shapeName}의 ${fact.part}${josaEun(fact.part)} 모두 몇 개입니까?`,
      figure: {
        kind: 'geometry.solid-shape',
        spec: { solids: ['cuboid'] },
        altText: '직육면체 한 개가 그려져 있다.',
        prompt: { ko: '흰 배경에 등각 투상으로 그린 직육면체 한 개. 검은 윤곽선과 연회색 면. 초등 수학 교재용. AR 1:1' },
      },
      answer: { value: fact.count, display: `${fact.count}개`, accepts: [num(fact.count), `${fact.count}개`] },
      solution: [fact.basis],
      dedupeKey: `cuboid-parts:${fact.part}:${shapeName}`,
      difficulty,
    };
  },
  verify({ part, count }, answer) {
    // 오일러 공식 (면 + 꼭짓점 - 모서리 = 2) 으로 세 값의 일관성을 확인한다.
    const TABLE = { 면: 6, 모서리: 12, 꼭짓점: 8 };
    return answer.value === TABLE[part] && answer.value === count
      && TABLE.면 + TABLE.꼭짓점 - TABLE.모서리 === 2;
  },
};

const cuboidEdgeSum = {
  id: 'math.g56.rm.s03-04.edge-sum',
  standardCode: '[6수03-04]',
  skill: '직육면체 모서리 길이의 합',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const isCube = difficulty === 1 ? true : rng.bool();
    const a = rng.int(2, difficulty === 1 ? 9 : 15);
    const b = isCube ? a : rng.int(2, 15);
    const c = isCube ? a : rng.int(2, 15);
    // 직육면체는 같은 길이의 모서리가 4개씩 세 종류다.
    const total = (a + b + c) * 4;
    return {
      params: { a, b, c, total },
      instruction: '모서리 길이의 합을 구하시오.',
      stem: isCube
        ? `한 모서리의 길이가 ${a}cm인 정육면체의 모든 모서리 길이의 합은 몇 cm입니까?`
        : `가로 ${a}cm, 세로 ${b}cm, 높이 ${c}cm인 직육면체의 모든 모서리 길이의 합은 몇 cm입니까?`,
      answer: { value: total, display: `${total}cm`, accepts: [num(total), `${total}cm`] },
      solution: isCube
        ? ['정육면체의 모서리는 12개이고 길이가 모두 같다.', `${a} × 12 = ${total}cm`]
        : ['가로·세로·높이 모서리가 각각 4개씩이다.', `(${a} + ${b} + ${c}) × 4 = ${total}cm`],
      dedupeKey: `edge-sum:${a}:${b}:${c}`,
      difficulty,
    };
  },
  verify({ a, b, c }, answer) {
    // 모서리 12개를 하나씩 더해 되짚는다.
    let sum = 0;
    for (let k = 0; k < 4; k += 1) sum += a + b + c;
    return sum === answer.value;
  },
};

// ---------------------------------------------------------------------------
// [6수03-05~06] 각기둥과 각뿔
// ---------------------------------------------------------------------------

const PRISM_BASES = { 3: '삼각', 4: '사각', 5: '오각', 6: '육각' };

const prismPyramid = {
  id: 'math.g56.rm.s03-05.prism-pyramid',
  standardCode: '[6수03-05]',
  skill: '각기둥과 각뿔의 이름과 구성',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const n = difficulty === 1 ? rng.int(3, 4) : rng.int(3, 6);
    const isPrism = rng.bool();
    const part = rng.pick(difficulty === 1 ? ['면', '꼭짓점'] : ['면', '모서리', '꼭짓점']);
    // 각기둥: 면 n+2, 모서리 3n, 꼭짓점 2n / 각뿔: 면 n+1, 모서리 2n, 꼭짓점 n+1
    const counts = isPrism
      ? { 면: n + 2, 모서리: 3 * n, 꼭짓점: 2 * n }
      : { 면: n + 1, 모서리: 2 * n, 꼭짓점: n + 1 };
    const name = `${PRISM_BASES[n]}${isPrism ? '기둥' : '뿔'}`;
    return {
      params: { n, isPrism, part, count: counts[part] },
      instruction: '물음에 답하시오.',
      stem: `${name}의 ${part}${josaEun(part)} 모두 몇 개입니까?`,
      answer: { value: counts[part], display: `${counts[part]}개`, accepts: [num(counts[part]), `${counts[part]}개`] },
      solution: isPrism
        ? [
            `${name}은 밑면이 ${PRISM_BASES[n]}형 두 개이고 옆면이 직사각형 ${n}개다.`,
            `면은 ${n} + 2 = ${n + 2}개, 모서리는 ${n} × 3 = ${3 * n}개, 꼭짓점은 ${n} × 2 = ${2 * n}개다.`,
          ]
        : [
            `${name}은 밑면이 ${PRISM_BASES[n]}형 한 개이고 옆면이 삼각형 ${n}개다.`,
            `면은 ${n} + 1 = ${n + 1}개, 모서리는 ${n} × 2 = ${2 * n}개, 꼭짓점은 ${n} + 1 = ${n + 1}개다.`,
          ],
      dedupeKey: `prism-pyramid:${n}:${isPrism ? 'prism' : 'pyramid'}:${part}`,
      difficulty,
    };
  },
  verify({ n, isPrism, part }, answer) {
    // 오일러 공식으로 세 값의 일관성을 확인한 뒤 해당 값을 비교한다.
    const counts = isPrism
      ? { 면: n + 2, 모서리: 3 * n, 꼭짓점: 2 * n }
      : { 면: n + 1, 모서리: 2 * n, 꼭짓점: n + 1 };
    const euler = counts.면 + counts.꼭짓점 - counts.모서리 === 2;
    return euler && answer.value === counts[part];
  },
};

const prismName = {
  id: 'math.g56.rm.s03-06.prism-name',
  standardCode: '[6수03-06]',
  skill: '밑면의 모양으로 각기둥·각뿔 이름 정하기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const n = difficulty === 1 ? rng.int(3, 4) : rng.int(3, 6);
    const isPrism = rng.bool();
    const correct = `${PRISM_BASES[n]}${isPrism ? '기둥' : '뿔'}`;
    const wrong = [
      `${PRISM_BASES[n]}${isPrism ? '뿔' : '기둥'}`,
      `${PRISM_BASES[n === 6 ? 3 : n + 1]}${isPrism ? '기둥' : '뿔'}`,
      `${PRISM_BASES[n === 3 ? 6 : n - 1]}${isPrism ? '기둥' : '뿔'}`,
    ];
    return {
      params: { n, isPrism, correct },
      instruction: '알맞은 것을 고르시오.',
      stem: isPrism
        ? `밑면이 ${PRISM_BASES[n]}형이고 서로 평행한 두 밑면이 합동인 입체도형의 이름은 무엇입니까?`
        : `밑면이 ${PRISM_BASES[n]}형 한 개이고 옆면이 모두 삼각형인 입체도형의 이름은 무엇입니까?`,
      choices: buildChoices(rng, correct, wrong),
      answer: { value: correct, display: correct, accepts: [correct] },
      solution: [
        isPrism ? '밑면이 두 개이고 옆면이 직사각형이면 각기둥이다.' : '밑면이 한 개이고 옆면이 삼각형이면 각뿔이다.',
        `밑면이 ${PRISM_BASES[n]}형이므로 ${correct}이다.`,
      ],
      dedupeKey: `prism-name:${n}:${isPrism ? 'prism' : 'pyramid'}`,
      difficulty,
    };
  },
  verify({ n, isPrism, correct }, answer) {
    const expected = `${PRISM_BASES[n]}${isPrism ? '기둥' : '뿔'}`;
    return answer.value === expected && expected === correct;
  },
};

// ---------------------------------------------------------------------------
// [6수03-07~08] 원기둥, 원뿔, 구
// ---------------------------------------------------------------------------

const roundSolids = {
  id: 'math.g56.rm.s03-07.round-solids',
  difficultyAxis: 'single',
  difficulties: [1],
  standardCode: '[6수03-07]',
  skill: '원기둥·원뿔·구 구별',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const FACTS = {
      cylinder: { korean: '원기둥', basis: '서로 평행하고 합동인 두 원이 밑면이고 옆면이 굽은 면인 입체도형이다.' },
      cone: { korean: '원뿔', basis: '밑면이 원 한 개이고 뾰족한 꼭대기가 있는 입체도형이다.' },
      sphere: { korean: '구', basis: '어느 방향에서 보아도 원으로 보이는 입체도형이다.' },
    };
    const key = rng.pick(Object.keys(FACTS));
    const fact = FACTS[key];
    const wrong = Object.values(FACTS).map((v) => v.korean).filter((v) => v !== fact.korean);
    return {
      params: { key, correct: fact.korean },
      instruction: '설명에 알맞은 입체도형을 고르시오.',
      stem: fact.basis,
      choices: buildChoices(rng, fact.korean, [...wrong, '직육면체']),
      answer: { value: fact.korean, display: fact.korean, accepts: [fact.korean] },
      solution: [`${fact.basis} 이런 입체도형을 ${fact.korean}이라고 한다.`],
      dedupeKey: `round-solids:${key}`,
      difficulty,
    };
  },
  verify({ correct }, answer) {
    return answer.value === correct;
  },
};

const cylinderParts = {
  id: 'math.g56.rm.s03-08.cylinder-parts',
  standardCode: '[6수03-08]',
  skill: '원기둥의 전개도 이해',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const radius = difficulty === 1 ? rng.int(2, 5) : rng.int(3, 10);
    // 전개도에서 옆면 직사각형의 가로는 밑면의 원주와 같다.
    const circumferenceHundredths = 2 * radius * PI_HUNDREDTHS;
    const value = makeDecimal(circumferenceHundredths, 2);
    const shown = formatDecimalTrimmed(value);
    return {
      params: { radius, circumferenceHundredths },
      instruction: '□에 알맞은 수를 구하시오.',
      stem: `밑면의 반지름이 ${radius}cm인 원기둥의 전개도에서 옆면인 직사각형의 가로는 몇 cm입니까? (원주율: 3.14)`,
      answer: { value: shown, display: `${shown}cm`, accepts: [shown, `${shown}cm`, formatDecimal(value), `${formatDecimal(value)}cm`] },
      solution: [
        '전개도에서 옆면의 가로는 밑면인 원의 둘레와 같다.',
        `${radius} × 2 × 3.14 = ${shown}cm`,
      ],
      dedupeKey: `cylinder-net:${radius}`,
      difficulty,
    };
  },
  verify({ radius, circumferenceHundredths }, answer) {
    // 반복 덧셈으로 정수 원주를 되짚는다.
    let sum = 0;
    for (let k = 0; k < 2 * radius; k += 1) sum += PI_HUNDREDTHS;
    return sum === circumferenceHundredths
      && answer.value === formatDecimalTrimmed(makeDecimal(circumferenceHundredths, 2));
  },
};

// ---------------------------------------------------------------------------
// [6수03-09~10] 입체도형의 공간 감각 (쌓기나무)
// ---------------------------------------------------------------------------

const cubeCountFromLayers = {
  id: 'math.g56.rm.s03-09.cube-count',
  standardCode: '[6수03-09]',
  skill: '쌓기나무의 개수 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const height = difficulty === 1 ? 2 : difficulty === 2 ? 3 : rng.int(3, 4);
    const layers = [];
    let widest = difficulty === 1 ? rng.int(3, 4) : rng.int(4, 6);
    for (let level = 0; level < height; level += 1) {
      layers.push(widest);
      widest = Math.max(1, widest - rng.int(1, 2));
    }
    const total = layers.reduce((s, v) => s + v, 0);
    return {
      params: { layers },
      instruction: '쌓기나무는 모두 몇 개입니까?',
      stem: '',
      figure: {
        kind: 'geometry.solid-shape',
        spec: { layers },
        altText: `아래층부터 ${layers.join('개, ')}개로 쌓은 쌓기나무 모양이다.`,
        prompt: { ko: `흰 배경에 등각 투상으로 그린 쌓기나무. 아래층부터 ${layers.join('개, ')}개가 쌓여 있다. 초등 수학 교재용. AR 1:1` },
      },
      answer: { value: total, display: `${total}개`, accepts: [num(total), `${total}개`] },
      solution: [...layers.map((c, i) => `${i + 1}층에 ${c}개가 있다.`), `${layers.join(' + ')} = ${total}개`],
      dedupeKey: `cube-count56:${layers.join('-')}`,
      difficulty,
    };
  },
  verify({ layers }, answer) {
    let running = 0;
    for (const c of layers) for (let k = 0; k < c; k += 1) running += 1;
    return running === answer.value;
  },
};

const cubeVolumeCount = {
  id: 'math.g56.rm.s03-10.cube-block',
  standardCode: '[6수03-10]',
  skill: '직육면체 모양으로 쌓은 쌓기나무의 개수',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const a = difficulty === 1 ? rng.int(2, 3) : rng.int(2, 5);
    const b = difficulty === 1 ? rng.int(2, 3) : rng.int(2, 5);
    const c = difficulty === 1 ? 2 : rng.int(2, 4);
    const total = a * b * c;
    return {
      params: { a, b, c, total },
      instruction: '쌓기나무는 모두 몇 개입니까?',
      stem: `쌓기나무를 가로 ${a}개, 세로 ${b}개, 높이 ${c}개인 직육면체 모양으로 쌓았습니다. 쌓기나무는 모두 몇 개입니까?`,
      answer: { value: total, display: `${total}개`, accepts: [num(total), `${total}개`] },
      solution: [
        `한 층에 ${a} × ${b} = ${a * b}개가 있다.`,
        `${c}층이므로 ${a * b} × ${c} = ${total}개다.`,
      ],
      dedupeKey: `cube-block:${a}:${b}:${c}`,
      difficulty,
    };
  },
  verify({ a, b, c }, answer) {
    // 한 개씩 세어 되짚는다.
    let count = 0;
    for (let i = 0; i < a; i += 1) {
      for (let j = 0; j < b; j += 1) {
        for (let k = 0; k < c; k += 1) count += 1;
      }
    }
    return count === answer.value;
  },
};

// ---------------------------------------------------------------------------
// [6수03-11~14] 다각형의 둘레와 넓이
// ---------------------------------------------------------------------------

const perimeter = {
  id: 'math.g56.rm.s03-11.perimeter',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 정사각형·직사각형, 2 이상은 정다각형·평행사변형까지 넣는다.',
  standardCode: '[6수03-11]',
  skill: '다각형의 둘레 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = rng.pick(difficulty === 1 ? ['square', 'rectangle'] : ['square', 'rectangle', 'parallelogram']);
    if (kind === 'square') {
      const a = rng.int(3, difficulty === 1 ? 12 : 30);
      return pack(`한 변의 길이가 ${a}cm인 정사각형의 둘레는 몇 cm입니까?`, a * 4, [`정사각형은 네 변의 길이가 같다.`, `${a} × 4 = ${a * 4}cm`], { sides: [a, a, a, a] });
    }
    const a = rng.int(3, 25);
    const b = rng.until(() => rng.int(3, 25), (v) => v !== a);
    const label = kind === 'rectangle' ? '직사각형' : '평행사변형';
    return pack(
      `가로가 ${a}cm, 세로가 ${b}cm인 ${label}의 둘레는 몇 cm입니까?`,
      (a + b) * 2,
      [`${label}은 마주보는 두 변의 길이가 같다.`, `(${a} + ${b}) × 2 = ${(a + b) * 2}cm`],
      { sides: [a, b, a, b] },
    );

    function pack(stem, value, solution, params) {
      return {
        params,
        instruction: '둘레를 구하시오.',
        stem,
        answer: { value, display: `${value}cm`, accepts: [num(value), `${value}cm`] },
        solution,
        dedupeKey: `perimeter:${params.sides.join('-')}`,
        difficulty,
      };
    }
  },
  verify({ sides }, answer) {
    // 변을 하나씩 더해 되짚는다.
    let sum = 0;
    for (const s of sides) sum += s;
    return sum === answer.value;
  },
};

const AREA_FORMULAS = {
  square: { korean: '정사각형', compute: (a) => a * a, formula: (a) => `${a} × ${a}` },
  rectangle: { korean: '직사각형', compute: (a, b) => a * b, formula: (a, b) => `${a} × ${b}` },
  parallelogram: { korean: '평행사변형', compute: (a, b) => a * b, formula: (a, b) => `${a} × ${b}` },
  triangle: { korean: '삼각형', compute: (a, b) => (a * b) / 2, formula: (a, b) => `${a} × ${b} ÷ 2` },
  trapezoid: { korean: '사다리꼴', compute: (a, b, h) => ((a + b) * h) / 2, formula: (a, b, h) => `(${a} + ${b}) × ${h} ÷ 2` },
  rhombus: { korean: '마름모', compute: (a, b) => (a * b) / 2, formula: (a, b) => `${a} × ${b} ÷ 2` },
};

const areaOfPolygon = {
  id: 'math.g56.rm.s03-12.area',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 직사각형, 2는 삼각형·평행사변형, 3은 마름모·사다리꼴까지 넣는다.',
  standardCode: '[6수03-12]',
  skill: '사각형·삼각형의 넓이 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const kind = rng.pick(
      difficulty === 1 ? ['square', 'rectangle'] : difficulty === 2 ? ['rectangle', 'parallelogram', 'triangle'] : ['triangle', 'trapezoid', 'rhombus'],
    );
    const spec = AREA_FORMULAS[kind];
    // 삼각형·마름모·사다리꼴은 2로 나누므로 곱이 짝수가 되게 뽑는다.
    const needsEven = ['triangle', 'rhombus', 'trapezoid'].includes(kind);
    let a;
    let b;
    let h;
    if (kind === 'square') {
      a = rng.int(3, 20);
      b = a;
    } else if (kind === 'trapezoid') {
      a = rng.int(3, 15);
      b = rng.int(3, 15);
      h = rng.until(() => rng.int(2, 14), (v) => ((a + b) * v) % 2 === 0);
    } else {
      a = rng.int(3, 20);
      b = needsEven ? rng.until(() => rng.int(2, 20), (v) => (a * v) % 2 === 0) : rng.int(3, 20);
    }
    const value = kind === 'trapezoid' ? spec.compute(a, b, h) : spec.compute(a, b);
    const stemText = {
      square: `한 변이 ${a}cm인 정사각형의 넓이는 몇 cm²입니까?`,
      rectangle: `가로 ${a}cm, 세로 ${b}cm인 직사각형의 넓이는 몇 cm²입니까?`,
      parallelogram: `밑변이 ${a}cm, 높이가 ${b}cm인 평행사변형의 넓이는 몇 cm²입니까?`,
      triangle: `밑변이 ${a}cm, 높이가 ${b}cm인 삼각형의 넓이는 몇 cm²입니까?`,
      trapezoid: `윗변이 ${a}cm, 아랫변이 ${b}cm, 높이가 ${h}cm인 사다리꼴의 넓이는 몇 cm²입니까?`,
      rhombus: `두 대각선이 ${a}cm, ${b}cm인 마름모의 넓이는 몇 cm²입니까?`,
    }[kind];
    return {
      params: { kind, a, b, h, value },
      instruction: '넓이를 구하시오.',
      stem: stemText,
      answer: { value, display: `${value}cm²`, accepts: [num(value), `${value}cm²`, `${value}cm2`] },
      solution: [
        `${spec.korean}의 넓이는 ${kind === 'trapezoid' ? '(윗변 + 아랫변) × 높이 ÷ 2' : kind === 'triangle' ? '밑변 × 높이 ÷ 2' : kind === 'rhombus' ? '두 대각선의 곱 ÷ 2' : '가로 × 세로'}로 구한다.`,
        `${kind === 'trapezoid' ? spec.formula(a, b, h) : spec.formula(a, b)} = ${value}cm²`,
      ],
      dedupeKey: `area:${kind}:${a}:${b}:${h ?? ''}`,
      difficulty,
    };
  },
  verify({ kind, a, b, h, value }, answer) {
    // 넓이 공식을 반복 덧셈으로 되짚는다.
    if (kind === 'trapezoid') {
      let sum = 0;
      for (let k = 0; k < h; k += 1) sum += a + b;
      return sum / 2 === answer.value && answer.value === value;
    }
    let sum = 0;
    for (let k = 0; k < b; k += 1) sum += a;
    const expected = ['triangle', 'rhombus'].includes(kind) ? sum / 2 : sum;
    return expected === answer.value && answer.value === value;
  },
};

const areaUnitConversion = {
  id: 'math.g56.rm.s03-13.area-unit',
  standardCode: '[6수03-13]',
  skill: '넓이 단위 바꾸기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    // 1m² = 10000cm², 1km² = 1000000m²
    const pair = difficulty === 1
      ? { big: 'm²', small: 'cm²', ratio: 10000 }
      : rng.pick([
        { big: 'm²', small: 'cm²', ratio: 10000 },
        { big: 'km²', small: 'm²', ratio: 1000000 },
      ]);
    const whole = rng.int(1, 9);
    const value = whole * pair.ratio;
    return {
      params: { whole, ratio: pair.ratio },
      instruction: '□에 알맞은 수를 써넣으시오.',
      stem: `${whole}${pair.big} = □${pair.small}`,
      answer: { value, display: `${value}${pair.small}`, accepts: [num(value), `${value}${pair.small}`] },
      solution: [`1${pair.big}는 ${pair.ratio}${pair.small}이다.`, `${whole} × ${pair.ratio} = ${value}`],
      dedupeKey: `area-unit:${whole}:${pair.ratio}`,
      difficulty,
    };
  },
  verify({ whole, ratio }, answer) {
    // 나눗셈으로 되짚는다.
    return answer.value % ratio === 0 && answer.value / ratio === whole;
  },
};

const compositeArea = {
  id: 'math.g56.rm.s03-14.composite-area',
  standardCode: '[6수03-14]',
  skill: '여러 도형으로 나누어 넓이 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    // ㄱ자 모양 도형의 넓이. 큰 직사각형에서 작은 직사각형을 뺀다.
    const w = rng.int(6, difficulty === 1 ? 12 : 20);
    const h = rng.int(5, difficulty === 1 ? 10 : 18);
    const cutW = rng.int(2, w - 3);
    const cutH = rng.int(2, h - 3);
    const value = w * h - cutW * cutH;
    return {
      params: { w, h, cutW, cutH, value },
      instruction: '넓이를 구하시오.',
      stem: `가로 ${w}cm, 세로 ${h}cm인 직사각형에서 가로 ${cutW}cm, 세로 ${cutH}cm인 직사각형을 잘라 냈습니다.`
        + ` 남은 도형의 넓이는 몇 cm²입니까?`,
      answer: { value, display: `${value}cm²`, accepts: [num(value), `${value}cm²`, `${value}cm2`] },
      solution: [
        `큰 직사각형의 넓이는 ${w} × ${h} = ${w * h}cm²다.`,
        `잘라 낸 직사각형의 넓이는 ${cutW} × ${cutH} = ${cutW * cutH}cm²다.`,
        `${w * h} - ${cutW * cutH} = ${value}cm²`,
      ],
      dedupeKey: `composite-area:${w}:${h}:${cutW}:${cutH}`,
      difficulty,
    };
  },
  verify({ w, h, cutW, cutH }, answer) {
    // 두 넓이를 반복 덧셈으로 세어 차를 확인한다.
    let big = 0;
    for (let k = 0; k < h; k += 1) big += w;
    let small = 0;
    for (let k = 0; k < cutH; k += 1) small += cutW;
    return big - small === answer.value && answer.value > 0;
  },
};

// ---------------------------------------------------------------------------
// [6수03-15~16] 원주율과 원의 넓이
// ---------------------------------------------------------------------------

const circumference = {
  id: 'math.g56.rm.s03-15.circumference',
  standardCode: '[6수03-15]',
  skill: '원주 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const fromRadius = rng.bool();
    const radius = difficulty === 1 ? rng.int(2, 10) : rng.int(3, 25);
    const diameter = radius * 2;
    const hundredths = diameter * PI_HUNDREDTHS;
    const display = formatDecimalTrimmed(makeDecimal(hundredths, 2));
    const padded = formatDecimal(makeDecimal(hundredths, 2));
    return {
      params: { diameter, hundredths },
      instruction: '원주를 구하시오. (원주율: 3.14)',
      stem: fromRadius
        ? `반지름이 ${radius}cm인 원의 원주는 몇 cm입니까?`
        : `지름이 ${diameter}cm인 원의 원주는 몇 cm입니까?`,
      figure: {
        kind: 'geometry.circle',
        spec: fromRadius
          ? { show: ['center', 'radius'], radiusLabel: `${radius}cm` }
          : { show: ['center', 'diameter'], diameterLabel: `${diameter}cm` },
        altText: fromRadius ? `반지름이 ${radius}cm인 원.` : `지름이 ${diameter}cm인 원.`,
        prompt: { ko: '흰 배경에 검은 선으로 그린 원 하나. 중심 점과 길이가 적힌 선분이 있다. 초등 수학 교재용. AR 1:1' },
      },
      answer: { value: display, display: `${display}cm`, accepts: [display, `${display}cm`, padded, `${padded}cm`] },
      solution: [
        '원주는 지름 × 원주율로 구한다.',
        fromRadius ? `지름은 ${radius} × 2 = ${diameter}cm다.` : `지름은 ${diameter}cm다.`,
        `${diameter} × 3.14 = ${display}cm`,
      ],
      dedupeKey: `circumference:${diameter}:${fromRadius ? 'r' : 'd'}`,
      difficulty,
    };
  },
  verify({ diameter, hundredths }, answer) {
    // 반복 덧셈으로 정수 원주를 되짚는다.
    let sum = 0;
    for (let k = 0; k < diameter; k += 1) sum += PI_HUNDREDTHS;
    return sum === hundredths && answer.value === formatDecimalTrimmed(makeDecimal(hundredths, 2));
  },
};

const circleArea = {
  id: 'math.g56.rm.s03-16.circle-area',
  standardCode: '[6수03-16]',
  skill: '원의 넓이 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const radius = difficulty === 1 ? rng.int(2, 8) : rng.int(3, 20);
    // 넓이 = 반지름 × 반지름 × 3.14. 100배 정수로 계산한다.
    const hundredths = radius * radius * PI_HUNDREDTHS;
    const display = formatDecimalTrimmed(makeDecimal(hundredths, 2));
    const padded = formatDecimal(makeDecimal(hundredths, 2));
    return {
      params: { radius, hundredths },
      instruction: '원의 넓이를 구하시오. (원주율: 3.14)',
      stem: `반지름이 ${radius}cm인 원의 넓이는 몇 cm²입니까?`,
      figure: {
        kind: 'geometry.circle',
        spec: { show: ['center', 'radius'], radiusLabel: `${radius}cm` },
        altText: `반지름이 ${radius}cm인 원.`,
        prompt: { ko: '흰 배경에 검은 선으로 그린 원 하나. 중심에서 원 위의 한 점까지 선분과 길이가 적혀 있다. 초등 수학 교재용. AR 1:1' },
      },
      answer: { value: display, display: `${display}cm²`, accepts: [display, `${display}cm²`, `${display}cm2`, padded, `${padded}cm²`] },
      solution: [
        '원의 넓이는 반지름 × 반지름 × 원주율로 구한다.',
        `${radius} × ${radius} × 3.14 = ${display}cm²`,
      ],
      dedupeKey: `circle-area:${radius}`,
      difficulty,
    };
  },
  verify({ radius, hundredths }, answer) {
    let sum = 0;
    for (let k = 0; k < radius * radius; k += 1) sum += PI_HUNDREDTHS;
    return sum === hundredths && answer.value === formatDecimalTrimmed(makeDecimal(hundredths, 2));
  },
};

// ---------------------------------------------------------------------------
// [6수03-17~19] 입체도형의 겉넓이와 부피
// ---------------------------------------------------------------------------

const surfaceArea = {
  id: 'math.g56.rm.s03-17.surface-area',
  standardCode: '[6수03-17]',
  skill: '직육면체의 겉넓이',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const isCube = difficulty === 1 ? true : rng.bool();
    const a = rng.int(2, difficulty === 1 ? 9 : 12);
    const b = isCube ? a : rng.int(2, 12);
    const c = isCube ? a : rng.int(2, 12);
    const value = 2 * (a * b + b * c + c * a);
    return {
      params: { a, b, c, value },
      instruction: '겉넓이를 구하시오.',
      stem: isCube
        ? `한 모서리가 ${a}cm인 정육면체의 겉넓이는 몇 cm²입니까?`
        : `가로 ${a}cm, 세로 ${b}cm, 높이 ${c}cm인 직육면체의 겉넓이는 몇 cm²입니까?`,
      answer: { value, display: `${value}cm²`, accepts: [num(value), `${value}cm²`, `${value}cm2`] },
      solution: isCube
        ? ['정육면체는 합동인 정사각형 6개로 둘러싸여 있다.', `${a} × ${a} × 6 = ${value}cm²`]
        : ['마주보는 면이 각각 합동이므로 세 종류의 면을 구해 2배 한다.', `(${a}×${b} + ${b}×${c} + ${c}×${a}) × 2 = ${value}cm²`],
      dedupeKey: `surface-area:${a}:${b}:${c}`,
      difficulty,
    };
  },
  verify({ a, b, c }, answer) {
    // 여섯 면을 하나씩 더해 되짚는다.
    const faces = [a * b, a * b, b * c, b * c, c * a, c * a];
    let sum = 0;
    for (const f of faces) sum += f;
    return sum === answer.value;
  },
};

const volume = {
  id: 'math.g56.rm.s03-18.volume',
  standardCode: '[6수03-18]',
  skill: '직육면체의 부피',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const isCube = difficulty === 1 ? true : rng.bool();
    const a = rng.int(2, difficulty === 1 ? 9 : 15);
    const b = isCube ? a : rng.int(2, 15);
    const c = isCube ? a : rng.int(2, 15);
    const value = a * b * c;
    return {
      params: { a, b, c, value },
      instruction: '부피를 구하시오.',
      stem: isCube
        ? `한 모서리가 ${a}cm인 정육면체의 부피는 몇 cm³입니까?`
        : `가로 ${a}cm, 세로 ${b}cm, 높이 ${c}cm인 직육면체의 부피는 몇 cm³입니까?`,
      answer: { value, display: `${value}cm³`, accepts: [num(value), `${value}cm³`, `${value}cm3`] },
      solution: [
        '직육면체의 부피는 가로 × 세로 × 높이로 구한다.',
        `${a} × ${b} × ${c} = ${value}cm³`,
      ],
      dedupeKey: `volume:${a}:${b}:${c}`,
      difficulty,
    };
  },
  verify({ a, b, c }, answer) {
    // 단위 정육면체를 하나씩 세어 되짚는다.
    let count = 0;
    for (let i = 0; i < a; i += 1) {
      for (let j = 0; j < b; j += 1) {
        for (let k = 0; k < c; k += 1) count += 1;
      }
    }
    return count === answer.value;
  },
};

const volumeUnitConversion = {
  id: 'math.g56.rm.s03-19.volume-unit',
  standardCode: '[6수03-19]',
  skill: '부피 단위 바꾸기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    // 1m³ = 1000000cm³
    const whole = difficulty === 1 ? rng.int(1, 5) : rng.int(1, 9);
    const ratio = 1000000;
    const value = whole * ratio;
    const toSmall = rng.bool();
    if (toSmall) {
      return {
        params: { whole, ratio, direction: 'to-small' },
        instruction: '□에 알맞은 수를 써넣으시오.',
        stem: `${whole}m³ = □cm³`,
        answer: { value, display: `${value}cm³`, accepts: [num(value), `${value}cm³`, `${value}cm3`] },
        solution: ['1m는 100cm이므로 1m³는 100 × 100 × 100 = 1000000cm³다.', `${whole} × 1000000 = ${value}`],
        dedupeKey: `volume-unit-small:${whole}`,
        difficulty,
      };
    }
    return {
      params: { whole, ratio, direction: 'to-big' },
      instruction: '□에 알맞은 수를 써넣으시오.',
      stem: `${value}cm³ = □m³`,
      answer: { value: whole, display: `${whole}m³`, accepts: [num(whole), `${whole}m³`, `${whole}m3`] },
      solution: ['1m³는 1000000cm³다.', `${value} ÷ 1000000 = ${whole}`],
      dedupeKey: `volume-unit-big:${whole}`,
      difficulty,
    };
  },
  verify({ whole, ratio, direction }, answer) {
    if (direction === 'to-small') return answer.value % ratio === 0 && answer.value / ratio === whole;
    return answer.value === whole && answer.value * ratio === whole * ratio;
  },
};

// ---------------------------------------------------------------------------
// [6수04-01~03] 자료의 수집과 정리 (평균, 띠·원그래프)
// ---------------------------------------------------------------------------

const averageValue = {
  id: 'math.g56.rm.s04-01.average',
  standardCode: '[6수04-01]',
  skill: '평균 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const count = difficulty === 1 ? rng.int(3, 4) : rng.int(4, 6);
    const average = difficulty === 1 ? rng.int(5, 20) : rng.int(10, 50);
    // 평균이 딱 떨어지도록 총합을 먼저 정하고 값들을 나눈다.
    const total = average * count;
    const values = [];
    let rest = total;
    for (let i = 0; i < count - 1; i += 1) {
      const maxTake = rest - (count - 1 - i);
      const take = rng.int(1, Math.max(1, Math.min(maxTake, average * 2)));
      values.push(take);
      rest -= take;
    }
    values.push(rest);
    if (values.some((v) => v <= 0)) return this.generate(rng, { difficulty });
    return {
      params: { values, total, count, average },
      instruction: '평균을 구하시오.',
      stem: `${values.join(', ')}의 평균을 구하시오.`,
      answer: { value: average, display: num(average), accepts: [num(average)] },
      solution: [
        `자료의 합은 ${values.join(' + ')} = ${total}이다.`,
        `자료의 수가 ${count}개이므로 평균은 ${total} ÷ ${count} = ${average}이다.`,
      ],
      dedupeKey: `average:${values.join('-')}`,
      difficulty,
    };
  },
  verify({ values, count }, answer) {
    // 평균 × 자료 수 = 합계인지 확인한다.
    let sum = 0;
    for (const v of values) sum += v;
    let rebuilt = 0;
    for (let k = 0; k < count; k += 1) rebuilt += answer.value;
    return rebuilt === sum && values.length === count;
  },
};

const findMissingForAverage = {
  id: 'math.g56.rm.s04-02.missing-for-average',
  standardCode: '[6수04-02]',
  skill: '평균을 이용해 빠진 값 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const count = difficulty === 1 ? 4 : rng.int(4, 6);
    const average = difficulty === 1 ? rng.int(5, 20) : rng.int(10, 40);
    const total = average * count;
    const known = [];
    let rest = total;
    for (let i = 0; i < count - 1; i += 1) {
      const maxTake = rest - (count - 1 - i);
      const take = rng.int(1, Math.max(1, Math.min(maxTake, average * 2)));
      known.push(take);
      rest -= take;
    }
    if (rest <= 0) return this.generate(rng, { difficulty });
    return {
      params: { known, average, count, missing: rest },
      instruction: '□에 알맞은 수를 구하시오.',
      stem: `${known.join(', ')}, □의 평균이 ${average}입니다. □에 알맞은 수를 구하시오.`,
      answer: { value: rest, display: num(rest), accepts: [num(rest)] },
      solution: [
        `자료가 ${count}개이고 평균이 ${average}이므로 합계는 ${average} × ${count} = ${total}이다.`,
        `${total} - (${known.join(' + ')}) = ${rest}`,
      ],
      dedupeKey: `missing-average:${known.join('-')}:${average}`,
      difficulty,
    };
  },
  verify({ known, average, count }, answer) {
    // 답을 넣은 뒤 평균이 실제로 그 값이 되는지 확인한다.
    let sum = answer.value;
    for (const v of known) sum += v;
    let rebuilt = 0;
    for (let k = 0; k < count; k += 1) rebuilt += average;
    return sum === rebuilt && answer.value > 0;
  },
};

const bandGraphPercent = {
  id: 'math.g56.rm.s04-03.band-graph',
  standardCode: '[6수04-03]',
  skill: '띠그래프·원그래프의 백분율 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const total = rng.pick(difficulty === 1 ? [100, 50] : [100, 50, 200, 25]);
    const categories = ['사과', '포도', '배', '귤'];
    // 백분율이 정수가 되도록 값을 배분한다.
    const percents = (() => {
      const raw = [rng.int(10, 40), rng.int(10, 30), rng.int(10, 30)];
      const sum = raw.reduce((s, v) => s + v, 0);
      return [...raw, 100 - sum];
    })();
    if (percents.at(-1) < 5) return this.generate(rng, { difficulty });
    const counts = percents.map((p) => (p * total) / 100);
    if (counts.some((c) => !Number.isInteger(c))) return this.generate(rng, { difficulty });
    const askIndex = rng.int(0, categories.length - 1);
    return {
      params: { counts, total, askIndex, percent: percents[askIndex] },
      instruction: '백분율을 구하시오.',
      stem: `전체 ${total}명 중 ${categories[askIndex]}${josaEul(categories[askIndex])} 좋아하는 학생이 ${counts[askIndex]}명입니다.`
        + ` 전체에 대한 백분율은 몇 %입니까?`,
      figure: {
        kind: 'data.table',
        spec: { headers: categories, values: counts, headerLabel: '종류', valueLabel: '학생 수(명)' },
        altText: `조사 결과 표. ${categories.map((c, i) => `${c} ${counts[i]}명`).join(', ')}.`,
        prompt: { ko: `흰 배경에 검은 선으로 그린 2행 표. 머리글은 ${categories.join(', ')}, 값은 ${counts.join(', ')}. 초등 수학 교재용. AR 16:9` },
      },
      answer: { value: percents[askIndex], display: `${percents[askIndex]}%`, accepts: [num(percents[askIndex]), `${percents[askIndex]}%`] },
      solution: [
        '백분율은 (비교하는 양) ÷ (전체) × 100으로 구한다.',
        `${counts[askIndex]} ÷ ${total} × 100 = ${percents[askIndex]}%`,
      ],
      dedupeKey: `band-graph:${total}:${counts.join('-')}:${askIndex}`,
      difficulty,
    };
  },
  verify({ counts, total, askIndex }, answer) {
    // 백분율 × 전체 = 비교하는 양 × 100 관계로 확인한다.
    return answer.value * total === counts[askIndex] * 100;
  },
};

// ---------------------------------------------------------------------------
// [6수04-04~06] 가능성
// ---------------------------------------------------------------------------

const LIKELIHOOD_WORDS = ['불가능하다', '~아닐 것 같다', '반반이다', '~일 것 같다', '확실하다'];

const likelihoodWord = {
  id: 'math.g56.rm.s04-04.likelihood-word',
  difficultyAxis: 'single',
  difficulties: [1],
  standardCode: '[6수04-04]',
  skill: '일이 일어날 가능성을 말로 표현하기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const CASES = [
      { situation: '주머니에 흰 공만 5개 들어 있습니다. 흰 공을 꺼낼', word: '확실하다' },
      { situation: '주머니에 흰 공만 5개 들어 있습니다. 검은 공을 꺼낼', word: '불가능하다' },
      { situation: '흰 공 3개와 검은 공 3개가 들어 있습니다. 흰 공을 꺼낼', word: '반반이다' },
      { situation: '흰 공 5개와 검은 공 1개가 들어 있습니다. 흰 공을 꺼낼', word: '~일 것 같다' },
      { situation: '흰 공 1개와 검은 공 5개가 들어 있습니다. 흰 공을 꺼낼', word: '~아닐 것 같다' },
      { situation: '주사위를 굴려 7이 나올', word: '불가능하다' },
      { situation: '주사위를 굴려 1 이상 6 이하의 수가 나올', word: '확실하다' },
      { situation: '동전을 한 번 던져 그림 면이 나올', word: '반반이다' },
    ];
    const c = rng.pick(difficulty === 1 ? CASES.filter((x) => ['확실하다', '불가능하다'].includes(x.word)) : CASES);
    const wrong = LIKELIHOOD_WORDS.filter((w) => w !== c.word);
    return {
      params: { word: c.word },
      instruction: '가능성을 말로 표현한 것을 고르시오.',
      stem: `${c.situation} 가능성은 어떻습니까?`,
      choices: buildChoices(rng, c.word, rng.shuffle(wrong).slice(0, 3)),
      answer: { value: c.word, display: c.word, accepts: [c.word] },
      solution: [`상황을 보면 가능성은 '${c.word}'로 표현한다.`],
      dedupeKey: `likelihood-word:${c.situation}`,
      difficulty,
    };
  },
  verify({ word }, answer) {
    // 답이 가능성 표현 어휘에 실제로 있는지도 함께 본다.
    return answer.value === word && LIKELIHOOD_WORDS.includes(answer.value);
  },
};

const likelihoodNumber = {
  id: 'math.g56.rm.s04-05.likelihood-number',
  standardCode: '[6수04-05]',
  skill: '가능성을 수로 나타내기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    // 가능성은 0, 1/2, 1 중 하나로 나타내는 것이 이 학년군의 범위다.
    const CASES = [
      { situation: '흰 공만 들어 있는 주머니에서 흰 공을 꺼낼', n: 1, d: 1, display: '1' },
      { situation: '흰 공만 들어 있는 주머니에서 검은 공을 꺼낼', n: 0, d: 1, display: '0' },
      { situation: '흰 공 1개와 검은 공 1개가 들어 있는 주머니에서 흰 공을 꺼낼', n: 1, d: 2, display: '1/2' },
      { situation: '동전을 한 번 던져 숫자 면이 나올', n: 1, d: 2, display: '1/2' },
      { situation: '주사위를 굴려 7이 나올', n: 0, d: 1, display: '0' },
      { situation: '주사위를 굴려 6 이하의 수가 나올', n: 1, d: 1, display: '1' },
    ];
    const c = rng.pick(difficulty === 1 ? CASES.filter((x) => x.d === 1) : CASES);
    return {
      params: { n: c.n, d: c.d, display: c.display },
      instruction: '가능성을 수로 나타내시오.',
      stem: `${c.situation} 가능성을 수로 나타내시오.`,
      answer: { value: c.display, display: c.display, accepts: [c.display, c.d === 2 ? '0.5' : c.display] },
      solution: [
        '가능성은 일어날 수 없으면 0, 반드시 일어나면 1로 나타낸다.',
        `이 상황의 가능성은 ${c.display}이다.`,
      ],
      dedupeKey: `likelihood-number:${c.situation}`,
      difficulty,
    };
  },
  verify({ n, d, display }, answer) {
    // 0 이상 1 이하여야 하고, 표기와 분수값이 일치해야 한다.
    if (answer.value !== display) return false;
    return n >= 0 && n <= d;
  },
};

const likelihoodCompare = {
  id: 'math.g56.rm.s04-06.likelihood-compare',
  standardCode: '[6수04-06]',
  skill: '가능성 비교하기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    // 두 주머니의 흰 공 비율을 비교한다. 비율이 같으면 문항이 성립하지 않으므로 배제한다.
    const [w1, b1, w2, b2] = rng.until(
      () => [rng.int(1, 9), rng.int(1, 9), rng.int(1, 9), rng.int(1, 9)],
      ([a, b, c, d]) => a * (c + d) !== c * (a + b),
    );
    const firstBigger = w1 * (w2 + b2) > w2 * (w1 + b1);
    const correct = firstBigger ? '가 주머니' : '나 주머니';
    return {
      params: { w1, b1, w2, b2 },
      instruction: '흰 공을 꺼낼 가능성이 더 큰 것을 고르시오.',
      stem: `가 주머니에는 흰 공 ${w1}개와 검은 공 ${b1}개가, 나 주머니에는 흰 공 ${w2}개와 검은 공 ${b2}개가 들어 있습니다.`,
      choices: buildChoices(rng, correct, ['가 주머니', '나 주머니', '두 주머니가 같다'].filter((v) => v !== correct)),
      answer: { value: correct, display: correct, accepts: [correct] },
      solution: [
        `가 주머니의 흰 공 비율은 ${w1}/${w1 + b1}, 나 주머니는 ${w2}/${w2 + b2}이다.`,
        `통분해 비교하면 ${correct}의 가능성이 더 크다.`,
      ],
      dedupeKey: `likelihood-compare:${w1}:${b1}:${w2}:${b2}`,
      difficulty,
    };
  },
  verify({ w1, b1, w2, b2 }, answer) {
    // 교차곱 정수 비교로 되짚는다.
    const left = w1 * (w2 + b2);
    const right = w2 * (w1 + b1);
    const expected = left > right ? '가 주머니' : '나 주머니';
    return left !== right && answer.value === expected;
  },
};

export const generators = [
  correspondence,
  ratioBasics,
  ratioValue,
  proportionEquation,
  proportionalDistribution,
  congruence,
  symmetryAxes,
  cuboidElements,
  cuboidEdgeSum,
  prismPyramid,
  prismName,
  roundSolids,
  cylinderParts,
  cubeCountFromLayers,
  cubeVolumeCount,
  perimeter,
  areaOfPolygon,
  areaUnitConversion,
  compositeArea,
  circumference,
  circleArea,
  surfaceArea,
  volume,
  volumeUnitConversion,
  averageValue,
  findMissingForAverage,
  bandGraphPercent,
  likelihoodWord,
  likelihoodNumber,
  likelihoodCompare,
];
