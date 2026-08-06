/**
 * 2022 개정 초등 수학 3~4학년군
 *   '도형과 측정' 중 도형의 기초 [4수03-01~03], 평면도형의 이동 [4수03-04~05],
 *   원의 구성 요소 [4수03-06~07], 여러 가지 삼각형 [4수03-08~09],
 *   여러 가지 사각형 [4수03-10], 다각형 [4수03-11~12], 각도 [4수03-24~25]
 *   '자료와 가능성' [4수04-01~03]
 *
 * 각도·변 길이는 SVG 렌더러가 삼각함수로 정확히 그린다. 그림의 각이 문제의 각과
 * 어긋나면 문항 자체가 오답이 되므로 spec 과 정답을 같은 값에서 만든다.
 */
import { buildChoices } from '../../engine/item.mjs';
import { josaEun, josaI, numEun, numI } from '../../engine/korean-number.mjs';
import { QUAD_NAMES, TRANSFORM_LABELS } from '../../render/figure-geometry34.mjs';

const MARKS = ['㉠', '㉡', '㉢', '㉣'];
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
// [4수03-01] 직선·선분·반직선
// ---------------------------------------------------------------------------

const LINE_KINDS = {
  segment: { korean: '선분', basis: '두 점을 곧게 이은 선이다. 양쪽 끝이 있다.' },
  ray: { korean: '반직선', basis: '한 점에서 시작해 한쪽으로만 끝없이 늘인 선이다.' },
  line: { korean: '직선', basis: '두 점을 지나 양쪽으로 끝없이 늘인 선이다.' },
};

const identifyLine = {
  id: 'math.g34.gd.s01.identify-line',
  capacityNote: '[4수03-01]이 다루는 것은 직선·선분·반직선 셋이 전부다.',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 선분·직선만, 2 이상은 반직선까지 구별한다.',
  standardCode: '[4수03-01]',
  skill: '직선·선분·반직선 구별하기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const kind = rng.pick(difficulty === 1 ? ['segment', 'line'] : Object.keys(LINE_KINDS));
    const correct = LINE_KINDS[kind].korean;
    const wrong = Object.values(LINE_KINDS).map((v) => v.korean).filter((v) => v !== correct);
    return {
      params: { kind },
      instruction: '그림이 나타내는 것을 고르시오.',
      stem: '',
      figure: {
        kind: 'geometry.line',
        spec: { kind },
        altText: `${LINE_KINDS[kind].korean} ㄱㄴ. ${LINE_KINDS[kind].basis}`,
        prompt: { ko: `흰 배경에 검은 선으로 그린 ${LINE_KINDS[kind].korean} 도해. 점 ㄱ과 ㄴ이 표시되어 있다. 초등 수학 교재용. AR 16:9` },
      },
      choices: buildChoices(rng, correct, [...wrong, '곡선']),
      answer: { value: correct, display: correct, accepts: [correct] },
      solution: [LINE_KINDS[kind].basis, `그림은 ${correct} ㄱㄴ이다.`],
      dedupeKey: `identify-line:${kind}`,
      difficulty,
    };
  },
  verify({ kind }, answer) {
    // 이름표에서 종류를 되짚는다.
    const entry = Object.entries(LINE_KINDS).find(([, v]) => v.korean === answer.value);
    return Boolean(entry) && entry[0] === kind;
  },
};

// ---------------------------------------------------------------------------
// [4수03-02] 각과 직각
// ---------------------------------------------------------------------------

const identifyRightAngle = {
  id: 'math.g34.gd.s02.right-angle',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도가 오를수록 직각이 아닌 각을 90도에 가깝게 둔다(30도 -> 20도 -> 12도 차이).',
  standardCode: '[4수03-02]',
  skill: '직각 찾기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    // 직각을 정확히 90도로 그리고, 나머지는 90도에서 충분히 떨어뜨린다.
    const gap = difficulty === 1 ? 30 : difficulty === 2 ? 20 : 12;
    const others = rng.shuffle([
      rng.int(20, 90 - gap),
      rng.int(90 + gap, 160),
    ]);
    const angles = rng.shuffle([90, ...others]);
    const answerMark = MARKS[angles.indexOf(90)];
    return {
      params: { angles },
      instruction: '직각은 어느 것입니까?',
      stem: '',
      figure: {
        kind: 'geometry.angle',
        spec: { angles },
        altText: `각 ${angles.length}개가 차례로 놓여 있다. ${angles.map((a, i) => `${MARKS[i]} ${a}도`).join(', ')}.`,
        prompt: { ko: `흰 배경에 검은 선으로 그린 각 ${angles.length}개가 한 줄로 놓인 도해. 각 각의 아래에 ${MARKS.slice(0, angles.length).join(', ')} 기호. 초등 수학 교재용. AR 16:9` },
      },
      choices: buildChoices(rng, answerMark, MARKS.filter((m) => m !== answerMark).slice(0, angles.length - 1)),
      answer: { value: answerMark, display: `${answerMark} (90°)`, accepts: [answerMark, '90', '90°'] },
      solution: ['직각은 크기가 90도인 각이다.', `${answerMark}이 직각이다.`],
      dedupeKey: `right-angle:${angles.join('-')}`,
      difficulty,
    };
  },
  verify({ angles }, answer) {
    const idx = MARKS.indexOf(answer.value);
    return idx >= 0 && angles[idx] === 90;
  },
};

// ---------------------------------------------------------------------------
// [4수03-03] 직각삼각형·직사각형·정사각형
// ---------------------------------------------------------------------------

const RIGHT_FIGURE_FACTS = {
  'right-triangle': { korean: '직각삼각형', basis: '한 각이 직각인 삼각형이다.' },
  rectangle: { korean: '직사각형', basis: '네 각이 모두 직각인 사각형이다.' },
  square: { korean: '정사각형', basis: '네 각이 모두 직각이고 네 변의 길이가 모두 같은 사각형이다.' },
};

const rightAngleFigures = {
  id: 'math.g34.gd.s03.right-figures',
  difficultyAxis: 'single',
  difficulties: [1],
  standardCode: '[4수03-03]',
  skill: '직각이 있는 도형의 성질',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const key = rng.pick(Object.keys(RIGHT_FIGURE_FACTS));
    const fact = RIGHT_FIGURE_FACTS[key];
    const wrong = Object.values(RIGHT_FIGURE_FACTS).map((v) => v.korean).filter((v) => v !== fact.korean);
    return {
      params: { key },
      instruction: '설명에 알맞은 도형을 고르시오.',
      stem: fact.basis,
      choices: buildChoices(rng, fact.korean, [...wrong, '마름모']),
      answer: { value: fact.korean, display: fact.korean, accepts: [fact.korean] },
      solution: [`${fact.basis} 이런 도형을 ${fact.korean}이라고 한다.`],
      dedupeKey: `right-figure:${key}`,
      difficulty,
    };
  },
  verify({ key }, answer) {
    return RIGHT_FIGURE_FACTS[key].korean === answer.value;
  },
};

// ---------------------------------------------------------------------------
// [4수03-04] 밀기·뒤집기·돌리기
// ---------------------------------------------------------------------------

const identifyTransform = {
  id: 'math.g34.gd.s04.transform',
  capacityNote: '평면도형의 이동은 밀기·좌우 뒤집기·위아래 뒤집기·90도 돌리기·180도 돌리기 다섯 가지가 전부다.',
  standardCode: '[4수03-04]',
  skill: '평면도형의 이동 방법 알기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const pool = difficulty === 1
      ? ['slide', 'flip-horizontal']
      : ['slide', 'flip-horizontal', 'flip-vertical', 'rotate-90', 'rotate-180'];
    const transform = rng.pick(pool);
    const correct = TRANSFORM_LABELS[transform];
    const wrong = Object.entries(TRANSFORM_LABELS)
      .filter(([k]) => k !== transform)
      .map(([, v]) => v);
    return {
      params: { transform },
      instruction: '처음 도형을 어떻게 움직인 것입니까?',
      stem: '',
      figure: {
        kind: 'geometry.symmetry',
        spec: { transform },
        altText: `왼쪽은 처음 도형, 오른쪽은 ${correct}를 한 결과다.`,
        prompt: { ko: `흰 배경에 검은 윤곽선으로 그린 계단 모양 도형 두 개. 왼쪽은 처음 도형, 오른쪽은 ${correct} 결과. 초등 수학 교재용. AR 16:9` },
      },
      choices: buildChoices(rng, correct, rng.shuffle(wrong).slice(0, 3)),
      answer: { value: correct, display: correct, accepts: [correct] },
      solution: [`도형의 방향이 바뀐 모습을 보면 ${correct}를 한 것이다.`],
      dedupeKey: `transform:${transform}`,
      difficulty,
    };
  },
  verify({ transform }, answer) {
    return TRANSFORM_LABELS[transform] === answer.value;
  },
};

// ---------------------------------------------------------------------------
// [4수03-05] 이동을 반복해 무늬 꾸미기
// ---------------------------------------------------------------------------

const patternByTransform = {
  id: 'math.g34.gd.s05.pattern',
  standardCode: '[4수03-05]',
  skill: '이동을 반복한 무늬의 규칙 알기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    // 무늬를 직접 꾸미는 활동은 사람이 보고, 여기서는 어떤 이동을 반복했는지만 묻는다.
    const transform = rng.pick(difficulty === 1 ? ['slide'] : ['slide', 'flip-horizontal', 'rotate-90', 'rotate-180']);
    const correct = TRANSFORM_LABELS[transform];
    const wrong = Object.entries(TRANSFORM_LABELS).filter(([k]) => k !== transform).map(([, v]) => v);
    const times = rng.int(4, 8);
    return {
      params: { transform, times },
      instruction: '무늬를 만든 방법을 고르시오.',
      stem: `한 도형을 같은 방법으로 ${times}번 반복해 무늬를 꾸몄습니다. 아래 그림은 그 방법을 한 번 보여 준 것입니다.`,
      figure: {
        kind: 'geometry.symmetry',
        spec: { transform },
        altText: `처음 도형과 ${correct}를 한 결과가 나란히 있다.`,
        prompt: { ko: `흰 배경에 검은 윤곽선으로 그린 계단 모양 도형 두 개. ${correct} 결과를 나란히 보여 준다. 초등 수학 교재용. AR 16:9` },
      },
      choices: buildChoices(rng, correct, rng.shuffle(wrong).slice(0, 3)),
      answer: { value: correct, display: correct, accepts: [correct] },
      solution: [`같은 도형을 ${correct} 방법으로 반복해 무늬를 만들 수 있다.`],
      dedupeKey: `pattern-transform:${transform}:${times}`,
      difficulty,
    };
  },
  verify({ transform }, answer) {
    return TRANSFORM_LABELS[transform] === answer.value;
  },
};

// ---------------------------------------------------------------------------
// [4수03-06] 원의 중심·반지름·지름
// ---------------------------------------------------------------------------

const circleParts = {
  id: 'math.g34.gd.s06.parts',
  capacityNote: '원의 구성 요소는 중심·반지름·지름 셋이 전부다.',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 원의 중심·반지름, 2 이상은 지름까지 구별한다.',
  standardCode: '[4수03-06]',
  skill: '원의 구성 요소 알기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const FACTS = {
      center: { korean: '원의 중심', basis: '원의 한가운데 있는 점이다.' },
      radius: { korean: '반지름', basis: '원의 중심과 원 위의 한 점을 이은 선분이다.' },
      diameter: { korean: '지름', basis: '원의 중심을 지나면서 원 위의 두 점을 이은 선분이다.' },
    };
    const key = rng.pick(difficulty === 1 ? ['center', 'radius'] : Object.keys(FACTS));
    const fact = FACTS[key];
    const wrong = Object.values(FACTS).map((v) => v.korean).filter((v) => v !== fact.korean);
    return {
      params: { key, correct: fact.korean },
      instruction: '설명에 알맞은 것을 고르시오.',
      stem: fact.basis,
      figure: {
        kind: 'geometry.circle',
        spec: { show: key === 'diameter' ? ['center', 'diameter'] : ['center', 'radius'] },
        altText: key === 'diameter' ? '원의 중심을 지나는 선분이 그려진 원.' : '원의 중심과 원 위의 한 점을 이은 선분이 그려진 원.',
        prompt: { ko: '흰 배경에 검은 선으로 그린 원 하나. 중심 점과 선분이 표시되어 있다. 초등 수학 교재용. AR 1:1' },
      },
      choices: buildChoices(rng, fact.korean, [...wrong, '원주']),
      answer: { value: fact.korean, display: fact.korean, accepts: [fact.korean] },
      solution: [`${fact.basis} 이것을 ${fact.korean}이라고 한다.`],
      dedupeKey: `circle-parts:${key}`,
      difficulty,
    };
  },
  verify({ correct }, answer) {
    return answer.value === correct;
  },
};

// ---------------------------------------------------------------------------
// [4수03-07] 반지름과 지름의 관계
// ---------------------------------------------------------------------------

const radiusDiameter = {
  id: 'math.g34.gd.s07.radius-diameter',
  standardCode: '[4수03-07]',
  skill: '반지름과 지름의 관계',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const radius = difficulty === 1 ? rng.int(2, 9) : difficulty === 2 ? rng.int(4, 20) : rng.int(11, 50);
    const diameter = radius * 2;
    const askDiameter = rng.bool();
    return {
      params: { radius, diameter, askDiameter },
      instruction: '□에 알맞은 수를 구하시오.',
      stem: askDiameter
        ? `반지름이 ${radius}cm인 원의 지름은 몇 cm입니까?`
        : `지름이 ${diameter}cm인 원의 반지름은 몇 cm입니까?`,
      figure: {
        kind: 'geometry.circle',
        spec: askDiameter
          ? { show: ['center', 'radius'], radiusLabel: `${radius}cm` }
          : { show: ['center', 'diameter'], diameterLabel: `${diameter}cm` },
        altText: askDiameter ? `반지름이 ${radius}cm로 표시된 원.` : `지름이 ${diameter}cm로 표시된 원.`,
        prompt: { ko: '흰 배경에 검은 선으로 그린 원 하나. 중심 점과 길이가 적힌 선분이 있다. 초등 수학 교재용. AR 1:1' },
      },
      answer: askDiameter
        ? { value: diameter, display: `${diameter}cm`, accepts: [num(diameter), `${diameter}cm`] }
        : { value: radius, display: `${radius}cm`, accepts: [num(radius), `${radius}cm`] },
      solution: [
        '지름은 반지름의 2배다.',
        askDiameter ? `${radius} × 2 = ${diameter}cm` : `${diameter} ÷ 2 = ${radius}cm`,
      ],
      dedupeKey: `radius-diameter:${radius}:${askDiameter ? 'd' : 'r'}`,
      difficulty,
    };
  },
  verify({ radius, diameter, askDiameter }, answer) {
    // 지름 = 반지름 + 반지름 이라는 관계로 되짚는다. 곱셈·나눗셈을 다시 쓰지 않는다.
    if (radius + radius !== diameter) return false;
    return answer.value === (askDiameter ? diameter : radius);
  },
};

// ---------------------------------------------------------------------------
// [4수03-08] 이등변삼각형·정삼각형
// ---------------------------------------------------------------------------

const isoscelesEquilateral = {
  id: 'math.g34.gd.s08.by-sides',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 정삼각형·이등변삼각형, 2 이상은 세 변이 모두 다른 삼각형까지 넣는다.',
  standardCode: '[4수03-08]',
  skill: '변의 길이로 삼각형 분류하기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    // 각이 같으면 마주보는 변이 같다. 각 구성으로 변의 관계를 정한다.
    const kind = rng.pick(difficulty === 1 ? ['equilateral', 'isosceles'] : ['equilateral', 'isosceles', 'scalene']);
    let angles;
    if (kind === 'equilateral') {
      angles = [60, 60, 60];
    } else if (kind === 'isosceles') {
      const base = rng.until(() => rng.int(25, 80), (v) => v !== 60 && 180 - 2 * v > 10);
      angles = [180 - 2 * base, base, base];
    } else {
      const a = rng.int(40, 80);
      const b = rng.until(() => rng.int(40, 100), (v) => v !== a && 180 - a - v > 20 && 180 - a - v !== a && 180 - a - v !== v);
      angles = [a, b, 180 - a - b];
    }
    const NAMES = { equilateral: '정삼각형', isosceles: '이등변삼각형', scalene: '세 변의 길이가 모두 다른 삼각형' };
    const correct = NAMES[kind];
    const wrong = Object.values(NAMES).filter((v) => v !== correct);
    return {
      params: { kind, angles },
      instruction: '알맞은 것을 고르시오.',
      stem: '그림의 삼각형은 어떤 삼각형입니까?',
      figure: {
        kind: 'geometry.triangle',
        spec: { angles, markSides: true },
        altText: `세 각이 ${angles.join('도, ')}도인 삼각형. 길이가 같은 변에 같은 눈금이 있다.`,
        prompt: { ko: `흰 배경에 검은 선으로 그린 삼각형 하나. 세 각이 ${angles.join('도, ')}도이고 길이가 같은 변에 같은 개수의 눈금 표시가 있다. 초등 수학 교재용. AR 1:1` },
      },
      choices: buildChoices(rng, correct, [...wrong, '직각삼각형']),
      answer: { value: correct, display: correct, accepts: [correct] },
      solution: [
        kind === 'equilateral'
          ? '세 각이 모두 60도이므로 세 변의 길이가 모두 같다.'
          : kind === 'isosceles'
            ? `두 각이 ${angles[1]}도로 같으므로 두 변의 길이가 같다.`
            : '세 각의 크기가 모두 달라 세 변의 길이도 모두 다르다.',
        `그러므로 ${correct}이다.`,
      ],
      dedupeKey: `by-sides:${angles.join('-')}`,
      difficulty,
    };
  },
  verify({ kind, angles }, answer) {
    // 각의 중복 개수로 변의 중복 개수를 되짚는다.
    const unique = new Set(angles).size;
    const expected = unique === 1 ? 'equilateral' : unique === 2 ? 'isosceles' : 'scalene';
    const NAMES = { equilateral: '정삼각형', isosceles: '이등변삼각형', scalene: '세 변의 길이가 모두 다른 삼각형' };
    return expected === kind && answer.value === NAMES[expected]
      && angles.reduce((s, v) => s + v, 0) === 180;
  },
};

// ---------------------------------------------------------------------------
// [4수03-09] 예각삼각형·직각삼각형·둔각삼각형
// ---------------------------------------------------------------------------

const triangleByAngles = {
  id: 'math.g34.gd.s09.by-angles',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 직각·둔각삼각형, 2 이상은 예각삼각형까지 구별한다.',
  standardCode: '[4수03-09]',
  skill: '각의 크기로 삼각형 분류하기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const kind = rng.pick(difficulty === 1 ? ['right', 'obtuse'] : ['acute', 'right', 'obtuse']);
    let angles;
    if (kind === 'right') {
      const b = rng.int(25, 65);
      angles = [90, b, 90 - b];
    } else if (kind === 'obtuse') {
      const a = rng.int(100, 140);
      const b = rng.int(15, 180 - a - 15);
      angles = [a, b, 180 - a - b];
    } else {
      // 세 각이 모두 90도보다 작아야 예각삼각형이다.
      angles = rng.until(
        () => {
          const a = rng.int(50, 85);
          const b = rng.int(50, 85);
          return [a, b, 180 - a - b];
        },
        ([a, b, c]) => a < 90 && b < 90 && c < 90 && c >= 20,
      );
    }
    const NAMES = { acute: '예각삼각형', right: '직각삼각형', obtuse: '둔각삼각형' };
    const correct = NAMES[kind];
    return {
      params: { kind, angles },
      instruction: '알맞은 것을 고르시오.',
      stem: '그림의 삼각형은 어떤 삼각형입니까?',
      figure: {
        kind: 'geometry.triangle',
        spec: { angles, labelAngles: true },
        altText: `세 각이 ${angles.join('도, ')}도인 삼각형.`,
        prompt: { ko: `흰 배경에 검은 선으로 그린 삼각형 하나. 세 각이 ${angles.join('도, ')}도이고 각 크기가 적혀 있다. 초등 수학 교재용. AR 1:1` },
      },
      choices: buildChoices(rng, correct, Object.values(NAMES).filter((v) => v !== correct)),
      answer: { value: correct, display: correct, accepts: [correct] },
      solution: [
        kind === 'right'
          ? '한 각이 90도이므로 직각삼각형이다.'
          : kind === 'obtuse'
            ? `한 각이 ${angles[0]}도로 90도보다 크므로 둔각삼각형이다.`
            : '세 각이 모두 90도보다 작으므로 예각삼각형이다.',
      ],
      dedupeKey: `by-angles:${angles.join('-')}`,
      difficulty,
    };
  },
  verify({ kind, angles }, answer) {
    // 가장 큰 각으로 종류를 다시 판정한다.
    const max = Math.max(...angles);
    const expected = max === 90 ? 'right' : max > 90 ? 'obtuse' : 'acute';
    const NAMES = { acute: '예각삼각형', right: '직각삼각형', obtuse: '둔각삼각형' };
    return expected === kind && answer.value === NAMES[expected]
      && angles.reduce((s, v) => s + v, 0) === 180 && angles.every((a) => a > 0);
  },
};

// ---------------------------------------------------------------------------
// [4수03-10] 여러 가지 사각형
// ---------------------------------------------------------------------------

const identifyQuadrilateral = {
  id: 'math.g34.gd.s10.quadrilateral',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도 1은 정사각형·직사각형, 2 이상은 마름모·평행사변형·사다리꼴까지 넣는다.',
  standardCode: '[4수03-10]',
  skill: '여러 가지 사각형 구별하기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const all = Object.keys(QUAD_NAMES);
    const target = rng.pick(difficulty === 1 ? ['square', 'rectangle'] : all);
    const others = rng.shuffle(all.filter((k) => k !== target)).slice(0, 3);
    const kinds = rng.shuffle([target, ...others]);
    const answerMark = MARKS[kinds.indexOf(target)];
    return {
      params: { target, kinds },
      instruction: '알맞은 것을 고르시오.',
      stem: `${QUAD_NAMES[target]}${josaEun(QUAD_NAMES[target])} 어느 것입니까?`,
      figure: {
        kind: 'geometry.quadrilateral',
        spec: { kinds },
        altText: kinds.map((k, i) => `${MARKS[i]} ${QUAD_NAMES[k]}`).join(', ') + '이 차례로 놓여 있다.',
        prompt: { ko: `흰 배경에 검은 윤곽선으로 그린 사각형 ${kinds.length}개가 한 줄로 놓인 도해. 각 도형 아래에 ${MARKS.slice(0, kinds.length).join(', ')} 기호. 초등 수학 교재용. AR 16:9` },
      },
      choices: buildChoices(rng, answerMark, MARKS.filter((m) => m !== answerMark).slice(0, 3)),
      answer: { value: answerMark, display: `${answerMark} (${QUAD_NAMES[target]})`, accepts: [answerMark, QUAD_NAMES[target]] },
      solution: [`${QUAD_NAMES[target]}${josaEun(QUAD_NAMES[target])} ${answerMark}이다.`],
      dedupeKey: `quad:${kinds.join('-')}:${target}`,
      difficulty,
    };
  },
  verify({ target, kinds }, answer) {
    const idx = MARKS.indexOf(answer.value);
    return idx >= 0 && kinds[idx] === target;
  },
};

// ---------------------------------------------------------------------------
// [4수03-11] 다각형과 정다각형
// ---------------------------------------------------------------------------

const POLYGON_NAMES = { 3: '삼각형', 4: '사각형', 5: '오각형', 6: '육각형', 7: '칠각형', 8: '팔각형' };

const namePolygon = {
  id: 'math.g34.gd.s11.name-polygon',
  standardCode: '[4수03-11]',
  skill: '변의 수로 다각형 이름 알기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const sides = difficulty === 1 ? rng.int(3, 5) : difficulty === 2 ? rng.int(5, 6) : rng.int(6, 8);
    const isRegular = rng.bool();
    const name = isRegular ? `정${POLYGON_NAMES[sides]}` : POLYGON_NAMES[sides];
    return {
      params: { sides, isRegular },
      instruction: '도형의 이름을 쓰시오.',
      stem: isRegular
        ? `변이 ${sides}개이고 모든 변의 길이와 모든 각의 크기가 같은 도형의 이름은 무엇입니까?`
        : `변이 ${sides}개인 다각형의 이름은 무엇입니까?`,
      answer: { value: name, display: name, accepts: [name] },
      solution: [
        `변이 ${sides}개인 다각형은 ${POLYGON_NAMES[sides]}이다.`,
        isRegular ? `변의 길이와 각의 크기가 모두 같으면 '정'을 붙여 ${name}이라고 한다.` : `${name}이다.`,
      ],
      dedupeKey: `name-polygon:${sides}:${isRegular ? 'regular' : 'plain'}`,
      difficulty,
    };
  },
  verify({ sides, isRegular }, answer) {
    // 이름표에서 변의 수를 되짚는다.
    const stripped = answer.value.replace(/^정/, '');
    const entry = Object.entries(POLYGON_NAMES).find(([, v]) => v === stripped);
    return Boolean(entry) && Number(entry[0]) === sides
      && answer.value.startsWith('정') === isRegular;
  },
};

// ---------------------------------------------------------------------------
// [4수03-12] 대각선
// ---------------------------------------------------------------------------

const countDiagonals = {
  id: 'math.g34.gd.s12.diagonals',
  capacityNote: '초등에서 다루는 다각형은 사각형부터 팔각형까지 다섯 가지다.',
  standardCode: '[4수03-12]',
  skill: '대각선의 수 세기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const sides = difficulty === 1 ? 4 : difficulty === 2 ? rng.int(5, 6) : rng.int(6, 8);
    // n각형의 대각선 수 = n(n-3)/2
    const count = (sides * (sides - 3)) / 2;
    return {
      params: { sides, count },
      instruction: '대각선은 모두 몇 개입니까?',
      stem: `${POLYGON_NAMES[sides]}에 그을 수 있는 대각선의 수를 구하시오.`,
      figure: {
        kind: 'geometry.grid-area',
        spec: { sides, showDiagonals: true },
        altText: `${POLYGON_NAMES[sides]}에 대각선을 모두 그은 그림. 꼭짓점에 ㄱ부터 차례로 이름이 붙어 있다.`,
        prompt: { ko: `흰 배경에 검은 윤곽선으로 그린 정${POLYGON_NAMES[sides]}. 꼭짓점끼리 잇는 대각선이 회색 점선으로 모두 그려져 있다. 초등 수학 교재용. AR 1:1` },
      },
      answer: { value: count, display: `${count}개`, accepts: [num(count), `${count}개`] },
      solution: [
        '대각선은 이웃하지 않은 두 꼭짓점을 이은 선분이다.',
        `한 꼭짓점에서 ${sides - 3}개씩 그을 수 있고 꼭짓점이 ${sides}개이지만, 같은 선분을 두 번 세므로 2로 나눈다.`,
        `${sides} × ${sides - 3} ÷ 2 = ${count}개`,
      ],
      dedupeKey: `diagonals:${sides}`,
      difficulty,
    };
  },
  verify({ sides }, answer) {
    // 꼭짓점 쌍을 하나씩 세어 되짚는다. 공식을 다시 쓰지 않는다.
    let counted = 0;
    for (let i = 0; i < sides; i += 1) {
      for (let j = i + 1; j < sides; j += 1) {
        const adjacent = j === i + 1 || (i === 0 && j === sides - 1);
        if (!adjacent) counted += 1;
      }
    }
    return counted === answer.value;
  },
};

// ---------------------------------------------------------------------------
// [4수03-24] 각의 크기 재기
// ---------------------------------------------------------------------------

const measureAngle = {
  id: 'math.g34.gd.s24.measure',
  difficultyAxis: 'categorical',
  difficultyNote: '난이도가 오를수록 눈금을 잘게 읽는다(10도 -> 5도 -> 1도 단위).',
  standardCode: '[4수03-24]',
  skill: '각의 크기 읽기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    // 난이도 1은 10도 단위, 2는 5도 단위, 3은 1도 단위로 읽는다.
    const step = difficulty === 1 ? 10 : difficulty === 2 ? 5 : 1;
    const degrees = rng.int(2, 17) * step + (step === 1 ? rng.int(20, 150) : 0);
    const value = Math.min(170, Math.max(15, step === 1 ? degrees % 180 : degrees));
    const wrong = distractors(value, [180 - value, value + 10, value - 10, value + step]);
    return {
      params: { degrees: value },
      instruction: '각의 크기를 고르시오.',
      stem: '',
      figure: {
        kind: 'geometry.angle',
        spec: { degrees: value },
        altText: `한 변이 수평인 ${value}도 각.`,
        prompt: { ko: `흰 배경에 검은 선으로 그린 각 하나. 한 변은 수평이고 각의 크기는 ${value}도다. 꼭짓점에 점이 있고 각 안쪽에 호가 그려져 있다. 초등 수학 교재용. AR 1:1` },
      },
      choices: buildChoices(rng, value, wrong.slice(0, 3)),
      answer: { value, display: `${value}°`, accepts: [num(value), `${value}°`, `${value}도`] },
      solution: [
        '각도기의 중심을 꼭짓점에, 밑금을 한 변에 맞춘다.',
        `다른 변이 가리키는 눈금은 ${value}도다.`,
      ],
      dedupeKey: `measure-angle:${value}`,
      difficulty,
    };
  },
  verify({ degrees }, answer) {
    // 각도는 0도보다 크고 180도보다 작아야 하고 그림의 값과 같아야 한다.
    return answer.value === degrees && degrees > 0 && degrees < 180;
  },
};

// ---------------------------------------------------------------------------
// [4수03-25] 각도의 합과 차, 삼각형·사각형 내각의 합
// ---------------------------------------------------------------------------

const angleSum = {
  id: 'math.g34.gd.s25.angle-sum',
  standardCode: '[4수03-25]',
  skill: '삼각형·사각형의 각의 크기 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const isTriangle = difficulty === 1 ? true : rng.bool();
    const total = isTriangle ? 180 : 360;
    if (isTriangle) {
      const a = rng.int(30, 100);
      const b = rng.int(20, 180 - a - 20);
      const missing = 180 - a - b;
      return {
        params: { known: [a, b], total, missing },
        instruction: '□의 각도를 구하시오.',
        stem: `삼각형의 세 각 중 두 각이 ${a}°, ${b}°입니다. 나머지 한 각은 몇 도입니까?`,
        figure: {
          kind: 'geometry.triangle',
          spec: { angles: [missing, a, b], labelAngles: true },
          altText: `세 각이 ${missing}도, ${a}도, ${b}도인 삼각형.`,
          prompt: { ko: `흰 배경에 검은 선으로 그린 삼각형 하나. 두 각에 ${a}도, ${b}도가 적혀 있다. 초등 수학 교재용. AR 1:1` },
        },
        answer: { value: missing, display: `${missing}°`, accepts: [num(missing), `${missing}°`, `${missing}도`] },
        solution: ['삼각형의 세 각의 크기의 합은 180도다.', `180 - ${a} - ${b} = ${missing}°`],
        dedupeKey: `angle-sum-tri:${a}:${b}`,
        difficulty,
      };
    }
    const a = rng.int(50, 120);
    const b = rng.int(50, 120);
    const c = rng.int(40, 360 - a - b - 40);
    const missing = 360 - a - b - c;
    return {
      params: { known: [a, b, c], total, missing },
      instruction: '□의 각도를 구하시오.',
      stem: `사각형의 네 각 중 세 각이 ${a}°, ${b}°, ${c}°입니다. 나머지 한 각은 몇 도입니까?`,
      answer: { value: missing, display: `${missing}°`, accepts: [num(missing), `${missing}°`, `${missing}도`] },
      solution: ['사각형의 네 각의 크기의 합은 360도다.', `360 - ${a} - ${b} - ${c} = ${missing}°`],
      dedupeKey: `angle-sum-quad:${a}:${b}:${c}`,
      difficulty,
    };
  },
  verify({ known, total }, answer) {
    // 답을 더해 내각의 합이 되는지 확인한다.
    let sum = answer.value;
    for (const k of known) sum += k;
    return sum === total && answer.value > 0 && answer.value < total;
  },
};

// ---------------------------------------------------------------------------
// [4수04-01~03] 자료의 수집과 정리, 막대그래프
// ---------------------------------------------------------------------------

const SURVEYS = [
  { topic: '좋아하는 과일', categories: ['사과', '포도', '배', '귤'], unit: '명' },
  { topic: '좋아하는 운동', categories: ['축구', '농구', '수영', '야구'], unit: '명' },
  { topic: '반별 학생 수', categories: ['1반', '2반', '3반', '4반'], unit: '명' },
  { topic: '요일별 방문자 수', categories: ['월', '화', '수', '목'], unit: '명' },
  { topic: '좋아하는 색깔', categories: ['빨강', '파랑', '노랑', '초록'], unit: '명' },
];

function pickSurvey(rng, difficulty) {
  const survey = rng.pick(SURVEYS);
  const step = difficulty === 1 ? 1 : difficulty === 2 ? rng.pick([1, 2]) : rng.pick([2, 5]);
  const counts = survey.categories.map(() => rng.int(1, difficulty === 1 ? 8 : 10) * step);
  return { ...survey, counts, step };
}

const collectTally = {
  id: 'math.g34.gd.s04-01.collect',
  standardCode: '[4수04-01]',
  skill: '자료를 표로 정리하고 합계 구하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const s = pickSurvey(rng, difficulty);
    const total = s.counts.reduce((acc, v) => acc + v, 0);
    return {
      params: { counts: s.counts },
      instruction: '표를 보고 물음에 답하시오.',
      stem: `조사에 참여한 학생은 모두 몇 ${s.unit}입니까?`,
      figure: {
        kind: 'data.table',
        spec: { headers: s.categories, values: s.counts, headerLabel: s.topic, valueLabel: `수(${s.unit})` },
        altText: `${s.topic}을 조사한 표. ${s.categories.map((c, i) => `${c} ${s.counts[i]}`).join(', ')}.`,
        prompt: { ko: `흰 배경에 검은 선으로 그린 2행 표. 머리글은 ${s.categories.join(', ')}, 값은 ${s.counts.join(', ')}. 초등 수학 교재용. AR 16:9` },
      },
      answer: { value: total, display: `${total}${s.unit}`, accepts: [num(total), `${total}${s.unit}`] },
      solution: [`${s.counts.join(' + ')} = ${total}${s.unit}`],
      dedupeKey: `collect:${s.topic}:${s.counts.join('-')}`,
      difficulty,
    };
  },
  verify({ counts }, answer) {
    let running = 0;
    for (const v of counts) running += v;
    return running === answer.value;
  },
};

const readBarGraphValue = {
  id: 'math.g34.gd.s04-02.read-bar',
  standardCode: '[4수04-02]',
  skill: '막대그래프에서 값 읽기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const s = pickSurvey(rng, difficulty);
    const askIndex = rng.int(0, s.categories.length - 1);
    const value = s.counts[askIndex];
    return {
      params: { counts: s.counts, askIndex, step: s.step },
      instruction: '막대그래프를 보고 물음에 답하시오.',
      stem: `${s.categories[askIndex]}${josaEun(s.categories[askIndex])} 몇 ${s.unit}입니까?`,
      figure: {
        kind: 'data.bar-graph',
        spec: { categories: s.categories, counts: s.counts, step: s.step, unitLabel: `(${s.unit})` },
        altText: `${s.topic} 막대그래프. 세로축 한 칸은 ${s.step}${s.unit}이고 ${s.categories.map((c, i) => `${c} ${s.counts[i]}`).join(', ')}이다.`,
        prompt: { ko: `흰 배경에 검은 선으로 그린 막대그래프. 가로축에 ${s.categories.join(', ')}, 세로축 한 칸은 ${s.step}. 막대 높이는 ${s.counts.join(', ')}. 초등 수학 교재용. AR 16:9` },
      },
      answer: { value, display: `${value}${s.unit}`, accepts: [num(value), `${value}${s.unit}`] },
      solution: [
        `세로축 한 칸은 ${s.step}${s.unit}이다.`,
        `${s.categories[askIndex]} 막대는 ${value}${s.unit}까지 올라가 있다.`,
      ],
      dedupeKey: `read-bar:${s.topic}:${s.counts.join('-')}:${askIndex}`,
      difficulty,
    };
  },
  verify({ counts, askIndex, step }, answer) {
    // 눈금 간격의 배수여야 그래프에서 읽을 수 있는 값이다.
    return answer.value === counts[askIndex] && answer.value % step === 0;
  },
};

const interpretBarGraph = {
  id: 'math.g34.gd.s04-03.interpret-bar',
  standardCode: '[4수04-03]',
  skill: '막대그래프 해석하기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const s = pickSurvey(rng, difficulty);
    const mode = difficulty === 1 ? 'most' : rng.pick(['most', 'least', 'diff']);
    const max = Math.max(...s.counts);
    const min = Math.min(...s.counts);
    const maxIdx = s.counts.indexOf(max);
    const minIdx = s.counts.indexOf(min);
    const most = s.categories.filter((_, idx) => s.counts[idx] === max);
    const least = s.categories.filter((_, idx) => s.counts[idx] === min);

    const spec = {
      most: {
        stem: '가장 많은 것은 무엇입니까?',
        value: s.categories[maxIdx],
        display: s.categories[maxIdx],
        accepts: most,
        solution: [`막대가 가장 높은 것은 ${most.join(', ')}이다.`],
      },
      least: {
        stem: '가장 적은 것은 무엇입니까?',
        value: s.categories[minIdx],
        display: s.categories[minIdx],
        accepts: least,
        solution: [`막대가 가장 낮은 것은 ${least.join(', ')}이다.`],
      },
      diff: {
        stem: `가장 많은 것과 가장 적은 것의 차는 몇 ${s.unit}입니까?`,
        value: s.counts[maxIdx] - s.counts[minIdx],
        display: `${s.counts[maxIdx] - s.counts[minIdx]}${s.unit}`,
        accepts: [String(s.counts[maxIdx] - s.counts[minIdx]), `${s.counts[maxIdx] - s.counts[minIdx]}${s.unit}`],
        solution: [
          `가장 많은 것은 ${s.counts[maxIdx]}${s.unit}, 가장 적은 것은 ${s.counts[minIdx]}${s.unit}이다.`,
          `${s.counts[maxIdx]} - ${s.counts[minIdx]} = ${s.counts[maxIdx] - s.counts[minIdx]}${s.unit}`,
        ],
      },
    }[mode];

    return {
      params: { counts: s.counts, categories: s.categories, mode },
      instruction: '막대그래프를 보고 물음에 답하시오.',
      stem: spec.stem,
      figure: {
        kind: 'data.bar-graph',
        spec: { categories: s.categories, counts: s.counts, step: s.step, unitLabel: `(${s.unit})` },
        altText: `${s.topic} 막대그래프. ${s.categories.map((c, i) => `${c} ${s.counts[i]}`).join(', ')}.`,
        prompt: { ko: `흰 배경에 검은 선으로 그린 막대그래프. 가로축에 ${s.categories.join(', ')}, 막대 높이는 ${s.counts.join(', ')}. 초등 수학 교재용. AR 16:9` },
      },
      answer: { value: spec.value, display: spec.display, accepts: spec.accepts },
      solution: spec.solution,
      dedupeKey: `interpret-bar:${s.topic}:${s.counts.join('-')}:${mode}`,
      difficulty,
    };
  },
  verify({ counts, categories, mode }, answer) {
    if (mode === 'most') {
      const idx = categories.indexOf(answer.value);
      return idx >= 0 && counts.every((v) => counts[idx] >= v);
    }
    if (mode === 'least') {
      const idx = categories.indexOf(answer.value);
      return idx >= 0 && counts.every((v) => counts[idx] <= v);
    }
    const sorted = [...counts].sort((a, b) => a - b);
    return sorted.at(-1) - sorted[0] === answer.value;
  },
};

export const generators = [
  identifyLine,
  identifyRightAngle,
  rightAngleFigures,
  identifyTransform,
  patternByTransform,
  circleParts,
  radiusDiameter,
  isoscelesEquilateral,
  triangleByAngles,
  identifyQuadrilateral,
  namePolygon,
  countDiagonals,
  measureAngle,
  angleSum,
  collectTally,
  readBarGraphValue,
  interpretBarGraph,
];
