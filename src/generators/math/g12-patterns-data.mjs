/**
 * 2022 개정 초등 수학 1~2학년군 '변화와 관계' [2수02-01~02],
 * '자료와 가능성' [2수04-01~03] 문항 생성기.
 */
import { buildChoices } from '../../engine/item.mjs';
import { josaEul, josaEun, josaI, numEun } from '../../engine/korean-number.mjs';

const num = (n) => String(n);

// ---------------------------------------------------------------------------
// [2수02-01] 배열에서 규칙 찾기
// ---------------------------------------------------------------------------

/** 무늬 규칙에 쓰는 기호. 색·모양이 번갈아 나오는 배열을 글자로 표현한다. */
const PATTERN_SYMBOLS = ['●', '▲', '■', '★', '◆'];

const findShapePattern = {
  id: 'math.g12.pd.s01.shape-pattern',
  standardCode: '[2수02-01]',
  skill: '무늬 배열의 규칙 찾기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    // 난이도가 규칙의 주기 길이를 정한다. 주기가 길수록 규칙 파악이 어렵다.
    const period = difficulty === 1 ? 2 : difficulty === 2 ? 3 : rng.int(3, 4);
    const alphabet = rng.shuffle(PATTERN_SYMBOLS).slice(0, period);
    const length = period * 3 + rng.int(0, period - 1);
    const sequence = Array.from({ length }, (_, k) => alphabet[k % period]);
    // 빈칸은 규칙이 두 번 이상 반복된 뒤에 둔다. 그래야 규칙이 결정된다.
    const hideIndex = rng.int(period * 2, length - 1);
    const hidden = sequence[hideIndex];
    const shown = sequence.map((s, idx) => (idx === hideIndex ? '□' : s));

    return {
      params: { alphabet, period, hideIndex },
      instruction: '규칙을 찾아 □에 알맞은 모양을 쓰시오.',
      stem: shown.join(' '),
      answer: { value: hidden, display: hidden, accepts: [hidden] },
      solution: [
        `${alphabet.join(', ')}${josaI(alphabet.at(-1))} 반복되는 규칙이다.`,
        `□는 ${hideIndex + 1}번째이므로 ${hidden}이다.`,
      ],
      dedupeKey: `shape-pattern:${alphabet.join('')}:${length}:${hideIndex}`,
      difficulty,
    };
  },
  verify({ alphabet, period, hideIndex }, answer) {
    // 주기로 나눈 나머지 위치의 기호와 같아야 한다.
    return answer.value === alphabet[hideIndex % period] && alphabet.length === period;
  },
};

const findNumberPattern = {
  id: 'math.g12.pd.s01.number-pattern',
  standardCode: '[2수02-01]',
  skill: '수 배열의 규칙 찾기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    const step = difficulty === 1 ? rng.pick([1, 2, 5]) : difficulty === 2 ? rng.pick([3, 4, 10]) : rng.pick([6, 7, 9, 15]);
    const increasing = difficulty === 3 ? rng.bool() : true;
    const start = increasing ? rng.int(1, 40) : rng.int(step * 5 + 1, 99);
    const terms = Array.from({ length: 5 }, (_, k) => (increasing ? start + step * k : start - step * k));
    const hideIndex = rng.int(2, 4);
    const hidden = terms[hideIndex];
    const shown = terms.map((t, idx) => (idx === hideIndex ? '□' : String(t)));

    return {
      params: { terms, step, increasing, hideIndex },
      instruction: '규칙을 찾아 □에 알맞은 수를 써넣으시오.',
      stem: shown.join(', '),
      answer: { value: hidden, display: num(hidden), accepts: [num(hidden)] },
      solution: [
        `${step}씩 ${increasing ? '커지는' : '작아지는'} 규칙이다.`,
        `${terms[hideIndex - 1]} ${increasing ? '+' : '-'} ${step} = ${hidden}이다.`,
      ],
      dedupeKey: `number-pattern:${start}:${step}:${increasing ? 'up' : 'down'}:${hideIndex}`,
      difficulty,
    };
  },
  verify({ terms, step, increasing, hideIndex }, answer) {
    // 앞뒤 항과의 차가 규칙과 맞아야 한다.
    const delta = increasing ? step : -step;
    if (answer.value - terms[hideIndex - 1] !== delta) return false;
    const next = terms[hideIndex + 1];
    return next === undefined || next - answer.value === delta;
  },
};

// ---------------------------------------------------------------------------
// [2수02-02] 정한 규칙에 따라 배열하기 (다음 항 찾기만 자동 채점)
// ---------------------------------------------------------------------------

const continuePattern = {
  id: 'math.g12.pd.s02.continue',
  standardCode: '[2수02-02]',
  skill: '규칙에 따라 다음에 올 것 찾기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const period = difficulty === 1 ? 2 : rng.int(2, 3);
    const alphabet = rng.shuffle(PATTERN_SYMBOLS).slice(0, period);
    const length = period * 2 + rng.int(1, period);
    const sequence = Array.from({ length }, (_, k) => alphabet[k % period]);
    const nextSymbol = alphabet[length % period];
    const wrong = PATTERN_SYMBOLS.filter((s) => s !== nextSymbol).slice(0, 3);

    return {
      params: { alphabet, period, length },
      instruction: '다음에 올 모양을 고르시오.',
      stem: `${sequence.join(' ')} ...`,
      choices: buildChoices(rng, nextSymbol, wrong),
      answer: { value: nextSymbol, display: nextSymbol, accepts: [nextSymbol] },
      solution: [
        `${alphabet.join(', ')}${josaI(alphabet.at(-1))} 반복되는 규칙이다.`,
        `${length}개까지 놓였으므로 다음은 ${nextSymbol}이다.`,
      ],
      dedupeKey: `continue-pattern:${alphabet.join('')}:${length}`,
      difficulty,
    };
  },
  verify({ alphabet, period, length }, answer) {
    return answer.value === alphabet[length % period] && alphabet.length === period;
  },
};

// ---------------------------------------------------------------------------
// [2수04-01~03] 분류하여 세기 · 표로 나타내기 · 그래프로 나타내기
// ---------------------------------------------------------------------------

/** 분류 기준과 항목. 1~2학년이 눈으로 분류할 수 있는 범주만 쓴다. */
const CLASSIFICATIONS = [
  { criterion: '색깔', categories: ['빨강', '노랑', '파랑'], thing: '색종이', counter: '장' },
  { criterion: '종류', categories: ['사과', '배', '귤'], thing: '과일', counter: '개' },
  { criterion: '모양', categories: ['삼각형', '사각형', '원'], thing: '조각', counter: '개' },
  { criterion: '좋아하는 운동', categories: ['축구', '수영', '야구'], thing: '학생', counter: '명' },
  { criterion: '좋아하는 계절', categories: ['봄', '여름', '가을', '겨울'], thing: '학생', counter: '명' },
];

function pickClassification(rng, difficulty) {
  const pool = difficulty === 1 ? CLASSIFICATIONS.filter((c) => c.categories.length === 3) : CLASSIFICATIONS;
  const base = rng.pick(pool);
  const maxCount = difficulty === 1 ? 4 : difficulty === 2 ? 6 : 8;
  const counts = base.categories.map(() => rng.int(1, maxCount));
  return { ...base, counts };
}

const countByCategory = {
  id: 'math.g12.pd.s04-01.count',
  standardCode: '[2수04-01]',
  skill: '기준에 따라 분류하여 개수 세기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const c = pickClassification(rng, difficulty);
    const total = c.counts.reduce((s, v) => s + v, 0);
    // 분류 결과를 나열해 주고 합계를 묻는다. 세기의 정확성이 초점이다.
    const listing = c.categories.map((cat, idx) => `${cat} ${c.counts[idx]}${c.counter}`).join(', ');
    return {
      params: { counts: c.counts },
      instruction: '물음에 답하시오.',
      stem: `${c.criterion}${josaEul(c.criterion)} 기준으로 분류했습니다. ${listing}입니다. ${c.thing}${josaEun(c.thing)} 모두 몇 ${c.counter}입니까?`,
      answer: { value: total, display: `${total}${c.counter}`, accepts: [num(total), `${total}${c.counter}`] },
      solution: [`${c.counts.join(' + ')} = ${total}${c.counter}이다.`],
      dedupeKey: `count-by-category:${c.criterion}:${c.counts.join('-')}`,
      difficulty,
    };
  },
  verify({ counts }, answer) {
    // 하나씩 누적해서 되짚는다.
    let running = 0;
    for (const v of counts) running += v;
    return running === answer.value;
  },
};

const readDataTable = {
  id: 'math.g12.pd.s04-02.read-table',
  standardCode: '[2수04-02]',
  skill: '표를 읽고 답 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const c = pickClassification(rng, difficulty);
    const total = c.counts.reduce((s, v) => s + v, 0);
    const mode = difficulty === 1 ? 'total' : rng.pick(['total', 'most', 'diff']);

    let stem;
    let value;
    let display;
    let solution;
    if (mode === 'total') {
      stem = `표를 보고 ${c.thing} 수의 합계를 구하시오.`;
      value = total;
      display = `${total}${c.counter}`;
      solution = [`${c.counts.join(' + ')} = ${total}${c.counter}이다.`];
    } else if (mode === 'most') {
      const maxIdx = c.counts.indexOf(Math.max(...c.counts));
      stem = `표에서 가장 많은 것은 무엇입니까?`;
      value = c.categories[maxIdx];
      display = c.categories[maxIdx];
      solution = [`가장 큰 수는 ${c.counts[maxIdx]}${c.counter}이다.`, `그러므로 ${c.categories[maxIdx]}이 가장 많다.`];
    } else {
      const maxIdx = c.counts.indexOf(Math.max(...c.counts));
      const minIdx = c.counts.indexOf(Math.min(...c.counts));
      stem = `표에서 가장 많은 것과 가장 적은 것의 차는 몇 ${c.counter}입니까?`;
      value = c.counts[maxIdx] - c.counts[minIdx];
      display = `${value}${c.counter}`;
      solution = [`가장 많은 것은 ${c.counts[maxIdx]}${c.counter}, 가장 적은 것은 ${c.counts[minIdx]}${c.counter}이다.`, `${c.counts[maxIdx]} - ${c.counts[minIdx]} = ${value}${c.counter}이다.`];
    }

    return {
      params: { counts: c.counts, categories: c.categories, mode },
      instruction: '표를 보고 물음에 답하시오.',
      stem,
      figure: {
        kind: 'data.table',
        spec: { headers: c.categories, values: c.counts, headerLabel: c.criterion, valueLabel: `수(${c.counter})` },
        altText: `${c.criterion}별 ${c.thing} 수를 정리한 표. ${c.categories.map((cat, idx) => `${cat} ${c.counts[idx]}`).join(', ')}.`,
        prompt: { ko: `흰 배경에 검은 선으로 그린 2행 표. 첫 행은 ${c.categories.join(', ')} 머리글, 둘째 행은 ${c.counts.join(', ')} 값. 초등 수학 교재용. AR 16:9` },
      },
      answer: { value, display, accepts: [String(value), display] },
      solution,
      dedupeKey: `read-table:${c.criterion}:${c.counts.join('-')}:${mode}`,
      difficulty,
    };
  },
  verify({ counts, categories, mode }, answer) {
    if (mode === 'total') {
      let running = 0;
      for (const v of counts) running += v;
      return running === answer.value;
    }
    if (mode === 'most') {
      const idx = categories.indexOf(answer.value);
      // 정답 항목의 값이 모든 값보다 작지 않아야 한다.
      return idx >= 0 && counts.every((v) => counts[idx] >= v);
    }
    const sorted = [...counts].sort((a, b) => a - b);
    return sorted.at(-1) - sorted[0] === answer.value;
  },
};

const readPictureGraph = {
  id: 'math.g12.pd.s04-03.read-graph',
  standardCode: '[2수04-03]',
  skill: '그림그래프를 읽고 답 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const c = pickClassification(rng, difficulty);
    // 그래프는 세로로 그리므로 항목당 개수를 6 이하로 묶어 학습지 높이를 지킨다.
    const counts = c.counts.map((v) => Math.min(v, 6));
    const askIndex = rng.int(0, c.categories.length - 1);
    const mode = difficulty === 1 ? 'read-one' : rng.pick(['read-one', 'most', 'total']);

    let stem;
    let value;
    let display;
    let solution;
    if (mode === 'read-one') {
      stem = `그래프에서 ${c.categories[askIndex]}${josaEun(c.categories[askIndex])} 몇 ${c.counter}입니까?`;
      value = counts[askIndex];
      display = `${value}${c.counter}`;
      solution = [`${c.categories[askIndex]} 칸에 ○이 ${counts[askIndex]}개 있다.`, `${value}${c.counter}이다.`];
    } else if (mode === 'most') {
      const maxIdx = counts.indexOf(Math.max(...counts));
      stem = '그래프에서 가장 많은 것은 무엇입니까?';
      value = c.categories[maxIdx];
      display = value;
      solution = [`○이 가장 높이 쌓인 칸은 ${c.categories[maxIdx]}이다.`];
    } else {
      const total = counts.reduce((s, v) => s + v, 0);
      stem = `그래프의 ○을 모두 세면 몇 개입니까?`;
      value = total;
      display = `${total}개`;
      solution = [`${counts.join(' + ')} = ${total}개이다.`];
    }

    return {
      params: { counts, categories: c.categories, mode, askIndex },
      instruction: '그래프를 보고 물음에 답하시오.',
      stem,
      figure: {
        kind: 'data.picture-graph',
        spec: { categories: c.categories, counts },
        altText: `${c.criterion}별 ${c.thing} 수를 ○로 나타낸 그림그래프. ${c.categories.map((cat, idx) => `${cat} ${counts[idx]}개`).join(', ')}.`,
        prompt: { ko: `흰 배경에 검은 선으로 그린 그림그래프. 가로축에 ${c.categories.join(', ')}, 세로축은 개수이며 각 칸에 ○ 기호가 ${counts.join(', ')}개씩 쌓여 있다. 초등 수학 교재용. AR 16:9` },
      },
      answer: { value, display, accepts: [String(value), display] },
      solution,
      dedupeKey: `read-graph:${c.criterion}:${counts.join('-')}:${mode}:${mode === 'read-one' ? askIndex : ''}`,
      difficulty,
    };
  },
  verify({ counts, categories, mode, askIndex }, answer) {
    if (mode === 'read-one') return answer.value === counts[askIndex];
    if (mode === 'most') {
      const idx = categories.indexOf(answer.value);
      return idx >= 0 && counts.every((v) => counts[idx] >= v);
    }
    let running = 0;
    for (const v of counts) running += v;
    return running === answer.value;
  },
};

export const generators = [
  findShapePattern,
  findNumberPattern,
  continuePattern,
  countByCategory,
  readDataTable,
  readPictureGraph,
];
