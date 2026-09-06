import assert from 'node:assert/strict';
import test from 'node:test';

import { createRegistry } from '../../src/engine/registry.mjs';
import { createRng } from '../../src/engine/rng.mjs';
import { buildWorksheet, generateItem } from '../../src/engine/worksheet.mjs';
import { buildLearningSupport } from '../../src/curriculum/learning-support.mjs';
import { englishWordsFor, SENTENCE_MEANINGS } from '../../src/curriculum/english-vocab.mjs';
import { MIND_FEELINGS, MIND_SENTENCES } from '../../src/curriculum/korean-sentences.mjs';
import { vocabularyFor } from '../../src/curriculum/korean-vocab.mjs';
import { loadOntology } from '../../src/ontology/source.mjs';
import { buildSpine } from '../../src/ontology/spine.mjs';

const registry = createRegistry();
const spine = buildSpine(loadOntology());
const ids = {
  korean: 'korean.g12.st.s02-04.mind',
  english: 'english.g34.st.s01-05.meaning',
  add: 'math.g12.no.s05.story-add',
  sub: 'math.g12.no.s05.story-sub',
};

function samples(id, difficulty = 1, count = 400) {
  const generator = registry.get(id);
  const standard = spine.standards.find((entry) => entry.code === generator.standardCode);
  return Array.from({ length: count }, (_, index) => {
    const seed = `richer:${id}:${difficulty}:${index}`;
    const item = generateItem(generator, standard, createRng(seed), difficulty);
    assert.deepEqual(item, generateItem(generator, standard, createRng(seed), difficulty));
    assert.deepEqual(item.learningSupport, buildLearningSupport(generator));
    assert.equal(generator.verify(item.params, item.answer), true);
    if (item.choices) {
      assert.equal(item.choices.filter((choice) => choice.correct).length, 1);
      for (const choice of item.choices.filter((entry) => !entry.correct)) {
        assert.equal(generator.verify(item.params, { ...item.answer, value: choice.text }), false);
      }
    } else {
      assert.equal(generator.verify(item.params, { ...item.answer, value: item.answer.value + 1 }), false);
    }
    return item;
  });
}

test('Korean lower-grade feeling inference includes evidence-rich narratives and dialogues', () => {
  const items = samples(ids.korean);
  const added = items.filter((item) => !MIND_SENTENCES.some((spec) => spec.text === item.params.text));
  assert.equal(new Set(added.map((item) => item.params.sceneId)).size, 8);
  assert.deepEqual(new Set(added.map((item) => item.params.presentation)), new Set(['narrative', 'dialogue']));
  assert.deepEqual(new Set(added.map((item) => item.answer.value)), new Set(MIND_FEELINGS));
  const vocabulary = new Set(vocabularyFor('1-2'));
  for (const item of added) {
    assert.ok(item.params.evidence.length > 0);
    assert.ok(item.params.text.includes(item.params.evidence));
    assert.ok(vocabulary.has(item.answer.value));
    assert.ok(!item.params.text.includes(item.answer.value));
    assert.equal(item.gradeBand, '1-2');
    assert.equal(item.standardCode, '[2국02-04]');
  }
});

test('English meaning adds color, spatial relation, and action contrasts within existing vocabulary', () => {
  const items = samples(ids.english, 2, 800);
  const added = items.filter((item) => !SENTENCE_MEANINGS.some((spec) => spec.en === item.params.en));
  assert.equal(new Set(added.map((item) => item.params.en)).size, 20);
  assert.deepEqual(new Set(added.map((item) => item.params.kind)), new Set(['color', 'location', 'action']));
  const allowed = new Set(englishWordsFor('3-4'));
  for (const item of added) {
    assert.ok(item.params.contentWords.every((word) => allowed.has(word)));
    assert.equal(item.answer.value, item.params.ko);
    assert.equal(item.gradeBand, '3-4');
    assert.equal(item.standardCode, '[4영01-05]');
  }
  for (const item of samples(ids.english, 1)) {
    assert.ok(item.params.en.split(/\s+/).length <= 3);
  }
});

for (const [operation, kinds] of [
  ['add', ['receive', 'combine', 'join']],
  ['sub', ['take-away', 'compare', 'missing-part']],
]) {
  test(`lower-grade ${operation} stories express three mathematical situation structures`, () => {
    for (const difficulty of [1, 2, 3]) {
      const items = samples(ids[operation], difficulty);
      assert.deepEqual(new Set(items.map((item) => item.params.kind)), new Set(kinds));
      for (const item of items) {
        const { a, b, kind, counter } = item.params;
        assert.equal(item.standardCode, '[2수01-05]');
        assert.equal(item.gradeBand, '1-2');
        assert.equal(item.format, 'write-expression');
        assert.ok(a > 0 && a <= 99 && b > 0 && b <= 99);
        const expected = operation === 'add' ? a + b : a - b;
        assert.equal(item.answer.value, expected);
        assert.ok(expected > 0 && expected <= 99);
        assert.ok(item.answer.accepts.includes(`${expected}${counter}`));
        assert.ok(item.dedupeKey.includes(`:${kind}:`));
      }
    }
  });
}

test('simple arithmetic supports 30 and 50 distinct numeric drills without increasing difficulty', () => {
  for (const count of [30, 50]) {
    const options = {
      subject: 'math', codes: ['[2수01-06]'], count, difficulty: 1, seed: `simple-drills:${count}`,
    };
    const worksheet = buildWorksheet(spine, registry, options);
    assert.equal(worksheet.produced, count);
    assert.equal(new Set(worksheet.items.map((item) => `${item.generatorId}:${item.params.a}:${item.params.b}`)).size, count);
    for (const item of worksheet.items) {
      assert.equal(item.difficulty, 1);
      const { a, b } = item.params;
      assert.ok(a >= 10 && a <= 99 && b >= 10 && b <= 99);
      if (item.generatorId.endsWith('.add')) {
        assert.ok(a % 10 + b % 10 < 10);
        assert.ok(a + b <= 99);
      } else {
        assert.ok(a % 10 >= b % 10);
        assert.ok(a >= b);
      }
    }
    assert.deepEqual(worksheet, buildWorksheet(spine, registry, options));
  }
});

test('richer contexts remain available through deterministic unique worksheets for all three subjects', () => {
  for (const [subject, code, count] of [
    ['korean', '[2국02-04]', 16],
    ['english', '[4영01-05]', 24],
    ['math', '[2수01-05]', 24],
  ]) {
    const options = { subject, codes: [code], count, difficulty: 2, seed: 'richer-real-surface' };
    const worksheet = buildWorksheet(spine, registry, options);
    assert.equal(worksheet.produced, count);
    assert.equal(new Set(worksheet.items.map((item) => item.id)).size, count);
    assert.deepEqual(worksheet, buildWorksheet(spine, registry, options));
  }
});
