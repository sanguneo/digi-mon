import assert from 'node:assert/strict';
import test from 'node:test';
import { createRegistry } from '../../src/engine/registry.mjs';
import { createRng } from '../../src/engine/rng.mjs';
import { buildWorksheet, generateItem } from '../../src/engine/worksheet.mjs';
import { buildLearningSupport } from '../../src/curriculum/learning-support.mjs';
import { englishWordsFor } from '../../src/curriculum/english-vocab.mjs';
import { loadOntology } from '../../src/ontology/source.mjs';
import { buildSpine } from '../../src/ontology/spine.mjs';

const registry = createRegistry();
const spine = buildSpine(loadOntology());
function samples(id, difficulty = 1, count = 300) {
  const generator = registry.get(id);
  const standard = spine.standards.find((entry) => entry.code === generator.standardCode);
  return Array.from({ length: count }, (_, index) => {
    const seed = `progression:${id}:${difficulty}:${index}`;
    const item = generateItem(generator, standard, createRng(seed), difficulty);
    assert.deepEqual(item, generateItem(generator, standard, createRng(seed), difficulty));
    assert.deepEqual(item.learningSupport, buildLearningSupport(generator));
    assert.equal(generator.verify(item.params, item.answer), true);
    for (const choice of item.choices?.filter((entry) => !entry.correct) ?? []) {
      assert.equal(generator.verify(item.params, { ...item.answer, value: choice.text }), false);
    }
    return item;
  });
}

test('middle math distinguishes equal sharing, grouping and symbolic inverse relations', () => {
  for (const difficulty of [1, 2, 3]) {
    const items = samples('math.g34.no.s05.meaning', difficulty);
    assert.deepEqual(new Set(items.map((item) => item.params.kind)), new Set(['equation', 'sharing', 'grouping']));
    for (const item of items) {
      const { dividend, divisor, quotient, askQuotient, kind, counter, answerUnit } = item.params;
      assert.equal(item.gradeBand, '3-4');
      assert.equal(dividend, divisor * quotient);
      assert.equal(item.answer.value, askQuotient ? quotient : dividend);
      assert.ok(divisor >= 2 && divisor <= 9 && quotient >= 2 && quotient <= 99);
      if (kind !== 'equation') {
        assert.equal(answerUnit, kind === 'grouping' && askQuotient ? '봉지' : counter);
        assert.ok(item.answer.accepts.includes(`${item.answer.value}${answerUnit}`));
      }
      assert.equal(registry.get(item.generatorId).verify(item.params, { ...item.answer, value: item.answer.value + 1 }), false);
    }
  }
});

test('upper math presents all four two-operation structures as conditions and as drills', () => {
  const items = samples('math.g56.no.s01.mixed-ops', 3, 500);
  assert.deepEqual(new Set(items.map((item) => item.params.presentation)), new Set(['expression', 'story']));
  const stories = items.filter((item) => item.params.presentation === 'story');
  assert.deepEqual(new Set(stories.map((item) => item.params.shape)), new Set(['a+b*c', 'a-b*c', '(a+b)*c', 'a+b/c']));
  for (const item of items) {
    const { operands: [a, b, c], shape } = item.params;
    const expected = shape === 'a+b*c' ? a + b * c
      : shape === 'a-b*c' ? a - b * c
        : shape === '(a+b)*c' ? (a + b) * c : a + b / c;
    assert.equal(item.gradeBand, '5-6');
    assert.equal(item.answer.value, expected);
    assert.ok(Number.isInteger(expected) && expected > 0);
    assert.equal((item.params.stem.match(/[+\-×÷]/g) ?? []).length, 2);
    assert.equal(registry.get(item.generatorId).verify(item.params, { ...item.answer, value: expected + 1 }), false);
  }
});

test('middle Korean adds four dependency-ordered practical procedures with invertible labels', () => {
  const items = [...samples('korean.g34.st.s03-02.procedure', 1), ...samples('korean.g34.st.s03-02.procedure', 2)];
  const added = items.filter((item) => item.params.sceneId);
  assert.equal(new Set(added.map((item) => item.params.sceneId)).size, 4);
  assert.deepEqual(new Set(added.map((item) => item.params.shuffled.length)), new Set([3, 4]));
  const labels = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'];
  for (const item of added) {
    const order = item.answer.value.split(', ').map((label) => item.params.shuffled[labels.indexOf(label)]);
    assert.deepEqual(order, Array.from({ length: order.length }, (_, index) => index));
    assert.equal(item.gradeBand, '3-4');
    const reversed = item.answer.value.split(', ').reverse().join(', ');
    assert.equal(registry.get(item.generatorId).verify(item.params, { ...item.answer, value: reversed }), false);
  }
});

test('upper Korean adds four dialogues with explicit inference evidence', () => {
  const added = samples('korean.g56.st.s01-01.inference').filter((item) => item.params.sceneId);
  assert.equal(new Set(added.map((item) => item.params.sceneId)).size, 4);
  for (const item of added) {
    assert.equal(item.gradeBand, '5-6');
    assert.ok(item.stem.includes(item.params.evidence));
    assert.ok(!item.stem.includes(item.answer.value));
  }
});

test('upper English answers quantity, location, time and subject using provided context', () => {
  const added = samples('english.g56.st.s02-07.qa').filter((item) => item.params.context);
  assert.equal(new Set(added.map((item) => item.params.q)).size, 4);
  assert.deepEqual(new Set(added.map((item) => item.params.kind)), new Set(['quantity', 'location', 'time', 'subject']));
  const allowed = new Set(englishWordsFor('5-6'));
  for (const item of added) {
    assert.equal(item.gradeBand, '5-6');
    assert.ok(item.params.contentWords.every((word) => allowed.has(word)));
    assert.ok(item.stem.includes(item.params.context));
    assert.equal(registry.get(item.generatorId).verify({ ...item.params, context: 'invalid' }, item.answer), false);
  }
});

test('all three subjects have reproducible middle and upper worksheets without shortfall', () => {
  for (const [subject, code, difficulty, count] of [
    ['math', '[4수01-05]', 1, 30], ['math', '[6수01-01]', 3, 30],
    ['korean', '[4국03-02]', 2, 16], ['korean', '[6국01-01]', 1, 8],
    ['english', '[4영01-05]', 2, 24], ['english', '[6영02-07]', 1, 9],
  ]) {
    const options = { subject, codes: [code], difficulty, count, seed: 'content-progression' };
    const worksheet = buildWorksheet(spine, registry, options);
    assert.equal(worksheet.produced, count);
    assert.equal(new Set(worksheet.items.map((item) => item.id)).size, count);
    assert.deepEqual(worksheet, buildWorksheet(spine, registry, options));
  }
});
