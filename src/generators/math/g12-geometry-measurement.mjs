/**
 * 2022 개정 초등 수학 1~2학년군 '도형과 측정' 문항 생성기.
 *
 * 그림이 필요한 문항은 figure 로 결정적 spec 을 싣는다. SVG 는 그 spec 에서
 * 정확히 재현되고, 같은 spec 에서 정답도 나오므로 그림과 답이 어긋날 수 없다.
 */
import { buildChoices } from '../../engine/item.mjs';
import { josaEun, josaI, numEun } from '../../engine/korean-number.mjs';

const CODE = (n) => `[2수03-${String(n).padStart(2, '0')}]`;
const num = (n) => String(n);

function distractors(correct, candidates) {
  const out = [];
  for (const c of candidates) {
    if (c === correct || out.includes(c)) continue;
    out.push(c);
  }
  return out;
}

// ---------------------------------------------------------------------------
// [2수03-05] 삼각형·사각형의 공통점, 오각형·육각형 구별
// ---------------------------------------------------------------------------

const SHAPE_NAMES = {
  triangle: '삼각형',
  quadrilateral: '사각형',
  pentagon: '오각형',
  hexagon: '육각형',
  circle: '원',
};
const SIDE_COUNT = { triangle: 3, quadrilateral: 4, pentagon: 5, hexagon: 6 };

const identifyPolygon = {
  id: 'math.g12.gm.s05.identify',
  standardCode: CODE(5),
  skill: '변의 수로 다각형 이름 찾기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const pool = difficulty === 1
      ? ['triangle', 'quadrilateral']
      : difficulty === 2
        ? ['triangle', 'quadrilateral', 'pentagon']
        : ['triangle', 'quadrilateral', 'pentagon', 'hexagon'];
    const target = rng.pick(pool);
    const others = rng.shuffle(Object.keys(SHAPE_NAMES).filter((s) => s !== target)).slice(0, 3);
    const shapes = rng.shuffle([target, ...others]);
    const marks = ['㉠', '㉡', '㉢', '㉣'];
    const answerMark = marks[shapes.indexOf(target)];

    return {
      params: { target, shapes },
      instruction: '알맞은 것을 고르시오.',
      stem: `${SHAPE_NAMES[target]}${josaEun(SHAPE_NAMES[target])} 어느 것입니까?`,
      figure: {
        kind: 'geometry.plane-shape',
        spec: { shapes },
        altText: `${shapes.map((s, idx) => `${marks[idx]} ${SHAPE_NAMES[s]}`).join(', ')}이 차례로 놓여 있다.`,
        prompt: { ko: `흰 배경에 검은 윤곽선만으로 그린 평면도형 ${shapes.length}개가 한 줄로 놓인 초등 수학 교재용 도해. 각 도형 아래에 ${marks.slice(0, shapes.length).join(', ')} 기호. AR 16:9` },
      },
      choices: buildChoices(rng, answerMark, marks.filter((m) => m !== answerMark).slice(0, 3)),
      answer: { value: answerMark, display: `${answerMark} (${SHAPE_NAMES[target]})`, accepts: [answerMark, SHAPE_NAMES[target]] },
      solution: [
        `${SHAPE_NAMES[target]}${josaEun(SHAPE_NAMES[target])} 변이 ${SIDE_COUNT[target] ?? 0}개인 도형이다.`,
        `변을 세어 보면 ${answerMark}이 ${SHAPE_NAMES[target]}이다.`,
      ],
      dedupeKey: `identify-polygon:${shapes.join('-')}:${target}`,
      difficulty,
    };
  },
  verify({ target, shapes }, answer) {
    // 정답 기호가 가리키는 도형이 실제로 목표 도형인지 되짚는다.
    const marks = ['㉠', '㉡', '㉢', '㉣'];
    const idx = marks.indexOf(answer.value);
    return idx >= 0 && shapes[idx] === target;
  },
};

const countSides = {
  id: 'math.g12.gm.s05.count-sides',
  standardCode: CODE(5),
  skill: '다각형의 변과 꼭짓점 수 세기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const shape = rng.pick(difficulty === 1 ? ['triangle', 'quadrilateral'] : ['triangle', 'quadrilateral', 'pentagon', 'hexagon']);
    const askVertices = rng.bool();
    const n = SIDE_COUNT[shape];
    const what = askVertices ? '꼭짓점' : '변';
    return {
      params: { shape, askVertices },
      instruction: '물음에 답하시오.',
      stem: `그림의 도형에서 ${what}${josaEun(what)} 몇 개입니까?`,
      figure: {
        kind: 'geometry.plane-shape',
        spec: { shape, labelVertices: askVertices },
        altText: `${SHAPE_NAMES[shape]} 한 개가 그려져 있다.`,
        prompt: { ko: `흰 배경에 검은 윤곽선만으로 그린 ${SHAPE_NAMES[shape]} 한 개. 초등 수학 교재용 단순 도해. AR 1:1` },
      },
      answer: { value: n, display: `${n}개`, accepts: [num(n), `${n}개`] },
      solution: [
        `${SHAPE_NAMES[shape]}${josaEun(SHAPE_NAMES[shape])} 변이 ${n}개, 꼭짓점이 ${n}개인 도형이다.`,
        `${what}${josaEun(what)} ${n}개이다.`,
      ],
      dedupeKey: `count-sides:${shape}:${askVertices ? 'v' : 's'}`,
      difficulty,
    };
  },
  verify({ shape }, answer) {
    // 다각형은 변의 수와 꼭짓점의 수가 같다는 불변식으로 확인한다.
    return answer.value === SIDE_COUNT[shape] && answer.value >= 3;
  },
};

// ---------------------------------------------------------------------------
// [2수03-07] 시계를 보고 몇 시 몇 분까지 읽기
// ---------------------------------------------------------------------------

const readClock = {
  id: 'math.g12.gm.s07.read-clock',
  standardCode: CODE(7),
  skill: '시계를 보고 시각 읽기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const hour = rng.int(1, 12);
    // 난이도 1은 정시·30분, 2는 5분 단위, 3은 1분 단위까지 읽는다.
    const minute = difficulty === 1
      ? rng.pick([0, 30])
      : difficulty === 2
        ? rng.int(1, 11) * 5
        : rng.until(() => rng.int(1, 59), (v) => v % 5 !== 0);
    const display = `${hour}시 ${minute}분`;
    return {
      params: { hour, minute },
      instruction: '시계를 보고 몇 시 몇 분인지 쓰시오.',
      stem: '',
      figure: {
        kind: 'measure.clock',
        spec: { hour, minute },
        altText: `시침이 ${hour}시를 지나고 분침이 ${minute}분을 가리키는 아날로그 시계.`,
        prompt: { ko: `흰 배경에 검은 선으로 그린 아날로그 시계 하나. 1부터 12까지 숫자와 60개 눈금이 있고 시침은 짧고 굵게, 분침은 길고 얇게. 초등 수학 교재용 단순 도해. AR 1:1` },
      },
      answer: {
        value: hour * 60 + minute,
        display,
        accepts: [display, `${hour}시${minute}분`, `${hour}:${String(minute).padStart(2, '0')}`],
      },
      solution: [
        `짧은바늘이 ${hour}와 ${hour === 12 ? 1 : hour + 1} 사이에 있으므로 ${hour}시이다.`,
        minute === 0 ? '긴바늘이 12를 가리키므로 0분이다.' : `긴바늘이 ${minute}분을 가리킨다.`,
        `${display}이다.`,
      ],
      dedupeKey: `read-clock:${hour}:${minute}`,
      difficulty,
    };
  },
  verify({ hour, minute }, answer) {
    // 총 분으로 환산한 값에서 시와 분을 되짚는다.
    const total = answer.value;
    return Math.floor(total / 60) === hour && total % 60 === minute && minute >= 0 && minute < 60;
  },
};

// ---------------------------------------------------------------------------
// [2수03-08] 1시간은 60분
// ---------------------------------------------------------------------------

const hourMinuteConvert = {
  id: 'math.g12.gm.s08.convert',
  standardCode: CODE(8),
  skill: '시간과 분 단위 바꾸기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    const toMinutes = rng.bool();
    const hours = difficulty === 1 ? 1 : rng.int(1, 3);
    const extra = difficulty === 1 ? 0 : rng.int(1, 11) * 5;
    const totalMinutes = hours * 60 + extra;

    if (toMinutes) {
      const label = extra === 0 ? `${hours}시간` : `${hours}시간 ${extra}분`;
      return {
        params: { hours, extra, totalMinutes, direction: 'to-minutes' },
        instruction: '□에 알맞은 수를 써넣으시오.',
        stem: `${label} = □분`,
        answer: { value: totalMinutes, display: `${totalMinutes}분`, accepts: [num(totalMinutes), `${totalMinutes}분`] },
        solution: [`1시간은 60분이므로 ${hours}시간은 ${hours * 60}분이다.`, extra === 0 ? `${hours * 60}분이다.` : `${hours * 60} + ${extra} = ${totalMinutes}분이다.`],
        dedupeKey: `convert-to-min:${hours}:${extra}`,
        difficulty,
      };
    }
    const label = extra === 0 ? `${hours}시간` : `${hours}시간 ${extra}분`;
    return {
      params: { hours, extra, totalMinutes, direction: 'to-hours' },
      instruction: '□에 알맞은 수를 써넣으시오.',
      stem: `${totalMinutes}분 = ${hours}시간 □분`,
      answer: { value: extra, display: `${extra}분`, accepts: [num(extra), `${extra}분`] },
      solution: [`1시간은 60분이므로 ${hours}시간은 ${hours * 60}분이다.`, `${totalMinutes} - ${hours * 60} = ${extra}분이다.`, `${totalMinutes}분은 ${label}이다.`],
      dedupeKey: `convert-to-hour:${hours}:${extra}`,
      difficulty,
    };
  },
  verify({ hours, totalMinutes, direction }, answer) {
    // 60진 자리 분해로 되짚는다. 답에서 시·분을 다시 뽑아 원래 총 분과 맞는지 본다.
    if (direction === 'to-minutes') {
      return Math.floor(answer.value / 60) === hours && answer.value % 60 === totalMinutes % 60;
    }
    return hours * 60 + answer.value === totalMinutes && answer.value >= 0 && answer.value < 60;
  },
};

// ---------------------------------------------------------------------------
// [2수03-09] 1일 24시간, 1주일 7일, 1년 12개월
// ---------------------------------------------------------------------------

const CALENDAR_FACTS = [
  { question: '1일은 몇 시간입니까?', value: 24, unit: '시간', basis: '1일은 24시간이다.' },
  { question: '1주일은 몇 일입니까?', value: 7, unit: '일', basis: '1주일은 7일이다.' },
  { question: '1년은 몇 개월입니까?', value: 12, unit: '개월', basis: '1년은 12개월이다.' },
];

const calendarUnits = {
  id: 'math.g12.gm.s09.calendar',
  standardCode: CODE(9),
  skill: '날짜 단위 관계 알기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const fact = rng.pick(CALENDAR_FACTS);
    // 난이도 2 이상은 배수로 확장한다: 3주일은 몇 일인가
    const multiple = difficulty === 1 ? 1 : rng.int(2, difficulty === 2 ? 4 : 9);
    const total = fact.value * multiple;
    const subject = multiple === 1
      ? fact.question
      : fact.question.replace(/^1/, String(multiple));
    return {
      params: { base: fact.value, multiple },
      instruction: '물음에 답하시오.',
      stem: subject,
      answer: { value: total, display: `${total}${fact.unit}`, accepts: [num(total), `${total}${fact.unit}`] },
      solution: multiple === 1
        ? [fact.basis]
        : [fact.basis, `${fact.value} × ${multiple} = ${total}${fact.unit}이다.`],
      dedupeKey: `calendar:${fact.value}:${multiple}`,
      difficulty,
    };
  },
  verify({ base, multiple }, answer) {
    // 나눗셈으로 되짚는다.
    return answer.value % base === 0 && answer.value / base === multiple;
  },
};

// ---------------------------------------------------------------------------
// [2수03-11] 1m = 100cm, 단명수와 복명수
// ---------------------------------------------------------------------------

const meterCentimeter = {
  id: 'math.g12.gm.s11.m-cm',
  standardCode: CODE(11),
  skill: 'm와 cm 단위 바꾸기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    const meters = rng.int(1, difficulty === 1 ? 5 : 9);
    const centimeters = difficulty === 1 ? 0 : rng.int(1, 99);
    const total = meters * 100 + centimeters;
    const toCm = rng.bool();
    const compound = centimeters === 0 ? `${meters}m` : `${meters}m ${centimeters}cm`;

    if (toCm) {
      return {
        params: { meters, centimeters, total, direction: 'to-cm' },
        instruction: '□에 알맞은 수를 써넣으시오.',
        stem: `${compound} = □cm`,
        answer: { value: total, display: `${total}cm`, accepts: [num(total), `${total}cm`] },
        solution: [`1m는 100cm이므로 ${meters}m는 ${meters * 100}cm이다.`, centimeters === 0 ? `${total}cm이다.` : `${meters * 100} + ${centimeters} = ${total}cm이다.`],
        dedupeKey: `m-to-cm:${meters}:${centimeters}`,
        difficulty,
      };
    }
    return {
      params: { meters, centimeters, total, direction: 'to-compound' },
      instruction: '□에 알맞은 수를 써넣으시오.',
      stem: `${total}cm = ${meters}m □cm`,
      answer: { value: centimeters, display: `${centimeters}cm`, accepts: [num(centimeters), `${centimeters}cm`] },
      solution: [`100cm가 1m이므로 ${total}cm에서 ${meters}m는 ${meters * 100}cm이다.`, `${total} - ${meters * 100} = ${centimeters}cm이다.`],
      dedupeKey: `cm-to-m:${meters}:${centimeters}`,
      difficulty,
    };
  },
  verify({ meters, centimeters, total, direction }, answer) {
    // 답을 100으로 자리 분해해서 m와 cm를 다시 뽑아 원래 값과 맞는지 본다.
    if (direction === 'to-cm') {
      return Math.floor(answer.value / 100) === meters && answer.value % 100 === centimeters;
    }
    return meters * 100 + answer.value === total && answer.value >= 0 && answer.value < 100;
  },
};

// ---------------------------------------------------------------------------
// [2수03-12] 자로 길이 재기
// ---------------------------------------------------------------------------

const readRuler = {
  id: 'math.g12.gm.s12.read-ruler',
  standardCode: CODE(12),
  skill: '자를 보고 물건의 길이 재기',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const maxCm = difficulty === 1 ? 10 : 15;
    // 난이도 1은 0에서 시작해 바로 읽고, 2 이상은 시작점이 0이 아니라 뺄셈이 필요하다.
    const startCm = difficulty === 1 ? 0 : rng.int(1, 4);
    const objectCm = rng.int(2, maxCm - startCm);
    const endCm = startCm + objectCm;
    return {
      params: { startCm, endCm, objectCm },
      instruction: '물건의 길이는 몇 cm입니까?',
      stem: '',
      figure: {
        kind: 'measure.length',
        spec: { maxCm, objectCm, startCm },
        altText: `0부터 ${maxCm}까지 눈금이 있는 자 위에, ${startCm}cm 지점에서 시작해 ${endCm}cm 지점에서 끝나는 막대가 놓여 있다.`,
        prompt: { ko: `흰 배경에 검은 선으로 그린 눈금자 도해. 0부터 ${maxCm}까지 1cm 눈금과 숫자가 있고, 자 위에 회색 막대가 ${startCm}에서 ${endCm}까지 놓여 있다. 초등 수학 교재용. AR 16:9` },
      },
      answer: { value: objectCm, display: `${objectCm}cm`, accepts: [num(objectCm), `${objectCm}cm`] },
      solution: startCm === 0
        ? [`막대가 0에서 시작해 ${endCm}에서 끝난다.`, `길이는 ${objectCm}cm이다.`]
        : [`막대가 ${startCm}에서 시작해 ${endCm}에서 끝난다.`, `${endCm} - ${startCm} = ${objectCm}cm이다.`],
      dedupeKey: `read-ruler:${startCm}:${endCm}`,
      difficulty,
    };
  },
  verify({ startCm, endCm }, answer) {
    // 자 눈금의 차로 되짚는다.
    return startCm + answer.value === endCm && answer.value > 0;
  },
};

// ---------------------------------------------------------------------------
// [2수03-10] 길이 단위의 필요성과 적절한 단위 선택
// ---------------------------------------------------------------------------

const LENGTH_CONTEXTS = [
  { thing: '연필의 길이', unit: 'cm' },
  { thing: '지우개의 길이', unit: 'cm' },
  { thing: '책의 긴 쪽 길이', unit: 'cm' },
  { thing: '숟가락의 길이', unit: 'cm' },
  { thing: '교실 문의 높이', unit: 'm' },
  { thing: '운동장의 긴 쪽 길이', unit: 'm' },
  { thing: '칠판의 긴 쪽 길이', unit: 'm' },
  { thing: '버스의 길이', unit: 'm' },
];

const chooseLengthUnit = {
  id: 'math.g12.gm.s10.choose-unit',
  standardCode: CODE(10),
  skill: '상황에 알맞은 길이 단위 고르기',
  format: 'multiple-choice',
  generate(rng, { difficulty }) {
    const context = rng.pick(LENGTH_CONTEXTS);
    const wrong = context.unit === 'cm' ? ['m', 'kg', '분'] : ['cm', 'kg', '분'];
    return {
      params: { thing: context.thing, unit: context.unit },
      instruction: '재기에 알맞은 단위를 고르시오.',
      stem: `${context.thing}${josaI(context.thing)} 재기에 알맞은 단위는 무엇입니까?`,
      choices: buildChoices(rng, context.unit, distractors(context.unit, wrong).slice(0, 3)),
      answer: { value: context.unit, display: context.unit, accepts: [context.unit] },
      solution: [
        context.unit === 'cm'
          ? `${context.thing}${josaEun(context.thing)} 짧으므로 cm로 재는 것이 알맞다.`
          : `${context.thing}${josaEun(context.thing)} 길므로 m로 재는 것이 알맞다.`,
      ],
      dedupeKey: `choose-unit:${context.thing}`,
      difficulty,
    };
  },
  verify({ unit }, answer) {
    // 길이 단위만 정답이 될 수 있다는 불변식
    return answer.value === unit && ['cm', 'm'].includes(answer.value);
  },
};

export const generators = [
  identifyPolygon,
  countSides,
  readClock,
  hourMinuteConvert,
  calendarUnits,
  meterCentimeter,
  readRuler,
  chooseLengthUnit,
];
