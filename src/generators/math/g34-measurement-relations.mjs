/**
 * 2022 개정 초등 수학 3~4학년군
 *   '변화와 관계' [4수02-01~03]
 *   '도형과 측정' 중 시각과 시간 [4수03-13~14], 길이 [4수03-15~16],
 *   들이 [4수03-17~19], 무게 [4수03-20~23]
 *
 * 단위 계산은 기준 단위 정수값으로만 처리한다(curriculum/units.mjs).
 */
import { buildChoices } from '../../engine/item.mjs';
import { josaEul, josaEun, josaI, numEun, numEul, sinoKorean } from '../../engine/korean-number.mjs';
import { UNIT_SYSTEMS, formatCompound, formatCompoundPair, ratioBetween, unitOf } from '../../curriculum/units.mjs';

const num = (n) => String(n);

function distractors(correct, candidates) {
  const out = [];
  for (const c of candidates) {
    if (c === correct || out.includes(c) || !Number.isFinite(c) || c <= 0) continue;
    out.push(c);
  }
  return out;
}

// ---------------------------------------------------------------------------
// [4수02-01] 규칙을 수나 식으로 나타내기
// ---------------------------------------------------------------------------

const ruleAsExpression = {
  id: 'math.g34.mr.s02-01.rule-expression',
  standardCode: '[4수02-01]',
  skill: '배열의 규칙을 식으로 나타내기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    // 도형 배열에서 순서와 개수의 관계를 찾는 문항이다. n번째 = start + step*(n-1)
    const step = difficulty === 1 ? rng.int(2, 4) : difficulty === 2 ? rng.int(3, 7) : rng.int(4, 12);
    const start = difficulty === 1 ? step : rng.int(1, 9);
    const shown = [1, 2, 3, 4].map((k) => start + step * (k - 1));
    const askIndex = difficulty === 1 ? 5 : rng.int(6, 12);
    const answer = start + step * (askIndex - 1);
    return {
      params: { start, step, askIndex },
      instruction: '규칙을 찾아 □에 알맞은 수를 구하시오.',
      stem: `첫째 ${shown[0]}개, 둘째 ${shown[1]}개, 셋째 ${shown[2]}개, 넷째 ${shown[3]}개로 늘어놓았습니다.`
        + ` 같은 규칙으로 놓으면 ${askIndex}째는 □개입니다.`,
      answer: { value: answer, display: `${answer}개`, accepts: [num(answer), `${answer}개`] },
      solution: [
        `${step}개씩 늘어나는 규칙이다.`,
        `${askIndex}째 = ${start} + ${step} × ${askIndex - 1} = ${answer}`,
      ],
      dedupeKey: `rule-expr:${start}:${step}:${askIndex}`,
      difficulty,
    };
  },
  verify({ start, step, askIndex }, answer) {
    // 반복 덧셈으로 재구성한다.
    let value = start;
    for (let k = 1; k < askIndex; k += 1) value += step;
    return value === answer.value;
  },
};

// ---------------------------------------------------------------------------
// [4수02-02] 계산식의 배열에서 규칙 찾기
// ---------------------------------------------------------------------------

const calculationPattern = {
  id: 'math.g34.mr.s02-02.calc-pattern',
  standardCode: '[4수02-02]',
  skill: '계산식 배열의 규칙으로 결과 추측하기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    const kind = rng.pick(difficulty === 1 ? ['sum-shift'] : ['sum-shift', 'diff-constant', 'multiply-ten']);

    if (kind === 'sum-shift') {
      // 100 + 200 = 300 / 200 + 300 = 500 ... 한쪽이 커지면 합도 같은 만큼 커진다
      const unit = difficulty === 1 ? 100 : rng.pick([10, 100, 1000]);
      const a = rng.int(1, 4) * unit;
      const b = rng.int(1, 4) * unit;
      const rows = [0, 1, 2].map((k) => ({ x: a + unit * k, y: b + unit * k }));
      const nextRow = { x: a + unit * 3, y: b + unit * 3 };
      const answer = nextRow.x + nextRow.y;
      return {
        params: { rows: rows.map((r) => r.x + r.y), answer, delta: unit * 2 },
        instruction: '규칙을 찾아 □에 알맞은 수를 구하시오.',
        stem: `${rows.map((r) => `${r.x} + ${r.y} = ${r.x + r.y}`).join('\n    ')}\n    ${nextRow.x} + ${nextRow.y} = □`,
        answer: { value: answer, display: num(answer), accepts: [num(answer)] },
        solution: [
          `두 수가 각각 ${unit}씩 커지므로 합은 ${unit * 2}씩 커진다.`,
          `${rows.at(-1).x + rows.at(-1).y} + ${unit * 2} = ${answer}`,
        ],
        dedupeKey: `calc-sum-shift:${a}:${b}:${unit}`,
        difficulty,
      };
    }

    if (kind === 'diff-constant') {
      // 두 수가 같이 커지면 차는 그대로다
      const unit = rng.pick([10, 100]);
      const gap = rng.int(1, 5) * unit;
      const start = rng.int(2, 6) * unit;
      const rows = [0, 1, 2].map((k) => ({ x: start + gap + unit * k, y: start + unit * k }));
      const nextRow = { x: start + gap + unit * 3, y: start + unit * 3 };
      const answer = gap;
      return {
        params: { rows: rows.map((r) => r.x - r.y), answer, delta: 0 },
        instruction: '규칙을 찾아 □에 알맞은 수를 구하시오.',
        stem: `${rows.map((r) => `${r.x} - ${r.y} = ${r.x - r.y}`).join('\n    ')}\n    ${nextRow.x} - ${nextRow.y} = □`,
        answer: { value: answer, display: num(answer), accepts: [num(answer)] },
        solution: [
          `두 수가 함께 ${unit}씩 커지므로 차는 변하지 않는다.`,
          `차는 계속 ${answer}이다.`,
        ],
        dedupeKey: `calc-diff-constant:${start}:${gap}:${unit}`,
        difficulty,
      };
    }

    // 10배 규칙: 3 × 10 = 30, 3 × 100 = 300 ...
    const a = rng.int(2, 9);
    const rows = [1, 2, 3].map((k) => ({ x: a, y: 10 ** k }));
    const nextRow = { x: a, y: 10 ** 4 };
    const answer = nextRow.x * nextRow.y;
    return {
      params: { rows: rows.map((r) => r.x * r.y), answer, delta: null, a },
      instruction: '규칙을 찾아 □에 알맞은 수를 구하시오.',
      stem: `${rows.map((r) => `${r.x} × ${r.y} = ${r.x * r.y}`).join('\n    ')}\n    ${nextRow.x} × ${nextRow.y} = □`,
      answer: { value: answer, display: num(answer), accepts: [num(answer)] },
      solution: [
        '곱하는 수의 0이 하나 늘어나면 곱의 0도 하나 늘어난다.',
        `${a} × ${10 ** 4} = ${answer}`,
      ],
      dedupeKey: `calc-multiply-ten:${a}`,
      difficulty,
    };
  },
  verify({ rows, answer, delta }, answerObj) {
    if (answerObj.value !== answer) return false;
    // 앞선 세 줄이 실제로 같은 규칙을 이루는지 확인한다.
    if (delta === null) return rows.every((v, idx) => idx === 0 || v === rows[idx - 1] * 10);
    return rows.every((v, idx) => idx === 0 || v - rows[idx - 1] === delta);
  },
};

// ---------------------------------------------------------------------------
// [4수02-03] 등호와 동치 관계
// ---------------------------------------------------------------------------

const equalitySense = {
  id: 'math.g34.mr.s02-03.equality',
  standardCode: '[4수02-03]',
  skill: '등호의 양쪽이 같도록 만들기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    // 등호는 '계산해서 나온 답'이 아니라 '양쪽 크기가 같다'는 뜻임을 재는 문항이다.
    const total = difficulty === 1 ? rng.int(10, 30) : difficulty === 2 ? rng.int(30, 90) : rng.int(100, 400);
    const leftA = rng.int(1, total - 1);
    const leftB = total - leftA;
    const rightA = rng.until(() => rng.int(1, total - 1), (v) => v !== leftA && v !== leftB);
    const rightB = total - rightA;
    const hideRight = rng.bool();
    return {
      params: { total, leftA, leftB, rightA, rightB, hideRight },
      instruction: '등호의 양쪽이 같아지도록 □에 알맞은 수를 써넣으시오.',
      stem: hideRight
        ? `${leftA} + ${leftB} = ${rightA} + □`
        : `${leftA} + □ = ${rightA} + ${rightB}`,
      answer: hideRight
        ? { value: rightB, display: num(rightB), accepts: [num(rightB)] }
        : { value: leftB, display: num(leftB), accepts: [num(leftB)] },
      solution: [
        `왼쪽은 ${leftA} + ${leftB} = ${total}이다.`,
        `등호는 양쪽 크기가 같음을 뜻하므로 오른쪽도 ${total}이 되어야 한다.`,
        hideRight ? `${total} - ${rightA} = ${rightB}` : `${total} - ${leftA} = ${leftB}`,
      ],
      dedupeKey: `equality:${total}:${leftA}:${rightA}:${hideRight ? 'r' : 'l'}`,
      difficulty,
    };
  },
  verify({ total, leftA, rightA, hideRight }, answer) {
    // 답을 넣은 뒤 양쪽 합이 실제로 같은지 확인한다.
    const left = hideRight ? total : leftA + answer.value;
    const right = hideRight ? rightA + answer.value : total;
    return left === right && left === total;
  },
};

// ---------------------------------------------------------------------------
// [4수03-13] 1분 = 60초, 초 단위 시각
// ---------------------------------------------------------------------------

const minuteSecond = {
  id: 'math.g34.mr.s03-13.minute-second',
  standardCode: '[4수03-13]',
  skill: '분과 초 단위 바꾸기',
  format: 'fill-blank',
  generate(rng, { difficulty }) {
    const minutes = difficulty === 1 ? 1 : rng.int(1, 9);
    const seconds = difficulty === 1 ? 0 : rng.int(1, 59);
    const totalSeconds = minutes * 60 + seconds;
    const toSeconds = rng.bool();
    const compound = seconds === 0 ? `${minutes}분` : `${minutes}분 ${seconds}초`;

    if (toSeconds) {
      return {
        params: { minutes, seconds, totalSeconds, direction: 'to-seconds' },
        instruction: '□에 알맞은 수를 써넣으시오.',
        stem: `${compound} = □초`,
        answer: { value: totalSeconds, display: `${totalSeconds}초`, accepts: [num(totalSeconds), `${totalSeconds}초`] },
        solution: [`1분은 60초이므로 ${minutes}분은 ${minutes * 60}초다.`, seconds === 0 ? `${totalSeconds}초다.` : `${minutes * 60} + ${seconds} = ${totalSeconds}초다.`],
        dedupeKey: `min-to-sec:${minutes}:${seconds}`,
        difficulty,
      };
    }
    return {
      params: { minutes, seconds, totalSeconds, direction: 'to-compound' },
      instruction: '□에 알맞은 수를 써넣으시오.',
      stem: `${totalSeconds}초 = ${minutes}분 □초`,
      answer: { value: seconds, display: `${seconds}초`, accepts: [num(seconds), `${seconds}초`] },
      solution: [`${minutes}분은 ${minutes * 60}초다.`, `${totalSeconds} - ${minutes * 60} = ${seconds}초다.`],
      dedupeKey: `sec-to-min:${minutes}:${seconds}`,
      difficulty,
    };
  },
  verify({ minutes, totalSeconds, direction }, answer) {
    // 60진 자리 분해로 되짚는다.
    if (direction === 'to-seconds') {
      return Math.floor(answer.value / 60) === minutes && answer.value % 60 === totalSeconds % 60;
    }
    return minutes * 60 + answer.value === totalSeconds && answer.value >= 0 && answer.value < 60;
  },
};

// ---------------------------------------------------------------------------
// [4수03-14] 시간의 덧셈과 뺄셈
// ---------------------------------------------------------------------------

function formatHms(totalSeconds, withSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts = [];
  if (h > 0) parts.push(`${h}시간`);
  if (m > 0) parts.push(`${m}분`);
  if (withSeconds && s > 0) parts.push(`${s}초`);
  return parts.length > 0 ? parts.join(' ') : '0분';
}

const timeArithmetic = {
  id: 'math.g34.mr.s03-14.time-arithmetic',
  standardCode: '[4수03-14]',
  skill: '시간의 덧셈과 뺄셈',
  format: 'short-answer',
  generate(rng, { difficulty }) {
    const withSeconds = difficulty === 3;
    const unitStep = withSeconds ? 1 : 60;
    const isAdd = rng.bool();
    // 초 단위 정수로만 계산한다. 60진 자리 올림·내림이 문자열에서 어긋나지 않는다.
    const a = (difficulty === 1 ? rng.int(1, 3) * 3600 + rng.int(1, 59) * 60 : rng.int(1, 5) * 3600 + rng.int(1, 59) * 60)
      + (withSeconds ? rng.int(1, 59) : 0);
    const b = isAdd
      ? rng.int(1, 2) * 3600 + rng.int(1, 59) * 60 + (withSeconds ? rng.int(1, 59) : 0)
      : rng.int(unitStep, Math.max(unitStep, a - unitStep));
    const result = isAdd ? a + b : a - b;
    const display = formatHms(result, withSeconds);
    return {
      params: { a, b, isAdd, result, withSeconds },
      instruction: '계산하시오.',
      stem: `${formatHms(a, withSeconds)} ${isAdd ? '+' : '-'} ${formatHms(b, withSeconds)}`,
      answer: { value: display, display, accepts: [display] },
      solution: [
        withSeconds ? '초끼리, 분끼리, 시간끼리 자리를 맞추어 계산한다.' : '분끼리, 시간끼리 자리를 맞추어 계산한다.',
        '60초가 넘으면 1분으로, 60분이 넘으면 1시간으로 올린다.',
        `${formatHms(a, withSeconds)} ${isAdd ? '+' : '-'} ${formatHms(b, withSeconds)} = ${display}`,
      ],
      dedupeKey: `time-arith:${a}:${b}:${isAdd ? 'a' : 's'}`,
      difficulty,
    };
  },
  verify({ a, b, isAdd, result, withSeconds }, answer) {
    // 역연산으로 초 단위 정수를 되짚고, 표기도 다시 만들어 비교한다.
    const back = isAdd ? result - b : result + b;
    return back === a && result > 0 && answer.value === formatHms(result, withSeconds);
  },
};

// ---------------------------------------------------------------------------
// 길이·들이·무게 공통: 단위 선택 / 단위 변환 / 덧셈·뺄셈 / 어림
// ---------------------------------------------------------------------------

/** 상황에 알맞은 단위 고르기. 단위 감각을 재는 문항이다. */
function makeUnitChoice(system, code, idSuffix) {
  const sys = UNIT_SYSTEMS[system];
  return {
    id: `math.g34.mr.${idSuffix}.choose-unit`,
    standardCode: code,
    skill: `${sys.korean} 단위 고르기`,
    format: 'multiple-choice',
    generate(rng, { difficulty }) {
      const context = rng.pick(sys.contexts);
      const phrase = `${context.object}의 ${context.attribute}`;
      const wrong = sys.units.filter((u) => u.symbol !== context.unit).map((u) => u.symbol);
      // 선택지가 3개를 못 채우면 다른 체계의 단위를 섞는다. 단위의 종류를 혼동하는지도 본다.
      const pool = wrong.length >= 3 ? wrong : [...wrong, ...(system === 'capacity' ? ['g', 'cm'] : ['L'])];
      return {
        params: { system, expected: context.unit },
        instruction: '재기에 알맞은 단위를 고르시오.',
        stem: `${phrase}${josaEul(context.attribute)} 재기에 알맞은 단위는 무엇입니까?`,
        choices: buildChoices(rng, context.unit, pool.slice(0, 3)),
        answer: { value: context.unit, display: context.unit, accepts: [context.unit] },
        solution: [
          `${context.object}의 ${context.attribute}${josaEun(context.attribute)} 약 ${context.typical}${context.unit}이므로 ${unitOf(system, context.unit).korean} 단위로 재는 것이 알맞다.`,
        ],
        dedupeKey: `choose-unit-${system}:${context.object}:${context.attribute}`,
        difficulty,
      };
    },
    verify({ system: sysName, expected }, answer) {
      // 답이 그 체계의 단위인지 단위표에서 되짚는다.
      const known = UNIT_SYSTEMS[sysName].units.some((u) => u.symbol === answer.value);
      return known && answer.value === expected;
    },
  };
}

/**
 * 인접 단위 쌍 변환. 1cm = 10mm, 1m = 100cm, 1km = 1000m, 1L = 1000mL, 1kg = 1000g.
 *
 * 단위 쌍을 명시적으로 받는다. 큰 단위를 늘 기준 단위로 환산하면 1km 가 mm 로
 * 백만 배가 되어 학년 범위를 벗어난 수가 나온다.
 */
function makeUnitConversion(system, code, idSuffix, bigSymbol, smallSymbol) {
  const ratio = ratioBetween(system, bigSymbol, smallSymbol);
  return {
    id: `math.g34.mr.${idSuffix}.convert-${bigSymbol}-${smallSymbol}`,
    standardCode: code,
    skill: `${bigSymbol}와 ${smallSymbol} 단위 바꾸기`,
    format: 'fill-blank',
    generate(rng, { difficulty }) {
      const whole = difficulty === 1 ? rng.int(1, 5) : rng.int(1, 9);
      // 난이도 1은 딱 맞는 변환만 다루고 방향도 큰 단위 -> 작은 단위로 고정한다.
      // 복합 표기에서 나머지가 0이면 '□ = 0' 이 되어 물음이 성립하지 않는다.
      const simple = difficulty === 1;
      const rest = simple ? 0 : rng.int(1, ratio - 1);
      const smallValue = whole * ratio + rest;
      const compound = formatCompoundPair(system, smallValue, bigSymbol, smallSymbol);
      const toSmall = simple ? true : rng.bool();

      if (toSmall) {
        return {
          params: { system, bigSymbol, smallSymbol, smallValue, whole, rest, direction: 'to-small' },
          instruction: '□에 알맞은 수를 써넣으시오.',
          stem: `${compound} = □${smallSymbol}`,
          answer: { value: smallValue, display: `${smallValue}${smallSymbol}`, accepts: [num(smallValue), `${smallValue}${smallSymbol}`] },
          solution: [
            `1${bigSymbol}는 ${ratio}${smallSymbol}이므로 ${whole}${bigSymbol}는 ${whole * ratio}${smallSymbol}이다.`,
            rest === 0 ? `${smallValue}${smallSymbol}이다.` : `${whole * ratio} + ${rest} = ${smallValue}${smallSymbol}이다.`,
          ],
          dedupeKey: `convert-${system}-${bigSymbol}-${smallSymbol}-to-small:${smallValue}`,
          difficulty,
        };
      }
      return {
        params: { system, bigSymbol, smallSymbol, smallValue, whole, rest, direction: 'to-big' },
        instruction: '□에 알맞은 수를 써넣으시오.',
        stem: `${smallValue}${smallSymbol} = ${whole}${bigSymbol} □${smallSymbol}`,
        answer: { value: rest, display: `${rest}${smallSymbol}`, accepts: [num(rest), `${rest}${smallSymbol}`] },
        solution: [
          `${whole}${bigSymbol}는 ${whole * ratio}${smallSymbol}이다.`,
          `${smallValue} - ${whole * ratio} = ${rest}${smallSymbol}이다.`,
        ],
        dedupeKey: `convert-${system}-${bigSymbol}-${smallSymbol}-to-big:${smallValue}`,
        difficulty,
      };
    },
    verify({ system: sysName, bigSymbol: big2, smallSymbol: small2, smallValue, whole, direction }, answer) {
      const r = ratioBetween(sysName, big2, small2);
      // 자리 분해로 되짚는다.
      if (direction === 'to-small') {
        return Math.floor(answer.value / r) === whole && answer.value % r === smallValue % r;
      }
      return whole * r + answer.value === smallValue && answer.value > 0 && answer.value < r;
    },
  };
}

/** 복합 단위 덧셈·뺄셈. 기준 단위 정수로 계산하고 표기만 복합으로 만든다. */
function makeUnitArithmetic(system, code, idSuffix, bigSymbol) {
  const sys = UNIT_SYSTEMS[system];
  const big = unitOf(system, bigSymbol);
  return {
    id: `math.g34.mr.${idSuffix}.arithmetic`,
    standardCode: code,
    skill: `${sys.korean}의 덧셈과 뺄셈`,
    format: 'short-answer',
    generate(rng, { difficulty }) {
      const isAdd = rng.bool();
      const pick = () => rng.int(1, difficulty === 1 ? 4 : 9) * big.factor + rng.int(1, big.factor - 1);
      const a = pick();
      const b = isAdd ? pick() : rng.int(big.factor, Math.max(big.factor, a - big.factor));
      const result = isAdd ? a + b : a - b;
      const display = formatCompound(system, result, bigSymbol);
      return {
        params: { system, bigSymbol, a, b, isAdd, result },
        instruction: '계산하시오.',
        stem: `${formatCompound(system, a, bigSymbol)} ${isAdd ? '+' : '-'} ${formatCompound(system, b, bigSymbol)}`,
        answer: { value: display, display, accepts: [display] },
        solution: [
          `${sys.base} 단위끼리, ${bigSymbol} 단위끼리 자리를 맞추어 계산한다.`,
          `${big.factor}${sys.base}가 되면 1${bigSymbol}로 ${isAdd ? '올린다' : '바꾸어 내린다'}.`,
          `답은 ${display}이다.`,
        ],
        dedupeKey: `unit-arith-${system}:${a}:${b}:${isAdd ? 'a' : 's'}`,
        difficulty,
      };
    },
    verify({ system: sysName, bigSymbol: big2, a, b, isAdd, result }, answer) {
      // 역연산으로 기준 단위 정수를 되짚고 표기를 다시 만들어 비교한다.
      const back = isAdd ? result - b : result + b;
      return back === a && result > 0 && answer.value === formatCompound(sysName, result, big2);
    },
  };
}

/**
 * 어림. 한 개의 전형적인 크기를 주고 여러 개의 합을 어림하게 한다.
 *
 * 단위는 문맥이 가진 단위를 그대로 쓴다. 예전 구현은 큰 단위 배수를 곱해
 * 10kg 을 10000g 으로 바꿔 놓아 학년에 맞지 않는 수가 나왔다.
 */
function makeUnitEstimate(system, code, idSuffix) {
  const sys = UNIT_SYSTEMS[system];
  return {
    id: `math.g34.mr.${idSuffix}.estimate`,
    standardCode: code,
    skill: `${sys.korean} 어림하기`,
    format: 'short-answer',
    generate(rng, { difficulty }) {
      const context = rng.pick(sys.contexts);
      const per = context.typical;
      const count = difficulty === 1 ? rng.int(2, 5) : difficulty === 2 ? rng.int(3, 9) : rng.int(6, 20);
      const total = per * count;
      const unit = context.unit;
      return {
        params: { per, count, unit },
        instruction: '□에 알맞은 수를 구하시오.',
        stem: `${context.object} 하나의 ${context.attribute}${josaI(context.attribute)} 약 ${per}${unit}입니다.`
          + ` 똑같은 ${context.object} ${count}개의 ${context.attribute}${josaEun(context.attribute)} 약 몇 ${unit}입니까?`,
        answer: { value: total, display: `${total}${unit}`, accepts: [num(total), `${total}${unit}`] },
        solution: [
          `하나가 약 ${per}${unit}이므로 ${count}개는 ${per} × ${count}이다.`,
          `${per} × ${count} = ${total}${unit}`,
        ],
        dedupeKey: `unit-estimate-${system}:${context.object}:${context.attribute}:${count}`,
        difficulty,
      };
    },
    verify({ per, count }, answer) {
      // 반복 덧셈으로 되짚는다. 곱셈 연산자를 다시 쓰지 않는다.
      let sum = 0;
      for (let k = 0; k < count; k += 1) sum += per;
      return sum === answer.value && answer.value > 0;
    },
  };
}

export const generators = [
  ruleAsExpression,
  calculationPattern,
  equalitySense,
  minuteSecond,
  timeArithmetic,
  // 길이 [4수03-15] 단위 인식, [4수03-16] 변환과 어림
  makeUnitChoice('length', '[4수03-15]', 's03-15'),
  makeUnitConversion('length', '[4수03-16]', 's03-16', 'cm', 'mm'),
  makeUnitConversion('length', '[4수03-16]', 's03-16', 'km', 'm'),
  makeUnitEstimate('length', '[4수03-16]', 's03-16'),
  // 들이 [4수03-17] 단위, [4수03-18] 관계, [4수03-19] 덧셈·뺄셈
  makeUnitChoice('capacity', '[4수03-17]', 's03-17'),
  makeUnitConversion('capacity', '[4수03-18]', 's03-18', 'L', 'mL'),
  makeUnitArithmetic('capacity', '[4수03-19]', 's03-19', 'L'),
  // 무게 [4수03-20] 단위, [4수03-21] 관계, [4수03-22] 덧셈·뺄셈, [4수03-23] 어림
  makeUnitChoice('weight', '[4수03-20]', 's03-20'),
  makeUnitConversion('weight', '[4수03-21]', 's03-21', 'kg', 'g'),
  makeUnitArithmetic('weight', '[4수03-22]', 's03-22', 'kg'),
  makeUnitEstimate('weight', '[4수03-23]', 's03-23'),
];
