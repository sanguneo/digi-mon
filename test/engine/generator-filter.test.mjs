import assert from 'node:assert/strict';
import test from 'node:test';

import { parseWorksheetOptions, WorksheetOptionsError } from '../../src/engine/options.mjs';
import { createRegistry } from '../../src/engine/registry.mjs';
import { buildWorksheet, WorksheetTargetError } from '../../src/engine/worksheet.mjs';
import { buildWorksheetFormSet } from '../../src/engine/worksheet-forms.mjs';
import { loadOntology } from '../../src/ontology/source.mjs';
import { buildSpine } from '../../src/ontology/spine.mjs';

const spine = buildSpine(loadOntology());
const registry = createRegistry();
const ADD = 'math.g12.no.s06.add';
const SUB = 'math.g12.no.s06.sub';
const SINGLE = 'math.g12.gm.s10.choose-unit';
const base = { subject: 'math', seed: 'generator-filter', count: 12, difficulty: 2 };

function worksheet(options = {}) {
  return buildWorksheet(spine, registry, { ...base, ...options });
}

for (const value of [null, '', ADD, [], {}, [3], [''], [' '], [ADD, ADD]]) {
  test(`generatorIds rejects invalid shape or duplicates: ${JSON.stringify(value)}`, () => {
    const invalid = (error) => error instanceof WorksheetOptionsError && error.field === 'generatorIds';
    assert.throws(() => parseWorksheetOptions({ generatorIds: value }), invalid);
    assert.throws(() => worksheet({ generatorIds: value }), invalid);
  });
}

test('generatorIds canonicalizes without mutating input and is omitted when unused', () => {
  const generatorIds = [SUB, ADD];
  assert.deepEqual(parseWorksheetOptions({ generatorIds }).generatorIds, [ADD, SUB]);
  assert.deepEqual(generatorIds, [SUB, ADD]);
  assert.equal(Object.hasOwn(parseWorksheetOptions({}), 'generatorIds'), false);
});

test('real selected problem types produce the exact requested count, with no sibling leakage', () => {
  for (const count of [1, 12, 100]) {
    const result = worksheet({ generatorIds: [ADD], count });
    assert.equal(result.produced, count);
    assert.equal(result.shortfall, 0);
    assert.deepEqual([...new Set(result.items.map((item) => item.generatorId))], [ADD]);
    assert.ok(result.items.every((item) => item.difficulty === 2));
    assert.deepEqual(result.options.generatorIds, [ADD]);
  }
  const result = worksheet({ generatorIds: [SUB, ADD], count: 30 });
  assert.deepEqual([...new Set(result.items.map((item) => item.generatorId))].sort(), [ADD, SUB]);
  assert.deepEqual(result, worksheet({ generatorIds: [ADD, SUB], count: 30 }));
  assert.deepEqual(result, buildWorksheet(spine, registry, {
    ...parseWorksheetOptions(result.options), seed: result.seed,
  }));
});

test('selection intersects subject, grade, domain, codes, modes and difficulty', () => {
  const other = registry.all().find((g) => g.id.startsWith('english.'));
  const options = {
    generatorIds: [ADD, SINGLE, other.id], gradeBands: ['1-2'],
    domains: ['수와 연산'], codes: ['[2수01-06]'], modes: ['advanced'], difficulty: 3,
  };
  const result = worksheet(options);
  assert.equal(result.produced, base.count);
  assert.ok(result.items.every((item) => item.generatorId === ADD && item.difficulty === 3));
  // Retain the user's canonical selector, not just its current eligible subset, for replay.
  assert.deepEqual(result.options.generatorIds, options.generatorIds.toSorted());
  const mixedDifficulty = worksheet({ generatorIds: [ADD, SINGLE] });
  assert.ok(mixedDifficulty.items.every((item) => item.generatorId === ADD && item.difficulty === 2));
});

for (const options of [
  { generatorIds: ['unknown-generator'] },
  { generatorIds: [ADD, 'unknown-generator'] },
  { generatorIds: [ADD], subject: 'english' },
  { generatorIds: [ADD], gradeBands: ['5-6'] },
  { generatorIds: [ADD], domains: ['도형과 측정'] },
  { generatorIds: [ADD], codes: ['[2수01-01]'] },
  { generatorIds: [ADD], modes: ['thinking-skills-v1'] },
  { generatorIds: [SINGLE], difficulty: 2 },
]) {
  test(`unavailable generator selection is a target error: ${JSON.stringify(options)}`, () => {
    assert.throws(() => worksheet(options), (error) =>
      error instanceof WorksheetTargetError && Array.isArray(error.detail.generatorIds));
  });
}

test('single-difficulty types retain their supported level when difficulty is omitted', () => {
  const result = worksheet({ generatorIds: [SINGLE], difficulty: undefined, count: 1 });
  assert.equal(result.produced, 1);
  assert.equal(result.items[0].generatorId, SINGLE);
  assert.equal(result.items[0].difficulty, 1);
});

test('filtered exclusions and parallel forms preserve exact selection and replay', () => {
  const options = { ...base, count: 5, generatorIds: [ADD], formCount: 2 };
  const excluded = worksheet({ generatorIds: [ADD], count: 5 }).items.map((item) => item.id);
  const set = buildWorksheetFormSet(spine, registry, { ...options, excludeItemIds: excluded });
  const items = set.forms.flatMap(({ worksheet: form }) => {
    assert.deepEqual(form.options.generatorIds, [ADD]);
    assert.equal(form.produced, 5);
    return form.items;
  });
  assert.equal(new Set(items.map((item) => item.dedupeKey)).size, 10);
  assert.ok(items.every((item) => item.generatorId === ADD && !excluded.includes(item.id)));
  assert.deepEqual(set, buildWorksheetFormSet(spine, registry, {
    ...parseWorksheetOptions(set.options), seed: set.seed, formCount: set.formCount,
  }));
});

test('unfiltered real worksheet preserves baseline options bytes and fingerprint', () => {
  const result = worksheet({ seed: 'generator-filter-baseline', gradeBands: ['1-2'] });
  assert.equal(JSON.stringify(result.options), '{"subject":"math","gradeBands":["1-2"],"domains":null,"codes":null,"count":12,"difficulty":2,"difficultyMix":{"1":0.3,"2":0.5,"3":0.2},"modes":[],"followLearningOrder":false,"excludeItemIds":[]}');
  assert.equal(result.fingerprint, '80e5f426d67c0be002f4af755aab0fc72237ed208723332524fc9d73a4ecdac6');
  assert.deepEqual(result, worksheet({ seed: result.seed, gradeBands: ['1-2'], generatorIds: undefined }));
});
