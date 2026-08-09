import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildWorksheet,
  buildWorksheetFingerprint,
} from '../../src/engine/worksheet.mjs';

test('worksheet fingerprint binds seed, resolved options, items, and corpus', () => {
  const base = {
    schema: 'digi-mon/worksheet@4',
    seed: 'same-seed',
    options: {
      subject: 'math',
      count: 2,
      followLearningOrder: false,
    },
    items: [{ id: 'a' }, { id: 'b' }],
    corpus: {
      taxonomyVersion: 'kr-full-depth-v0.4',
      integrity: [{ file: 'topics.json', sha256: 'abc' }],
    },
  };

  const fingerprint = buildWorksheetFingerprint(base);
  assert.equal(fingerprint, buildWorksheetFingerprint(structuredClone(base)));

  const reordered = structuredClone(base);
  reordered.options.followLearningOrder = true;
  assert.notEqual(fingerprint, buildWorksheetFingerprint(reordered));

  const changedCorpus = structuredClone(base);
  changedCorpus.corpus.integrity[0].sha256 = 'def';
  assert.notEqual(fingerprint, buildWorksheetFingerprint(changedCorpus));

  const changedContent = structuredClone(base);
  changedContent.items[0] = {
    ...changedContent.items[0],
    stem: '같은 id지만 다른 발문',
    answer: { value: 99, display: '99', accepts: ['99'] },
  };
  assert.notEqual(fingerprint, buildWorksheetFingerprint(changedContent));
});

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

function generator(id, standardCode) {
  return {
    id,
    standardCode,
    skill: id,
    format: 'short-answer',
    difficulties: [1],
    generate(rng) {
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
        dedupeKey: String(value),
        difficulty: 1,
      };
    },
    verify({ value }, answer) {
      return value === answer.value;
    },
  };
}

test('worksheet rotation is standard-balanced rather than generator-balanced', () => {
  const codeA = '[2수01-01]';
  const codeB = '[2수01-02]';
  const generators = new Map([
    [codeA, [
      generator('a-1', codeA),
      generator('a-2', codeA),
      generator('a-3', codeA),
    ]],
    [codeB, [generator('b-1', codeB)]],
  ]);
  const worksheet = buildWorksheet(
    {
      upstream: { taxonomyVersion: 'test', integrity: [] },
      standards: [standard(codeA), standard(codeB)],
    },
    {
      forStandard(code) {
        return generators.get(code) ?? [];
      },
    },
    {
      seed: 'balanced',
      subject: 'math',
      count: 4,
      difficulty: 1,
    },
  );

  const histogram = Object.groupBy(
    worksheet.items,
    (item) => item.standardCode,
  );
  assert.equal(histogram[codeA].length, 2);
  assert.equal(histogram[codeB].length, 2);
});

test('library boundary rejects invalid worksheet options', () => {
  const spine = {
    upstream: { taxonomyVersion: 'test', integrity: [] },
    standards: [standard('[2수01-01]')],
  };
  const registry = {
    forStandard() {
      return [generator('one', '[2수01-01]')];
    },
  };

  assert.throws(
    () => buildWorksheet(spine, registry, { subject: 'math', count: Number.NaN }),
    /count/,
  );
  assert.throws(
    () => buildWorksheet(spine, registry, { subject: 'math', difficulty: 9 }),
    /difficulty/,
  );
  assert.throws(
    () => buildWorksheet(spine, registry, {
      subject: 'korean',
      followLearningOrder: true,
    }),
    /followLearningOrder/,
  );
});

