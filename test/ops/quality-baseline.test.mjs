import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');

const SUBJECT_GRADE_BANDS = [
  ['math', 'M', ['1-2', '3-4', '5-6']],
  ['korean', 'K', ['1-2', '3-4', '5-6']],
  ['english', 'E', ['3-4', '5-6']],
];
const EXPECTED_CASE_IDS = SUBJECT_GRADE_BANDS.flatMap(([, abbreviation, gradeBands]) =>
  gradeBands.flatMap((gradeBand) =>
    [1, 2, 3].map((difficulty) =>
      `WS-${abbreviation}${gradeBand.replace('-', '')}-D${difficulty}`)));
const REVIEW_AXES = [
  'curriculum-alignment',
  'answer-correctness',
  'wording-naturalness',
  'distractor-quality',
  'perceived-difficulty',
  'repetition',
];
const REVIEW_RATINGS = {
  core: ['pass', 'fix', 'undecidable', 'n-a'],
  perceivedDifficulty: ['match', 'easier', 'harder', 'undecidable'],
  repetition: ['varied', 'repetitive', 'undecidable'],
};

test('quality baseline deterministically covers 24 representative worksheets', async () => {
  const {
    buildQualityBaseline,
    renderQualityBaselineSamples,
  } = await import('../../tools/export-quality-baseline.mjs');

  const first = buildQualityBaseline();
  const second = buildQualityBaseline();
  assert.deepEqual(first, second);

  assert.equal(first.artifact.caseCount, 24);
  assert.equal(first.artifact.itemsPerCase, 10);
  assert.equal(first.artifact.totalItems, 240);
  assert.deepEqual(first.artifact.cases.map(({ id }) => id), EXPECTED_CASE_IDS);
  assert.equal(new Set(first.artifact.cases.map(({ worksheetFingerprint }) =>
    worksheetFingerprint)).size, 24);
  assert.ok(first.artifact.cases.every(({ standardsUsed }) => standardsUsed.length > 0));
  assert.ok(first.artifact.cases.every(({ difficultyHistogram }) =>
    Object.values(difficultyHistogram).reduce((sum, count) => sum + count, 0) === 10));
  assert.ok(first.worksheets.every(({ worksheet }) =>
    worksheet.produced === 10 && worksheet.shortfall === 0));

  const schema = JSON.parse(read('schema/quality-baseline.schema.json'));
  const validate = new Ajv2020({ allErrors: true }).compile(schema);
  assert.equal(validate(first.artifact), true, JSON.stringify(validate.errors));

  assert.deepEqual(
    JSON.parse(read('data/audit/quality-baseline.json')),
    first.artifact,
  );
  assert.equal(
    read('docs/review/quality-baseline.md'),
    renderQualityBaselineSamples(first),
  );
});

test('quality baseline exposes six human review axes and all case rows', async () => {
  const { buildQualityBaseline } = await import('../../tools/export-quality-baseline.mjs');
  const { artifact } = buildQualityBaseline();

  assert.deepEqual(artifact.reviewAxes, REVIEW_AXES);
  assert.deepEqual(artifact.reviewRatings, REVIEW_RATINGS);

  const review = read('docs/quality-evaluation.md');
  assert.ok(review.includes(`baselineFingerprint: \`${artifact.fingerprint}\``));
  for (const axis of REVIEW_AXES) assert.ok(review.includes(`\`${axis}\``), axis);
  for (const ratings of Object.values(REVIEW_RATINGS)) {
    for (const rating of ratings) assert.ok(review.includes(`\`${rating}\``), rating);
  }
  for (const caseId of EXPECTED_CASE_IDS) {
    assert.ok(review.includes(`| \`${caseId}\` |`), caseId);
  }
});
