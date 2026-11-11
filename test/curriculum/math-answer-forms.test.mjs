import assert from 'node:assert/strict';
import test from 'node:test';

import { createRegistry } from '../../src/engine/registry.mjs';
import { createRng } from '../../src/engine/rng.mjs';
import { gradeItem } from '../../src/server/grade.mjs';
import { buildSpine } from '../../src/ontology/spine.mjs';
import { loadOntology } from '../../src/ontology/source.mjs';

// 채점 성질: 정답과 값이 같은 다른 표기를 받는가. 리뷰마다 생성기 하나씩(약분한 분수, 끝자리 0 소수,
// 단위 붙인 가분수, 식과 답을 함께 쓴 답)이 나와서 수학 생성기 전부에 대해 본다.
//
// 1) 수 하나가 답인 문항은 답을 다음 꼴로 바꿔 넣어도 정답이다.
//    (a) 단위를 붙인 꼴과 뗀 꼴. 단위는 정답 표기(display·accepts)에 나온 것을 쓴다.
//    (b) 분수면 약분한·약분하지 않은 가분수와 대분수. 지시문이 꼴을 정하면 그 꼴만 본다
//        ('기약분수로'는 기약 표기, '가분수로'·'대분수로'는 그 꼴, '그대로'는 보인 꼴 하나).
//    (c) 소수면 끝에 0을 붙인 꼴.
// 2) 지시문이 식과 답을 함께 요구하면('식을 쓰고 답을 구하시오') 식과 답을 한 칸에 함께 쓴 답을 받는다.
//    답만 쓰라는 지시문('답만 쓰시오')은 답만 받는다.
const SEEDS = 300;

const spine = buildSpine(loadOntology());
const standardByCode = new Map(spine.standards.map((s) => [s.code, s]));
const registry = createRegistry();
const mathGenerators = registry.all().filter((g) => g.id.startsWith('math.'));
const levelsOf = (g) => g.difficulties ?? (g.difficultyAxis === 'single' ? [1] : [1, 2, 3]);

function* itemsOf(generator, prefix) {
  for (const difficulty of levelsOf(generator)) {
    for (let s = 0; s < SEEDS; s += 1) {
      const raw = generator.generate(createRng(`${prefix}:${difficulty}:${s}`), {
        difficulty, standard: standardByCode.get(generator.standardCode),
      });
      yield { raw, item: { ...raw, format: generator.format, scoring: generator.scoring } };
    }
  }
}

const correct = (item, response) => gradeItem(item, response).correct;
const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));

const NUMBER = String.raw`\d+ \d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?`;
const BARE = new RegExp(`^(?:${NUMBER})$`);
const WITH_UNIT = new RegExp(`^(${NUMBER})([^\\d\\s,=+×÷/<>□-][^\\d,=]*)$`);

/** 분수 답의 같은 값 표기들. 지시문이 꼴을 정하면 그 꼴만 남긴다. */
function fractionForms(core, instruction) {
  if (/그대로/.test(instruction)) return [core];
  const m = /^(?:(\d+) )?(\d+)\/(\d+)$/.exec(core);
  const d = Number(m[3]);
  const n = Number(m[1] ?? 0) * d + Number(m[2]);
  if (n % d === 0) return [core];
  const k = gcd(n, d);
  const mixed = (top, bottom) => (top > bottom ? `${Math.floor(top / bottom)} ${top % bottom}/${bottom}` : null);
  let forms = [
    { text: `${n / k}/${d / k}`, reduced: true, mixed: false },
    { text: mixed(n / k, d / k), reduced: true, mixed: true },
    { text: `${n}/${d}`, reduced: k === 1, mixed: false },
    { text: mixed(n, d), reduced: k === 1, mixed: true },
  ].filter((form) => form.text !== null);
  if (/기약분수/.test(instruction)) forms = forms.filter((form) => form.reduced);
  if (/가분수로/.test(instruction)) forms = forms.filter((form) => !form.mixed);
  if (/대분수로/.test(instruction)) forms = forms.filter((form) => form.mixed);
  return [...new Set(forms.map((form) => form.text))];
}

/** 수 하나가 답인 문항의 같은 값 표기들. 답이 수 하나가 아니면 null. */
function equalValueForms(raw) {
  if (raw.choices) return null;
  const value = String(raw.answer.value);
  if (!BARE.test(value)) return null;
  const units = new Set();
  let shown = false;
  for (const text of [raw.answer.display, ...raw.answer.accepts].map(String)) {
    if (text === value) shown = true;
    const m = WITH_UNIT.exec(text);
    if (m && m[1] === value) {
      units.add(m[2]);
      shown = true;
    }
  }
  // 정답 표기에 그 수가 그대로 나오지 않으면(시각을 분으로 들고 있는 값 등) 답이 수 하나가 아니다.
  if (!shown) return null;
  const cores = value.includes('/') ? fractionForms(value, raw.instruction)
    : value.includes('.') ? [value, `${value}0`] : [value];
  return cores.flatMap((core) => ['', ...units].map((unit) => `${core}${unit}`));
}

test('수학 생성기 채점: 같은 값을 단위·분수 꼴·끝자리 0만 바꿔 쓴 답을 정답으로 받는다', () => {
  assert.equal(mathGenerators.length, 265);
  const failures = new Map();
  let checked = 0;
  for (const generator of mathGenerators) {
    if (generator.format === 'multiple-choice' || generator.scoring === 'manual') continue;
    for (const { raw, item } of itemsOf(generator, 'answer-forms')) {
      const forms = equalValueForms(raw);
      if (!forms) continue;
      checked += 1;
      for (const form of forms) {
        if (!correct(item, form) && !failures.has(generator.id)) {
          failures.set(generator.id, `${generator.id} '${form}' 거절: ${raw.instruction} ${raw.stem}`);
        }
      }
    }
  }
  assert.ok(checked > 100_000, `수 답 문항 ${checked}개`);
  assert.deepEqual([...failures.values()], []);
});

test('식과 답을 요구하는 문항은 식과 답을 함께 쓴 답을 받고, 답만 쓰라는 문항은 답만 받는다', () => {
  // '계산식의 배열을 보고'처럼 식을 읽기만 하는 지시문은 식을 쓰라는 것이 아니다.
  const asksExpression = (instruction) => /식(을|으로)/.test(instruction) && /답/.test(instruction) && !/답만/.test(instruction);
  const failures = new Map();
  const fail = (id, message) => {
    if (!failures.has(id)) failures.set(id, `${id} ${message}`);
  };
  const expressionGenerators = new Set();
  for (const generator of mathGenerators) {
    if (generator.format === 'multiple-choice' || generator.scoring === 'manual') continue;
    for (const { raw, item } of itemsOf(generator, 'expression-answer')) {
      if (!asksExpression(raw.instruction)) continue;
      expressionGenerators.add(generator.id);
      const value = String(raw.answer.value);
      const unit = WITH_UNIT.exec(String(raw.answer.display).split(' / 답 ').at(-1))?.[2] ?? '';
      // 식 표기: 식만 쓴 정답(답이 식 안에 있음)과, 식과 답을 함께 쓴 정답의 식 부분.
      const expressions = new Set();
      for (const text of raw.answer.accepts) {
        if (text.includes(', ')) expressions.add(text.slice(0, text.lastIndexOf(', ')));
        else if (text.includes('=') && !text.includes(' / 답 ')) expressions.add(text);
      }
      if (expressions.size === 0) {
        fail(generator.id, `식을 쓸 수 없다: ${raw.instruction} ${JSON.stringify(raw.answer.accepts)}`);
        continue;
      }
      if (!correct(item, value)) fail(generator.id, `답만 쓴 '${value}' 거절`);
      for (const expression of expressions) {
        for (const response of [`${expression}, ${value}`, `${expression}, ${value}${unit}`]) {
          if (!correct(item, response)) fail(generator.id, `'${response}' 거절`);
        }
        if (correct(item, `${expression}, ${Number(value) + 1}`)) fail(generator.id, `틀린 답 '${expression}, ${Number(value) + 1}' 받음`);
      }
    }
  }
  assert.deepEqual([...failures.values()], []);
  assert.deepEqual([...expressionGenerators].sort(), [
    'math.g12.no.s05.story-add', 'math.g12.no.s05.story-sub', 'math.g12.no.s08.story-three', 'math.g12.no.s09.story-box',
    'math.g12.no.s10.groups', 'math.g34.no.s03.story', 'math.g34.no.s04.story-multiply',
  ]);
});
