/**
 * 2022 개정 초등 수학 1~2학년군 '도형과 측정' 잔여 성취기준.
 * [2수03-01] 입체도형 모양 / [2수03-02] 쌓기나무 / [2수03-03] 평면도형 찾기
 * [2수03-06] 양의 비교 / [2수03-13] 길이 어림
 *
 * [2수03-04](도형 그리기)는 작도 수행 과제여서 자동 채점 대상이 아니다.
 * curriculum/scoring-policy.mjs 의 MANUAL_SCORING 을 보라.
 */
import { buildChoices } from '../../engine/item.mjs';
import { josaEun, josaI, numEun } from '../../engine/korean-number.mjs';

const CODE = (n) => `[2수03-${String(n).padStart(2, '0')}]`;
const num = (n) => String(n);
const MARKS = ['㉠', '㉡', '㉢', '㉣'];

// ---------------------------------------------------------------------------
// [2수03-01] 직육면체·원기둥·구의 모양 찾기
// ---------------------------------------------------------------------------

/**
 * [2수03-01]이 다루는 입체는 직육면체·원기둥·구다.
 * 정육면체는 직육면체의 특수한 경우여서 같은 선택지에 두면 정답이 둘이 되고,
 * 이 학년군 범위도 아니라 아예 넣지 않는다.
 */
const SOLID_NAMES = { cuboid: '직육면체', cylinder: '원기둥', sphere: '구' };

/** 교과서가 각 입체와 함께 제시하는 생활 속 물건. 모양 감각을 실물에 잇는다. */
const SOLID_OBJECTS = {
  cuboid: ['상자', '지우개', '책', '벽돌'],
  cylinder: ['음료수 캔', '나무 토막', '풀'],
  sphere: ['축구공', '구슬', '수박'],
};

const identifySolid = {
  id: 'math.g12.sc.s01.identify',
  standardCode: CODE(1),
  skill: '입체도형의 모양 구별하기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const pool = Object.keys(SOLID_NAMES);
    const target = rng.pick(pool);
    const others = rng.shuffle(Object.keys(SOLID_NAMES).filter((s) => s !== target)).slice(0, 2);
    const solids = rng.shuffle([target, ...others]);
    const answerMark = MARKS[solids.indexOf(target)];

    return {
      params: { target, solids },
      instruction: '알맞은 것을 고르시오.',
      stem: `${SOLID_NAMES[target]} 모양은 어느 것입니까?`,
      figure: {
        kind: 'geometry.solid-shape',
        spec: { solids },
        altText: solids.map((s, idx) => `${MARKS[idx]} ${SOLID_NAMES[s]}`).join(', ') + ' 모양이 차례로 놓여 있다.',
        prompt: { ko: `흰 배경에 검은 윤곽선과 연회색 면으로 그린 입체도형 ${solids.length}개가 한 줄로 놓인 초등 수학 교재용 도해. 각 도형 아래에 ${MARKS.slice(0, solids.length).join(', ')} 기호. AR 16:9` },
      },
      choices: buildChoices(rng, answerMark, MARKS.filter((m) => m !== answerMark).slice(0, solids.length - 1)),
      answer: { value: answerMark, display: `${answerMark} (${SOLID_NAMES[target]})`, accepts: [answerMark, SOLID_NAMES[target]] },
      solution: [`${SOLID_NAMES[target]}${josaEun(SOLID_NAMES[target])} ${SOLID_OBJECTS[target][0]}과 같은 모양이다.`, `그림에서 ${answerMark}이 ${SOLID_NAMES[target]} 모양이다.`],
      dedupeKey: `identify-solid:${solids.join('-')}:${target}`,
      difficulty,
    };
  },
  verify({ target, solids }, answer) {
    const idx = MARKS.indexOf(answer.value);
    return idx >= 0 && solids[idx] === target;
  },
};

const solidFromObject = {
  id: 'math.g12.sc.s01.from-object',
  standardCode: CODE(1),
  skill: '생활 속 물건의 입체도형 모양 말하기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const target = rng.pick(Object.keys(SOLID_OBJECTS));
    const object = rng.pick(SOLID_OBJECTS[target]);
    const wrong = rng.shuffle(Object.keys(SOLID_NAMES).filter((s) => s !== target)).slice(0, 3).map((s) => SOLID_NAMES[s]);
    return {
      params: { target, object },
      instruction: '알맞은 것을 고르시오.',
      stem: `${object}${josaEun(object)} 어떤 모양입니까?`,
      choices: buildChoices(rng, SOLID_NAMES[target], wrong),
      answer: { value: SOLID_NAMES[target], display: SOLID_NAMES[target], accepts: [SOLID_NAMES[target]] },
      solution: [`${object}${josaEun(object)} ${SOLID_NAMES[target]} 모양이다.`],
      dedupeKey: `solid-from-object:${object}`,
      difficulty,
    };
  },
  verify({ target }, answer) {
    // 이름에서 입체 종류를 되짚는다.
    const entry = Object.entries(SOLID_NAMES).find(([, name]) => name === answer.value);
    return Boolean(entry) && entry[0] === target;
  },
};

// ---------------------------------------------------------------------------
// [2수03-02] 쌓기나무로 모양 만들기 (개수 세기만 자동 채점)
// ---------------------------------------------------------------------------

const countStackedCubes = {
  id: 'math.g12.sc.s02.count-cubes',
  standardCode: CODE(2),
  skill: '쌓기나무의 개수 세기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const height = difficulty === 1 ? 2 : difficulty === 2 ? rng.int(2, 3) : rng.int(3, 4);
    // 위층이 아래층보다 넓으면 공중에 뜬다. 아래에서 위로 갈수록 좁아지게 만든다.
    const layers = [];
    let widest = difficulty === 1 ? rng.int(2, 3) : rng.int(3, 5);
    for (let level = 0; level < height; level += 1) {
      layers.push(widest);
      widest = Math.max(1, widest - rng.int(0, 1) - (level === 0 ? 1 : 0));
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
        prompt: { ko: `흰 배경에 등각 투상으로 그린 쌓기나무 도해. 아래층부터 위로 ${layers.join('개, ')}개가 쌓여 있고 각 정육면체는 검은 윤곽선과 연회색 면이다. 초등 수학 교재용. AR 1:1` },
      },
      answer: { value: total, display: `${total}개`, accepts: [num(total), `${total}개`] },
      solution: [
        ...layers.map((count, level) => `${level + 1}층에 ${count}개가 있다.`),
        `${layers.join(' + ')} = ${total}개이다.`,
      ],
      dedupeKey: `count-cubes:${layers.join('-')}`,
      difficulty,
    };
  },
  verify({ layers }, answer) {
    // 층별로 하나씩 세어 누적한다. reduce 와 다른 경로다.
    let running = 0;
    for (const count of layers) {
      for (let k = 0; k < count; k += 1) running += 1;
    }
    return running === answer.value;
  },
};

// ---------------------------------------------------------------------------
// [2수03-03] 생활 주변에서 사각형·삼각형·원 찾기
// ---------------------------------------------------------------------------

const PLANE_NAMES = { triangle: '삼각형', quadrilateral: '사각형', circle: '원' };
const PLANE_OBJECTS = {
  triangle: ['삼각김밥', '옷걸이', '교통 표지판'],
  quadrilateral: ['창문', '공책', '칠판', '휴대전화'],
  circle: ['접시', '동전', '시계', '단추'],
};

const planeFromObject = {
  id: 'math.g12.sc.s03.from-object',
  standardCode: CODE(3),
  skill: '생활 속 물건에서 평면도형 찾기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const target = rng.pick(Object.keys(PLANE_OBJECTS));
    const object = rng.pick(PLANE_OBJECTS[target]);
    const wrong = Object.keys(PLANE_NAMES).filter((s) => s !== target).map((s) => PLANE_NAMES[s]);
    return {
      params: { target, object },
      instruction: '알맞은 것을 고르시오.',
      stem: `${object}에서 찾을 수 있는 도형은 무엇입니까?`,
      choices: buildChoices(rng, PLANE_NAMES[target], [...wrong, '오각형']),
      answer: { value: PLANE_NAMES[target], display: PLANE_NAMES[target], accepts: [PLANE_NAMES[target]] },
      solution: [`${object}의 테두리 모양은 ${PLANE_NAMES[target]}이다.`],
      dedupeKey: `plane-from-object:${object}`,
      difficulty,
    };
  },
  verify({ target }, answer) {
    const entry = Object.entries(PLANE_NAMES).find(([, name]) => name === answer.value);
    return Boolean(entry) && entry[0] === target;
  },
};

// ---------------------------------------------------------------------------
// [2수03-06] 길이·들이·무게·넓이 비교
// ---------------------------------------------------------------------------

/**
 * 양의 종류마다 쓰는 말이 다르다. 이 짝을 틀리면 성취기준을 빗나간다.
 * 길이=길다/짧다, 들이=많다/적다, 무게=무겁다/가볍다, 넓이=넓다/좁다
 */
const QUANTITY_PAIRS = [
  { quantity: '길이', more: '길다', less: '짧다', pairs: [['연필', '지우개'], ['기차', '자동차'], ['젓가락', '숟가락']] },
  { quantity: '들이', more: '많다', less: '적다', pairs: [['물통', '컵'], ['욕조', '세면대'], ['주전자', '종이컵']] },
  { quantity: '무게', more: '무겁다', less: '가볍다', pairs: [['수박', '귤'], ['코끼리', '강아지'], ['가방', '연필']] },
  { quantity: '넓이', more: '넓다', less: '좁다', pairs: [['운동장', '교실'], ['이불', '수건'], ['칠판', '공책']] },
];

const compareQuantity = {
  id: 'math.g12.sc.s06.compare',
  standardCode: CODE(6),
  skill: '양을 비교하는 말 고르기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const group = difficulty === 1
      ? rng.pick(QUANTITY_PAIRS.slice(0, 2))
      : rng.pick(QUANTITY_PAIRS);
    const [big, small] = rng.pick(group.pairs);
    const askMore = rng.bool();
    const correct = askMore ? group.more : group.less;
    // 오답은 다른 양에 쓰는 말이다. 이걸 고르면 양의 종류를 혼동한 것이다.
    const wrong = QUANTITY_PAIRS.filter((g) => g.quantity !== group.quantity)
      .map((g) => (askMore ? g.more : g.less));
    return {
      params: { quantity: group.quantity, correct, askMore },
      instruction: '□에 알맞은 말을 고르시오.',
      stem: askMore
        ? `${big}${josaEun(big)} ${small}보다 □.`
        : `${small}${josaEun(small)} ${big}보다 □.`,
      choices: buildChoices(rng, correct, wrong.slice(0, 3)),
      answer: { value: correct, display: correct, accepts: [correct] },
      solution: [
        `${big}${josaI(big)} ${small}보다 ${group.quantity}${josaI(group.quantity)} 더 크다.`,
        `${group.quantity}${josaEun(group.quantity)} '${group.more}', '${group.less}'로 비교한다.`,
      ],
      dedupeKey: `compare-quantity:${group.quantity}:${big}-${small}:${askMore ? 'more' : 'less'}`,
      difficulty,
    };
  },
  verify({ quantity, correct, askMore }, answer) {
    // 답이 그 양에 쓰는 말인지 어휘표에서 되짚는다.
    const group = QUANTITY_PAIRS.find((g) => g.quantity === quantity);
    const expected = askMore ? group.more : group.less;
    return answer.value === expected && answer.value === correct;
  },
};

// ---------------------------------------------------------------------------
// [2수03-13] 길이 어림하고 비교하기
// ---------------------------------------------------------------------------

/** 1~2학년이 몸으로 아는 어림 기준. 뼘·걸음·클립 등 임의 단위 비교다. */
const ESTIMATE_UNITS = [
  { unit: '뼘', span: 15 },
  { unit: '클립', span: 3 },
  { unit: '걸음', span: 40 },
  { unit: '연필', span: 18 },
];

const estimateWithUnit = {
  id: 'math.g12.sc.s13.estimate-unit',
  standardCode: CODE(13),
  skill: '임의 단위로 길이 어림하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const { unit, span } = rng.pick(ESTIMATE_UNITS);
    const count = difficulty === 1 ? rng.int(2, 4) : rng.int(3, 9);
    const totalCm = span * count;
    return {
      params: { span, count },
      instruction: '□에 알맞은 수를 구하시오.',
      stem: `${unit} 한 번의 길이가 약 ${span}cm입니다. 어떤 물건의 길이가 ${unit}으로 ${count}번이면 약 몇 cm입니까?`,
      answer: { value: totalCm, display: `${totalCm}cm`, accepts: [num(totalCm), `${totalCm}cm`] },
      solution: [`${unit} 한 번이 약 ${span}cm이다.`, `${span} × ${count} = ${totalCm}cm이다.`],
      dedupeKey: `estimate-unit:${unit}:${count}`,
      difficulty,
    };
  },
  verify({ span, count }, answer) {
    // 반복 덧셈으로 되짚는다.
    let sum = 0;
    for (let k = 0; k < count; k += 1) sum += span;
    return sum === answer.value;
  },
};

const compareEstimates = {
  id: 'math.g12.sc.s13.compare-estimate',
  standardCode: CODE(13),
  skill: '어림한 길이 비교하기',
  format: 'compare',
  generate(rng, { difficulty }) {
    const [a, b] = rng.until(
      () => [rng.int(2, 9), rng.int(2, 9)],
      ([x, y]) => x !== y && Math.abs(x - y) >= (difficulty === 1 ? 3 : 1),
    );
    const unit = rng.pick(ESTIMATE_UNITS).unit;
    const sign = a > b ? '>' : '<';
    return {
      params: { a, b },
      instruction: '□ 안에 >, < 중 알맞은 것을 써넣으시오.',
      stem: `${unit}으로 ${a}번인 길이 □ ${unit}으로 ${b}번인 길이`,
      answer: { value: sign, display: sign, accepts: [sign] },
      solution: [
        `같은 단위로 재었으므로 번 수가 클수록 길다.`,
        `${a} ${sign} ${b}이므로 ${unit} ${a}번인 길이가 더 ${a > b ? '길다' : '짧다'}.`,
      ],
      dedupeKey: `compare-estimate:${unit}:${a}:${b}`,
      difficulty,
    };
  },
  verify({ a, b }, answer) {
    const diff = a - b;
    return (diff > 0 && answer.value === '>') || (diff < 0 && answer.value === '<');
  },
};

export const generators = [
  identifySolid,
  solidFromObject,
  countStackedCubes,
  planeFromObject,
  compareQuantity,
  estimateWithUnit,
  compareEstimates,
];
