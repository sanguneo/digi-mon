import assert from 'node:assert/strict';
import test from 'node:test';

import { createRegistry } from '../../src/engine/registry.mjs';
import { createRng } from '../../src/engine/rng.mjs';
import { gradeItem } from '../../src/server/grade.mjs';
import { buildSpine } from '../../src/ontology/spine.mjs';
import { loadOntology } from '../../src/ontology/source.mjs';

// 5차 리뷰가 찾은 두 계열을 수학 생성기 전부에 대해 본다.
//
// 1) 경계: 난수 범위의 끝값(가장 작은 생산량과 가장 큰 불량품처럼)이 겹치면 답이 0 이하가 되어
//    생성기 자신의 검증기가 거절하고 학습지 생성이 멈출 수 있다. 끝값은 드물게 나와서 고른 seed 표본으로는
//    잘 걸리지 않으므로, 정수 범위와 고르기에서 끝값을 자주 내는 난수로 만든다. 끝값도 원래 범위 안의 값이라
//    이렇게 만든 문항은 실제로 나올 수 있는 문항이다.
// 2) 교환법칙: 식을 정답으로 받는 문항은 덧셈·곱셈 식의 항 순서를 바꾼 식도 받고, 뺄셈·나눗셈 식의 두 수를
//    바꾼 식은 받지 않는다. 식과 답을 함께 쓴 꼴('식, 답', '식 / 답 답')에서도 같다.
const EDGE_SEEDS = 400;
const SEEDS = 300;

const spine = buildSpine(loadOntology());
const standardByCode = new Map(spine.standards.map((s) => [s.code, s]));
const registry = createRegistry();
const mathGenerators = registry.all().filter((g) => g.id.startsWith('math.'));
const levelsOf = (g) => g.difficulties ?? (g.difficultyAxis === 'single' ? [1] : [1, 2, 3]);
const correct = (item, response) => gradeItem(item, response).correct;

/** createRng 과 같은 모양이되 int 는 절반, pick 은 30% 확률로 범위의 끝값을 낸다. */
function edgeRng(seed) {
  const rng = createRng(seed);
  const coin = createRng(`${seed}|edge`);
  const { int, pick } = rng;
  rng.int = (min, max) => {
    const c = coin.float();
    if (max >= min && c < 0.25) return min;
    if (max >= min && c < 0.5) return max;
    return int(min, max);
  };
  rng.pick = (arr) => {
    const c = coin.float();
    if (Array.isArray(arr) && arr.length > 0 && c < 0.15) return arr[0];
    if (Array.isArray(arr) && arr.length > 0 && c < 0.3) return arr.at(-1);
    return pick(arr);
  };
  return rng;
}

test('수학 생성기는 난수 범위의 끝값에서도 자기 검증기를 통과하는 문항을 낸다', () => {
  assert.equal(mathGenerators.length, 265);
  const failures = new Map();
  for (const generator of mathGenerators) {
    for (const difficulty of levelsOf(generator)) {
      for (let s = 0; s < EDGE_SEEDS; s += 1) {
        const seed = `edge:${difficulty}:${s}`;
        let raw;
        try {
          raw = generator.generate(edgeRng(seed), { difficulty, standard: standardByCode.get(generator.standardCode) });
        } catch (error) {
          if (!failures.has(generator.id)) failures.set(generator.id, `${generator.id} ${seed} 생성 실패: ${error.message}`);
          continue;
        }
        if (generator.verify(raw.params, raw.answer) !== true && !failures.has(generator.id)) {
          failures.set(generator.id, `${generator.id} ${seed} 답 ${JSON.stringify(raw.answer.value)} 거절: ${JSON.stringify(raw.params)}`);
        }
      }
    }
  }
  assert.deepEqual([...failures.values()], []);
});

const OPERATORS = ['+', '-', '×', '÷'];

/** '왼쪽 = 오른쪽' 뒤에 답이 붙은 정답 표기를 나눈다. 왼쪽이 한 가지 연산만 쓰는 식일 때만. */
function parseExpression(text) {
  const m = /^(.+?) = ([^,=/]+?)((?:, | \/ 답 ).*)?$/.exec(text);
  if (!m) return null;
  const [, left, right, tail = ''] = m;
  const op = OPERATORS.find((o) => left.includes(` ${o} `));
  if (!op) return null;
  const terms = left.split(` ${op} `);
  if (terms.some((term) => OPERATORS.some((o) => term.includes(o)))) return null;
  return { op, terms, right, tail };
}

test('식을 받는 문항은 덧셈·곱셈 식의 순서를 바꾼 식을 받고 뺄셈·나눗셈 식의 두 수를 바꾼 식은 받지 않는다', () => {
  const failures = new Map();
  const fail = (id, message) => {
    if (!failures.has(id)) failures.set(id, `${id} ${message}`);
  };
  const checked = new Set();
  for (const generator of mathGenerators) {
    if (generator.format === 'multiple-choice' || generator.scoring === 'manual') continue;
    for (const difficulty of levelsOf(generator)) {
      for (let s = 0; s < SEEDS; s += 1) {
        const raw = generator.generate(createRng(`commute:${difficulty}:${s}`), {
          difficulty, standard: standardByCode.get(generator.standardCode),
        });
        const item = { ...raw, format: generator.format, scoring: generator.scoring };
        for (const text of raw.answer.accepts ?? []) {
          const parsed = parseExpression(text);
          if (!parsed) continue;
          const { op, terms, right, tail } = parsed;
          const write = (order) => `${order.join(` ${op} `)} = ${right}${tail}`;
          checked.add(generator.id);
          if (op === '+' || op === '×') {
            // 맨 앞 항을 뒤로 보낸 식과 거꾸로 늘어놓은 식(두 항이면 같다).
            for (const order of [[...terms.slice(1), terms[0]], [...terms].reverse()]) {
              if (!correct(item, write(order))) fail(generator.id, `'${write(order)}' 거절(정답 '${text}')`);
            }
          } else if (terms.length === 2 && terms[0] !== terms[1]) {
            const swapped = write([terms[1], terms[0]]);
            if (correct(item, swapped)) fail(generator.id, `'${swapped}' 받음(정답 '${text}')`);
          }
        }
      }
    }
  }
  assert.deepEqual([...failures.values()], []);
  // 덧셈·곱셈·뺄셈 식을 정답으로 받는 생성기가 모두 검사되었는지 본다.
  for (const id of [
    'math.g12.no.s05.story-add', 'math.g12.no.s05.story-sub', 'math.g12.no.s07.fact-family', 'math.g12.no.s09.story-box',
    'math.g12.no.s10.groups', 'math.g12.no.s10.add-to-mult', 'math.g12.no.s08.story-three',
    'math.g34.no.s03.story', 'math.g34.no.s04.story-multiply',
  ]) assert.ok(checked.has(id), id);
});
