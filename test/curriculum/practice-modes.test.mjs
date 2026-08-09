import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PRACTICE_MODE_IDS,
  practiceModeManifest,
} from '../../src/curriculum/practice-modes.mjs';
import { parseWorksheetOptions } from '../../src/engine/options.mjs';
import { buildWorksheet } from '../../src/engine/worksheet.mjs';

function standard(code, subject = 'math') {
  return {
    code,
    specId: `spec:${code}`,
    subject,
    subjectKorean: subject,
    gradeBand: '1-2',
    domain: 'test',
    module: 'test',
  };
}

function generator(id, standardCode, { axis = 'numeric' } = {}) {
  return {
    id,
    standardCode,
    skill: id,
    format: 'short-answer',
    difficultyAxis: axis,
    generate(rng, { difficulty }) {
      const value = rng.int(1, 1_000_000);
      return {
        params: { value },
        stem: `${value}`,
        answer: { value, display: String(value), accepts: [String(value)] },
        solution: [String(value)],
        dedupeKey: `${id}:${value}`,
        difficulty: axis === 'single' ? 1 : difficulty,
      };
    },
    verify({ value }, answer) {
      return value === answer.value;
    },
  };
}

test('practice modes expose three revisioned, fail-closed policies', () => {
  assert.deepEqual(PRACTICE_MODE_IDS, [
    'advanced',
    'literacy-foundations',
    'thinking-skills-v1',
  ]);
  assert.deepEqual(
    practiceModeManifest().map(({ id, revision }) => ({ id, revision })),
    [
      { id: 'advanced', revision: 1 },
      { id: 'literacy-foundations', revision: 1 },
      { id: 'thinking-skills-v1', revision: 1 },
    ],
  );
});

test('advanced mode excludes single-axis generators and forces exact difficulty 3', () => {
  const code = '[2수01-01]';
  const spine = {
    upstream: { taxonomyVersion: 'test', integrity: [] },
    standards: [standard(code)],
  };
  const registry = {
    forStandard() {
      return [
        generator('single', code, { axis: 'single' }),
        generator('advanced-capable', code),
      ];
    },
  };

  const worksheet = buildWorksheet(spine, registry, {
    seed: 'advanced-mode',
    subject: 'math',
    count: 2,
    modes: ['advanced'],
  });

  assert.deepEqual(worksheet.options.modes, ['advanced']);
  assert.equal(worksheet.options.difficulty, 3);
  assert.ok(worksheet.items.every((item) =>
    item.generatorId === 'advanced-capable' && item.difficulty === 3));
});

test('thinking and literacy modes use exact reviewed generator allowlists', () => {
  const code = '[2수04-01]';
  const spine = {
    upstream: { taxonomyVersion: 'test', integrity: [] },
    standards: [standard(code)],
  };
  const eligible = generator('math.g12.pd.s01.shape-pattern', code);
  const registry = {
    forStandard() {
      return [generator('ordinary-hard-item', code), eligible];
    },
  };
  const thinking = buildWorksheet(spine, registry, {
    seed: 'thinking-mode',
    subject: 'math',
    count: 1,
    modes: ['thinking-skills-v1'],
  });
  assert.equal(thinking.items[0].generatorId, eligible.id);

  assert.throws(
    () => buildWorksheet(spine, registry, {
      seed: 'empty-intersection',
      subject: 'math',
      count: 1,
      modes: ['literacy-foundations', 'thinking-skills-v1'],
    }),
    /mode|조건/,
  );
});

test('mode options are canonical and reject conflicts before generation', () => {
  assert.deepEqual(
    parseWorksheetOptions({
      subject: 'math',
      modes: ['thinking-skills-v1', 'advanced'],
    }).modes,
    ['advanced', 'thinking-skills-v1'],
  );
  assert.throws(
    () => parseWorksheetOptions({ modes: ['advanced', 'advanced'] }),
    /중복/,
  );
  assert.throws(
    () => parseWorksheetOptions({ modes: ['unknown'] }),
    /mode/,
  );
  assert.throws(
    () => parseWorksheetOptions({ modes: ['advanced'], difficulty: 2 }),
    /difficulty/,
  );
});
