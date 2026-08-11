import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildWorksheet } from '../../src/engine/worksheet.mjs';

const CASES = {
  math: { code: '[2수01-06]', subjectKorean: '수학', gradeBand: '1-2' },
  korean: { code: '[2국04-01]', subjectKorean: '국어', gradeBand: '1-2' },
  english: { code: '[4영02-02]', subjectKorean: '영어', gradeBand: '3-4' },
};

function fixture(subject) {
  const { code, subjectKorean, gradeBand } = CASES[subject];
  const standard = {
    code,
    specId: `test.${subject}`,
    subject,
    subjectKorean,
    gradeBand,
    gradeStart: Number(gradeBand[0]),
    gradeEnd: Number(gradeBand[2]),
    domain: '테스트',
    module: '난이도 보정',
    source: {},
  };
  const generator = {
    id: `test.${subject}.calibrated`,
    standardCode: code,
    skill: '난이도 보정',
    format: 'short-answer',
    difficultyAxis: 'range',
    difficulties: [1, 2, 3],
    generate(rng, { difficulty }) {
      const left = rng.int(1, 1_000_000);
      const right = rng.int(1, 1_000_000);
      const value = left + right;
      return {
        params: { left, right },
        stem: `${left} + ${right} = ?`,
        answer: {
          value,
          display: String(value),
          accepts: [String(value)],
        },
        solution: [`${left} + ${right} = ${value}`],
        dedupeKey: `${difficulty}:${left}:${right}`,
        difficulty,
      };
    },
    verify({ left, right }, answer) {
      return left + right === answer.value;
    },
  };
  return {
    spine: {
      corpus: {
        schema: 'test-corpus',
        integrity: [{ file: 'test', sha256: 'abc' }],
      },
      standards: [standard],
    },
    registry: {
      forStandard(candidate) {
        return candidate === code ? [generator] : [];
      },
    },
  };
}

function issue(subject, options = {}) {
  const { spine, registry } = fixture(subject);
  return buildWorksheet(spine, registry, {
    subject,
    count: 100,
    seed: 'subject-difficulty-calibration',
    ...options,
  });
}

function meanDifficulty(worksheet) {
  return Object.entries(worksheet.difficultyHistogram)
    .reduce((sum, [level, count]) => sum + Number(level) * count, 0)
    / worksheet.produced;
}

test('default worksheets apply one subject-wide difficulty calibration policy', () => {
  const math = issue('math');
  const korean = issue('korean');
  const english = issue('english');

  assert.deepEqual(math.options.difficultyMix, { 1: 45, 2: 45, 3: 10 });
  assert.deepEqual(korean.options.difficultyMix, { 1: 15, 2: 50, 3: 35 });
  assert.deepEqual(english.options.difficultyMix, { 1: 15, 2: 50, 3: 35 });

  assert.ok(meanDifficulty(math) < meanDifficulty(korean));
  assert.ok(meanDifficulty(math) < meanDifficulty(english));
});

test('explicit difficulty options bypass subject-wide defaults', () => {
  const fixed = issue('english', { difficulty: 1 });
  const mixed = issue('math', { difficultyMix: { 3: 1 } });

  assert.deepEqual(fixed.difficultyHistogram, { 1: 100 });
  assert.deepEqual(fixed.options.difficultyMix, { 1: 0.3, 2: 0.5, 3: 0.2 });
  assert.deepEqual(mixed.difficultyHistogram, { 3: 100 });
  assert.deepEqual(mixed.options.difficultyMix, { 3: 1 });
});
