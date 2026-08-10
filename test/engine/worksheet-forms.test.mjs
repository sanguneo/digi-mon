import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import { buildWorksheet } from '../../src/engine/worksheet.mjs';
import { buildWorksheetFormSet } from '../../src/engine/worksheet-forms.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSchema(name) {
  return JSON.parse(readFileSync(path.join(ROOT, 'schema', name), 'utf8'));
}

function standard(code) {
  return {
    code,
    specId: `spec:${code}`,
    subject: 'math',
    subjectKorean: '수학',
    gradeBand: '1-2',
    domain: '수와 연산',
    module: '수',
  };
}

function generator(id, standardCode, { constant = false } = {}) {
  return {
    id,
    standardCode,
    skill: id,
    format: 'short-answer',
    difficulties: [1],
    generate(rng) {
      const value = constant ? 1 : rng.int(1, 1_000_000);
      return {
        params: { value },
        stem: `${value}를 쓰시오.`,
        answer: {
          value,
          display: String(value),
          accepts: [String(value)],
        },
        solution: [`${value}이다.`],
        dedupeKey: `${id}:${value}`,
        difficulty: 1,
      };
    },
    verify({ value }, answer) {
      return value === answer.value;
    },
  };
}

function fixture({ constant = false } = {}) {
  const codeA = '[2수01-01]';
  const codeB = '[2수01-02]';
  const generators = new Map([
    [codeA, [generator('form-a', codeA, { constant })]],
    [codeB, [generator('form-b', codeB, { constant })]],
  ]);
  return {
    spine: {
      corpus: { schema: 'test-corpus', integrity: [] },
      standards: [standard(codeA), standard(codeB)],
    },
    registry: {
      forStandard(code) {
        return generators.get(code) ?? [];
      },
    },
  };
}

test('form set is deterministic, blueprint-equivalent, and globally deduplicated', () => {
  const { spine, registry } = fixture();
  const options = {
    seed: 'parallel-forms',
    subject: 'math',
    count: 4,
    difficulty: 1,
    formCount: 3,
  };

  const first = buildWorksheetFormSet(spine, registry, options);
  const second = buildWorksheetFormSet(spine, registry, options);

  assert.deepEqual(first, second);
  assert.equal(first.schema, 'digi-mon/worksheet-form-set@4');
  assert.equal(first.formCount, 3);
  assert.deepEqual(first.forms.map((form) => form.label), ['A', 'B', 'C']);
  assert.equal(new Set(first.forms.map((form) => form.worksheet.fingerprint)).size, 3);

  const blueprints = first.forms.map((form) =>
    form.worksheet.items.map((item) => ({
      standardCode: item.standardCode,
      generatorId: item.generatorId,
      difficulty: item.difficulty,
    })));
  assert.deepEqual(blueprints[1], blueprints[0]);
  assert.deepEqual(blueprints[2], blueprints[0]);

  const dedupeKeys = first.forms.flatMap((form) =>
    form.worksheet.items.map((item) => item.dedupeKey));
  assert.equal(new Set(dedupeKeys).size, dedupeKeys.length);
});

test('form set excludes client-visible item ids across every form', () => {
  const { spine, registry } = fixture();
  const options = {
    seed: 'excluded-parallel-forms',
    subject: 'math',
    count: 2,
    difficulty: 1,
    formCount: 3,
  };
  const original = buildWorksheetFormSet(spine, registry, options);
  const excludeItemIds = [original.forms[0].worksheet.items[0].id];
  const formSet = buildWorksheetFormSet(spine, registry, {
    ...options,
    excludeItemIds,
  });
  const ids = formSet.forms.flatMap(({ worksheet }) =>
    worksheet.items.map((item) => item.id));

  assert.deepEqual(formSet.options.excludeItemIds, excludeItemIds);
  assert.equal(ids.some((id) => excludeItemIds.includes(id)), false);
  assert.equal(new Set(ids).size, ids.length);
  assert.notEqual(formSet.fingerprint, original.fingerprint);
});

test('form set rejects invalid counts and insufficient unique pool capacity', () => {
  const { spine, registry } = fixture({ constant: true });

  assert.throws(
    () => buildWorksheetFormSet(spine, registry, {
      seed: 'invalid-forms',
      subject: 'math',
      count: 1,
      difficulty: 1,
      formCount: 1,
    }),
    /formCount/,
  );
  assert.throws(
    () => buildWorksheetFormSet(spine, registry, {
      seed: 'exhausted-forms',
      subject: 'math',
      codes: ['[2수01-01]'],
      count: 1,
      difficulty: 1,
      formCount: 2,
    }),
    /고유 문항|pool/,
  );
});

test('form set deterministically skips a blueprint that cannot fill every form', () => {
  const codeA = '[2수01-01]';
  const codeB = '[2수01-02]';
  const generators = new Map([
    [codeA, [generator('limited', codeA, { constant: true })]],
    [codeB, [generator('expandable', codeB)]],
  ]);
  const spine = {
    corpus: { schema: 'test-corpus', integrity: [] },
    standards: [standard(codeA), standard(codeB)],
  };
  const registry = {
    forStandard(code) {
      return generators.get(code) ?? [];
    },
  };
  const seed = Array.from({ length: 100 }, (_, index) => `retry-${index}`).find(
    (candidate) => buildWorksheet(spine, registry, {
      seed: `${candidate}:form:A`,
      subject: 'math',
      count: 1,
      difficulty: 1,
    }).items[0].generatorId === 'limited',
  );
  assert.ok(seed);

  const formSet = buildWorksheetFormSet(spine, registry, {
    seed,
    subject: 'math',
    count: 1,
    difficulty: 1,
    formCount: 3,
  });

  assert.ok(formSet.blueprintAttempt > 0);
  assert.equal(formSet.blueprint[0].generatorId, 'expandable');
});

test('form set retries when a generator drifts from the blueprint difficulty', () => {
  const codeA = '[2수01-01]';
  const codeB = '[2수01-02]';
  const drift = generator('difficulty-drift', codeA);
  const stable = {
    ...generator('difficulty-stable', codeB),
    difficulties: [1, 2, 3],
    generate(rng, { difficulty }) {
      const value = rng.int(1, 1_000_000);
      return {
        params: { value },
        stem: `${value}를 쓰시오.`,
        answer: {
          value,
          display: String(value),
          accepts: [String(value)],
        },
        solution: [`${value}이다.`],
        dedupeKey: `difficulty-stable:${value}`,
        difficulty,
      };
    },
  };
  const generators = new Map([
    [codeA, [drift]],
    [codeB, [stable]],
  ]);
  const spine = {
    corpus: { schema: 'test-corpus', integrity: [] },
    standards: [standard(codeA), standard(codeB)],
  };
  const registry = {
    forStandard(code) {
      return generators.get(code) ?? [];
    },
  };
  const seed = Array.from({ length: 100 }, (_, index) => `drift-${index}`).find(
    (candidate) => buildWorksheet(spine, registry, {
      seed: `${candidate}:form:A`,
      subject: 'math',
      count: 1,
      difficulty: 3,
    }).items[0].generatorId === 'difficulty-drift',
  );
  assert.ok(seed);

  const formSet = buildWorksheetFormSet(spine, registry, {
    seed,
    subject: 'math',
    count: 1,
    difficulty: 3,
    formCount: 3,
  });

  assert.ok(formSet.blueprintAttempt > 0);
  assert.equal(formSet.blueprint[0].generatorId, 'difficulty-stable');
  assert.ok(formSet.forms.every((form) => form.worksheet.items[0].difficulty === 3));
});

test('form set output validates against the versioned JSON Schema', () => {
  const { spine, registry } = fixture();
  const formSet = buildWorksheetFormSet(spine, registry, {
    seed: 'schema-forms',
    subject: 'math',
    count: 2,
    difficulty: 1,
    formCount: 2,
  });
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  ajv.addSchema(
    readSchema('generator-topic-alignment.schema.json'),
    'https://example.invalid/digi-mon/generator-topic-alignment.schema.json',
  );
  ajv.addSchema(readSchema('learning-support.schema.json'));
  ajv.addSchema(readSchema('item.schema.json'));
  ajv.addSchema(readSchema('worksheet.schema.json'));
  const validate = ajv.compile(readSchema('worksheet-form-set.schema.json'));

  assert.equal(validate(formSet), true, JSON.stringify(validate.errors));
});
